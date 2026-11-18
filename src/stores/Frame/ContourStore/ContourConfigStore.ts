import type {RgbaColor} from "@uiw/react-color";
import {CARTA} from "carta-protobuf";
import * as _ from "lodash";
import {action, makeObservable, observable} from "mobx";
import type {ConfigurableStore, WorkspaceContourConfig} from "models";
import tinycolor from "tinycolor2";

import {ContourDashMode} from "enums";
import {type PreferenceStore} from "stores";

export class ContourConfigStore implements ConfigurableStore<WorkspaceContourConfig | undefined, WorkspaceContourConfig> {
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

    /**
     * Applies the settings that a workspace saved. A setting that is left out or not valid keeps its
     * value. The contours of an image that opens start from the preferences. The colormap inversion
     * is the exception: a workspace that leaves it out was saved before CARTA could invert the
     * colormap, so the colormap is not inverted.
     */
    @action applyConfig = (config: WorkspaceContourConfig) => {
        const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
        if (Array.isArray(config.levels) && config.levels.every(isNumber)) {
            this.levels = [...config.levels];
        }
        if (Number.isInteger(config.smoothingMode) && CARTA.SmoothingMode[config.smoothingMode] !== undefined) {
            this.smoothingMode = config.smoothingMode;
        }
        if (Number.isInteger(config.smoothingFactor) && config.smoothingFactor >= 1) {
            this.smoothingFactor = config.smoothingFactor;
        }
        if (isNumber(config.colormapContrast)) {
            this.colormapContrast = config.colormapContrast;
        }
        if (isNumber(config.colormapBias)) {
            this.colormapBias = config.colormapBias;
        }
        if (Object.values(ContourDashMode).includes(config.dashMode)) {
            this.dashMode = config.dashMode;
        }
        if (isNumber(config.thickness) && config.thickness > 0) {
            this.thickness = config.thickness;
        }
        if (typeof config.visible === "boolean") {
            this.isVisible = config.visible;
        }
        if (typeof config.colormapEnabled === "boolean") {
            this.isColormapEnabled = config.colormapEnabled;
        }
        this.isColormapInverted = config.colormapInverted === true;
        if (config.color) {
            this.color = config.color;
        }
        if (config.colormap) {
            this.colormap = config.colormap;
        }
    };

    public toConfig = (): WorkspaceContourConfig | undefined => {
        return this.isEnabled ? this.settings() : undefined;
    };

    /**
     * Returns the settings when the contours are off and the settings differ from the settings that a
     * new image starts with. Otherwise returns undefined.
     */
    public toUnappliedConfig = (): WorkspaceContourConfig | undefined => {
        if (this.isEnabled) {
            return undefined;
        }
        const settings = this.settings();
        return _.isEqual(settings, new ContourConfigStore(this.preferenceStore).settings()) ? undefined : settings;
    };

    private settings(): WorkspaceContourConfig {
        return {
            levels: this.levels,
            smoothingMode: this.smoothingMode,
            smoothingFactor: this.smoothingFactor,
            color: this.color,
            colormapEnabled: this.isColormapEnabled,
            colormapInverted: this.isColormapInverted,
            colormap: this.colormap,
            colormapContrast: this.colormapContrast,
            colormapBias: this.colormapBias,
            dashMode: this.dashMode,
            thickness: this.thickness,
            visible: this.isVisible
        };
    }
}
