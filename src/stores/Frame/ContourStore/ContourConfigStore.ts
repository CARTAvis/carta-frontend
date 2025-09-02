import type {RGBColor} from "react-color";
import {CARTA} from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";
import type {WorkspaceContourConfig} from "models";
import tinycolor from "tinycolor2";

import {ContourDashMode} from "enums";
import {PreferenceStore} from "stores";

export class ContourConfigStore {
    @observable enabled: boolean = false;
    @observable levels: number[] = [];
    @observable smoothingMode: CARTA.SmoothingMode = 0;
    @observable smoothingFactor: number = 0;

    @observable color: RGBColor = {r: 0, g: 0, b: 0, a: 1};
    @observable colormapEnabled: boolean = false;
    @observable colormap: string = "";
    @observable colormapContrast: number = 1.0;
    @observable colormapBias: number = 0.0;
    @observable dashMode: ContourDashMode = ContourDashMode.NegativeOnly;
    @observable thickness: number = 1;
    @observable visible: boolean = true;

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

    @action updateFromWorkspace = (config: WorkspaceContourConfig) => {
        this.levels = config.levels;
        this.smoothingMode = config.smoothingMode;
        this.smoothingFactor = config.smoothingFactor;
        this.colormapContrast = config.colormapContrast;
        this.colormapBias = config.colormapBias;
        this.dashMode = config.dashMode;
        this.thickness = config.thickness;
        this.visible = config.visible;

        this.colormapEnabled = config.colormapEnabled;
        if (config.color) {
            this.color = config.color;
        }
        if (config.colormap) {
            this.colormap = config.colormap;
        }
    };
}
