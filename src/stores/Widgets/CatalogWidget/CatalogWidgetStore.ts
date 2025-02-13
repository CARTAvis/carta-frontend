import {Colors} from "@blueprintjs/core";
import * as CARTACompute from "carta_computation";
import {action, computed, makeObservable, observable, reaction} from "mobx";

import {AngularSizeUnit, CatalogOverlay, FACTOR_TO_ARCSEC} from "models";
import {CatalogTextureType, CatalogWebGLService} from "services";
import {AppStore, CatalogStore, PreferenceStore} from "stores";
import {FrameScaling} from "stores/Frame";
import {clamp, minMaxArray} from "utilities";

export enum CatalogPlotType {
    ImageOverlay = "Image overlay",
    Histogram = "Histogram",
    D2Scatter = "2D scatter"
}

export enum CatalogOverlayShape {
    BOX_LINED = 1,
    CIRCLE_FILLED = 2,
    CIRCLE_LINED = 3,
    HEXAGON_LINED = 5,
    RHOMB_LINED = 7,
    TRIANGLE_LINED_UP = 9,
    ELLIPSE_LINED = 11,
    TRIANGLE_LINED_DOWN = 13,
    HEXAGON_LINED_2 = 15,
    CROSS_FILLED = 16,
    CROSS_LINED = 17,
    X_FILLED = 18,
    X_LINED = 19,
    LineSegment_FILLED = 20
}

export enum CatalogSettingsTabs {
    GLOBAL,
    STYLING,
    COLOR,
    SIZE,
    ORIENTATION,
    SIZE_MAJOR,
    SIZE_MINOR,
    ANGULAR_SIZE
}

/**
 * Display catalog sources with single or mapped sizes (Canvas) or their angular sizes (World)
 */
export enum CatalogDisplayMode {
    CANVAS = "Custom",
    WORLD = "Angular size"
}

export type ValueClip = "size-min" | "size-max" | "angle-min" | "angle-max";

export enum CatalogSizeUnits {
    SCREENPIXEL = "screen px",
    IMAGEPIXEL = "image px",
    MILLIARCSEC = "milliarcsec",
    ARCSEC = "arcsec",
    ARCMIN = "arcmin",
    DEG = "deg"
}

export class CatalogWidgetStore {
    public static readonly MinOverlaySize = 1;
    public static readonly MaxOverlaySize = 50;
    public static readonly MaxAreaSize = 4000;
    public static readonly MinTableSeparatorPosition = 0;
    public static readonly MaxTableSeparatorPosition = 100;
    public static readonly MinThickness = 1.0;
    public static readonly MaxThickness = 10;
    public static readonly MinAngle = 0;
    public static readonly MaxAngle = 720;
    public static readonly SizeMapMin = 0;

    OverlaySize = new Map<string, {min: number; max: number}>([
        [CatalogSizeUnits.SCREENPIXEL, {min: 1, max: 50}],
        [CatalogSizeUnits.IMAGEPIXEL, {min: 1, max: 50}],
        [CatalogSizeUnits.MILLIARCSEC, {min: 0.01, max: 200}],
        [CatalogSizeUnits.ARCMIN, {min: 0.01, max: 120}],
        [CatalogSizeUnits.ARCSEC, {min: 0.01, max: 120}],
        [CatalogSizeUnits.DEG, {min: 0.01, max: 10}]
    ]);

    // -1 : apply different featherWidth according shape size
    private OverlayShapeSettings = new Map<number, {featherWidth: number; diameterBase: number; areaBase: number; thicknessBase: number}>([
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

    @observable catalogFileId: number;
    @observable headerTableColumnWidts: Array<number>;
    @observable dataTableColumnWidts: Array<number>;
    @observable showSelectedData: boolean;
    @observable catalogTableAutoScroll: boolean;
    @observable catalogPlotType: CatalogPlotType;
    @observable catalogSize: number; // in pixel
    @observable showedCatalogSize: number;
    @observable catalogColor: string;
    @observable catalogShape: CatalogOverlayShape;
    @observable xAxis: string;
    @observable yAxis: string;
    @observable tableSeparatorPosition: string;
    @observable highlightColor: string;
    @observable settingsTabId: CatalogSettingsTabs;
    @observable thickness: number;
    @observable catalogDisplayMode: CatalogDisplayMode;
    // size map
    @observable sizeMapColumn: string;
    @observable sizeColumnMax: {default: number | undefined; clipd: number | undefined};
    @observable sizeColumnMin: {default: number | undefined; clipd: number | undefined};
    @observable sizeMax: {area: number; diameter: number};
    @observable sizeMin: {area: number; diameter: number};
    @observable sizeArea: boolean;
    @observable sizeScalingType: FrameScaling;
    @observable sizeAxisTabId: CatalogSettingsTabs.SIZE_MINOR | CatalogSettingsTabs.SIZE_MAJOR;
    @observable sizeColumnMinLocked: boolean;
    @observable sizeColumnMaxLocked: boolean;
    @observable canvasSizeUnit: CatalogSizeUnits;
    @observable worldSizeUnit: AngularSizeUnit;
    // size map minor
    @observable sizeMinorMapColumn: string;
    @observable sizeMinorColumnMax: {default: number | undefined; clipd: number | undefined};
    @observable sizeMinorColumnMin: {default: number | undefined; clipd: number | undefined};
    @observable sizeMinorMax: {area: number; diameter: number};
    @observable sizeMinorMin: {area: number; diameter: number};
    @observable sizeMinorArea: boolean;
    @observable sizeMinorScalingType: FrameScaling;
    @observable sizeMinorColumnMinLocked: boolean;
    @observable sizeMinorColumnMaxLocked: boolean;
    // color map
    @observable colorMapColumn: string;
    @observable colorColumnMax: {default: number | undefined; clipd: number | undefined};
    @observable colorColumnMin: {default: number | undefined; clipd: number | undefined};
    @observable colorMap: string;
    @observable colorScalingType: FrameScaling;
    @observable invertedColorMap: boolean;
    // orientation
    @observable orientationMapColumn: string;
    @observable orientationMax: {default: number | undefined; clipd: number | undefined};
    @observable orientationMin: {default: number | undefined; clipd: number | undefined};
    @observable orientationScalingType: FrameScaling;
    @observable angleMax: number;
    @observable angleMin: number;

    constructor(catalogFileId: number) {
        makeObservable(this);
        this.catalogFileId = catalogFileId;
        this.headerTableColumnWidts = [150, 75, 65, 100, 230];
        this.showSelectedData = false;
        this.catalogTableAutoScroll = false;
        this.catalogPlotType = CatalogPlotType.ImageOverlay;
        this.catalogColor = Colors.TURQUOISE3;
        this.catalogSize = 10.0;
        this.showedCatalogSize = 10.0;
        this.catalogShape = CatalogOverlayShape.CIRCLE_LINED;
        this.xAxis = CatalogOverlay.NONE;
        this.yAxis = CatalogOverlay.NONE;
        this.tableSeparatorPosition = PreferenceStore.Instance.catalogTableSeparatorPosition;
        this.highlightColor = Colors.RED2;
        this.settingsTabId = CatalogSettingsTabs.SIZE;
        this.thickness = 2.0;
        this.sizeMapColumn = CatalogOverlay.NONE;
        this.sizeArea = false;
        this.sizeScalingType = FrameScaling.LINEAR;
        this.sizeMin = {area: 100, diameter: 5};
        this.sizeMax = {area: 200, diameter: 20};
        this.sizeColumnMin = {default: undefined, clipd: undefined};
        this.sizeColumnMax = {default: undefined, clipd: undefined};
        this.sizeAxisTabId = CatalogSettingsTabs.SIZE_MAJOR;
        this.sizeMinorMapColumn = CatalogOverlay.NONE;
        this.sizeMinorArea = false;
        this.sizeMinorScalingType = FrameScaling.LINEAR;
        this.sizeMinorMin = {area: 100, diameter: 5};
        this.sizeMinorMax = {area: 200, diameter: 20};
        this.sizeMinorColumnMin = {default: undefined, clipd: undefined};
        this.sizeMinorColumnMax = {default: undefined, clipd: undefined};
        this.colorMapColumn = CatalogOverlay.NONE;
        this.colorColumnMax = {default: undefined, clipd: undefined};
        this.colorColumnMin = {default: undefined, clipd: undefined};
        this.colorMap = "viridis";
        this.colorScalingType = FrameScaling.LINEAR;
        this.invertedColorMap = false;
        this.orientationMapColumn = CatalogOverlay.NONE;
        this.orientationMax = {default: undefined, clipd: undefined};
        this.orientationMin = {default: undefined, clipd: undefined};
        this.orientationScalingType = FrameScaling.LINEAR;
        this.angleMax = 360;
        this.angleMin = CatalogWidgetStore.MinAngle;
        this.sizeColumnMinLocked = false;
        this.sizeColumnMaxLocked = false;
        this.sizeMinorColumnMinLocked = false;
        this.sizeMinorColumnMaxLocked = false;
        this.canvasSizeUnit = CatalogSizeUnits.SCREENPIXEL;
        this.worldSizeUnit = AngularSizeUnit.ARCSEC;
        this.catalogDisplayMode = CatalogDisplayMode.CANVAS;

        reaction(
            () => this.sizeMapData,
            column => {
                const result = minMaxArray(column);
                this.setSizeColumnMin(isFinite(result.minVal) ? result.minVal : 0, "default");
                this.setSizeColumnMax(isFinite(result.maxVal) ? result.maxVal : 0, "default");
            }
        );

        reaction(
            () => this.sizeArray(),
            size => {
                if (size.length) {
                    CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, size, CatalogTextureType.Size);
                }
            }
        );

        reaction(
            () => this.sizeColumnMin.clipd,
            sizeColumnMin => {
                if (this.sizeColumnMinLocked) {
                    this.sizeMinorColumnMin.clipd = sizeColumnMin;
                }
            }
        );

        reaction(
            () => this.sizeColumnMax.clipd,
            sizeColumnMax => {
                if (this.sizeColumnMaxLocked) {
                    this.sizeMinorColumnMax.clipd = sizeColumnMax;
                }
            }
        );

        reaction(
            () => this.sizeMinorMapData,
            column => {
                const result = minMaxArray(column);
                this.setSizeMinorColumnMin(isFinite(result.minVal) ? result.minVal : 0, "default");
                this.setSizeMinorColumnMax(isFinite(result.maxVal) ? result.maxVal : 0, "default");
            }
        );

        reaction(
            () => this.sizeMinorArray(),
            size => {
                if (size.length) {
                    CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, size, CatalogTextureType.SizeMinor);
                }
            }
        );

        reaction(
            () => this.sizeMinorColumnMin.clipd,
            sizeMinorColumnMin => {
                if (this.sizeMinorColumnMinLocked) {
                    this.sizeColumnMin.clipd = sizeMinorColumnMin;
                }
            }
        );

        reaction(
            () => this.sizeMinorColumnMax.clipd,
            sizeMinorColumnMax => {
                if (this.sizeMinorColumnMaxLocked) {
                    this.sizeColumnMax.clipd = sizeMinorColumnMax;
                }
            }
        );

        reaction(
            () => this.colorMapData,
            column => {
                const result = minMaxArray(column);
                this.setColorColumnMin(isFinite(result.minVal) ? result.minVal : 0, "default");
                this.setColorColumnMax(isFinite(result.maxVal) ? result.maxVal : 0, "default");
            }
        );

        reaction(
            () => this.colorArray(),
            color => {
                if (color.length) {
                    CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, color, CatalogTextureType.Color);
                }
            }
        );

        reaction(
            () => this.orientationMapData,
            column => {
                const result = minMaxArray(column);
                this.setOrientationMin(isFinite(result.minVal) ? result.minVal : 0, "default");
                this.setOrientationMax(isFinite(result.maxVal) ? result.maxVal : 0, "default");
            }
        );

        reaction(
            () => this.orientationArray(),
            orientation => {
                if (orientation.length) {
                    CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, orientation, CatalogTextureType.Orientation);
                }
            }
        );
    }

    /**
     * Reset all settings of catalog source plot to default
     */
    @action resetMaps() {
        // size
        this.sizeMapColumn = CatalogOverlay.NONE;
        this.sizeArea = false;
        this.sizeScalingType = FrameScaling.LINEAR;
        this.sizeMin = {area: 50, diameter: 5};
        this.sizeMax = {area: 200, diameter: 20};
        this.sizeColumnMin = {default: undefined, clipd: undefined};
        this.sizeColumnMax = {default: undefined, clipd: undefined};
        this.sizeAxisTabId = CatalogSettingsTabs.SIZE_MAJOR;
        this.sizeColumnMinLocked = false;
        this.sizeColumnMaxLocked = false;
        // size minor
        this.sizeMinorMapColumn = CatalogOverlay.NONE;
        this.sizeMinorArea = false;
        this.sizeMinorScalingType = FrameScaling.LINEAR;
        this.sizeMinorMin = {area: 50, diameter: 5};
        this.sizeMinorMax = {area: 200, diameter: 20};
        this.sizeMinorColumnMin = {default: undefined, clipd: undefined};
        this.sizeMinorColumnMax = {default: undefined, clipd: undefined};
        this.sizeMinorColumnMinLocked = false;
        this.sizeMinorColumnMaxLocked = false;
        // color
        this.colorMapColumn = CatalogOverlay.NONE;
        this.colorColumnMax = {default: undefined, clipd: undefined};
        this.colorColumnMin = {default: undefined, clipd: undefined};
        this.colorMap = "jet";
        this.colorScalingType = FrameScaling.LINEAR;
        this.invertedColorMap = false;
        // orientation
        this.orientationMapColumn = CatalogOverlay.NONE;
        this.orientationMax = {default: undefined, clipd: undefined};
        this.orientationMin = {default: undefined, clipd: undefined};
        this.orientationScalingType = FrameScaling.LINEAR;
        this.angleMax = CatalogWidgetStore.MaxAngle;
        this.angleMin = CatalogWidgetStore.MinAngle;
    }

    /**
     * Set the maximum orientation value
     * @param max - max degree of orientation
     */
    @action setAngleMax(max: number) {
        this.angleMax = clamp(max, CatalogWidgetStore.MinAngle, CatalogWidgetStore.MaxAngle);
    }

    /**
     * Set the minimum orientation value
     * @param min - min degree of orientation
     */
    @action setAngleMin(min: number) {
        this.angleMin = clamp(min, CatalogWidgetStore.MinAngle, CatalogWidgetStore.MaxAngle);
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

    /**
     * Set the colormap direction
     * @param val - true for inverted colormap, false for normal colormap
     */
    @action setColorMapDirection(val: boolean) {
        this.invertedColorMap = val;
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
        let areaMode = this.sizeArea;
        if (areaMode) {
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
        let areaMode = this.sizeArea;
        if (areaMode) {
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

    /**
     * Set the size mapping depending on the area or diameter
     * @param val - true for area, false for diameter
     */
    @action setSizeArea(val: boolean) {
        this.sizeArea = val;
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
                this.sizeArea = false;
                this.sizeColumnMinLocked = false;
                this.sizeColumnMaxLocked = false;
                this.sizeMinorColumnMinLocked = false;
                this.sizeMinorColumnMaxLocked = false;
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
        let areaMode = this.sizeMinorArea;
        if (areaMode) {
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
        let areaMode = this.sizeMinorArea;
        if (areaMode) {
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
        this.sizeColumnMinLocked = !this.sizeColumnMinLocked;
        if (this.sizeColumnMinLocked) {
            this.sizeMinorColumnMin.clipd = this.sizeColumnMin.clipd;
        }
    };

    @action toggleSizeColumnMaxLock = () => {
        this.sizeColumnMaxLocked = !this.sizeColumnMaxLocked;
        if (this.sizeColumnMaxLocked) {
            this.sizeMinorColumnMax.clipd = this.sizeColumnMax.clipd;
        }
    };

    @action toggleSizeMinorColumnMinLock = () => {
        this.sizeMinorColumnMinLocked = !this.sizeMinorColumnMinLocked;
        if (this.sizeMinorColumnMinLocked) {
            this.sizeColumnMin.clipd = this.sizeMinorColumnMin.clipd;
        }
    };

    @action toggleSizeMinorColumnMaxLock = () => {
        this.sizeMinorColumnMaxLocked = !this.sizeMinorColumnMaxLocked;
        if (this.sizeMinorColumnMaxLocked) {
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

    /**
     * Set the minor axis mapping depending on the area or diameter
     * @param val - true for area, false for diameter
     */
    @action setSizeMinorArea(val: boolean) {
        this.sizeMinorArea = val;
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
                this.sizeMinorArea = false;
                this.sizeMinorColumnMinLocked = false;
                this.sizeMinorColumnMaxLocked = false;
                this.sizeColumnMinLocked = false;
                this.sizeColumnMaxLocked = false;
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
            this.sizeArea = false;

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

    @action setHeaderTableColumnWidts(vals: Array<number>) {
        this.headerTableColumnWidts = vals;
    }

    @action setDataTableColumnWidts(vals: Array<number>) {
        this.dataTableColumnWidts = vals;
    }

    @action setShowSelectedData(val: boolean) {
        this.showSelectedData = val;
    }

    @action setCatalogTableAutoScroll(val: boolean) {
        this.catalogTableAutoScroll = val;
    }

    @action setCatalogPlotType(type: CatalogPlotType) {
        this.catalogPlotType = type;
    }

    @computed get minOverlaySize(): number {
        return this.OverlaySize.get(this.canvasSizeUnit)?.min ?? CatalogWidgetStore.MinOverlaySize;
    }

    @computed get maxOverlaySize(): number {
        return this.OverlaySize.get(this.canvasSizeUnit)?.max ?? CatalogWidgetStore.MaxOverlaySize;
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
        this.thickness = clamp(val, CatalogWidgetStore.MinThickness, CatalogWidgetStore.MaxThickness);
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
        if (!this.disableOrientationMap && catalogProfileStore) {
            let column = catalogProfileStore.get1DPlotData(this.orientationMapColumn).wcsData;
            return column ? Float32Array.from(column) : new Float32Array(0);
        } else {
            return new Float32Array(0);
        }
    }

    orientationArray(): Float32Array {
        let column = this.orientationMapData;
        if (!this.disableOrientationMap && column?.length && this.orientationMin.clipd !== undefined && this.orientationMax.clipd !== undefined) {
            return CARTACompute.CalculateCatalogOrientation(column, this.orientationMin.clipd, this.orientationMax.clipd, this.angleMin, this.angleMax, this.orientationScalingType);
        }
        return new Float32Array(0);
    }

    /**
     * Color data for catalog sources
     */
    @computed get colorMapData(): Float32Array {
        const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!this.disableColorMap && catalogProfileStore) {
            let column = catalogProfileStore.get1DPlotData(this.colorMapColumn).wcsData;
            return column ? Float32Array.from(column) : new Float32Array(0);
        } else {
            return new Float32Array(0);
        }
    }

    colorArray(): Float32Array {
        const column = this.colorMapData;
        if (!this.disableColorMap && column?.length && this.colorColumnMin.clipd !== undefined && this.colorColumnMax.clipd !== undefined) {
            return CARTACompute.CalculateCatalogColor(column, this.invertedColorMap, this.colorColumnMin.clipd, this.colorColumnMax.clipd, this.colorScalingType);
        }
        return new Float32Array(0);
    }

    /**
     * Size data for catalog sources
     */
    @computed get sizeMapData(): Float32Array {
        const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!this.disableSizeMap && catalogProfileStore) {
            let column = catalogProfileStore.get1DPlotData(this.sizeMapColumn).wcsData;
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
        if (!this.disableSizeMinorMap && catalogProfileStore) {
            let column = catalogProfileStore.get1DPlotData(this.sizeMinorMapColumn).wcsData;
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
            const pixelAngularSize = frame?.spatialReference?.pixelUnitSizeArcsec.x ?? frame?.pixelUnitSizeArcsec.x ?? 1;
            const sizeUnit = this.catalogDisplayMode === CatalogDisplayMode.WORLD ? this.worldSizeUnit : this.canvasSizeUnit;
            return (FACTOR_TO_ARCSEC.get(sizeUnit as AngularSizeUnit) ?? 1) / pixelAngularSize;
        }
    }

    sizeArray(): Float32Array {
        let column = this.sizeMapData;
        if (!this.disableSizeMap && column?.length && this.sizeColumnMin.clipd !== undefined && this.sizeColumnMax.clipd !== undefined) {
            const pointSize = this.pointSizebyType;
            let min = (this.isImagePixelSize ? 0 : this.sizeArea ? this.shapeSettings?.areaBase : this.shapeSettings?.diameterBase) ?? NaN;
            return CARTACompute.CalculateCatalogSize(column, this.sizeColumnMin.clipd, this.sizeColumnMax.clipd, pointSize.min + min, pointSize.max + min, this.sizeScalingType, this.sizeArea, this.pixelSizeFactor);
        }
        return new Float32Array(0);
    }

    sizeMinorArray(): Float32Array {
        let column = this.sizeMinorMapData;
        if (!this.disableSizeMinorMap && column?.length && this.sizeMinorColumnMin.clipd !== undefined && this.sizeMinorColumnMax.clipd !== undefined) {
            const pointSize = this.minorPointSizebyType;
            let min = (this.isImagePixelSize ? 0 : this.sizeArea ? this.shapeSettings?.areaBase : this.shapeSettings?.diameterBase) ?? NaN;
            return CARTACompute.CalculateCatalogSize(column, this.sizeMinorColumnMin.clipd, this.sizeMinorColumnMax.clipd, pointSize.min + min, pointSize.max + min, this.sizeMinorScalingType, this.sizeMinorArea, this.pixelSizeFactor);
        }
        return new Float32Array(0);
    }

    @computed get disableSizeMap(): boolean {
        return this.sizeMapColumn === CatalogOverlay.NONE;
    }

    @computed get disableSizeMinorMap(): boolean {
        return this.sizeMinorMapColumn === CatalogOverlay.NONE;
    }

    @computed get enableSizeMinorTab(): boolean {
        return this.sizeMapColumn !== CatalogOverlay.NONE && this.catalogShape === CatalogOverlayShape.ELLIPSE_LINED;
    }

    @computed get maxPointSizebyType(): number {
        let areaMode = this.sizeArea;
        if (this.sizeAxisTabId === CatalogSettingsTabs.SIZE_MINOR) {
            areaMode = this.sizeMinorArea;
        }
        if (areaMode) {
            return CatalogWidgetStore.MaxAreaSize;
        } else {
            return this.maxOverlaySize;
        }
    }

    @computed get pointSizebyType(): {min: number; max: number} {
        if (this.sizeArea) {
            return {min: this.sizeMin.area, max: this.sizeMax.area};
        } else {
            return {min: this.sizeMin.diameter, max: this.sizeMax.diameter};
        }
    }

    @computed get minorPointSizebyType(): {min: number; max: number} {
        if (this.sizeMinorArea) {
            return {min: this.sizeMinorMin.area, max: this.sizeMinorMax.area};
        } else {
            return {min: this.sizeMinorMin.diameter, max: this.sizeMinorMax.diameter};
        }
    }

    @computed get sizeMajor(): boolean {
        return this.sizeAxisTabId === CatalogSettingsTabs.SIZE_MAJOR;
    }

    @computed get disableColorMap(): boolean {
        return this.colorMapColumn === CatalogOverlay.NONE;
    }

    @computed get disableOrientationMap(): boolean {
        return this.orientationMapColumn === CatalogOverlay.NONE;
    }

    @computed get shapeSettings(): {featherWidth: number | undefined; diameterBase: number; areaBase: number; thicknessBase: number | undefined} | undefined {
        const pointSize = this.sizeMajor ? this.pointSizebyType : this.minorPointSizebyType;
        const config = this.OverlayShapeSettings.get(this.catalogShape);
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
        if (typeof catalogSize === "number" && catalogSize >= CatalogWidgetStore.MinOverlaySize && catalogSize <= CatalogWidgetStore.MaxOverlaySize) {
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
