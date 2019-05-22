import {Subject} from "rxjs";
import {observable} from "mobx";
import LRUCache from "mnemonist/lru-cache";
import {CARTA} from "carta-protobuf";
import * as ZFP from "zfp_wrapper";
import {Point2D, TileCoordinate} from "models";
import {BackendService} from "services";

export interface RasterTile {
    data: Float32Array;
    width: number;
    height: number;
    texture: WebGLTexture;
}

export class TileService {
    @observable lruOccupancy: number;
    @observable persistentOccupancy: number;

    private readonly backendService: BackendService;
    private readonly numPersistentLayers: number;
    private readonly persistentTiles: Map<number, RasterTile>;
    private readonly cachedTiles: LRUCache<number, RasterTile>;
    private readonly pendingRequests: Map<number, boolean>;
    private readonly tileStream: Subject<number>;
    private glContext: WebGLRenderingContext;

    public GetTileStream() {
        return this.tileStream;
    }

    constructor(backendService: BackendService, numPersistentLayers: number = 4, lruCapacity: number = 512) {
        this.backendService = backendService;
        this.cachedTiles = new LRUCache<number, RasterTile>(Int32Array, null, lruCapacity);
        this.persistentTiles = new Map<number, RasterTile>();
        this.pendingRequests = new Map<number, boolean>();
        this.numPersistentLayers = numPersistentLayers;
        this.lruOccupancy = 0;
        this.persistentOccupancy = 0;

        this.tileStream = new Subject<number>();
        this.backendService.getRasterTileStream().subscribe(this.handleStreamedTiles);

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
        const numTiles = tiles.length;
        const newRequests = new Array<TileCoordinate>();
        for (const tile of tiles) {
            const encodedCoordinate = tile.encode();
            if (!this.cachedTiles.has(encodedCoordinate) && !this.pendingRequests.has(encodedCoordinate)) {
                this.pendingRequests.set(encodedCoordinate, true);
                newRequests.push(tile);
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

    clearCache() {
        this.cachedTiles.forEach(this.clearTile);
        this.cachedTiles.clear();
        this.persistentTiles.forEach(this.clearTile);
        this.persistentTiles.clear();
        this.lruOccupancy = 0;
        this.persistentOccupancy = 0;
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

        let newTileCount = 0;
        for (let tile of tileMessage.tiles) {
            const encodedCoordinate = TileCoordinate.Encode(tile.x, tile.y, tile.layer);
            // Remove from the requested tile map
            if (this.pendingRequests.has(encodedCoordinate)) {
                this.pendingRequests.delete(encodedCoordinate);

                let data: Float32Array;

                if (tileMessage.compressionType === CARTA.CompressionType.NONE) {
                    data = new Float32Array(tile.imageData.buffer.slice(tile.imageData.byteOffset, tile.imageData.byteOffset + tile.imageData.byteLength));
                } else {
                    const tStart = performance.now();
                    const decompressedData = ZFP.zfpDecompressUint8WASM(tile.imageData, tile.imageData.length, tile.width, tile.height, tileMessage.compressionQuality);
                    // put NaNs back into data
                    let decodedIndex = 0;
                    let fillVal = false;
                    const nanEncodings = new Int32Array(tile.nanEncodings.slice().buffer);
                    const N = nanEncodings.length;
                    for (let i = 0; i < N; i++) {
                        const L = nanEncodings[i];
                        if (fillVal) {
                            decompressedData.fill(NaN, decodedIndex, decodedIndex + L);
                        }
                        fillVal = !fillVal;
                        decodedIndex += L;
                    }

                    data = decompressedData.slice();
                    const tStop = performance.now();
                    const dt = tStop - tStart;
                    console.log(`Decompressed ${tile.width}x${tile.height} ZFP tile in ${dt} ms`);
                }

                // Add a new tile if it doesn't already exist in the cache
                const rasterTile: RasterTile = {
                    width: tile.width,
                    height: tile.height,
                    data,
                    texture: null // Textures are created on first render
                };
                if (tile.layer < this.numPersistentLayers) {
                    this.persistentTiles.set(encodedCoordinate, rasterTile);
                } else {
                    this.cachedTiles.set(encodedCoordinate, rasterTile, this.clearTile);
                }
                newTileCount++;
            }
        }
        this.lruOccupancy = this.cachedTiles.size;
        this.persistentOccupancy = this.persistentTiles.size;
        this.tileStream.next(newTileCount);
    };
}