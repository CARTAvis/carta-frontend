import {CARTA} from "carta-protobuf";
import LRUCache from "mnemonist/lru-cache";
import {action, computed, makeObservable, observable} from "mobx";
import {Subject} from "rxjs";

import {Point2D, TileCoordinate} from "models";
import {BackendService, TileWebGLService} from "services";
import {AppStore, PREVIEW_PV_FILEID} from "stores";
import {copyToFP32Texture, createFP32Texture, GL2} from "utilities";

import ZFPWorker from "!worker-loader!zfp_wrapper";

export interface RasterTile {
    data: Float32Array;
    width: number;
    height: number;
    textureCoordinate: number;
}

export interface CompressedTile {
    tile: CARTA.ITileData;
    compressionQuality: number;
}

export interface TileStreamDetails {
    tileCount: number;
    fileId: number;
    channel: number;
    stokes: number;
    flush: boolean;
}

export const TEXTURE_SIZE = 4096;
export const TILE_SIZE = 256;
export const MAX_TEXTURES = 8;

interface TileMessageArgs {
    width: number;
    subsetHeight: number;
    subsetLength: number;
    requestId: number;
    tileCoordinate: number;
    layer: number;
    fileId: number;
    channel: number;
    stokes: number;
    compression?: number;
    nanEncodings?: Int32Array;
    syncId?: number;
}

export class TileService {
    private static staticInstance: TileService;

    static get Instance() {
        if (!TileService.staticInstance) {
            TileService.staticInstance = new TileService();
        }
        return TileService.staticInstance;
    }

    private readonly backendService: BackendService;
    private readonly cacheMapCompressedTiles: Map<number, LRUCache<number, CompressedTile>>;
    private readonly pendingRequests: Map<string, Map<number, boolean>>;
    private readonly pendingDecompressions: Map<string, Map<number, Map<number, boolean>>>;
    private readonly channelMap: Map<number, {channel: number; stokes: number}>;
    private readonly completedChannels: Map<string, boolean>;
    readonly tileStream: Subject<TileStreamDetails>;
    private cachedTiles: LRUCache<number, RasterTile>;
    private lruCapacitySystem: number;
    private textureArray: Array<WebGLTexture>;
    private textureCoordinateQueue: Array<number>;
    private readonly workers: Worker[];
    private compressionRequestCounter: number;
    private pendingSynchronisedTiles: Map<string, Set<number>>;
    private receivedSynchronisedTiles: Map<string, Map<number, Map<number, RasterTile>>>;
    private animationEnabled: boolean;
    private readonly gl: WebGL2RenderingContext;
    private syncIdMap: Map<number, boolean>;
    private syncIdTileCountMap: Map<number, number>;

    @observable remainingTiles: number;
    @observable workersReady: boolean[];

    @computed get zfpReady() {
        return this.workersReady && this.workersReady.every(v => v);
    }

    @action setWorkerReady(index: number) {
        if (index >= 0 && index < this.workersReady.length) {
            this.workersReady[index] = true;
        }
    }

    public decompressPreviewRasterData(previewData: CARTA.PvPreviewData) {
        const compressedArray = previewData.imageData;
        const nanEncodings32 = new Int32Array(previewData.nanEncodings.slice(0).buffer);
        let compressedView = new Uint8Array(Math.max(compressedArray.byteLength, previewData.width * previewData.height * 4));
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

    public setAnimationEnabled = (val: boolean) => {
        this.animationEnabled = val;
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
        this.cachedTiles = new LRUCache<number, RasterTile>(Float64Array, ArrayBuffer, lruCapacityGPU);

        // L2 cache: compressed tiles on system memory
        this.lruCapacitySystem = lruCapacitySystem;
    };

    private constructor() {
        makeObservable(this);
        this.backendService = BackendService.Instance;
        this.gl = TileWebGLService.Instance.gl;

        this.channelMap = new Map<number, {channel: number; stokes: number}>();
        this.pendingRequests = new Map<string, Map<number, boolean>>();
        this.cacheMapCompressedTiles = new Map<number, LRUCache<number, CompressedTile>>();
        this.pendingDecompressions = new Map<string, Map<number, Map<number, boolean>>>();
        this.completedChannels = new Map<string, boolean>();
        this.receivedSynchronisedTiles = new Map<string, Map<number, Map<number, RasterTile>>>();
        this.pendingSynchronisedTiles = new Map<string, Set<number>>();
        this.syncIdMap = new Map<number, boolean>();
        this.syncIdTileCountMap = new Map<number, number>();

        this.compressionRequestCounter = 0;
        this.remainingTiles = 0;
        this.animationEnabled = false;

        this.tileStream = new Subject<TileStreamDetails>();
        this.backendService.rasterTileStream.subscribe(this.handleStreamedTiles);
        this.backendService.rasterSyncStream.subscribe(this.handleStreamSync);
        this.workers = new Array<Worker>(Math.min(navigator.hardwareConcurrency || 4, 4));
        this.workersReady = new Array<boolean>(this.workers.length);

        for (let i = 0; i < this.workers.length; i++) {
            this.workers[i] = new ZFPWorker();
            this.workers[i].onmessage = (event: MessageEvent) => {
                if (event.data[0] === "ready") {
                    this.setWorkerReady(i);
                } else if (event.data[0] === "decompress") {
                    const buffer = event.data[1];
                    const eventArgs = event.data[2] as TileMessageArgs;
                    const length = eventArgs.width * eventArgs.subsetHeight;
                    const resultArray = new Float32Array(buffer, 0, length);
                    this.updateStream(eventArgs.fileId, eventArgs.channel, eventArgs.stokes, resultArray, eventArgs.width, eventArgs.subsetHeight, eventArgs.layer, eventArgs.tileCoordinate, eventArgs.syncId);
                } else if (event.data[0] === "preview decompress") {
                    const buffer = event.data[1];
                    const eventArgs = event.data[2];
                    const frame = AppStore.Instance.previewFrames.get(eventArgs.previewId);
                    const length = eventArgs.width * eventArgs.subsetHeight;
                    const resultArray = new Float32Array(buffer, 0, length);
                    frame?.setPreviewPVRasterData(resultArray);
                }
            };
        }
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
            const newCache = new LRUCache<number, CompressedTile>(Float64Array, ArrayBuffer, this.lruCapacitySystem);
            this.cacheMapCompressedTiles.set(fileId, newCache);
            return newCache;
        }
    }

    getTile(tileCoordinateEncoded: number, fileId: number, channel: number, stokes: number, peek: boolean = false) {
        const gpuCacheCoordinate = TileCoordinate.AddFileId(tileCoordinateEncoded, fileId);
        if (peek) {
            return this.cachedTiles.peek(gpuCacheCoordinate);
        }
        return this.cachedTiles.get(gpuCacheCoordinate);
    }

    requestTiles(tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, focusPoint: Point2D, compressionQuality: number, channelsChanged: boolean = false) {
        const key = `${fileId}_${stokes}_${channel}`;

        if (channelsChanged || !this.channelMap.has(fileId)) {
            this.pendingSynchronisedTiles.set(key, new Set(tiles.map(tile => tile.encode())));
            this.receivedSynchronisedTiles.delete(key);
            this.clearRequestQueue(fileId);
            this.channelMap.set(fileId, {channel, stokes});
            this.clearCompressedCache(fileId);
        }

        const newRequests = new Array<TileCoordinate>();
        for (const tile of tiles) {
            if (tile.layer < 0) {
                continue;
            }
            const encodedCoordinate = tile.encode();
            const pendingRequestsMap = this.pendingRequests?.get(key);
            if (!(pendingRequestsMap && pendingRequestsMap.has(encodedCoordinate))) {
                const compressedTile = this.getCompressedCache(fileId).get(encodedCoordinate);
                const pendingCompressionMap = this.pendingDecompressions.get(key);
                const tileIsQueuedForDecompression = pendingCompressionMap && pendingCompressionMap.has(encodedCoordinate);

                const gpuCacheCoordinate = TileCoordinate.AddFileId(encodedCoordinate, fileId);
                const tileCached = !channelsChanged && this.cachedTiles?.has(gpuCacheCoordinate);

                if (!tileCached && compressedTile && !tileIsQueuedForDecompression) {
                    if (!pendingCompressionMap) {
                        this.pendingDecompressions.set(key, new Map<number, Map<number, boolean>>().set(0, new Map<number, boolean>()));
                    } else if (!pendingCompressionMap.has(0)) {
                        pendingCompressionMap.set(0, new Map<number, boolean>());
                    }
                    // Load from L2 cache instead
                    this.asyncDecompressTile(fileId, channel, stokes, compressedTile.tile, compressedTile.compressionQuality, encodedCoordinate);
                } else if (!compressedTile) {
                    // Request from backend
                    if (!pendingRequestsMap) {
                        this.pendingRequests.set(key, new Map<number, boolean>());
                    }
                    this.pendingRequests.get(key)?.set(encodedCoordinate, true);
                    this.updateRemainingTileCount();
                    newRequests.push(tile);
                }
            }
        }

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
            if (channelsChanged) {
                this.backendService.setChannels(fileId, channel, stokes, {fileId, compressionQuality, compressionType: CARTA.CompressionType.ZFP, tiles: sortedRequests});
            } else {
                this.backendService.addRequiredTiles(fileId, sortedRequests, compressionQuality);
            }
        } else {
            this.completedChannels.set(key, true);
            this.tileStream.next({tileCount: 0, fileId, channel, stokes, flush: false});
        }
    }

    updateHiddenFileChannels(fileId: number, channel: number, stokes: number) {
        this.clearCompressedCache(fileId);
        this.clearGPUCache(fileId);
        this.channelMap.set(fileId, {channel, stokes});
        this.backendService.setChannels(fileId, channel, stokes, {});
    }

    clearGPUCache(fileId: number) {
        const cacheCapacity = this.cachedTiles.capacity;
        const keys: number[] = [];
        const tiles: RasterTile[] = [];

        for (const [key, tile] of this.cachedTiles) {
            // Clear tile if it matches the fileId, otherwise add it to the collection of tiles to add to the new cache
            if (TileCoordinate.GetFileId(key) === fileId) {
                this.clearTile(tile, key);
            } else {
                keys.push(key);
                tiles.push(tile);
            }
        }

        // populate new cache with old entries, from oldest to newest, in order to preserve LRU ordering
        this.cachedTiles = new LRUCache<number, RasterTile>(Float64Array, ArrayBuffer, cacheCapacity);
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
                if (key.startsWith(fileKey)) {
                    value.clear();
                }
            });
        } else {
            // Clear all requests
            this.pendingRequests.clear();
        }

        this.updateRemainingTileCount();
    }

    handleFileClosed(fileId: number) {
        this.clearCompressedCache(fileId);
        this.clearGPUCache(fileId);
        this.channelMap.delete(fileId);
        const fileKey = `${fileId}`;
        // remove all entries from the map with fileId in the key
        this.completedChannels.forEach((value, key) => {
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
            const texture = createFP32Texture(this.gl, TEXTURE_SIZE, TEXTURE_SIZE, GL2.TEXTURE0);
            if (texture) {
                this.textureArray[i] = texture;
            }
        }
    }

    uploadTileToGPU(tile: RasterTile) {
        const textureParameters = this.getTileTextureParameters(tile);
        copyToFP32Texture(this.gl, textureParameters.texture, tile.data, GL2.TEXTURE0, tile.width, tile.height, textureParameters.offset.x, textureParameters.offset.y);
    }

    getTileTextureParameters(tile: RasterTile) {
        const numTilesPerTexture = (TEXTURE_SIZE * TEXTURE_SIZE) / (TILE_SIZE * TILE_SIZE);
        const localOffset = tile.textureCoordinate % numTilesPerTexture;
        const textureIndex = Math.floor((tile.textureCoordinate - localOffset) / numTilesPerTexture);
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
            tile.data = new Float32Array();
        }
        this.textureCoordinateQueue.push(tile.textureCoordinate);
    };

    private handleStreamSync = (syncMessage: CARTA.IRasterTileSync) => {
        const key = `${syncMessage.fileId}_${syncMessage.stokes}_${syncMessage.channel}`;
        if (this.animationEnabled && syncMessage.animationId !== this.backendService.animationId) {
            return;
        } else if (!this.animationEnabled && syncMessage.animationId !== 0) {
            return;
        }

        if (syncMessage.syncId === null || syncMessage.syncId === undefined) {
            return;
        }

        // At the start of the stream, create a new pending decompression map for the channel about to be streamed
        if (!syncMessage.endSync) {
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

    private handleStreamedTiles = (tileMessage: CARTA.IRasterTileData) => {
        const key = `${tileMessage.fileId}_${tileMessage.stokes}_${tileMessage.channel}`;

        if (tileMessage.compressionType !== CARTA.CompressionType.NONE && tileMessage.compressionType !== CARTA.CompressionType.ZFP) {
            console.error("Unsupported compression type");
        }

        const currentChannels = this.channelMap.get(tileMessage.fileId ?? NaN);
        // Ignore stale tiles that don't match the currently required tiles. During animation, ignore changes to channel
        if (!this.animationEnabled && (!currentChannels || currentChannels.channel !== tileMessage.channel || currentChannels.stokes !== tileMessage.stokes)) {
            console.log(`Ignoring stale tile for channel=${tileMessage.channel} (Current channel=${currentChannels ? currentChannels.channel : undefined})`);
            return;
        }

        if (this.animationEnabled && tileMessage.animationId !== this.backendService.animationId && !this.syncIdMap.has(tileMessage.syncId ?? NaN)) {
            console.log(`Skipping stale tile during animation Message animation_id: ${tileMessage.animationId}. Service animation_id: ${this.backendService.animationId}`);
            return;
        } else if (!this.animationEnabled && tileMessage.animationId !== 0) {
            console.log(`Skipping stale animation tile outside of animation. Message animation_id: ${tileMessage.animationId}. Service animation_id: ${this.backendService.animationId}`);
            return;
        }

        const pendingCompressionMap = this.pendingDecompressions.get(key)?.has(tileMessage.syncId || 0);
        // When we stop animation playback, the code might have already deleted the compression map for the key, causing a missing compression map
        if (!pendingCompressionMap) {
            console.warn(`Missing compression map for key=${key}`);
            return;
        }
        if (this.animationEnabled && tileMessage.fileId !== null && tileMessage.fileId !== undefined) {
            this.channelMap.set(tileMessage.fileId, {channel: tileMessage.channel ?? NaN, stokes: tileMessage.stokes ?? NaN});
        }

        for (let tile of tileMessage.tiles ?? []) {
            const encodedCoordinate = TileCoordinate.Encode(tile.x ?? NaN, tile.y ?? NaN, tile.layer ?? NaN);
            // Remove from the requested tile map. If in animation mode, don't check if we're still requesting tiles
            const pendingRequestsMap = this.pendingRequests.get(key);
            if (pendingRequestsMap?.has(encodedCoordinate) || this.animationEnabled) {
                if (pendingRequestsMap) {
                    pendingRequestsMap.delete(encodedCoordinate);
                }
                this.updateRemainingTileCount();

                if (tileMessage.compressionType === CARTA.CompressionType.NONE) {
                    const decompressedData = tile.imageData ? new Float32Array(tile.imageData.buffer.slice(tile.imageData.byteOffset, tile.imageData.byteOffset + tile.imageData.byteLength)) : new Float32Array();
                    this.updateStream(
                        tileMessage.fileId ?? NaN,
                        tileMessage.channel ?? NaN,
                        tileMessage.stokes ?? NaN,
                        decompressedData,
                        tile.width ?? NaN,
                        tile.height ?? NaN,
                        tile.layer ?? NaN,
                        encodedCoordinate,
                        tileMessage.syncId ?? undefined
                    );
                } else {
                    this.getCompressedCache(tileMessage.fileId ?? NaN).set(encodedCoordinate, {tile, compressionQuality: tileMessage.compressionQuality ?? NaN});
                    this.asyncDecompressTile(tileMessage.fileId ?? NaN, tileMessage.channel ?? NaN, tileMessage.stokes ?? NaN, tile, tileMessage.compressionQuality ?? NaN, encodedCoordinate, tileMessage.syncId ?? undefined);
                }
            } else {
                console.warn(`No pending request for tile (${tile.x}, ${tile.y}, ${tile.layer}) and key=${key}`);
            }
        }
    };

    private asyncDecompressTile(fileId: number, channel: number, stokes: number, tile: CARTA.ITileData, precision: number, tileCoordinate: number, syncId?: number) {
        const compressedArray = tile.imageData;
        const workerIndex = this.compressionRequestCounter % this.workers.length;
        const nanEncodings32 = new Int32Array((tile.nanEncodings ?? new Uint8Array()).slice(0).buffer);
        let compressedView = new Uint8Array(Math.max(compressedArray?.byteLength ?? NaN, (tile.width ?? NaN) * (tile.height ?? NaN) * 4));
        compressedView.set(compressedArray ?? new Uint8Array());

        const key = `${fileId}_${stokes}_${channel}`;
        const pendingCompressionMap = this.pendingDecompressions.get(key);
        if (!pendingCompressionMap) {
            console.warn("Problem decompressing tile!");
            return;
        }
        pendingCompressionMap.get(syncId || 0)?.set(tileCoordinate, true);

        const eventArgs: TileMessageArgs = {
            fileId,
            channel,
            stokes,
            width: tile.width ?? NaN,
            subsetHeight: tile.height ?? NaN,
            subsetLength: compressedArray?.byteLength ?? NaN,
            compression: precision,
            nanEncodings: nanEncodings32,
            tileCoordinate,
            layer: tile.layer ?? NaN,
            requestId: this.compressionRequestCounter,
            syncId
        };

        this.workers[workerIndex].postMessage(["decompress", compressedView.buffer, eventArgs], [compressedView.buffer, nanEncodings32.buffer]);
        this.compressionRequestCounter++;
    }

    private updateStream(fileId: number, channel: number, stokes: number, decompressedData: Float32Array, width: number, height: number, _layer: number, encodedCoordinate: number, syncId: number | undefined) {
        const key = `${fileId}_${stokes}_${channel}`;
        const pendingCompressionMap = this.pendingDecompressions.get(key)?.get(syncId || 0);
        if (!pendingCompressionMap) {
            console.warn(`Problem decompressing tile. Missing pending decompression map ${key}!`);
            return;
        }

        // If there are pending tiles to be synchronized, don't send tiles one-by-one
        const pendingTiles = this.pendingSynchronisedTiles.get(key);
        if (syncId && (this.animationEnabled || pendingTiles?.size)) {
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
            // If all tiles are in place, add them to the LRU and fire the stream observable
            if (this.syncIdMap.get(syncId) && this.syncIdTileCountMap.get(syncId) === receivedTiles?.size) {
                this.completedChannels.delete(key);
                this.pendingDecompressions.get(key)?.delete(syncId);
                this.syncIdMap.delete(syncId);
                this.syncIdTileCountMap.delete(syncId);
                const tileCount = receivedTiles?.size;
                this.clearGPUCache(fileId);
                if (this.animationEnabled) {
                    this.clearCompressedCache(fileId);
                }

                receivedTiles?.forEach((tile, coordinate) => {
                    const textureCoordinate = this.textureCoordinateQueue.pop();
                    if (textureCoordinate !== undefined) {
                        tile.textureCoordinate = textureCoordinate;
                    }
                    const gpuCacheCoordinate = TileCoordinate.AddFileId(coordinate, fileId);
                    const oldValue = this.cachedTiles.setpop(gpuCacheCoordinate, tile);
                    if (oldValue) {
                        this.clearTile(oldValue.value, oldValue.key);
                    }
                });
                this.pendingSynchronisedTiles.delete(key);
                this.receivedSynchronisedTiles.delete(key);
                this.tileStream.next({tileCount: tileCount ?? NaN, fileId, channel, stokes, flush: true});
            }
        } else {
            // Handle single tile, no sync required
            const rasterTile: RasterTile = {
                width,
                height,
                textureCoordinate: 0,
                data: decompressedData
            };
            const gpuCacheCoordinate = TileCoordinate.AddFileId(encodedCoordinate, fileId);
            const oldValue = this.cachedTiles.setpop(gpuCacheCoordinate, rasterTile);
            if (oldValue) {
                this.clearTile(oldValue.value, oldValue.key);
            }
            const textureCoordinate = this.textureCoordinateQueue.pop();
            if (textureCoordinate !== undefined) {
                rasterTile.textureCoordinate = textureCoordinate;
            }

            pendingCompressionMap.delete(encodedCoordinate);
            this.tileStream.next({tileCount: 1, fileId, channel, stokes, flush: false});
        }
    }
}
