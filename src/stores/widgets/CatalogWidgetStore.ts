import { action, observable, makeObservable } from "mobx";
import {Colors} from "@blueprintjs/core";
import {CatalogOverlay} from "stores/CatalogProfileStore";
import {PreferenceStore} from "stores";

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
}

const DEFAULTS = {
    headerTableColumnWidts: [150, 75, 65, 100, 230],
    showSelectedData: false,
    catalogTableAutoScroll: false,
    catalogPlotType: CatalogPlotType.ImageOverlay,
    catalogColor: Colors.TURQUOISE3,
    catalogSize: 10,
    catalogShape: CatalogOverlayShape.CircleLined,
    xAxis: CatalogOverlay.NONE,
    yAxis: CatalogOverlay.NONE,
    highlightColor: Colors.RED2,
    settingsTabId: CatalogSettingsTabs.GLOBAL
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
    @observable highlightColor: string;
    @observable settingsTabId: CatalogSettingsTabs;

    constructor(catalogFileId: number) {
        makeObservable(this);
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
        this.tableSeparatorPosition = PreferenceStore.Instance.catalogTableSeparatorPosition;
        this.highlightColor = DEFAULTS.highlightColor;
        this.settingsTabId = DEFAULTS.settingsTabId;
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