import {Subject} from "rxjs";
import {CARTA} from "carta-protobuf";
import {Point2D, TileCoordinate} from "models";
import {BackendService} from "services";

export interface RasterTile {
    data: Float32Array;
    width: number;
    height: number;
    texture: WebGLTexture;
}

export class TileService {
    private readonly backendService: BackendService;
    private readonly cachedTiles: Map<number, RasterTile>;
    private readonly pendingRequests: Map<number, boolean>;
    private readonly tileStream: Subject<number>;

    public GetTileStream() {
        return this.tileStream;
    }

    constructor(backendService: BackendService) {
        this.backendService = backendService;
        this.cachedTiles = new Map<number, RasterTile>();
        this.pendingRequests = new Map<number, boolean>();

        this.tileStream = new Subject<number>();
        this.backendService.getRasterTileStream().subscribe(this.handleStreamedTiles);
    }

    getTile(tileCoordinateEncoded: number, fileId: number, channel: number, stokes: number) {
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
    }

    clearRequestQueue() {
        this.pendingRequests.clear();
    }

    private clearTile(tile: RasterTile) {
        if (tile.texture) {
            // TODO: prevent WebGL texture leaks and delete texture
            // gl.deleteTexture(tile.texture);
        }
    }

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
                if (!this.cachedTiles.has(encodedCoordinate)) {
                    const rasterTile: RasterTile = {
                        width: tile.width,
                        height: tile.height,
                        data: new Float32Array(tile.imageData.buffer.slice(tile.imageData.byteOffset, tile.imageData.byteOffset + tile.imageData.byteLength)),
                        texture: null // Textures are created on first render
                    };
                    this.cachedTiles.set(encodedCoordinate, rasterTile);
                    newTileCount++;
                }
            }
        }
        this.tileStream.next(newTileCount);
    };
}