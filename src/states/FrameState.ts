import {CARTA} from "carta-protobuf";
import {observable} from "mobx";

export enum FrameScaling {
    LINEAR = 0,
    LOG = 1,
    SQRT = 2,
    SQUARE = 3,
    POWER = 4,
    EXP = 5,
    CUSTOM = 6
}

export class FrameInfo {
    fileId: number;
    fileInfo: CARTA.FileInfo;
    fileInfoExtended: CARTA.FileInfoExtended;
    renderMode: CARTA.RenderMode;
}

export class FrameView {
    stokes: number;
    channel: number;
    imageBounds: {
        xMin: number;
        xMax: number;
        yMin: number;
        yMax: number;
    };
    mip: number;
}

export class FrameState {
    @observable frameInfo: FrameInfo;
    @observable requiredFrameView: FrameView;
    @observable currentFrameView: FrameView;
    @observable scaling: FrameScaling;
    @observable colorMap: number;
    @observable scaleMin: number;
    @observable scaleMax: number;
    @observable contrast: number;
    @observable bias: number;
    @observable rasterData: Float32Array;
}