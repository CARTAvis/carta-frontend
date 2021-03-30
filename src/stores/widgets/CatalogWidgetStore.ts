import * as GSL from "gsl_wrapper";
import * as CARTACompute from "carta_computation";
import {action, observable, makeObservable, computed, reaction} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CatalogOverlay, CatalogStore, FrameScaling, PreferenceStore} from "stores";
import {getColorsForValues} from "utilities";

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
    IMAGE_OVERLAY,
    COLOR,
    SIZE
}

export type SizeClip = "size-min" | "size-max";

export class CatalogWidgetStore {
    public static readonly MinOverlaySize = 1;
    public static readonly MaxOverlaySize = 50;
    public static readonly MaxAreaSize = 8000;
    public static readonly MinTableSeparatorPosition = 5;
    public static readonly MaxTableSeparatorPosition = 95;

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

    constructor(catalogFileId: number) {
        makeObservable(this);
        this.catalogFileId = catalogFileId;
        this.headerTableColumnWidts = [150, 75, 65, 100, 230];
        this.showSelectedData = false;
        this.catalogTableAutoScroll = false;
        this.catalogPlotType = CatalogPlotType.ImageOverlay;
        this.catalogColor = Colors.TURQUOISE3;
        this.catalogSize = 20;
        this.catalogShape = CatalogOverlayShape.CircleLined;
        this.xAxis = CatalogOverlay.NONE;
        this.yAxis = CatalogOverlay.NONE;
        this.tableSeparatorPosition = PreferenceStore.Instance.catalogTableSeparatorPosition;
        this.highlightColor = Colors.RED2;
        this.settingsTabId = CatalogSettingsTabs.GLOBAL;
        this.sizeMapColumn = CatalogOverlay.NONE;
        this.sizeArea = false;
        this.sizeScalingType = FrameScaling.LINEAR;
        this.sizeMin = {area: 100, diameter: 10};
        this.sizeMax = {area: 200, diameter: 20};
        this.sizeColumnMin = {default: undefined, clipd: undefined};
        this.sizeColumnMax = {default: undefined, clipd: undefined};
        
        this.colorMapColumn = CatalogOverlay.NONE;
        this.colorColumnMax = {default: undefined, clipd: undefined};
        this.colorColumnMin = {default: undefined, clipd: undefined};
        this.colorMap = "jet";
        this.colorScalingType = FrameScaling.LINEAR;

        reaction(()=>this.sizeMapData, (column) => {
            const result =  GSL.minMaxArray(column);
            this.setSizeColumnMin(isFinite(result.min)? result.min : 0, "default");
            this.setSizeColumnMax(isFinite(result.max)? result.max : 0, "default");
        });

        reaction(()=>this.sizeArray, (res) => {
            CatalogStore.Instance.updateCatalogSizeMap(this.catalogFileId, res);
        });

        reaction(()=>this.colorMapData, (column) => {
            const result =  GSL.minMaxArray(column);
            this.setColorColumnMin(isFinite(result.min)? result.min : 0, "default");
            this.setColorColumnMax(isFinite(result.max)? result.max : 0, "default");
        });
    }

    @action resetMaps() {
        this.sizeMapColumn = CatalogOverlay.NONE;
        this.sizeArea = false;
        this.sizeScalingType = FrameScaling.LINEAR;
        this.sizeMin = {area: 100, diameter: 10};
        this.sizeMax = {area: 200, diameter: 20};
        this.sizeColumnMin = {default: undefined, clipd: undefined};
        this.sizeColumnMax = {default: undefined, clipd: undefined};
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

    @action setColormap(colorMap: string) {
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

    @computed get colorMapData(): number[] {
        const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!this.disableColorMap && catalogProfileStore) {
            let column = catalogProfileStore.get1DPlotData(this.colorMapColumn).wcsData;
            return column;   
        } else {
            return [];
        }
    }

    @computed get colorArray(): string[]{
        const column = this.colorMapData;
        const colorMap = getColorsForValues(this.colorMap);

        if (!this.disableColorMap && column?.length && colorMap?.size > 1) {
            return CARTACompute.CalculateCatalogColor(
                new Float64Array(column),
                colorMap.color,
                colorMap.size,
                false,
                this.colorColumnMin.clipd, 
                this.colorColumnMax.clipd, 
                this.colorScalingType
            ); 
        }
        return [];
    }

    @computed get sizeMapData(): number[] {
        const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        if (!this.disableSizeMap && catalogProfileStore) {
            let column = catalogProfileStore.get1DPlotData(this.sizeMapColumn).wcsData;
            return column;   
        } else {
            return [];
        }
    }

    @computed get sizeArray(): Float32Array {
        const column = this.sizeMapData;
        if (!this.disableSizeMap && column?.length && this.sizeColumnMin.clipd !== undefined && this.sizeColumnMax.clipd !== undefined) {
            // wasm 0.25s, Js 0.9s
            const pointSize = this.pointSizebyType;
            return CARTACompute.CalculateCatalogSize(
                column,
                this.sizeColumnMin.clipd, 
                this.sizeColumnMax.clipd, 
                pointSize.min, 
                pointSize.max,
                this.sizeScalingType,
                this.sizeArea
            );
        } 
        return new Float32Array(0);
    }

    @computed get disableSizeMap(): boolean {
        return this.sizeMapColumn === CatalogOverlay.NONE;
    }

    @computed get maxPointSizebyType(): number {
        if (this.sizeArea) {
            // scattergl `area` limitation around 20000
            return CatalogWidgetStore.MaxAreaSize;
        } else {
            // https://codepen.io/panchyo0/pen/qBqYrbR?editors=1010 
            // scattergl `diameter` limitation around 200, bug?
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
    };

    public toConfig = () => {
        return {
            catalogFileId: this.catalogFileId,
            catalogColor: this.catalogColor,
            highlightColor: this.highlightColor,
            catalogSize: this.catalogSize,
            catalogShape: this.catalogShape,
            tableSeparatorPosition: this.tableSeparatorPosition
        };
    };
}