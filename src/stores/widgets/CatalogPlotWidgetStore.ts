import {action, observable, computed, makeObservable} from "mobx";
import {CatalogPlotType} from "stores/widgets";
import {Point2D} from "models";

export interface CatalogPlotWidgetStoreProps {
    xColumnName: string;
    yColumnName?: string;
    plotType: CatalogPlotType;
}

export type Border = {xMin: number; xMax: number; yMin: number; yMax: number};
export type XBorder = {xMin: number; xMax: number};
export type DragMode = "zoom" | "pan" | "select" | "lasso" | "orbit" | "turntable" | false;

export class CatalogPlotWidgetStore {
    @observable indicatorInfo: Point2D;
    @observable scatterborder: Border;
    @observable dragmode: DragMode;
    @observable plotType: CatalogPlotType;
    @observable histogramBorder: XBorder;
    @observable logScaleY: boolean;
    @observable nBinx: number;
    @observable xColumnName: string;
    @observable yColumnName: string;

    constructor(props: CatalogPlotWidgetStoreProps) {
        makeObservable(this);
        this.indicatorInfo = undefined;
        this.dragmode = "select";
        this.plotType = props.plotType;
        this.logScaleY = true;
        this.scatterborder = undefined;
        this.histogramBorder = undefined;
        this.nBinx = undefined;
        this.xColumnName = props.xColumnName;
        this.yColumnName = props.yColumnName;
    }

    @action setColumnX(columnName: string) {
        this.xColumnName = columnName;
    }

    @action setColumnY(columnName: string) {
        this.yColumnName = columnName;
    }

    @action setIndicator(val: Point2D) {
        this.indicatorInfo = val;
    }

    @action setScatterborder(border: Border) {
        this.scatterborder = border;
    }

    @action setHistogramXBorder(xborder: XBorder) {
        this.histogramBorder = xborder;
    }

    @action setDragmode(mode: DragMode) {
        this.dragmode = mode;
    }

    @action setLogScaleY(val: boolean) {
        this.logScaleY = val;
    }

    @action setNumBinsX(val: number) {
        this.nBinx = val;
    }

    @computed get isScatterAutoScaled() {
        return this.scatterborder === undefined;
    }

    @computed get isHistogramAutoScaledX() {
        return this.histogramBorder === undefined;
    }
}
