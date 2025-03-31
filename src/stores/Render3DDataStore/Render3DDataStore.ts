import { CARTA } from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";

import { TileService } from "services";

// import { RENDER3D_FILEID } from "stores";

export class Render3DDataStore {
    readonly fileId: number;
    readonly regionId: number;
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    @observable datacube: Float32Array;

    constructor(fileId: number = 0, regionId: number = 0, width: number = 0, height:number = 0, depth: number = 0) {
        makeObservable(this);
        this.fileId = fileId;
        this.regionId = regionId;
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.datacube = new Float32Array(height * width * depth);
    }

    @action updateRender3DData = (render3DData: CARTA.Render3DData) => {
        if (render3DData.compressionType === CARTA.CompressionType.NONE) {
            const decompressedData = new Float32Array(render3DData.imageData.buffer.slice(render3DData.imageData.byteOffset, render3DData.imageData.byteOffset + render3DData.imageData.byteLength));
            this.setDecompressed3DData(decompressedData, render3DData.slice);

        } else if (render3DData.compressionType === CARTA.CompressionType.ZFP) {
            TileService.Instance.decompressRender3DData(render3DData);
        }
    }

    @action setDecompressed3DData = (decompressedData: Float32Array, slice: number) => {
        this.datacube.set(decompressedData, this.width * this.height * slice);
    }
    
}