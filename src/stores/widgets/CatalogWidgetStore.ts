// import * as GSL from "gsl_wrapper";
import { action, observable, makeObservable, computed } from "mobx";
import {Colors} from "@blueprintjs/core";
import {CatalogOverlay, CatalogStore, PreferenceStore} from "stores";

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

export class CatalogWidgetStore {
    public static readonly MinOverlaySize = 1;
    public static readonly MaxOverlaySize = 100;
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
    @observable sizeMapColumn: string;
    @observable sizeMapMax: number;
    @observable sizeMapMin: number;

    constructor(catalogFileId: number) {
        makeObservable(this);
        this.catalogFileId = catalogFileId;
        this.headerTableColumnWidts = [150, 75, 65, 100, 230];
        this.showSelectedData = false;
        this.catalogTableAutoScroll = false;
        this.catalogPlotType = CatalogPlotType.ImageOverlay;
        this.catalogColor = Colors.TURQUOISE3;
        this.catalogSize = 10;
        this.catalogShape = CatalogOverlayShape.Circle;
        this.xAxis = CatalogOverlay.NONE;
        this.yAxis = CatalogOverlay.NONE;
        this.tableSeparatorPosition = PreferenceStore.Instance.catalogTableSeparatorPosition;
        this.highlightColor = Colors.RED2;
        this.settingsTabId = CatalogSettingsTabs.GLOBAL;
        this.sizeMapColumn = CatalogOverlay.NONE;
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

    @computed get sizeArray(): number[] {
        if (this.sizeMapColumn !== CatalogOverlay.NONE) {
            const catalogProfileStore = CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
            let column = catalogProfileStore.get1DPlotData(this.sizeMapColumn).wcsData;
            let size = new Array(column.length);
            let min = column[0];
            let max = column[column.length - 1];
            console.log(column, min, max);
            const abs = Math.abs(max - min);
            for (let index = 0; index < column.length; index++) {
                const element = column[index];
                size[index] = Math.abs(element) / abs * this.catalogSize * 2;
            }
            // console.log(size);
            return size;   
        } 
        return [];
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