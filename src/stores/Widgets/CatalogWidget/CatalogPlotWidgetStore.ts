import {action, computed, makeObservable, observable} from "mobx";
import type {Point2D} from "models";

import {CatalogOverlay, type CatalogPlotType} from "enums";
import {toExponential} from "utilities";

export interface CatalogPlotWidgetStoreProps {
    xColumnName: string;
    yColumnName?: string;
    plotType: CatalogPlotType;
}

export type Border = {xMin: number; xMax: number; yMin: number; yMax: number};
export type XBorder = {xMin: number; xMax: number};
export type DragMode = "zoom" | "pan" | "select" | "lasso" | false;
export type HistogramDragMode = "zoom" | "pan" | "select";

type Fitting = {intercept: number; slope: number; cov00: number; cov01: number; cov11: number; rss: number};
type Statistic = {mean: number; count: number; validCount: number; std: number; min: number; max: number; rms: number};

export class CatalogPlotWidgetStore {
    private static readonly Decimals = 4;
    @observable indicatorInfo: Point2D | undefined = undefined;
    @observable scatterBorder: Border | undefined = undefined;
    @observable dragMode: DragMode = "select";
    @observable histogramDragMode: HistogramDragMode = "zoom";
    @observable plotType: CatalogPlotType;
    @observable histogramBorder: XBorder | undefined = undefined;
    @observable isLogScaleY: boolean = true;
    @observable nBinX: number | undefined = undefined;
    @observable xColumnName: string;
    @observable yColumnName: string | undefined;
    @observable fitting: Fitting | null = null;
    @observable minMaxX: {minVal: number; maxVal: number} | null = null;
    @observable statisticColumnName: string = CatalogOverlay.NONE;
    @observable statistic: Statistic | null = null;

    constructor(props: CatalogPlotWidgetStoreProps) {
        this.plotType = props.plotType;
        this.xColumnName = props.xColumnName;
        this.yColumnName = props.yColumnName;
        makeObservable(this);
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
        this.scatterBorder = border;
    }

    @action setHistogramXBorder(xborder: XBorder) {
        this.histogramBorder = xborder;
    }

    @action setDragMode(mode: DragMode) {
        this.dragMode = mode;
    }

    @action setHistogramDragMode(mode: HistogramDragMode) {
        this.histogramDragMode = mode;
    }

    @action setLogScaleY(isLogScaleY: boolean) {
        this.isLogScaleY = isLogScaleY;
    }

    @action setNumBinsX(val: number) {
        this.nBinX = val;
    }

    @action setFitting(value: Fitting | null) {
        this.fitting = value;
    }

    @action setMinMaxX(value: {minVal: number; maxVal: number} | null) {
        this.minMaxX = value;
    }

    @action initLinearFitting = () => {
        this.setFitting(null);
        this.setMinMaxX(null);
    };

    @action initStatistic = () => {
        this.statistic = null;
    };

    @computed get isScatterAutoScaled() {
        return this.scatterBorder === undefined;
    }

    @computed get isHistogramAutoScaledX() {
        return this.histogramBorder === undefined;
    }

    @computed get fittingResultString(): string {
        if (this.isFittingResultVisible && this.fitting) {
            const sqrtCov00 = toExponential(Math.sqrt(this.fitting.cov00), CatalogPlotWidgetStore.Decimals);
            const sqrtCov11 = toExponential(Math.sqrt(this.fitting.cov11), CatalogPlotWidgetStore.Decimals);
            return `${this.yColumnName} = ${toExponential(this.fitting.intercept, CatalogPlotWidgetStore.Decimals)} + ${toExponential(this.fitting.slope, CatalogPlotWidgetStore.Decimals)} ${this.xColumnName}\ncov00 = ${toExponential(
                this.fitting.cov00,
                CatalogPlotWidgetStore.Decimals
            )}, cov01 = ${toExponential(this.fitting.cov01, CatalogPlotWidgetStore.Decimals)}, cov11 = ${toExponential(
                this.fitting.cov11,
                CatalogPlotWidgetStore.Decimals
            )}\nsqrt(cov00) = ${sqrtCov00}, sqrt(cov11) = ${sqrtCov11}\nrss = ${toExponential(this.fitting.rss, CatalogPlotWidgetStore.Decimals)}`;
        }
        return "";
    }

    @computed get isFittingResultVisible(): boolean {
        if (!this.fitting || !this.minMaxX) {
            return false;
        }
        return !isNaN(this.fitting.intercept) && !isNaN(this.fitting.slope) && !isNaN(this.minMaxX.minVal) && !isNaN(this.minMaxX.maxVal);
    }

    @computed get isStatisticEnabled(): boolean {
        return this.statisticColumnName !== CatalogOverlay.NONE;
    }

    @computed get isStatisticResultVisible(): boolean {
        if (!this.statistic) {
            return false;
        }
        return !isNaN(this.statistic.count) && !isNaN(this.statistic.validCount);
    }

    @computed get statisticString(): string {
        if (this.isStatisticEnabled && this.isStatisticResultVisible && this.statistic) {
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
