import { CARTA } from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";

import { TileService } from "services";

// import { RENDER3D_FILEID } from "stores";

export class Render3DDataStore {
    readonly fileId: number;
    readonly regionId: number;
    readonly viewerId: number;
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly datacube: Float32Array; // keep as readonly, the observable is lastslice. update lastslice when updating array. in component observe lastslice in usememo
    @observable lastSlice: number; // last slice updated, use to check if the data is updated

    constructor(fileId: number = 0, regionId: number = 0, viewerId: number, width: number = 0, height:number = 0, depth: number = 0) {
        makeObservable(this);
        this.fileId = fileId;
        this.regionId = regionId;
        this.viewerId = viewerId;
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.datacube = new Float32Array(height * width * depth);
        this.lastSlice = 0; // last slice updated, use to check if the data is updated
        
        // new variable last updated timestamp and usememo to check if timestamp changes
        // start and 0 and 
    }

    @action updateRender3DData = (render3DData: CARTA.Render3DData) => {
        if (render3DData.compressionType === CARTA.CompressionType.NONE) {
            const decompressedData = new Float32Array(render3DData.imageData.buffer.slice(render3DData.imageData.byteOffset, render3DData.imageData.byteOffset + render3DData.imageData.byteLength));
            this.setDecompressed3DData(decompressedData);

        } else if (render3DData.compressionType === CARTA.CompressionType.ZFP) {
            TileService.Instance.decompressRender3DData(render3DData);
        }
    }

    @action setDecompressed3DData = (decompressedData: Float32Array) => {
        // console.log("datacube length: ", this.datacube.length);
        // console.log("decompressedData length: ", decompressedData.length);
        // console.log("decompressedData sum: ", decompressedData.length * this.depth);
        // console.log("slice: ", slice);
        // console.log("width: ", this.width);
        // console.log("height: ", this.height);
        // console.log("depth: ", this.depth);
        this.datacube.set(decompressedData, this.width * this.height * this.lastSlice);
        // console.log("lastSlice: ", this.lastSlice);
        this.lastSlice += 1;
    }
    
}