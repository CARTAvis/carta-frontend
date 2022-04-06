import {action, computed, makeObservable, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {VectorOverlayWebGLService} from "services";
import {FrameStore} from "./FrameStore";
import {createTextureFromArray} from "utilities";

export interface VectorOverlayTile {
    texture: WebGLTexture;
    numVertices: number;
}

export class VectorOverlayStore {
    @observable progress: number;
    @observable tiles: VectorOverlayTile[];
    private readonly gl: WebGL2RenderingContext;
    private readonly frame: FrameStore;

    constructor(frame: FrameStore) {
        makeObservable(this);
        this.gl = VectorOverlayWebGLService.Instance.gl;
        this.frame = frame;
    }

    @computed get isComplete() {
        return this.progress >= 1.0;
    }

    @action clearData = () => {
        if (this.gl && this.tiles) {
            for (const tile of this.tiles) {
                if (tile.texture) {
                    this.gl.deleteTexture(tile.texture);
                }
            }
        }
    };

    @action setData = (tiles: CARTA.ITileData[], progress: number) => {
        this.clearData();
        this.addData(tiles, progress);
    };

    @action addData = (tiles: CARTA.ITileData[], progress: number) => {
        this.progress = progress;

        for (const tile of tiles) {
            if (!tile.imageData) {
                continue;
            }
            // TODO: support compressed data and offload this to webassembly and a web worker
            const decompressedData = new Float32Array(tile.imageData.buffer.slice(tile.imageData.byteOffset, tile.imageData.byteOffset + tile.imageData.byteLength));
            // TODO: Support angle and intensity
            let vertexData = new Float32Array(tile.width * tile.height * 3);
            let numVertices = 0;
            // Vertex offsets: Tile offset + half of the block averaging size, and move to middle of the pixel;
            let offsetX = tile.mip * (tile.x * 256 + 0.5) - 0.5;
            let offsetY = tile.mip * (tile.y * 256 + 0.5) - 0.5;
            for (let j = 0; j < tile.height; j++) {
                for (let i = 0; i < tile.width; i++) {
                    const index = i + tile.width * j;
                    const val = decompressedData[index];
                    if (isFinite(val)) {
                        vertexData[numVertices * 3] = i * tile.mip + offsetX;
                        vertexData[numVertices * 3 + 1] = j * tile.mip + offsetY;
                        vertexData[numVertices * 3 + 2] = val;
                        numVertices++;
                    }
                }
            }
            // Resize vertex data before creating a texture
            vertexData = new Float32Array(vertexData.buffer, 0, numVertices * 3);
            const texture = createTextureFromArray(this.gl, vertexData, WebGLRenderingContext.TEXTURE0, 3);
            if (!this.tiles) {
                this.tiles = [];
            }
            this.tiles.push({
                texture,
                numVertices
            });
        }
    };
}
