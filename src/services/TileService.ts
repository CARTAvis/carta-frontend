import {Subject} from "rxjs";
import {observable} from "mobx";
import LRUCache from "mnemonist/lru-cache";
import {CARTA} from "carta-protobuf";
import {Point2D, TileCoordinate} from "models";
import {BackendService} from "services";

export interface RasterTile {
    data: Float32Array;
    width: number;
    height: number;
    texture: WebGLTexture;
}

export interface CompressedTile {
    tile: CARTA.ITileData;
    compressionQuality: number;
}

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
    private readonly tileStream: Subject<number>;
    private glContext: WebGLRenderingContext;
    private readonly workers: Worker[];
    private compressionRequestCounter: number;

    public GetTileStream() {
        return this.tileStream;
    }

    constructor(backendService: BackendService, numPersistentLayers: number = 4, lruCapacityGPU: number = 512, lruCapacitySystem: number = 2048) {
        this.backendService = backendService;

        // L1 cache: on GPU
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
            this.backendService.addRequiredTiles(fileId, sortedRequests, compressionQuality);
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
    }

    private clearTile = (tile: RasterTile, key: number) => {
        if (tile.texture && this.glContext) {
            this.glContext.deleteTexture(tile.texture);
        }
        if (tile.data) {
            delete tile.data;
        }
    };

    private handleStreamedTiles = (tileMessage: CARTA.IRasterTileData) => {
        if (tileMessage.compressionType !== CARTA.CompressionType.NONE && tileMessage.compressionType !== CARTA.CompressionType.ZFP) {
            console.error("Unsupported compression type");
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
                    this.cachedCompressedTiles.set(encodedCoordinate, {tile, compressionQuality: tileMessage.compressionQuality}, null);
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
        const rasterTile: RasterTile = {
            width,
            height,
            data: decompressedData,
            texture: null // Textures are created on first render
        };
        if (layer < this.numPersistentLayers) {
            this.persistentTiles.set(encodedCoordinate, rasterTile);
        } else {
            this.cachedTiles.set(encodedCoordinate, rasterTile, this.clearTile);
        }
        this.pendingDecompressions.delete(encodedCoordinate);
        this.gpuLruOccupancy = this.cachedTiles.size;
        this.persistentOccupancy = this.persistentTiles.size;
        this.tileStream.next(1);
    }
}