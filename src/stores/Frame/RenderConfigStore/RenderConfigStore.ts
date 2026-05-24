import {type CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";
import type {WorkspaceRenderConfig} from "models";

import {FrameScaling} from "enums";
import {AppStore, type PreferenceStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {clamp, COLOR_MAPS_ALL, COLOR_MAPS_MONO, COLOR_MAPS_SELECTED, getColorsForValues, getColorsFromHex, getPercentiles, scaleValueInverse} from "utilities";

export class RenderConfigStore {
    public static readonly SCALING_TYPES = new Map<FrameScaling, string>([
        [FrameScaling.LINEAR, "Linear"],
        [FrameScaling.LOG, "Log"],
        [FrameScaling.SQRT, "Square root"],
        [FrameScaling.SQUARE, "Squared"],
        [FrameScaling.GAMMA, "Gamma"],
        [FrameScaling.POWER, "Power"]
    ]);

    public static readonly CUSTOM_COLOR_MAP_INDEX = -1;
    public static readonly COLOR_MAPS_CUSTOM = "custom";
    public static readonly COLOR_MAPS_PANEL = "color_panel";

    public static readonly PERCENTILE_RANKS = [90, 95, 99, 99.5, 99.9, 99.95, 99.99, 100];

    public static readonly GAMMA_MIN = 0.1;
    public static readonly GAMMA_MAX = 2;
    public static readonly ALPHA_MIN = 0.1;
    public static readonly ALPHA_MAX = 1000000;
    public static readonly BIAS_MIN = -1;
    public static readonly BIAS_MAX = 1;
    public static readonly CONTRAST_MIN = 0;
    public static readonly CONTRAST_MAX = 2;

    @observable scaling: FrameScaling;
    @observable colorMapIndex: number = 0;
    @observable bias: number = 0;
    @observable contrast: number = 1;
    @observable gamma: number;
    @observable alpha: number;
    @observable inverted: boolean = false;
    @observable channelHistogram: CARTA.IHistogram = undefined as any;
    @observable cubeHistogram: CARTA.IHistogram | null = null;
    @observable useCubeHistogram: boolean = false;
    @observable useCubeHistogramContours: boolean = false;
    @observable cubeHistogramProgress: number = 0;
    @observable selectedPercentile: number[];
    @observable histChannel: number = 0;
    @observable stokesIndex: number = 0;
    @observable scaleMin: number[];
    @observable scaleMax: number[];
    @observable visible: boolean = true;
    @observable previewHistogramMax: number | null = null;
    @observable previewHistogramMin: number | null = null;
    @observable customColormapHexEnd: string;
    @observable customColormapHexStart: string;

    private frame: FrameStore;

    constructor(
        readonly preference: PreferenceStore,
        frame: FrameStore
    ) {
        this.frame = frame;
        const stokesLength = this.frame.polarizations.length !== 0 ? this.frame.polarizations.length : 1;
        const percentile = preference.percentile;
        this.selectedPercentile = new Array<number>(stokesLength).fill(percentile);
        this.alpha = preference.scalingAlpha;
        this.gamma = preference.scalingGamma;
        this.scaling = preference.scaling;
        this.setColorMap(preference.colormap);
        this.scaleMin = new Array<number>(stokesLength).fill(0);
        this.scaleMax = new Array<number>(stokesLength).fill(1);
        this.customColormapHexEnd = preference.colormapHex;
        this.customColormapHexStart = preference.colormapHexStart;
        makeObservable(this);
    }

    public static isScalingValid(scaling: FrameScaling): boolean {
        return RenderConfigStore.SCALING_TYPES.has(scaling);
    }

    public static isGammaValid(gamma: number): boolean {
        return gamma >= RenderConfigStore.GAMMA_MIN && gamma <= RenderConfigStore.GAMMA_MAX;
    }

    public static isColormapValid(colormap: string): boolean {
        return COLOR_MAPS_SELECTED.includes(colormap);
    }

    public static isPercentileValid(percentile: number): boolean {
        return RenderConfigStore.PERCENTILE_RANKS.includes(percentile);
    }

    @computed get colorMap() {
        if (this.colorMapIndex >= 0 && this.colorMapIndex < COLOR_MAPS_ALL.length) {
            return COLOR_MAPS_ALL[this.colorMapIndex];
        } else if (this.colorMapIndex === RenderConfigStore.CUSTOM_COLOR_MAP_INDEX) {
            return RenderConfigStore.COLOR_MAPS_CUSTOM;
        } else {
            return "Unknown";
        }
    }

    @computed get customColorGradient() {
        return getColorsFromHex(this.customColormapHexEnd, this.customColormapHexStart);
    }

    @computed get colorscaleArray() {
        let colorsForValues: {color: Uint8ClampedArray; size: number} | undefined;
        if (this.colorMapIndex === RenderConfigStore.CUSTOM_COLOR_MAP_INDEX) {
            colorsForValues = this.customColorGradient;
        } else if (this.colorMapIndex >= 79 && this.colorMapIndex < COLOR_MAPS_ALL.length) {
            const monoColorHex = this.monoColormapHex;
            if (monoColorHex) {
                colorsForValues = getColorsFromHex(monoColorHex);
            }
        } else if (this.colorMapIndex >= 0) {
            colorsForValues = getColorsForValues(this.colorMap);
        }
        if (!colorsForValues) {
            return [];
        }
        const indexArray = Array.from(Array(colorsForValues.size).keys()).map(x => (this.inverted ? 1 - x / colorsForValues.size : x / colorsForValues.size));
        const scaledArray = indexArray.map(x => 1.0 - scaleValueInverse(x, this.scaling, this.alpha, this.gamma, this.bias, this.contrast, AppStore.Instance?.preferenceStore?.useSmoothedBiasContrast));
        const rbgString = (index: number): string => `rgb(${colorsForValues!.color[index * 4]}, ${colorsForValues!.color[index * 4 + 1]}, ${colorsForValues!.color[index * 4 + 2]}, ${colorsForValues!.color[index * 4 + 3]})`;

        // Fix: Explicitly type colorscale as (number | string)[]
        const colorscale: (number | string)[] = [];
        if (this.contrast === 0) {
            for (let i = 0; i < colorsForValues.size; i++) {
                if (scaledArray[i] === (this.inverted ? 1 : 0)) {
                    return [0, rbgString(i), 1, rbgString(i)];
                }
            }
            return [0, rbgString(colorsForValues.size - 1), 1, rbgString(colorsForValues.size - 1)];
        } else if (Math.min(...scaledArray) === 1) {
            const color = this.inverted ? rbgString(0) : rbgString(colorsForValues.size - 1);
            return [0, color, 1, color];
        } else if (Math.max(...scaledArray) === 0) {
            const color = this.inverted ? rbgString(colorsForValues.size - 1) : rbgString(0);
            return [0, color, 1, color];
        } else {
            for (let i = 0; i < colorsForValues.size; i++) {
                if (scaledArray[i + 1] !== scaledArray[i]) {
                    colorscale.push(scaledArray[i], rbgString(i));
                }
                if (scaledArray[i] === (this.inverted ? 1 : 0)) {
                    break;
                }
            }
            return colorscale;
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
        return this.previewHistogramMin ? Math.max(this.previewHistogramMin, this.scaleMin[this.stokesIndex]) : this.scaleMin[this.stokesIndex];
    }

    @computed get scaleMaxVal() {
        return this.previewHistogramMax ? Math.min(this.previewHistogramMax, this.scaleMax[this.stokesIndex]) : this.scaleMax[this.stokesIndex];
    }

    @computed get selectedPercentileVal() {
        return this.selectedPercentile[this.stokesIndex];
    }

    /**
     * Set the channel number for the histogram.
     *
     * @param val - The channel number.
     */
    @action setHistChannel = (val: number) => {
        this.histChannel = val;
    };

    /**
     * Set the polarization index for the histogram.
     *
     * @param val - The polarization index from 0 to maximum 8 (depending on data).
     */
    @action setStokesIndex = (val: number) => {
        this.stokesIndex = val;
    };

    /**
     * Use cube data instead of per channel data for the histogram.
     *
     * @param val - True for using the cube data.
     */
    @action setUseCubeHistogram = (val: boolean) => {
        if (val !== this.useCubeHistogram) {
            this.useCubeHistogram = val;
            if (this.selectedPercentile[this.stokesIndex] > 0) {
                this.setPercentileRank(this.selectedPercentile[this.stokesIndex]);
            }
        }
    };

    /**
     * Use cube data instead of per channel data for the contour.
     *
     * @param val - True for using the cube data.
     */
    @action setUseCubeHistogramContours = (val: boolean) => {
        this.useCubeHistogramContours = val;
    };

    @computed get histogramMin() {
        if (!this.histogram || this.histogram.firstBinCenter == null || this.histogram.binWidth == null) {
            return undefined;
        }
        return this.histogram.firstBinCenter - 0.5 * this.histogram.binWidth;
    }

    @computed get histogramMax() {
        if (!this.histogram || this.histogram.firstBinCenter == null || this.histogram.binWidth == null || !this.histogram.bins) {
            return undefined;
        }
        return this.histogram.firstBinCenter + (this.histogram.bins.length + 0.5) * this.histogram.binWidth;
    }

    /**
     * Set the included histogram fraction for the colormap.
     *
     * @param rank - A value between 0 and 100.
     * @returns A boolean for the checking purpose.
     */
    @action setPercentileRank = (rank: number) => {
        this.selectedPercentile[this.stokesIndex] = rank;
        // Find max and min if the rank is 100%
        if (rank === 100) {
            if (this.histogramMin !== undefined) {
                this.scaleMin[this.stokesIndex] = this.histogramMin;
            }
            if (this.histogramMax !== undefined) {
                this.scaleMax[this.stokesIndex] = this.histogramMax;
            }
            this.updateSiblings();
            return true;
        }

        if (rank < 0 || rank > 100) {
            return false;
        }

        const rankComplement = 100 - rank;
        const percentiles = getPercentiles(this.histogram, [rankComplement, rank]);
        if (percentiles.length === 2) {
            this.scaleMin[this.stokesIndex] = percentiles[0];
            this.scaleMax[this.stokesIndex] = percentiles[1];
            this.updateSiblings();
            return true;
        } else {
            return false;
        }
    };

    @action updateChannelHistogram = (histogram: CARTA.IHistogram) => {
        this.channelHistogram = histogram;
        if (this.selectedPercentile[this.stokesIndex] > 0 && !this.useCubeHistogram) {
            this.setPercentileRank(this.selectedPercentile[this.stokesIndex]);
        }
    };

    @action updateCubeHistogram = (histogram: CARTA.IHistogram | null, progress: number) => {
        this.cubeHistogram = histogram;
        this.cubeHistogramProgress = progress;
        if (this.selectedPercentile[this.stokesIndex] > 0 && this.useCubeHistogram) {
            this.setPercentileRank(this.selectedPercentile[this.stokesIndex]);
        }
    };

    /**
     * Set minimum and maximum values of the scaling.
     *
     * @param minVal - The minimum scaling value.
     * @param maxVal - The maximum scaling value.
     */
    @action setCustomScale = (minVal: number, maxVal: number) => {
        this.scaleMin[this.stokesIndex] = minVal;
        this.scaleMax[this.stokesIndex] = maxVal;

        this.selectedPercentile[this.stokesIndex] = -1;
        this.updateSiblings();
    };

    /**
     * Set index of the colormap.
     *
     * @param index - The colormap index between -1 and array {@link COLOR_MAPS_ALL} size. The index -1 is the custom color.
     */
    @action setColorMapIndex = (index: number) => {
        this.colorMapIndex = clamp(index, -1, COLOR_MAPS_ALL.length - 1);
        this.updateSiblings();
    };

    /**
     * Set the colormap.
     *
     * @param colormap - The colormap name in {@link COLOR_MAPS_ALL}.
     */
    @action setColorMap = (colormap: string) => {
        const index = COLOR_MAPS_ALL.indexOf(colormap);
        if (colormap === RenderConfigStore.COLOR_MAPS_CUSTOM) {
            this.setColorMapIndex(RenderConfigStore.CUSTOM_COLOR_MAP_INDEX);
        } else if (index >= 0 && index < COLOR_MAPS_ALL.length) {
            this.setColorMapIndex(index);
        }
    };

    /**
     * Set Hex to generate the custom colormap.
     *
     * @param colorHex - The Hex string.
     */
    @action setCustomHexEnd = (colorHex: string) => {
        this.customColormapHexEnd = colorHex;
        this.updateSiblings();
    };

    /**
     * Set starting Hex to generate the custom colormap. The default color is black.
     *
     * @param colorHex - The Hex string.
     */
    @action setCustomHexStart = (colorHex: string) => {
        this.customColormapHexStart = colorHex;
        this.updateSiblings();
    };

    @computed get monoColormapHex() {
        return COLOR_MAPS_MONO.get(COLOR_MAPS_ALL[this.colorMapIndex]);
    }

    /**
     * Set the colormap scaling type.
     *
     * @param newScaling - The colormap scaling type {@link RenderConfigStore.SCALING_TYPES}.
     */
    @action setScaling = (newScaling: FrameScaling) => {
        if (RenderConfigStore.SCALING_TYPES.has(newScaling)) {
            this.scaling = newScaling;
            this.updateSiblings();
        }
    };

    /**
     * Set the gamma value for the scaling type Gamma.
     *
     * @param gamma - The gamma value of the scaling type Gamma.
     */
    @action setGamma = (gamma: number) => {
        this.gamma = gamma;
        this.updateSiblings();
    };

    /**
     * Set the alpha value for the scaling type Power.
     *
     * @param alpha - The alpha value of the scaling type Power.
     */
    @action setAlpha = (alpha: number) => {
        this.alpha = alpha;
        this.updateSiblings();
    };

    /**
     * Set the bias value.
     *
     * @param bias - The bias value of the colormap.
     */
    @action setBias = (bias: number) => {
        this.bias = bias;
        this.updateSiblings();
    };

    /**
     * Set the bias to be default value 0.
     */
    @action resetBias = () => {
        this.bias = 0;
        this.updateSiblings();
    };

    /**
     * Set the contrast value.
     *
     * @param contrast - The contrast value of the colormap.
     */
    @action setContrast = (contrast: number) => {
        this.contrast = contrast;
        this.updateSiblings();
    };

    /**
     * Set the contrast to be default value 1.
     */
    @action resetContrast = () => {
        this.contrast = 1;
        this.updateSiblings();
    };

    /**
     * Invert the colormap.
     *
     * @param inverted - True for inverting colormap.
     */
    @action setInverted = (inverted: boolean) => {
        this.inverted = inverted;
        this.updateSiblings();
    };

    @action setVisible = (visible: boolean) => {
        this.visible = visible;
    };

    /**
     * Set the upper boundary of the histogram in the preview image.
     *
     * @param histogramMax - The upper cut of the histogram.
     */
    @action setPreviewHistogramMax = (histogramMax: number | null) => {
        this.previewHistogramMax = histogramMax;
    };

    /**
     * Set the lower boundary of the histogram in the preview image.
     *
     * @param histogramMin - The lower cut of the histogram.
     */
    @action setPreviewHistogramMin = (histogramMin: number | null) => {
        this.previewHistogramMin = histogramMin;
    };

    @action toggleVisibility = () => {
        this.visible = !this.visible;
    };

    @action updateSiblings = () => {
        const siblings = this.frame?.renderConfigSiblings;
        if (siblings) {
            for (const frame of siblings) {
                frame.renderConfig?.updateFrom(this);
            }
        }
    };

    @action updateFrom = (other: RenderConfigStore) => {
        this.scaling = other.scaling;
        this.alpha = other.alpha;
        this.gamma = other.gamma;
        this.bias = other.bias;
        this.contrast = other.contrast;
        this.scaleMin[this.stokesIndex] = other.scaleMinVal;
        this.scaleMax[this.stokesIndex] = other.scaleMaxVal;
        this.selectedPercentile[this.stokesIndex] = -1;
        this.colorMapIndex = other.colorMapIndex;
        this.customColormapHexEnd = other.customColormapHexEnd;
        this.customColormapHexStart = other.customColormapHexStart;
        this.inverted = other.inverted;
    };

    @action updateFromWorkspace = (config: WorkspaceRenderConfig) => {
        this.scaling = config.scaling ?? this.scaling;
        if (config.colorMap) {
            this.setColorMap(config.colorMap);
        }
        if (config.customColormapHexEnd) {
            this.setCustomHexEnd(config.customColormapHexEnd);
        }
        this.bias = config.bias ?? this.bias;
        this.contrast = config.contrast ?? this.contrast;
        this.gamma = config.gamma ?? this.gamma;
        this.alpha = config.alpha ?? this.alpha;
        this.inverted = config.inverted ?? this.inverted;
        this.visible = config.visible ?? this.visible;
        this.scaleMin = config.scaleMin ?? this.scaleMin;
        this.scaleMax = config.scaleMax ?? this.scaleMax;
        this.selectedPercentile = config.selectedPercentile ?? this.selectedPercentile;
        // TODO: Handle cube histograms properly. For now, default to false
        this.useCubeHistogram = false;
        this.useCubeHistogramContours = false;
        this.updateSiblings();
    };
}
