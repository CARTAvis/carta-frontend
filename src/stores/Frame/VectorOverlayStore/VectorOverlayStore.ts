import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {VectorOverlayWebGLService} from "services";
import {createTextureFromArray, equalIfBothFinite} from "utilities";

import {FrameStore} from "../FrameStore";

export interface VectorOverlayTile {
    texture: WebGLTexture;
    numVertices: number;
}

export class VectorOverlayStore {
    @observable progress: number;
    @observable tiles: VectorOverlayTile[];
    @observable intensityMin: number;
    @observable intensityMax: number;

    private readonly gl: WebGL2RenderingContext;
    private readonly frame: FrameStore;

    constructor(frame: FrameStore) {
        makeObservable(this);
        this.gl = VectorOverlayWebGLService.Instance.gl;
        this.frame = frame;
        this.intensityMin = undefined;
        this.intensityMax = undefined;
    }

    @computed get isComplete() {
        return this.progress >= 1.0;
    }

    @action clearData = () => {
        if (this.gl && this.tiles) {
            for (const tile of this.tiles) {
                if (tile.texture) {
                    this.gl.deleteTexture(tile.texture);
                    tile.texture = undefined;
                }
            }
        }
        this.tiles = [];
        this.intensityMin = undefined;
        this.intensityMax = undefined;
    };

    @action setData = (intensityTiles: CARTA.ITileData[], angleTiles: CARTA.ITileData[], progress: number) => {
        this.clearData();
        this.addData(intensityTiles, angleTiles, progress);
    };

    @action addData = (intensityTiles: CARTA.ITileData[], angleTiles: CARTA.ITileData[], progress: number) => {
        this.progress = progress;

        let localMin = Number.MAX_VALUE;
        let localMax = -Number.MAX_VALUE;

        const numTiles = Math.max(intensityTiles.length, angleTiles.length);

        for (let i = 0; i < numTiles; i++) {
            let intensityTile = intensityTiles?.[i];
            let angleTile = angleTiles?.[i];
            if (!intensityTile?.imageData?.length) {
                intensityTile = undefined;
            }
            if (!angleTile?.imageData?.length) {
                angleTile = undefined;
            }

            // Skip sets where both tiles are empty
            if (!intensityTile && !angleTile) {
                continue;
            }

            // Skip sets with mismatching dimensions or coordinates
            if (!equalIfBothFinite(intensityTile?.width, angleTile?.width) || !equalIfBothFinite(intensityTile?.height, angleTile?.height)) {
                continue;
            }
            if (!equalIfBothFinite(intensityTile?.mip, angleTile?.mip) || !equalIfBothFinite(intensityTile?.x, angleTile?.x) || !equalIfBothFinite(intensityTile?.y, angleTile?.y)) {
                continue;
            }

            const tileWidth = Math.max(intensityTile?.width ?? 0, angleTile?.width ?? 0);
            const tileHeight = Math.max(intensityTile?.height ?? 0, angleTile?.height ?? 0);
            const tileMip = intensityTile?.mip ?? angleTile?.mip;
            const tileX = intensityTile?.x ?? angleTile?.x;
            const tileY = intensityTile?.y ?? angleTile?.y;

            // TODO: support compressed data and offload this to webassembly and a web worker
            let intensityData: Float32Array;
            let angleData: Float32Array;
            if (intensityTile?.imageData) {
                intensityData = new Float32Array(intensityTile.imageData.buffer.slice(intensityTile.imageData.byteOffset, intensityTile.imageData.byteOffset + intensityTile.imageData.byteLength));
            } else {
                intensityData = new Float32Array(tileWidth * tileHeight * 4);
            }
            if (angleTile?.imageData?.length) {
                angleData = new Float32Array(angleTile.imageData.buffer.slice(angleTile.imageData.byteOffset, angleTile.imageData.byteOffset + angleTile.imageData.byteLength));
            } else {
                angleData = new Float32Array(tileWidth * tileHeight * 4);
            }

            let vertexData = new Float32Array(tileWidth * tileHeight * 4);
            let numVertices = 0;
            // Vertex offsets: Tile offset + half of the block averaging size, and move to middle of the pixel;
            let offsetX = tileMip * (tileX * 256 + 0.5) - 0.5;
            let offsetY = tileMip * (tileY * 256 + 0.5) - 0.5;
            for (let j = 0; j < tileHeight; j++) {
                for (let i = 0; i < tileWidth; i++) {
                    const index = i + tileWidth * j;
                    const intensity = intensityData[index];
                    const angle = angleData[index];
                    if (isFinite(intensity) && isFinite(angle)) {
                        vertexData[numVertices * 4] = i * tileMip + offsetX;
                        vertexData[numVertices * 4 + 1] = j * tileMip + offsetY;
                        vertexData[numVertices * 4 + 2] = intensity;
                        vertexData[numVertices * 4 + 3] = angle;
                        numVertices++;
                        localMin = Math.min(localMin, intensity);
                        localMax = Math.max(localMax, intensity);
                    }
                }
            }
            // Resize vertex data before creating a texture
            vertexData = new Float32Array(vertexData.buffer, 0, numVertices * 4);
            const texture = createTextureFromArray(this.gl, vertexData, WebGLRenderingContext.TEXTURE0, 4);
            if (!this.tiles) {
                this.tiles = [];
            }
            this.tiles.push({
                texture,
                numVertices
            });
        }

        this.intensityMin = isFinite(this.intensityMin) ? Math.min(this.intensityMin, localMin) : localMin;
        this.intensityMax = isFinite(this.intensityMax) ? Math.max(this.intensityMax, localMax) : localMax;
    };
}
