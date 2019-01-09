import {action, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {clamp} from "utilities";

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
        [FrameScaling.GAMMA, "Gamma"],
        [FrameScaling.POWER, "Power"]
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
    @observable alpha: number;
    @observable channelHistogram: CARTA.Histogram;
    @observable cubeHistogram: CARTA.Histogram;
    @observable useCubeHistogram: boolean;
    @observable cubeHistogramProgress: number;
    @observable selectedPercentile: number;

    constructor() {
        this.selectedPercentile = 99.9;
        this.bias = 0;
        this.contrast = 1;
        this.gamma = 1;
        this.alpha = 1000;
        this.scaling = FrameScaling.LINEAR;
        this.cubeHistogramProgress = 0;
        this.setColorMap("inferno");
    }

    @computed get colorMapName() {
        if (this.colorMap >= 0 && this.colorMap <= RenderConfigStore.COLOR_MAPS_ALL.length - 1) {
            return RenderConfigStore.COLOR_MAPS_ALL[this.colorMap];
        } else {
            return "Unknown";
        }
    }

    @computed get scalingName() {
        const scalingType = RenderConfigStore.SCALING_TYPES.get(this.scaling);
        if (scalingType) {
            return scalingType;
        } else {
            return "Unknown";
        }
    }

    @computed get histogram() {
        if (this.useCubeHistogram && this.cubeHistogram) {
            return this.cubeHistogram;
        } else {
            return this.channelHistogram;
        }
    }

    @action setUseCubeHistogram = (val: boolean) => {
        if (val !== this.useCubeHistogram) {
            this.useCubeHistogram = val;
            if (this.selectedPercentile > 0) {
                this.setPercentileRank(this.selectedPercentile);
            }
        }
    };

    @computed get histogramMin() {
        if (!this.histogram) {
            return undefined;
        }
        return this.histogram.firstBinCenter - 0.5 * this.histogram.binWidth;
    }

    @computed get histogramMax() {
        if (!this.histogram) {
            return undefined;
        }
        return this.histogram.firstBinCenter + (this.histogram.bins.length + 0.5) * this.histogram.binWidth;
    }

    @action setPercentileRank = (rank: number) => {
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
        const percentiles = this.getPercentiles([rankComplement, rank]);
        if (percentiles.length === 2) {
            this.scaleMin = percentiles[0];
            this.scaleMax = percentiles[1];
            return true;
        } else {
            return false;
        }
    };

    @action updateChannelHistogram = (histogram: CARTA.Histogram) => {
        this.channelHistogram = histogram;
        if (this.selectedPercentile > 0 && !this.useCubeHistogram) {
            this.setPercentileRank(this.selectedPercentile);
        }
    };

    @action updateCubeHistogram = (histogram: CARTA.Histogram, progress: number) => {
        this.cubeHistogram = histogram;
        this.cubeHistogramProgress = progress;
        if (this.selectedPercentile > 0 && this.useCubeHistogram) {
            this.setPercentileRank(this.selectedPercentile);
        }
    };

    @action setCustomScale = (minVal: number, maxVal: number) => {
        this.scaleMin = minVal;
        this.scaleMax = maxVal;
        this.selectedPercentile = -1;
    };

    @action setColorMapIndex = (index: number) => {
        this.colorMap = clamp(index, 0, RenderConfigStore.COLOR_MAPS_ALL.length - 1);
    };

    @action setColorMap = (colormap: string) => {
        const index = RenderConfigStore.COLOR_MAPS_ALL.indexOf(colormap);
        if (index >= 0) {
            this.setColorMapIndex(index);
        }
    };

    @action setScaling = (newScaling: FrameScaling) => {
        if (RenderConfigStore.SCALING_TYPES.has(newScaling)) {
            this.scaling = newScaling;
        }
    };

    @action setGamma = (gamma: number) => {
        this.gamma = gamma;
    };

    @action setAlpha = (alpha: number) => {
        this.alpha = alpha;
    };

    private getPercentiles(ranks: number[]): number[] {
        if (!ranks || !ranks.length || !this.histogram || !this.histogram.bins.length) {
            return [];
        }

        const minVal = this.histogram.firstBinCenter - this.histogram.binWidth / 2.0;
        const dx = this.histogram.binWidth;
        const vals = this.histogram.bins;
        let remainingRanks = ranks.slice();
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
}