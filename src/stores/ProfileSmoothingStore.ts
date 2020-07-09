import {action, computed, observable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {PlotType, SmoothingType, LineSettings} from "components/Shared";
import {Point2D} from "models";
import * as GSL from "gsl_wrapper";

export class ProfileSmoothingStore {
    @observable type: SmoothingType;
    @observable lineColor: { colorHex: string, fixed: boolean };
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
    @observable colorMap: Map<string, { colorHex: string, fixed: boolean }>;

    constructor() {
        this.type = SmoothingType.NONE;
        this.lineColor = { colorHex: Colors.ORANGE2, fixed: false };
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
    }

    @action setLineColor = (colorHex: string, fixed: boolean) => {
        this.lineColor = { colorHex: colorHex, fixed: fixed };
    }

    @action setSelectedLine = (key: string) => {
        this.selectedLine = key;
    }

    @action setLineType = (val: PlotType) => {
        this.lineType = val;
    }

    @action setLineWidth = (val: number) => {
        if (val >= LineSettings.MIN_WIDTH && val <= LineSettings.MAX_WIDTH) {
            this.lineWidth = val;
        }
    }

    @action setPointRadius = (val: number) => {
        if (val >= LineSettings.MIN_POINT_SIZE && val <= LineSettings.MAX_POINT_SIZE) {
            this.pointRadius = val;
        }
    }

    @action setIsOverlayOn = (val: boolean) => {
        this.isOverlayOn = val;
    }

    @action setBoxcarSize = (val: number) => {
        this.boxcarSize = val;
    }

    @action setGaussianSigma = (val: number) => {
        this.gaussianSigma = val;
    }

    @action setHanningSize = (val: number) => {
        this.hanningSize = val;
    }

    @action setDecimationWidth = (val: number) => {
        this.decimationWidth = val;
    }

    @action setBinWidth = (val: number) => {
        this.binWidth = val;
    }

    @action setSavitzkyGolaySize = (val: number) => {
        this.savitzkyGolaySize = val;
    }

    @action setSavitzkyGolayOrder = (val: number) => {
        this.savitzkyGolayOrder = val;
    }

    @action setColorMap = (key: string, val: { colorHex: string, fixed: boolean }) => {
        this.colorMap.set(key, val);
    }

    @computed get exportData() {
        let exportData: Map<string, string> = new Map<string, string>();
        exportData.set("smooth", this.type);
        if (this.type === SmoothingType.BOXCAR) {
            exportData.set("kernel", String(this.boxcarSize));
        } else if (this.type === SmoothingType.GAUSSIAN) {
            exportData.set("sigma", String(this.gaussianSigma));
            exportData.set("kernel", String(Math.ceil(this.gaussianSigma * 2)));
        } else if (this.type === SmoothingType.HANNING) {
            exportData.set("kernel", String(this.hanningSize));
        } else if (this.type === SmoothingType.DECIMATION) {
            exportData.set("decimation value", String(this.decimationWidth));
        } else if (this.type === SmoothingType.BINNING) {
            exportData.set("bin width", String(this.setBinWidth));
        } else if (this.type === SmoothingType.SAVITZKY_GOLAY) {
            exportData.set("kernel", String(this.savitzkyGolaySize));
            exportData.set("order", String(this.savitzkyGolayOrder));
        }
        return exportData;
    }

    getSmoothingValues(x: number[], y: Float32Array | Float64Array): { x: number[], y: Float32Array | Float64Array} {
        let smoothingYs: Float32Array | Float64Array;
        let smoothingXs = x;
        if (this.type === SmoothingType.BOXCAR) {
            smoothingYs = GSL.boxcarSmooth(y, this.boxcarSize);
        } else if (this.type === SmoothingType.GAUSSIAN) {
            if (this.gaussianSigma && this.gaussianSigma > 0.5) {
                let kernelSize = Math.ceil(this.gaussianSigma * 2);
                let alpha = (kernelSize - 1) / (2 * this.gaussianSigma);
                smoothingYs = GSL.gaussianSmooth(y, kernelSize, alpha);
            } else {
                smoothingYs = GSL.gaussianSmooth(y, 1, 1);
            }
        } else if (this.type === SmoothingType.HANNING) {
            smoothingYs = GSL.hanningSmooth(y, this.hanningSize);
        } else if (this.type === SmoothingType.DECIMATION) {
            let decimatedValues = GSL.decimation(x, y, this.decimationWidth);
            smoothingXs = decimatedValues.x;
            smoothingYs = decimatedValues.y;
        } else if (this.type === SmoothingType.BINNING) {
            smoothingXs = GSL.binning(x, this.binWidth);
            smoothingYs = GSL.binning(y, this.binWidth);
        } else if (this.type === SmoothingType.SAVITZKY_GOLAY) {
            smoothingYs = GSL.savitzkyGolaySmooth(x, y, this.savitzkyGolaySize, this.savitzkyGolayOrder);
        }
        return {x: smoothingXs, y: smoothingYs};
    }

    getSmoothingPoint2DArray(x: number[], y: Float32Array|Float64Array): Point2D[] {
        if (this.type === SmoothingType.NONE) {
            return [];
        }
        let smoothingArray: Point2D[] = [];
        const smoothingValues = this.getSmoothingValues(x, y);

        for (let i = 0; i < smoothingValues.x.length; i++) {
            smoothingArray.push({x: smoothingValues.x[i], y: smoothingValues.y[i]});
        }

        return smoothingArray;
    }

    getDecimatedPoint2DArray(x: number[], y: Float32Array|Float64Array, decimationWidth: number): Point2D[] {
        if (!x || !y || x.length !== y.length) {
            return[];
        }

        let decimatedArray: Point2D[] = [];
        let decimatedValues = GSL.decimation(x, y, decimationWidth);
        for (let i = 0; i < x.length; i++) {
            decimatedArray.push({x: decimatedValues.x[i], y: decimatedValues.y[i]});
        }
        return decimatedArray;
    }

}