import {action, computed, observable, makeObservable} from "mobx";
import {PlotType, SmoothingType, LineSettings} from "components/Shared";
import {Point2D} from "models";
import * as GSL from "gsl_wrapper";

export class ProfileSmoothingStore {
    @observable type: SmoothingType;
    @observable lineColor: string;
    @observable selectedLine: string;
    @observable lineType: PlotType;
    @observable lineWidth: number;
    @observable pointRadius: number;
    @observable isOverlayOn: boolean;
    @observable boxcarSize: number;
    @observable gaussianSigma: number;
    @observable hanningSize: number;
    @observable decimationWidth: number;
    @observable binWidth: number;
    @observable savitzkyGolaySize: number;
    @observable savitzkyGolayOrder: number;
    @observable colorMap: Map<string, string>;

    constructor() {
        makeObservable(this);
        this.type = SmoothingType.NONE;
        this.lineColor = "auto-rose";
        this.lineType = PlotType.STEPS;
        this.lineWidth = 1;
        this.pointRadius = 1;
        this.isOverlayOn = false;
        this.boxcarSize = 2;
        this.gaussianSigma = 1.0;
        this.hanningSize = 3;
        this.decimationWidth = 3;
        this.binWidth = 2;
        this.savitzkyGolaySize = 5;
        this.savitzkyGolayOrder = 0;
        this.colorMap = new Map();
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

    @action setIsOverlayOn = (val: boolean) => {
        this.isOverlayOn = val;
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

    @computed get exportData() {
        let exportData: Map<string, string> = new Map<string, string>();
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
        let comments: string[] = [];
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
        let firstGroupStartIndex = xMinIndex % width === 0 ? xMinIndex : xMinIndex - (xMinIndex % width);
        let lastGroupEndIndex = xMaxIndex % width === width - 1 ? xMaxIndex : xMaxIndex - (xMaxIndex % width) + (width - 1);
        if (lastGroupEndIndex > fullLength - 1) {
            lastGroupEndIndex = fullLength - 1;
        }
        return {firstIndex: firstGroupStartIndex, lastIndex: lastGroupEndIndex};
    }

    getSmoothingValues(x: number[], y: Float32Array | Float64Array, xMinIndex?: number, xMaxIndex?: number): {x: number[]; y: Float32Array | Float64Array} {
        let smoothingYs: Float32Array | Float64Array;
        let smoothingXs = x;
        if (this.type === SmoothingType.BOXCAR) {
            if ((xMinIndex || xMaxIndex === 0) && xMaxIndex) {
                const indexes = this.getLocalStartEndIndexes(x.length, xMinIndex, xMaxIndex, this.boxcarSize);
                const localYs = y.subarray(indexes.startSmoothing, indexes.endSmoothing + 1);
                smoothingYs = GSL.boxcarSmooth(localYs, this.boxcarSize).subarray(indexes.smoothedStart, indexes.smoothedEnd + 1);
                smoothingXs = x.slice(xMinIndex, xMaxIndex + 1);
            } else {
                smoothingYs = GSL.boxcarSmooth(y, this.boxcarSize);
            }
        } else if (this.type === SmoothingType.GAUSSIAN) {
            if (this.gaussianSigma && this.gaussianSigma >= 1) {
                if ((xMinIndex || xMaxIndex === 0) && xMaxIndex) {
                    const indexes = this.getLocalStartEndIndexes(x.length, xMinIndex, xMaxIndex, this.gaussianKernel);
                    const localYs = y.subarray(indexes.startSmoothing, indexes.endSmoothing + 1);
                    smoothingYs = GSL.gaussianSmooth(localYs, this.gaussianKernel, this.gaussianAlpha).subarray(indexes.smoothedStart, indexes.smoothedEnd + 1);
                    smoothingXs = x.slice(xMinIndex, xMaxIndex + 1);
                } else {
                    smoothingYs = GSL.gaussianSmooth(y, this.gaussianKernel, this.gaussianAlpha);
                }
            }
        } else if (this.type === SmoothingType.HANNING) {
            if ((xMinIndex || xMaxIndex === 0) && xMaxIndex) {
                const indexes = this.getLocalStartEndIndexes(x.length, xMinIndex, xMaxIndex, this.hanningSize);
                const localYs = y.subarray(indexes.startSmoothing, indexes.endSmoothing + 1);
                smoothingYs = GSL.hanningSmooth(localYs, this.hanningSize).subarray(indexes.smoothedStart, indexes.smoothedEnd + 1);
                smoothingXs = x.slice(xMinIndex, xMaxIndex + 1);
            } else {
                smoothingYs = GSL.hanningSmooth(y, this.hanningSize);
            }
        } else if (this.type === SmoothingType.DECIMATION) {
            if ((xMinIndex || xMaxIndex === 0) && xMaxIndex) {
                const indexes = this.getLocalGroupStartEndIndexes(x.length, xMinIndex, xMaxIndex, this.decimationWidth);
                const localYs = y.subarray(indexes.firstIndex, indexes.lastIndex + 1);
                const localXs = x.slice(indexes.firstIndex, indexes.lastIndex + 1);
                let decimatedValues = GSL.decimation(localXs, localYs, this.decimationWidth);
                smoothingXs = decimatedValues.x;
                smoothingYs = decimatedValues.y;
            } else {
                let decimatedValues = GSL.decimation(x, y, this.decimationWidth);
                smoothingXs = decimatedValues.x;
                smoothingYs = decimatedValues.y;
            }
        } else if (this.type === SmoothingType.BINNING) {
            if ((xMinIndex || xMaxIndex === 0) && xMaxIndex) {
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
            if ((xMinIndex || xMaxIndex === 0) && xMaxIndex) {
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
        let smoothingArray: Point2D[] = new Array(smoothingValues.x.length);

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
        if ((xMinIndex || xMaxIndex === 0) && xMaxIndex) {
            const indexes = this.getLocalGroupStartEndIndexes(x.length, xMinIndex, xMaxIndex, decimationWidth);
            const localYs = y.subarray(indexes.firstIndex, indexes.lastIndex + 1);
            const localXs = x.slice(indexes.firstIndex, indexes.lastIndex + 1);
            decimatedValues = GSL.decimation(localXs, localYs, decimationWidth);
        } else {
            decimatedValues = GSL.decimation(x, y, decimationWidth);
        }

        let decimatedArray: Point2D[] = new Array(decimatedValues.x.length);
        for (let i = 0; i < decimatedValues.x.length; i++) {
            decimatedArray[i] = {x: decimatedValues.x[i], y: decimatedValues.y[i]};
        }
        return decimatedArray;
    }
}
