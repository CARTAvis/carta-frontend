import {RGBColor} from "react-color";
import {action, makeObservable, observable} from "mobx";
import tinycolor from "tinycolor2";

import {WorkspaceVectorOverlayConfig} from "models";
import {PreferenceStore} from "stores";
import {FrameStore} from "stores/Frame";

export enum VectorOverlaySource {
    None = -1,
    Current = 0,
    Computed = 1
}

export class VectorOverlayConfigStore {
    // Generator config
    @observable enabled: boolean;
    @observable angularSource: VectorOverlaySource;
    @observable intensitySource: VectorOverlaySource;
    @observable fractionalIntensity: boolean;
    @observable pixelAveragingEnabled: boolean;
    @observable pixelAveraging: number;
    @observable thresholdEnabled: boolean;
    @observable threshold: number;
    @observable debiasing: boolean;
    @observable qError: number;
    @observable uError: number;

    // Appearance
    @observable visible: boolean;
    @observable thickness: number;
    @observable colormapEnabled: boolean;
    @observable color: RGBColor;
    @observable colormap: string;
    @observable colormapContrast: number;
    @observable colormapBias: number;
    @observable lengthMin: number;
    @observable lengthMax: number;
    @observable intensityMin: number;
    @observable intensityMax: number;
    @observable rotationOffset: number;
    @observable customColorHex: string;

    private readonly preferenceStore: PreferenceStore;
    public static DefaultLengthMin = 0;
    public static DefaultLengthMax = 20;

    constructor(preferenceStore: PreferenceStore, frame: FrameStore) {
        makeObservable(this);
        this.preferenceStore = preferenceStore;
        this.enabled = false;
        this.angularSource = frame.hasLinearStokes ? VectorOverlaySource.Computed : VectorOverlaySource.Current;
        this.intensitySource = frame.hasLinearStokes ? VectorOverlaySource.Computed : VectorOverlaySource.Current;
        this.fractionalIntensity = this.preferenceStore.vectorOverlayFractionalIntensity;
        this.pixelAveraging = this.preferenceStore.vectorOverlayPixelAveraging;
        this.pixelAveragingEnabled = this.preferenceStore.vectorOverlayPixelAveraging > 0;
        this.threshold = 0;
        this.thresholdEnabled = false;
        this.debiasing = false;

        this.color = tinycolor(this.preferenceStore.vectorOverlayColor).toRgb();
        this.colormapEnabled = this.preferenceStore.vectorOverlayColormapEnabled;
        this.colormap = this.preferenceStore.vectorOverlayColormap;
        this.colormapBias = 0.0;
        this.colormapContrast = 1.0;
        this.thickness = this.preferenceStore.vectorOverlayThickness;
        this.lengthMin = VectorOverlayConfigStore.DefaultLengthMin;
        this.lengthMax = VectorOverlayConfigStore.DefaultLengthMax;
        this.intensityMin = undefined;
        this.intensityMax = undefined;
        this.rotationOffset = 0;
        this.visible = true;
        this.customColorHex = this.preferenceStore.vectorOverlayColorHex;
    }

    @action setEnabled(val: boolean) {
        this.enabled = val;
    }

    @action setThresholdEnabled(val: boolean) {
        this.thresholdEnabled = val;
    }

    @action setVectorOverlayConfiguration = (
        angularSource: VectorOverlaySource,
        intensitySource: VectorOverlaySource,
        pixelAveragingEnabled: boolean,
        pixelAveraging: number,
        fractionalIntensity: boolean,
        thresholdEnabled: boolean,
        threshold: number,
        debiasing: boolean,
        qError: number,
        uError: number
    ) => {
        this.angularSource = angularSource;
        this.intensitySource = intensitySource;
        this.pixelAveragingEnabled = pixelAveragingEnabled;
        this.pixelAveraging = pixelAveraging;
        this.fractionalIntensity = fractionalIntensity;
        this.thresholdEnabled = thresholdEnabled;
        this.threshold = threshold;
        this.debiasing = debiasing;
        this.qError = qError;
        this.uError = uError;
    };

    // Styling
    @action setColor = (color: tinycolor.ColorInput) => {
        const colorObj = tinycolor(color);
        if (colorObj.isValid()) {
            this.color = colorObj.toRgb();
        }
    };

    @action setThickness = (val: number) => {
        this.thickness = val;
    };

    @action setColormap = (colormap: string) => {
        this.colormap = colormap;
    };

    @action setCustomColorMap = (colorHex: string, colormap: string) => {
        this.customColorHex = colorHex;
        this.setColormap(colormap);
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

    @action setLengthRange = (min: number, max: number) => {
        this.lengthMin = min;
        this.lengthMax = max;
    };

    @action setIntensityRange = (min: number, max: number) => {
        this.intensityMin = min;
        this.intensityMax = max;
    };

    @action setRotationOffset = (val: number) => {
        this.rotationOffset = val;
    };

    @action setVisible = (visible: boolean) => {
        this.visible = visible;
    };

    @action toggleVisibility = () => {
        this.visible = !this.visible;
    };

    @action updateFromWorkspace = (config: WorkspaceVectorOverlayConfig) => {
        this.angularSource = config.angularSource;
        this.intensitySource = config.intensitySource;
        this.pixelAveragingEnabled = config.pixelAveragingEnabled;
        this.pixelAveraging = config.pixelAveraging;
        this.fractionalIntensity = config.fractionalIntensity;
        this.thresholdEnabled = config.thresholdEnabled;
        this.threshold = config.threshold;
        this.debiasing = config.debiasing;
        this.qError = config.qError;
        this.uError = config.uError;

        this.visible = config.visible;
        this.thickness = config.thickness;
        this.colormapBias = config.colormapBias;
        this.colormapContrast = config.colormapContrast;
        this.lengthMin = config.lengthMin;
        this.lengthMax = config.lengthMax;
        this.intensityMin = config.intensityMin;
        this.intensityMax = config.intensityMax;
        this.rotationOffset = config.rotationOffset;

        this.colormapEnabled = config.colormapEnabled;
        if (config.color) {
            this.color = config.color;
        }
        if (config.colormap) {
            this.colormap = config.colormap;
        }
    };
}
