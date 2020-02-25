import {action, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {PreferenceStore} from "./PreferenceStore";
import {hexStringToRgba, RGBA} from "../utilities";

export enum ContourGeneratorType {
    StartStepMultiplier = "start-step-multiplier",
    MinMaxNScaling = "min-max-scaling",
    PercentagesRefValue = "percentages-ref.value",
    MeanSigmaList = "mean-sigma-list"
}

export enum ContourDashMode {
    None,
    Dashed,
    NegativeOnly
}

export class ContourConfigStore {
    @observable enabled: boolean;
    @observable levels: number[];
    @observable smoothingMode: CARTA.SmoothingMode;
    @observable smoothingFactor: number;

    @observable color: RGBA;
    @observable colormapEnabled: boolean;
    @observable colormap: string;
    @observable colormapContrast: number;
    @observable colormapBias: number;
    @observable dashMode: ContourDashMode;
    @observable thickness: number;
    @observable visible: boolean;

    private readonly preferenceStore: PreferenceStore;

    constructor(preferenceStore: PreferenceStore) {
        this.preferenceStore = preferenceStore;
        this.enabled = false;
        this.levels = [];
        this.smoothingMode = this.preferenceStore.contourSmoothingMode;
        this.smoothingFactor = this.preferenceStore.contourSmoothingFactor;

        this.color = hexStringToRgba(this.preferenceStore.contourColor);
        this.colormapEnabled = this.preferenceStore.contourColormapEnabled;
        this.colormap = this.preferenceStore.contourColormap;
        this.colormapBias = 0.0;
        this.colormapContrast = 1.0;
        this.thickness = 1.0;
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
    @action setColor = (color: RGBA) => {
        this.color = color;
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