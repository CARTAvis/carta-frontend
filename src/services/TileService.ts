import {Subject} from "rxjs";
import {action, computed, observable, makeObservable} from "mobx";
import LRUCache from "mnemonist/lru-cache";
import {CARTA} from "carta-protobuf";
import {Point2D, TileCoordinate} from "models";
import {BackendService, TileWebGLService} from "services";
import {copyToFP32Texture, createFP32Texture} from "utilities";

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
export const NUM_PERSISTENT_LAYERS = 4;
export const NUM_PERSISTENT_TILES = 85;

export class TileService {
    private static staticInstance: TileService;

    static get Instance() {
        if (!TileService.staticInstance) {
            TileService.staticInstance = new TileService();
        }
        return TileService.staticInstance;
    }

    private readonly backendService: BackendService;
    private readonly persistentTiles: Map<number, RasterTile>;
    private readonly cacheMapCompressedTiles: Map<number, LRUCache<number, CompressedTile>>;
    private readonly pendingRequests: Map<number, boolean>;
    private readonly pendingDecompressions: Map<string, Map<number, boolean>>;
    private readonly channelMap: Map<number, {channel: number; stokes: number}>;
    private readonly completedChannels: Map<string, boolean>;
    private currentFileId: number;
    readonly tileStream: Subject<TileStreamDetails>;
    private cachedTiles: LRUCache<number, RasterTile>;
    private lruCapacitySystem: number;
    private textureArray: Array<WebGLTexture>;
    private textureCoordinateQueue: Array<number>;
    private readonly workers: Worker[];
    private compressionRequestCounter: number;
    private pendingSynchronisedTiles: Array<number>;
    private receivedSynchronisedTiles: Array<{coordinate: number; tile: RasterTile}>;
    private animationEnabled: boolean;
    private gl: WebGLRenderingContext;

    @observable remainingTiles: number;
    @observable workersReady: boolean[];

    @computed get zfpReady() {
        return this.workersReady && this.workersReady.every(v => v);
    }

    public GetTileStream() {
        return this.tileStream;
    }

    public setAnimationEnabled = (val: boolean) => {
        this.animationEnabled = val;
    };

    public setCache = (lruCapacityGPU: number, lruCapacitySystem: number) => {
        // L1 cache: on GPU
        const minRequiredTiles = lruCapacityGPU + NUM_PERSISTENT_TILES;
        const numTilesPerTexture = (TEXTURE_SIZE * TEXTURE_SIZE) / (TILE_SIZE * TILE_SIZE);
        const numTextures = Math.min(Math.ceil(minRequiredTiles / numTilesPerTexture), MAX_TEXTURES);
        lruCapacityGPU = numTextures * numTilesPerTexture - NUM_PERSISTENT_TILES;
        console.log(`lruGPU capacity rounded to : ${lruCapacityGPU}`);

        this.textureArray = new Array<WebGLTexture>(numTextures);
        this.initTextures();
        this.resetCoordinateQueue();
        this.cachedTiles = new LRUCache<number, RasterTile>(Int32Array, null, lruCapacityGPU);

        // L2 cache: compressed tiles on system memory
        this.lruCapacitySystem = lruCapacitySystem;
    };

    private constructor() {
        makeObservable(this);
        this.backendService = BackendService.Instance;
        this.gl = TileWebGLService.Instance.gl;

        this.channelMap = new Map<number, {channel: number; stokes: number}>();
        this.persistentTiles = new Map<number, RasterTile>();
        this.pendingRequests = new Map<number, boolean>();
        this.cacheMapCompressedTiles = new Map<number, LRUCache<number, CompressedTile>>();
        this.pendingDecompressions = new Map<string, Map<number, boolean>>();
        this.completedChannels = new Map<string, boolean>();

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
                    this.workersReady[i] = true;
                    console.log(`Tile Worker ${i} ready`);
                } else if (event.data[0] === "decompress") {
                    const buffer = event.data[1];
                    const eventArgs = event.data[2];
                    const length = eventArgs.width * eventArgs.subsetHeight;
                    const resultArray = new Float32Array(buffer, 0, length);
                    this.updateStream(
                        eventArgs.fileId,
                        eventArgs.channel,
                        eventArgs.stokes,
                        resultArray,
                        eventArgs.width,
                        eventArgs.subsetHeight,
                        eventArgs.layer,
                        eventArgs.tileCoordinate
                    );
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
            const newCache = new LRUCache<number, CompressedTile>(Int32Array, null, this.lruCapacitySystem);
            this.cacheMapCompressedTiles.set(fileId, newCache);
            return newCache;
        }
    }

    getTile(tileCoordinateEncoded: number, fileId: number, channel: number, stokes: number, peek: boolean = false) {
        const layer = TileCoordinate.GetLayer(tileCoordinateEncoded);
        if (layer < NUM_PERSISTENT_LAYERS) {
            return this.persistentTiles.get(tileCoordinateEncoded);
        }
        if (peek) {
            return this.cachedTiles.peek(tileCoordinateEncoded);
        }
        return this.cachedTiles.get(tileCoordinateEncoded);
    }

    requestTiles(
        tiles: TileCoordinate[],
        fileId: number,
        channel: number,
        stokes: number,
        focusPoint: Point2D,
        compressionQuality: number,
        channelsChanged: boolean = false
    ) {
        let fileChanged = this.currentFileId !== fileId;

        if (fileChanged) {
            this.currentFileId = fileId;
            this.pendingSynchronisedTiles = tiles.map(tile => tile.encode());
            this.receivedSynchronisedTiles = [];
            this.clearRequestQueue();
        }

        if (channelsChanged || !this.channelMap.has(fileId)) {
            this.pendingSynchronisedTiles = tiles.map(tile => tile.encode());
            this.receivedSynchronisedTiles = [];
            this.clearRequestQueue();
            this.channelMap.set(fileId, {channel, stokes});
            this.clearCompressedCache(fileId);
        }

        const key = `${fileId}_${stokes}_${channel}`;

        const newRequests = new Array<TileCoordinate>();
        for (const tile of tiles) {
            if (tile.layer < 0) {
                continue;
            }
            const encodedCoordinate = tile.encode();
            const tileCached =
                !(channelsChanged || fileChanged) &&
                ((tile.layer < NUM_PERSISTENT_LAYERS && this.persistentTiles.has(encodedCoordinate)) ||
                    (tile.layer >= NUM_PERSISTENT_LAYERS && this.cachedTiles.has(encodedCoordinate)));
            if (!tileCached && !this.pendingRequests.has(encodedCoordinate)) {
                const compressedTile = !channelsChanged && this.getCompressedCache(fileId).get(encodedCoordinate);
                const pendingCompressionMap = this.pendingDecompressions.get(key);
                const tileIsQueuedForDecompression = pendingCompressionMap && pendingCompressionMap.has(encodedCoordinate);
                if (compressedTile && !tileIsQueuedForDecompression) {
                    if (!pendingCompressionMap) {
                        this.pendingDecompressions.set(key, new Map<number, boolean>());
                    }
                    // Load from L2 cache instead

                    this.asyncDecompressTile(fileId, channel, stokes, compressedTile.tile, compressedTile.compressionQuality, encodedCoordinate);
                } else if (!compressedTile) {
                    // Request from backend
                    this.pendingRequests.set(encodedCoordinate, true);
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
                this.backendService.setChannels(fileId, channel, stokes, {
                    fileId,
                    compressionQuality,
                    compressionType: CARTA.CompressionType.ZFP,
                    tiles: sortedRequests
                });
            } else {
                this.backendService.addRequiredTiles(fileId, sortedRequests, compressionQuality);
            }
        } else {
            this.completedChannels.set(key, true);
        }
    }

    updateInactiveFileChannel(fileId: number, channel: number, stokes: number) {
        this.clearCompressedCache(fileId);
        this.channelMap.set(fileId, {channel, stokes});
        this.backendService.setChannels(fileId, channel, stokes, {});
    }

    clearGPUCache() {
        this.cachedTiles.forEach(this.clearTile);
        this.cachedTiles.clear();
        this.persistentTiles.forEach(this.clearTile);
        this.persistentTiles.clear();
    }

    clearCompressedCache(fileId: number) {
        if (fileId === -1) {
            this.cacheMapCompressedTiles.clear();
        } else {
            this.cacheMapCompressedTiles.delete(fileId);
        }
    }

    clearRequestQueue() {
        this.pendingRequests.clear();
        this.updateRemainingTileCount();
    }

    handleFileClosed(fileId: number) {
        this.clearCompressedCache(fileId);
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
        console.log(
            `Creating ${this.textureArray.length} tile textures of size ${textureSizeMb} MB each (${textureSizeMb * this.textureArray.length} MB total)`
        );
        for (let i = 0; i < this.textureArray.length; i++) {
            this.textureArray[i] = createFP32Texture(this.gl, TEXTURE_SIZE, TEXTURE_SIZE, WebGLRenderingContext.TEXTURE0);
        }
    }

    uploadTileToGPU(tile: RasterTile) {
        const numTilesPerTexture = (TEXTURE_SIZE * TEXTURE_SIZE) / (TILE_SIZE * TILE_SIZE);
        const localOffset = tile.textureCoordinate % numTilesPerTexture;
        const textureIndex = Math.floor((tile.textureCoordinate - localOffset) / numTilesPerTexture);
        const tilesPerRow = TEXTURE_SIZE / TILE_SIZE;
        const xOffset = (localOffset % tilesPerRow) * TILE_SIZE;
        const yOffset = Math.floor(localOffset / tilesPerRow) * TILE_SIZE;
        copyToFP32Texture(this.gl, this.textureArray[textureIndex], tile.data, WebGLRenderingContext.TEXTURE0, tile.width, tile.height, xOffset, yOffset);
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
        this.remainingTiles = this.pendingRequests.size;
    };

    private clearTile = (tile: RasterTile, key: number) => {
        if (tile.data) {
            delete tile.data;
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

        // At the start of the stream, create a new pending decompressions map for the channel about to be streamed
        if (!syncMessage.endSync) {
            this.completedChannels.delete(key);
            this.pendingDecompressions.set(key, new Map<number, boolean>());
        } else {
            // mark the channel as complete
            this.completedChannels.set(key, true);
        }
    };

    private handleStreamedTiles = (tileMessage: CARTA.IRasterTileData) => {
        const key = `${tileMessage.fileId}_${tileMessage.stokes}_${tileMessage.channel}`;

        if (tileMessage.compressionType !== CARTA.CompressionType.NONE && tileMessage.compressionType !== CARTA.CompressionType.ZFP) {
            console.error("Unsupported compression type");
        }

        const currentChannels = this.channelMap.get(tileMessage.fileId);
        // Ignore stale tiles that don't match the currently required tiles. During animation, ignore changes to channel
        if (
            this.currentFileId !== tileMessage.fileId ||
            (!this.animationEnabled && (!currentChannels || currentChannels.channel !== tileMessage.channel || currentChannels.stokes !== tileMessage.stokes))
        ) {
            console.log(`Ignoring stale tile for channel=${tileMessage.channel} (Current channel=${currentChannels ? currentChannels.channel : undefined})`);
            return;
        }

        if (this.animationEnabled && tileMessage.animationId !== this.backendService.animationId) {
            console.log(
                `Skipping stale tile during animation Message animation_id: ${tileMessage.animationId}. Service animation_id: ${this.backendService.animationId}`
            );
            return;
        } else if (!this.animationEnabled && tileMessage.animationId !== 0) {
            console.log(
                `Skipping stale animation tile outside of animation. Message animation_id: ${tileMessage.animationId}. Service animation_id: ${this.backendService.animationId}`
            );
            return;
        }

        const pendingCompressionMap = this.pendingDecompressions.get(key);
        if (!pendingCompressionMap) {
            console.log(`Missing compression map for key=${key}`);
            return;
        }

        if (this.animationEnabled) {
            this.channelMap.set(tileMessage.fileId, {channel: tileMessage.channel, stokes: tileMessage.stokes});
        }

        for (let tile of tileMessage.tiles) {
            const encodedCoordinate = TileCoordinate.Encode(tile.x, tile.y, tile.layer);
            // Remove from the requested tile map. If in animation mode, don't check if we're still requesting tiles
            if (this.pendingRequests.has(encodedCoordinate) || this.animationEnabled) {
                this.pendingRequests.delete(encodedCoordinate);
                this.updateRemainingTileCount();

                if (tileMessage.compressionType === CARTA.CompressionType.NONE) {
                    const decompressedData = new Float32Array(
                        tile.imageData.buffer.slice(tile.imageData.byteOffset, tile.imageData.byteOffset + tile.imageData.byteLength)
                    );
                    this.updateStream(
                        tileMessage.fileId,
                        tileMessage.channel,
                        tileMessage.stokes,
                        decompressedData,
                        tile.width,
                        tile.height,
                        tile.layer,
                        encodedCoordinate
                    );
                } else {
                    this.getCompressedCache(tileMessage.fileId).set(encodedCoordinate, {tile, compressionQuality: tileMessage.compressionQuality});
                    this.asyncDecompressTile(
                        tileMessage.fileId,
                        tileMessage.channel,
                        tileMessage.stokes,
                        tile,
                        tileMessage.compressionQuality,
                        encodedCoordinate
                    );
                }
            }
        }
    };

    private asyncDecompressTile(fileId: number, channel: number, stokes: number, tile: CARTA.ITileData, precision: number, tileCoordinate: number) {
        const compressedArray = tile.imageData;
        const workerIndex = this.compressionRequestCounter % this.workers.length;
        const nanEncodings32 = new Int32Array(tile.nanEncodings.slice(0).buffer);
        let compressedView = new Uint8Array(tile.width * tile.height * 4);
        compressedView.set(compressedArray);

        const key = `${fileId}_${stokes}_${channel}`;
        const pendingCompressionMap = this.pendingDecompressions.get(key);
        if (!pendingCompressionMap) {
            console.log("Problem decompressing tile!");
            return;
        }
        pendingCompressionMap.set(tileCoordinate, true);

        this.workers[workerIndex].postMessage(
            [
                "decompress",
                compressedView.buffer,
                {
                    fileId,
                    channel,
                    stokes,
                    width: tile.width,
                    subsetHeight: tile.height,
                    subsetLength: compressedArray.byteLength,
                    compression: precision,
                    nanEncodings: nanEncodings32,
                    tileCoordinate,
                    layer: tile.layer,
                    requestId: this.compressionRequestCounter
                }
            ],
            [compressedView.buffer, nanEncodings32.buffer]
        );
        this.compressionRequestCounter++;
    }

    private updateStream(
        fileId: number,
        channel: number,
        stokes: number,
        decompressedData: Float32Array,
        width: number,
        height: number,
        layer: number,
        encodedCoordinate: number
    ) {
        const key = `${fileId}_${stokes}_${channel}`;
        const pendingCompressionMap = this.pendingDecompressions.get(key);
        if (!pendingCompressionMap) {
            console.log(`Problem decompressing tile. Missing pending decompression map ${key}!`);
            return;
        }

        // If there are pending tiles to be synchronized, don't send tiles one-by-one
        if (this.animationEnabled || this.pendingSynchronisedTiles?.length) {
            // remove coordinate from pending list
            this.pendingSynchronisedTiles = this.pendingSynchronisedTiles.filter(v => v !== encodedCoordinate);
            const nextTile: RasterTile = {
                width,
                height,
                textureCoordinate: -1,
                data: decompressedData
            };
            if (!this.receivedSynchronisedTiles) {
                this.receivedSynchronisedTiles = [];
            }
            this.receivedSynchronisedTiles.push({coordinate: encodedCoordinate, tile: nextTile});
            pendingCompressionMap.delete(encodedCoordinate);

            // If all tiles are in place, add them to the LRU and fire the stream observable
            if (!pendingCompressionMap.size && this.completedChannels.get(key)) {
                this.completedChannels.delete(key);
                this.pendingDecompressions.delete(key);
                const tileCount = this.receivedSynchronisedTiles.length;
                this.clearGPUCache();
                if (this.animationEnabled) {
                    this.clearCompressedCache(fileId);
                }
                this.resetCoordinateQueue();

                for (const tilePair of this.receivedSynchronisedTiles) {
                    tilePair.tile.textureCoordinate = this.textureCoordinateQueue.pop();
                    if (layer < NUM_PERSISTENT_LAYERS) {
                        this.persistentTiles.set(tilePair.coordinate, tilePair.tile);
                    } else {
                        const oldValue = this.cachedTiles.setpop(tilePair.coordinate, tilePair.tile);
                        if (oldValue) {
                            this.clearTile(oldValue.value, oldValue.key);
                        }
                    }
                }
                this.receivedSynchronisedTiles = [];
                this.tileStream.next({tileCount, fileId, channel, stokes, flush: true});
            }
        } else {
            // Handle single tile, no sync required
            const textureCoordinate = this.textureCoordinateQueue.pop();
            const rasterTile: RasterTile = {
                width,
                height,
                textureCoordinate,
                data: decompressedData
            };
            if (layer < NUM_PERSISTENT_LAYERS) {
                this.persistentTiles.set(encodedCoordinate, rasterTile);
            } else {
                const oldValue = this.cachedTiles.setpop(encodedCoordinate, rasterTile);
                if (oldValue) {
                    this.clearTile(oldValue.value, oldValue.key);
                }
            }
            pendingCompressionMap.delete(encodedCoordinate);
            this.tileStream.next({tileCount: 1, fileId, channel, stokes, flush: false});
        }
    }
}
