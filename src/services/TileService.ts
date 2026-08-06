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
    channel: number | null | undefined;
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
const SINGLE_TILE_DECOMPRESION_SYNC_ID = -1;

const MAX_TILE_WORKERS = 8;
const MIN_TILE_WORKERS = 1;
const MAX_TILE_WORKERS_PER_CORE = 0.75;
const CHANNEL_MAP_REQUEST_TIMEOUT = 10_000;

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

interface ChannelMapRequest {
    fileId: number;
    channel: number;
    stokes: number;
    requiredTiles: CARTA.AddRequiredTiles.$Properties;
}

interface ActiveChannelMapRequest extends ChannelMapRequest {
    requestId: number;
}

function getTileRequestKey(fileId: number | null | undefined, stokes: number | null | undefined, channel: number | null | undefined) {
    return `${fileId}_${stokes}_${channel}`;
}

function getTileCacheKey(fileId: number | null | undefined, channel: number | null | undefined, encodedCoordinate: number) {
    return `${fileId}_${channel}_${encodedCoordinate}`;
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
    private readonly channelMap: Map<number, {channel: number | null | undefined; stokes: number | null | undefined}>;
    private readonly completedChannels: Map<string, boolean>;
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
    private syncIdMap: Map<number, boolean>;
    private syncIdTileCountMap: Map<number, number>;
    private readonly channelMapRequestQueues: Map<number, ChannelMapRequest[]>;
    private readonly activeChannelMapRequests: Map<number, ActiveChannelMapRequest>;
    private readonly channelMapRequestTimeouts: Map<number, ReturnType<typeof setTimeout>>;
    private readonly channelMapGenerations: Map<number, number>;
    private readonly syncIdGenerationMap: Map<number, number>;
    // Invariant: tile-bearing requests wait until an empty-tile request makes the backend-confirmed Stokes match the desired Stokes.
    private readonly desiredChannelMapStokes: Map<number, number>;
    private readonly confirmedChannelMapStokes: Map<number, number>;

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

        this.channelMap = new Map<number, {channel: number; stokes: number}>();
        this.pendingRequests = new Map<string, Map<number, boolean>>();
        this.cacheMapCompressedTiles = new Map<number, LRUCache<string, CompressedTile>>();
        this.pendingDecompressions = new Map<string, Map<number, Map<number, boolean>>>();
        this.completedChannels = new Map<string, boolean>();
        this.receivedSynchronisedTiles = new Map<string, Map<number, Map<number, RasterTile>>>();
        this.pendingSynchronisedTiles = new Map<string, Set<number>>();
        this.syncIdMap = new Map<number, boolean>();
        this.syncIdTileCountMap = new Map<number, number>();
        this.channelMapRequestQueues = new Map<number, ChannelMapRequest[]>();
        this.activeChannelMapRequests = new Map<number, ActiveChannelMapRequest>();
        this.channelMapRequestTimeouts = new Map<number, ReturnType<typeof setTimeout>>();
        this.channelMapGenerations = new Map<number, number>();
        this.syncIdGenerationMap = new Map<number, number>();
        this.desiredChannelMapStokes = new Map<number, number>();
        this.confirmedChannelMapStokes = new Map<number, number>();

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
                    this.updateStream(eventArgs.fileId, eventArgs.channel, eventArgs.stokes, resultArray, eventArgs.width, eventArgs.subsetHeight, eventArgs.layer, eventArgs.tileCoordinate, eventArgs.syncId, eventArgs.generation);
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

    getTile(tileCoordinateEncoded: number, fileId: number, channel: number, shouldPeek: boolean = false) {
        const tileCacheKey = getTileCacheKey(fileId, channel, tileCoordinateEncoded);
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
            const tileCacheKey = getTileCacheKey(fileId, channel, encodedCoordinate);
            const compressedTile = this.getCompressedCache(fileId).get(tileCacheKey);
            const pendingCompressionMap = this.pendingDecompressions.get(key);
            const isTileQueuedForDecompression = pendingCompressionMap && Array.from(pendingCompressionMap.values()).some(map => map.has(encodedCoordinate));
            const isTileCached = this.cachedTiles?.has(tileCacheKey);
            if (this.pendingRequests.has(key) && this.pendingRequests.get(key)?.has(encodedCoordinate)) {
                continue;
            }

            if (!isTileCached && compressedTile && !isTileQueuedForDecompression) {
                if (!pendingCompressionMap) {
                    this.pendingDecompressions.set(key, new Map<number, Map<number, boolean>>().set(SINGLE_TILE_DECOMPRESION_SYNC_ID, new Map<number, boolean>()));
                } else if (!pendingCompressionMap.has(SINGLE_TILE_DECOMPRESION_SYNC_ID)) {
                    pendingCompressionMap.set(SINGLE_TILE_DECOMPRESION_SYNC_ID, new Map<number, boolean>());
                }
                // Load from L2 cache instead
                this.asyncDecompressTile(fileId, channel, stokes, compressedTile.tile, compressedTile.compressionQuality, encodedCoordinate, SINGLE_TILE_DECOMPRESION_SYNC_ID);
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
        tiles.forEach(tile => this.pendingRequests.get(key)?.set(tile, true));
        this.updateRemainingTileCount();
    }

    requestTiles(tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, focusPoint: Point2D, compressionQuality: number, areChannelsChanged: boolean = false) {
        const key = getTileRequestKey(fileId, stokes, channel);

        if (areChannelsChanged || !this.channelMap.has(fileId)) {
            this.pendingSynchronisedTiles.set(key, new Set(tiles.map(tile => tile.encode())));
            this.receivedSynchronisedTiles.delete(key);
            this.clearRequestQueue(fileId);
            this.setCurrentChannel(fileId, channel, stokes);
            this.clearCompressedCache(fileId);
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
            this.completedChannels.set(key, true);
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
        const previousStokes = this.channelMap.get(fileId)?.stokes;
        if (!this.confirmedChannelMapStokes.has(fileId)) {
            this.confirmedChannelMapStokes.set(fileId, previousStokes ?? stokes);
        }
        this.desiredChannelMapStokes.set(fileId, stokes);

        // During a page change, frame.channel can still refer to the previous
        // page while requiredChannel already points at the new selection. Use
        // the selected channel in the requested page (or its first channel) so
        // its empty synchronization request arrives before its tiles.
        const activeChannel =
            fullChannelRange.min <= frame.channel && frame.channel <= fullChannelRange.max
                ? frame.channel
                : fullChannelRange.min <= frame.requiredChannel && frame.requiredChannel <= fullChannelRange.max
                  ? frame.requiredChannel
                  : fullChannelRange.min;
        this.setCurrentChannel(fileId, activeChannel, stokes);

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
            }
        }

        const activeRequest = this.activeChannelMapRequests.get(fileId);
        const activeChannelRequest: ChannelMapRequest = {fileId, channel: activeChannel, stokes, requiredTiles: {}};
        const activeChannelIndex = requests.findIndex(request => request.channel === activeChannel);
        if (activeChannelIndex > 0) {
            requests.unshift(requests.splice(activeChannelIndex, 1)[0]);
        }

        const isActiveRequestStokesTransition = activeRequest?.stokes === stokes && !activeRequest.requiredTiles.tiles?.length;
        if (this.confirmedChannelMapStokes.get(fileId) !== this.desiredChannelMapStokes.get(fileId) && !isActiveRequestStokesTransition) {
            requests.unshift(activeChannelRequest);
        } else if (requests.length) {
            requests.unshift(activeChannelRequest);
        }
        if (requests.some(request => request.channel !== activeChannel) || (activeRequest && (activeRequest.channel !== activeChannel || activeRequest.stokes !== stokes))) {
            requests.push(activeChannelRequest);
        }
        this.queueChannelMapRequests(fileId, requests);
    }

    updateChannelMapActiveChannel(fileId: number, channel: number, stokes: number) {
        const previousStokes = this.channelMap.get(fileId)?.stokes;
        if (!this.confirmedChannelMapStokes.has(fileId)) {
            this.confirmedChannelMapStokes.set(fileId, previousStokes ?? stokes);
        }
        this.desiredChannelMapStokes.set(fileId, stokes);
        this.setCurrentChannel(fileId, channel, stokes);
        this.queueChannelMapRequests(fileId, [{fileId, channel, stokes, requiredTiles: {}}]);
    }

    private setCurrentChannel(fileId: number, channel: number | null | undefined, stokes: number | null | undefined) {
        const currentChannel = this.channelMap.get(fileId);
        if (currentChannel && currentChannel.stokes !== stokes) {
            this.clearCompressedCache(fileId);
            this.clearGPUCache(fileId);
        }
        this.channelMap.set(fileId, {channel, stokes});
    }

    private queueChannelMapRequests(fileId: number, requests: ChannelMapRequest[]) {
        this.channelMapRequestQueues.set(fileId, requests);
        if (!this.activeChannelMapRequests.has(fileId)) {
            this.sendNextChannelMapRequest(fileId);
        }
    }

    private sendNextChannelMapRequest(fileId: number) {
        let request = this.channelMapRequestQueues.get(fileId)?.shift();
        if (!request) {
            this.channelMapRequestQueues.delete(fileId);
            return;
        }

        let tiles = request.requiredTiles.tiles ?? [];
        const desiredStokes = this.desiredChannelMapStokes.get(fileId);
        if (tiles.length && desiredStokes !== undefined && this.confirmedChannelMapStokes.get(fileId) !== desiredStokes) {
            this.channelMapRequestQueues.get(fileId)?.unshift(request);
            request = {
                fileId,
                channel: this.channelMap.get(fileId)?.channel ?? request.channel,
                stokes: desiredStokes,
                requiredTiles: {}
            };
            tiles = [];
        }

        this.trackPendingRequests(request.fileId, request.channel, request.stokes, tiles);
        const requestId = this.backendService.setChannels(request.fileId, request.channel, request.stokes, request.requiredTiles, true);
        if (requestId !== null) {
            this.activeChannelMapRequests.set(fileId, {...request, requestId});
            this.startChannelMapRequestTimeout(fileId, requestId);
        } else {
            const key = getTileRequestKey(request.fileId, request.stokes, request.channel);
            tiles.forEach(tile => this.pendingRequests.get(key)?.delete(tile));
            this.updateRemainingTileCount();
            this.channelMapRequestQueues.delete(fileId);
        }
    }

    private handleChannelMapFlowControl(eventId: number, message: CARTA.ChannelMapFlowControl.$Properties) {
        const fileId = message.fileId;
        if (fileId === null || fileId === undefined) {
            return;
        }
        const activeRequest = this.activeChannelMapRequests.get(fileId);
        if (!activeRequest || activeRequest.requestId !== eventId) {
            return;
        }
        if (activeRequest.channel !== message.completedChannel) {
            console.warn(`Channel Map completion mismatch for request ${eventId}: expected channel ${activeRequest.channel}, received ${message.completedChannel}`);
            return;
        }

        this.clearChannelMapRequestTimeout(fileId);
        this.activeChannelMapRequests.delete(fileId);
        if (message.status !== CARTA.ChannelMapFlowControl.Status.COMPLETED) {
            this.clearRequestQueue(fileId);
            this.channelMapRequestQueues.delete(fileId);
            return;
        }

        if (!activeRequest.requiredTiles.tiles?.length) {
            this.confirmedChannelMapStokes.set(fileId, activeRequest.stokes);
        }
        this.sendNextChannelMapRequest(fileId);
    }

    private startChannelMapRequestTimeout(fileId: number, requestId: number) {
        this.clearChannelMapRequestTimeout(fileId);
        const timeout = setTimeout(() => {
            const activeRequest = this.activeChannelMapRequests.get(fileId);
            if (!activeRequest || activeRequest.requestId !== requestId) {
                return;
            }
            console.warn(`Channel Map request ${requestId} timed out for file ${fileId}`);
            this.activeChannelMapRequests.delete(fileId);
            this.channelMapRequestTimeouts.delete(fileId);
            this.clearRequestQueue(fileId);
            this.channelMapRequestQueues.delete(fileId);
        }, CHANNEL_MAP_REQUEST_TIMEOUT);
        this.channelMapRequestTimeouts.set(fileId, timeout);
    }

    private clearChannelMapRequestTimeout(fileId: number) {
        const timeout = this.channelMapRequestTimeouts.get(fileId);
        if (timeout !== undefined) {
            clearTimeout(timeout);
            this.channelMapRequestTimeouts.delete(fileId);
        }
    }

    cancelChannelMapRequests(fileId?: number) {
        const fileIds = fileId === undefined ? new Set([...this.channelMapRequestQueues.keys(), ...this.activeChannelMapRequests.keys(), ...this.desiredChannelMapStokes.keys(), ...this.confirmedChannelMapStokes.keys()]) : [fileId];
        fileIds.forEach(id => {
            this.clearChannelMapRequestTimeout(id);
            this.clearRequestQueue(id);
            this.clearChannelMapSynchronisation(id);
        });
        if (fileId === undefined) {
            this.channelMapRequestQueues.clear();
            this.activeChannelMapRequests.clear();
            this.channelMapRequestTimeouts.clear();
            this.desiredChannelMapStokes.clear();
            this.confirmedChannelMapStokes.clear();
        } else {
            this.channelMapRequestQueues.delete(fileId);
            this.activeChannelMapRequests.delete(fileId);
            this.channelMapRequestTimeouts.delete(fileId);
            this.desiredChannelMapStokes.delete(fileId);
            this.confirmedChannelMapStokes.delete(fileId);
        }
    }

    private clearChannelMapSynchronisation(fileId: number) {
        this.channelMapGenerations.set(fileId, (this.channelMapGenerations.get(fileId) ?? 0) + 1);
        this.pendingDecompressions.forEach((syncMaps, key) => {
            if (isTileKeyForFile(key, fileId)) {
                syncMaps.forEach((_pendingTiles, syncId) => {
                    this.syncIdMap.delete(syncId);
                    this.syncIdTileCountMap.delete(syncId);
                    this.syncIdGenerationMap.delete(syncId);
                });
                this.pendingDecompressions.delete(key);
            }
        });
        [this.completedChannels, this.pendingSynchronisedTiles, this.receivedSynchronisedTiles].forEach(map => {
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
        this.channelMapRequestTimeouts.forEach(timeout => clearTimeout(timeout));
        this.channelMapRequestQueues.clear();
        this.activeChannelMapRequests.clear();
        this.channelMapRequestTimeouts.clear();
        this.desiredChannelMapStokes.clear();
        this.confirmedChannelMapStokes.clear();
        this.pendingRequests.clear();
        this.pendingDecompressions.clear();
        this.pendingSynchronisedTiles.clear();
        this.receivedSynchronisedTiles.clear();
        this.completedChannels.clear();
        this.syncIdMap.clear();
        this.syncIdTileCountMap.clear();
        this.syncIdGenerationMap.clear();
        this.channelMap.forEach((_channels, fileId) => {
            this.channelMapGenerations.set(fileId, (this.channelMapGenerations.get(fileId) ?? 0) + 1);
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
        this.channelMap.delete(fileId);
        // remove all entries from the map with fileId in the key
        this.completedChannels.forEach((isCompleted, key) => {
            if (isTileKeyForFile(key, fileId)) {
                this.completedChannels.delete(key);
            }
        });

        this.pendingDecompressions.forEach((value, key) => {
            if (isTileKeyForFile(key, fileId)) {
                this.pendingDecompressions.delete(key);
            }
        });
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
            this.completedChannels.delete(key);
            if (syncMessage.tileCount !== null && syncMessage.tileCount !== undefined) {
                this.syncIdTileCountMap.set(syncMessage.syncId, syncMessage.tileCount);
            }
            this.syncIdMap.set(syncMessage.syncId, false);
            this.syncIdGenerationMap.set(syncMessage.syncId, this.channelMapGenerations.get(syncMessage.fileId ?? NaN) ?? 0);
            if (this.pendingDecompressions.has(key)) {
                this.pendingDecompressions.get(key)?.set(syncMessage.syncId, new Map<number, boolean>());
            } else {
                this.pendingDecompressions.set(key, new Map<number, Map<number, boolean>>().set(syncMessage.syncId, new Map<number, boolean>()));
            }
        } else {
            if (!this.syncIdGenerationMap.has(syncMessage.syncId)) {
                return;
            }
            // mark the channel as complete
            if (syncMessage.tileCount !== null && syncMessage.tileCount !== undefined) {
                this.syncIdTileCountMap.set(syncMessage.syncId, syncMessage.tileCount);
            }
            this.completedChannels.set(key, true);
            this.syncIdMap.set(syncMessage.syncId, true);
            this.pendingRequests.get(key)?.clear();
            this.updateRemainingTileCount();
            this.completeSynchronisedTiles(key, syncMessage.fileId, syncMessage.channel, syncMessage.stokes, syncMessage.syncId);
        }
    }

    private handleStreamedTiles = (tileMessage: CARTA.RasterTileData.$Properties) => {
        const key = getTileRequestKey(tileMessage.fileId, tileMessage.stokes, tileMessage.channel);

        if (tileMessage.compressionType !== CARTA.CompressionType.NONE && tileMessage.compressionType !== CARTA.CompressionType.ZFP) {
            console.error("Unsupported compression type");
        }

        const appStore = AppStore.Instance;
        const currentChannels = this.channelMap.get(tileMessage.fileId ?? NaN);
        // Ignore stale tiles that don't match the currently required tiles. During animation, ignore changes to channel
        if (!appStore.channelMapStore.isChannelMapEnabled && !this.isAnimationEnabled && (!currentChannels || currentChannels.channel !== tileMessage.channel || currentChannels.stokes !== tileMessage.stokes)) {
            console.log(`Ignoring stale tile for channel=${tileMessage.channel} (Current channel=${currentChannels ? currentChannels.channel : undefined})`);
            return;
        }

        if (appStore.channelMapStore.isChannelMapEnabled && (!appStore.channelMapStore.channelArray.includes(tileMessage?.channel ?? NaN) || currentChannels?.stokes !== tileMessage.stokes)) {
            console.log(`Skipping stale tile during channel map for key=${key}`);
            return;
        }

        if (this.isAnimationEnabled && tileMessage.animationId !== this.backendService.animationId && !this.syncIdMap.has(tileMessage.syncId ?? NaN)) {
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
            const tileCacheKey = getTileCacheKey(tileMessage.fileId, tileMessage.channel, encodedCoordinate);
            // Remove from the requested tile map. If in animation mode, don't check if we're still requesting tiles
            const pendingRequestsMap = this.pendingRequests.get(key);

            if (pendingRequestsMap?.has(encodedCoordinate) || this.isAnimationEnabled) {
                if (pendingRequestsMap) {
                    pendingRequestsMap.delete(encodedCoordinate);
                }
                this.updateRemainingTileCount();

                if (tileMessage.compressionType === CARTA.CompressionType.NONE) {
                    const decompressedData = tile.imageData ? new Float32Array(tile.imageData.buffer.slice(tile.imageData.byteOffset, tile.imageData.byteOffset + tile.imageData.byteLength)) : new Float32Array();
                    this.updateStream(
                        tileMessage.fileId,
                        tileMessage.channel,
                        tileMessage.stokes,
                        decompressedData,
                        tile.width,
                        tile.height,
                        tile.layer,
                        encodedCoordinate,
                        tileMessage.syncId,
                        this.syncIdGenerationMap.get(tileMessage.syncId ?? NaN) ?? this.channelMapGenerations.get(tileMessage.fileId ?? NaN) ?? 0
                    );
                } else {
                    if (tileMessage.fileId !== null && tileMessage.fileId !== undefined) {
                        this.getCompressedCache(tileMessage.fileId).set(tileCacheKey, {tile, channel: tileMessage.channel ?? NaN, compressionQuality: tileMessage.compressionQuality});
                        this.asyncDecompressTile(tileMessage.fileId, tileMessage.channel, tileMessage.stokes, tile, tileMessage.compressionQuality, encodedCoordinate, tileMessage.syncId);
                    }
                }
            } else {
                console.warn(`No pending request for tile (${tile.x}, ${tile.y}, ${tile.layer}) and key=${key}`);
            }
        }
    };

    private asyncDecompressTile(
        fileId: number,
        channel: number | null | undefined,
        stokes: number | null | undefined,
        tile: CARTA.TileData.$Properties,
        precision: number | null | undefined,
        tileCoordinate: number,
        syncId?: number | null | undefined
    ) {
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
            generation: this.syncIdGenerationMap.get(syncId ?? NaN) ?? this.channelMapGenerations.get(fileId) ?? 0
        };

        this.workers[workerIndex].postMessage(["decompress", compressedView.buffer, eventArgs], [compressedView.buffer, nanEncodings32.buffer]);
        this.compressionRequestCounter++;
    }

    private updateStream(
        fileId: number | null | undefined,
        channel: number | null | undefined,
        stokes: number | null | undefined,
        decompressedData: Float32Array,
        width: number | null | undefined,
        height: number | null | undefined,
        _layer: number | null | undefined,
        encodedCoordinate: number,
        syncId: number | null | undefined,
        generation: number
    ) {
        const key = getTileRequestKey(fileId, stokes, channel);
        if (generation !== (this.channelMapGenerations.get(fileId ?? NaN) ?? 0)) {
            return;
        }
        const currentChannels = this.channelMap.get(fileId ?? NaN);
        const isStaleStokesTile = currentChannels?.stokes !== stokes;
        if (isStaleStokesTile) {
            const staleSyncId = syncId || SINGLE_TILE_DECOMPRESION_SYNC_ID;
            this.pendingDecompressions.get(key)?.delete(staleSyncId);
            this.pendingSynchronisedTiles.delete(key);
            this.receivedSynchronisedTiles.delete(key);
            if (syncId) {
                this.syncIdMap.delete(syncId);
                this.syncIdTileCountMap.delete(syncId);
            }
            return;
        }
        const pendingCompressionMap = this.pendingDecompressions.get(key)?.get(syncId || SINGLE_TILE_DECOMPRESION_SYNC_ID);
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
                data: decompressedData
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
            this.completeSynchronisedTiles(key, fileId, channel, stokes, syncId);
        } else {
            // Handle single tile, no sync required
            const rasterTile: RasterTile = {
                width,
                height,
                textureCoordinate: 0,
                data: decompressedData
            };
            const tileCacheKey = getTileCacheKey(fileId, channel, encodedCoordinate);
            const oldValue = this.cachedTiles.setpop(tileCacheKey, rasterTile);
            if (oldValue) {
                this.clearTile(oldValue.value, oldValue.key);
            }
            rasterTile.textureCoordinate = this.textureCoordinateQueue.pop();

            pendingCompressionMap.delete(encodedCoordinate);
            this.tileStream.next({tileCount: 1, fileId, channel, stokes, flush: false});
            if (syncId) {
                this.completeSynchronisedTiles(key, fileId, channel, stokes, syncId);
            }
        }
    }

    private completeSynchronisedTiles(key: string, fileId: number | null | undefined, channel: number | null | undefined, stokes: number | null | undefined, syncId: number) {
        if (!this.isAnimationEnabled && !this.pendingSynchronisedTiles.get(key)?.size) {
            if (this.syncIdMap.get(syncId) === true && this.pendingDecompressions.get(key)?.get(syncId)?.size === 0) {
                this.clearRasterSync(key, syncId);
            }
            return;
        }
        const receivedTiles = this.receivedSynchronisedTiles.get(key)?.get(syncId);
        const tileCount = receivedTiles?.size ?? 0;
        if (this.syncIdMap.get(syncId) !== true || this.syncIdTileCountMap.get(syncId) !== tileCount) {
            return;
        }

        this.clearRasterSync(key, syncId);
        if (this.isAnimationEnabled) {
            this.clearCompressedCache(fileId ?? NaN);
        }
        receivedTiles?.forEach((tile, coordinate) => {
            const tileCacheKey = getTileCacheKey(fileId, channel, coordinate);
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
        this.completedChannels.delete(key);
        const syncMaps = this.pendingDecompressions.get(key);
        syncMaps?.delete(syncId);
        if (!syncMaps?.size) {
            this.pendingDecompressions.delete(key);
        }
        this.syncIdMap.delete(syncId);
        this.syncIdTileCountMap.delete(syncId);
        this.syncIdGenerationMap.delete(syncId);
    }
}
