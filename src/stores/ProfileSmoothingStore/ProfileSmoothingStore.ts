import * as GSL from "gsl_wrapper";
import {action, computed, makeObservable, observable} from "mobx";
import tinycolor from "tinycolor2";

import {LineSettings, PlotType, SmoothingType} from "enums";
import {type ConfigurableStore, type Persisted, type Point2D} from "models";
import {isAutoColor} from "utilities";

/** How a profile is smoothed and the smoothed profile drawn, as a layout keeps it. */
export interface ProfileSmoothingConfig {
    type: SmoothingType;
    lineColor: string;
    lineType: PlotType;
    lineWidth: number;
    pointRadius: number;
    isOverlayOn: boolean;
    boxcarSize: number;
    gaussianSigma: number;
    hanningSize: number;
    decimationWidth: number;
    binWidth: number;
    savitzkyGolaySize: number;
    savitzkyGolayOrder: number;
    /** The line whose smoothed colour is being edited, and the colour of each, by the line's name. */
    selectedLine: string;
    lineColors: {[line: string]: string};
}

function isColor(color: unknown): color is string {
    return typeof color === "string" && (tinycolor(color).isValid() || isAutoColor(color));
}

function isIntegerAtLeast(value: unknown, min: number): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= min;
}

export class ProfileSmoothingStore implements ConfigurableStore<ProfileSmoothingConfig, Persisted<ProfileSmoothingConfig>> {
    @observable type: SmoothingType = SmoothingType.NONE;
    @observable lineColor: string = "auto-rose";
    @observable selectedLine: string = "";
    @observable lineType: PlotType = PlotType.STEPS;
    @observable lineWidth: number = 1;
    @observable pointRadius: number = 1;
    @observable isOverlayOn: boolean = false;
    @observable boxcarSize: number = 2;
    @observable gaussianSigma: number = 1.0;
    @observable hanningSize: number = 3;
    @observable decimationWidth: number = 3;
    @observable binWidth: number = 2;
    @observable savitzkyGolaySize: number = 5;
    @observable savitzkyGolayOrder: number = 0;
    @observable colorMap: Map<string, string> = new Map();

    constructor() {
        makeObservable(this);
    }

    @action setType = (val: SmoothingType) => {
        this.type = val;
    };

    @action setLineColor = (color: string) => {
        this.lineColor = color;
    };

    @action setSelectedLine = (key: string) => {
        this.selectedLine = key;
    };

    @action setLineType = (val: PlotType) => {
        this.lineType = val;
    };

    @action setLineWidth = (val: number) => {
        if (val >= LineSettings.MIN_WIDTH && val <= LineSettings.MAX_WIDTH) {
            this.lineWidth = val;
        }
    };

    @action setPointRadius = (val: number) => {
        if (val >= LineSettings.MIN_POINT_SIZE && val <= LineSettings.MAX_POINT_SIZE) {
            this.pointRadius = val;
        }
    };

    @action setIsOverlayOn = (isOverlayOn: boolean) => {
        this.isOverlayOn = isOverlayOn;
    };

    @action setBoxcarSize = (val: number) => {
        this.boxcarSize = val;
    };

    @action setGaussianSigma = (val: number) => {
        this.gaussianSigma = val;
    };

    @action setHanningSize = (val: number) => {
        this.hanningSize = val;
    };

    @action setDecimationWidth = (val: number) => {
        this.decimationWidth = val;
    };

    @action setBinWidth = (val: number) => {
        this.binWidth = val;
    };

    @action setSavitzkyGolaySize = (val: number) => {
        this.savitzkyGolaySize = val;
    };

    @action setSavitzkyGolayOrder = (val: number) => {
        this.savitzkyGolayOrder = val;
    };

    @action setColorMap = (key: string, color: string) => {
        this.colorMap.set(key, color);
    };

    public toConfig = (): ProfileSmoothingConfig => ({
        type: this.type,
        lineColor: this.lineColor,
        lineType: this.lineType,
        lineWidth: this.lineWidth,
        pointRadius: this.pointRadius,
        isOverlayOn: this.isOverlayOn,
        boxcarSize: this.boxcarSize,
        gaussianSigma: this.gaussianSigma,
        hanningSize: this.hanningSize,
        decimationWidth: this.decimationWidth,
        binWidth: this.binWidth,
        savitzkyGolaySize: this.savitzkyGolaySize,
        savitzkyGolayOrder: this.savitzkyGolayOrder,
        selectedLine: this.selectedLine,
        lineColors: Object.fromEntries(this.colorMap)
    });

    /** Take each setting a layout saved that the smoothing controls would accept, and keep the rest. */
    @action applyConfig = (config: Persisted<ProfileSmoothingConfig>) => {
        if (!config || typeof config !== "object") {
            return;
        }
        if (Object.values(SmoothingType).includes(config.type as SmoothingType)) {
            this.type = config.type as SmoothingType;
        }
        if (isColor(config.lineColor)) {
            this.lineColor = config.lineColor;
        }
        if (Object.values(PlotType).includes(config.lineType as PlotType)) {
            this.lineType = config.lineType as PlotType;
        }
        if (typeof config.lineWidth === "number") {
            this.setLineWidth(config.lineWidth);
        }
        if (typeof config.pointRadius === "number") {
            this.setPointRadius(config.pointRadius);
        }
        if (typeof config.isOverlayOn === "boolean") {
            this.isOverlayOn = config.isOverlayOn;
        }
        if (isIntegerAtLeast(config.boxcarSize, 2)) {
            this.boxcarSize = config.boxcarSize;
        }
        if (typeof config.gaussianSigma === "number" && config.gaussianSigma >= 1) {
            this.gaussianSigma = config.gaussianSigma;
        }
        if (isIntegerAtLeast(config.hanningSize, 3)) {
            this.hanningSize = config.hanningSize;
        }
        if (isIntegerAtLeast(config.decimationWidth, 2)) {
            this.decimationWidth = config.decimationWidth;
        }
        if (isIntegerAtLeast(config.binWidth, 2)) {
            this.binWidth = config.binWidth;
        }
        if (isIntegerAtLeast(config.savitzkyGolaySize, 5)) {
            this.savitzkyGolaySize = config.savitzkyGolaySize;
        }
        if (isIntegerAtLeast(config.savitzkyGolayOrder, 0) && config.savitzkyGolayOrder <= 4) {
            this.savitzkyGolayOrder = config.savitzkyGolayOrder;
        }
        if (typeof config.selectedLine === "string") {
            this.selectedLine = config.selectedLine;
        }
        if (config.lineColors && typeof config.lineColors === "object") {
            Object.entries(config.lineColors).forEach(([line, color]) => {
                if (isColor(color)) {
                    this.colorMap.set(line, color);
                }
            });
        }
    };

    @computed get exportData() {
        const exportData: Map<string, string> = new Map<string, string>();
        exportData.set("smooth", this.type);
        if (this.type === SmoothingType.BOXCAR) {
            exportData.set("kernel", String(this.boxcarSize));
        } else if (this.type === SmoothingType.GAUSSIAN) {
            exportData.set("sigma", String(this.gaussianSigma));
        } else if (this.type === SmoothingType.HANNING) {
            exportData.set("kernel", String(this.hanningSize));
        } else if (this.type === SmoothingType.DECIMATION) {
            exportData.set("decimation width", String(this.decimationWidth));
        } else if (this.type === SmoothingType.BINNING) {
            exportData.set("bin width", String(this.binWidth));
        } else if (this.type === SmoothingType.SAVITZKY_GOLAY) {
            exportData.set("kernel", String(this.savitzkyGolaySize));
            exportData.set("order", String(this.savitzkyGolayOrder));
        }
        return exportData;
    }

    @computed get comments(): string[] {
        const comments: string[] = [];
        this.exportData?.forEach((content, title) => comments.push(`${title}: ${content}`));
        return comments;
    }

    @computed get gaussianKernel(): number {
        if (this.gaussianSigma < 3) {
            return 3;
        }
        const ceilInt = Math.ceil(this.gaussianSigma);
        if (ceilInt % 2 === 0) {
            return ceilInt + 1;
        }
        return ceilInt;
    }

    // The parameter for GSL specifies the number of standard deviations sigma desired in the kernel.
    @computed get gaussianAlpha(): number {
        return (this.gaussianKernel - 1) / (2 * this.gaussianSigma);
    }

    private getLocalStartEndIndexes(fullLength: number, xMinIndex: number, xMaxIndex: number, kernelSize: number) {
        let h: number, j: number;
        if (kernelSize % 2 === 1) {
            h = (kernelSize - 1) / 2;
            j = (kernelSize - 1) / 2;
        } else {
            h = kernelSize / 2 - 1;
            j = kernelSize / 2;
        }
        const startSmoothing = xMinIndex < h ? 0 : xMinIndex - h;
        const endSmoothing = xMaxIndex + j > fullLength - 1 ? fullLength - 1 : xMaxIndex + j;
        const smoothedStart = xMinIndex < h ? xMinIndex : h;
        const smoothedEnd = smoothedStart + xMaxIndex - xMinIndex;
        return {startSmoothing, endSmoothing, smoothedStart, smoothedEnd};
    }

    private getLocalGroupStartEndIndexes(fullLength: number, xMinIndex: number, xMaxIndex: number, width: number) {
        const firstGroupStartIndex = xMinIndex % width === 0 ? xMinIndex : xMinIndex - (xMinIndex % width);
        let lastGroupEndIndex = xMaxIndex % width === width - 1 ? xMaxIndex : xMaxIndex - (xMaxIndex % width) + (width - 1);
        if (lastGroupEndIndex > fullLength - 1) {
            lastGroupEndIndex = fullLength - 1;
        }
        return {firstIndex: firstGroupStartIndex, lastIndex: lastGroupEndIndex};
    }

    getSmoothingValues(x: number[], y: Float32Array | Float64Array, xMinIndex?: number, xMaxIndex?: number): {x: number[]; y: Float32Array | Float64Array | undefined} {
        let smoothingYs: Float32Array | Float64Array | undefined;
        let smoothingXs = x;
        const hasValidLocalRangeIndexes = xMinIndex !== undefined && xMaxIndex !== undefined && xMinIndex >= 0 && xMaxIndex >= xMinIndex && xMaxIndex < x.length;
        if (this.type === SmoothingType.BOXCAR) {
            if (hasValidLocalRangeIndexes) {
                const indexes = this.getLocalStartEndIndexes(x.length, xMinIndex, xMaxIndex, this.boxcarSize);
                const localYs = y.subarray(indexes.startSmoothing, indexes.endSmoothing + 1);
                smoothingYs = GSL.boxcarSmooth(localYs, this.boxcarSize).subarray(indexes.smoothedStart, indexes.smoothedEnd + 1);
                smoothingXs = x.slice(xMinIndex, xMaxIndex + 1);
            } else {
                smoothingYs = GSL.boxcarSmooth(y, this.boxcarSize);
            }
        } else if (this.type === SmoothingType.GAUSSIAN) {
            if (this.gaussianSigma && this.gaussianSigma >= 1) {
                if (hasValidLocalRangeIndexes) {
                    const indexes = this.getLocalStartEndIndexes(x.length, xMinIndex, xMaxIndex, this.gaussianKernel);
                    const localYs = y.subarray(indexes.startSmoothing, indexes.endSmoothing + 1);
                    smoothingYs = GSL.gaussianSmooth(localYs, this.gaussianKernel, this.gaussianAlpha).subarray(indexes.smoothedStart, indexes.smoothedEnd + 1);
                    smoothingXs = x.slice(xMinIndex, xMaxIndex + 1);
                } else {
                    smoothingYs = GSL.gaussianSmooth(y, this.gaussianKernel, this.gaussianAlpha);
                }
            }
        } else if (this.type === SmoothingType.HANNING) {
            if (hasValidLocalRangeIndexes) {
                const indexes = this.getLocalStartEndIndexes(x.length, xMinIndex, xMaxIndex, this.hanningSize);
                const localYs = y.subarray(indexes.startSmoothing, indexes.endSmoothing + 1);
                smoothingYs = GSL.hanningSmooth(localYs, this.hanningSize).subarray(indexes.smoothedStart, indexes.smoothedEnd + 1);
                smoothingXs = x.slice(xMinIndex, xMaxIndex + 1);
            } else {
                smoothingYs = GSL.hanningSmooth(y, this.hanningSize);
            }
        } else if (this.type === SmoothingType.DECIMATION) {
            if (hasValidLocalRangeIndexes) {
                const indexes = this.getLocalGroupStartEndIndexes(x.length, xMinIndex, xMaxIndex, this.decimationWidth);
                const localYs = y.subarray(indexes.firstIndex, indexes.lastIndex + 1);
                const localXs = x.slice(indexes.firstIndex, indexes.lastIndex + 1);
                const decimatedValues = GSL.decimation(localXs, localYs, this.decimationWidth);
                smoothingXs = decimatedValues.x;
                smoothingYs = decimatedValues.y;
            } else {
                const decimatedValues = GSL.decimation(x, y, this.decimationWidth);
                smoothingXs = decimatedValues.x;
                smoothingYs = decimatedValues.y;
            }
        } else if (this.type === SmoothingType.BINNING) {
            if (hasValidLocalRangeIndexes) {
                const indexes = this.getLocalGroupStartEndIndexes(x.length, xMinIndex, xMaxIndex, this.binWidth);
                const localYs = y.subarray(indexes.firstIndex, indexes.lastIndex + 1);
                const localXs = x.slice(indexes.firstIndex, indexes.lastIndex + 1);
                smoothingXs = GSL.binning(localXs, this.binWidth);
                smoothingYs = GSL.binning(localYs, this.binWidth);
            } else {
                smoothingXs = GSL.binning(x, this.binWidth);
                smoothingYs = GSL.binning(y, this.binWidth);
            }
        } else if (this.type === SmoothingType.SAVITZKY_GOLAY) {
            if (hasValidLocalRangeIndexes) {
                const indexes = this.getLocalStartEndIndexes(x.length, xMinIndex, xMaxIndex, this.savitzkyGolaySize);
                const localYs = y.subarray(indexes.startSmoothing, indexes.endSmoothing + 1);
                smoothingYs = GSL.savitzkyGolaySmooth(x, localYs, this.savitzkyGolaySize, this.savitzkyGolayOrder).subarray(indexes.smoothedStart, indexes.smoothedEnd + 1);
                smoothingXs = x.slice(xMinIndex, xMaxIndex + 1);
            } else {
                smoothingYs = GSL.savitzkyGolaySmooth(x, y, this.savitzkyGolaySize, this.savitzkyGolayOrder);
            }
        }
        return {x: smoothingXs, y: smoothingYs};
    }

    getSmoothingPoint2DArray(x: number[], y: Float32Array | Float64Array, xMinIndex?: number, xMaxIndex?: number): Point2D[] {
        if (this.type === SmoothingType.NONE) {
            return [];
        }
        const smoothingValues = this.getSmoothingValues(x, y, xMinIndex, xMaxIndex);
        if (!smoothingValues.y) {
            return [];
        }
        const smoothingArray: Point2D[] = new Array(smoothingValues.x.length);

        for (let i = 0; i < smoothingValues.x.length; i++) {
            smoothingArray[i] = {x: smoothingValues.x[i], y: smoothingValues.y[i]};
        }

        return smoothingArray;
    }

    getDecimatedPoint2DArray(x: number[], y: Float32Array | Float64Array, decimationWidth: number, xMinIndex?: number, xMaxIndex?: number): Point2D[] {
        if (!x || !y || x.length !== y.length) {
            return [];
        }
        let decimatedValues;
        const hasValidLocalRangeIndexes = xMinIndex !== undefined && xMaxIndex !== undefined && xMinIndex >= 0 && xMaxIndex >= xMinIndex && xMaxIndex < x.length;
        if (hasValidLocalRangeIndexes) {
            const indexes = this.getLocalGroupStartEndIndexes(x.length, xMinIndex, xMaxIndex, decimationWidth);
            const localYs = y.subarray(indexes.firstIndex, indexes.lastIndex + 1);
            const localXs = x.slice(indexes.firstIndex, indexes.lastIndex + 1);
            decimatedValues = GSL.decimation(localXs, localYs, decimationWidth);
        } else {
            decimatedValues = GSL.decimation(x, y, decimationWidth);
        }

        const decimatedArray: Point2D[] = new Array(decimatedValues.x.length);
        for (let i = 0; i < decimatedValues.x.length; i++) {
            decimatedArray[i] = {x: decimatedValues.x[i], y: decimatedValues.y[i]};
        }
        return decimatedArray;
    }
}
