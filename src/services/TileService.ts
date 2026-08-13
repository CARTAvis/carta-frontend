import {CARTA} from "carta-protobuf";
import {LRUCache} from "mnemonist";
import {action, computed, makeObservable, observable} from "mobx";
import {Subject} from "rxjs";

import {AppToaster, SuccessToast} from "components/Shared";
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
const CHANNEL_MAP_PROGRESS_INTERVAL = 5_000; // ms
const CHANNEL_MAP_PROGRESS_LASTING_TIME = 5_000; // ms

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
    generation: number;
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
    generation: number;
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
    batchTiming?: {
        timeoutMs: number;
        deadlineMs: number;
        timeoutAlert?: Promise<boolean>;
    };
}

interface ActiveChannelMapRequest extends ChannelMapRequest {
    requestId: number;
}

interface RasterSyncState {
    key: string;
    isComplete: boolean;
    expectedTileCount: number;
    generation: number;
    pendingRequestTiles: Set<number>;
}

interface ChannelMapFileState {
    queue: ChannelMapRequest[];
    activeRequest?: ActiveChannelMapRequest;
    timeout?: ReturnType<typeof setTimeout>;
    progressInterval?: ReturnType<typeof setInterval>;
    desiredStokes?: number;
    confirmedStokes?: number;
    generation: number;
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
    private readonly pendingDecompressions: Map<string, Map<number, Map<number, boolean>>>;
    private readonly fileStateMap: Map<number, {channel: number | null | undefined; stokes: number | null | undefined}>;
    readonly tileStream: Subject<TileStreamDetails>;
    private cachedTiles: LRUCache<string, RasterTile>;
    private lruCapacitySystem: number;
    private textureArray: Array<WebGLTexture | null>;
    private textureCoordinateQueue: Array<number | undefined>;
    private readonly workers: Worker[];
    private compressionRequestCounter: number;
    private pendingSynchronisedTiles: Map<string, Set<number>>;
    private receivedSynchronisedTiles: Map<string, Map<number, Map<number, RasterTile>>>;
    private isAnimationEnabled: boolean;
    private readonly gl: WebGL2RenderingContext | null;
    private readonly rasterSyncStates: Map<number, RasterSyncState>;
    private readonly channelMapStates: Map<number, ChannelMapFileState>;

    @observable remainingTiles: number = 0;
    @observable workersReady: boolean[] | undefined;

    @computed get isZfpReady() {
        return this.workersReady && this.workersReady.every(isReady => isReady);
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

    public setAnimationEnabled = (isEnabled: boolean) => {
        this.isAnimationEnabled = isEnabled;
    };

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

        this.fileStateMap = new Map<number, {channel: number; stokes: number}>();
        this.pendingRequests = new Map<string, Map<number, boolean>>();
        this.cacheMapCompressedTiles = new Map<number, LRUCache<string, CompressedTile>>();
        this.pendingDecompressions = new Map<string, Map<number, Map<number, boolean>>>();
        this.receivedSynchronisedTiles = new Map<string, Map<number, Map<number, RasterTile>>>();
        this.pendingSynchronisedTiles = new Map<string, Set<number>>();
        this.rasterSyncStates = new Map<number, RasterSyncState>();
        this.channelMapStates = new Map<number, ChannelMapFileState>();

        this.compressionRequestCounter = 0;
        this.isAnimationEnabled = false;

        this.tileStream = new Subject<TileStreamDetails>();
        this.backendService.rasterTileStream.subscribe(this.handleStreamedTiles);
        this.backendService.rasterSyncStream.subscribe(message => this.handleStreamSync(message));
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
                        generation: eventArgs.generation
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
            state = {queue: [], generation: 0};
            this.channelMapStates.set(fileId, state);
        }
        return state;
    }

    private getChannelMapGeneration(fileId: number | null | undefined) {
        return this.channelMapStates.get(fileId ?? NaN)?.generation ?? 0;
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

    private getRequiredRequestTiles(tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, shouldTrackPending: boolean = true) {
        const newRequests = new Array<TileCoordinate>();
        const key = getTileRequestKey(fileId, stokes, channel);
        for (const tile of tiles) {
            if (tile.layer < 0) {
                continue;
            }
            const encodedCoordinate = tile.encode();
            const tileCacheKey = getTileCacheKey(fileId, stokes, channel, encodedCoordinate);
            const compressedTile = this.getCompressedCache(fileId).get(tileCacheKey);
            const pendingCompressionMap = this.pendingDecompressions.get(key);
            const isTileQueuedForDecompression = pendingCompressionMap && Array.from(pendingCompressionMap.values()).some(map => map.has(encodedCoordinate));
            const isTileCached = this.cachedTiles?.has(tileCacheKey);
            if (this.pendingRequests.has(key) && this.pendingRequests.get(key)?.has(encodedCoordinate)) {
                continue;
            }

            if (!isTileCached && compressedTile && !isTileQueuedForDecompression) {
                if (!pendingCompressionMap) {
                    this.pendingDecompressions.set(key, new Map<number, Map<number, boolean>>().set(SINGLE_TILE_DECOMPRESSION_SYNC_ID, new Map<number, boolean>()));
                } else if (!pendingCompressionMap.has(SINGLE_TILE_DECOMPRESSION_SYNC_ID)) {
                    pendingCompressionMap.set(SINGLE_TILE_DECOMPRESSION_SYNC_ID, new Map<number, boolean>());
                }
                // Load from L2 cache instead
                this.asyncDecompressTile({fileId, channel, stokes, tile: compressedTile.tile, precision: compressedTile.compressionQuality, tileCoordinate: encodedCoordinate, syncId: SINGLE_TILE_DECOMPRESSION_SYNC_ID});
            } else if (!isTileCached && !compressedTile) {
                newRequests.push(tile);
            }
        }

        if (shouldTrackPending) {
            this.trackPendingRequests(
                fileId,
                channel,
                stokes,
                newRequests.map(tile => tile.encode())
            );
        }

        return newRequests;
    }

    private trackPendingRequests(fileId: number, channel: number, stokes: number, tiles: number[]) {
        const key = getTileRequestKey(fileId, stokes, channel);
        if (!this.pendingRequests.has(key)) {
            this.pendingRequests.set(key, new Map<number, boolean>());
        }
        tiles.forEach(tile => {
            // A coordinate requested again belongs to the newer request. Do not let an
            // older sync retire it if that sync later reports a failed tile.
            this.pendingDecompressions.get(key)?.forEach((_pendingTiles, syncId) => this.rasterSyncStates.get(syncId)?.pendingRequestTiles.delete(tile));
            this.pendingRequests.get(key)?.set(tile, true);
        });
        this.updateRemainingTileCount();
    }

    requestTiles(tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, focusPoint: Point2D, compressionQuality: number, areChannelsChanged: boolean = false) {
        const key = getTileRequestKey(fileId, stokes, channel);

        if (areChannelsChanged || !this.fileStateMap.has(fileId)) {
            this.pendingSynchronisedTiles.set(key, new Set(tiles.map(tile => tile.encode())));
            this.receivedSynchronisedTiles.delete(key);
            this.clearRequestQueue(fileId);
            this.setCurrentChannel(fileId, channel, stokes);
        }

        const newRequests = this.getRequiredRequestTiles(tiles, fileId, channel, stokes);

        if (newRequests.length) {
            // sort by distance to midpoint and encode
            const sortedRequests = newRequests
                .sort((a, b) => {
                    const aX = focusPoint.x - a.x;
                    const aY = focusPoint.y - a.y;
                    const bX = focusPoint.x - b.x;
                    const bY = focusPoint.y - b.y;
                    return aX * aX + aY * aY - (bX * bX + bY * bY);
                })
                .map(tile => tile.encode());
            if (areChannelsChanged) {
                this.backendService.setChannels(fileId, channel, stokes, {fileId, compressionQuality, compressionType: CARTA.CompressionType.ZFP, tiles: sortedRequests});
            } else {
                this.backendService.addRequiredTiles(fileId, sortedRequests, compressionQuality);
            }
        } else {
            if (areChannelsChanged) {
                this.backendService.setChannels(fileId, channel, stokes, {fileId, compressionQuality, compressionType: CARTA.CompressionType.ZFP, tiles: []});
            }
            this.tileStream.next({tileCount: 0, fileId, channel, stokes, flush: false});
        }
    }

    requestChannelMapTiles(tiles: TileCoordinate[], frame: FrameStore, focusPoint: Point2D, compressionQuality: number, fullChannelRange: {min: number; max: number}, isPolarizationChanged: boolean = false) {
        if (!frame) {
            return;
        }
        const fileId = frame.frameInfo.fileId;
        const stokes = frame.stokes;
        const currentTiles = tiles.map(tile => tile.encode());
        const previousStokes = this.fileStateMap.get(fileId)?.stokes;
        const channelMapState = this.getChannelMapState(fileId);
        if (channelMapState.confirmedStokes === undefined) {
            channelMapState.confirmedStokes = previousStokes ?? stokes;
        }
        channelMapState.desiredStokes = stokes;
        this.setCurrentChannel(fileId, frame.channel, stokes);

        if (isPolarizationChanged) {
            for (let i = fullChannelRange.min; i <= fullChannelRange.max; i++) {
                const key = getTileRequestKey(fileId, stokes, i);
                this.pendingSynchronisedTiles.set(key, new Set(tiles.map(tile => tile.encode())));
                this.receivedSynchronisedTiles.delete(key);
            }
            this.clearRequestQueue(fileId);
        }

        this.clearQueueForChannelMap(fileId, stokes, fullChannelRange, currentTiles);

        const requests: ChannelMapRequest[] = [];
        for (let channel = fullChannelRange.min; channel <= fullChannelRange.max; channel++) {
            const sortedTiles = this.getRequiredRequestTiles(tiles, fileId, channel, stokes, false)
                .sort((a, b) => {
                    const aX = focusPoint.x - a.x;
                    const aY = focusPoint.y - a.y;
                    const bX = focusPoint.x - b.x;
                    const bY = focusPoint.y - b.y;
                    return aX * aX + aY * aY - (bX * bX + bY * bY);
                })
                .map(tile => tile.encode());
            if (sortedTiles.length) {
                requests.push({fileId, channel, stokes, requiredTiles: {fileId, compressionQuality, compressionType: CARTA.CompressionType.ZFP, tiles: sortedTiles}});
            } else if (isPolarizationChanged) {
                const key = getTileRequestKey(fileId, stokes, channel);
                this.pendingSynchronisedTiles.delete(key);
                this.receivedSynchronisedTiles.delete(key);
            }
        }

        const activeRequest = channelMapState.activeRequest;
        const activeChannelRequest: ChannelMapRequest = {fileId, channel: frame.channel, stokes, requiredTiles: {}};
        const activeChannelIndex = requests.findIndex(request => request.channel === frame.channel);
        if (activeChannelIndex > 0) {
            requests.unshift(requests.splice(activeChannelIndex, 1)[0]);
        }

        const isStokesTransitionPending = activeRequest?.stokes === stokes && !activeRequest.requiredTiles.tiles?.length;
        const isStokesTransitionRequired = channelMapState.confirmedStokes !== channelMapState.desiredStokes && !isStokesTransitionPending;
        if (requests.length || isStokesTransitionRequired) {
            requests.unshift(activeChannelRequest);
        }

        const isActiveChannelRequestPending = activeRequest?.channel === frame.channel && activeRequest.stokes === stokes && !activeRequest.requiredTiles.tiles?.length;
        const hasDifferentActiveRequest = !!activeRequest && (activeRequest.channel !== frame.channel || activeRequest.stokes !== stokes);
        const shouldAppendActiveChannel = requests.some(request => request.channel !== frame.channel) || hasDifferentActiveRequest || (!requests.length && !isActiveChannelRequestPending);
        if (shouldAppendActiveChannel) {
            requests.push(activeChannelRequest);
        }
        this.queueChannelMapRequests(fileId, requests);
    }

    updateChannelMapActiveChannel(fileId: number, channel: number, stokes: number) {
        const previousStokes = this.fileStateMap.get(fileId)?.stokes;
        const channelMapState = this.getChannelMapState(fileId);
        if (channelMapState.confirmedStokes === undefined) {
            channelMapState.confirmedStokes = previousStokes ?? stokes;
        }
        channelMapState.desiredStokes = stokes;
        this.setCurrentChannel(fileId, channel, stokes);
        this.queueChannelMapRequests(fileId, [{fileId, channel, stokes, requiredTiles: {}}]);
    }

    private setCurrentChannel(fileId: number, channel: number | null | undefined, stokes: number | null | undefined) {
        this.fileStateMap.set(fileId, {channel, stokes});
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

        this.trackPendingRequests(request.fileId, request.channel, request.stokes, tiles);
        const requestId = this.backendService.setChannels(request.fileId, request.channel, request.stokes, request.requiredTiles, true);
        if (requestId !== null) {
            channelMapState.activeRequest = {...request, requestId};
            const remainingBatchTimeMs = Math.max((request.batchTiming?.deadlineMs ?? Date.now() + CHANNEL_MAP_REQUEST_TIMEOUT_PER_CHANNEL) - Date.now(), 0);
            if (!request.batchTiming?.timeoutAlert) {
                this.startChannelMapRequestTimeout(fileId, requestId, remainingBatchTimeMs);
            }
            this.startChannelMapRequestProgress(fileId, requestId);
        } else {
            const key = getTileRequestKey(request.fileId, request.stokes, request.channel);
            tiles.forEach(tile => this.pendingRequests.get(key)?.delete(tile));
            this.updateRemainingTileCount();
            channelMapState.queue = [];
            this.dismissChannelMapTimeoutAlert(request.batchTiming);
            this.clearChannelMapSynchronization(fileId);
        }
    }

    private handleChannelMapFlowControl(eventId: number, message: CARTA.ChannelMapFlowControl.$Properties) {
        const fileId = message.fileId;
        if (fileId === null || fileId === undefined) {
            return;
        }
        const channelMapState = this.getChannelMapState(fileId);
        const activeRequest = channelMapState.activeRequest;
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
            this.clearChannelMapSynchronization(fileId);
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

    private startChannelMapRequestProgress(fileId: number, requestId: number) {
        const channelMapState = this.getChannelMapState(fileId);
        const existingInterval = channelMapState.progressInterval;
        if (existingInterval !== undefined) {
            clearInterval(existingInterval);
            channelMapState.progressInterval = undefined;
        }
        const activeRequest = channelMapState.activeRequest;
        const totalTiles = activeRequest?.requiredTiles.tiles?.length ?? 0;
        if (!totalTiles) {
            return;
        }

        const interval = setInterval(() => {
            const currentRequest = channelMapState.activeRequest;
            if (!currentRequest || currentRequest.requestId !== requestId) {
                return;
            }
            const key = getTileRequestKey(fileId, currentRequest.stokes, currentRequest.channel);
            const remainingTiles = this.pendingRequests.get(key)?.size ?? totalTiles;
            const receivedTiles = totalTiles - remainingTiles;
            AppToaster.show(SuccessToast("download", `Loading channel ${currentRequest.channel}: received ${receivedTiles} / ${totalTiles} requested tiles.`, CHANNEL_MAP_PROGRESS_LASTING_TIME));
        }, CHANNEL_MAP_PROGRESS_INTERVAL);
        channelMapState.progressInterval = interval;
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
        this.clearChannelMapSynchronization(fileId);
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
        const progressInterval = channelMapState.progressInterval;
        if (progressInterval !== undefined) {
            clearInterval(progressInterval);
            channelMapState.progressInterval = undefined;
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
            this.clearChannelMapSynchronization(id);
            channelMapState.queue = [];
            channelMapState.activeRequest = undefined;
            channelMapState.desiredStokes = undefined;
            channelMapState.confirmedStokes = undefined;
        });
    }

    private clearChannelMapSynchronization(fileId: number) {
        this.getChannelMapState(fileId).generation++;
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
        [this.pendingSynchronisedTiles, this.receivedSynchronisedTiles].forEach(map => {
            map.forEach((_value, key) => {
                if (isTileKeyForFile(key, fileId)) {
                    map.delete(key);
                }
            });
        });
    }

    updateHiddenFileChannels(fileId: number, channel: number, stokes: number) {
        this.setCurrentChannel(fileId, channel, stokes);
        this.backendService.setChannels(fileId, channel, stokes, {});
    }

    resetForSessionResume() {
        this.channelMapStates.forEach(state => {
            if (state.timeout !== undefined) {
                clearTimeout(state.timeout);
            }
            if (state.progressInterval !== undefined) {
                clearInterval(state.progressInterval);
            }
            state.queue = [];
            state.activeRequest = undefined;
            state.timeout = undefined;
            state.progressInterval = undefined;
            state.desiredStokes = undefined;
            state.confirmedStokes = undefined;
            state.generation++;
        });
        this.pendingRequests.clear();
        this.pendingDecompressions.clear();
        this.pendingSynchronisedTiles.clear();
        this.receivedSynchronisedTiles.clear();
        this.rasterSyncStates.clear();
        this.fileStateMap.forEach((_channels, fileId) => {
            if (!this.channelMapStates.has(fileId)) {
                this.channelMapStates.set(fileId, {queue: [], generation: 1});
            }
        });
        this.updateRemainingTileCount();
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

    clearRequestQueue(fileId?: number) {
        if (fileId !== undefined) {
            // Clear all requests with the given file ID
            this.pendingRequests.forEach((value, key) => {
                if (isTileKeyForFile(key, fileId)) {
                    value.clear();
                }
            });
        } else {
            // Clear all requests
            this.pendingRequests.clear();
        }

        this.updateRemainingTileCount();
    }

    clearQueueForChannelMap(fileId: number, stokes: number, currentChannelRange: {min: number; max: number}, currentTiles: number[]) {
        const currentTileSet = new Set(currentTiles);
        this.pendingRequests.forEach((value, key) => {
            if (!key) {
                return;
            }
            const [keyFileId, keyStokes, channel] = key.split("_").map(Number);
            if (keyFileId !== fileId) {
                return;
            }
            if (keyStokes !== stokes || channel < currentChannelRange.min || channel > currentChannelRange.max) {
                this.pendingRequests.delete(key);
            } else {
                value.forEach((_isPending, tile) => {
                    if (!currentTileSet.has(tile)) {
                        value.delete(tile);
                    }
                });
            }
        });

        this.updateRemainingTileCount();
    }

    handleFileClosed(fileId: number) {
        this.cancelChannelMapRequests(fileId);
        this.clearCompressedCache(fileId);
        this.clearGPUCache(fileId);
        this.fileStateMap.delete(fileId);
        this.pendingRequests.forEach((_pendingTiles, key) => {
            if (isTileKeyForFile(key, fileId)) {
                this.pendingRequests.delete(key);
            }
        });
        this.channelMapStates.delete(fileId);
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

    @action updateRemainingTileCount = () => {
        let remainingTiles = 0;
        this.pendingRequests.forEach(value => (remainingTiles += value.size));
        this.remainingTiles = remainingTiles;
    };

    private clearTile = (tile: RasterTile, _key: any) => {
        if (tile.data) {
            delete tile.data;
        }
        this.textureCoordinateQueue.push(tile.textureCoordinate);
    };

    private handleStreamSync(syncMessage: CARTA.RasterTileSync.$Properties) {
        const key = getTileRequestKey(syncMessage.fileId, syncMessage.stokes, syncMessage.channel);
        if (this.isAnimationEnabled && syncMessage.animationId !== this.backendService.animationId) {
            return;
        } else if (!this.isAnimationEnabled && syncMessage.animationId !== 0) {
            return;
        }

        if (syncMessage.syncId === null || syncMessage.syncId === undefined) {
            return;
        }

        // At the start of the stream, create a new pending decompression map for the channel about to be streamed
        if (!syncMessage.endSync) {
            // This endSync message might arrive later than the streamed tiles? Oh, but it's ok, it just means that backend has finished sending but we can still wait for more.
            const requestedTileCount = syncMessage.tileCount ?? 0;
            const requestedTiles = Array.from(this.pendingRequests.get(key)?.keys() ?? []).slice(0, requestedTileCount);
            this.rasterSyncStates.set(syncMessage.syncId, {
                key,
                isComplete: false,
                expectedTileCount: requestedTileCount,
                generation: this.getChannelMapGeneration(syncMessage.fileId),
                pendingRequestTiles: new Set(requestedTiles)
            });
            if (this.pendingDecompressions.has(key)) {
                this.pendingDecompressions.get(key)?.set(syncMessage.syncId, new Map<number, boolean>());
            } else {
                this.pendingDecompressions.set(key, new Map<number, Map<number, boolean>>().set(syncMessage.syncId, new Map<number, boolean>()));
            }
        } else {
            const syncState = this.rasterSyncStates.get(syncMessage.syncId);
            if (!syncState) {
                return;
            }
            // mark the channel as complete
            if (syncMessage.tileCount !== null && syncMessage.tileCount !== undefined) {
                syncState.expectedTileCount = syncMessage.tileCount;
            }
            syncState.isComplete = true;
            syncState.pendingRequestTiles.forEach(tile => this.pendingRequests.get(key)?.delete(tile));
            syncState.pendingRequestTiles.clear();
            this.updateRemainingTileCount();
            this.completeSynchronisedTiles({fileId: syncMessage.fileId, channel: syncMessage.channel, stokes: syncMessage.stokes, syncId: syncMessage.syncId});
        }
    }

    private handleStreamedTiles = (tileMessage: CARTA.RasterTileData.$Properties) => {
        const key = getTileRequestKey(tileMessage.fileId, tileMessage.stokes, tileMessage.channel);

        if (tileMessage.compressionType !== CARTA.CompressionType.NONE && tileMessage.compressionType !== CARTA.CompressionType.ZFP) {
            console.error("Unsupported compression type");
        }

        const appStore = AppStore.Instance;
        const currentFileState = this.fileStateMap.get(tileMessage.fileId ?? NaN);
        // Cached Stokes may finish loading, but ignore stale channels within the currently selected Stokes.
        if (!appStore.channelMapStore.isChannelMapEnabled && !this.isAnimationEnabled && (!currentFileState || (currentFileState.stokes === tileMessage.stokes && currentFileState.channel !== tileMessage.channel))) {
            console.log(`Ignoring stale tile for channel=${tileMessage.channel} (Current channel=${currentFileState?.channel})`);
            return;
        }

        if (appStore.channelMapStore.isChannelMapEnabled && !appStore.channelMapStore.channelArray.includes(tileMessage?.channel ?? NaN)) {
            console.log(`Skipping stale tile during channel map for key=${key}`);
            return;
        }

        if (this.isAnimationEnabled && tileMessage.animationId !== this.backendService.animationId && !this.rasterSyncStates.has(tileMessage.syncId ?? NaN)) {
            console.log(`Skipping stale tile during animation Message animation_id: ${tileMessage.animationId}. Service animation_id: ${this.backendService.animationId}`);
            return;
        } else if (!this.isAnimationEnabled && tileMessage.animationId !== 0) {
            console.log(`Skipping stale animation tile outside of animation. Message animation_id: ${tileMessage.animationId}. Service animation_id: ${this.backendService.animationId}`);
            return;
        }

        const hasPendingCompressionMap = this.pendingDecompressions.get(key)?.has(tileMessage.syncId || 0);
        // When we stop animation playback, the code might have already deleted the compression map for the key, causing a missing compression map
        if (!hasPendingCompressionMap) {
            console.warn(`Missing compression map for key=${key}`);
            return;
        }
        if (this.isAnimationEnabled && tileMessage.fileId !== null && tileMessage.fileId !== undefined) {
            this.setCurrentChannel(tileMessage.fileId, tileMessage.channel, tileMessage.stokes);
        }

        for (const tile of tileMessage.tiles ?? []) {
            const encodedCoordinate = TileCoordinate.encode(tile.x ?? NaN, tile.y ?? NaN, tile.layer ?? NaN);
            const tileCacheKey = getTileCacheKey(tileMessage.fileId, tileMessage.stokes, tileMessage.channel, encodedCoordinate);
            // Remove from the requested tile map. If in animation mode, don't check if we're still requesting tiles
            const pendingRequestsMap = this.pendingRequests.get(key);

            if (pendingRequestsMap?.has(encodedCoordinate) || this.isAnimationEnabled) {
                if (pendingRequestsMap) {
                    pendingRequestsMap.delete(encodedCoordinate);
                }
                this.rasterSyncStates.get(tileMessage.syncId ?? 0)?.pendingRequestTiles.delete(encodedCoordinate);
                this.updateRemainingTileCount();

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
                        syncId: tileMessage.syncId,
                        generation: this.rasterSyncStates.get(tileMessage.syncId ?? NaN)?.generation ?? this.getChannelMapGeneration(tileMessage.fileId)
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
            } else {
                console.warn(`No pending request for tile (${tile.x}, ${tile.y}, ${tile.layer}) and key=${key}`);
            }
        }
    };

    private asyncDecompressTile({fileId, channel, stokes, tile, precision, tileCoordinate, syncId}: CompressedTileRequest) {
        const compressedArray = tile.imageData;
        const workerIndex = this.compressionRequestCounter % this.workers.length;
        const nanEncodings32 = new Int32Array((tile.nanEncodings ?? new Uint8Array()).slice(0).buffer);
        const compressedView = new Uint8Array(Math.max(compressedArray?.byteLength ?? NaN, (tile.width ?? NaN) * (tile.height ?? NaN) * 4));
        compressedView.set(compressedArray ?? new Uint8Array());

        const key = getTileRequestKey(fileId, stokes, channel);
        const pendingCompressionMap = this.pendingDecompressions.get(key);
        if (!pendingCompressionMap) {
            console.warn("Problem decompressing tile!");
            return;
        }

        if (syncId) {
            pendingCompressionMap.get(syncId as number)?.set(tileCoordinate, true);
        }

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
            requestId: this.compressionRequestCounter,
            syncId,
            generation: this.rasterSyncStates.get(syncId ?? NaN)?.generation ?? this.getChannelMapGeneration(fileId)
        };

        this.workers[workerIndex].postMessage(["decompress", compressedView.buffer, eventArgs], [compressedView.buffer, nanEncodings32.buffer]);
        this.compressionRequestCounter++;
    }

    private updateStream({fileId, channel, stokes, data, width, height, encodedCoordinate, syncId, generation}: DecompressedTileResult) {
        const key = getTileRequestKey(fileId, stokes, channel);
        if (generation !== this.getChannelMapGeneration(fileId)) {
            return;
        }
        const pendingCompressionMap = this.pendingDecompressions.get(key)?.get(syncId || SINGLE_TILE_DECOMPRESSION_SYNC_ID);
        if (!pendingCompressionMap) {
            console.warn(`Problem decompressing tile. Missing pending decompression map ${key}!`);
            return;
        }

        // If there are pending tiles to be synchronized, don't send tiles one-by-one
        const pendingTiles = this.pendingSynchronisedTiles.get(key);
        if (syncId && syncId > 0 && (this.isAnimationEnabled || pendingTiles?.size)) {
            const nextTile: RasterTile = {
                width,
                height,
                textureCoordinate: -1,
                data
            };

            let receivedTiles: Map<number, RasterTile> | undefined = this.receivedSynchronisedTiles.get(key)?.get(syncId);
            if (this.receivedSynchronisedTiles.has(key)) {
                if (!this.receivedSynchronisedTiles.get(key)?.has(syncId)) {
                    this.receivedSynchronisedTiles.get(key)?.set(syncId, new Map<number, RasterTile>());
                    receivedTiles = this.receivedSynchronisedTiles.get(key)?.get(syncId);
                }
            } else {
                this.receivedSynchronisedTiles.set(key, new Map<number, Map<number, RasterTile>>());
                this.receivedSynchronisedTiles.get(key)?.set(syncId, new Map<number, RasterTile>());
                receivedTiles = this.receivedSynchronisedTiles.get(key)?.get(syncId);
            }
            receivedTiles?.set(encodedCoordinate, nextTile);
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

            pendingCompressionMap.delete(encodedCoordinate);
            this.tileStream.next({tileCount: 1, fileId, channel, stokes, flush: false});
            if (syncId) {
                this.completeSynchronisedTiles({fileId, channel, stokes, syncId});
            }
        }
    }

    private completeSynchronisedTiles({fileId, channel, stokes, syncId}: RasterSyncLocation) {
        const key = getTileRequestKey(fileId, stokes, channel);
        if (!this.isAnimationEnabled && !this.pendingSynchronisedTiles.get(key)?.size) {
            if (this.rasterSyncStates.get(syncId)?.isComplete && this.pendingDecompressions.get(key)?.get(syncId)?.size === 0) {
                this.clearRasterSync(key, syncId);
            }
            return;
        }
        const receivedTiles = this.receivedSynchronisedTiles.get(key)?.get(syncId);
        const tileCount = receivedTiles?.size ?? 0;
        const syncState = this.rasterSyncStates.get(syncId);
        if (!syncState?.isComplete || syncState.expectedTileCount !== tileCount) {
            return;
        }

        this.clearRasterSync(key, syncId);
        receivedTiles?.forEach((tile, coordinate) => {
            const tileCacheKey = getTileCacheKey(fileId, stokes, channel, coordinate);
            const oldValue = this.cachedTiles.setpop(tileCacheKey, tile);
            if (oldValue) {
                this.clearTile(oldValue.value, oldValue.key);
            }
            // This needs to be after clearTile to avoid empty textureCoordinateQueue
            tile.textureCoordinate = this.textureCoordinateQueue.pop();
        });
        this.pendingSynchronisedTiles.delete(key);
        this.receivedSynchronisedTiles.delete(key);
        this.tileStream.next({tileCount, fileId, channel, stokes, flush: true});
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
