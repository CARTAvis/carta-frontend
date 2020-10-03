import {action, observable, computed} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CatalogOverlay} from "stores/CatalogProfileStore";

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

const DEFAULTS = {
    headerTableColumnWidts: [75, 75, 65, 100, null],
    showSelectedData: false,
    catalogTableAutoScroll: false,
    catalogPlotType: CatalogPlotType.ImageOverlay,
    catalogColor: Colors.TURQUOISE3,
    catalogSize: 10,
    catalogShape: CatalogOverlayShape.Circle,
    xAxis: CatalogOverlay.NONE,
    yAxis: CatalogOverlay.NONE,
    tableSeparatorPosition: "60%"
};

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

    constructor(catalogFileId: number) {
        this.catalogFileId = catalogFileId;
        this.headerTableColumnWidts = DEFAULTS.headerTableColumnWidts;
        this.showSelectedData = DEFAULTS.showSelectedData;
        this.catalogTableAutoScroll = DEFAULTS.catalogTableAutoScroll;
        this.catalogPlotType = DEFAULTS.catalogPlotType;
        this.catalogColor = DEFAULTS.catalogColor;
        this.catalogSize = DEFAULTS.catalogSize;
        this.catalogShape = DEFAULTS.catalogShape;
        this.xAxis = DEFAULTS.xAxis;
        this.yAxis = DEFAULTS.yAxis;
        this.tableSeparatorPosition = DEFAULTS.tableSeparatorPosition;
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
}