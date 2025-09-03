import type {RGBColor} from "react-color";
import {CARTA} from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";
import type {WorkspaceVectorOverlayConfig} from "models";
import tinycolor from "tinycolor2";

import {VectorOverlaySource} from "enums";
import {PreferenceStore} from "stores";
import {FrameStore} from "stores/Frame";

export class VectorOverlayConfigStore {
    // Generator config
    @observable enabled: boolean = false;
    @observable angularSource: VectorOverlaySource = VectorOverlaySource.Current;
    @observable intensitySource: VectorOverlaySource = VectorOverlaySource.Current;
    @observable fractionalIntensity: boolean = false;
    @observable pixelAveragingEnabled: boolean = false;
    @observable pixelAveraging: number = 0;
    @observable thresholdEnabled: boolean = false;
    @observable threshold: number = 0;
    @observable debiasing: boolean = false;
    @observable qError: number = 0;
    @observable uError: number = 0;
    @observable thresholdOption: CARTA.PolarizationType.I | CARTA.PolarizationType.Plinear = CARTA.PolarizationType.I;

    // Appearance
    @observable visible: boolean = true;
    @observable thickness: number = 1;
    @observable colormapEnabled: boolean = false;
    @observable color: RGBColor = {r: 0, g: 0, b: 0, a: 1};
    @observable colormap: string = "";
    @observable colormapContrast: number = 1.0;
    @observable colormapBias: number = 0.0;
    @observable lengthMin: number = VectorOverlayConfigStore.DefaultLengthMin;
    @observable lengthMax: number = VectorOverlayConfigStore.DefaultLengthMax;
    @observable intensityMin: number | undefined = undefined;
    @observable intensityMax: number | undefined = undefined;
    @observable rotationOffset: number = 0;

    private readonly preferenceStore: PreferenceStore;
    public static DefaultLengthMin = 0;
    public static DefaultLengthMax = 20;

    constructor(preferenceStore: PreferenceStore, frame: FrameStore) {
        this.preferenceStore = preferenceStore;
        this.angularSource = frame.hasLinearStokes ? VectorOverlaySource.Computed : VectorOverlaySource.Current;
        this.intensitySource = frame.hasLinearStokes ? VectorOverlaySource.Computed : VectorOverlaySource.Current;
        this.fractionalIntensity = this.preferenceStore.vectorOverlayFractionalIntensity;
        this.pixelAveraging = this.preferenceStore.vectorOverlayPixelAveraging;
        this.pixelAveragingEnabled = this.preferenceStore.vectorOverlayPixelAveraging > 0;
        this.thresholdOption = frame.hasLinearStokes ? CARTA.PolarizationType.Plinear : CARTA.PolarizationType.I;

        this.color = tinycolor(this.preferenceStore.vectorOverlayColor).toRgb();
        this.colormapEnabled = this.preferenceStore.vectorOverlayColormapEnabled;
        this.colormap = this.preferenceStore.vectorOverlayColormap;
        this.thickness = this.preferenceStore.vectorOverlayThickness;
        makeObservable(this);
    }

    @action setEnabled(val: boolean) {
        this.enabled = val;
    }

    @action setThresholdEnabled(val: boolean) {
        this.thresholdEnabled = val;
    }

    @action setThresholdOption(val: CARTA.PolarizationType.I | CARTA.PolarizationType.Plinear) {
        this.thresholdOption = val;
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
        uError: number,
        thresholdOption: CARTA.PolarizationType.I | CARTA.PolarizationType.Plinear
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
        this.thresholdOption = thresholdOption;
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

    @action setIntensityRange = (min: number | undefined, max: number | undefined) => {
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
        this.thresholdOption = config.thresholdOption;

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
