import {CARTA} from "carta-protobuf";
import {action, computed, observable} from "mobx";
import {OverlayState} from "./OverlayState";
import {Point2D} from "../models/Point2D";

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
    @observable center: Point2D;
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
    @observable channelHistogram: CARTA.Histogram;
    @observable percentileRanks: Array<number>;
    @observable valid: boolean;
    private overlayState: OverlayState;

    constructor(overlay: OverlayState) {
        this.overlayState = overlay;
        this.center = {x: 0, y: 0};
        this.stokes = 0;
        this.channel = 0;
        this.bias = 0;
        this.contrast = 1;
        this.scaling = FrameScaling.LINEAR;
        this.colorMap = 1;
        this.percentileRanks = [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 25, 50, 75, 90, 95, 98, 99, 99.5, 99.9, 99.95, 99.99];
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

        // Required image dimensions
        const imageWidth = this.renderWidth / this.zoomLevel;
        const imageHeight = this.renderHeight / this.zoomLevel;

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
        return this.overlayState.viewWidth - this.overlayState.padding.left - this.overlayState.padding.right;
    }

    @computed get renderHeight() {
        return this.overlayState.viewHeight - this.overlayState.padding.top - this.overlayState.padding.bottom;
    }

    @computed get percentiles(): Array<number> {
        const t0 = performance.now();

        if (!this.percentileRanks || !this.percentileRanks || !this.channelHistogram || !this.channelHistogram.bins.length) {
            return [];
        }

        const minVal = this.channelHistogram.firstBinCenter - this.channelHistogram.binWidth / 2.0;
        const dx = this.channelHistogram.binWidth;
        const vals = this.channelHistogram.bins;
        let remainingRanks = this.percentileRanks.slice();
        let cumulativeSum = 0;

        let totalSum = 0;
        for (let i = 0; i < vals.length; i++) {
            totalSum += vals[i];
        }

        if (totalSum === 0) {
            return [];
        }

        let calculatedPercentiles = [];

        for (let i = 0; i < vals.length && remainingRanks.length; i++) {
            const currentFraction = cumulativeSum / totalSum;
            const nextFraction = (cumulativeSum + vals[i]) / totalSum;
            let nextRank = remainingRanks[0] / 100.0;
            while (nextFraction >= nextRank && remainingRanks.length) {
                // Assumes a locally uniform distribution between bins
                const portion = (nextRank - currentFraction) / (nextFraction - currentFraction);
                calculatedPercentiles.push(minVal + dx * (i + portion));
                // Move to next rank
                remainingRanks.shift();
                nextRank = remainingRanks[0] / 100.0;
            }
            cumulativeSum += vals[i];
        }
        const t1 = performance.now();
        console.log(`${calculatedPercentiles.length} approximate percentiles calculated from ${vals.length} elements in ${t1 - t0} ms`);
        return calculatedPercentiles;
    }

    @action updateChannelHistogram(histogram: CARTA.Histogram) {
        this.channelHistogram = histogram;
        const i = 3;
        if (this.percentiles.length > i * 2 && this.percentiles.length === this.percentileRanks.length) {
            this.scaleMin = this.percentiles[i];
            this.scaleMax = this.percentiles[this.percentiles.length - 1 - i];
            console.log(`Using approximate percentile for P=${this.percentileRanks[i]} to P=${this.percentileRanks[this.percentileRanks.length - 1 - i]}`);
            console.log(`Scale: ${this.percentiles[i]} -> ${this.percentiles[this.percentiles.length - 1 - i]}`);
        }
    }

    @action updateFromRasterData(rasterImageData: CARTA.RasterImageData) {
        this.currentFrameView = {
            xMin: rasterImageData.imageBounds.xMin,
            xMax: rasterImageData.imageBounds.xMax,
            yMin: rasterImageData.imageBounds.yMin,
            yMax: rasterImageData.imageBounds.yMax,
            mip: rasterImageData.mip
        };

        const rawData = rasterImageData.imageData[0];
        this.rasterData = new Float32Array(rawData.buffer.slice(rawData.byteOffset, rawData.byteOffset + rawData.byteLength));
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