import {action, observable, makeObservable} from "mobx";
import tinycolor from "tinycolor2";
import {RGBColor} from "react-color";
import {PreferenceStore} from "stores";

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

    private readonly preferenceStore: PreferenceStore;
    public static DefaultLengthMin = 0;
    public static DefaultLengthMax = 20;

    constructor(preferenceStore: PreferenceStore) {
        makeObservable(this);
        this.preferenceStore = preferenceStore;
        this.enabled = false;
        this.angularSource = VectorOverlaySource.Current;
        this.intensitySource = VectorOverlaySource.Current;
        this.fractionalIntensity = this.preferenceStore.vectorOverlayFractionalIntensity;
        this.pixelAveraging = this.preferenceStore.vectorOverlayPixelAveraging;
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
}
