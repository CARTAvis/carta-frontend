import * as CARTACompute from "carta_computation";
import {action, observable, makeObservable, computed, reaction} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CatalogOverlay, CatalogStore,FrameScaling, PreferenceStore} from "stores";
import {minMaxArray, clamp} from "utilities";
import {CatalogWebGLService, CatalogTextureType} from "services";

export enum CatalogPlotType {
    ImageOverlay = "Image Overlay",
    Histogram = "Histogram",
    D2Scatter = "2D Scatter"
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
    SIZE_MINOR
}

export type ValueClip = "size-min" | "size-max" | "angle-min" | "angle-max";

export class CatalogWidgetStore {
    public static readonly MinOverlaySize = 1;
    public static readonly MaxOverlaySize = 50;
    public static readonly MaxAreaSize = 4000;
    public static readonly MinTableSeparatorPosition = 5;
    public static readonly MaxTableSeparatorPosition = 95;
    public static readonly MinThickness = 1.0;
    public static readonly MaxThickness = 10;
    public static readonly MinAngle = 0;
    public static readonly MaxAngle = 720;
    public static readonly SizeMapMin = 0;

    // -1 : apply different featherWidth according shape size
    private OverlayShapeSettings =  new Map<number, {featherWidth: number, diameterBase: number, areaBase: number}>([
        [CatalogOverlayShape.BOX_LINED, {featherWidth: 0.35, diameterBase: 1.5, areaBase: 100}],
        [CatalogOverlayShape.CIRCLE_FILLED, {featherWidth: 0.35, diameterBase: 1.5, areaBase: 70}],
        [CatalogOverlayShape.CIRCLE_LINED, {featherWidth: 0.5, diameterBase: 1.5, areaBase: 70}],
        [CatalogOverlayShape.ELLIPSE_LINED, {featherWidth: -1.0, diameterBase: 6, areaBase: 100}],
        [CatalogOverlayShape.HEXAGON_LINED, {featherWidth: 0.35, diameterBase: 0, areaBase: 50}],
        [CatalogOverlayShape.RHOMB_LINED, {featherWidth: 0.35, diameterBase: 1.5, areaBase: 100}],
        [CatalogOverlayShape.TRIANGLE_LINED_UP, {featherWidth: 0.35, diameterBase: 0, areaBase: 20}],
        [CatalogOverlayShape.TRIANGLE_LINED_DOWN, {featherWidth: 0.35, diameterBase: 0, areaBase: 20}],
        [CatalogOverlayShape.HEXAGON_LINED_2, {featherWidth: 0.35, diameterBase: 0, areaBase: 50}],
        [CatalogOverlayShape.CROSS_FILLED, {featherWidth: 0.5, diameterBase: 3.5, areaBase: 150}],
        [CatalogOverlayShape.X_FILLED, {featherWidth: 0.5, diameterBase: 3.5, areaBase: 150}],
        [CatalogOverlayShape.LineSegment_FILLED, {featherWidth: 0.35, diameterBase: 3, areaBase: 100}]
    ]);

    @observable catalogFileId: number;
    @observable headerTableColumnWidts: Array<number>;
    @observable dataTableColumnWidts: Array<number>;
    @observable showSelectedData: boolean;
    @observable catalogTableAutoScroll: boolean;
    @observable catalogPlotType: CatalogPlotType;
    @observable catalogSize: number;
    @observable catalogColor: string;
    @observable catalogShape: CatalogOverlayShape;
    @observable xAxis: string;
    @observable yAxis: string;
    @observable tableSeparatorPosition: string;
    @observable highlightColor: string;
    @observable settingsTabId: CatalogSettingsTabs;
    @observable thickness: number;
    // size map
    @observable sizeMapColumn: string;
    @observable sizeColumnMax: {default: number, clipd: number};
    @observable sizeColumnMin: {default: number, clipd: number};
    @observable sizeMax: {area: number, diameter: number};
    @observable sizeMin: {area: number, diameter: number};
    @observable sizeArea: boolean;
    @observable sizeScalingType: FrameScaling;
    @observable sizeAxisTabId: CatalogSettingsTabs.SIZE_MINOR | CatalogSettingsTabs.SIZE_MAJOR;
    @observable sizeColumnMinLocked: boolean;
    @observable sizeColumnMaxLocked: boolean;
    // size map minor
    @observable sizeMinorMapColumn: string;
    @observable sizeMinorColumnMax: {default: number, clipd: number};
    @observable sizeMinorColumnMin: {default: number, clipd: number};
    @observable sizeMinorArea: boolean;
    @observable sizeMinorScalingType: FrameScaling;
    @observable sizeMinorColumnMinLocked: boolean;
    @observable sizeMinorColumnMaxLocked: boolean;
    // color map
    @observable colorMapColumn: string;
    @observable colorColumnMax: {default: number, clipd: number};
    @observable colorColumnMin: {default: number, clipd: number};
    @observable colorMap: string;
    @observable colorScalingType: FrameScaling;
    @observable invertedColorMap: boolean;
    // orientation
    @observable orientationMapColumn: string;
    @observable orientationMax: {default: number, clipd: number};
    @observable orientationMin: {default: number, clipd: number};
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
        this.catalogSize = 10;
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

        reaction(() => this.sizeMapData, (column) => {
            const result = minMaxArray(column);
            this.setSizeColumnMin(isFinite(result.minVal)? result.minVal : 0, "default");
            this.setSizeColumnMax(isFinite(result.maxVal)? result.maxVal : 0, "default");
        });

        reaction(() => this.sizeArray(), (size) => {
            if (size.length) {
                CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, size, CatalogTextureType.Size);   
            }
        });

        reaction(() => this.sizeColumnMin.clipd, (sizeColumnMin) => {
            if (this.sizeColumnMinLocked) {
                this.sizeMinorColumnMin.clipd = sizeColumnMin;
            }
        });

        reaction(() => this.sizeColumnMax.clipd, (sizeColumnMax) => {
            if (this.sizeColumnMaxLocked) {
                this.sizeMinorColumnMax.clipd = sizeColumnMax;
            }
        });

        reaction(() => this.sizeMinorMapData, (column) => {
            const result = minMaxArray(column);
            this.setSizeMinorColumnMin(isFinite(result.minVal)? result.minVal : 0, "default");
            this.setSizeMinorColumnMax(isFinite(result.maxVal)? result.maxVal : 0, "default");
        });

        reaction(() => this.sizeMinorArray(), (size) => {
            if (size.length) {
                CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, size, CatalogTextureType.SizeMinor);
            }
        });

        reaction(() => this.sizeMinorColumnMin.clipd, (sizeMinorColumnMin) => {
            if (this.sizeMinorColumnMinLocked) {
                this.sizeColumnMin.clipd = sizeMinorColumnMin;
            }
        });

        reaction(() => this.sizeMinorColumnMax.clipd, (sizeMinorColumnMax) => {
            if (this.sizeMinorColumnMaxLocked) {
                this.sizeColumnMax.clipd = sizeMinorColumnMax;
            }
        });

        reaction(() => this.colorMapData, (column) => {
            const result = minMaxArray(column);
            this.setColorColumnMin(isFinite(result.minVal)? result.minVal : 0, "default");
            this.setColorColumnMax(isFinite(result.maxVal)? result.maxVal : 0, "default");
        });

        reaction(() => this.colorArray(), (color) => {
            if (color.length) {
                CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, color, CatalogTextureType.Color);   
            }
        });

        reaction(() => this.orientationMapData, (column) => {
            const result = minMaxArray(column);
            this.setOrientationMin(isFinite(result.minVal)? result.minVal : 0, "default");
            this.setOrientationMax(isFinite(result.maxVal)? result.maxVal : 0, "default");
        });

        reaction(() => this.orientationArray(), (orientation) => {
           if (orientation.length) {
            CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, orientation, CatalogTextureType.Orientation);   
           }
        });
    }

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
        this.sizeMinorColumnMin = {default: undefined, clipd: undefined};
        this.sizeMinorColumnMax = {default: undefined, clipd: undefined};
        this.sizeMinorColumnMinLocked = false;
        this.sizeMinorColumnMaxLocked =false;
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

    @action setAngleMax(max: number) {
        this.angleMax = clamp(max, CatalogWidgetStore.MinAngle, CatalogWidgetStore.MaxAngle);
    }

    @action setAngleMin(min: number) {
        this.angleMin = clamp(min, CatalogWidgetStore.MinAngle, CatalogWidgetStore.MaxAngle);
    }

    @action setOrientationMax(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.orientationMax.default = val; 
            this.orientationMax.clipd = val;  
        } else {
            this.orientationMax.clipd = val;
        }
    }

    @action setOrientationMin(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.orientationMin.default = val;
            this.orientationMin.clipd = val; 
        } else {
            this.orientationMin.clipd = val;
        }
    }

    @action resetOrientationValue(type: "min" | "max") {
        if (type === "min") {
            this.orientationMin.clipd = this.orientationMin.default;
        } else {
            this.orientationMax.clipd = this.orientationMax.default;
        }
    }

    @action setOrientationMapColumn(coloum: string) {
        if (this.orientationMapColumn !== coloum) {
            this.orientationMapColumn = coloum;
            this.orientationMin = {default: undefined, clipd: undefined};
            this.orientationMax = {default: undefined, clipd: undefined};   
        }
    }

    @action setOrientationScalingType(type: FrameScaling) {
        this.orientationScalingType = type;
    }    

    @action setColorMapDirection(val: boolean) {
        this.invertedColorMap = val;
    }

    @action setColorColumnMax(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.colorColumnMax.default = val; 
            this.colorColumnMax.clipd = val;  
        } else {
            this.colorColumnMax.clipd = val;
        }
    }

    @action setColorColumnMin(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.colorColumnMin.default = val;
            this.colorColumnMin.clipd = val; 
        } else {
            this.colorColumnMin.clipd = val;
        }
    }

    @action resetColorColumnValue(type: "min" | "max") {
        if (type === "min") {
            this.colorColumnMin.clipd = this.colorColumnMin.default;
        } else {
            this.colorColumnMax.clipd = this.colorColumnMax.default;
        }
    }

    @action setColorMapColumn(coloum: string) {
        if (this.colorMapColumn !== coloum) {
            this.colorMapColumn = coloum;
            this.colorColumnMin = {default: undefined, clipd: undefined};
            this.colorColumnMax = {default: undefined, clipd: undefined};   
        }
    }

    @action setColorScalingType(type: FrameScaling) {
        this.colorScalingType = type;
    }

    @action setColorMap(colorMap: string) {
        this.colorMap = colorMap;
    }

    @action setSizeMax(val: number) {
        let areaMode = this.sizeArea;
        if (this.sizeAxisTabId === CatalogSettingsTabs.SIZE_MINOR) {
            areaMode = this.sizeMinorArea;
        }
        if (areaMode) {
            this.sizeMax.area = val;
        } else {
            this.sizeMax.diameter = val;
        }
    }

    @action setSizeMin(val: number) {
        let areaMode = this.sizeArea;
        if (this.sizeAxisTabId === CatalogSettingsTabs.SIZE_MINOR) {
            areaMode = this.sizeMinorArea;
        }
        if (areaMode) {
            this.sizeMin.area = val;
        } else {
            this.sizeMin.diameter = val;
        }
    }

    @action setSizeColumnMax(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.sizeColumnMax.default = val; 
            this.sizeColumnMax.clipd = val;  
        } else {
            this.sizeColumnMax.clipd = val;
        }
    }

    @action setSizeColumnMin(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.sizeColumnMin.default = val;
            this.sizeColumnMin.clipd = val; 
        } else {
            this.sizeColumnMin.clipd = val;
        }
    }

    @action resetSizeColumnValue(type: "min" | "max") {
        if (type === "min") {
            this.sizeColumnMin.clipd = this.sizeColumnMin.default;
        } else {
            this.sizeColumnMax.clipd = this.sizeColumnMax.default;
        }
    }

    @action setSizeScalingType(type: FrameScaling) {
        this.sizeScalingType = type;
    }

    @action setSizeArea(val: boolean) {
        this.sizeArea = val;
    }

    @action setSizeMap(coloum: string) {
        if (this.sizeMapColumn !== coloum) {
            this.sizeMapColumn = coloum;
            this.sizeColumnMin = {default: undefined, clipd: undefined};
            this.sizeColumnMax = {default: undefined, clipd: undefined};
            if (coloum === CatalogOverlay.NONE) {
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

    @action setSizeMinorColumnMax(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.sizeMinorColumnMax.default = val; 
            this.sizeMinorColumnMax.clipd = val;  
        } else {
            this.sizeMinorColumnMax.clipd = val;
        }
    }

    @action setSizeMinorColumnMin(val: number, type: "default" | "clipd") {
        if (type === "default") {
            this.sizeMinorColumnMin.default = val;
            this.sizeMinorColumnMin.clipd = val; 
        } else {
            this.sizeMinorColumnMin.clipd = val;
        }
    }

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
    }

    @action toggleSizeColumnMaxLock = () => {
        this.sizeColumnMaxLocked = !this.sizeColumnMaxLocked;
        if (this.sizeColumnMaxLocked) {
            this.sizeMinorColumnMax.clipd = this.sizeColumnMax.clipd;
        }
    }

    @action toggleSizeMinorColumnMinLock = () => {
        this.sizeMinorColumnMinLocked = !this.sizeMinorColumnMinLocked;
        if (this.sizeMinorColumnMinLocked) {
            this.sizeColumnMin.clipd = this.sizeMinorColumnMin.clipd;
        }
    }

    @action toggleSizeMinorColumnMaxLock = () => {
        this.sizeMinorColumnMaxLocked = !this.sizeMinorColumnMaxLocked;
        if (this.sizeMinorColumnMaxLocked) {
            this.sizeColumnMax.clipd = this.sizeMinorColumnMax.clipd;
        }
    }

    @action setSizeMinorScalingType(type: FrameScaling) {
        this.sizeMinorScalingType = type;
    }

    @action setSizeMinorArea(val: boolean) {
        this.sizeMinorArea = val;
    }

    @action setSizeMinorMap(coloum: string) {
        if(this.sizeMinorMapColumn !== coloum) {
            this.sizeMinorMapColumn = coloum;
            this.sizeMinorColumnMin = {default: undefined, clipd: undefined};
            this.sizeMinorColumnMax = {default: undefined, clipd: undefined};
            if (coloum === CatalogOverlay.NONE) {
                this.sizeMinorArea = false;
                this.sizeMinorColumnMinLocked = false;
                this.sizeMinorColumnMaxLocked = false;
                this.sizeColumnMinLocked = false;
                this.sizeColumnMaxLocked = false;
            }
        }
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

    @action setCatalogSize(size: number) {
        if (size >= CatalogWidgetStore.MinOverlaySize && size <= CatalogWidgetStore.MaxOverlaySize) {
            this.catalogSize = size;   
        }
    }

    @action setCatalogColor(color: string) {
        this.catalogColor = color;
    }

    @action setCatalogShape(shape: CatalogOverlayShape) {
        this.catalogShape = shape;
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

    @action setHighlightColor(color: string) {
        this.highlightColor = color;
    }

    @action setSettingsTabId = (tabId: CatalogSettingsTabs) => {
        this.settingsTabId = tabId;
        this.sizeAxisTabId = CatalogSettingsTabs.SIZE_MAJOR;
    }

    @action setThickness(val: number){
        this.thickness = clamp(val, CatalogWidgetStore.MinThickness, CatalogWidgetStore.MaxThickness);
    }

    @computed get orientationMapData(): Float32Array {
        const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!this.disableOrientationMap && catalogProfileStore) {
            let column = catalogProfileStore.get1DPlotData(this.orientationMapColumn).wcsData;
            return column? Float32Array.from(column) : new Float32Array(0);   
        } else {
            return new Float32Array(0);
        }
    }

    orientationArray(): Float32Array {
        let column = this.orientationMapData;
        if (!this.disableOrientationMap && column?.length && this.orientationMin.clipd !== undefined && this.orientationMax.clipd !== undefined) {
            return CARTACompute.CalculateCatalogOrientation(
                column,
                this.orientationMin.clipd, 
                this.orientationMax.clipd, 
                this.angleMin, 
                this.angleMax,
                this.orientationScalingType
            );
        } 
        return new Float32Array(0);
    }

    @computed get colorMapData(): Float32Array {
        const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!this.disableColorMap && catalogProfileStore) {
            let column = catalogProfileStore.get1DPlotData(this.colorMapColumn).wcsData;
            return column? Float32Array.from(column) : new Float32Array(0);   
        } else {
            return new Float32Array(0);
        }
    }

    colorArray(): Float32Array{
        const column = this.colorMapData;
        if (!this.disableColorMap && column?.length && this.colorColumnMin.clipd !== undefined && this.colorColumnMax.clipd !== undefined) {
            return CARTACompute.CalculateCatalogColor(
                column,
                this.invertedColorMap,
                this.colorColumnMin.clipd, 
                this.colorColumnMax.clipd, 
                this.colorScalingType
            ); 
        }
        return new Float32Array(0);
    }

    @computed get sizeMapData(): Float32Array {
        const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!this.disableSizeMap && catalogProfileStore) {
            let column = catalogProfileStore.get1DPlotData(this.sizeMapColumn).wcsData;
            return column? Float32Array.from(column) : new Float32Array(0);   
        } else {
            return new Float32Array(0);
        }
    }

    @computed get sizeMinorMapData(): Float32Array {
        const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!this.disableSizeMinorMap && catalogProfileStore) {
            let column = catalogProfileStore.get1DPlotData(this.sizeMinorMapColumn).wcsData;
            return column? Float32Array.from(column) : new Float32Array(0);   
        } else {
            return new Float32Array(0);
        }
    }

    sizeArray(): Float32Array {
        let column = this.sizeMapData;
        if (!this.disableSizeMap && column?.length && this.sizeColumnMin.clipd !== undefined && this.sizeColumnMax.clipd !== undefined) {
            const pointSize = this.pointSizebyType;
            let min = this.sizeArea? this.shapeSettings.areaBase : this.shapeSettings.diameterBase;
            return CARTACompute.CalculateCatalogSize(
                column,
                this.sizeColumnMin.clipd, 
                this.sizeColumnMax.clipd, 
                pointSize.min + min, 
                pointSize.max + min,
                this.sizeScalingType,
                this.sizeArea,
                devicePixelRatio
            );
        } 
        return new Float32Array(0);
    }

    sizeMinorArray(): Float32Array {
        let column = this.sizeMinorMapData;
        if (!this.disableSizeMinorMap && column?.length && this.sizeMinorColumnMin.clipd !== undefined && this.sizeMinorColumnMax.clipd !== undefined) {
            const pointSize = this.minorPointSizebyType;
            let min = this.sizeMinorArea? this.shapeSettings.areaBase : this.shapeSettings.diameterBase;
            return CARTACompute.CalculateCatalogSize(
                column,
                this.sizeMinorColumnMin.clipd, 
                this.sizeMinorColumnMax.clipd, 
                pointSize.min + min, 
                pointSize.max + min,
                this.sizeMinorScalingType,
                this.sizeMinorArea,
                devicePixelRatio
            );
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
            return CatalogWidgetStore.MaxOverlaySize;
        }
    }

    @computed get pointSizebyType(): {min: number, max: number} {
        if (this.sizeArea) {
            return {min: this.sizeMin.area, max: this.sizeMax.area};
        } else {
            return {min: this.sizeMin.diameter, max: this.sizeMax.diameter};
        } 
    }

    @computed get minorPointSizebyType(): {min: number, max: number} {
        if (this.sizeMinorArea) {
            return {min: this.sizeMin.area, max: this.sizeMax.area};
        } else {
            return {min: this.sizeMin.diameter, max: this.sizeMax.diameter};
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

    @computed get shapeSettings(): {featherWidth: number, diameterBase: number, areaBase: number} {
        const pointSize = this.sizeMajor? this.pointSizebyType : this.minorPointSizebyType;
        if (pointSize.min === 0) {
            return {featherWidth: this.OverlayShapeSettings.get(this.catalogShape).featherWidth, diameterBase: 0, areaBase: 0};
        }
        return this.OverlayShapeSettings.get(this.catalogShape);
    }

    public init = (widgetSettings): void => {
        if (!widgetSettings) {
            return;
        }
        const catalogFileId = widgetSettings.catalogFileId;
        if (typeof catalogFileId === "number" && catalogFileId >0) {
            this.catalogFileId = catalogFileId;
        }
        const catalogSize = widgetSettings.catalogSize;
        if (typeof catalogSize === "number" && catalogSize >= CatalogWidgetStore.MinOverlaySize && catalogSize <= CatalogWidgetStore.MaxOverlaySize) {
            this.catalogSize = catalogSize;
        }
        this.catalogShape =  widgetSettings.catalogShape;
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