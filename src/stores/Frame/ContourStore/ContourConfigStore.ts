import type {RgbaColor} from "@uiw/react-color";
import {type CARTA} from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";
import type {WorkspaceContourConfig} from "models";
import tinycolor from "tinycolor2";

import {ContourDashMode} from "enums";
import {type PreferenceStore} from "stores";

export class ContourConfigStore {
    @observable isEnabled: boolean = false;
    @observable levels: number[] = [];
    @observable smoothingMode: CARTA.SmoothingMode;
    @observable smoothingFactor: number;

    @observable color: RgbaColor;
    @observable isColormapEnabled: boolean = false;
    @observable isColormapInverted: boolean = false;
    @observable colormap: string;
    @observable colormapContrast: number = 1.0;
    @observable colormapBias: number = 0.0;
    @observable dashMode: ContourDashMode = ContourDashMode.NegativeOnly;
    @observable thickness: number;
    @observable isVisible: boolean = true;

    private readonly preferenceStore: PreferenceStore;

    constructor(preferenceStore: PreferenceStore) {
        this.preferenceStore = preferenceStore;
        this.smoothingMode = this.preferenceStore.contourSmoothingMode;
        this.smoothingFactor = this.preferenceStore.contourSmoothingFactor;

        this.color = tinycolor(this.preferenceStore.contourColor).toRgb();
        this.isColormapEnabled = this.preferenceStore.isContourColormapEnabled;
        this.isColormapInverted = this.preferenceStore.isContourColormapInverted;
        this.colormap = this.preferenceStore.contourColormap;
        this.thickness = this.preferenceStore.contourThickness;
        makeObservable(this);
    }

    @action setEnabled(isEnabled: boolean) {
        this.isEnabled = isEnabled;
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

    @action setColormapEnabled = (isColormapEnabled: boolean) => {
        this.isColormapEnabled = isColormapEnabled;
    };

    @action setColormapInverted = (isColormapInverted: boolean) => {
        this.isColormapInverted = isColormapInverted;
    };

    @action setColormapBias = (val: number) => {
        this.colormapBias = val;
    };

    @action setColormapContrast = (val: number) => {
        this.colormapContrast = val;
    };

    @action setVisible = (isVisible: boolean) => {
        this.isVisible = isVisible;
    };

    @action toggleVisibility = () => {
        this.isVisible = !this.isVisible;
    };

    @action updateFromWorkspace = (config: WorkspaceContourConfig) => {
        this.levels = config.levels;
        this.smoothingMode = config.smoothingMode;
        this.smoothingFactor = config.smoothingFactor;
        this.colormapContrast = config.colormapContrast;
        this.colormapBias = config.colormapBias;
        this.dashMode = config.dashMode;
        this.thickness = config.thickness;
        this.isVisible = config.visible;

        this.isColormapEnabled = config.colormapEnabled;
        this.isColormapInverted = config.colormapInverted ?? this.isColormapInverted;
        if (config.color) {
            this.color = config.color;
        }
        if (config.colormap) {
            this.colormap = config.colormap;
        }
    };
}
