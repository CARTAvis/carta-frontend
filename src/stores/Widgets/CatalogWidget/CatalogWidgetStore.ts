import {Colors} from "@blueprintjs/core";
import * as CARTACompute from "carta_computation";
import {action, computed, type IReactionDisposer, makeObservable, observable, reaction} from "mobx";

import {AngularSizeUnit, CatalogDisplayMode, CatalogMapType, CatalogOverlay, CatalogOverlayShape, CatalogPlotType, CatalogSettingsTabs, CatalogSizeUnits, type CatalogSystemType, CatalogTextureType, ColorMap, FrameScaling} from "enums";
import {FACTOR_TO_ARCSEC} from "models";
import {CatalogWebGLService} from "services";
import {AppStore, CatalogStore, PreferenceStore} from "stores";
import {clamp, getDefaultScalingParameter, minMaxArray, sanitizeScalingParameter} from "utilities";

export type ValueClip = "size-min" | "size-max" | "angle-min" | "angle-max";
type CatalogSourceRadiusMode = "diameter" | "radius";

const PARAMETERIZED_SCALINGS = [FrameScaling.LOG, FrameScaling.GAMMA, FrameScaling.POWER, FrameScaling.SINH, FrameScaling.ASINH];

function createScalingParameters(): Map<FrameScaling, number> {
    return new Map(PARAMETERIZED_SCALINGS.map(scaling => [scaling, getDefaultScalingParameter(scaling)]));
}

function getScalingParameter(parameters: Map<FrameScaling, number>, scaling: FrameScaling): number {
    return parameters.get(scaling) ?? getDefaultScalingParameter(scaling);
}

export class CatalogWidgetStore {
    public static readonly MIN_OVERLAY_SIZE = 1;
    public static readonly MAX_OVERLAY_SIZE = 50;
    public static readonly MAX_AREA_SIZE = 4000;
    public static readonly MIN_TABLE_SEPARATOR_POSITION = 0;
    public static readonly MAX_TABLE_SEPARATOR_POSITION = 100;
    public static readonly MIN_THICKNESS = 1.0;
    public static readonly MAX_THICKNESS = 10;
    public static readonly MIN_ANGLE = 0;
    public static readonly MAX_ANGLE = 720;
    public static readonly SIZE_MAP_MIN = 0;

    private overlaySize = new Map<string, {min: number; max: number}>([
        [CatalogSizeUnits.SCREENPIXEL, {min: 1, max: 50}],
        [CatalogSizeUnits.IMAGEPIXEL, {min: 1, max: 50}],
        [CatalogSizeUnits.MILLIARCSEC, {min: 0.01, max: 200}],
        [CatalogSizeUnits.ARCMIN, {min: 0.01, max: 120}],
        [CatalogSizeUnits.ARCSEC, {min: 0.01, max: 120}],
        [CatalogSizeUnits.DEG, {min: 0.01, max: 10}]
    ]);

    catalogSourceRadiusTypes = new Map<CatalogSourceRadiusMode, {label: string; value: number}>([
        ["diameter", {label: "Diameter", value: 1}],
        ["radius", {label: "Radius", value: 0.5}]
    ]);

    // -1 : apply different featherWidth according shape size
    private overlayShapeSettings = new Map<number, {featherWidth: number; diameterBase: number; areaBase: number; thicknessBase: number}>([
        [CatalogOverlayShape.BOX_LINED, {featherWidth: 0.35, diameterBase: 1.5, areaBase: 100, thicknessBase: 1.5}],
        [CatalogOverlayShape.CIRCLE_FILLED, {featherWidth: 0.35, diameterBase: 1.5, areaBase: 70, thicknessBase: 1}],
        [CatalogOverlayShape.CIRCLE_LINED, {featherWidth: 0.5, diameterBase: 1.5, areaBase: 70, thicknessBase: 1}],
        [CatalogOverlayShape.ELLIPSE_LINED, {featherWidth: -1.0, diameterBase: 8, areaBase: 100, thicknessBase: 1.5}],
        [CatalogOverlayShape.HEXAGON_LINED, {featherWidth: 0.35, diameterBase: 0, areaBase: 50, thicknessBase: 1.3}],
        [CatalogOverlayShape.RHOMB_LINED, {featherWidth: 0.35, diameterBase: 1.5, areaBase: 100, thicknessBase: 1.5}],
        [CatalogOverlayShape.TRIANGLE_LINED_UP, {featherWidth: 0.35, diameterBase: 0, areaBase: 20, thicknessBase: 2}],
        [CatalogOverlayShape.TRIANGLE_LINED_DOWN, {featherWidth: 0.35, diameterBase: 0, areaBase: 20, thicknessBase: 2}],
        [CatalogOverlayShape.HEXAGON_LINED_2, {featherWidth: 0.35, diameterBase: 0, areaBase: 50, thicknessBase: 1.3}],
        [CatalogOverlayShape.CROSS_FILLED, {featherWidth: 0.5, diameterBase: 3.5, areaBase: 150, thicknessBase: 1}],
        [CatalogOverlayShape.X_FILLED, {featherWidth: 0.5, diameterBase: 3.5, areaBase: 150, thicknessBase: 1}],
        [CatalogOverlayShape.LineSegment_FILLED, {featherWidth: 0.35, diameterBase: 3, areaBase: 100, thicknessBase: 1}]
    ]);

    @observable catalogFileId: number = 0;
    @observable headerTableColumnWidths: Array<number> = [150, 75, 65, 100, 230];
    @observable dataTableColumnWidths: Array<number> = [];
    @observable isShowingSelectedData: boolean = false;
    @observable isCatalogTableAutoScrollEnabled: boolean = false;
    @observable catalogPlotType: CatalogPlotType = CatalogPlotType.ImageOverlay;
    @observable hasAttemptedAutoSelectImageOverlayAxes: boolean = false;
    @observable catalogSize: number = 10.0; // in pixel
    @observable showedCatalogSize: number = 10.0;
    @observable catalogColor: string = Colors.TURQUOISE3;
    @observable catalogShape: CatalogOverlayShape = CatalogOverlayShape.CIRCLE_LINED;
    @observable xAxis: string = CatalogOverlay.NONE;
    @observable yAxis: string = CatalogOverlay.NONE;
    @observable hasPlottedImageOverlay: boolean = false;
    @observable plottedImageOverlayXAxis: string = CatalogOverlay.NONE;
    @observable plottedImageOverlayYAxis: string = CatalogOverlay.NONE;
    @observable plottedImageOverlaySystem: CatalogSystemType | undefined = undefined;
    @observable plottedImageOverlayMaxRows: number | undefined = undefined;
    @observable tableSeparatorPosition: string = PreferenceStore.Instance.catalogTableSeparatorPosition;
    @observable highlightColor: string = Colors.RED2;
    @observable settingsTabId: CatalogSettingsTabs = CatalogSettingsTabs.SIZE;
    @observable thickness: number = 2.0;
    @observable catalogDisplayMode: CatalogDisplayMode = CatalogDisplayMode.CANVAS;
    // size map
    @observable sizeMapColumn: string = CatalogOverlay.NONE;
    @observable sizeColumnMax: {default: number | undefined; clipd: number | undefined} = {default: undefined, clipd: undefined};
    @observable sizeColumnMin: {default: number | undefined; clipd: number | undefined} = {default: undefined, clipd: undefined};
    @observable sizeMax: {area: number; diameter: number} = {area: 200, diameter: 20};
    @observable sizeMin: {area: number; diameter: number} = {area: 100, diameter: 5};
    @observable isSizeAreaMode: boolean = false;
    @observable sizeScalingType: FrameScaling = FrameScaling.LINEAR;
    @observable private sizeScalingParameters = createScalingParameters();
    @observable sizeAxisTabId: CatalogSettingsTabs.SIZE_MINOR | CatalogSettingsTabs.SIZE_MAJOR = CatalogSettingsTabs.SIZE_MAJOR;
    @observable isSizeColumnMinLocked: boolean = false;
    @observable isSizeColumnMaxLocked: boolean = false;
    @observable canvasSizeUnit: CatalogSizeUnits = CatalogSizeUnits.SCREENPIXEL;
    @observable worldSizeUnit: AngularSizeUnit = AngularSizeUnit.ARCSEC;
    @observable catalogSourceRadiusType: number = this.catalogSourceRadiusTypes.get(PreferenceStore.Instance.catalogSourceRadiusType as CatalogSourceRadiusMode)?.value ?? 1;
    // size map minor
    @observable sizeMinorMapColumn: string = CatalogOverlay.NONE;
    @observable sizeMinorColumnMax: {default: number | undefined; clipd: number | undefined} = {default: undefined, clipd: undefined};
    @observable sizeMinorColumnMin: {default: number | undefined; clipd: number | undefined} = {default: undefined, clipd: undefined};
    @observable sizeMinorMax: {area: number; diameter: number} = {area: 200, diameter: 20};
    @observable sizeMinorMin: {area: number; diameter: number} = {area: 100, diameter: 5};
    @observable isSizeMinorAreaMode: boolean = false;
    @observable sizeMinorScalingType: FrameScaling = FrameScaling.LINEAR;
    @observable private sizeMinorScalingParameters = createScalingParameters();
    @observable isSizeMinorColumnMinLocked: boolean = false;
    @observable isSizeMinorColumnMaxLocked: boolean = false;
    // color map
    @observable colorMapColumn: string = CatalogOverlay.NONE;
    @observable colorColumnMax: {default: number | undefined; clipd: number | undefined} = {default: undefined, clipd: undefined};
    @observable colorColumnMin: {default: number | undefined; clipd: number | undefined} = {default: undefined, clipd: undefined};
    @observable colorMap: string = ColorMap.Viridis;
    @observable colorScalingType: FrameScaling = FrameScaling.LINEAR;
    @observable private colorScalingParameters = createScalingParameters();
    @observable isInvertedColorMap: boolean = false;
    // orientation
    @observable orientationMapColumn: string = CatalogOverlay.NONE;
    @observable orientationMax: {default: number | undefined; clipd: number | undefined} = {default: undefined, clipd: undefined};
    @observable orientationMin: {default: number | undefined; clipd: number | undefined} = {default: undefined, clipd: undefined};
    @observable orientationScalingType: FrameScaling = FrameScaling.LINEAR;
    @observable private orientationScalingParameters = createScalingParameters();
    @observable angleMax: number = CatalogWidgetStore.MAX_ANGLE;
    @observable angleMin: number = CatalogWidgetStore.MIN_ANGLE;

    private readonly disposers: IReactionDisposer[] = [];

    constructor(catalogFileId: number) {
        this.catalogFileId = catalogFileId;
        makeObservable(this);

        this.disposers.push(
            reaction(
                () => this.sizeMapData,
                column => {
                    const result = minMaxArray(column);
                    this.setSizeColumnMin(isFinite(result.minVal) ? result.minVal : 0, "default");
                    this.setSizeColumnMax(isFinite(result.maxVal) ? result.maxVal : 0, "default");
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeArray(),
                size => {
                    if (size.length) {
                        CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, size, CatalogTextureType.Size);
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeColumnMin.clipd,
                sizeColumnMin => {
                    if (this.isSizeColumnMinLocked) {
                        this.sizeMinorColumnMin.clipd = sizeColumnMin;
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeColumnMax.clipd,
                sizeColumnMax => {
                    if (this.isSizeColumnMaxLocked) {
                        this.sizeMinorColumnMax.clipd = sizeColumnMax;
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeMinorMapData,
                column => {
                    const result = minMaxArray(column);
                    this.setSizeMinorColumnMin(isFinite(result.minVal) ? result.minVal : 0, "default");
                    this.setSizeMinorColumnMax(isFinite(result.maxVal) ? result.maxVal : 0, "default");
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeMinorArray(),
                size => {
                    if (size.length) {
                        CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, size, CatalogTextureType.SizeMinor);
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeMinorColumnMin.clipd,
                sizeMinorColumnMin => {
                    if (this.isSizeMinorColumnMinLocked) {
                        this.sizeColumnMin.clipd = sizeMinorColumnMin;
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.sizeMinorColumnMax.clipd,
                sizeMinorColumnMax => {
                    if (this.isSizeMinorColumnMaxLocked) {
                        this.sizeColumnMax.clipd = sizeMinorColumnMax;
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.colorMapData,
                column => {
                    const result = minMaxArray(column);
                    this.setColorColumnMin(isFinite(result.minVal) ? result.minVal : 0, "default");
                    this.setColorColumnMax(isFinite(result.maxVal) ? result.maxVal : 0, "default");
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.colorArray(),
                color => {
                    if (color.length) {
                        CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, color, CatalogTextureType.Color);
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.orientationMapData,
                column => {
                    const result = minMaxArray(column);
                    this.setOrientationMin(isFinite(result.minVal) ? result.minVal : 0, "default");
                    this.setOrientationMax(isFinite(result.maxVal) ? result.maxVal : 0, "default");
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.orientationArray(),
                orientation => {
                    if (orientation.length) {
                        CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, orientation, CatalogTextureType.Orientation);
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => PreferenceStore.Instance.catalogSourceRadiusType,
                catalogSourceRadiusType => {
                    this.catalogSourceRadiusType = this.catalogSourceRadiusTypes.get(catalogSourceRadiusType as CatalogSourceRadiusMode)?.value ?? 1;
                    this.setCatalogSize(this.showedCatalogSize);
                }
            )
        );
    }

    public dispose = () => {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    };

    /**
     * Reset all settings of catalog source plot to default
     */
    @action resetMaps() {
        this.clearPlottedImageOverlayState();
        // size
        this.sizeMapColumn = CatalogOverlay.NONE;
        this.isSizeAreaMode = false;
        this.sizeScalingType = FrameScaling.LINEAR;
        this.sizeScalingParameters = createScalingParameters();
        this.sizeMin = {area: 50, diameter: 5};
        this.sizeMax = {area: 200, diameter: 20};
        this.sizeColumnMin = {default: undefined, clipd: undefined};
        this.sizeColumnMax = {default: undefined, clipd: undefined};
        this.sizeAxisTabId = CatalogSettingsTabs.SIZE_MAJOR;
        this.isSizeColumnMinLocked = false;
        this.isSizeColumnMaxLocked = false;
        // size minor
        this.sizeMinorMapColumn = CatalogOverlay.NONE;
        this.isSizeMinorAreaMode = false;
        this.sizeMinorScalingType = FrameScaling.LINEAR;
        this.sizeMinorScalingParameters = createScalingParameters();
        this.sizeMinorMin = {area: 50, diameter: 5};
        this.sizeMinorMax = {area: 200, diameter: 20};
        this.sizeMinorColumnMin = {default: undefined, clipd: undefined};
        this.sizeMinorColumnMax = {default: undefined, clipd: undefined};
        this.isSizeMinorColumnMinLocked = false;
        this.isSizeMinorColumnMaxLocked = false;
        // color
        this.colorMapColumn = CatalogOverlay.NONE;
        this.colorColumnMax = {default: undefined, clipd: undefined};
        this.colorColumnMin = {default: undefined, clipd: undefined};
        this.colorMap = ColorMap.Jet;
        this.colorScalingType = FrameScaling.LINEAR;
        this.colorScalingParameters = createScalingParameters();
        this.isInvertedColorMap = false;
        // orientation
        this.orientationMapColumn = CatalogOverlay.NONE;
        this.orientationMax = {default: undefined, clipd: undefined};
        this.orientationMin = {default: undefined, clipd: undefined};
        this.orientationScalingType = FrameScaling.LINEAR;
        this.orientationScalingParameters = createScalingParameters();
        this.angleMax = CatalogWidgetStore.MAX_ANGLE;
        this.angleMin = CatalogWidgetStore.MIN_ANGLE;
    }

    /**
     * Set the maximum orientation value
     * @param max - max degree of orientation
     */
    @action setAngleMax(max: number) {
        this.angleMax = clamp(max, CatalogWidgetStore.MIN_ANGLE, CatalogWidgetStore.MAX_ANGLE);
    }

    /**
     * Set the minimum orientation value
     * @param min - min degree of orientation
     */
    @action setAngleMin(min: number) {
        this.angleMin = clamp(min, CatalogWidgetStore.MIN_ANGLE, CatalogWidgetStore.MAX_ANGLE);
    }

    /**
     * Set the maximum value for orientation mapping data
     * @param val - maximum orientation degree for mapping data
     * @param type - "default" or "clipd"
     */
    @action setOrientationMax(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.orientationMax.default = val;
            this.orientationMax.clipd = val;
        } else {
            this.orientationMax.clipd = val;
        }
    }

    /**
     * Set the minimum value for orientation mapping data
     * @param val - minimum orientation degree for mapping data
     * @param type - "default" or "clipd"
     */
    @action setOrientationMin(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.orientationMin.default = val;
            this.orientationMin.clipd = val;
        } else {
            this.orientationMin.clipd = val;
        }
    }

    /**
     * Reset the orientation value for mapping data to default
     * @param type - "min" or "max"
     */
    @action resetOrientationValue(type: "min" | "max") {
        if (type === "min") {
            this.orientationMin.clipd = this.orientationMin.default;
        } else {
            this.orientationMax.clipd = this.orientationMax.default;
        }
    }

    /**
     * Select the column for orientation data
     * @param column - column name of orientation data
     */
    @action setOrientationMapColumn(column: string) {
        if (this.orientationMapColumn !== column) {
            this.orientationMapColumn = column;
            this.orientationMin = {default: undefined, clipd: undefined};
            this.orientationMax = {default: undefined, clipd: undefined};

            if (this.catalogDisplayMode === CatalogDisplayMode.WORLD) {
                const result = minMaxArray(this.orientationMapData);
                this.setAngleMax(result.maxVal);
                this.setAngleMin(result.minVal);
            }
        }
    }

    /**
     * Set the scaling type for orientation data
     * @param type - scaling type for orientation data
     */
    @action setOrientationScalingType(type: FrameScaling) {
        this.orientationScalingType = type;
    }

    @computed get orientationScalingParameter(): number {
        return getScalingParameter(this.orientationScalingParameters, this.orientationScalingType);
    }

    @action setOrientationScalingParameter(value: number) {
        this.orientationScalingParameters.set(this.orientationScalingType, sanitizeScalingParameter(this.orientationScalingType, value));
    }

    /**
     * Set the colormap direction
     * @param isInvertedColorMap - true for inverted colormap, false for normal colormap
     */
    @action setColorMapDirection(isInvertedColorMap: boolean) {
        this.isInvertedColorMap = isInvertedColorMap;
    }

    /**
     * Set the maximum value for color mapping data
     * @param val - maximum value for color mapping data
     * @param type - "default" or "clipd"
     */
    @action setColorColumnMax(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.colorColumnMax.default = val;
            this.colorColumnMax.clipd = val;
        } else {
            this.colorColumnMax.clipd = val;
        }
    }

    /**
     * Set the minimum value for color mapping data
     * @param val - minimum value for color mapping data
     * @param type - "default" or "clipd"
     */
    @action setColorColumnMin(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.colorColumnMin.default = val;
            this.colorColumnMin.clipd = val;
        } else {
            this.colorColumnMin.clipd = val;
        }
    }

    /**
     * Reset the maximum or minimum values for color mapping data to default
     * @param type - "min" or "max"
     */
    @action resetColorColumnValue(type: "min" | "max") {
        if (type === "min") {
            this.colorColumnMin.clipd = this.colorColumnMin.default;
        } else {
            this.colorColumnMax.clipd = this.colorColumnMax.default;
        }
    }

    /**
     * Select the column for color mapping data
     * @param column - column name of color mapping data
     */
    @action setColorMapColumn(column: string) {
        if (this.colorMapColumn !== column) {
            this.colorMapColumn = column;
            this.colorColumnMin = {default: undefined, clipd: undefined};
            this.colorColumnMax = {default: undefined, clipd: undefined};
        }
    }

    /**
     * Set the scaling type for color mapping data
     * @param type - scaling type for color mapping data
     */
    @action setColorScalingType(type: FrameScaling) {
        this.colorScalingType = type;
    }

    @computed get colorScalingParameter(): number {
        return getScalingParameter(this.colorScalingParameters, this.colorScalingType);
    }

    @action setColorScalingParameter(value: number) {
        this.colorScalingParameters.set(this.colorScalingType, sanitizeScalingParameter(this.colorScalingType, value));
    }

    /**
     * Set the colormap
     * @param colorMap - colormap name
     */
    @action setColorMap(colorMap: string) {
        this.colorMap = colorMap;
    }

    /**
     * Set the maximum catalog source size
     * @param val - maximum size of catalog source in pixel or square pixel
     */
    @action setSizeMax(val: number) {
        const isAreaMode = this.isSizeAreaMode;
        if (isAreaMode) {
            this.sizeMax.area = val;
        } else {
            if (val >= this.minOverlaySize && val <= this.maxOverlaySize) {
                this.sizeMax.diameter = val;
            }
        }
    }

    /**
     * Set the minimum catalog source size
     * @param val - minimum size of catalog source in pixel or square pixel
     */
    @action setSizeMin(val: number) {
        const isAreaMode = this.isSizeAreaMode;
        if (isAreaMode) {
            this.sizeMin.area = val;
        } else {
            if (val >= this.minOverlaySize && val <= this.maxOverlaySize) {
                this.sizeMin.diameter = val;
            }
        }
    }

    /**
     * Reset the maximum and minimum values for catalog source size to default
     */
    @action resetSize() {
        this.sizeMin = {area: 100, diameter: 5};
        this.sizeMax = {area: 200, diameter: 20};
        this.sizeMinorMin = {area: 100, diameter: 5};
        this.sizeMinorMax = {area: 200, diameter: 20};
    }

    /**
     * Set the maximum value for size mapping data
     * @param val - maximum value for size mapping data
     * @param type - "default" or "clipd"
     */
    @action setSizeColumnMax(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.sizeColumnMax.default = val;
            this.sizeColumnMax.clipd = val;
        } else {
            this.sizeColumnMax.clipd = val;
        }
    }

    /**
     * Set the minimum value for size mapping data
     * @param val - minimum value for size mapping data
     * @param type - "default" or "clipd"
     */
    @action setSizeColumnMin(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.sizeColumnMin.default = val;
            this.sizeColumnMin.clipd = val;
        } else {
            this.sizeColumnMin.clipd = val;
        }
    }

    /**
     * Reset the maximum or minimum values for size mapping data to default
     * @param type - "min" or "max"
     */
    @action resetSizeColumnValue(type: "min" | "max") {
        if (type === "min") {
            this.sizeColumnMin.clipd = this.sizeColumnMin.default;
        } else {
            this.sizeColumnMax.clipd = this.sizeColumnMax.default;
        }
    }

    /**
     * Set the scaling type for size mapping
     * @param type - scaling type for size mapping
     */
    @action setSizeScalingType(type: FrameScaling) {
        this.sizeScalingType = type;
    }

    @computed get sizeScalingParameter(): number {
        return getScalingParameter(this.sizeScalingParameters, this.sizeScalingType);
    }

    @action setSizeScalingParameter(value: number) {
        this.sizeScalingParameters.set(this.sizeScalingType, sanitizeScalingParameter(this.sizeScalingType, value));
    }

    /**
     * Set the size mapping depending on the area or diameter
     * @param isSizeAreaMode - true for area, false for diameter
     */
    @action setSizeArea(isSizeAreaMode: boolean) {
        this.isSizeAreaMode = isSizeAreaMode;
    }

    /**
     * Select the size mapping column
     * @param column - column name for size mapping
     */
    @action setSizeMap(column: string) {
        if (this.sizeMapColumn !== column) {
            this.sizeMapColumn = column;
            this.sizeColumnMin = {default: undefined, clipd: undefined};
            this.sizeColumnMax = {default: undefined, clipd: undefined};
            if (this.catalogDisplayMode === CatalogDisplayMode.WORLD) {
                const result = minMaxArray(this.sizeMapData);
                this.setSizeMax(result.maxVal);
                this.setSizeMin(result.minVal);
            }
            if (column === CatalogOverlay.NONE) {
                this.isSizeAreaMode = false;
                this.isSizeColumnMinLocked = false;
                this.isSizeColumnMaxLocked = false;
                this.isSizeMinorColumnMinLocked = false;
                this.isSizeMinorColumnMaxLocked = false;
                this.sizeMinorMapColumn = CatalogOverlay.NONE;
            }
        }
    }

    @action setSizeAxisTab(tab: CatalogSettingsTabs.SIZE_MINOR | CatalogSettingsTabs.SIZE_MAJOR) {
        this.sizeAxisTabId = tab;
    }

    /**
     * Set the maximum minor axis of catalog source
     * @param val - maximum minor axis of catalog source in pixel or square pixel
     */
    @action setMinorSizeMax(val: number) {
        const isAreaMode = this.isSizeMinorAreaMode;
        if (isAreaMode) {
            this.sizeMinorMax.area = val;
        } else {
            this.sizeMinorMax.diameter = val;
        }
    }

    /**
     * Set the minimum minor axis of catalog source
     * @param val - minimum minor axis of catalog source in pixel or square pixel
     */
    @action setMinorSizeMin(val: number) {
        const isAreaMode = this.isSizeMinorAreaMode;
        if (isAreaMode) {
            this.sizeMinorMin.area = val;
        } else {
            this.sizeMinorMin.diameter = val;
        }
    }

    /**
     * Set the maximum value for minor size mapping data
     * @param val - maximum value for minor size mapping data
     * @param type - "default" or "clipd"
     */
    @action setSizeMinorColumnMax(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.sizeMinorColumnMax.default = val;
            this.sizeMinorColumnMax.clipd = val;
        } else {
            this.sizeMinorColumnMax.clipd = val;
        }
    }

    /**
     * Set the minimum value of minor axis for size mapping data
     * @param val - minimum value of minor axis for size mapping data
     * @param type - "default" or "clipd"
     */
    @action setSizeMinorColumnMin(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.sizeMinorColumnMin.default = val;
            this.sizeMinorColumnMin.clipd = val;
        } else {
            this.sizeMinorColumnMin.clipd = val;
        }
    }

    /**
     * Reset the maximum or minimum values of minor axis for size mapping data to default
     * @param type - "min" or "max"
     */
    @action resetSizeMinorColumnValue(type: "min" | "max") {
        if (type === "min") {
            this.sizeMinorColumnMin.clipd = this.sizeMinorColumnMin.default;
        } else {
            this.sizeMinorColumnMax.clipd = this.sizeMinorColumnMax.default;
        }
    }

    @action toggleSizeColumnMinLock = () => {
        this.isSizeColumnMinLocked = !this.isSizeColumnMinLocked;
        if (this.isSizeColumnMinLocked) {
            this.sizeMinorColumnMin.clipd = this.sizeColumnMin.clipd;
        }
    };

    @action toggleSizeColumnMaxLock = () => {
        this.isSizeColumnMaxLocked = !this.isSizeColumnMaxLocked;
        if (this.isSizeColumnMaxLocked) {
            this.sizeMinorColumnMax.clipd = this.sizeColumnMax.clipd;
        }
    };

    @action toggleSizeMinorColumnMinLock = () => {
        this.isSizeMinorColumnMinLocked = !this.isSizeMinorColumnMinLocked;
        if (this.isSizeMinorColumnMinLocked) {
            this.sizeColumnMin.clipd = this.sizeMinorColumnMin.clipd;
        }
    };

    @action toggleSizeMinorColumnMaxLock = () => {
        this.isSizeMinorColumnMaxLocked = !this.isSizeMinorColumnMaxLocked;
        if (this.isSizeMinorColumnMaxLocked) {
            this.sizeColumnMax.clipd = this.sizeMinorColumnMax.clipd;
        }
    };

    /**
     * Set the scaling type of minor axis for size mapping
     * @param type - scaling type of minor axis for size mapping
     */
    @action setSizeMinorScalingType(type: FrameScaling) {
        this.sizeMinorScalingType = type;
    }

    @computed get sizeMinorScalingParameter(): number {
        return getScalingParameter(this.sizeMinorScalingParameters, this.sizeMinorScalingType);
    }

    @action setSizeMinorScalingParameter(value: number) {
        this.sizeMinorScalingParameters.set(this.sizeMinorScalingType, sanitizeScalingParameter(this.sizeMinorScalingType, value));
    }

    /**
     * Set the minor axis mapping depending on the area or diameter
     * @param isSizeMinorAreaMode - true for area, false for diameter
     */
    @action setSizeMinorArea(isSizeMinorAreaMode: boolean) {
        this.isSizeMinorAreaMode = isSizeMinorAreaMode;
    }

    /**
     * Select the column for minor axis size mapping
     * @param column - column name for minor axis size mapping
     */
    @action setSizeMinorMap(column: string) {
        if (this.sizeMinorMapColumn !== column) {
            this.sizeMinorMapColumn = column;
            this.sizeMinorColumnMin = {default: undefined, clipd: undefined};
            this.sizeMinorColumnMax = {default: undefined, clipd: undefined};
            if (this.catalogDisplayMode === CatalogDisplayMode.WORLD) {
                const result = minMaxArray(this.sizeMinorMapData);
                this.setMinorSizeMax(result.maxVal);
                this.setMinorSizeMin(result.minVal);
            }
            if (column === CatalogOverlay.NONE) {
                this.isSizeMinorAreaMode = false;
                this.isSizeMinorColumnMinLocked = false;
                this.isSizeMinorColumnMaxLocked = false;
                this.isSizeColumnMinLocked = false;
                this.isSizeColumnMaxLocked = false;
            }
        }
    }

    /**
     * Set the catalog source display mode
     * @param value - display mode of catalog source
     */
    @action setCatalogDisplayMode(value: CatalogDisplayMode) {
        this.catalogDisplayMode = value;
        if (this.catalogDisplayMode === CatalogDisplayMode.WORLD) {
            this.isSizeAreaMode = false;

            const result = minMaxArray(this.sizeMapData);
            this.setSizeMax(result.maxVal);
            this.setSizeMin(result.minVal);
            const minorResult = minMaxArray(this.sizeMinorMapData);
            this.setMinorSizeMax(minorResult.maxVal);
            this.setMinorSizeMin(minorResult.minVal);
            const resultOrientation = minMaxArray(this.orientationMapData);
            this.setAngleMax(resultOrientation.maxVal);
            this.setAngleMin(resultOrientation.minVal);

            if (this.catalogShape !== CatalogOverlayShape.ELLIPSE_LINED) {
                this.catalogShape = CatalogOverlayShape.CIRCLE_LINED;
            }
        } else {
            this.resetSize();
        }
    }

    /**
     * Set unit for catalog source size
     * @param unit - unit of catalog source size ({@link CatalogSizeUnits})
     */
    @action setCanvasSizeUnit(unit: CatalogSizeUnits) {
        this.canvasSizeUnit = unit;
        this.setCatalogSize(this.showedCatalogSize);
    }

    /**
     * Set angular unit for catalog source size in world coordinates
     * @param unit - unit of catalog source size ({@link AngularSizeUnit})
     */
    @action setWorldSizeUnit(unit: AngularSizeUnit) {
        this.worldSizeUnit = unit;
    }

    @action setHeaderTableColumnWidths(vals: Array<number>) {
        this.headerTableColumnWidths = vals;
    }

    @action setDataTableColumnWidths(vals: Array<number>) {
        this.dataTableColumnWidths = vals;
    }

    @action setShowSelectedData(isShowingSelectedData: boolean) {
        this.isShowingSelectedData = isShowingSelectedData;
    }

    @action setCatalogTableAutoScroll(isCatalogTableAutoScrollEnabled: boolean) {
        this.isCatalogTableAutoScrollEnabled = isCatalogTableAutoScrollEnabled;
    }

    @action setCatalogPlotType(type: CatalogPlotType) {
        this.catalogPlotType = type;
    }

    @computed get minOverlaySize(): number {
        return this.overlaySize.get(this.canvasSizeUnit)?.min ?? CatalogWidgetStore.MIN_OVERLAY_SIZE;
    }

    @computed get maxOverlaySize(): number {
        return this.overlaySize.get(this.canvasSizeUnit)?.max ?? CatalogWidgetStore.MAX_OVERLAY_SIZE;
    }

    /**
     * Set the size of catalog source
     * @param size - size of catalog source in pixel or arcsec
     */
    @action setCatalogSize(size: number) {
        if (size >= this.minOverlaySize && size <= this.maxOverlaySize) {
            this.catalogSize = size * this.pixelSizeFactor;
            this.showedCatalogSize = size;
        }
    }

    /**
     * Set the color of catalog source
     * @param color - color of catalog source
     */
    @action setCatalogColor(color: string) {
        this.catalogColor = color;
    }

    /**
     * Set the shape of catalog source
     * @param shape - shape of catalog source
     */
    @action setCatalogShape(shape: CatalogOverlayShape) {
        this.catalogShape = shape;
        if (shape !== CatalogOverlayShape.ELLIPSE_LINED && this.sizeAxisTabId === CatalogSettingsTabs.SIZE_MINOR) {
            this.sizeAxisTabId = CatalogSettingsTabs.SIZE_MAJOR;
        }
    }

    @action setxAxis(xColumnName: string) {
        this.xAxis = xColumnName;
    }

    @action setyAxis(yColumnName: string) {
        this.yAxis = yColumnName;
    }

    @action setAutoSelectImageOverlayAxesAttempted(hasAttemptedAutoSelectImageOverlayAxes: boolean) {
        this.hasAttemptedAutoSelectImageOverlayAxes = hasAttemptedAutoSelectImageOverlayAxes;
    }

    @action setPlottedImageOverlayState(xColumnName: string, yColumnName: string, system: CatalogSystemType, maxRows?: number) {
        this.hasPlottedImageOverlay = true;
        this.plottedImageOverlayXAxis = xColumnName;
        this.plottedImageOverlayYAxis = yColumnName;
        this.plottedImageOverlaySystem = system;
        if (maxRows !== undefined) {
            this.plottedImageOverlayMaxRows = maxRows;
        }
    }

    @action clearPlottedImageOverlayState() {
        this.hasPlottedImageOverlay = false;
        this.plottedImageOverlayXAxis = CatalogOverlay.NONE;
        this.plottedImageOverlayYAxis = CatalogOverlay.NONE;
        this.plottedImageOverlaySystem = undefined;
        this.plottedImageOverlayMaxRows = undefined;
    }

    @action setTableSeparatorPosition(position: string) {
        this.tableSeparatorPosition = position;
    }

    /**
     * Set the color of highlighted catalog source
     * @param color - color of highlight
     */
    @action setHighlightColor(color: string) {
        this.highlightColor = color;
    }

    @action setSettingsTabId = (tabId: CatalogSettingsTabs) => {
        this.settingsTabId = tabId;
        this.sizeAxisTabId = CatalogSettingsTabs.SIZE_MAJOR;
    };

    /**
     * Set the thickness of catalog source
     * @param val - thickness of catalog source
     */
    @action setThickness(val: number) {
        this.thickness = clamp(val, CatalogWidgetStore.MIN_THICKNESS, CatalogWidgetStore.MAX_THICKNESS);
    }

    /**
     * If the catalog source is in image pixel
     */
    @computed get isImagePixelSize(): boolean {
        return this.canvasSizeUnit !== CatalogSizeUnits.SCREENPIXEL || this.catalogDisplayMode === CatalogDisplayMode.WORLD;
    }

    /**
     * If the catalog source is in angular size
     */
    @computed get isAngularSize(): boolean {
        return (this.canvasSizeUnit !== CatalogSizeUnits.SCREENPIXEL && this.canvasSizeUnit !== CatalogSizeUnits.IMAGEPIXEL) || this.catalogDisplayMode === CatalogDisplayMode.WORLD;
    }

    /**
     * Orientation data for catalog sources
     */
    @computed get orientationMapData(): Float32Array {
        const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!this.isOrientationMapDisabled && catalogProfileStore) {
            const column = catalogProfileStore.get1DPlotData(this.orientationMapColumn).wcsData;
            return column ? Float32Array.from(column) : new Float32Array(0);
        } else {
            return new Float32Array(0);
        }
    }

    orientationArray(): Float32Array {
        const column = this.orientationMapData;
        if (!this.isOrientationMapDisabled && column?.length && this.orientationMin.clipd !== undefined && this.orientationMax.clipd !== undefined) {
            return CARTACompute.CalculateCatalogOrientation(
                column,
                this.orientationMin.clipd,
                this.orientationMax.clipd,
                this.angleMin,
                this.angleMax,
                this.orientationScalingType,
                this.orientationScalingParameter,
                this.orientationScalingParameter
            );
        }
        return new Float32Array(0);
    }

    /**
     * Color data for catalog sources
     */
    @computed get colorMapData(): Float32Array {
        const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!this.isColorMapDisabled && catalogProfileStore) {
            const column = catalogProfileStore.get1DPlotData(this.colorMapColumn).wcsData;
            return column ? Float32Array.from(column) : new Float32Array(0);
        } else {
            return new Float32Array(0);
        }
    }

    colorArray(): Float32Array {
        const column = this.colorMapData;
        if (!this.isColorMapDisabled && column?.length && this.colorColumnMin.clipd !== undefined && this.colorColumnMax.clipd !== undefined) {
            return CARTACompute.CalculateCatalogColor(column, this.isInvertedColorMap, this.colorColumnMin.clipd, this.colorColumnMax.clipd, this.colorScalingType, this.colorScalingParameter, this.colorScalingParameter);
        }
        return new Float32Array(0);
    }

    /**
     * Size data for catalog sources
     */
    @computed get sizeMapData(): Float32Array {
        const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!this.isSizeMapDisabled && catalogProfileStore) {
            const column = catalogProfileStore.get1DPlotData(this.sizeMapColumn).wcsData;
            return column ? Float32Array.from(column) : new Float32Array(0);
        } else {
            return new Float32Array(0);
        }
    }

    /**
     * Minor size data for catalog sources
     */
    @computed get sizeMinorMapData(): Float32Array {
        const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!this.isSizeMinorMapDisabled && catalogProfileStore) {
            const column = catalogProfileStore.get1DPlotData(this.sizeMinorMapColumn).wcsData;
            return column ? Float32Array.from(column) : new Float32Array(0);
        } else {
            return new Float32Array(0);
        }
    }

    /**
     * The pixel size factor if plotting angular size (factor-to-arcsec / arcsec)
     */
    @computed get pixelSizeFactor(): number {
        if (!this.isAngularSize) {
            return 1;
        } else {
            const appStore = AppStore.Instance;
            const catalogStore = CatalogStore.Instance;
            const frame = appStore.getFrame(catalogStore.getFrameIdByCatalogId(this.catalogFileId));
            const pixelAngularSize = (frame?.spatialReference?.pixelUnitSizeArcsec && frame?.spatialReference?.pixelUnitSizeArcsec.x) ?? (frame?.pixelUnitSizeArcsec && frame?.pixelUnitSizeArcsec.x) ?? 1;
            const sizeUnit = this.catalogDisplayMode === CatalogDisplayMode.WORLD ? this.worldSizeUnit : this.canvasSizeUnit;
            return ((FACTOR_TO_ARCSEC.get(sizeUnit as AngularSizeUnit) ?? 1) / pixelAngularSize) * this.catalogSourceRadiusType;
        }
    }

    sizeArray(): Float32Array {
        const column = this.sizeMapData;
        if (!this.isSizeMapDisabled && column?.length && this.sizeColumnMin.clipd !== undefined && this.sizeColumnMax.clipd !== undefined) {
            const pointSize = this.pointSizebyType;
            const min = (this.isImagePixelSize ? 0 : this.isSizeAreaMode ? this.shapeSettings?.areaBase : this.shapeSettings?.diameterBase) ?? NaN;
            const sizeMapType = this.catalogDisplayMode === CatalogDisplayMode.WORLD ? CatalogMapType.SIZE_DIAMETER_ANGULAR : this.isSizeAreaMode ? CatalogMapType.SIZE_AREA : CatalogMapType.SIZE_DIAMETER;

            return CARTACompute.CalculateCatalogSize(
                column,
                this.sizeColumnMin.clipd,
                this.sizeColumnMax.clipd,
                pointSize.min + min,
                pointSize.max + min,
                this.sizeScalingType,
                sizeMapType,
                this.pixelSizeFactor,
                this.sizeScalingParameter,
                this.sizeScalingParameter
            );
        }
        return new Float32Array(0);
    }

    sizeMinorArray(): Float32Array {
        const column = this.sizeMinorMapData;
        if (!this.isSizeMinorMapDisabled && column?.length && this.sizeMinorColumnMin.clipd !== undefined && this.sizeMinorColumnMax.clipd !== undefined) {
            const pointSize = this.minorPointSizebyType;
            const min = (this.isImagePixelSize ? 0 : this.isSizeAreaMode ? this.shapeSettings?.areaBase : this.shapeSettings?.diameterBase) ?? NaN;
            const sizeMapType = this.catalogDisplayMode === CatalogDisplayMode.WORLD ? CatalogMapType.SIZE_DIAMETER_ANGULAR : this.isSizeMinorAreaMode ? CatalogMapType.SIZE_AREA : CatalogMapType.SIZE_DIAMETER;

            return CARTACompute.CalculateCatalogSize(
                column,
                this.sizeMinorColumnMin.clipd,
                this.sizeMinorColumnMax.clipd,
                pointSize.min + min,
                pointSize.max + min,
                this.sizeMinorScalingType,
                sizeMapType,
                this.pixelSizeFactor,
                this.sizeMinorScalingParameter,
                this.sizeMinorScalingParameter
            );
        }
        return new Float32Array(0);
    }

    @computed get isSizeMapDisabled(): boolean {
        return this.sizeMapColumn === CatalogOverlay.NONE;
    }

    @computed get isSizeMinorMapDisabled(): boolean {
        return this.sizeMinorMapColumn === CatalogOverlay.NONE;
    }

    @computed get isSizeMinorTabEnabled(): boolean {
        return this.sizeMapColumn !== CatalogOverlay.NONE && this.catalogShape === CatalogOverlayShape.ELLIPSE_LINED;
    }

    @computed get maxPointSizebyType(): number {
        let isAreaMode = this.isSizeAreaMode;
        if (this.sizeAxisTabId === CatalogSettingsTabs.SIZE_MINOR) {
            isAreaMode = this.isSizeMinorAreaMode;
        }
        if (isAreaMode) {
            return CatalogWidgetStore.MAX_AREA_SIZE;
        } else {
            return this.maxOverlaySize;
        }
    }

    @computed get pointSizebyType(): {min: number; max: number} {
        if (this.isSizeAreaMode) {
            return {min: this.sizeMin.area, max: this.sizeMax.area};
        } else {
            return {min: this.sizeMin.diameter, max: this.sizeMax.diameter};
        }
    }

    @computed get minorPointSizebyType(): {min: number; max: number} {
        if (this.isSizeMinorAreaMode) {
            return {min: this.sizeMinorMin.area, max: this.sizeMinorMax.area};
        } else {
            return {min: this.sizeMinorMin.diameter, max: this.sizeMinorMax.diameter};
        }
    }

    @computed get isSizeMajor(): boolean {
        return this.sizeAxisTabId === CatalogSettingsTabs.SIZE_MAJOR;
    }

    @computed get isColorMapDisabled(): boolean {
        return this.colorMapColumn === CatalogOverlay.NONE;
    }

    @computed get isOrientationMapDisabled(): boolean {
        return this.orientationMapColumn === CatalogOverlay.NONE;
    }

    @computed get shapeSettings(): {featherWidth: number | undefined; diameterBase: number; areaBase: number; thicknessBase: number | undefined} | undefined {
        const pointSize = this.isSizeMajor ? this.pointSizebyType : this.minorPointSizebyType;
        const config = this.overlayShapeSettings.get(this.catalogShape);
        if (pointSize.min === 0) {
            return {featherWidth: config?.featherWidth, diameterBase: 0, areaBase: 0, thicknessBase: config?.thicknessBase};
        }
        return config;
    }

    public init = (widgetSettings): void => {
        if (!widgetSettings) {
            return;
        }
        const catalogFileId = widgetSettings.catalogFileId;
        if (typeof catalogFileId === "number" && catalogFileId > 0) {
            this.catalogFileId = catalogFileId;
        }
        const catalogSize = widgetSettings.catalogSize;
        if (typeof catalogSize === "number" && catalogSize >= CatalogWidgetStore.MIN_OVERLAY_SIZE && catalogSize <= CatalogWidgetStore.MAX_OVERLAY_SIZE) {
            this.catalogSize = catalogSize;
        }
        this.catalogShape = widgetSettings.catalogShape;
        this.catalogColor = widgetSettings.catalogColor;
        this.highlightColor = widgetSettings.highlightColor;
        this.tableSeparatorPosition = widgetSettings.tableSeparatorPosition;
        this.thickness = widgetSettings.thickness;
    };

    public toConfig = () => {
        return {
            catalogFileId: this.catalogFileId,
            catalogColor: this.catalogColor,
            highlightColor: this.highlightColor,
            catalogSize: this.catalogSize,
            catalogShape: this.catalogShape,
            tableSeparatorPosition: this.tableSeparatorPosition,
            thickness: this.thickness
        };
    };
}
