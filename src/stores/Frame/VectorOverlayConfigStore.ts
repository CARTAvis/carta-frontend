import {action, observable, makeObservable} from "mobx";
import tinycolor from "tinycolor2";
import {RGBColor} from "react-color";
import {PreferenceStore} from "stores";

export enum VectorOverlayMode {
    IntensityOnly = "intensity-only", // blocks of non-uniform area
    AngleOnly = "angle-only", // lines with uniform length
    IntensityAndAngle = "intensity-and-angle" // lines with non-uniform length
}

export class VectorOverlayConfigStore {
    // Generator config
    @observable enabled: boolean;
    @observable mode: VectorOverlayMode;
    @observable fractionalIntensity: boolean;
    @observable pixelAveraging: number;
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

    private readonly preferenceStore: PreferenceStore;

    constructor(preferenceStore: PreferenceStore) {
        makeObservable(this);
        this.preferenceStore = preferenceStore;
        this.enabled = false;
        this.mode = this.preferenceStore.vectorOverlayMode;
        this.fractionalIntensity = this.preferenceStore.vectorOverlayFractionalIntensity;
        this.pixelAveraging = this.preferenceStore.vectorOverlayPixelAveraging;
        this.threshold = 0.0;
        this.debiasing = false;

        this.color = tinycolor(this.preferenceStore.vectorOverlayColor).toRgb();
        this.colormapEnabled = this.preferenceStore.vectorOverlayColormapEnabled;
        this.colormap = this.preferenceStore.vectorOverlayColormap;
        this.colormapBias = 0.0;
        this.colormapContrast = 1.0;
        this.thickness = this.preferenceStore.vectorOverlayThickness;
        this.lengthMin = 0;
        this.lengthMax = 10;
        this.visible = true;
    }

    @action setEnabled(val: boolean) {
        this.enabled = val;
    }

    @action setVectorOverlayConfiguration = (mode: VectorOverlayMode, pixelAveraging: number, threshold: number = 0, debiasing: boolean = false, fractionalIntensity: boolean = false) => {
        this.mode = mode;
        this.pixelAveraging = pixelAveraging;
        this.threshold = threshold;
        this.debiasing = debiasing;
        this.fractionalIntensity = fractionalIntensity;
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

    @action setVisible = (visible: boolean) => {
        this.visible = visible;
    };

    @action toggleVisibility = () => {
        this.visible = !this.visible;
    };
}
