import * as CARTACompute from "carta_computation";
import {action, observable, makeObservable, computed, reaction} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CatalogOverlay, CatalogStore,FrameScaling, PreferenceStore} from "stores";
import {minMaxArray, clamp} from "utilities";

export enum CatalogPlotType {
    ImageOverlay = "Image Overlay",
    Histogram = "Histogram",
    D2Scatter = "2D Scatter"
}

export enum CatalogOverlayShape {
    BoxLined = 1,
    CircleFilled = 2,
    CircleLined = 3,
    HexagonLined = 5,
    RhombLined = 7,
    TriangleUpLined = 9,
    EllipseLined = 11,
    TriangleDownLined = 13,
    HexagonLined2 = 15,
    CrossFilled = 16,
    CrossLined = 17,
    XFilled = 18,
    XLined = 19
}

export enum CatalogSettingsTabs {
    GLOBAL,
    STYLING,
    COLOR,
    SIZE,
    ORIENTATION
}

export type ValueClip = "size-min" | "size-max" | "angle-min" | "angle-max";

export class CatalogWidgetStore {
    public static readonly MinOverlaySize = 1;
    public static readonly MaxOverlaySize = 50;
    public static readonly MaxAreaSize = 4000;
    public static readonly MinTableSeparatorPosition = 5;
    public static readonly MaxTableSeparatorPosition = 95;
    public static readonly MinThickness = 1.5;
    public static readonly MaxThickness = 10;
    public static readonly MinAngle = 0;
    public static readonly MaxAngle = 360;
    public static readonly SizeMapMin = 0;

    private OverlayShapeSettings =  new Map<number, {featherWidth: number, minSize: number}>([
        [CatalogOverlayShape.BoxLined, {featherWidth: 0.35, minSize: 5}],
        [CatalogOverlayShape.CircleFilled, {featherWidth: 0.35, minSize: 3}],
        [CatalogOverlayShape.CircleLined, {featherWidth: 0.5, minSize: 3}],
        [CatalogOverlayShape.EllipseLined, {featherWidth: 1.0, minSize: 6}],
        [CatalogOverlayShape.HexagonLined, {featherWidth: 0.35, minSize: 6}],
        [CatalogOverlayShape.RhombLined, {featherWidth: 0.35, minSize: 5}],
        [CatalogOverlayShape.TriangleUpLined, {featherWidth: 0.35, minSize: 6}],
        [CatalogOverlayShape.TriangleDownLined, {featherWidth: 0.35, minSize: 6}],
        [CatalogOverlayShape.HexagonLined2, {featherWidth: 0.35, minSize: 6}],
        [CatalogOverlayShape.CrossFilled, {featherWidth: 0.0, minSize: 4}],
        [CatalogOverlayShape.XFilled, {featherWidth: 0.0, minSize: 4}]
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
        this.catalogSize = 5;
        this.catalogShape = CatalogOverlayShape.CircleLined;
        this.xAxis = CatalogOverlay.NONE;
        this.yAxis = CatalogOverlay.NONE;
        this.tableSeparatorPosition = PreferenceStore.Instance.catalogTableSeparatorPosition;
        this.highlightColor = Colors.RED2;
        this.settingsTabId = CatalogSettingsTabs.GLOBAL;
        this.thickness = 2.0;
        this.sizeMapColumn = CatalogOverlay.NONE;
        this.sizeArea = false;
        this.sizeScalingType = FrameScaling.LINEAR;
        this.sizeMin = {area: 100, diameter: 1};
        this.sizeMax = {area: 200, diameter: 20};
        this.sizeColumnMin = {default: undefined, clipd: undefined};
        this.sizeColumnMax = {default: undefined, clipd: undefined};
        this.colorMapColumn = CatalogOverlay.NONE;
        this.colorColumnMax = {default: undefined, clipd: undefined};
        this.colorColumnMin = {default: undefined, clipd: undefined};
        this.colorMap = "jet";
        this.colorScalingType = FrameScaling.LINEAR;
        this.invertedColorMap = false;
        this.orientationMapColumn = CatalogOverlay.NONE;
        this.orientationMax = {default: undefined, clipd: undefined};
        this.orientationMin = {default: undefined, clipd: undefined};
        this.orientationScalingType = FrameScaling.LINEAR;
        this.angleMax = CatalogWidgetStore.MaxAngle;
        this.angleMin = CatalogWidgetStore.MinAngle;

        reaction(()=>this.sizeMapData, (column) => {
            const result = minMaxArray(column);
            this.setSizeColumnMin(isFinite(result.minVal)? result.minVal : 0, "default");
            this.setSizeColumnMax(isFinite(result.maxVal)? result.maxVal : 0, "default");
        });

        reaction(()=>this.sizeArray(), (size) => {
            CatalogStore.Instance.updateCatalogSizeMap(this.catalogFileId, size);
        });

        reaction(()=>this.colorMapData, (column) => {
            const result = minMaxArray(column);
            this.setColorColumnMin(isFinite(result.minVal)? result.minVal : 0, "default");
            this.setColorColumnMax(isFinite(result.maxVal)? result.maxVal : 0, "default");
        });

        reaction(()=>this.colorArray(), (color) => {
            CatalogStore.Instance.updateCatalogColorMap(this.catalogFileId, color);
        });

        reaction(()=>this.orientationMapData, (column) => {
            const result = minMaxArray(column);
            this.setOrientationMin(isFinite(result.minVal)? result.minVal : 0, "default");
            this.setOrientationMax(isFinite(result.maxVal)? result.maxVal : 0, "default");
        });

        reaction(()=>this.orientationArray(), (orientation) => {
            CatalogStore.Instance.updateCatalogOrientationMap(this.catalogFileId, orientation);
        });
    }

    @action resetMaps() {
        // size
        this.sizeMapColumn = CatalogOverlay.NONE;
        this.sizeArea = false;
        this.sizeScalingType = FrameScaling.LINEAR;
        this.sizeMin = {area: 50, diameter: 1};
        this.sizeMax = {area: 200, diameter: 20};
        this.sizeColumnMin = {default: undefined, clipd: undefined};
        this.sizeColumnMax = {default: undefined, clipd: undefined};
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
        this.orientationMapColumn = coloum;
        this.orientationMin = {default: undefined, clipd: undefined};
        this.orientationMax = {default: undefined, clipd: undefined};
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
        this.colorMapColumn = coloum;
        this.colorColumnMin = {default: undefined, clipd: undefined};
        this.colorColumnMax = {default: undefined, clipd: undefined};
    }

    @action setColorScalingType(type: FrameScaling) {
        this.colorScalingType = type;
    }

    @action setColorMap(colorMap: string) {
        this.colorMap = colorMap;
    }

    @action setSizeMax(val: number) {
        if (this.sizeArea) {
            this.sizeMax.area = val;
        } else {
            this.sizeMax.diameter = val;
        }
    }

    @action setSizeMin(val: number) {
        if (this.sizeArea) {
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
        this.sizeMapColumn = coloum;
        this.sizeColumnMin = {default: undefined, clipd: undefined};
        this.sizeColumnMax = {default: undefined, clipd: undefined};
        if (coloum === CatalogOverlay.NONE) {
            this.sizeArea = false;
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

    sizeArray(): Float32Array {
        let column = this.sizeMapData;
        if (!this.disableSizeMap && column?.length && this.sizeColumnMin.clipd !== undefined && this.sizeColumnMax.clipd !== undefined) {
            const pointSize = this.pointSizebyType;
            let min = this.shapeSettings.minSize;
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

    @computed get disableSizeMap(): boolean {
        return this.sizeMapColumn === CatalogOverlay.NONE;
    }

    @computed get maxPointSizebyType(): number {
        if (this.sizeArea) {
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

    @computed get disableColorMap(): boolean {
        return this.colorMapColumn === CatalogOverlay.NONE;
    }

    @computed get disableOrientationMap(): boolean {
        return this.orientationMapColumn === CatalogOverlay.NONE;
    }

    @computed get shapeSettings(): {featherWidth: number, minSize: number} {
        const pointSize = this.pointSizebyType;
        if (pointSize.min === 0) {
            return {featherWidth: this.OverlayShapeSettings.get(this.catalogShape).featherWidth, minSize: 0};
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