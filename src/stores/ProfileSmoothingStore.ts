import {action, computed, observable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {PlotType, SmoothingType} from "components/Shared";

export class ProfileSmoothingStore {
    @observable type: SmoothingType;
    @observable lineColor: { colorHex: string, fixed: boolean };
    @observable lineType: PlotType;
    @observable lineWidth: number;
    @observable isOverlayOn: boolean;
    @observable boxcarSize: number;
    @observable gaussianSigma: number;
    @observable hanningSize: number;
    @observable decimationValue: number;
    @observable binWidth: number;
    @observable savitzkyGolaySize: number;
    @observable savitzkyGolayOrder: number;

    constructor() {
        this.type = SmoothingType.NONE;
        this.lineColor = { colorHex: Colors.ORANGE2, fixed: false };
        this.lineType = PlotType.STEPS;
        this.lineWidth = 1;
        this.isOverlayOn = false;
        this.boxcarSize = 2;
        this.gaussianSigma = 1.0;
        this.hanningSize = 3;
        this.decimationValue = 2;
        this.binWidth = 2;
        this.savitzkyGolaySize = 5;
        this.savitzkyGolayOrder = 0;
    }

    @action setType = (val: SmoothingType) => {
        this.type = val;
    }

    @action setLineColor = (colorHex: string, fixed: boolean) => {
        this.lineColor = { colorHex: colorHex, fixed: fixed };
    }

    @action setLineType = (val: PlotType) => {
        this.lineType = val;
    }

    @action setLineWidth = (val: number) => {
        this.lineWidth = val;
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

    @action setDecimationValue = (val: number) => {
        this.decimationValue = val;
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
            exportData.set("decimation value", String(this.decimationValue));
        } else if (this.type === SmoothingType.BINNING) {
            exportData.set("bin width", String(this.setBinWidth));
        } else if (this.type === SmoothingType.SAVITZKY_GOLAY) {
            exportData.set("kernel", String(this.savitzkyGolaySize));
            exportData.set("order", String(this.savitzkyGolayOrder));
        }
        return exportData;
    }

}