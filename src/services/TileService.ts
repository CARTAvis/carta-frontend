import {Subject} from "rxjs";
import {CARTA} from "carta-protobuf";
import {Point2D, TileCoordinate} from "models";
import {BackendService} from "services";
import LRUCache from "mnemonist/lru-cache";
import {observable} from "mobx";

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

    requestTiles(tiles: TileCoordinate[], fileId: number, channel: number, stokes: number, focusPoint: Point2D) {
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
            this.backendService.addRequiredTiles(fileId, sortedRequests);
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
        if (tileMessage.compressionType !== CARTA.CompressionType.NONE) {
            console.error("Compressed tiles not yet implemented");
        }

        let newTileCount = 0;

        for (let tile of tileMessage.tiles) {
            const encodedCoordinate = TileCoordinate.Encode(tile.x, tile.y, tile.layer);
            // Remove from the requested tile map
            if (this.pendingRequests.has(encodedCoordinate)) {
                this.pendingRequests.delete(encodedCoordinate);

                // Add a new tile if it doesn't already exist in the cache
                const rasterTile: RasterTile = {
                    width: tile.width,
                    height: tile.height,
                    data: new Float32Array(tile.imageData.buffer.slice(tile.imageData.byteOffset, tile.imageData.byteOffset + tile.imageData.byteLength)),
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