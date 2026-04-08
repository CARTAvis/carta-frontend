import {action, computed, makeObservable, observable} from "mobx";
import type {Point2D} from "models";

import {CatalogOverlay, type CatalogPlotType} from "enums";
import {ToExponential} from "utilities";

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
    @observable indicatorInfo: Point2D | undefined = undefined;
    @observable scatterBorder: Border | undefined = undefined;
    @observable dragMode: DragMode = "select";
    @observable plotType: CatalogPlotType;
    @observable histogramBorder: XBorder | undefined = undefined;
    @observable isLogScaleY: boolean = true;
    @observable nBinx: number | undefined = undefined;
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

    @action setScatterBorder(border: Border) {
        this.scatterBorder = border;
    }

    @action setHistogramXBorder(xBorder: XBorder) {
        this.histogramBorder = xBorder;
    }

    @action setDragMode(mode: DragMode) {
        this.dragMode = mode;
    }

    @action setLogScaleY(isBool: boolean) {
        this.isLogScaleY = isBool;
    }

    @action setNumBinsX(val: number) {
        this.nBinx = val;
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
        if (this.shouldShowFittingResult && this.fitting) {
            const sqrtCov00 = ToExponential(Math.sqrt(this.fitting.cov00), CatalogPlotWidgetStore.Decimals);
            const sqrtCov11 = ToExponential(Math.sqrt(this.fitting.cov11), CatalogPlotWidgetStore.Decimals);
            return `${this.yColumnName} = ${ToExponential(this.fitting.intercept, CatalogPlotWidgetStore.Decimals)} + ${ToExponential(this.fitting.slope, CatalogPlotWidgetStore.Decimals)} ${this.xColumnName} <br>cov00 = ${ToExponential(
                this.fitting.cov00,
                CatalogPlotWidgetStore.Decimals
            )}, cov01 = ${ToExponential(this.fitting.cov01, CatalogPlotWidgetStore.Decimals)}, cov11 = ${ToExponential(
                this.fitting.cov11,
                CatalogPlotWidgetStore.Decimals
            )} <br>sqrt(cov00) = ${sqrtCov00}, sqrt(cov11) = ${sqrtCov11} <br>rss = ${ToExponential(this.fitting.rss, CatalogPlotWidgetStore.Decimals)}`;
        }
        return "";
    }

    @computed get shouldShowFittingResult(): boolean {
        if (!this.fitting || !this.minMaxX) {
            return false;
        }
        return !isNaN(this.fitting.intercept) && !isNaN(this.fitting.slope) && !isNaN(this.minMaxX.minVal) && !isNaN(this.minMaxX.maxVal);
    }

    @computed get shouldEnableStatistic(): boolean {
        return this.statisticColumnName !== CatalogOverlay.NONE;
    }

    @computed get shouldShowStatisticResult(): boolean {
        if (!this.statistic) {
            return false;
        }
        return !isNaN(this.statistic.count) && !isNaN(this.statistic.validCount);
    }

    @computed get statisticString(): string {
        if (this.shouldEnableStatistic && this.shouldShowStatisticResult && this.statistic) {
            return `${this.statisticColumnName} - count: ${this.statistic.count}, valid count: ${this.statistic.validCount}, mean: ${ToExponential(this.statistic.mean, CatalogPlotWidgetStore.Decimals)}, rms: ${ToExponential(
                this.statistic.rms,
                CatalogPlotWidgetStore.Decimals
            )}, stddev: ${ToExponential(this.statistic.std, CatalogPlotWidgetStore.Decimals)}, min: ${ToExponential(this.statistic.min, CatalogPlotWidgetStore.Decimals)}, max: ${ToExponential(
                this.statistic.max,
                CatalogPlotWidgetStore.Decimals
            )}`;
        }
        return "";
    }
}
