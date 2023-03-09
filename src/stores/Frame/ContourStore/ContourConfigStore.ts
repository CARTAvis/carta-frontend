import {RGBColor} from "react-color";
import {CARTA} from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";
import tinycolor from "tinycolor2";

import {PreferenceStore} from "stores";

export enum ContourGeneratorType {
    StartStepMultiplier = "start-step-multiplier",
    MinMaxNScaling = "min-max-scaling",
    PercentagesRefValue = "percentages-ref.value",
    MeanSigmaList = "mean-sigma-list"
}

export enum ContourDashMode {
    None = "None",
    Dashed = "Dashed",
    NegativeOnly = "Negative only"
}

export class ContourConfigStore {
    @observable enabled: boolean;
    @observable levels: number[];
    @observable smoothingMode: CARTA.SmoothingMode;
    @observable smoothingFactor: number;

    @observable color: RGBColor;
    @observable colormapEnabled: boolean;
    @observable colormap: string;
    @observable colormapContrast: number;
    @observable colormapBias: number;
    @observable dashMode: ContourDashMode;
    @observable thickness: number;
    @observable visible: boolean;

    private readonly preferenceStore: PreferenceStore;

    constructor(preferenceStore: PreferenceStore) {
        makeObservable(this);
        this.preferenceStore = preferenceStore;
        this.enabled = false;
        this.levels = [];
        this.smoothingMode = this.preferenceStore.contourSmoothingMode;
        this.smoothingFactor = this.preferenceStore.contourSmoothingFactor;

        this.color = tinycolor(this.preferenceStore.contourColor).toRgb();
        this.colormapEnabled = this.preferenceStore.contourColormapEnabled;
        this.colormap = this.preferenceStore.contourColormap;
        this.colormapBias = 0.0;
        this.colormapContrast = 1.0;
        this.thickness = this.preferenceStore.contourThickness;
        this.dashMode = ContourDashMode.NegativeOnly;
        this.visible = true;
    }

    @action setEnabled(val: boolean) {
        this.enabled = val;
    }

    @action setContourConfiguration = (levels: number[], smoothingMode: CARTA.SmoothingMode, smoothingFactor: number) => {
        this.levels = levels;
        this.smoothingMode = smoothingMode;
        this.smoothingFactor = smoothingFactor;
    };

    // Styling
    @action setColor = (color: tinycolor.ColorInput) => {
        const colorObj = tinycolor(color);
        if (colorObj.isValid()) {
            this.color = colorObj.toRgb();
        }
    };

    @action setDashMode = (mode: ContourDashMode) => {
        this.dashMode = mode;
    };

    @action setThickness = (val: number) => {
        this.thickness = val;
    };

    @action setColormap = (colormap: string) => {
        this.colormap = colormap;
    };

    @action setColormapEnabled = (val: boolean) => {
        this.colormapEnabled = val;
    };

    @action setColormapBias = (val: number) => {
        this.colormapBias = val;
    };

    @action setColormapContrast = (val: number) => {
        this.colormapContrast = val;
    };

    @action setVisible = (visible: boolean) => {
        this.visible = visible;
    };

    @action toggleVisibility = () => {
        this.visible = !this.visible;
    };
}
