import * as GSL from "gsl_wrapper";
import {action, observable, makeObservable, computed, reaction} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CatalogOverlay, CatalogStore, FrameScaling, PreferenceStore} from "stores";
import {scaleValue} from "utilities";

export enum CatalogPlotType {
    ImageOverlay = "Image Overlay",
    Histogram = "Histogram",
    D2Scatter = "2D Scatter"
}

export enum CatalogOverlayShape {
    Circle = "circle-open",
    FullCircle = "circle",
    Star = "star-open",
    FullStar = "star",
    Square = "square-open",
    Plus = "cross-thin-open",
    Cross = "x-thin-open",
    TriangleUp = "triangle-up-open",
    TriangleDown = "triangle-down-open",
    Diamond = "diamond-open",
    hexagon2 = "hexagon2-open",
    hexagon = "hexagon-open",
}

export enum CatalogSettingsTabs {
    GLOBAL,
    IMAGE_OVERLAY,
    COLOR,
    SIZE
}

// const DEFAULTS = {
//     headerTableColumnWidts: [150, 75, 65, 100, 230],
//     showSelectedData: false,
//     catalogTableAutoScroll: false,
//     catalogPlotType: CatalogPlotType.ImageOverlay,
//     catalogColor: Colors.TURQUOISE3,
//     catalogSize: 10,
//     catalogShape: CatalogOverlayShape.Circle,
//     xAxis: CatalogOverlay.NONE,
//     yAxis: CatalogOverlay.NONE,
//     highlightColor: Colors.RED2,
//     settingsTabId: CatalogSettingsTabs.GLOBAL,
//     sizeMapColumn: CatalogOverlay.NONE,
// };

export type SizeType = "area" | "diameter"; 
export type SizeClip = "size-min" | "size-max" | "column-min" | "column-max";

export class CatalogWidgetStore {
    public static readonly MinOverlaySize = 1;
    public static readonly MaxOverlaySize = 200;
    public static readonly MaxAreaSize = 20000;
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
    @observable sizeColumnMax: number;
    @observable sizeColumnMin: number;
    @observable sizeMax: {area: number, diameter: number};
    @observable sizeMin: number;
    @observable sizeMapType: SizeType;
    @observable scalingType: FrameScaling;

    constructor(catalogFileId: number) {
        makeObservable(this);
        this.catalogFileId = catalogFileId;
        this.headerTableColumnWidts = [150, 75, 65, 100, 230];
        this.showSelectedData = false;
        this.catalogTableAutoScroll = false;
        this.catalogPlotType = CatalogPlotType.ImageOverlay;
        this.catalogColor = Colors.TURQUOISE3;
        this.catalogSize = 20;
        this.catalogShape = CatalogOverlayShape.Circle;
        this.xAxis = CatalogOverlay.NONE;
        this.yAxis = CatalogOverlay.NONE;
        this.tableSeparatorPosition = PreferenceStore.Instance.catalogTableSeparatorPosition;
        this.highlightColor = Colors.RED2;
        this.settingsTabId = CatalogSettingsTabs.GLOBAL;
        this.sizeMapColumn = CatalogOverlay.NONE;
        this.sizeMapType = "diameter";
        this.scalingType = FrameScaling.LINEAR;
        this.sizeMin = 1;
        this.sizeMax = {area: 200, diameter: 20};
        this.sizeColumnMin = undefined;
        this.sizeColumnMax = undefined;

        reaction(()=>this.columnData, (column) => {
            // const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
            // let column = catalogProfileStore.get1DPlotData(this.sizeMapColumn).wcsData;
            // let typed = Float64Array.from(column);
            // console.log(column, typed)
            const boundary = GSL.minMaxArray(column);
            console.log(boundary)
            this.sizeColumnMin = isFinite(boundary.min)? boundary.min : 0;
            this.sizeColumnMax = isFinite(boundary.max)? boundary.max : 0;
        } )
    }

    @action setSizeMax(val: number, type: SizeType){
        if (type === "area") {
            this.sizeMax.area = val;
        } else {
            this.sizeMax.diameter = val;
        }
    }

    @action setSizeMin(val: number){
        this.sizeMin = val;
    }

    @action setSizeColumnMax(val: number){
        this.sizeColumnMax = val;
    }

    @action setSizeColumnMin(val: number){
        this.sizeColumnMin = val;
    }

    @action setScalingType(type: FrameScaling) {
        this.scalingType = type;
    }

    @action setSizeMapType(type: SizeType) {
        this.sizeMapType = type;
    }

    @action setSizeMap(coloum: string) {
        this.sizeMapColumn = coloum;
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
        this.catalogSize = size;
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

    @computed get columnData() {
        if (this.sizeMapColumn !== CatalogOverlay.NONE) {
            const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
            let column = catalogProfileStore.get1DPlotData(this.sizeMapColumn).wcsData;
            return column;   
        } else {
            return [];
        }
    }

    @computed get sizeArray(): number[] {
        // const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
        // let column = catalogProfileStore.get1DPlotData(this.sizeMapColumn).wcsData;
        console.log(this.sizeColumnMin, this.sizeColumnMax)
        const column = this.columnData;
        if (this.sizeMapColumn !== CatalogOverlay.NONE && column?.length && this.sizeColumnMin !== undefined && this.sizeColumnMax !== undefined) {
            let size = new Array(column.length);
            let columnMin = scaleValue(this.sizeColumnMin, this.scalingType);
            let columnMax = scaleValue(this.sizeColumnMax, this.scalingType);
            console.log(column.length, columnMax, columnMin);
            const range = columnMax - columnMin;
            // const fraction = scaleValue(this.catalogSize, this.scalingType) / scaleValue(max, this.scalingType);
            for (let index = 0; index < column.length; index++) {
                // size[index] = fraction * scaleValue(column[index], this.scalingType);
                let columnValue = column[index];
                if (this.sizeMapType === "area") {
                    columnValue = Math.sqrt((scaleValue(column[index], this.scalingType) - columnMin) / range) * this.pointSizebyType;
                } else {
                    columnValue = (scaleValue(column[index], this.scalingType) - columnMin) / range * this.pointSizebyType;
                }
                
                if (columnValue < this.sizeMin || !isFinite(columnValue)) {
                    columnValue = this.sizeMin;
                }

                if(columnValue > this.maxPointSizebyType) {
                    columnValue = this.maxPointSizebyType;
                }

                size[index] = columnValue;
            }
            console.log(this.scalingType, size);
            return size;   
        } 
        return [];
    }

    @computed get disableSizeMap(): boolean {
        return this.sizeMapColumn === CatalogOverlay.NONE;
    }

    @computed get maxPointSizebyType(): number {
        if (this.sizeMapType === "area") {
            // scattergl `area` limitation around 20000
            return CatalogWidgetStore.MaxAreaSize;
        } else {
            // https://codepen.io/panchyo0/pen/qBqYrbR?editors=1010 
            // scattergl `diameter` limitation around 200, bug?
            return CatalogWidgetStore.MaxOverlaySize;
        }
    }

    @computed get pointSizebyType(): number {
        if (this.sizeMapType === "area") {
            return this.sizeMax.area;
        } else {
            return this.sizeMax.diameter;
        } 
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