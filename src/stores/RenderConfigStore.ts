import {action, computed, observable} from "mobx";
import {CARTA} from "../../protobuf/build";

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

export class RenderConfigStore {
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
    @observable scaling: FrameScaling;
    @observable colorMap: number;
    @observable scaleMin: number;
    @observable scaleMax: number;
    @observable contrast: number;
    @observable bias: number;
    @observable gamma: number;
    @observable channelHistogram: CARTA.Histogram;
    @observable selectedPercentile: number;

    @computed get colorMapName() {
        if (this.colorMap >= 0 && this.colorMap <= RenderConfigStore.COLOR_MAPS_ALL.length - 1) {
            return RenderConfigStore.COLOR_MAPS_ALL[this.colorMap];
        }
        else {
            return "Unknown";
        }
    }

    @computed get scalingName() {
        const scalingType = RenderConfigStore.SCALING_TYPES.get(this.scaling);
        if (scalingType) {
            return scalingType;
        }
        else {
            return "Unknown";
        }
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

    @action setPercentileRank(rank: number) {
        this.selectedPercentile = rank;
        // Find max and min if the rank is 100%
        if (rank === 100) {
            this.scaleMin = this.histogramMin;
            this.scaleMax = this.histogramMax;
            return true;
        }

        if (rank < 0 || rank > 100) {
            return false;
        }

        const rankComplement = 100 - rank;
        this.scaleMin = this.getPercentile(rankComplement);
        this.scaleMax = this.getPercentile(rank);
        return true;
    }

    @action updateChannelHistogram(histogram: CARTA.Histogram) {
        this.channelHistogram = histogram;
        if (this.selectedPercentile > 0) {
            this.setPercentileRank(this.selectedPercentile);
        }
    }

    @action setColorMapIndex(index: number) {
        this.colorMap = Math.max(0, Math.min(index, RenderConfigStore.COLOR_MAPS_ALL.length - 1));
    }

    @action setColorMap(colormap: string) {
        const index = RenderConfigStore.COLOR_MAPS_ALL.indexOf(colormap);
        if (index >= 0) {
            this.setColorMapIndex(index);
        }
    }

    @action setScaling(newScaling: FrameScaling) {
        if (RenderConfigStore.SCALING_TYPES.has(newScaling)) {
            this.scaling = newScaling;
        }
    }

    constructor() {
        this.selectedPercentile = 99.9;
        this.bias = 0;
        this.contrast = 1;
        this.gamma = 1;
        this.scaling = FrameScaling.LINEAR;
        this.setColorMap("inferno");
    }

    private getPercentile(rank: number): number {
        if (!this.channelHistogram || !this.channelHistogram.bins.length) {
            return undefined;
        }

        const minVal = this.channelHistogram.firstBinCenter - this.channelHistogram.binWidth / 2.0;
        const dx = this.channelHistogram.binWidth;
        const binVals = this.channelHistogram.bins;
        const fraction = rank / 100.0;
        let cumulativeSum = 0;

        let totalSum = 0;
        for (let i = 0; i < binVals.length; i++) {
            totalSum += binVals[i];
        }

        if (totalSum === 0) {
            return undefined;
        }

        for (let i = 0; i < binVals.length; i++) {
            const currentFraction = cumulativeSum / totalSum;
            const nextFraction = (cumulativeSum + binVals[i]) / totalSum;
            if (nextFraction >= fraction) {
                // Assumes a locally uniform distribution between bins
                const portion = (fraction - currentFraction) / (nextFraction - currentFraction);
                return minVal + dx * (i + portion);
            }
            cumulativeSum += binVals[i];
        }
        return undefined;
    }
}