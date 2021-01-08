import { action, observable, makeObservable } from "mobx";
import {Colors} from "@blueprintjs/core";

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

export class CatalogWidgetStore {
    public static readonly MinOverlaySize = 1;
    public static readonly MaxOverlaySize = 100;

    @observable catalogFileId: number;
    @observable headerTableColumnWidts: Array<number>;
    @observable dataTableColumnWidts: Array<number>;
    @observable showSelectedData: boolean;
    @observable catalogTableAutoScroll: boolean;
    @observable catalogPlotType: CatalogPlotType;
    @observable catalogSize: number;
    @observable catalogColor: string;
    @observable catalogShape: CatalogOverlayShape;

    constructor(catalogFileId: number) {
        makeObservable(this);
        this.catalogFileId = catalogFileId;
        this.headerTableColumnWidts = [75, 75, 65, 100, null];
        this.showSelectedData = false;
        this.catalogTableAutoScroll = false;
        this.catalogPlotType = CatalogPlotType.ImageOverlay;
        this.catalogColor = Colors.TURQUOISE3;
        this.catalogSize = 5;
        this.catalogShape = CatalogOverlayShape.Circle;
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
}