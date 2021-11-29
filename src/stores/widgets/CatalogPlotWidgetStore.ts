import {action, observable, computed, makeObservable} from "mobx";
import {CatalogPlotType} from "stores/widgets";
import {CatalogOverlay, Point2D} from "models";
import {toExponential} from "utilities";

export interface CatalogPlotWidgetStoreProps {
    xColumnName: string;
    yColumnName?: string;
    plotType: CatalogPlotType;
}

export type Border = {xMin: number; xMax: number; yMin: number; yMax: number};
export type XBorder = {xMin: number; xMax: number};
export type DragMode = "zoom" | "pan" | "select" | "lasso" | "orbit" | "turntable" | false;

type Fitting = {intercept: number; slope: number; cov00: number; cov01: number; cov11: number; rss: number};
type Statistic = {mean: number; count: number; validCount: number; std: number; min: number; max: number; rms: number};

export class CatalogPlotWidgetStore {
    private static readonly Decimals = 4;
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
    @observable statisticColumnName: string;
    @observable statistic: Statistic;

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
        this.statisticColumnName = CatalogOverlay.NONE;
        this.initStatistic();
    }

    @action setStatisticColumn(columnName: string) {
        this.statisticColumnName = columnName;
    }

    @action setStatistic(value: Statistic) {
        this.statistic = value;
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

    @action initStatistic = () => {
        this.statistic = {mean: undefined, count: undefined, validCount: undefined, std: undefined, min: undefined, max: undefined, rms: undefined};
    };

    @computed get isScatterAutoScaled() {
        return this.scatterborder === undefined;
    }

    @computed get isHistogramAutoScaledX() {
        return this.histogramBorder === undefined;
    }

    @computed get fittingResultString(): string {
        if (this.showFittingResult) {
            const sqrtCov00 = toExponential(Math.sqrt(this.fitting.cov00), CatalogPlotWidgetStore.Decimals);
            const sqrtCov11 = toExponential(Math.sqrt(this.fitting.cov11), CatalogPlotWidgetStore.Decimals);
            return `${this.yColumnName} = ${toExponential(this.fitting.intercept, CatalogPlotWidgetStore.Decimals)} + ${toExponential(this.fitting.slope, CatalogPlotWidgetStore.Decimals)} ${this.xColumnName} <br>cov00 = ${toExponential(
                this.fitting.cov00,
                CatalogPlotWidgetStore.Decimals
            )}, cov01 = ${toExponential(this.fitting.cov01, CatalogPlotWidgetStore.Decimals)}, cov11 = ${toExponential(
                this.fitting.cov11,
                CatalogPlotWidgetStore.Decimals
            )} <br>sqrt(cov00) = ${sqrtCov00}, sqrt(cov11) = ${sqrtCov11} <br>rss = ${toExponential(this.fitting.rss, CatalogPlotWidgetStore.Decimals)}`;
        }
        return "";
    }

    @computed get showFittingResult(): boolean {
        return !isNaN(this.fitting.intercept) && !isNaN(this.fitting.slope) && !isNaN(this.minMaxX.minVal) && !isNaN(this.minMaxX.maxVal);
    }

    @computed get enableStatistic(): boolean {
        return this.statisticColumnName !== CatalogOverlay.NONE;
    }

    @computed get showStatisticResult(): boolean {
        return !isNaN(this.statistic.count) && !isNaN(this.statistic.validCount);
    }

    @computed get statisticString(): string {
        if (this.enableStatistic && this.showStatisticResult) {
            return `${this.statisticColumnName} - count: ${this.statistic.count}, valid count: ${this.statistic.validCount}, mean: ${toExponential(this.statistic.mean, CatalogPlotWidgetStore.Decimals)}, rms: ${toExponential(
                this.statistic.rms,
                CatalogPlotWidgetStore.Decimals
            )}, stddev: ${toExponential(this.statistic.std, CatalogPlotWidgetStore.Decimals)}, min: ${toExponential(this.statistic.min, CatalogPlotWidgetStore.Decimals)}, max: ${toExponential(
                this.statistic.max,
                CatalogPlotWidgetStore.Decimals
            )}`;
        }
        return "";
    }
}
