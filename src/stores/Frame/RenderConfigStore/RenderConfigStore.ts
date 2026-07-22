import {type CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";
import type {WorkspaceRenderConfig} from "models";

import {FrameScaling, PreferenceKeys} from "enums";
import {AppStore, type PreferenceStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {clamp, COLOR_MAPS_ALL, COLOR_MAPS_MONO, COLOR_MAPS_SELECTED, getColorsForValues, getColorsFromHex, getPercentiles, sanitizeScalingParameter, scaleValueInverse} from "utilities";

export class RenderConfigStore {
    public static readonly SCALING_TYPES = new Map<FrameScaling, string>([
        [FrameScaling.LINEAR, "Linear"],
        [FrameScaling.LOG, "Log"],
        [FrameScaling.SQRT, "Square root"],
        [FrameScaling.SQUARE, "Squared"],
        [FrameScaling.GAMMA, "Gamma"],
        [FrameScaling.POWER, "Power"],
        [FrameScaling.SINH, "Sinh"],
        [FrameScaling.ASINH, "Asinh"]
    ]);

    public static readonly CUSTOM_COLOR_MAP_INDEX = -1;
    public static readonly COLOR_MAPS_CUSTOM = "custom";
    public static readonly COLOR_MAPS_PANEL = "color_panel";

    public static readonly PERCENTILE_RANKS = [90, 95, 99, 99.5, 99.9, 99.95, 99.99, 100];

    /* eslint-disable @typescript-eslint/naming-convention */
    public static get BIAS_MIN(): number {
        return AppStore.Instance.preferenceStore.getMinConstraint(PreferenceKeys.RENDER_CONFIG_BIAS) ?? -1;
    }
    public static get BIAS_MAX(): number {
        return AppStore.Instance.preferenceStore.getMaxConstraint(PreferenceKeys.RENDER_CONFIG_BIAS) ?? 1;
    }
    public static get CONTRAST_MIN(): number {
        return AppStore.Instance.preferenceStore.getMinConstraint(PreferenceKeys.RENDER_CONFIG_CONTRAST) ?? 0;
    }
    public static get CONTRAST_MAX(): number {
        return AppStore.Instance.preferenceStore.getMaxConstraint(PreferenceKeys.RENDER_CONFIG_CONTRAST) ?? 2;
    }
    /* eslint-enable @typescript-eslint/naming-convention */

    @observable scaling: FrameScaling;
    @observable colorMapIndex: number = 0;
    @observable bias: number = 0;
    @observable contrast: number = 1;
    @observable gamma: number;
    @observable alphaLog: number;
    @observable alphaPower: number;
    @observable alphaSinh: number;
    @observable alphaAsinh: number;
    @observable isInverted: boolean = false;
    @observable channelHistogram: CARTA.Histogram.$Properties | undefined = undefined;
    @observable cubeHistogram: CARTA.Histogram.$Properties | null = null;
    @observable isUsingCubeHistogram: boolean = false;
    @observable isUsingCubeHistogramContours: boolean = false;
    @observable cubeHistogramProgress: number = 0;
    @observable selectedPercentile: number[];
    @observable histChannel: number = 0;
    @observable stokesIndex: number = 0;
    @observable scaleMin: number[];
    @observable scaleMax: number[];
    @observable isVisible: boolean = true;
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
        this.alphaLog = sanitizeScalingParameter(FrameScaling.LOG, preference.scalingAlphaLog);
        this.alphaPower = sanitizeScalingParameter(FrameScaling.POWER, preference.scalingAlphaPower);
        this.alphaSinh = sanitizeScalingParameter(FrameScaling.SINH, preference.scalingAlphaSinh);
        this.alphaAsinh = sanitizeScalingParameter(FrameScaling.ASINH, preference.scalingAlphaAsinh);
        this.gamma = sanitizeScalingParameter(FrameScaling.GAMMA, preference.scalingGamma);
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

    public static isColormapValid(colormap: string): boolean {
        return COLOR_MAPS_SELECTED.includes(colormap);
    }

    public static isPercentileValid(percentile: number): boolean {
        return RenderConfigStore.PERCENTILE_RANKS.includes(percentile);
    }

    @computed get alpha(): number {
        switch (this.scaling) {
            case FrameScaling.LOG:
                return this.alphaLog;
            case FrameScaling.POWER:
                return this.alphaPower;
            case FrameScaling.SINH:
                return this.alphaSinh;
            case FrameScaling.ASINH:
                return this.alphaAsinh;
            default:
                return this.alphaLog;
        }
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
        const indexArray = Array.from(Array(colorsForValues.size).keys()).map(x => (this.isInverted ? 1 - x / colorsForValues.size : x / colorsForValues.size));
        const scaledArray = indexArray.map(x => 1.0 - scaleValueInverse(x, this.scaling, this.alpha, this.gamma, this.bias, this.contrast, AppStore.Instance?.preferenceStore?.shouldUseSmoothedBiasContrast));
        const rbgString = (index: number): string => `rgb(${colorsForValues!.color[index * 4]}, ${colorsForValues!.color[index * 4 + 1]}, ${colorsForValues!.color[index * 4 + 2]}, ${colorsForValues!.color[index * 4 + 3]})`;

        // Fix: Explicitly type colorscale as (number | string)[]
        const colorscale: (number | string)[] = [];
        if (this.contrast === 0) {
            for (let i = 0; i < colorsForValues.size; i++) {
                if (scaledArray[i] === (this.isInverted ? 1 : 0)) {
                    return [0, rbgString(i), 1, rbgString(i)];
                }
            }
            return [0, rbgString(colorsForValues.size - 1), 1, rbgString(colorsForValues.size - 1)];
        } else if (Math.min(...scaledArray) === 1) {
            const color = this.isInverted ? rbgString(0) : rbgString(colorsForValues.size - 1);
            return [0, color, 1, color];
        } else if (Math.max(...scaledArray) === 0) {
            const color = this.isInverted ? rbgString(colorsForValues.size - 1) : rbgString(0);
            return [0, color, 1, color];
        } else {
            for (let i = 0; i < colorsForValues.size; i++) {
                if (scaledArray[i + 1] !== scaledArray[i]) {
                    colorscale.push(scaledArray[i], rbgString(i));
                }
                if (scaledArray[i] === (this.isInverted ? 1 : 0)) {
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
        if (this.isUsingCubeHistogram && this.cubeHistogram) {
            return this.cubeHistogram;
        } else {
            return this.channelHistogram;
        }
    }

    @computed get contourHistogram() {
        if (this.isUsingCubeHistogramContours && this.cubeHistogram) {
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
     * @param isUsingCubeHistogram - True for using the cube data.
     */
    @action setUseCubeHistogram = (isUsingCubeHistogram: boolean) => {
        if (isUsingCubeHistogram !== this.isUsingCubeHistogram) {
            this.isUsingCubeHistogram = isUsingCubeHistogram;
            if (this.selectedPercentile[this.stokesIndex] > 0) {
                this.setPercentileRank(this.selectedPercentile[this.stokesIndex]);
            }
        }
    };

    /**
     * Use cube data instead of per channel data for the contour.
     *
     * @param isUsingCubeHistogramContours - True for using the cube data.
     */
    @action setUseCubeHistogramContours = (isUsingCubeHistogramContours: boolean) => {
        this.isUsingCubeHistogramContours = isUsingCubeHistogramContours;
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
        if (!this.histogram) {
            return false;
        }
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

    @action updateChannelHistogram = (histogram: CARTA.Histogram.$Properties) => {
        this.channelHistogram = histogram;
        if (this.selectedPercentile[this.stokesIndex] > 0 && !this.isUsingCubeHistogram) {
            this.setPercentileRank(this.selectedPercentile[this.stokesIndex]);
        }
    };

    @action updateCubeHistogram = (histogram: CARTA.Histogram.$Properties | null, progress: number) => {
        this.cubeHistogram = histogram;
        this.cubeHistogramProgress = progress;
        if (this.selectedPercentile[this.stokesIndex] > 0 && this.isUsingCubeHistogram) {
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
        if (!Number.isFinite(gamma)) {
            return;
        }

        this.gamma = sanitizeScalingParameter(FrameScaling.GAMMA, gamma);
        this.updateSiblings();
    };

    /**
     * Set the alpha value for the current scaling type.
     *
     * @param alpha - The alpha value.
     */
    @action setAlpha = (alpha: number) => {
        if (!Number.isFinite(alpha)) {
            return;
        }

        const sanitizedAlpha = sanitizeScalingParameter(this.scaling, alpha);
        switch (this.scaling) {
            case FrameScaling.LOG:
                this.alphaLog = sanitizedAlpha;
                break;
            case FrameScaling.POWER:
                this.alphaPower = sanitizedAlpha;
                break;
            case FrameScaling.SINH:
                this.alphaSinh = sanitizedAlpha;
                break;
            case FrameScaling.ASINH:
                this.alphaAsinh = sanitizedAlpha;
                break;
            default:
                return;
        }
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
     * Set bias and contrast together.
     *
     * @param bias - The bias value of the colormap.
     * @param contrast - The contrast value of the colormap.
     */
    @action setBiasContrast = (bias: number, contrast: number) => {
        this.bias = bias;
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
     * @param isInverted - True for inverting colormap.
     */
    @action setInverted = (isInverted: boolean) => {
        this.isInverted = isInverted;
        this.updateSiblings();
    };

    @action setVisible = (isVisible: boolean) => {
        this.isVisible = isVisible;
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
        this.isVisible = !this.isVisible;
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
        this.alphaLog = sanitizeScalingParameter(FrameScaling.LOG, other.alphaLog, this.alphaLog);
        this.alphaPower = sanitizeScalingParameter(FrameScaling.POWER, other.alphaPower, this.alphaPower);
        this.alphaSinh = sanitizeScalingParameter(FrameScaling.SINH, other.alphaSinh, this.alphaSinh);
        this.alphaAsinh = sanitizeScalingParameter(FrameScaling.ASINH, other.alphaAsinh, this.alphaAsinh);
        this.gamma = sanitizeScalingParameter(FrameScaling.GAMMA, other.gamma, this.gamma);
        this.bias = other.bias;
        this.contrast = other.contrast;
        this.scaleMin[this.stokesIndex] = other.scaleMinVal;
        this.scaleMax[this.stokesIndex] = other.scaleMaxVal;
        this.selectedPercentile[this.stokesIndex] = -1;
        this.colorMapIndex = other.colorMapIndex;
        this.customColormapHexEnd = other.customColormapHexEnd;
        this.customColormapHexStart = other.customColormapHexStart;
        this.isInverted = other.isInverted;
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
        this.gamma = sanitizeScalingParameter(FrameScaling.GAMMA, config.gamma ?? this.gamma, this.gamma);
        this.alphaLog = sanitizeScalingParameter(FrameScaling.LOG, config.alphaLog ?? this.alphaLog, this.alphaLog);
        this.alphaPower = sanitizeScalingParameter(FrameScaling.POWER, config.alphaPower ?? this.alphaPower, this.alphaPower);
        this.alphaSinh = sanitizeScalingParameter(FrameScaling.SINH, config.alphaSinh ?? this.alphaSinh, this.alphaSinh);
        this.alphaAsinh = sanitizeScalingParameter(FrameScaling.ASINH, config.alphaAsinh ?? this.alphaAsinh, this.alphaAsinh);
        this.isInverted = config.inverted ?? this.isInverted;
        this.isVisible = config.visible ?? this.isVisible;
        this.scaleMin = config.scaleMin ?? this.scaleMin;
        this.scaleMax = config.scaleMax ?? this.scaleMax;
        this.selectedPercentile = config.selectedPercentile ?? this.selectedPercentile;
        // TODO: Handle cube histograms properly. For now, default to false
        this.isUsingCubeHistogram = false;
        this.isUsingCubeHistogramContours = false;
        this.updateSiblings();
    };
}
