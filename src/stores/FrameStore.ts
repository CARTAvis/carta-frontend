import {CARTA} from "carta-protobuf";
import {action, computed, observable} from "mobx";
import {OverlayStore} from "./OverlayStore";
import {Point2D} from "../models/Point2D";
import {Frame} from "plotly.js";

export enum FrameScaling {
    LINEAR = 0,
    LOG = 1,
    SQRT = 2,
    SQUARE = 3,
    POWER = 4,
    GAMMA = 5,
    EXP = 6,
    CUSTOM = 7
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

export class FrameRenderConfig {
    @observable scaling: FrameScaling;
    @observable colorMap: number;
    @observable scaleMin: number;
    @observable scaleMax: number;
    @observable contrast: number;
    @observable bias: number;
    @observable gamma: number;

    @action setColorMapIndex(index: number) {
        this.colorMap = Math.max(0, Math.min(index, FrameRenderConfig.COLOR_MAPS_ALL.length - 1));
    }

    @action setColorMap(colormap: string) {
        const index = FrameRenderConfig.COLOR_MAPS_ALL.indexOf(colormap);
        if (index >= 0) {
            this.setColorMapIndex(index);
        }
    }

    @computed get colorMapName() {
        if (this.colorMap > 0 && this.colorMap < FrameRenderConfig.COLOR_MAPS_ALL.length - 1) {
            return FrameRenderConfig.COLOR_MAPS_ALL[this.colorMap];
        }
        else {
            return "Unknown";
        }
    }

    @action setScaling(newScaling: FrameScaling) {
        if (FrameRenderConfig.SCALING_TYPES.has(newScaling)) {
            this.scaling = newScaling;
        }
    }

    @computed get scalingName() {
        const scalingType = FrameRenderConfig.SCALING_TYPES.get(this.scaling);
        if (scalingType) {
            return scalingType;
        }
        else {
            return "Unknown";
        }
    }

    static readonly SCALING_TYPES = new Map<FrameScaling, string>([
        [FrameScaling.LINEAR, "Linear"],
        [FrameScaling.LOG, "Log"],
        [FrameScaling.SQRT, "Square root"],
        [FrameScaling.SQUARE, "Squared"],
        [FrameScaling.GAMMA, "Gamma"]
    ]);

    static readonly COLOR_MAPS_ALL = ["accent", "afmhot", "autumn", "binary", "Blues", "bone", "BrBG", "brg", "BuGn", "BuPu", "bwr", "CMRmap", "cool", "coolwarm",
        "copper", "cubehelix", "dark2", "flag", "gist_earth", "gist_gray", "gist_heat", "gist_ncar", "gist_rainbow", "gist_stern", "gist_yarg",
        "GnBu", "gnuplot", "gnuplot2", "gray", "greens", "greys", "hot", "hsv", "inferno", "jet", "magma", "nipy_spectral", "ocean", "oranges",
        "OrRd", "paired", "pastel1", "pastel2", "pink", "PiYG", "plasma", "PRGn", "prism", "PuBu", "PuBuGn", "PuOr", "PuRd", "purples", "rainbow",
        "RdBu", "RdGy", "RdPu", "RdYlBu", "RdYlGn", "reds", "seismic", "set1", "set2", "set3", "spectral", "spring", "summer", "tab10", "tab20",
        "tab20b", "tab20c", "terrain", "viridis", "winter", "Wistia", "YlGn", "YlGnBu", "YlOrBr", "YlOrRd"];
}

export class FrameStore {
    @observable frameInfo: FrameInfo;
    @observable renderHiDPI: boolean;
    @observable wcsInfo: number;
    @observable validWcs: boolean;
    @observable center: Point2D;
    @observable centerY: number;
    @observable zoomLevel: number;
    @observable stokes;
    @observable channel;
    @observable requiredStokes;
    @observable requiredChannel;
    @observable currentFrameView: FrameView;
    @observable renderConfig: FrameRenderConfig;
    @observable rasterData: Float32Array;
    @observable overviewRasterData: Float32Array;
    @observable overviewRasterView: FrameView;
    @observable channelHistogram: CARTA.Histogram;
    @observable percentileRanks: Array<number>;
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
        this.percentileRanks = [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 25, 50, 75, 90, 95, 98, 99, 99.5, 99.9, 99.95, 99.99];

        this.renderConfig = new FrameRenderConfig();
        this.renderConfig.bias = 0;
        this.renderConfig.contrast = 1;
        this.renderConfig.gamma = 1;
        this.renderConfig.scaling = FrameScaling.LINEAR;
        this.renderConfig.colorMap = 1;
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

    @computed get percentiles(): Array<number> {
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
        return calculatedPercentiles;
    }

    @computed get histogramMin() {
        if (!this.channelHistogram) {
            return undefined;
        }
        return this.channelHistogram.firstBinCenter - 0.5 * this.channelHistogram.binWidth;
    }

    @computed get histogramMax() {
        if (!this.channelHistogram) {
            return undefined;
        }
        return this.channelHistogram.firstBinCenter + (this.channelHistogram.bins.length + 0.5) * this.channelHistogram.binWidth;
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

    @action setFromPercentileRank(rank: number) {
        // Find max and min if the rank is 100%
        if (rank === 100) {
            this.renderConfig.scaleMin = this.histogramMin;
            this.renderConfig.scaleMax = this.histogramMax;
            return true;
        }

        // Look for the appropriate percentile and its complement
        const indexRank = this.percentileRanks.findIndex(value => Math.abs(rank - value) < 1e-5);
        const indexRankComplement = this.percentileRanks.findIndex(value => Math.abs((100 - rank) - value) < 1e-5);
        if (indexRank === -1 || indexRankComplement === -1 || this.percentileRanks.length !== this.percentiles.length) {
            return false;
        }

        this.renderConfig.scaleMin = this.percentiles[indexRankComplement];
        this.renderConfig.scaleMax = this.percentiles[indexRank];
        return true;
    }

    @action updateChannelHistogram(histogram: CARTA.Histogram) {
        this.channelHistogram = histogram;
        // TODO: check if there is an existing (valid) histogram and set of percentiles, and use that by default
        const i = 3;
        if (this.percentiles.length > i * 2 && this.percentiles.length === this.percentileRanks.length) {
            this.renderConfig.scaleMin = this.percentiles[i];
            this.renderConfig.scaleMax = this.percentiles[this.percentiles.length - 1 - i];
        }
    }

    @action updateFromRasterData(rasterImageData: CARTA.RasterImageData) {
        this.stokes = rasterImageData.stokes;
        this.channel = rasterImageData.channel;

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
        const depth = this.frameInfo.fileInfoExtended.depth;
        const numStokes = this.frameInfo.fileInfoExtended.stokes;

        let newChannel = this.requiredChannel + deltaChannel;
        let newStokes = this.requiredStokes + deltaStokes;
        if (wrap) {
            newChannel = (newChannel + depth) % depth;
            newStokes = (newStokes + numStokes) % numStokes;
        }
        else {
            newChannel = Math.max(0, Math.min(depth - 1, newChannel));
            newStokes = Math.max(0, Math.min(numStokes - 1, newStokes));
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