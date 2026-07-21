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

interface ChannelMapRequest {
    fileId: number;
    channel: number;
    stokes: number;
    requiredTiles: CARTA.AddRequiredTiles.$Properties;
}

interface ActiveChannelMapRequest extends ChannelMapRequest {
    requestId: number;
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
    private readonly cacheMapCompressedTiles: Map<number, LRUCache<bigint | undefined, CompressedTile>>;
    private readonly pendingRequests: Map<string | undefined, Map<number, boolean>>;
    private readonly pendingDecompressions: Map<string, Map<number, Map<number, boolean>>>;
    private readonly channelMap: Map<number, {channel: number | null | undefined; stokes: number | null | undefined}>;
    private readonly completedChannels: Map<string, boolean>;
    readonly tileStream: Subject<TileStreamDetails>;
    private cachedTiles: LRUCache<bigint, RasterTile>;
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
        this.cachedTiles = new LRUCache<bigint, RasterTile>(BigInt64Array, ArrayBuffer, lruCapacityGPU);

        // L2 cache: compressed tiles on system memory
        this.lruCapacitySystem = lruCapacitySystem;
    };

    private constructor() {
        this.backendService = BackendService.Instance;
        this.gl = TileWebGLService.Instance.gl;

        this.channelMap = new Map<number, {channel: number; stokes: number}>();
        this.pendingRequests = new Map<string, Map<number, boolean>>();
        this.cacheMapCompressedTiles = new Map<number, LRUCache<bigint, CompressedTile>>();
        this.pendingDecompressions = new Map<string, Map<number, Map<number, boolean>>>();
        this.completedChannels = new Map<string, boolean>();
        this.receivedSynchronisedTiles = new Map<string, Map<number, Map<number, RasterTile>>>();
        this.pendingSynchronisedTiles = new Map<string, Set<number>>();
        this.syncIdMap = new Map<number, boolean>();
        this.syncIdTileCountMap = new Map<number, number>();
        this.channelMapRequestQueues = new Map<number, ChannelMapRequest[]>();
        this.activeChannelMapRequests = new Map<number, ActiveChannelMapRequest>();

        this.compressionRequestCounter = 0;
        this.isAnimationEnabled = false;

        this.tileStream = new Subject<TileStreamDetails>();
        this.backendService.rasterTileStream.subscribe(this.handleStreamedTiles);
        this.backendService.rasterSyncStream.subscribe(this.handleStreamSync);
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
                    this.updateStream(eventArgs.fileId, eventArgs.channel, eventArgs.stokes, resultArray, eventArgs.width, eventArgs.subsetHeight, eventArgs.layer, eventArgs.tileCoordinate, eventArgs.syncId);
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
            const newCache = new LRUCache<bigint, CompressedTile>(BigInt64Array, ArrayBuffer, this.lruCapacitySystem);
            this.cacheMapCompressedTiles.set(fileId, newCache);
            return newCache;
        }
    }

    getTile(tileCoordinateEncoded: number, fileId: number, channel: number, shouldPeek: boolean = false) {
        const gpuCacheCoordinate = TileCoordinate.addFileIdAndChannel(tileCoordinateEncoded, fileId, channel);
        if (shouldPeek) {
            return this.cachedTiles.peek(gpuCacheCoordinate);
        }
        return this.cachedTiles.get(gpuCacheCoordinate);
    }

    private getRequiredRequestTiles(tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, shouldTrackPending: boolean = true) {
        const newRequests = new Array<TileCoordinate>();
        const key = `${fileId}_${stokes}_${channel}`;
        for (const tile of tiles) {
            if (tile.layer < 0) {
                continue;
            }
            const encodedCoordinate = tile.encode();
            const gpuCacheCoordinate = TileCoordinate.addFileIdAndChannel(encodedCoordinate, fileId, channel);
            const compressedTile = this.getCompressedCache(fileId).get(gpuCacheCoordinate);
            const pendingCompressionMap = this.pendingDecompressions.get(key);
            const isTileQueuedForDecompression = pendingCompressionMap && Array.from(pendingCompressionMap.values()).some(map => map.has(encodedCoordinate));
            const isTileCached = this.cachedTiles?.has(gpuCacheCoordinate);
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
            } else if (!compressedTile) {
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
        const key = `${fileId}_${stokes}_${channel}`;
        if (!this.pendingRequests.has(key)) {
            this.pendingRequests.set(key, new Map<number, boolean>());
        }
        tiles.forEach(tile => this.pendingRequests.get(key)?.set(tile, true));
        this.updateRemainingTileCount();
    }

    requestTiles(tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, focusPoint: Point2D, compressionQuality: number, areChannelsChanged: boolean = false) {
        const key = `${fileId}_${stokes}_${channel}`;

        if (areChannelsChanged || !this.channelMap.has(fileId)) {
            this.pendingSynchronisedTiles.set(key, new Set(tiles.map(tile => tile.encode())));
            this.receivedSynchronisedTiles.delete(key);
            this.clearRequestQueue(fileId);
            this.channelMap.set(fileId, {channel, stokes});
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

        if (isPolarizationChanged) {
            for (let i = fullChannelRange.min; i <= fullChannelRange.max; i++) {
                const key = `${fileId}_${stokes}_${i}`;
                this.pendingSynchronisedTiles.set(key, new Set(tiles.map(tile => tile.encode())));
                this.receivedSynchronisedTiles.delete(key);
            }
            this.clearRequestQueue(fileId);
            this.clearCompressedCache(fileId);
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
        if (requests.length || (activeRequest && (activeRequest.channel !== frame.channel || activeRequest.stokes !== stokes))) {
            const activeChannelIndex = requests.findIndex(request => request.channel === frame.channel);
            if (activeChannelIndex >= 0) {
                requests.push(requests.splice(activeChannelIndex, 1)[0]);
            } else {
                requests.push({fileId, channel: frame.channel, stokes, requiredTiles: {}});
            }
        }
        this.queueChannelMapRequests(fileId, requests);
    }

    updateChannelMapActiveChannel(fileId: number, channel: number, stokes: number) {
        this.channelMap.set(fileId, {channel, stokes});
        this.queueChannelMapRequests(fileId, [{fileId, channel, stokes, requiredTiles: {}}]);
    }

    private queueChannelMapRequests(fileId: number, requests: ChannelMapRequest[]) {
        this.channelMapRequestQueues.set(fileId, requests);
        if (!this.activeChannelMapRequests.has(fileId)) {
            this.sendNextChannelMapRequest(fileId);
        }
    }

    private sendNextChannelMapRequest(fileId: number) {
        const request = this.channelMapRequestQueues.get(fileId)?.shift();
        if (!request) {
            this.channelMapRequestQueues.delete(fileId);
            return;
        }

        const tiles = request.requiredTiles.tiles ?? [];
        this.trackPendingRequests(request.fileId, request.channel, request.stokes, tiles);
        const requestId = this.backendService.setChannels(request.fileId, request.channel, request.stokes, request.requiredTiles, true);
        if (requestId !== null) {
            this.activeChannelMapRequests.set(fileId, {...request, requestId});
        } else {
            const key = `${request.fileId}_${request.stokes}_${request.channel}`;
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
        if (!activeRequest || activeRequest.requestId !== eventId || activeRequest.channel !== message.receivedChannel) {
            return;
        }
        this.activeChannelMapRequests.delete(fileId);
        this.sendNextChannelMapRequest(fileId);
    }

    cancelChannelMapRequests(fileId?: number) {
        const fileIds = fileId === undefined ? new Set([...this.channelMapRequestQueues.keys(), ...this.activeChannelMapRequests.keys()]) : [fileId];
        fileIds.forEach(id => this.clearRequestQueue(id));
        if (fileId === undefined) {
            this.channelMapRequestQueues.clear();
            this.activeChannelMapRequests.clear();
        } else {
            this.channelMapRequestQueues.delete(fileId);
            this.activeChannelMapRequests.delete(fileId);
        }
    }

    updateHiddenFileChannels(fileId: number, channel: number, stokes: number) {
        this.clearCompressedCache(fileId);
        this.clearGPUCache(fileId);

        this.channelMap.set(fileId, {channel, stokes});
        this.backendService.setChannels(fileId, channel, stokes, {});
    }

    clearGPUCache(fileId: number | null | undefined) {
        const cacheCapacity = this.cachedTiles.capacity;
        const keys: bigint[] = [];
        const tiles: RasterTile[] = [];

        for (const [key, tile] of this.cachedTiles) {
            // Clear tile if it matches the fileId, otherwise add it to the collection of tiles to add to the new cache
            if (TileCoordinate.getFileId(key) === fileId) {
                this.clearTile(tile, key);
            } else {
                keys.push(key);
                tiles.push(tile);
            }
        }

        // populate new cache with old entries, from oldest to newest, in order to preserve LRU ordering
        this.cachedTiles = new LRUCache<bigint, RasterTile>(BigInt64Array, ArrayBuffer, cacheCapacity);
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
            const fileKey = `${fileId}`;
            this.pendingRequests.forEach((value, key) => {
                if (key?.startsWith(fileKey)) {
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
        const fileKey = `${fileId}`;
        // remove all entries from the map with fileId in the key
        this.completedChannels.forEach((isCompleted, key) => {
            if (key.startsWith(fileKey)) {
                this.completedChannels.delete(key);
            }
        });

        this.pendingDecompressions.forEach((value, key) => {
            if (key.startsWith(fileKey)) {
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

    private handleStreamSync = (syncMessage: CARTA.RasterTileSync.$Properties) => {
        const key = `${syncMessage.fileId}_${syncMessage.stokes}_${syncMessage.channel}`;
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
            if (this.pendingDecompressions.has(key)) {
                this.pendingDecompressions.get(key)?.set(syncMessage.syncId, new Map<number, boolean>());
            } else {
                this.pendingDecompressions.set(key, new Map<number, Map<number, boolean>>().set(syncMessage.syncId, new Map<number, boolean>()));
            }
        } else {
            // mark the channel as complete
            this.completedChannels.set(key, true);
            this.syncIdMap.set(syncMessage.syncId, true);
        }
    };

    private handleStreamedTiles = (tileMessage: CARTA.RasterTileData.$Properties) => {
        const key = `${tileMessage.fileId}_${tileMessage.stokes}_${tileMessage.channel}`;

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

        if (appStore.channelMapStore.isChannelMapEnabled && !appStore.channelMapStore.channelArray.includes(tileMessage?.channel ?? NaN)) {
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
            this.channelMap.set(tileMessage.fileId, {channel: tileMessage.channel, stokes: tileMessage.stokes});
        }

        for (const tile of tileMessage.tiles ?? []) {
            const encodedCoordinate = TileCoordinate.encode(tile.x ?? NaN, tile.y ?? NaN, tile.layer ?? NaN);
            const gpuCacheCoordinate = TileCoordinate.addFileIdAndChannel(encodedCoordinate, tileMessage?.fileId ?? NaN, tileMessage?.channel ?? NaN);
            // Remove from the requested tile map. If in animation mode, don't check if we're still requesting tiles
            const pendingRequestsMap = this.pendingRequests.get(key);

            if (pendingRequestsMap?.has(encodedCoordinate) || this.isAnimationEnabled) {
                if (pendingRequestsMap) {
                    pendingRequestsMap.delete(encodedCoordinate);
                }
                this.updateRemainingTileCount();

                if (tileMessage.compressionType === CARTA.CompressionType.NONE) {
                    const decompressedData = tile.imageData ? new Float32Array(tile.imageData.buffer.slice(tile.imageData.byteOffset, tile.imageData.byteOffset + tile.imageData.byteLength)) : new Float32Array();
                    this.updateStream(tileMessage.fileId, tileMessage.channel, tileMessage.stokes, decompressedData, tile.width, tile.height, tile.layer, encodedCoordinate, tileMessage.syncId);
                } else {
                    if (tileMessage.fileId !== null && tileMessage.fileId !== undefined) {
                        this.getCompressedCache(tileMessage.fileId).set(gpuCacheCoordinate, {tile, channel: tileMessage.channel ?? NaN, compressionQuality: tileMessage.compressionQuality});
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

        const key = `${fileId}_${stokes}_${channel}`;
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
            syncId
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
        syncId: number | null | undefined
    ) {
        const key = `${fileId}_${stokes}_${channel}`;
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

            if (this.syncIdMap.has(syncId) && this.syncIdTileCountMap.get(syncId) === receivedTiles?.size) {
                this.completedChannels.delete(key);
                this.pendingDecompressions.get(key)?.delete(syncId);
                this.syncIdMap.delete(syncId);
                this.syncIdTileCountMap.delete(syncId);
                const tileCount = receivedTiles?.size;
                if (this.isAnimationEnabled) {
                    this.clearCompressedCache(fileId ?? NaN);
                }
                receivedTiles?.forEach((tile, coordinate) => {
                    const gpuCacheCoordinate = TileCoordinate.addFileIdAndChannel(coordinate, fileId ?? NaN, channel ?? NaN);
                    const oldValue = this.cachedTiles.setpop(gpuCacheCoordinate, tile);
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
        } else {
            // Handle single tile, no sync required
            const rasterTile: RasterTile = {
                width,
                height,
                textureCoordinate: 0,
                data: decompressedData
            };
            const gpuCacheCoordinate = TileCoordinate.addFileIdAndChannel(encodedCoordinate, fileId ?? NaN, channel ?? NaN);
            const oldValue = this.cachedTiles.setpop(gpuCacheCoordinate, rasterTile);
            if (oldValue) {
                this.clearTile(oldValue.value, oldValue.key);
            }
            rasterTile.textureCoordinate = this.textureCoordinateQueue.pop();

            pendingCompressionMap.delete(encodedCoordinate);
            this.tileStream.next({tileCount: 1, fileId, channel, stokes, flush: false});
        }
    }
}
