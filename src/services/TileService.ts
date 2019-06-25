import {Subject} from "rxjs";
import {observable} from "mobx";
import LRUCache from "mnemonist/lru-cache";
import {CARTA} from "carta-protobuf";
import {Point2D, TileCoordinate} from "models";
import {BackendService} from "services";
import {copyToFP32Texture, createFP32Texture} from "../utilities";

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

export const TEXTURE_SIZE = 4096;
export const TILE_SIZE = 256;
export const MAX_TEXTURES = 8;

export class TileService {
    @observable gpuLruOccupancy: number;
    @observable systemLruOccupancy: number;
    @observable persistentOccupancy: number;

    private readonly backendService: BackendService;
    private readonly numPersistentLayers: number;
    private readonly persistentTiles: Map<number, RasterTile>;
    private readonly cachedTiles: LRUCache<number, RasterTile>;
    private readonly cachedCompressedTiles: LRUCache<number, CompressedTile>;
    private readonly pendingRequests: Map<number, boolean>;
    private readonly pendingDecompressions: Map<number, boolean>;
    private readonly channelMap: Map<number, { channel: number, stokes: number }>;
    private readonly tileStream: Subject<number>;
    private glContext: WebGLRenderingContext;
    private textureArray: Array<WebGLTexture>;
    private textureCoordinateQueue: Array<number>;
    private readonly workers: Worker[];
    private compressionRequestCounter: number;

    public GetTileStream() {
        return this.tileStream;
    }

    constructor(backendService: BackendService, numPersistentLayers: number = 4, lruCapacityGPU: number = 512, lruCapacitySystem: number = 4096) {
        this.backendService = backendService;
        this.channelMap = new Map<number, { channel: number, stokes: number }>();

        // TODO: calculate this properly
        const numPersistentTiles = 85;
        const totalTiles = lruCapacityGPU + numPersistentTiles;

        // L1 cache: on GPU
        const numTilesPerTexture = (TEXTURE_SIZE * TEXTURE_SIZE) / (TILE_SIZE * TILE_SIZE);
        const numTextures = Math.min(Math.ceil(totalTiles / numTilesPerTexture), MAX_TEXTURES);
        lruCapacityGPU = numTextures * numTilesPerTexture - numPersistentTiles;
        console.log(`lruGPU capacity rounded to : ${lruCapacityGPU}`);
        this.textureCoordinateQueue = new Array<number>(totalTiles);

        for (let i = 0; i < totalTiles; i++) {
            this.textureCoordinateQueue[i] = totalTiles - 1 - i;
        }

        this.textureArray = new Array<WebGLTexture>(numTextures);
        this.cachedTiles = new LRUCache<number, RasterTile>(Int32Array, null, lruCapacityGPU);
        this.persistentTiles = new Map<number, RasterTile>();
        this.pendingRequests = new Map<number, boolean>();
        this.numPersistentLayers = numPersistentLayers;

        // L2 cache: compressed tiles on system memory
        this.cachedCompressedTiles = new LRUCache<number, CompressedTile>(Int32Array, null, lruCapacitySystem);
        this.pendingDecompressions = new Map<number, boolean>();

        this.gpuLruOccupancy = 0;
        this.systemLruOccupancy = 0;
        this.persistentOccupancy = 0;
        this.compressionRequestCounter = 0;

        this.tileStream = new Subject<number>();
        this.backendService.getRasterTileStream().subscribe(this.handleStreamedTiles);

        const ZFPWorker = require("worker-loader!zfp_wrapper");
        this.workers = new Array<Worker>(Math.min(navigator.hardwareConcurrency || 4, 4));
        for (let i = 0; i < this.workers.length; i++) {
            this.workers[i] = new ZFPWorker();
            this.workers[i].onmessage = (event: MessageEvent) => {
                if (event.data[0] === "ready") {
                    console.log(`Tile Worker ${i} ready`);
                } else if (event.data[0] === "decompress") {
                    const buffer = event.data[1];
                    const eventArgs = event.data[2];
                    const length = eventArgs.width * eventArgs.subsetHeight;
                    const resultArray = new Float32Array(buffer, 0, length);
                    this.updateStream(resultArray, eventArgs.width, eventArgs.subsetHeight, eventArgs.layer, eventArgs.tileCoordinate);
                }
            };
        }
    }

    getTile(tileCoordinateEncoded: number, fileId: number, channel: number, stokes: number, peek: boolean = false) {
        const layer = TileCoordinate.GetLayer(tileCoordinateEncoded);
        if (layer < this.numPersistentLayers) {
            return this.persistentTiles.get(tileCoordinateEncoded);
        }
        if (peek) {
            return this.cachedTiles.peek(tileCoordinateEncoded);
        }
        return this.cachedTiles.get(tileCoordinateEncoded);
    }

    requestTiles(tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, focusPoint: Point2D, compressionQuality: number) {
        let setChannel = false;
        const currentChannels = this.channelMap.get(fileId);
        if (currentChannels) {
            setChannel = (channel !== currentChannels.channel || stokes !== currentChannels.stokes);
        } else {
            setChannel = true;
        }

        if (setChannel) {
            this.clearCache();
            this.clearRequestQueue();
            this.channelMap.set(fileId, {channel, stokes});
        }

        const newRequests = new Array<TileCoordinate>();
        for (const tile of tiles) {
            if (tile.layer < 0) {
                continue;
            }
            const encodedCoordinate = tile.encode();
            const tileCached = (tile.layer < this.numPersistentLayers && this.persistentTiles.has(encodedCoordinate))
                || (tile.layer >= this.numPersistentLayers && this.cachedTiles.has(encodedCoordinate));
            if (!tileCached && !this.pendingRequests.has(encodedCoordinate)) {
                const compressedTile = this.cachedCompressedTiles.get(encodedCoordinate);
                if (compressedTile && !this.pendingDecompressions.has(encodedCoordinate)) {
                    // Load from L2 cache instead
                    this.asyncDecompressTile(compressedTile.tile, compressedTile.compressionQuality, encodedCoordinate);
                } else if (!compressedTile) {
                    // Request from backend
                    this.pendingRequests.set(encodedCoordinate, true);
                    newRequests.push(tile);
                }
            }
        }

        if (newRequests.length) {
            // sort by distance to midpoint and encode
            const sortedRequests = newRequests.sort((a, b) => {
                const aX = focusPoint.x - a.x;
                const aY = focusPoint.y - a.y;
                const bX = focusPoint.x - b.x;
                const bY = focusPoint.y - b.y;
                return (aX * aX + aY * aY) - (bX * bX + bY * bY);
            }).map(tile => tile.encode());
            if (setChannel) {
                this.backendService.setChannels(fileId, channel, stokes, {fileId, compressionQuality, compressionType: CARTA.CompressionType.ZFP, tiles: sortedRequests});
            } else {
                this.backendService.addRequiredTiles(fileId, sortedRequests, compressionQuality);
            }
        }
    }

    clearCache(clearL2: boolean = true) {
        this.cachedTiles.forEach(this.clearTile);
        this.cachedTiles.clear();
        this.persistentTiles.forEach(this.clearTile);
        this.persistentTiles.clear();
        this.gpuLruOccupancy = 0;
        this.persistentOccupancy = 0;

        if (clearL2) {
            this.cachedCompressedTiles.clear();
            this.systemLruOccupancy = 0;
        }
    }

    clearRequestQueue() {
        this.pendingRequests.clear();
    }

    setContext(gl: WebGLRenderingContext) {
        this.glContext = gl;
        const textureSizeMb = TEXTURE_SIZE * TEXTURE_SIZE * 4 / 1024 / 1024;
        console.log(`Creating ${this.textureArray.length} tile textures of size ${textureSizeMb} MB each (${textureSizeMb * this.textureArray.length} MB total)`);
        for (let i = 0; i < this.textureArray.length; i++) {
            this.textureArray[i] = createFP32Texture(gl, TEXTURE_SIZE, TEXTURE_SIZE, WebGLRenderingContext.TEXTURE0);
        }
    }

    clearTextures() {
        if (this.glContext) {
            console.log(`Deleting ${this.textureArray.length} tile textures`);
            for (let i = 0; i < this.textureArray.length; i++) {
                this.glContext.deleteTexture(this.textureArray[i]);
            }
        }
    }

    uploadTileToGPU(tile: RasterTile) {
        if (this.glContext) {
            const numTilesPerTexture = (TEXTURE_SIZE * TEXTURE_SIZE) / (TILE_SIZE * TILE_SIZE);
            const localOffset = tile.textureCoordinate % numTilesPerTexture;
            const textureIndex = Math.floor((tile.textureCoordinate - localOffset) / numTilesPerTexture);
            const tilesPerRow = TEXTURE_SIZE / TILE_SIZE;
            const xOffset = (localOffset % tilesPerRow) * TILE_SIZE;
            const yOffset = Math.floor(localOffset / tilesPerRow) * TILE_SIZE;
            copyToFP32Texture(this.glContext, this.textureArray[textureIndex], tile.data, WebGLRenderingContext.TEXTURE0, tile.width, tile.height, xOffset, yOffset);
        }
    }

    getTileTextureParameters(tile: RasterTile) {
        if (this.glContext) {
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
        } else {
            return null;
        }
    }

    private clearTile = (tile: RasterTile, key: number) => {
        if (tile.data) {
            delete tile.data;
        }
        this.textureCoordinateQueue.push(tile.textureCoordinate);
    };

    private handleStreamedTiles = (tileMessage: CARTA.IRasterTileData) => {
        if (tileMessage.compressionType !== CARTA.CompressionType.NONE && tileMessage.compressionType !== CARTA.CompressionType.ZFP) {
            console.error("Unsupported compression type");
        }

        const currentChannels = this.channelMap.get(tileMessage.fileId);
        // Ignore stale tiles that don't match the currently required tiles
        if (!currentChannels || currentChannels.channel !== tileMessage.channel || currentChannels.stokes !== tileMessage.stokes) {
            return;
        }

        for (let tile of tileMessage.tiles) {
            const encodedCoordinate = TileCoordinate.Encode(tile.x, tile.y, tile.layer);
            // Remove from the requested tile map
            if (this.pendingRequests.has(encodedCoordinate)) {
                this.pendingRequests.delete(encodedCoordinate);

                if (tileMessage.compressionType === CARTA.CompressionType.NONE) {
                    const decompressedData = new Float32Array(tile.imageData.buffer.slice(tile.imageData.byteOffset, tile.imageData.byteOffset + tile.imageData.byteLength));
                    this.updateStream(decompressedData, tile.width, tile.height, tile.layer, encodedCoordinate);
                } else {
                    this.cachedCompressedTiles.set(encodedCoordinate, {tile, compressionQuality: tileMessage.compressionQuality});
                    this.asyncDecompressTile(tile, tileMessage.compressionQuality, encodedCoordinate);
                    this.systemLruOccupancy = this.cachedCompressedTiles.size;
                }
            }
        }
    };

    private asyncDecompressTile(tile: CARTA.ITileData, precision: number, tileCoordinate: number) {
        const compressedArray = tile.imageData;
        const workerIndex = this.compressionRequestCounter % this.workers.length;
        const nanEncodings32 = new Int32Array(tile.nanEncodings.slice(0).buffer);
        let compressedView = new Uint8Array(tile.width * tile.height * 4);
        compressedView.set(compressedArray);
        this.pendingDecompressions.set(tileCoordinate, true);
        this.workers[workerIndex].postMessage(["decompress", compressedView.buffer, {
                width: tile.width,
                subsetHeight: tile.height,
                subsetLength: compressedArray.byteLength,
                compression: precision,
                nanEncodings: nanEncodings32,
                tileCoordinate,
                layer: tile.layer,
                requestId: this.compressionRequestCounter
            }],
            [compressedView.buffer, nanEncodings32.buffer]);
        this.compressionRequestCounter++;
    }

    private updateStream(decompressedData: Float32Array, width: number, height: number, layer: number, encodedCoordinate: number) {
        const textureCoordinate = this.textureCoordinateQueue.pop();
        const rasterTile: RasterTile = {
            width,
            height,
            textureCoordinate,
            data: decompressedData,
        };
        if (layer < this.numPersistentLayers) {
            this.persistentTiles.set(encodedCoordinate, rasterTile);
        } else {
            this.cachedTiles.setWithCallback(encodedCoordinate, rasterTile, this.clearTile);
        }
        this.pendingDecompressions.delete(encodedCoordinate);
        this.gpuLruOccupancy = this.cachedTiles.size;
        this.persistentOccupancy = this.persistentTiles.size;
        this.tileStream.next(1);
    }
}