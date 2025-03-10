import { CARTA } from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";

// import { RENDER3D_FILEID } from "stores";

export class Render3DDataStore {
    readonly fileId: number;
    readonly regionId: number;
    @observable datacube: Float32Array;

    constructor(fileId: number = 0, regionId: number = 0) {
        makeObservable(this);
        this.fileId = fileId;
        this.regionId = regionId;
        this.datacube = new Float32Array()
    }

    @action updateRender3DData = (datacube: CARTA.Render3DData) => {
        this.decompressRender3DData(datacube);
    }

    public decompressRender3DData(render3DData: CARTA.Render3DData) {
            const compressedArray = render3DData.imageData;
            // const nanEncodings32 = new Int32Array(render3DData.nanEncodings.slice(0).buffer);
            let compressedView = new Uint8Array(Math.max(compressedArray.byteLength, render3DData.width * render3DData.height * render3DData.depth * 4));
            compressedView.set(compressedArray);
    
            // const eventArgs = {
            //     fileId: RENDER3D_FILEID,
            //     channel: 0,
            //     stokes: 0,
            //     width: render3DData.width,
            //     depth: render3DData.depth,
            //     subsetHeight: render3DData.height,
            //     subsetLength: compressedArray.byteLength,
            //     compression: render3DData.compressionQuality,
            //     nanEncodings: nanEncodings32,
            //     tileCoordinate: 0,
            //     layer: 0,
            //     requestId: 0,
            //     viewerId: render3DData.viewerId
            // };
    
            console.log("Decompressing render3D data");
            // this.workers[0].postMessage(["render3d decompress", compressedView.buffer, eventArgs, render3DData], [compressedView.buffer, nanEncodings32.buffer]);
        }
    
    
}