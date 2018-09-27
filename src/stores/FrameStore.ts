import {CARTA} from "carta-protobuf";
import {action, computed, observable} from "mobx";
import {OverlayStore} from "./OverlayStore";
import {RenderConfigStore} from "./RenderConfigStore";
import {Point2D} from "../models/Point2D";
import {clamp} from "../util/math";

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

export class FrameStore {
    @observable frameInfo: FrameInfo;
    @observable renderHiDPI: boolean;
    @observable wcsInfo: number;
    @observable validWcs: boolean;
    @observable center: Point2D;
    @observable centerY: number;
    @observable zoomLevel: number;
    @observable stokes: number;
    @observable channel: number;
    @observable requiredStokes: number;
    @observable requiredChannel: number;
    @observable currentFrameView: FrameView;
    @observable currentCompressionQuality: number;
    @observable renderConfig: RenderConfigStore;
    @observable rasterData: Float32Array;
    @observable overviewRasterData: Float32Array;
    @observable overviewRasterView: FrameView;
    @observable valid: boolean;

    private overlayStore: OverlayStore;

    constructor(overlay: OverlayStore) {
        this.overlayStore = overlay;
        this.renderHiDPI = false;
        this.center = {x: 0, y: 0};
        this.stokes = 0;
        this.channel = 0;
        this.requiredStokes = 0;
        this.requiredChannel = 0;
        this.renderConfig = new RenderConfigStore();
    }

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

        const pixelRatio = this.renderHiDPI ? devicePixelRatio : 1.0;
        // Required image dimensions
        const imageWidth = pixelRatio * this.renderWidth / this.zoomLevel;
        const imageHeight = pixelRatio * this.renderHeight / this.zoomLevel;

        const mipExact = Math.max(1.0, 1.0 / this.zoomLevel);
        const mipRounded = (mipExact % 1.0 < 0.25) ? Math.floor(mipExact) : Math.ceil(mipExact);

        const requiredView = {
            xMin: this.center.x - imageWidth / 2.0,
            xMax: this.center.x + imageWidth / 2.0,
            yMin: this.center.y - imageHeight / 2.0,
            yMax: this.center.y + imageHeight / 2.0,
            mip: mipRounded
        };
        return requiredView;
    }

    @computed get renderWidth() {
        return this.overlayStore.viewWidth - this.overlayStore.padding.left - this.overlayStore.padding.right;
    }

    @computed get renderHeight() {
        return this.overlayStore.viewHeight - this.overlayStore.padding.top - this.overlayStore.padding.bottom;
    }

    @computed get unit() {
        if (!this.frameInfo || !this.frameInfo.fileInfoExtended || !this.frameInfo.fileInfoExtended.headerEntries) {
            return undefined;
        }
        else {
            const unitHeader = this.frameInfo.fileInfoExtended.headerEntries.filter(entry => entry.name === "BUNIT");
            if (unitHeader.length) {
                return unitHeader[0].value;
            }
            else {
                return undefined;
            }
        }
    }

    @action updateFromRasterData(rasterImageData: CARTA.RasterImageData) {
        this.stokes = rasterImageData.stokes;
        this.channel = rasterImageData.channel;
        this.currentCompressionQuality = rasterImageData.compressionQuality;
        console.log(this.currentCompressionQuality);
        // if there's a valid channel histogram bundled into the message, update it
        if (rasterImageData.channelHistogramData) {
            // Update channel histograms
            if (rasterImageData.channelHistogramData.regionId === -1 && rasterImageData.channelHistogramData.histograms.length) {
                this.renderConfig.updateChannelHistogram(rasterImageData.channelHistogramData.histograms[0] as CARTA.Histogram);
            }
        }

        this.currentFrameView = {
            xMin: rasterImageData.imageBounds.xMin,
            xMax: rasterImageData.imageBounds.xMax,
            yMin: rasterImageData.imageBounds.yMin,
            yMax: rasterImageData.imageBounds.yMax,
            mip: rasterImageData.mip
        };

        const rawData = rasterImageData.imageData[0];
        // Don't need to copy buffer when dealing with compressed data
        if (rasterImageData.compressionType !== CARTA.CompressionType.NONE) {
            this.rasterData = new Float32Array(rawData.buffer);
        }
        else {
            this.rasterData = new Float32Array(rawData.buffer.slice(rawData.byteOffset, rawData.byteOffset + rawData.byteLength));
        }

        // Cache a copy of the approximate full image data
        if (rasterImageData.imageBounds.xMin === 0 && rasterImageData.imageBounds.yMin === 0
            && rasterImageData.imageBounds.xMax === this.frameInfo.fileInfoExtended.width
            && rasterImageData.imageBounds.yMax === this.frameInfo.fileInfoExtended.height) {
            this.overviewRasterData = this.rasterData.slice(0);
            this.overviewRasterView = {
                xMin: rasterImageData.imageBounds.xMin,
                xMax: rasterImageData.imageBounds.xMax,
                yMin: rasterImageData.imageBounds.yMin,
                yMax: rasterImageData.imageBounds.yMax,
                mip: rasterImageData.mip
            };
        }
    }

    @action setChannels(channel: number, stokes: number) {
        this.requiredChannel = channel;
        this.requiredStokes = stokes;
    }

    @action incrementChannels(deltaChannel: number, deltaStokes: number, wrap: boolean = true) {
        const depth = Math.max(1, this.frameInfo.fileInfoExtended.depth);
        const numStokes = Math.max(1, this.frameInfo.fileInfoExtended.stokes);

        let newChannel = this.requiredChannel + deltaChannel;
        let newStokes = this.requiredStokes + deltaStokes;
        if (wrap) {
            newChannel = (newChannel + depth) % depth;
            newStokes = (newStokes + numStokes) % numStokes;
        }
        else {
            newChannel = clamp(newChannel, 0, depth - 1);
            newStokes = clamp(newStokes, 0, numStokes - 1);
        }
        this.setChannels(newChannel, newStokes);
    }

    @action setZoom(zoom: number) {
        this.zoomLevel = zoom;
    }

    @action setCenter(x: number, y: number) {
        this.center = {x, y};
    }

    // Sets a new zoom level and pans to keep the given point fixed
    @action zoomToPoint(x: number, y: number, zoom: number) {
        const newCenter = {
            x: x + this.zoomLevel / zoom * (this.center.x - x),
            y: y + this.zoomLevel / zoom * (this.center.y - y)
        };
        this.zoomLevel = zoom;
        this.center = newCenter;
    }

    @action zoomToSelection(xMin: number, xMax: number, yMin: number, yMax: number) {

    }

    @action fitZoomX() {
        this.zoomLevel = this.calculateZoomX();
        this.center.x = this.frameInfo.fileInfoExtended.width / 2.0;
        this.center.y = this.frameInfo.fileInfoExtended.height / 2.0;
    }

    @action fitZoomY() {
        this.zoomLevel = this.calculateZoomY();
        this.center.x = this.frameInfo.fileInfoExtended.width / 2.0;
        this.center.y = this.frameInfo.fileInfoExtended.height / 2.0;
    }

    @action fitZoom() {
        const zoomX = this.calculateZoomX();
        const zoomY = this.calculateZoomY();
        this.zoomLevel = Math.min(zoomX, zoomY);
        this.center.x = this.frameInfo.fileInfoExtended.width / 2.0;
        this.center.y = this.frameInfo.fileInfoExtended.height / 2.0;
    }

    private calculateZoomX() {
        const imageWidth = this.frameInfo.fileInfoExtended.width;
        const pixelRatio = this.renderHiDPI ? devicePixelRatio : 1.0;

        if (imageWidth <= 0) {
            return 1.0;
        }
        return this.renderWidth * pixelRatio / imageWidth;
    }

    private calculateZoomY() {
        const imageHeight = this.frameInfo.fileInfoExtended.height;
        const pixelRatio = this.renderHiDPI ? devicePixelRatio : 1.0;
        if (imageHeight <= 0) {
            return 1.0;
        }
        return this.renderHeight * pixelRatio / imageHeight;
    }
}