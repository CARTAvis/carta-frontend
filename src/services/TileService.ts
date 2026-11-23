import {CARTA} from "carta-protobuf";
import {LRUCache} from "mnemonist";
import {action, computed, makeObservable, observable} from "mobx";
import {Subject} from "rxjs";

import {type Point2D, TileCoordinate} from "models";
import {BackendService, TileWebGLService} from "services";
import {AppStore, type FrameStore, PREVIEW_PV_FILEID} from "stores";
import {clamp, copyToFP32Texture, createFP32Texture, GL2} from "utilities";

import ZFPWorker from "!worker-loader!zfp_wrapper";

export interface RasterTile {
    data?: Float32Array;
    width: number | null | undefined;
    height: number | null | undefined;
    textureCoordinate: number | undefined;
}

export interface CompressedTile {
    tile: CARTA.TileData.$Properties;
    compressionQuality: number | null | undefined;
}

export interface TileStreamDetails {
    tileCount: number | undefined;
    fileId: number | null | undefined;
    channel: number | null | undefined;
    stokes: number | null | undefined;
    flush: boolean;
}

export const TEXTURE_SIZE = 4096;
export const TILE_SIZE = 256;
export const MAX_TEXTURES = 8;
const SINGLE_TILE_DECOMPRESSION_SYNC_ID = -1;

const MAX_TILE_WORKERS = 8;
const MIN_TILE_WORKERS = 1;
const MAX_TILE_WORKERS_PER_CORE = 0.75;
const CHANNEL_MAP_REQUEST_TIMEOUT_PER_CHANNEL = 20_000; // ms

interface TileMessageArgs {
    width: number | null | undefined;
    subsetHeight: number | null | undefined;
    subsetLength: number;
    requestId: number;
    tileCoordinate: number;
    layer: number | null | undefined;
    fileId: number;
    channel: number | null | undefined;
    stokes: number | null | undefined;
    compression?: number | null;
    nanEncodings?: Int32Array;
    syncId?: number | null;
}

interface CompressedTileRequest {
    fileId: number;
    channel: number | null | undefined;
    stokes: number | null | undefined;
    tile: CARTA.TileData.$Properties;
    precision: number | null | undefined;
    tileCoordinate: number;
    syncId?: number | null;
}

interface DecompressedTileResult {
    fileId: number | null | undefined;
    channel: number | null | undefined;
    stokes: number | null | undefined;
    data: Float32Array;
    width: number | null | undefined;
    height: number | null | undefined;
    encodedCoordinate: number;
    syncId: number | null | undefined;
    requestId?: number;
}

interface RasterSyncLocation {
    fileId: number | null | undefined;
    channel: number | null | undefined;
    stokes: number | null | undefined;
    syncId: number;
}

interface ChannelMapRequest {
    fileId: number;
    channel: number;
    stokes: number;
    requiredTiles: CARTA.AddRequiredTiles.$Properties;
    channels?: number[];
    batchTiming?: {
        timeoutMs: number;
        deadlineMs: number;
        timeoutAlert?: Promise<boolean>;
    };
    rasterRequest?: RasterRequestState;
}

interface ActiveChannelMapRequest extends ChannelMapRequest {
    requestId: number;
}

interface RasterRequestState {
    key: string;
    requestedTiles: Set<number>;
    viewGeneration: number;
    shouldSynchronize: boolean;
    setsChannel?: boolean;
}

interface RasterSyncState extends RasterRequestState {
    pendingRequestTiles: Set<number>;
    pendingDecompressions: Map<number, number>;
    receivedTiles: Map<number, RasterTile>;
    isComplete: boolean;
}

interface ChannelMapFileState {
    queue: ChannelMapRequest[];
    activeRequest?: ActiveChannelMapRequest;
    timeout?: ReturnType<typeof setTimeout>;
    desiredStokes?: number;
    confirmedStokes?: number;
}

function getTileRequestKey(fileId: number | null | undefined, stokes: number | null | undefined, channel: number | null | undefined) {
    return `${fileId}_${stokes}_${channel}`;
}

function getTileCacheKey(fileId: number | null | undefined, stokes: number | null | undefined, channel: number | null | undefined, encodedCoordinate: number) {
    return `${fileId}_${stokes}_${channel}_${encodedCoordinate}`;
}

function isTileKeyForFile(key: string | undefined, fileId: number) {
    return key?.startsWith(`${fileId}_`) ?? false;
}

function sortTilesByFocus(tiles: TileCoordinate[], focusPoint: Point2D) {
    const distanceSquared = (tile: TileCoordinate) => (focusPoint.x - tile.x) ** 2 + (focusPoint.y - tile.y) ** 2;
    return tiles.sort((a, b) => distanceSquared(a) - distanceSquared(b));
}

export class TileService {
    private static staticInstance: TileService;

    public static get Instance() {
        if (!TileService.staticInstance) {
            TileService.staticInstance = new TileService();
        }
        return TileService.staticInstance;
    }

    private readonly backendService: BackendService;
    private readonly cacheMapCompressedTiles: Map<number, LRUCache<string, CompressedTile>>;
    private readonly pendingRequests: Map<string | undefined, Map<number, boolean>>;
    private readonly pendingDecompressions: Map<string, Map<number, Map<number, number>>>;
    private readonly fileStateMap = new Map<number, {channel: number | null | undefined; stokes: number | null | undefined; isSelectionPending?: boolean}>();
    readonly tileStream: Subject<TileStreamDetails>;
    private cachedTiles: LRUCache<string, RasterTile>;
    private lruCapacitySystem: number;
    private textureArray: Array<WebGLTexture | null>;
    private textureCoordinateQueue: Array<number | undefined>;
    private readonly workers: Worker[];
    private compressionRequestCounter: number;
    private isAnimationEnabled: boolean;
    private readonly gl: WebGL2RenderingContext | null;
    private readonly rasterSyncStates: Map<number, RasterSyncState>;
    private readonly pendingRasterRequests: Map<number, RasterRequestState>;
    private readonly rasterViewGenerations: Map<string, number>;
    private readonly channelMapStates: Map<number, ChannelMapFileState>;
    private readonly channelMapPendingTiles: Set<string>;
    private readonly normalViewPendingTiles = observable.map<number, Set<string>>();
    private channelMapTargetFileId: number | undefined;

    @observable private channelMapPendingTileCount: number = 0;
    @observable workersReady: boolean[] | undefined;

    @computed get isZfpReady() {
        return this.workersReady && this.workersReady.every(isReady => isReady);
    }

    @computed get channelMapRemainingTiles() {
        return this.channelMapPendingTileCount;
    }

    getNormalViewRemainingTiles(fileId: number) {
        return this.normalViewPendingTiles.get(fileId)?.size ?? 0;
    }

    @action setWorkerReady(index: number) {
        if (this.workersReady && index >= 0 && index < this.workersReady.length) {
            this.workersReady[index] = true;
            this.workers[index].postMessage(["setid", index]);
        }
    }

    public decompressPreviewRasterData(previewData: CARTA.PvPreviewData) {
        const compressedArray = previewData.imageData;
        const nanEncodings32 = new Int32Array(previewData.nanEncodings.slice(0).buffer);
        const compressedView = new Uint8Array(Math.max(compressedArray.byteLength, previewData.width * previewData.height * 4));
        compressedView.set(compressedArray);

        const eventArgs = {
            fileId: PREVIEW_PV_FILEID,
            channel: 0,
            stokes: 0,
            width: previewData.width,
            subsetHeight: previewData.height,
            subsetLength: compressedArray.byteLength,
            compression: previewData.compressionQuality,
            nanEncodings: nanEncodings32,
            tileCoordinate: 0,
            layer: 0,
            requestId: 0,
            previewId: previewData.previewId
        };

        this.workers[0].postMessage(["preview decompress", compressedView.buffer, eventArgs, previewData], [compressedView.buffer, nanEncodings32.buffer]);
    }

    @action setAnimationEnabled(isEnabled: boolean) {
        if (this.isAnimationEnabled !== isEnabled) {
            this.isAnimationEnabled = isEnabled;
            this.resetRasterRequests();
        }
    }

    public setCache = (lruCapacityGPU: number, lruCapacitySystem: number) => {
        // L1 cache: on GPU
        const numTilesPerTexture = (TEXTURE_SIZE * TEXTURE_SIZE) / (TILE_SIZE * TILE_SIZE);
        const numTextures = Math.min(Math.ceil(lruCapacityGPU / numTilesPerTexture), MAX_TEXTURES);
        lruCapacityGPU = numTextures * numTilesPerTexture;
        console.log(`lruGPU capacity rounded to : ${lruCapacityGPU}`);

        this.textureArray = new Array<WebGLTexture>(numTextures);
        this.initTextures();
        this.resetCoordinateQueue();
        this.cachedTiles = new LRUCache<string, RasterTile>(Array, ArrayBuffer, lruCapacityGPU);

        // L2 cache: compressed tiles on system memory
        this.lruCapacitySystem = lruCapacitySystem;
    };

    private constructor() {
        this.backendService = BackendService.Instance;
        this.gl = TileWebGLService.Instance.gl;

        this.pendingRequests = new Map<string, Map<number, boolean>>();
        this.cacheMapCompressedTiles = new Map<number, LRUCache<string, CompressedTile>>();
        this.pendingDecompressions = new Map<string, Map<number, Map<number, number>>>();
        this.rasterSyncStates = new Map<number, RasterSyncState>();
        this.pendingRasterRequests = new Map<number, RasterRequestState>();
        this.rasterViewGenerations = new Map<string, number>();
        this.channelMapStates = new Map<number, ChannelMapFileState>();
        this.channelMapPendingTiles = new Set<string>();

        this.compressionRequestCounter = 0;
        this.isAnimationEnabled = false;

        this.tileStream = new Subject<TileStreamDetails>();
        this.backendService.rasterTileStream.subscribe(message => this.handleStreamedTiles(message));
        this.backendService.rasterSyncStream.subscribe(event => this.handleStreamSync(event.rasterTileSync, event.eventId));
        this.backendService.channelMapFlowControlStream.subscribe(event => this.handleChannelMapFlowControl(event.eventId, event.flowControl));
        this.workers = new Array<Worker>(clamp(Math.ceil((navigator.hardwareConcurrency || 6) * MAX_TILE_WORKERS_PER_CORE), MIN_TILE_WORKERS, MAX_TILE_WORKERS));
        this.workersReady = new Array<boolean>(this.workers.length);

        for (let i = 0; i < this.workers.length; i++) {
            this.workers[i] = new ZFPWorker();
            this.workers[i].onmessage = (event: MessageEvent) => {
                if (event.data?.[0] === "ready") {
                    this.setWorkerReady(i);
                } else if (event.data?.[0] === "decompress") {
                    const buffer = event.data[1];
                    const eventArgs = event.data[2] as TileMessageArgs;
                    const length = (eventArgs.width ?? NaN) * (eventArgs.subsetHeight ?? NaN);
                    const resultArray = new Float32Array(buffer, 0, length);
                    this.updateStream({
                        fileId: eventArgs.fileId,
                        channel: eventArgs.channel,
                        stokes: eventArgs.stokes,
                        data: resultArray,
                        width: eventArgs.width,
                        height: eventArgs.subsetHeight,
                        encodedCoordinate: eventArgs.tileCoordinate,
                        syncId: eventArgs.syncId,
                        requestId: eventArgs.requestId
                    });
                } else if (event.data?.[0] === "preview decompress") {
                    const buffer = event.data[1];
                    const eventArgs = event.data[2];
                    const frame = AppStore.Instance.previewFrames.get(eventArgs.previewId);
                    const length = eventArgs.width * eventArgs.subsetHeight;
                    const resultArray = new Float32Array(buffer, 0, length);
                    frame?.setPreviewPVRasterData(resultArray);
                }
            };
        }
        makeObservable(this);
    }

    private getChannelMapState(fileId: number) {
        let state = this.channelMapStates.get(fileId);
        if (!state) {
            state = {queue: []};
            this.channelMapStates.set(fileId, state);
        }
        return state;
    }

    private beginRasterView(key: string) {
        const generation = (this.rasterViewGenerations.get(key) ?? 0) + 1;
        this.rasterViewGenerations.set(key, generation);
        return generation;
    }

    private queueRasterRequest(requestId: number, request: RasterRequestState) {
        this.pendingRasterRequests.set(requestId, request);
    }

    private takePendingRasterRequest(requestId: number, key: string, requestedTileCount: number) {
        const exactRequest = this.pendingRasterRequests.get(requestId);
        if (exactRequest?.key === key) {
            this.pendingRasterRequests.delete(requestId);
            return exactRequest;
        }
        if (requestId !== 0) {
            return undefined;
        }

        const matchingRequests = Array.from(this.pendingRasterRequests.entries()).filter(([, request]) => request.key === key);
        const fallback = matchingRequests.find(([, request]) => request.requestedTiles.size === requestedTileCount) ?? matchingRequests[0];
        if (fallback) {
            this.pendingRasterRequests.delete(fallback[0]);
            return fallback[1];
        }
        return undefined;
    }

    private setChannelMapTargetTiles(tiles: TileCoordinate[], fileId: number, stokes: number, channels: number[]) {
        this.channelMapTargetFileId = fileId;
        this.channelMapPendingTiles.clear();
        for (const channel of channels) {
            for (const tile of tiles) {
                if (tile.layer < 0) {
                    continue;
                }
                const cacheKey = getTileCacheKey(fileId, stokes, channel, tile.encode());
                if (!this.cachedTiles.has(cacheKey)) {
                    this.channelMapPendingTiles.add(cacheKey);
                }
            }
        }
        this.channelMapPendingTileCount = this.channelMapPendingTiles.size;
    }

    private resolveChannelMapTile(fileId: number | null | undefined, stokes: number | null | undefined, channel: number | null | undefined, encodedCoordinate: number) {
        if (this.channelMapPendingTiles.delete(getTileCacheKey(fileId, stokes, channel, encodedCoordinate))) {
            this.channelMapPendingTileCount = this.channelMapPendingTiles.size;
        }
    }

    private resetChannelMapLoading() {
        this.channelMapTargetFileId = undefined;
        this.channelMapPendingTiles.clear();
        this.channelMapPendingTileCount = 0;
    }

    private setNormalViewTargetTiles(tiles: TileCoordinate[], fileId: number, stokes: number, channel: number) {
        const pendingTiles = new Set<string>();
        for (const tile of tiles) {
            if (tile.layer < 0) {
                continue;
            }
            const cacheKey = getTileCacheKey(fileId, stokes, channel, tile.encode());
            if (!this.cachedTiles.has(cacheKey)) {
                pendingTiles.add(cacheKey);
            }
        }
        if (pendingTiles.size) {
            this.normalViewPendingTiles.set(fileId, pendingTiles);
        } else {
            this.resetNormalViewLoading(fileId);
        }
    }

    private resolveNormalViewTile(fileId: number | null | undefined, stokes: number | null | undefined, channel: number | null | undefined, encodedCoordinate: number) {
        if (fileId === null || fileId === undefined) {
            return;
        }
        const pendingTiles = this.normalViewPendingTiles.get(fileId);
        if (pendingTiles?.delete(getTileCacheKey(fileId, stokes, channel, encodedCoordinate))) {
            if (!pendingTiles.size) {
                this.resetNormalViewLoading(fileId);
            }
        }
    }

    private resetNormalViewLoading(fileId?: number) {
        if (fileId === undefined) {
            this.normalViewPendingTiles.clear();
        } else {
            this.normalViewPendingTiles.delete(fileId);
        }
    }

    private removePendingTiles(key: string, tiles: Iterable<number>) {
        const pendingTiles = this.pendingRequests.get(key);
        for (const tile of tiles) {
            pendingTiles?.delete(tile);
        }
        if (!pendingTiles?.size) {
            this.pendingRequests.delete(key);
        }
    }

    private isTileRequestedByAnotherSync(key: string, encodedCoordinate: number, excludedSyncId: number) {
        if (this.pendingDecompressions.get(key)?.get(SINGLE_TILE_DECOMPRESSION_SYNC_ID)?.has(encodedCoordinate)) {
            return true;
        }
        for (const request of this.pendingRasterRequests.values()) {
            if (request.key === key && request.requestedTiles.has(encodedCoordinate)) {
                return true;
            }
        }
        for (const [syncId, state] of this.rasterSyncStates) {
            if (syncId !== excludedSyncId && state.key === key && (state.pendingRequestTiles.has(encodedCoordinate) || state.pendingDecompressions.has(encodedCoordinate) || state.receivedTiles.has(encodedCoordinate))) {
                return true;
            }
        }
        return false;
    }

    private resetCoordinateQueue() {
        const numTilesPerTexture = (TEXTURE_SIZE * TEXTURE_SIZE) / (TILE_SIZE * TILE_SIZE);
        const numTextures = this.textureArray.length;
        const totalTiles = numTextures * numTilesPerTexture;
        this.textureCoordinateQueue = new Array<number>(totalTiles);

        for (let i = 0; i < totalTiles; i++) {
            this.textureCoordinateQueue[i] = totalTiles - 1 - i;
        }
    }

    private getCompressedCache(fileId: number) {
        const cache = this.cacheMapCompressedTiles.get(fileId);
        if (cache) {
            return cache;
        } else {
            const newCache = new LRUCache<string, CompressedTile>(Array, ArrayBuffer, this.lruCapacitySystem);
            this.cacheMapCompressedTiles.set(fileId, newCache);
            return newCache;
        }
    }

    getTile(fileId: number, stokes: number, channel: number, encodedCoordinate: number, shouldPeek: boolean = false) {
        const tileCacheKey = getTileCacheKey(fileId, stokes, channel, encodedCoordinate);
        if (shouldPeek) {
            return this.cachedTiles.peek(tileCacheKey);
        }
        return this.cachedTiles.get(tileCacheKey);
    }

    private getRequiredRequestTiles(tiles: TileCoordinate[], fileId: number, channel: number, stokes: number) {
        const newRequests = new Array<TileCoordinate>();
        const key = getTileRequestKey(fileId, stokes, channel);
        const pendingTiles = this.pendingRequests.get(key);
        let pendingCompressionMap = this.pendingDecompressions.get(key);
        for (const tile of tiles) {
            if (tile.layer < 0) {
                continue;
            }
            const encodedCoordinate = tile.encode();
            const tileCacheKey = getTileCacheKey(fileId, stokes, channel, encodedCoordinate);
            if (this.cachedTiles.has(tileCacheKey) || pendingTiles?.has(encodedCoordinate) || pendingCompressionMap?.get(SINGLE_TILE_DECOMPRESSION_SYNC_ID)?.has(encodedCoordinate)) {
                continue;
            }
            const compressedTile = this.getCompressedCache(fileId).get(tileCacheKey);
            if (!compressedTile) {
                newRequests.push(tile);
            } else if (!pendingCompressionMap || !Array.from(pendingCompressionMap.values()).some(map => map.has(encodedCoordinate))) {
                if (!pendingCompressionMap) {
                    pendingCompressionMap = new Map();
                    this.pendingDecompressions.set(key, pendingCompressionMap);
                }
                if (!pendingCompressionMap.has(SINGLE_TILE_DECOMPRESSION_SYNC_ID)) {
                    pendingCompressionMap.set(SINGLE_TILE_DECOMPRESSION_SYNC_ID, new Map());
                }
                // Load from L2 cache instead
                this.asyncDecompressTile({fileId, channel, stokes, tile: compressedTile.tile, precision: compressedTile.compressionQuality, tileCoordinate: encodedCoordinate, syncId: SINGLE_TILE_DECOMPRESSION_SYNC_ID});
            }
        }
        return newRequests;
    }

    private trackPendingRequests(fileId: number, channel: number, stokes: number, tiles: number[]) {
        if (!tiles.length) {
            return;
        }
        const key = getTileRequestKey(fileId, stokes, channel);
        let pendingTiles = this.pendingRequests.get(key);
        if (!pendingTiles) {
            pendingTiles = new Map();
            this.pendingRequests.set(key, pendingTiles);
        }
        tiles.forEach(tile => pendingTiles.set(tile, true));
    }

    @action requestTiles(tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, focusPoint: Point2D, compressionQuality: number, isChannelTransition = false, shouldRestoreSelection = false) {
        const key = getTileRequestKey(fileId, stokes, channel);
        const currentSelection = this.fileStateMap.get(fileId);
        const hasSelectionChanged = currentSelection ? currentSelection.channel !== channel || currentSelection.stokes !== stokes : isChannelTransition;
        const shouldSelectChannel = hasSelectionChanged || shouldRestoreSelection;
        const shouldSynchronize = isChannelTransition || shouldSelectChannel || !currentSelection;

        if (shouldSelectChannel) {
            this.clearRequestQueue(fileId);
            this.clearRasterSynchronization(fileId);
        }

        const viewGeneration = this.beginRasterView(key);
        const newRequests = this.getRequiredRequestTiles(tiles, fileId, channel, stokes);
        this.setNormalViewTargetTiles(tiles, fileId, stokes, channel);

        let requestId: number | null = null;
        const shouldSendSelection = shouldSelectChannel || ((isChannelTransition || currentSelection?.isSelectionPending) && newRequests.length > 0);
        if (newRequests.length) {
            const superseded = new Map<number, RasterRequestState>();
            if (shouldSendSelection) {
                for (const [id, request] of this.pendingRasterRequests) {
                    if (request.key === key && request.setsChannel) {
                        superseded.set(id, request);
                    }
                }
            }
            if (superseded.size) {
                // The backend can coalesce SetImageChannels before a stream starts.
                // Carry forward pending tiles from the current viewport in the replacement.
                const previousTiles = new Set(Array.from(superseded.values()).flatMap(request => Array.from(request.requestedTiles)));
                newRequests.push(...tiles.filter(tile => tile.layer >= 0 && previousTiles.has(tile.encode())));
            }
            // sort by distance to midpoint and encode
            const sortedRequests = sortTilesByFocus(newRequests, focusPoint).map(tile => tile.encode());
            const rasterRequest: RasterRequestState = {key, requestedTiles: new Set(sortedRequests), viewGeneration, shouldSynchronize, setsChannel: shouldSendSelection};
            if (shouldSendSelection) {
                requestId = this.backendService.setChannels(fileId, channel, stokes, {fileId, compressionQuality, compressionType: CARTA.CompressionType.ZFP, tiles: sortedRequests});
            } else {
                requestId = this.backendService.addRequiredTiles(fileId, sortedRequests, compressionQuality);
            }
            if (requestId !== null) {
                for (const [id, request] of superseded) {
                    this.pendingRasterRequests.delete(id);
                    this.removePendingTiles(key, request.requestedTiles);
                }
                this.trackPendingRequests(fileId, channel, stokes, sortedRequests);
                this.queueRasterRequest(requestId, rasterRequest);
            } else {
                for (const tile of sortedRequests) {
                    if (!this.pendingRequests.get(key)?.has(tile)) {
                        this.resolveNormalViewTile(fileId, stokes, channel, tile);
                    }
                }
            }
        } else {
            if (shouldSendSelection) {
                requestId = this.backendService.setChannels(fileId, channel, stokes, {fileId, compressionQuality, compressionType: CARTA.CompressionType.ZFP, tiles: []});
            }
            if (requestId !== null || (!shouldSendSelection && !currentSelection)) {
                this.setCurrentChannel(fileId, channel, stokes, shouldSendSelection);
            }
            if ((!shouldSendSelection || requestId !== null) && !this.normalViewPendingTiles.has(fileId)) {
                this.tileStream.next({tileCount: 0, fileId, channel, stokes, flush: false});
            }
            return;
        }
        if (requestId !== null) {
            this.setCurrentChannel(fileId, channel, stokes, shouldSendSelection);
        }
    }

    @action requestChannelMapTiles(tiles: TileCoordinate[], frame: FrameStore, focusPoint: Point2D, compressionQuality: number, requestedChannels: number[]) {
        if (!frame) {
            return;
        }
        const fileId = frame.frameInfo.fileId;
        if (this.channelMapTargetFileId !== undefined && this.channelMapTargetFileId !== fileId) {
            this.cancelChannelMapRequests(this.channelMapTargetFileId);
        }
        const stokes = frame.stokes;
        const previousStokes = this.fileStateMap.get(fileId)?.stokes;
        const channelMapState = this.getChannelMapState(fileId);
        if (channelMapState.confirmedStokes === undefined) {
            channelMapState.confirmedStokes = previousStokes ?? stokes;
        }
        channelMapState.desiredStokes = stokes;
        this.setCurrentChannel(fileId, frame.channel, stokes);
        const viewGenerations = new Map<number, number>();
        for (const channel of requestedChannels) {
            viewGenerations.set(channel, this.beginRasterView(getTileRequestKey(fileId, stokes, channel)));
        }

        const requests: ChannelMapRequest[] = [];
        const tilesByFocus = sortTilesByFocus([...tiles], focusPoint);
        for (const channel of requestedChannels) {
            const sortedTiles = this.getRequiredRequestTiles(tilesByFocus, fileId, channel, stokes).map(tile => tile.encode());
            if (sortedTiles.length) {
                const key = getTileRequestKey(fileId, stokes, channel);
                requests.push({
                    fileId,
                    channel,
                    stokes,
                    channels: requestedChannels,
                    requiredTiles: {fileId, compressionQuality, compressionType: CARTA.CompressionType.ZFP, tiles: sortedTiles},
                    rasterRequest: {
                        key,
                        requestedTiles: new Set(sortedTiles),
                        viewGeneration: viewGenerations.get(channel) ?? 0,
                        shouldSynchronize: false
                    }
                });
            }
        }

        const activeRequest = channelMapState.activeRequest;
        const activeChannelRequest: ChannelMapRequest = {fileId, channel: frame.channel, stokes, requiredTiles: {}, channels: requestedChannels};
        const activeChannelIndex = requests.findIndex(request => request.channel === frame.channel);
        if (activeChannelIndex > 0) {
            requests.unshift(requests.splice(activeChannelIndex, 1)[0]);
        }

        const isStokesTransitionPending = activeRequest?.stokes === stokes && !activeRequest.requiredTiles.tiles?.length;
        const isStokesTransitionRequired = channelMapState.confirmedStokes !== channelMapState.desiredStokes && !isStokesTransitionPending;
        if (requests.length || isStokesTransitionRequired) {
            requests.unshift(activeChannelRequest);
        }

        const isActiveChannelRequestPending =
            activeRequest?.channel === frame.channel &&
            activeRequest.stokes === stokes &&
            !activeRequest.requiredTiles.tiles?.length &&
            activeRequest.channels?.length === requestedChannels.length &&
            activeRequest.channels.every((channel, index) => channel === requestedChannels[index]);
        const hasDifferentActiveRequest = !!activeRequest && (activeRequest.channel !== frame.channel || activeRequest.stokes !== stokes);
        const shouldAppendActiveChannel = requests.some(request => request.channel !== frame.channel) || hasDifferentActiveRequest || (!requests.length && !isActiveChannelRequestPending);
        if (shouldAppendActiveChannel) {
            requests.push(activeChannelRequest);
        }
        this.setChannelMapTargetTiles(tiles, fileId, stokes, requestedChannels);
        this.queueChannelMapRequests(fileId, requests);
    }

    private setCurrentChannel(fileId: number, channel: number | null | undefined, stokes: number | null | undefined, isSelectionPending = false) {
        this.fileStateMap.set(fileId, {channel, stokes, ...(isSelectionPending ? {isSelectionPending} : {})});
    }

    private queueChannelMapRequests(fileId: number, requests: ChannelMapRequest[]) {
        const requestedChannelCount = new Set(requests.map(request => request.channel)).size;
        const batchTimeoutMs = Math.max(requestedChannelCount, 1) * CHANNEL_MAP_REQUEST_TIMEOUT_PER_CHANNEL;
        const batchTiming = {timeoutMs: batchTimeoutMs, deadlineMs: Date.now() + batchTimeoutMs};
        const channelMapState = this.getChannelMapState(fileId);
        channelMapState.queue = requests.map(request => ({...request, batchTiming}));
        if (!channelMapState.activeRequest) {
            this.sendNextChannelMapRequest(fileId);
        }
    }

    private sendNextChannelMapRequest(fileId: number, completedBatchTiming?: ChannelMapRequest["batchTiming"]) {
        const channelMapState = this.getChannelMapState(fileId);
        let request = channelMapState.queue.shift();
        if (!request) {
            this.dismissChannelMapTimeoutAlert(completedBatchTiming);
            return;
        }
        if (request.batchTiming !== completedBatchTiming) {
            this.dismissChannelMapTimeoutAlert(completedBatchTiming);
        }

        let tiles = request.requiredTiles.tiles ?? [];
        const desiredStokes = channelMapState.desiredStokes;
        if (tiles.length && desiredStokes !== undefined && channelMapState.confirmedStokes !== desiredStokes) {
            channelMapState.queue.unshift(request);
            request = {
                ...request,
                fileId,
                channel: this.fileStateMap.get(fileId)?.channel ?? request.channel,
                stokes: desiredStokes,
                requiredTiles: {}
            };
            tiles = [];
        }

        const requestId = request.channels
            ? this.backendService.setChannels(request.fileId, request.channel, request.stokes, request.requiredTiles, true, request.channels)
            : this.backendService.setChannels(request.fileId, request.channel, request.stokes, request.requiredTiles, true);
        if (requestId !== null) {
            this.trackPendingRequests(request.fileId, request.channel, request.stokes, tiles);
            channelMapState.activeRequest = {...request, requestId};
            if (tiles.length && request.rasterRequest) {
                this.queueRasterRequest(requestId, request.rasterRequest);
            }
            const remainingBatchTimeMs = Math.max((request.batchTiming?.deadlineMs ?? Date.now() + CHANNEL_MAP_REQUEST_TIMEOUT_PER_CHANNEL) - Date.now(), 0);
            if (!request.batchTiming?.timeoutAlert) {
                this.startChannelMapRequestTimeout(fileId, requestId, remainingBatchTimeMs);
            }
        } else {
            this.clearRequestQueue(fileId);
            channelMapState.queue = [];
            this.dismissChannelMapTimeoutAlert(request.batchTiming);
            this.clearRasterSynchronization(fileId);
        }
    }

    private handleChannelMapFlowControl(eventId: number, message: CARTA.ChannelMapFlowControl.$Properties) {
        const fileId = message.fileId;
        if (fileId === null || fileId === undefined) {
            return;
        }
        const channelMapState = this.channelMapStates.get(fileId);
        const activeRequest = channelMapState?.activeRequest;
        if (!activeRequest || activeRequest.requestId !== eventId) {
            return;
        }
        if (activeRequest.channel !== message.completedChannel) {
            console.warn(`Channel Map completion mismatch for request ${eventId}: expected channel ${activeRequest.channel}, received ${message.completedChannel}`);
            return;
        }

        this.clearChannelMapRequestTimers(fileId);
        channelMapState.activeRequest = undefined;
        if (message.status !== CARTA.ChannelMapFlowControl.Status.COMPLETED) {
            console.warn(`Channel Map request ${eventId} failed with status ${CARTA.ChannelMapFlowControl.Status[message.status ?? -1]}`);
            this.clearRequestQueue(fileId);
            channelMapState.queue = [];
            this.dismissChannelMapTimeoutAlert(activeRequest.batchTiming);
            this.clearRasterSynchronization(fileId);
            return;
        }

        if (!activeRequest.requiredTiles.tiles?.length) {
            channelMapState.confirmedStokes = activeRequest.stokes;
        }
        this.sendNextChannelMapRequest(fileId, activeRequest.batchTiming);
    }

    private startChannelMapRequestTimeout(fileId: number, requestId: number, channelMapRequestTimeoutMs: number = CHANNEL_MAP_REQUEST_TIMEOUT_PER_CHANNEL) {
        const channelMapState = this.getChannelMapState(fileId);
        const existingTimeout = channelMapState.timeout;
        if (existingTimeout !== undefined) {
            clearTimeout(existingTimeout);
        }
        channelMapState.timeout = setTimeout(() => {
            void this.handleChannelMapRequestTimeout(fileId, requestId);
        }, channelMapRequestTimeoutMs);
    }

    private async handleChannelMapRequestTimeout(fileId: number, requestId: number) {
        const channelMapState = this.getChannelMapState(fileId);
        const activeRequest = channelMapState.activeRequest;
        if (!activeRequest || activeRequest.requestId !== requestId) {
            return;
        }
        const batchTiming = activeRequest.batchTiming;
        if (batchTiming?.timeoutAlert) {
            return;
        }

        channelMapState.timeout = undefined;
        const batchTimeoutMs = batchTiming?.timeoutMs ?? CHANNEL_MAP_REQUEST_TIMEOUT_PER_CHANNEL;
        const timeoutAlert = AppStore.Instance.alertStore.showInteractiveAlert(`Updating channel map takes longer than ${batchTimeoutMs / 1000} seconds. Click OK to continue or Cancel to stop updating.`, "warning-sign");
        if (batchTiming) {
            batchTiming.timeoutAlert = timeoutAlert;
        }
        const shouldKeepWaiting = await timeoutAlert;
        if (batchTiming?.timeoutAlert === timeoutAlert) {
            batchTiming.timeoutAlert = undefined;
        }
        const currentRequest = channelMapState.activeRequest;
        if (!currentRequest || currentRequest.batchTiming !== batchTiming) {
            return;
        }
        if (shouldKeepWaiting) {
            if (batchTiming) {
                batchTiming.deadlineMs = Date.now() + batchTimeoutMs;
            }
            this.startChannelMapRequestTimeout(fileId, currentRequest.requestId, batchTimeoutMs);
            return;
        }

        this.clearChannelMapRequestTimers(fileId);
        channelMapState.activeRequest = undefined;
        this.clearRequestQueue(fileId);
        channelMapState.queue = [];
        this.clearRasterSynchronization(fileId);
        const selectedChannels = this.fileStateMap.get(fileId);
        if (selectedChannels?.channel !== null && selectedChannels?.channel !== undefined && selectedChannels.stokes !== null && selectedChannels.stokes !== undefined) {
            this.backendService.setChannels(fileId, selectedChannels.channel, selectedChannels.stokes, {});
        }
    }

    private dismissChannelMapTimeoutAlert(batchTiming?: ChannelMapRequest["batchTiming"]) {
        if (batchTiming?.timeoutAlert) {
            AppStore.Instance.alertStore.dismissInteractiveAlert(batchTiming.timeoutAlert);
            batchTiming.timeoutAlert = undefined;
        }
    }

    private clearChannelMapRequestTimers(fileId: number) {
        const channelMapState = this.getChannelMapState(fileId);
        const timeout = channelMapState.timeout;
        if (timeout !== undefined) {
            clearTimeout(timeout);
            channelMapState.timeout = undefined;
        }
    }

    cancelChannelMapRequests(fileId?: number) {
        const fileIds = fileId === undefined ? Array.from(this.channelMapStates.keys()) : [fileId];
        fileIds.forEach(id => {
            const channelMapState = this.getChannelMapState(id);
            this.dismissChannelMapTimeoutAlert(channelMapState.activeRequest?.batchTiming);
            channelMapState.queue.forEach(request => this.dismissChannelMapTimeoutAlert(request.batchTiming));
            this.clearChannelMapRequestTimers(id);
            this.clearRequestQueue(id);
            this.clearRasterSynchronization(id);
            channelMapState.activeRequest = undefined;
            this.channelMapStates.delete(id);
        });
    }

    private clearRasterSynchronization(fileId: number) {
        this.pendingDecompressions.forEach((_syncMaps, key) => {
            if (isTileKeyForFile(key, fileId)) {
                this.pendingDecompressions.delete(key);
            }
        });
        this.rasterSyncStates.forEach((state, syncId) => {
            if (isTileKeyForFile(state.key, fileId)) {
                this.rasterSyncStates.delete(syncId);
            }
        });
        this.pendingRasterRequests.forEach((request, requestId) => {
            if (isTileKeyForFile(request.key, fileId)) {
                this.pendingRasterRequests.delete(requestId);
            }
        });
        this.rasterViewGenerations.forEach((_generation, key) => {
            if (isTileKeyForFile(key, fileId)) {
                this.rasterViewGenerations.delete(key);
            }
        });
    }

    updateHiddenFileChannels(fileId: number, channel: number, stokes: number) {
        if (this.backendService.setChannels(fileId, channel, stokes, {}) !== null) {
            this.setCurrentChannel(fileId, channel, stokes, true);
        }
    }

    @action resetForSessionResume() {
        this.channelMapStates.forEach(state => {
            this.dismissChannelMapTimeoutAlert(state.activeRequest?.batchTiming);
            if (state.timeout !== undefined) {
                clearTimeout(state.timeout);
            }
            state.activeRequest = undefined;
        });
        this.channelMapStates.clear();
        this.resetRasterRequests();
    }

    private resetRasterRequests() {
        this.clearRequestQueue();
        this.pendingDecompressions.clear();
        this.rasterSyncStates.clear();
        this.pendingRasterRequests.clear();
        this.rasterViewGenerations.clear();
    }

    clearGPUCache(fileId: number | null | undefined) {
        const cacheCapacity = this.cachedTiles.capacity;
        const keys: string[] = [];
        const tiles: RasterTile[] = [];

        for (const [key, tile] of this.cachedTiles) {
            // Clear tile if it matches the fileId, otherwise add it to the collection of tiles to add to the new cache
            if (fileId !== null && fileId !== undefined && isTileKeyForFile(key, fileId)) {
                this.clearTile(tile, key);
            } else {
                keys.push(key);
                tiles.push(tile);
            }
        }

        // populate new cache with old entries, from oldest to newest, in order to preserve LRU ordering
        this.cachedTiles = new LRUCache<string, RasterTile>(Array, ArrayBuffer, cacheCapacity);
        for (let i = keys.length - 1; i >= 0; i--) {
            this.cachedTiles.set(keys[i], tiles[i]);
        }
    }

    clearCompressedCache(fileId: number) {
        if (fileId === -1) {
            this.cacheMapCompressedTiles.clear();
        } else {
            this.cacheMapCompressedTiles.delete(fileId);
        }
    }

    @action clearRequestQueue(fileId?: number) {
        if (fileId !== undefined) {
            // Clear all requests with the given file ID
            this.pendingRequests.forEach((_pendingTiles, key) => {
                if (isTileKeyForFile(key, fileId)) {
                    this.pendingRequests.delete(key);
                }
            });
        } else {
            // Clear all requests
            this.pendingRequests.clear();
        }

        if (fileId === undefined || this.channelMapTargetFileId === fileId) {
            this.resetChannelMapLoading();
        }
        this.resetNormalViewLoading(fileId);
    }

    handleFileClosed(fileId: number) {
        this.cancelChannelMapRequests(fileId);
        this.clearCompressedCache(fileId);
        this.clearGPUCache(fileId);
        this.fileStateMap.delete(fileId);
    }

    private initTextures() {
        const textureSizeMb = (TEXTURE_SIZE * TEXTURE_SIZE * 4) / 1024 / 1024;
        console.log(`Creating ${this.textureArray.length} tile textures of size ${textureSizeMb} MB each (${textureSizeMb * this.textureArray.length} MB total)`);
        for (let i = 0; i < this.textureArray.length; i++) {
            this.textureArray[i] = createFP32Texture(this.gl, TEXTURE_SIZE, TEXTURE_SIZE, GL2.TEXTURE0);
        }
    }

    uploadTileToGPU(tile: RasterTile) {
        const textureParameters = this.getTileTextureParameters(tile);
        if (textureParameters.texture && tile.width && tile.height && tile.data) {
            copyToFP32Texture(this.gl, textureParameters.texture, tile.data, GL2.TEXTURE0, tile.width, tile.height, textureParameters.offset.x, textureParameters.offset.y);
        }
    }

    getTileTextureParameters(tile: RasterTile) {
        const numTilesPerTexture = (TEXTURE_SIZE * TEXTURE_SIZE) / (TILE_SIZE * TILE_SIZE);
        const localOffset = (tile.textureCoordinate ?? NaN) % numTilesPerTexture;
        const textureIndex = Math.floor(((tile.textureCoordinate ?? NaN) - localOffset) / numTilesPerTexture);
        const tilesPerRow = TEXTURE_SIZE / TILE_SIZE;
        const xOffset = (localOffset % tilesPerRow) * TILE_SIZE;
        const yOffset = Math.floor(localOffset / tilesPerRow) * TILE_SIZE;
        return {
            texture: this.textureArray[textureIndex],
            offset: {x: xOffset, y: yOffset}
        };
    }

    private clearTile = (tile: RasterTile, _key: any) => {
        if (tile.data) {
            delete tile.data;
        }
        this.textureCoordinateQueue.push(tile.textureCoordinate);
    };

    @action private handleStreamSync(syncMessage: CARTA.RasterTileSync.$Properties, requestId: number = 0) {
        const key = getTileRequestKey(syncMessage.fileId, syncMessage.stokes, syncMessage.channel);
        if (this.isAnimationEnabled && syncMessage.animationId !== this.backendService.animationId) {
            return;
        } else if (!this.isAnimationEnabled && syncMessage.animationId !== 0) {
            return;
        }

        if (syncMessage.syncId === null || syncMessage.syncId === undefined) {
            return;
        }

        const syncId = syncMessage.syncId;
        if (!syncMessage.endSync) {
            if (this.rasterSyncStates.has(syncId)) {
                return;
            }
            const queuedRequest = this.takePendingRasterRequest(requestId, key, syncMessage.tileCount ?? 0);
            if (!queuedRequest && !this.isAnimationEnabled) {
                return;
            }
            if (queuedRequest?.setsChannel && syncMessage.fileId != null) {
                const selection = this.fileStateMap.get(syncMessage.fileId);
                if (selection?.channel === syncMessage.channel && selection?.stokes === syncMessage.stokes) {
                    this.setCurrentChannel(syncMessage.fileId, syncMessage.channel, syncMessage.stokes);
                }
            }
            const requestedTiles = queuedRequest?.requestedTiles ?? new Set<number>();
            const pendingDecompressions = new Map<number, number>();
            this.rasterSyncStates.set(syncId, {
                ...(queuedRequest ?? {key, viewGeneration: 0, shouldSynchronize: true}),
                requestedTiles,
                pendingRequestTiles: new Set(requestedTiles),
                pendingDecompressions,
                receivedTiles: new Map<number, RasterTile>(),
                isComplete: false
            });
            let syncMaps = this.pendingDecompressions.get(key);
            if (!syncMaps) {
                syncMaps = new Map();
                this.pendingDecompressions.set(key, syncMaps);
            }
            syncMaps.set(syncId, pendingDecompressions);
        } else {
            const syncState = this.rasterSyncStates.get(syncId);
            if (syncState?.key !== key || syncState.isComplete) {
                return;
            }
            syncState.isComplete = true;
            for (const tile of syncState.pendingRequestTiles) {
                if (!this.isTileRequestedByAnotherSync(key, tile, syncId)) {
                    this.removePendingTiles(key, [tile]);
                    this.resolveChannelMapTile(syncMessage.fileId, syncMessage.stokes, syncMessage.channel, tile);
                    this.resolveNormalViewTile(syncMessage.fileId, syncMessage.stokes, syncMessage.channel, tile);
                }
            }
            syncState.pendingRequestTiles.clear();
            this.completeSynchronisedTiles({fileId: syncMessage.fileId, channel: syncMessage.channel, stokes: syncMessage.stokes, syncId});
        }
    }

    @action private handleStreamedTiles(tileMessage: CARTA.RasterTileData.$Properties) {
        const key = getTileRequestKey(tileMessage.fileId, tileMessage.stokes, tileMessage.channel);
        const syncState = this.rasterSyncStates.get(tileMessage.syncId ?? NaN);
        const animationId = this.isAnimationEnabled ? this.backendService.animationId : 0;
        if (syncState?.key !== key || syncState.isComplete || tileMessage.animationId !== animationId) {
            return;
        }
        if (tileMessage.compressionType !== CARTA.CompressionType.NONE && tileMessage.compressionType !== CARTA.CompressionType.ZFP) {
            console.error("Unsupported compression type");
            return;
        }
        if (this.isAnimationEnabled && tileMessage.fileId !== null && tileMessage.fileId !== undefined) {
            this.setCurrentChannel(tileMessage.fileId, tileMessage.channel, tileMessage.stokes);
        }

        for (const tile of tileMessage.tiles ?? []) {
            const encodedCoordinate = TileCoordinate.encode(tile.x ?? NaN, tile.y ?? NaN, tile.layer ?? NaN);
            const tileCacheKey = getTileCacheKey(tileMessage.fileId, tileMessage.stokes, tileMessage.channel, encodedCoordinate);
            if (syncState.pendingRequestTiles.delete(encodedCoordinate) || this.isAnimationEnabled) {
                if (tileMessage.compressionType === CARTA.CompressionType.NONE) {
                    const decompressedData = tile.imageData ? new Float32Array(tile.imageData.buffer.slice(tile.imageData.byteOffset, tile.imageData.byteOffset + tile.imageData.byteLength)) : new Float32Array();
                    this.updateStream({
                        fileId: tileMessage.fileId,
                        channel: tileMessage.channel,
                        stokes: tileMessage.stokes,
                        data: decompressedData,
                        width: tile.width,
                        height: tile.height,
                        encodedCoordinate,
                        syncId: tileMessage.syncId
                    });
                } else {
                    if (tileMessage.fileId !== null && tileMessage.fileId !== undefined) {
                        this.getCompressedCache(tileMessage.fileId).set(tileCacheKey, {tile, compressionQuality: tileMessage.compressionQuality});
                        this.asyncDecompressTile({
                            fileId: tileMessage.fileId,
                            channel: tileMessage.channel,
                            stokes: tileMessage.stokes,
                            tile,
                            precision: tileMessage.compressionQuality,
                            tileCoordinate: encodedCoordinate,
                            syncId: tileMessage.syncId
                        });
                    }
                }
            }
        }
    }

    private asyncDecompressTile({fileId, channel, stokes, tile, precision, tileCoordinate, syncId}: CompressedTileRequest) {
        const compressedArray = tile.imageData;
        const workerIndex = this.compressionRequestCounter % this.workers.length;
        const nanEncodings32 = new Int32Array((tile.nanEncodings ?? new Uint8Array()).slice(0).buffer);
        const compressedView = new Uint8Array(Math.max(compressedArray?.byteLength ?? NaN, (tile.width ?? NaN) * (tile.height ?? NaN) * 4));
        compressedView.set(compressedArray ?? new Uint8Array());

        const key = getTileRequestKey(fileId, stokes, channel);
        const pendingCompressionMap = this.pendingDecompressions.get(key)?.get(syncId ?? SINGLE_TILE_DECOMPRESSION_SYNC_ID);
        if (!pendingCompressionMap) {
            console.warn("Problem decompressing tile!");
            return;
        }

        const requestId = this.compressionRequestCounter++;
        pendingCompressionMap.set(tileCoordinate, requestId);

        const eventArgs: TileMessageArgs = {
            fileId,
            channel,
            stokes,
            width: tile.width,
            subsetHeight: tile.height,
            subsetLength: compressedArray?.byteLength ?? NaN,
            compression: precision,
            nanEncodings: nanEncodings32,
            tileCoordinate,
            layer: tile.layer,
            requestId,
            syncId
        };

        this.workers[workerIndex].postMessage(["decompress", compressedView.buffer, eventArgs], [compressedView.buffer, nanEncodings32.buffer]);
    }

    @action private updateStream({fileId, channel, stokes, data, width, height, encodedCoordinate, syncId, requestId}: DecompressedTileResult) {
        const key = getTileRequestKey(fileId, stokes, channel);
        const pendingCompressionMap = this.pendingDecompressions.get(key)?.get(syncId ?? SINGLE_TILE_DECOMPRESSION_SYNC_ID);
        if (!pendingCompressionMap || (requestId !== undefined && pendingCompressionMap.get(encodedCoordinate) !== requestId)) {
            return;
        }

        const syncState = this.rasterSyncStates.get(syncId ?? NaN);
        pendingCompressionMap.delete(encodedCoordinate);
        if (syncId != null && syncState?.shouldSynchronize) {
            const nextTile: RasterTile = {
                width,
                height,
                textureCoordinate: -1,
                data
            };

            syncState.receivedTiles.set(encodedCoordinate, nextTile);
            this.completeSynchronisedTiles({fileId, channel, stokes, syncId});
        } else {
            // Handle single tile, no sync required
            const rasterTile: RasterTile = {
                width,
                height,
                textureCoordinate: 0,
                data
            };
            const tileCacheKey = getTileCacheKey(fileId, stokes, channel, encodedCoordinate);
            const oldValue = this.cachedTiles.setpop(tileCacheKey, rasterTile);
            if (oldValue) {
                this.clearTile(oldValue.value, oldValue.key);
            }
            rasterTile.textureCoordinate = this.textureCoordinateQueue.pop();

            if (syncId !== SINGLE_TILE_DECOMPRESSION_SYNC_ID) {
                this.removePendingTiles(key, [encodedCoordinate]);
            } else if (!pendingCompressionMap.size) {
                this.clearRasterSync(key, SINGLE_TILE_DECOMPRESSION_SYNC_ID);
            }
            this.resolveChannelMapTile(fileId, stokes, channel, encodedCoordinate);
            this.resolveNormalViewTile(fileId, stokes, channel, encodedCoordinate);
            this.tileStream.next({tileCount: 1, fileId, channel, stokes, flush: false});
            if (syncState && syncId != null) {
                this.completeSynchronisedTiles({fileId, channel, stokes, syncId});
            }
        }
    }

    private completeSynchronisedTiles({fileId, channel, stokes, syncId}: RasterSyncLocation) {
        const key = getTileRequestKey(fileId, stokes, channel);
        const syncState = this.rasterSyncStates.get(syncId);
        if (!syncState?.isComplete || syncState.pendingDecompressions.size > 0) {
            return;
        }

        this.clearRasterSync(key, syncId);
        if (!syncState.shouldSynchronize) {
            if (!this.getNormalViewRemainingTiles(fileId ?? NaN)) {
                this.tileStream.next({tileCount: 0, fileId, channel, stokes, flush: false});
            }
            return;
        }

        const tileCount = syncState.receivedTiles.size;
        syncState.receivedTiles.forEach((tile, coordinate) => {
            this.removePendingTiles(key, [coordinate]);
            const tileCacheKey = getTileCacheKey(fileId, stokes, channel, coordinate);
            const oldValue = this.cachedTiles.setpop(tileCacheKey, tile);
            if (oldValue) {
                this.clearTile(oldValue.value, oldValue.key);
            }
            // This needs to be after clearTile to avoid empty textureCoordinateQueue
            tile.textureCoordinate = this.textureCoordinateQueue.pop();
            this.resolveChannelMapTile(fileId, stokes, channel, coordinate);
            this.resolveNormalViewTile(fileId, stokes, channel, coordinate);
        });
        const currentFileState = this.fileStateMap.get(fileId ?? NaN);
        const appStore = AppStore.Instance;
        const isCurrentView = appStore.channelMapStore.isChannelMapEnabled
            ? appStore.channelMapStore.channelArray.includes(channel ?? NaN) && currentFileState?.stokes === stokes
            : currentFileState?.channel === channel && currentFileState?.stokes === stokes;
        const isLatestView = syncState.viewGeneration === this.rasterViewGenerations.get(key) && isCurrentView;
        this.tileStream.next({tileCount, fileId, channel, stokes, flush: isLatestView});
    }

    private clearRasterSync(key: string, syncId: number) {
        const syncMaps = this.pendingDecompressions.get(key);
        syncMaps?.delete(syncId);
        if (!syncMaps?.size) {
            this.pendingDecompressions.delete(key);
        }
        this.rasterSyncStates.delete(syncId);
    }
}
