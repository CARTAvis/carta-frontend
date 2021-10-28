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

type Fitting = {intercept: number; slope: number; cov00: number; cov01: number; cov11: number; rss: number};

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
    @observable fitting: Fitting;
    @observable minMaxX: {minVal: number; maxVal: number};

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
        this.initLinearFitting();
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

    @action setFitting(value: Fitting) {
        this.fitting = value;
    }

    @action setMinMaxX(value: {minVal: number; maxVal: number}) {
        this.minMaxX = value;
    }

    @action initLinearFitting = () => {
        this.setFitting({intercept: undefined, slope: undefined, cov00: undefined, cov01: undefined, cov11: undefined, rss: undefined});
        this.setMinMaxX({minVal: undefined, maxVal: undefined});
    };

    @computed get isScatterAutoScaled() {
        return this.scatterborder === undefined;
    }

    @computed get isHistogramAutoScaledX() {
        return this.histogramBorder === undefined;
    }

    @computed get fittingResultString(): string {
        if (this.showFittingResult) {
            return `${this.yColumnName} = ${this.fitting.intercept.toFixed(3)} + ${this.fitting.slope.toFixed(3)} ${this.xColumnName}, cov00 = ${this.fitting.cov00.toFixed(3)}, cov01 = ${this.fitting.cov01.toFixed(
                3
            )}, cov11 = ${this.fitting.cov11.toFixed(3)}, rss = ${this.fitting.rss.toFixed(3)}`;
        }
        return "";
    }

    @computed get showFittingResult(): boolean {
        return !isNaN(this.fitting.intercept) && !isNaN(this.fitting.slope) && !isNaN(this.minMaxX.minVal) && !isNaN(this.minMaxX.maxVal);
    }
}
