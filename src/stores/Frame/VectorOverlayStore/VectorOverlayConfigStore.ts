import type {RgbaColor} from "@uiw/react-color";
import {CARTA} from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";
import type {WorkspaceVectorOverlayConfig} from "models";
import tinycolor from "tinycolor2";

import {VectorOverlaySource} from "enums";
import {type PreferenceStore} from "stores";
import {type FrameStore} from "stores/Frame";

export class VectorOverlayConfigStore {
    // Generator config
    @observable isEnabled: boolean = false;
    @observable angularSource: VectorOverlaySource = VectorOverlaySource.Current;
    @observable intensitySource: VectorOverlaySource = VectorOverlaySource.Current;
    @observable isFractionalIntensity: boolean = false;
    @observable pixelAveraging: number = 0;
    @observable isThresholdEnabled: boolean = false;
    @observable threshold: number = 0;
    @observable isDebiasing: boolean = false;
    @observable qError: number = 0;
    @observable uError: number = 0;
    @observable thresholdOption: CARTA.PolarizationType.I | CARTA.PolarizationType.Plinear = CARTA.PolarizationType.I;

    // Appearance
    @observable isVisible: boolean = true;
    @observable thickness: number = 1;
    @observable isColormapEnabled: boolean = false;
    @observable isColormapInverted: boolean = false;
    @observable color: RgbaColor = {r: 0, g: 0, b: 0, a: 1};
    @observable colormap: string = "";
    @observable colormapContrast: number = 1.0;
    @observable colormapBias: number = 0.0;
    @observable lengthMin: number = VectorOverlayConfigStore.defaultLengthMin;
    @observable lengthMax: number = VectorOverlayConfigStore.defaultLengthMax;
    @observable intensityMin: number | undefined = undefined;
    @observable intensityMax: number | undefined = undefined;
    @observable rotationOffset: number = 0;

    private readonly preferenceStore: PreferenceStore;
    public static defaultLengthMin = 0;
    public static defaultLengthMax = 20;

    constructor(preferenceStore: PreferenceStore, frame: FrameStore) {
        this.preferenceStore = preferenceStore;
        this.angularSource = frame.hasLinearStokes ? VectorOverlaySource.Computed : VectorOverlaySource.Current;
        this.intensitySource = frame.hasLinearStokes ? VectorOverlaySource.Computed : VectorOverlaySource.Current;
        this.isFractionalIntensity = this.preferenceStore.isVectorOverlayFractionalIntensity;
        this.pixelAveraging = this.preferenceStore.vectorOverlayPixelAveraging;
        this.thresholdOption = frame.hasLinearStokes ? CARTA.PolarizationType.Plinear : CARTA.PolarizationType.I;

        this.color = tinycolor(this.preferenceStore.vectorOverlayColor).toRgb();
        this.isColormapEnabled = this.preferenceStore.isVectorOverlayColormapEnabled;
        this.isColormapInverted = this.preferenceStore.isVectorOverlayColormapInverted;
        this.colormap = this.preferenceStore.vectorOverlayColormap;
        this.thickness = this.preferenceStore.vectorOverlayThickness;
        makeObservable(this);
    }

    @action setEnabled(isEnabled: boolean) {
        this.isEnabled = isEnabled;
    }

    @action setThresholdEnabled(isThresholdEnabled: boolean) {
        this.isThresholdEnabled = isThresholdEnabled;
    }

    @action setThresholdOption(val: CARTA.PolarizationType.I | CARTA.PolarizationType.Plinear) {
        this.thresholdOption = val;
    }

    @action setVectorOverlayConfiguration = (
        angularSource: VectorOverlaySource,
        intensitySource: VectorOverlaySource,
        pixelAveraging: number,
        isFractionalIntensity: boolean,
        isThresholdEnabled: boolean,
        threshold: number,
        isDebiasing: boolean,
        qError: number,
        uError: number,
        thresholdOption: CARTA.PolarizationType.I | CARTA.PolarizationType.Plinear
    ) => {
        this.angularSource = angularSource;
        this.intensitySource = intensitySource;
        this.pixelAveraging = pixelAveraging;
        this.isFractionalIntensity = isFractionalIntensity;
        this.isThresholdEnabled = isThresholdEnabled;
        this.threshold = threshold;
        this.isDebiasing = isDebiasing;
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

    @action setVisible = (isVisible: boolean) => {
        this.isVisible = isVisible;
    };

    @action toggleVisibility = () => {
        this.isVisible = !this.isVisible;
    };

    @action updateFromWorkspace = (config: WorkspaceVectorOverlayConfig) => {
        this.angularSource = config.angularSource;
        this.intensitySource = config.intensitySource;
        this.pixelAveraging = config.pixelAveraging;
        this.isFractionalIntensity = config.fractionalIntensity;
        this.isThresholdEnabled = config.thresholdEnabled;
        this.threshold = config.threshold;
        this.isDebiasing = config.debiasing;
        this.qError = config.qError;
        this.uError = config.uError;
        this.thresholdOption = config.thresholdOption;

        this.isVisible = config.visible;
        this.thickness = config.thickness;
        this.colormapBias = config.colormapBias;
        this.colormapContrast = config.colormapContrast;
        this.lengthMin = config.lengthMin;
        this.lengthMax = config.lengthMax;
        this.intensityMin = config.intensityMin;
        this.intensityMax = config.intensityMax;
        this.rotationOffset = config.rotationOffset;

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
