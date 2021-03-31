import {action, computed, observable, makeObservable} from "mobx";
import {FrameStore, PreferenceStore} from "stores";
import {CARTA} from "carta-protobuf";
import {clamp, getPercentiles} from "utilities";

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

    static readonly COLOR_MAPS_ALL = [
        "accent", "afmhot", "autumn", "binary", "Blues",
        "bone", "BrBG", "brg", "BuGn", "BuPu",
        "bwr", "CMRmap", "cool", "coolwarm", "copper",
        "cubehelix", "dark2", "flag", "gist_earth", "gist_gray",
        "gist_heat", "gist_ncar", "gist_rainbow", "gist_stern", "gist_yarg",
        "GnBu", "gnuplot", "gnuplot2", "gray", "greens",
        "greys", "hot", "hsv", "inferno", "jet",
        "magma", "nipy_spectral", "ocean", "oranges", "OrRd",
        "paired", "pastel1", "pastel2", "pink", "PiYG",
        "plasma", "PRGn", "prism", "PuBu", "PuBuGn",
        "PuOr", "PuRd", "purples", "rainbow", "RdBu",
        "RdGy", "RdPu", "RdYlBu", "RdYlGn", "reds",
        "seismic", "set1", "set2", "set3", "spectral",
        "spring", "summer", "tab10", "tab20", "tab20b",
        "tab20c", "terrain", "viridis", "winter", "Wistia",
        "YlGn", "YlGnBu", "YlOrBr", "YlOrRd"
    ];
    static readonly COLOR_MAPS_SELECTED = [
        "afmhot", "Blues", "coolwarm", "cubehelix", "gist_heat",
        "gist_stern", "gnuplot", "gnuplot2", "gray", "greens",
        "greys", "hot", "inferno", "jet", "magma",
        "nipy_spectral", "plasma", "rainbow", "RdBu", "RdGy",
        "reds", "seismic", "spectral", "tab10", "viridis"
    ];

    static readonly PERCENTILE_RANKS = [90, 95, 99, 99.5, 99.9, 99.95, 99.99, 100];

    static readonly GAMMA_MIN = 0;
    static readonly GAMMA_MAX = 2;
    static readonly BIAS_MIN = -1;
    static readonly BIAS_MAX = 1;
    static readonly CONTRAST_MIN = 0;
    static readonly CONTRAST_MAX = 2;

    @observable scaling: FrameScaling;
    @observable colorMapIndex: number;
    @observable contrast: number;
    @observable bias: number;
    @observable gamma: number;
    @observable alpha: number;
    @observable inverted: boolean;
    @observable channelHistogram: CARTA.IHistogram;
    @observable cubeHistogram: CARTA.IHistogram;
    @observable useCubeHistogram: boolean;
    @observable useCubeHistogramContours: boolean;
    @observable cubeHistogramProgress: number;
    @observable selectedPercentile: number[];
    @observable stokes: number;
    @observable scaleMin: number[];
    @observable scaleMax: number[];
    @observable visible: boolean;

    private frame: FrameStore;

    constructor(readonly preference: PreferenceStore, frame: FrameStore) {
        makeObservable(this);
        this.frame = frame;
        const percentile = preference.percentile;
        this.selectedPercentile = [percentile, percentile, percentile, percentile];
        this.bias = 0;
        this.contrast = 1;
        this.alpha = preference.scalingAlpha;
        this.gamma = preference.scalingGamma;
        this.scaling = preference.scaling;
        this.inverted = false;
        this.cubeHistogramProgress = 0;
        this.setColorMap(preference.colormap);
        this.stokes = 0;
        this.scaleMin = [0, 0, 0, 0];
        this.scaleMax = [1, 1, 1, 1];
        this.visible = true;
    }

    public static IsScalingValid(scaling: FrameScaling): boolean {
        return RenderConfigStore.SCALING_TYPES.has(scaling);
    }

    public static IsGammaValid(gamma: number): boolean {
        return gamma >= RenderConfigStore.GAMMA_MIN && gamma <= RenderConfigStore.GAMMA_MAX;
    }

    public static IsColormapValid(colormap: string): boolean {
        return RenderConfigStore.COLOR_MAPS_SELECTED.includes(colormap);
    }

    public static IsPercentileValid(percentile: number): boolean {
        return RenderConfigStore.PERCENTILE_RANKS.includes(percentile);
    }

    @computed get colorMap() {
        if (this.colorMapIndex >= 0 && this.colorMapIndex <= RenderConfigStore.COLOR_MAPS_ALL.length - 1) {
            return RenderConfigStore.COLOR_MAPS_ALL[this.colorMapIndex];
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

    @computed get contourHistogram() {
        if (this.useCubeHistogramContours && this.cubeHistogram) {
            return this.cubeHistogram;
        } else {
            return this.channelHistogram;
        }
    }

    @computed get scaleMinVal() {
        return this.scaleMin[this.stokes];
    }

    @computed get scaleMaxVal() {
        return this.scaleMax[this.stokes];
    }

    @computed get selectedPercentileVal() {
        return this.selectedPercentile[this.stokes];
    }

    @action setStokes = (val: number) => {
        this.stokes = val;
    };

    @action setUseCubeHistogram = (val: boolean) => {
        if (val !== this.useCubeHistogram) {
            this.useCubeHistogram = val;
            if (this.selectedPercentile[this.stokes] > 0) {
                this.setPercentileRank(this.selectedPercentile[this.stokes]);
            }
        }
    };

    @action setUseCubeHistogramContours = (val: boolean) => {
        this.useCubeHistogramContours = val;
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
        this.selectedPercentile[this.stokes] = rank;
        // Find max and min if the rank is 100%
        if (rank === 100) {
            this.scaleMin[this.stokes] = this.histogramMin;
            this.scaleMax[this.stokes] = this.histogramMax;
            this.updateSiblings();
            return true;
        }

        if (rank < 0 || rank > 100) {
            return false;
        }

        const rankComplement = 100 - rank;
        const percentiles = getPercentiles(this.histogram, [rankComplement, rank]);
        if (percentiles.length === 2) {
            this.scaleMin[this.stokes] = percentiles[0];
            this.scaleMax[this.stokes] = percentiles[1];
            this.updateSiblings();
            return true;
        } else {
            return false;
        }
    };

    @action updateChannelHistogram = (histogram: CARTA.IHistogram) => {
        this.channelHistogram = histogram;
        if (this.selectedPercentile[this.stokes] > 0 && !this.useCubeHistogram) {
            this.setPercentileRank(this.selectedPercentile[this.stokes]);
        }
    };

    @action updateCubeHistogram = (histogram: CARTA.IHistogram, progress: number) => {
        this.cubeHistogram = histogram;
        this.cubeHistogramProgress = progress;
        if (this.selectedPercentile[this.stokes] > 0 && this.useCubeHistogram) {
            this.setPercentileRank(this.selectedPercentile[this.stokes]);
        }
    };

    @action setCustomScale = (minVal: number, maxVal: number) => {
        this.scaleMin[this.stokes] = minVal;
        this.scaleMax[this.stokes] = maxVal;
        this.selectedPercentile[this.stokes] = -1;
        this.updateSiblings();
    };

    @action setColorMapIndex = (index: number) => {
        this.colorMapIndex = clamp(index, 0, RenderConfigStore.COLOR_MAPS_ALL.length - 1);
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
            this.updateSiblings();
        }
    };

    @action setGamma = (gamma: number) => {
        this.gamma = gamma;
        this.updateSiblings();
    };

    @action setAlpha = (alpha: number) => {
        this.alpha = alpha;
        this.updateSiblings();
    };

    @action setBias = (bias: number) => {
        this.bias = bias;
    }

    @action setContrast = (contrast: number) => {
        this.contrast = contrast;
    }

    @action setInverted = (inverted: boolean) => {
        this.inverted = inverted;
    };

    @action setVisible = (visible: boolean) => {
        this.visible = visible;
    };

    @action toggleVisibility = () => {
        this.visible = !this.visible;
    };

    @action updateSiblings = () => {
        const siblings = this.frame?.renderConfigSiblings;
        for (const frame of siblings) {
            frame.renderConfig.updateFrom(this);
        }
    }

    @action updateFrom = (other: RenderConfigStore) => {
        this.scaling = other.scaling;
        this.alpha = other.alpha;
        this.gamma = other.gamma;
        this.bias = other.bias;
        this.contrast = other.contrast;
        this.scaleMin[this.stokes] = other.scaleMinVal;
        this.scaleMax[this.stokes] = other.scaleMaxVal;
        this.selectedPercentile[this.stokes] = -1;
    }
}