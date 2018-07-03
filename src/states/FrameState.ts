import {CARTA} from "carta-protobuf";
import {action, computed, observable} from "mobx";

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
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    mip: number;
}

export class FrameState {
    @observable frameInfo: FrameInfo;
    @observable wcsInfo: number;
    @observable renderWidth: number;
    @observable renderHeight: number;
    @observable centerX: number;
    @observable centerY: number;
    @observable zoomLevel: number;
    @observable stokes;
    @observable channel;
    @observable currentFrameView: FrameView;
    @observable scaling: FrameScaling;
    @observable colorMap: number;
    @observable scaleMin: number;
    @observable scaleMax: number;
    @observable contrast: number;
    @observable bias: number;
    @observable rasterData: Float32Array;
    @observable valid: boolean;

    @computed get requiredFrameView(): FrameView {
        // If there isn't a valid zoom, return a dummy view
        if (this.zoomLevel <= 0 || this.renderWidth <= 0 || this.renderHeight <= 0) {
            return {
                xMin: 0,
                xMax: 1,
                yMin: 0,
                yMax: 1,
                mip: 1,
            };
        }

        // Required image dimensions
        const imageWidth = this.renderWidth / this.zoomLevel;
        const imageHeight = this.renderHeight / this.zoomLevel;

        const mipExact = Math.max(1.0, 1.0 / this.zoomLevel);
        const mipRounded = (mipExact % 1.0 < 0.25) ? Math.floor(mipExact) : Math.ceil(mipExact);

        const requiredView = {
            xMin: this.centerX - imageWidth / 2.0,
            xMax: this.centerX + imageWidth / 2.0,
            yMin: this.centerY - imageHeight / 2.0,
            yMax: this.centerY + imageHeight / 2.0,
            mip: mipRounded
        };
        return requiredView;
    }

    @action setDimensions(w: number, h: number) {
        this.renderWidth = w;
        this.renderHeight = h;
    }

    @action setZoom(zoom: number) {
        this.zoomLevel = zoom;
    }

    @action setCenter(x: number, y: number) {
        this.centerX = x;
        this.centerY = y;
    }

    @action zoomToPoint(x: number, y: number, zoom: number) {

    }

    @action fitZoomX() {
        this.zoomLevel = this.calculateZoomX();
        this.centerX = this.frameInfo.fileInfoExtended.width / 2.0;
        this.centerY = this.frameInfo.fileInfoExtended.height / 2.0;
    }

    @action fitZoomY() {
        this.zoomLevel = this.calculateZoomY();
        this.centerX = this.frameInfo.fileInfoExtended.width / 2.0;
        this.centerY = this.frameInfo.fileInfoExtended.height / 2.0;
    }

    @action fitZoom() {
        const zoomX = this.calculateZoomX();
        const zoomY = this.calculateZoomY();
        this.zoomLevel = Math.min(zoomX, zoomY);
        this.centerX = this.frameInfo.fileInfoExtended.width / 2.0;
        this.centerY = this.frameInfo.fileInfoExtended.height / 2.0;
    }

    private calculateZoomX() {
        const imageWidth = this.frameInfo.fileInfoExtended.width;
        if (imageWidth <= 0) {
            return 1.0;
        }
        return this.renderWidth / imageWidth;
    }

    private calculateZoomY() {
        const imageHeight = this.frameInfo.fileInfoExtended.height;
        if (imageHeight <= 0) {
            return 1.0;
        }
        return this.renderHeight / imageHeight;
    }

}