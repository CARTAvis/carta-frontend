import type {RgbaColor} from "@uiw/react-color";
import {CARTA} from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";
import type {ConfigurableStore, WorkspaceVectorOverlayConfig} from "models";
import tinycolor from "tinycolor2";

import {VectorOverlaySource} from "enums";
import {type PreferenceStore} from "stores";
import {type FrameStore} from "stores/Frame";

export class VectorOverlayConfigStore implements ConfigurableStore<WorkspaceVectorOverlayConfig | undefined, WorkspaceVectorOverlayConfig> {
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

    /**
     * Applies the settings that a workspace saved. A setting that is left out or not valid keeps its
     * value. The vector overlay of an image that opens starts from the preferences. The colormap
     * inversion is the exception. A workspace that leaves it out was saved before CARTA could invert
     * the colormap, so the colormap is not inverted.
     */
    @action applyConfig = (config: WorkspaceVectorOverlayConfig) => {
        const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
        const isSource = (value: unknown): value is VectorOverlaySource => Object.values(VectorOverlaySource).includes(value as VectorOverlaySource);
        if (isSource(config.angularSource)) {
            this.angularSource = config.angularSource;
        }
        if (isSource(config.intensitySource)) {
            this.intensitySource = config.intensitySource;
        }
        if (Number.isInteger(config.pixelAveraging) && config.pixelAveraging >= 0) {
            this.pixelAveraging = config.pixelAveraging;
        }
        if (typeof config.fractionalIntensity === "boolean") {
            this.isFractionalIntensity = config.fractionalIntensity;
        }
        if (typeof config.thresholdEnabled === "boolean") {
            this.isThresholdEnabled = config.thresholdEnabled;
        }
        if (isNumber(config.threshold)) {
            this.threshold = config.threshold;
        }
        if (typeof config.debiasing === "boolean") {
            this.isDebiasing = config.debiasing;
        }
        if (isNumber(config.qError)) {
            this.qError = config.qError;
        }
        if (isNumber(config.uError)) {
            this.uError = config.uError;
        }
        if (config.thresholdOption === CARTA.PolarizationType.I || config.thresholdOption === CARTA.PolarizationType.Plinear) {
            this.thresholdOption = config.thresholdOption;
        }

        if (typeof config.visible === "boolean") {
            this.isVisible = config.visible;
        }
        if (isNumber(config.thickness) && config.thickness > 0) {
            this.thickness = config.thickness;
        }
        if (isNumber(config.colormapBias)) {
            this.colormapBias = config.colormapBias;
        }
        if (isNumber(config.colormapContrast)) {
            this.colormapContrast = config.colormapContrast;
        }
        if (isNumber(config.lengthMin)) {
            this.lengthMin = config.lengthMin;
        }
        if (isNumber(config.lengthMax)) {
            this.lengthMax = config.lengthMax;
        }
        // An intensity range that is left out follows the data.
        this.intensityMin = isNumber(config.intensityMin) ? config.intensityMin : undefined;
        this.intensityMax = isNumber(config.intensityMax) ? config.intensityMax : undefined;
        if (isNumber(config.rotationOffset)) {
            this.rotationOffset = config.rotationOffset;
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

    public toConfig = (): WorkspaceVectorOverlayConfig | undefined => {
        return this.isEnabled ? this.settings() : undefined;
    };

    /** Returns the settings when the vector overlay is off, as {@link ContourConfigStore.toUnappliedConfig} does. Otherwise returns undefined. */
    public toUnappliedConfig = (): WorkspaceVectorOverlayConfig | undefined => {
        return this.isEnabled ? undefined : this.settings();
    };

    private settings(): WorkspaceVectorOverlayConfig {
        return {
            angularSource: this.angularSource,
            intensitySource: this.intensitySource,
            fractionalIntensity: this.isFractionalIntensity,
            pixelAveraging: this.pixelAveraging,
            thresholdEnabled: this.isThresholdEnabled,
            threshold: this.threshold,
            debiasing: this.isDebiasing,
            qError: this.qError,
            uError: this.uError,
            thresholdOption: this.thresholdOption,
            visible: this.isVisible,
            thickness: this.thickness,
            colormapEnabled: this.isColormapEnabled,
            colormapInverted: this.isColormapInverted,
            color: this.color,
            colormap: this.colormap,
            colormapContrast: this.colormapContrast,
            colormapBias: this.colormapBias,
            lengthMin: this.lengthMin,
            lengthMax: this.lengthMax,
            intensityMin: this.intensityMin,
            intensityMax: this.intensityMax,
            rotationOffset: this.rotationOffset
        };
    }
}
