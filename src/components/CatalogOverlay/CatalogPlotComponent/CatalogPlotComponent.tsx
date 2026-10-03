import * as React from "react";
import {Bar} from "react-chartjs-2";
import {AnchorButton, Button, Classes, Colors, FormGroup, Intent, MenuItem, NonIdealState, PopoverPosition, Switch, Tooltip} from "@blueprintjs/core";
import {type ItemPredicate, type ItemRendererProps, Select} from "@blueprintjs/select";
import {CARTA} from "carta-protobuf";
import {BarController, BarElement, Chart, type ChartArea, type ChartOptions, Legend, LinearScale, LogarithmicScale, type Plugin, PointElement, type Tick} from "chart.js";
import {type AnnotationOptions} from "chartjs-plugin-annotation";
import FuzzySearch from "fuzzy-search";
import * as GSL from "gsl_wrapper";
import * as _ from "lodash";
import {action, autorun, computed, type IReactionDisposer, makeObservable, observable, reaction} from "mobx";
import {observer} from "mobx-react";
import tinycolor from "tinycolor2";

import {ClearableNumericInputComponent, ProfilerInfoComponent} from "components/Shared";
import {type MultiPlotProps} from "components/Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {ToolbarComponent} from "components/Shared/LinePlot/Toolbar/ToolbarComponent";
import {ScatterPlotComponent} from "components/Shared/ScatterPlot/ScatterPlotComponent";
import {CatalogPlotType, CatalogUpdateMode, DragMode, PlotType, TickType} from "enums";
import {CustomIcon} from "icons/CustomIcons";
import {type Point2D} from "models";
import {AppStore, type CatalogDisplayStore, type CatalogOnlineQueryProfileStore, type CatalogProfileStore, CatalogStore, type DefaultWidgetConfig, type WidgetProps, WidgetsStore} from "stores";
import {type Border, type CatalogPlotWidgetStore, type CatalogPlotWidgetStoreProps, type XBorder} from "stores/Widgets";
import {
    CatalogHistogramInteraction,
    CatalogScatterSpatialIndex,
    clamp,
    computeHistogramBins,
    exportTsvFile,
    formatCatalogPlotTick,
    getCatalogScatterBorder,
    getTimestamp,
    isPointInPolygon,
    minMaxArray,
    toExponential,
    toFixed
} from "utilities";

import {CatalogScatterWebGL} from "./CatalogScatterWebGL";

import "./CatalogPlotComponent.scss";

Chart.register(BarController, BarElement, Legend, LinearScale, LogarithmicScale, PointElement);

const DEFAULT_NUM_BINS = 10; // default fallback
const DOUBLE_CLICK_THRESHOLD = 300;
const EXPORT_RIGHT_PADDING = 10;

@observer
export class CatalogPlotComponent extends React.Component<WidgetProps> {
    @observable profileId: string = "";
    @observable componentId: string = "";
    @observable private isHistogramMouseEntered: boolean = false;
    private plotType: CatalogPlotType;
    private static emptyColumn = "None";
    private catalogFileNames: Map<number, string>;
    private readonly disposers: IReactionDisposer[] = [];
    private widgetId: string;
    private histogramInteraction: CatalogHistogramInteraction;
    private histogramPlotRef: Chart<"bar"> | null = null;
    private scatterChartArea: ChartArea | undefined;
    private cursorNearestScatterPoint: {x: number; y: number} | undefined;
    private cursorNearestScatterPointIndex: number | undefined;
    private cursorNearestScatterXData: ArrayLike<number> | undefined;
    private cursorNearestScatterYData: ArrayLike<number> | undefined;
    private readonly scatterSpatialIndex = new CatalogScatterSpatialIndex();
    private pendingScatterCursor: {x: number; y: number} | undefined;
    private scatterCursorFrame: number | undefined;
    private histogramHoverPixel: {x: number; y: number} | undefined;
    private histogramHoverBinIndex: number | undefined;
    private histogramHoverData: object | undefined;
    private pendingHistogramClickHandle: ReturnType<typeof setTimeout> | undefined;
    private hasHistogramBarDoubleClickHandled = false;

    private static readonly UnsupportedDataTypes = [CARTA.ColumnType.String, CARTA.ColumnType.Bool, CARTA.ColumnType.UnsupportedType];

    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "catalog-plot",
            type: "catalog-plot",
            minWidth: 320,
            minHeight: 400,
            defaultWidth: 680,
            defaultHeight: 400,
            title: "Catalog Plot",
            isCloseable: true,
            componentId: "catalog-plot-component"
        };
    }

    constructor(props: WidgetProps) {
        super(props);

        this.widgetId = props.id;
        const catalogPlot = CatalogStore.Instance.getAssociatedIdByWidgetId(this.widgetId);
        this.componentId = catalogPlot.catalogPlotComponentId ?? "";
        // The catalog a component is showing outlives the component, so it is only seeded here.
        if (catalogPlot.catalogPlotComponentId !== undefined && catalogPlot.catalogFileId !== undefined && CatalogStore.Instance.getCatalogPlotSelection(this.componentId) === undefined) {
            CatalogStore.Instance.setCatalogPlotSelection(this.componentId, catalogPlot.catalogFileId);
        }
        this.catalogFileNames = new Map<number, string>();
        this.histogramInteraction = new CatalogHistogramInteraction({
            getChart: () => this.histogramPlotRef,
            getData: () => this.histogramData,
            getBorder: () => this.widgetStore?.histogramBorder,
            setBorder: border => this.widgetStore?.setHistogramXBorder(border),
            selectPoints: indices => this.selectCatalogPoints(indices)
        });

        makeObservable(this);

        this.disposers.push(
            autorun(() => {
                const profileStore = this.profileStore;
                const widgetStore = this.widgetStore;
                const catalogFileIds = CatalogStore.Instance.activeCatalogFiles;
                // A plot restored from a workspace waits for the catalog it was saved against, and
                // bindPendingCatalogPlots moves it on when that catalog arrives. Adopting whichever
                // catalog happens to load first would strand the restored plot behind an empty one.
                const isPending = this.catalogFileId === CatalogStore.PENDING_CATALOG_FILE_ID;
                if (!isPending && !catalogFileIds?.includes(this.catalogFileId) && catalogFileIds?.length > 0) {
                    CatalogStore.Instance.setCatalogPlotSelection(this.componentId, catalogFileIds[0]);
                }
                if (widgetStore) {
                    this.plotType = widgetStore.plotType;
                }
                if (profileStore) {
                    let progressString = "";
                    const catalogFile = profileStore.catalogInfo;
                    const fileName = catalogFile.fileInfo.name || "";
                    const appStore = AppStore.Instance;
                    const frame = appStore.activeFrame;
                    const progress = profileStore.progress;
                    if (progress && isFinite(progress) && progress < 1) {
                        progressString = `[${toFixed(progress * 100)}% complete]`;
                    }
                    if (frame && catalogFileIds?.length) {
                        WidgetsStore.Instance.setWidgetTitle(this.widgetId, `Catalog ${this.plotType} : ${fileName} ${progressString}`);
                    } else {
                        WidgetsStore.Instance.setWidgetTitle(this.widgetId, `Catalog ${this.plotType}`);
                    }
                } else {
                    WidgetsStore.Instance.setWidgetTitle(this.widgetId, `Catalog ${this.plotType}`);
                }
            })
        );

        this.disposers.push(
            reaction(
                () => this.widgetStore?.statisticColumnName,
                () => {
                    if (this.widgetStore?.isStatisticEnabled) {
                        this.updateStatistic();
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.profileStore?.selectedPointIndices,
                () => {
                    this.updateStatistic();
                }
            )
        );

        this.disposers.push(
            reaction(
                () => {
                    const scatter = this.scatterData;
                    return [scatter.xData, scatter.yData] as const;
                },
                ([xData, yData]) => this.resetScatterCursorIfDataChanged(xData, yData),
                {fireImmediately: true}
            )
        );
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
        this.histogramInteraction.stopTracking();
        this.onHistogramContainerRef(null);
        if (this.scatterCursorFrame !== undefined) {
            window.cancelAnimationFrame(this.scatterCursorFrame);
        }
        clearTimeout(this.pendingHistogramClickHandle);
    }

    /** The catalog this component is showing. Held by the store, so that a restored binding can move it. */
    @computed get catalogFileId(): number {
        return CatalogStore.Instance.getCatalogPlotSelection(this.componentId) ?? CatalogStore.PENDING_CATALOG_FILE_ID;
    }

    @computed get widgetStore(): CatalogPlotWidgetStore | undefined {
        const catalogWidgetMap = CatalogStore.Instance.catalogPlots.get(this.componentId);
        if (!catalogWidgetMap) {
            return undefined;
        }
        let widgetStoreId = catalogWidgetMap.get(this.catalogFileId);
        if (!widgetStoreId) {
            widgetStoreId = this.addNewWidgetStore();
        }
        const widgetStore = widgetStoreId !== undefined ? WidgetsStore.Instance.catalogPlotWidgets.get(widgetStoreId) : undefined;
        return widgetStore;
    }

    @computed get profileStore(): CatalogProfileStore | CatalogOnlineQueryProfileStore | undefined {
        return CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
    }

    @computed get catalogDisplayStore(): CatalogDisplayStore | undefined {
        return CatalogStore.Instance.getCatalogDisplayStore(this.catalogFileId);
    }

    @action handleCatalogFileChange = (fileId: number) => {
        CatalogStore.Instance.setCatalogPlotSelection(this.componentId, fileId);
        const widgetStore = WidgetsStore.Instance;
        const catalogStore = CatalogStore.Instance;
        const catalogWidgetMap = catalogStore.catalogPlots.get(this.componentId);
        if (!catalogWidgetMap) {
            this.addNewWidgetStore();
            return;
        }
        const plotWidgetStoreId = catalogWidgetMap.get(fileId);
        if (plotWidgetStoreId) {
            const plotWidgetStore = widgetStore.catalogPlotWidgets.get(plotWidgetStoreId);
            const profileStore = catalogStore.catalogProfileStores.get(this.catalogFileId);
            const isXColumnEmpty = plotWidgetStore?.xColumnName === CatalogPlotComponent.emptyColumn;
            const isYColumnEmpty = plotWidgetStore?.yColumnName === CatalogPlotComponent.emptyColumn;
            switch (plotWidgetStore?.plotType) {
                case CatalogPlotType.D2Scatter:
                    if (!isXColumnEmpty && !isYColumnEmpty && plotWidgetStore.scatterBorder === undefined) {
                        const xColumnName = plotWidgetStore.xColumnName;
                        const yColumnName = plotWidgetStore.yColumnName;
                        if (xColumnName && yColumnName) {
                            const scatterCoords = profileStore?.get2DPlotData(xColumnName, yColumnName, profileStore.catalogData);
                            if (scatterCoords?.wcsX && scatterCoords?.wcsY) {
                                const scatterBorder = getCatalogScatterBorder(scatterCoords.wcsX, scatterCoords.wcsY);
                                plotWidgetStore.setScatterborder(scatterBorder);
                            }
                        }
                    }
                    break;
                case CatalogPlotType.Histogram:
                    if (!isXColumnEmpty && plotWidgetStore.histogramBorder === undefined) {
                        const xColumnName = plotWidgetStore.xColumnName;
                        if (xColumnName) {
                            const histogramCoords = profileStore?.get1DPlotData(xColumnName);
                            if (histogramCoords?.wcsData) {
                                const histogramXBorder = this.initHistogramXBorder;
                                if (histogramXBorder) {
                                    plotWidgetStore.setHistogramXBorder(histogramXBorder);
                                }
                            }
                        }
                    }
                    break;
                default:
                    break;
            }
        } else {
            this.addNewWidgetStore();
        }
    };

    private addNewWidgetStore = (): string | undefined => {
        const appStore = AppStore.Instance;
        const catalogStore = CatalogStore.Instance;
        switch (this.plotType) {
            case CatalogPlotType.D2Scatter:
                const scatterProps: CatalogPlotWidgetStoreProps = {
                    xColumnName: CatalogPlotComponent.emptyColumn,
                    yColumnName: CatalogPlotComponent.emptyColumn,
                    plotType: this.plotType
                };
                const scatterPlotId = appStore.widgetsStore.addCatalogPlotWidget(scatterProps);
                if (scatterPlotId !== null) {
                    catalogStore.setCatalogPlots(this.componentId, this.catalogFileId, scatterPlotId);
                    return scatterPlotId;
                }
                return undefined;
            case CatalogPlotType.Histogram:
                const historgramProps: CatalogPlotWidgetStoreProps = {
                    xColumnName: CatalogPlotComponent.emptyColumn,
                    plotType: this.plotType
                };
                const histogramPlotId = appStore.widgetsStore.addCatalogPlotWidget(historgramProps);
                if (histogramPlotId !== null) {
                    catalogStore.setCatalogPlots(this.componentId, this.catalogFileId, histogramPlotId);
                    return histogramPlotId;
                }
                return undefined;
            default:
                return undefined;
        }
    };

    @computed get initScatterBorder(): Border | undefined {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        if (!widgetStore || !profileStore || !widgetStore.xColumnName || !widgetStore.yColumnName) {
            return undefined;
        }
        const coords = profileStore.get2DPlotData(widgetStore.xColumnName, widgetStore.yColumnName, profileStore.catalogData);
        return coords.wcsX && coords.wcsY ? getCatalogScatterBorder(coords.wcsX, coords.wcsY) : undefined;
    }

    @computed get initHistogramXBorder(): XBorder | undefined {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        if (!widgetStore || !profileStore || !widgetStore.xColumnName) {
            return undefined;
        }
        const {start, binSize, bins} = this.histogramData;
        if (!bins.length || !Number.isFinite(start)) {
            return undefined;
        }
        const end = start + bins.length * binSize;
        const padding = start === end ? (end === 0 ? 1 : Math.abs(end * 0.05)) : 0;
        return {xMin: start - padding, xMax: end + padding};
    }

    @computed get scatterData() {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        if (!widgetStore || !profileStore || !widgetStore.xColumnName || !widgetStore.yColumnName) {
            return {xData: [] as number[], yData: [] as number[], border: undefined};
        }
        // dummy values to trigger update, since profileStore.catalogData is not observable

        const numVisibleRows = profileStore.numVisibleRows;

        const coords = profileStore.get2DPlotData(widgetStore.xColumnName, widgetStore.yColumnName, profileStore.catalogData);
        const xData = coords.wcsX ? coords.wcsX.slice(0, numVisibleRows) : [];
        const yData = coords.wcsY ? coords.wcsY.slice(0, numVisibleRows) : [];

        if (!coords.wcsX || !coords.wcsY) {
            return {xData, yData, border: undefined};
        }
        const border = getCatalogScatterBorder(coords.wcsX, coords.wcsY);
        return {xData, yData, border};
    }
    @computed get histogramData() {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        if (!widgetStore || !profileStore || !widgetStore.xColumnName) {
            return {bins: [] as Point2D[], binSize: 0, start: 0, binIndices: [] as number[][]};
        }
        // dummy values to trigger update, since profileStore.catalogData is not observable

        const numVisibleRows = profileStore.numVisibleRows;

        const coords = profileStore.get1DPlotData(widgetStore.xColumnName);
        if (!coords.wcsData) {
            return {bins: [] as Point2D[], binSize: 0, start: 0, binIndices: [] as number[][]};
        }
        const slicedData = coords.wcsData.slice(0, numVisibleRows);
        const nBinX = widgetStore.nBinX ? widgetStore.nBinX : this.numBinsX;
        const result = computeHistogramBins(slicedData, nBinX);
        return {bins: result.bins, binSize: result.binSize, start: result.start, binIndices: result.binIndices};
    }

    @computed get isPlotButtonEnabled(): boolean {
        const emptyColumn = CatalogPlotComponent.emptyColumn;
        const profileStore = this.profileStore;
        const widgetStore = this.widgetStore;
        if (!profileStore || !widgetStore) {
            return false;
        }

        if (widgetStore?.plotType === CatalogPlotType.Histogram) {
            return widgetStore.xColumnName !== emptyColumn && !profileStore.isLoadingData && !profileStore.isUpdatingDataStream;
        } else if (widgetStore?.plotType === CatalogPlotType.D2Scatter) {
            return widgetStore.xColumnName !== emptyColumn && widgetStore.yColumnName !== emptyColumn && !profileStore.isLoadingData && !profileStore.isUpdatingDataStream;
        } else {
            return false;
        }
    }

    @computed get genProfilerInfo(): string {
        let profileInfo: string = "";
        const widgetStore = this.widgetStore;
        const indicatorInfo = widgetStore?.indicatorInfo;
        if (indicatorInfo) {
            if (widgetStore.plotType === CatalogPlotType.D2Scatter) {
                profileInfo = `${widgetStore.xColumnName}: ${indicatorInfo.x}, ${widgetStore.yColumnName}: ${indicatorInfo.y}`;
            } else if (widgetStore.plotType === CatalogPlotType.Histogram) {
                profileInfo = `${widgetStore.xColumnName}: ${indicatorInfo.x}, Count: ${indicatorInfo.y}`;
            }
        }
        return profileInfo;
    }

    @computed get numBinsX(): number {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        if (!widgetStore || !profileStore || !widgetStore.xColumnName) {
            return DEFAULT_NUM_BINS;
        }
        const coords = profileStore.get1DPlotData(widgetStore.xColumnName);
        const nBinX = coords.wcsData?.length ? Math.ceil(Math.sqrt(coords.wcsData.length)) : DEFAULT_NUM_BINS;
        return nBinX;
    }

    private updateStatistic = () => {
        const profileStore = this.profileStore;
        const widgetStore = this.widgetStore;
        if (!widgetStore?.isStatisticEnabled || !profileStore || !widgetStore.statisticColumnName) {
            return;
        }
        const selectedPointIndices = profileStore.getSortedIndices(profileStore.selectedPointIndices);
        const coords = profileStore.get1DPlotData(widgetStore.statisticColumnName);
        if (!coords.wcsData) {
            return;
        }
        const data: number[] = [];
        let size = coords.wcsData.length;
        let count = size;
        const selectedSize = selectedPointIndices.length;
        if (selectedSize > 0) {
            count = size = selectedSize;
            for (let index = 0; index < selectedSize; index++) {
                const selected = selectedPointIndices[index];
                if (isNaN(coords.wcsData[selected])) {
                    count = count - 1;
                } else {
                    data.push(coords.wcsData[selected]);
                }
            }
        } else {
            for (let i = 0; i < coords.wcsData.length; i++) {
                if (isNaN(coords.wcsData[i])) {
                    count = count - 1;
                } else {
                    data.push(coords.wcsData[i]);
                }
            }
        }
        const mean = _.mean(data);
        const std = Math.sqrt(_.sum(_.map(data, i => Math.pow(i - mean, 2))) / count);
        const rms = Math.sqrt(_.sum(_.map(data, i => Math.pow(i, 2))) / count);
        const minMax = minMaxArray(data);
        widgetStore.setStatistic({mean: mean, count: size, validCount: count, std: std, min: minMax.minVal, max: minMax.maxVal, rms: rms});
    };

    private handleColumnNameChange = (type: "X" | "Y" | "S", column: string) => {
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return;
        }

        if (type === "X") {
            widgetStore.setColumnX(column);
        } else if (type === "Y") {
            widgetStore.setColumnY(column);
        } else if (type === "S") {
            widgetStore.setStatisticColumn(column);
        }
        if (widgetStore.plotType === CatalogPlotType.D2Scatter) {
            if (widgetStore.xColumnName === CatalogPlotComponent.emptyColumn || widgetStore.yColumnName === CatalogPlotComponent.emptyColumn || type === "S") {
                return;
            }
            const initBorder = this.initScatterBorder;
            if (initBorder) {
                widgetStore.setScatterborder(initBorder);
            }
            widgetStore.initLinearFitting();
        } else if (widgetStore.plotType === CatalogPlotType.Histogram) {
            if (column === CatalogPlotComponent.emptyColumn) {
                return;
            }
            const initBorder = this.initHistogramXBorder;
            if (initBorder) {
                widgetStore.setHistogramXBorder(initBorder);
            }
        }
    };

    private handleShowSelectedDataChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        const widgetsStore = this.widgetStore;
        const catalogDisplayStore = this.catalogDisplayStore;
        const isChecked = changeEvent.target.checked;
        if (widgetsStore && catalogDisplayStore) {
            catalogDisplayStore.setShowSelectedData(isChecked);
            catalogDisplayStore.setCatalogTableAutoScroll(true);
        }
    };

    private handleLogScaleYChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        const isLogScaleY = changeEvent.target.checked;
        this.widgetStore?.setLogScaleY(isLogScaleY);
    };

    @action private updateScatterChartArea = (chartArea: ChartArea) => {
        this.scatterChartArea = chartArea;
    };

    private resetScatterCursorIfDataChanged = (xData: ArrayLike<number>, yData: ArrayLike<number>) => {
        if (this.cursorNearestScatterXData === xData && this.cursorNearestScatterYData === yData) {
            return;
        }
        this.cursorNearestScatterXData = xData;
        this.cursorNearestScatterYData = yData;
        this.cursorNearestScatterPoint = undefined;
        this.cursorNearestScatterPointIndex = undefined;
        this.scatterSpatialIndex.clear();
        this.widgetStore?.setIndicator(undefined);
    };

    private getNearestScatterPointIndex = (x: number, y: number) => {
        const scatter = this.scatterData;
        this.resetScatterCursorIfDataChanged(scatter.xData, scatter.yData);
        const widgetStore = this.widgetStore;
        const border = widgetStore?.isScatterAutoScaled ? scatter.border : widgetStore?.scatterBorder;
        if (!border) {
            return -1;
        }

        const chartArea = this.scatterChartArea;
        const chartWidth = chartArea ? chartArea.right - chartArea.left : 1;
        const chartHeight = chartArea ? chartArea.bottom - chartArea.top : 1;
        return this.scatterSpatialIndex.getNearestPointIndex(scatter.xData, scatter.yData, border, chartWidth, chartHeight, x, y);
    };

    private updateScatterCursor = () => {
        this.scatterCursorFrame = undefined;
        const cursor = this.pendingScatterCursor;
        this.pendingScatterCursor = undefined;
        if (!cursor) {
            return;
        }

        const scatter = this.scatterData;
        this.resetScatterCursorIfDataChanged(scatter.xData, scatter.yData);
        const nearestIndex = this.getNearestScatterPointIndex(cursor.x, cursor.y);
        if (nearestIndex < 0) {
            this.cursorNearestScatterPoint = undefined;
            this.cursorNearestScatterPointIndex = undefined;
            this.widgetStore?.setIndicator(undefined);
            return;
        }
        if (nearestIndex === this.cursorNearestScatterPointIndex) {
            return;
        }
        this.cursorNearestScatterPointIndex = nearestIndex;
        const nearest = {x: scatter.xData[nearestIndex], y: scatter.yData[nearestIndex]};
        this.cursorNearestScatterPoint = nearest;
        this.widgetStore?.setIndicator(nearest);
    };

    private onScatterCursorMoved = (x: number, y: number) => {
        this.pendingScatterCursor = {x, y};
        if (this.scatterCursorFrame === undefined) {
            this.scatterCursorFrame = window.requestAnimationFrame(this.updateScatterCursor);
        }
    };

    private getNearestScatterPoint = (x: number, y: number) => {
        const scatter = this.scatterData;
        const nearestIndex = this.getNearestScatterPointIndex(x, y);
        return nearestIndex >= 0 ? {x: scatter.xData[nearestIndex], y: scatter.yData[nearestIndex]} : undefined;
    };

    private onAutoscale = () => {
        const widgetsStore = this.widgetStore;
        if (!widgetsStore) {
            return;
        }

        if (widgetsStore.plotType === CatalogPlotType.D2Scatter) {
            const initBorder = this.initScatterBorder;
            if (initBorder) {
                widgetsStore.setScatterborder(initBorder);
            }
        } else {
            const initBorder = this.initHistogramXBorder;
            if (initBorder) {
                widgetsStore.setHistogramXBorder(initBorder);
            }
        }
    };

    private onDoubleClick = () => {
        this.onAutoscale();

        this.onDeselect();
    };

    private onScatterDoubleClick = () => {
        const dragMode = this.widgetStore?.dragMode;
        if (dragMode === DragMode.Select || dragMode === DragMode.Lasso) {
            this.onAutoscale();
        } else {
            this.onDoubleClick();
        }
    };

    private selectCatalogPoints(rawIndices: number[]) {
        const profileStore = this.profileStore;
        const catalogDisplayStore = this.catalogDisplayStore;
        if (!rawIndices.length) {
            this.onDeselect();
            return;
        }
        if (!profileStore || !catalogDisplayStore) {
            return;
        }
        WidgetsStore.Instance.updateCatalogWidgetSelection(profileStore.catalogInfo.fileId);
        profileStore.setSelectedPointIndices(profileStore.getOriginIndices(rawIndices), true);
        catalogDisplayStore.setCatalogTableAutoScroll(true);
    }

    private onScatterZoomedXY = (xMin: number, xMax: number, yMin: number, yMax: number) => {
        const widgetStore = this.widgetStore;
        if (widgetStore && Number.isFinite(xMin) && Number.isFinite(xMax) && Number.isFinite(yMin) && Number.isFinite(yMax) && xMax > xMin && yMax > yMin) {
            widgetStore.setScatterborder({xMin, xMax, yMin, yMax});
        }
    };

    private onBoxSelected = (xMin: number, xMax: number, yMin: number, yMax: number) => {
        const scatter = this.scatterData;
        const numPoints = Math.min(scatter.xData.length, scatter.yData.length);
        const selected: number[] = [];
        for (let i = 0; i < numPoints; i++) {
            if (scatter.xData[i] >= xMin && scatter.xData[i] <= xMax && scatter.yData[i] >= yMin && scatter.yData[i] <= yMax) {
                selected.push(i);
            }
        }
        this.selectCatalogPoints(selected);
    };

    private onLassoSelected = (polygon: Point2D[]) => {
        if (polygon.length < 3) {
            return;
        }
        const scatter = this.scatterData;
        const widgetStore = this.widgetStore;
        const border = widgetStore?.isScatterAutoScaled ? scatter.border : widgetStore?.scatterBorder;
        const polygonMinX = Math.min(...polygon.map(point => point.x));
        const polygonMaxX = Math.max(...polygon.map(point => point.x));
        const polygonMinY = Math.min(...polygon.map(point => point.y));
        const polygonMaxY = Math.max(...polygon.map(point => point.y));
        const numPoints = Math.min(scatter.xData.length, scatter.yData.length);
        let candidateIndices: Iterable<number> | undefined;
        const chartArea = this.scatterChartArea;
        if (border && chartArea && Number.isFinite(polygonMinX) && Number.isFinite(polygonMaxX) && Number.isFinite(polygonMinY) && Number.isFinite(polygonMaxY)) {
            const chartWidth = chartArea.right - chartArea.left;
            const chartHeight = chartArea.bottom - chartArea.top;
            candidateIndices = this.scatterSpatialIndex.getCandidatesInBounds(scatter.xData, scatter.yData, border, chartWidth, chartHeight, {
                xMin: polygonMinX,
                xMax: polygonMaxX,
                yMin: polygonMinY,
                yMax: polygonMaxY
            });
        }
        const selected: number[] = [];
        const addIfInside = (index: number) => {
            if (isPointInPolygon({x: scatter.xData[index], y: scatter.yData[index]}, polygon)) {
                selected.push(index);
            }
        };
        if (candidateIndices) {
            for (const index of candidateIndices) {
                addIfInside(index);
            }
        } else {
            for (let index = 0; index < numPoints; index++) {
                addIfInside(index);
            }
        }
        this.selectCatalogPoints(selected);
    };

    private onGraphClicked = (x: number, y: number, _data: {x: number; y: number; z?: number}[]) => {
        const selectionMode: DragMode[] = [DragMode.Select, DragMode.Lasso];
        const widgetStore = this.widgetStore;
        const isInDragmode = widgetStore && widgetStore.dragMode !== false && selectionMode.includes(widgetStore.dragMode);
        if (!isInDragmode) {
            return;
        }
        const nearestIndex = this.getNearestScatterPointIndex(x, y);
        if (nearestIndex < 0) {
            return;
        }
        this.selectCatalogPoints([nearestIndex]);
    };

    private handlePlotClick = () => {
        const appStore = AppStore.Instance;
        const profileStore = this.profileStore;
        if (profileStore?.shouldUpdateData) {
            profileStore.setUpdateMode(CatalogUpdateMode.PlotsUpdate);
            profileStore.setUpdatingDataStream(true);
            const catalogFilter = profileStore.updateRequestDataSize;
            appStore.sendCatalogFilter(catalogFilter);
        }
    };

    private onDeselect = () => {
        const profileStore = this.profileStore;
        const widgetsStore = this.widgetStore;
        const catalogDisplayStore = this.catalogDisplayStore;
        WidgetsStore.Instance.updateCatalogWidgetSelection(this.catalogFileId);
        profileStore?.setSelectedPointIndices([], false);
        catalogDisplayStore?.setShowSelectedData(false);
        widgetsStore?.initLinearFitting();
        widgetsStore?.initStatistic();
        this.updateStatistic();
    };

    private renderColumnNamePopOver = (column: string, itemProps: ItemRendererProps) => {
        return <MenuItem key={column} text={column} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private filterColumn: ItemPredicate<string> = (query: string, columnName: string) => {
        const fileSearcher = new FuzzySearch([columnName]);
        return fileSearcher.search(query).length > 0;
    };

    private onNumBinChange = (val: number) => {
        this.widgetStore?.setNumBinsX(val);
        this.onDeselect();
    };

    private renderFilePopOver = (fileId: number, itemProps: ItemRendererProps) => {
        const fileName = this.catalogFileNames.get(fileId);
        const text = `${fileId}: ${fileName}`;
        return <MenuItem key={fileId} text={text} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private handleFittingClick = (selectedPointIndices: number[]) => {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        if (!widgetStore || !profileStore || !widgetStore.xColumnName || !widgetStore.yColumnName) {
            return;
        }
        const coords = profileStore.get2DPlotData(widgetStore.xColumnName, widgetStore.yColumnName, profileStore.catalogData);
        if (!coords.wcsX || !coords.wcsY) {
            return;
        }
        const x: number[] = [],
            y: number[] = [];
        if (selectedPointIndices.length === 0) {
            for (let index = 0; index < coords.wcsX.length; index++) {
                if (!isNaN(coords.wcsX[index]) && !isNaN(coords.wcsY[index])) {
                    x.push(coords.wcsX[index]);
                    y.push(coords.wcsY[index]);
                }
            }
        } else {
            for (let index = 0; index < selectedPointIndices.length; index++) {
                const selected = selectedPointIndices[index];
                if (!isNaN(coords.wcsX[selected]) && !isNaN(coords.wcsY[selected])) {
                    x.push(coords.wcsX[selected]);
                    y.push(coords.wcsY[selected]);
                }
            }
        }
        const result = GSL.getFittingParameters(new Float64Array(x), new Float64Array(y));
        const minMaxX = minMaxArray(x);
        widgetStore.setMinMaxX(minMaxX);
        widgetStore.setFitting(result);
    };

    private onHistogramPlotRef = (ref: Chart<"bar"> | undefined | null) => {
        this.histogramPlotRef = ref ?? null;
    };

    @action private onHistogramMouseEnter = () => {
        this.isHistogramMouseEntered = true;
    };

    @action private onHistogramMouseLeave = () => {
        this.isHistogramMouseEntered = false;
        this.histogramHoverPixel = undefined;
        this.histogramHoverBinIndex = undefined;
        this.histogramHoverData = undefined;
        this.histogramPlotRef?.draw();
    };

    private histogramContainerRef: HTMLDivElement | null = null;

    private onHistogramContainerRef = (element: HTMLDivElement | null) => {
        this.histogramContainerRef?.removeEventListener("wheel", this.onHistogramWheel);
        this.histogramContainerRef = element;
        this.histogramContainerRef?.addEventListener("wheel", this.onHistogramWheel, {passive: false});
    };

    private onHistogramWheel = (event: WheelEvent) => {
        const target = event.target as Element | null;
        if (target?.closest(".profiler-toolbar")) {
            return;
        }
        const chart = this.histogramPlotRef;
        const widgetStore = this.widgetStore;
        if (!chart || !widgetStore) {
            return;
        }
        const xScale = chart.scales["x"];
        if (!xScale) {
            return;
        }
        const chartArea = chart.chartArea;
        if (!chartArea || event.offsetX < chartArea.left || event.offsetX > chartArea.right || event.offsetY < chartArea.top || event.offsetY > chartArea.bottom) {
            return;
        }
        const currentMin = xScale.min;
        const currentMax = xScale.max;
        const range = currentMax - currentMin;
        event.preventDefault();
        const delta = event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? event.deltaY * chart.height : event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 15 : event.deltaY;
        const zoomFactor = clamp(-delta * 0.0005, -0.5, 0.5);
        const mouseX = xScale.getValueForPixel(event.offsetX) ?? currentMin + range / 2;
        const fraction = (mouseX - currentMin) / range;
        const newMin = currentMin + range * zoomFactor * fraction;
        const newMax = currentMax - range * zoomFactor * (1 - fraction);
        if (newMax > newMin) {
            widgetStore.setHistogramXBorder({xMin: newMin, xMax: newMax});
        }
    };

    private onHistogramMouseDown = (event: React.MouseEvent<HTMLDivElement>) => this.histogramInteraction.onMouseDown(event);
    private onHistogramMouseMove = (event: React.MouseEvent<HTMLDivElement>) => this.histogramInteraction.onMouseMove(event);
    private onHistogramMouseUp = (event: React.MouseEvent<HTMLDivElement>) => this.histogramInteraction.onMouseUp(event);

    private onHistogramDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target as Element | null;
        if (target?.closest(".profiler-toolbar")) {
            return;
        }
        clearTimeout(this.pendingHistogramClickHandle);
        this.pendingHistogramClickHandle = undefined;
        requestAnimationFrame(() => {
            const didDoubleClickBar = this.hasHistogramBarDoubleClickHandled;
            this.hasHistogramBarDoubleClickHandled = false;
            if (!didDoubleClickBar) {
                this.onAutoscale();
            }
        });
    };

    private exportHistogramImage = () => {
        const chart = this.histogramPlotRef;
        if (!chart) {
            return;
        }
        const ownerDocument = chart.canvas.ownerDocument;
        const composed = ownerDocument.createElement("canvas") as HTMLCanvasElement;
        composed.width = chart.canvas.width + EXPORT_RIGHT_PADDING;
        composed.height = chart.canvas.height;
        const ctx = composed.getContext("2d");
        if (!ctx) {
            return;
        }
        const histogramHoverPixel = this.histogramHoverPixel;
        this.histogramHoverPixel = undefined;
        chart.draw();
        this.fillPlotBackground(ctx, composed.width, composed.height);
        ctx.drawImage(chart.canvas, 0, 0);
        this.histogramHoverPixel = histogramHoverPixel;
        chart.draw();
        const columnName = this.widgetStore?.xColumnName ?? "histogram";
        this.downloadCanvasAsPng(composed, `catalog-histogram-${columnName}`);
    };

    private exportHistogramData = () => {
        const histData = this.histogramData;
        const columnName = this.widgetStore?.xColumnName ?? "histogram";
        const comment = `# Catalog Histogram: ${columnName}\n# bin_center\tcount`;
        const rows = histData.bins.map(bin => `${toExponential(bin.x, 10)}\t${bin.y}`);
        const content = comment + "\n" + rows.join("\n");
        exportTsvFile("catalog", `histogram-${columnName}`, content);
    };

    private fillPlotBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const isDarkTheme = AppStore.Instance.isDarkTheme;
        ctx.fillStyle = AppStore.Instance.preferenceStore.hasTransparentImageBackground ? "rgba(255, 255, 255, 0.0)" : isDarkTheme ? Colors.DARK_GRAY1 : Colors.LIGHT_GRAY5;
        ctx.fillRect(0, 0, width, height);
    }

    private downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string) {
        const ownerDocument = canvas.ownerDocument;
        const ownerWindow = ownerDocument.defaultView ?? window;
        canvas.toBlob(blob => {
            if (blob) {
                const link = ownerDocument.createElement("a");
                link.download = filename.substring(0, 200) + `-${getTimestamp()}.png`;
                link.href = ownerWindow.URL.createObjectURL(blob);
                link.dispatchEvent(new ownerWindow.MouseEvent("click"));
            }
        }, "image/png");
    }

    private exportScatterData = () => {
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return;
        }
        const scatter = this.scatterData;
        const xColumnName = widgetStore.xColumnName ?? "x";
        const yColumnName = widgetStore.yColumnName ?? "y";
        let comment = `# Catalog Scatter: ${xColumnName} vs ${yColumnName}`;
        comment += `\n# xLabel: ${xColumnName}`;
        comment += `\n# yLabel: ${yColumnName}`;

        if (widgetStore.isFittingResultVisible && widgetStore.fittingResultString) {
            comment += "\n# " + widgetStore.fittingResultString.split("\n").join("\n# ");
        }

        const header = `# ${xColumnName}\t${yColumnName}`;
        const numPoints = Math.min(scatter.xData.length, scatter.yData.length);
        const rows: string[] = [];
        for (let i = 0; i < numPoints; i++) {
            rows.push(`${toExponential(scatter.xData[i], 10)}\t${toExponential(scatter.yData[i], 10)}`);
        }

        exportTsvFile("catalog", `scatter-${xColumnName}-${yColumnName}`, `${comment}\n${header}\n${rows.join("\n")}\n`);
    };

    private renderWebGLOverlay = (width: number, height: number, chartArea: ChartArea | undefined) => {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        if (!widgetStore || !profileStore || widgetStore.plotType !== CatalogPlotType.D2Scatter) {
            return null;
        }
        const scatter = this.scatterData;
        if (!scatter.xData.length) {
            return null;
        }
        let border: Border | undefined;
        if (widgetStore.isScatterAutoScaled) {
            border = scatter.border;
        } else {
            border = widgetStore.scatterBorder;
        }
        if (!border) {
            return null;
        }

        const selectedPointIndices = profileStore.getSortedIndices(profileStore.selectedPointIndices);
        const selectedSet = new Set(selectedPointIndices);

        return (
            <CatalogScatterWebGL
                width={width}
                height={height}
                chartArea={chartArea}
                xData={scatter.xData}
                yData={scatter.yData}
                xMin={border.xMin}
                xMax={border.xMax}
                yMin={border.yMin}
                yMax={border.yMax}
                selectedIndices={selectedSet}
                hasSelection={selectedSet.size > 0}
                pointSize={5}
            />
        );
    };

    public render() {
        const profileStore = this.profileStore;
        const widgetStore = this.widgetStore;
        const catalogDisplayStore = this.catalogDisplayStore;
        const catalogFileIds = CatalogStore.Instance.activeCatalogFiles;
        if (!widgetStore || !profileStore || !catalogDisplayStore || catalogFileIds === undefined || catalogFileIds?.length === 0) {
            return (
                <div className="catalog-plot">
                    <NonIdealState icon={"folder-open"} title={"No catalog file loaded"} description={"Load a catalog file using the menu"} />;
                </div>
            );
        }

        const columnsName = profileStore.displayedColumnHeaders;
        const xyOptions = [CatalogPlotComponent.emptyColumn];
        const isDisabled = !this.isPlotButtonEnabled;
        const isScatterPlot = this.plotType === CatalogPlotType.D2Scatter;
        const isHistogramPlot = this.plotType === CatalogPlotType.Histogram;
        const isDarkTheme = AppStore.Instance.isDarkTheme;
        const labelColor = isDarkTheme ? Colors.LIGHT_GRAY4 : Colors.GRAY1;
        const gridColor = isDarkTheme ? Colors.DARK_GRAY5 : Colors.LIGHT_GRAY1;

        const catalogFileItems: number[] = [];
        catalogFileIds.forEach(value => {
            catalogFileItems.push(value);
        });
        this.catalogFileNames = CatalogStore.Instance.getCatalogFileNames(catalogFileIds);

        for (let index = 0; index < columnsName.length; index++) {
            const column = columnsName[index];
            if (!CatalogPlotComponent.UnsupportedDataTypes.includes(column.dataType)) {
                xyOptions.push(column.name);
            }
        }

        const noResults = <MenuItem disabled={true} text="No results" />;

        const renderFileSelect = (
            <FormGroup inline={true} label="File" data-testid="catalog-plot-file-select">
                <Select
                    className={Classes.FILL}
                    filterable={false}
                    items={catalogFileItems}
                    activeItem={this.catalogFileId}
                    onItemSelect={this.handleCatalogFileChange}
                    itemRenderer={this.renderFilePopOver}
                    popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                >
                    <Button text={this.catalogFileId} endIcon="double-caret-vertical" data-testid="catalog-plot-widget-file-dropdown" />
                </Select>
            </FormGroup>
        );

        const renderXSelect = (
            <FormGroup inline={true} label="X" data-testid="catalog-plot-x-select">
                <Select
                    className={Classes.FILL}
                    items={xyOptions}
                    activeItem={widgetStore.xColumnName}
                    onItemSelect={item => this.handleColumnNameChange("X", item)}
                    itemRenderer={this.renderColumnNamePopOver}
                    popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                    filterable={true}
                    noResults={noResults}
                    itemPredicate={this.filterColumn}
                    resetOnSelect={true}
                >
                    <Button text={widgetStore.xColumnName} endIcon="double-caret-vertical" data-testid="catalog-plot-widget-x-dropdown" />
                </Select>
            </FormGroup>
        );

        const renderHistogramLog = (
            <FormGroup label={"Log scale"} inline={true} disabled={isDisabled}>
                <Switch checked={widgetStore.isLogScaleY} onChange={this.handleLogScaleYChanged} disabled={isDisabled} data-testid="catalog-plot-log-scale-switch" />
            </FormGroup>
        );

        const renderYSelect = (
            <FormGroup inline={true} label="Y" data-testid="catalog-plot-y-select">
                <Select
                    className={Classes.FILL}
                    items={xyOptions}
                    activeItem={widgetStore.yColumnName}
                    onItemSelect={item => this.handleColumnNameChange("Y", item)}
                    itemRenderer={this.renderColumnNamePopOver}
                    popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                    filterable={true}
                    noResults={noResults}
                    itemPredicate={this.filterColumn}
                    resetOnSelect={true}
                >
                    <Button text={widgetStore.yColumnName} endIcon="double-caret-vertical" data-testid="catalog-plot-widget-y-dropdown" />
                </Select>
            </FormGroup>
        );

        const renderStatisticSelect = (
            <FormGroup inline={true} label="Statistic source">
                <Select
                    className={Classes.FILL}
                    items={xyOptions}
                    activeItem={widgetStore.statisticColumnName}
                    onItemSelect={item => this.handleColumnNameChange("S", item)}
                    itemRenderer={this.renderColumnNamePopOver}
                    popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                    filterable={true}
                    noResults={noResults}
                    itemPredicate={this.filterColumn}
                    resetOnSelect={true}
                >
                    <Button text={widgetStore.statisticColumnName} endIcon="double-caret-vertical" data-testid="catalog-plot-widget-stat-dropdown" />
                </Select>
            </FormGroup>
        );

        if (widgetStore.xColumnName === CatalogPlotComponent.emptyColumn || (isScatterPlot && widgetStore.yColumnName === CatalogPlotComponent.emptyColumn)) {
            return (
                <div className={"catalog-plot"}>
                    <div className={"catalog-plot-option"}>
                        {renderFileSelect}
                        {renderXSelect}
                        {isScatterPlot && renderYSelect}
                    </div>
                    <NonIdealState className={"non-ideal-state"} icon={"folder-open"} title={"No column selected"} description={"Please select columns"} />;
                </div>
            );
        }

        const selectedPointIndices = profileStore.getSortedIndices(profileStore.selectedPointIndices);

        const renderHistogramBins = (
            <ClearableNumericInputComponent
                className={"catalog-bins"}
                label="Bins"
                min={1}
                integerOnly={true}
                value={widgetStore.nBinX ? widgetStore.nBinX : this.numBinsX}
                onValueChanged={val => this.onNumBinChange(val)}
                onValueCleared={() => this.onNumBinChange(this.numBinsX)}
                displayExponential={false}
                disabled={isDisabled}
                data-testid="catalog-plot-widget-bin-input"
            />
        );

        const renderLinearRegressionButton = (
            <AnchorButton intent={Intent.PRIMARY} text="Linear fit" onClick={() => this.handleFittingClick(selectedPointIndices)} disabled={isDisabled || selectedPointIndices?.length === 1} data-testid="catalog-plot-widget-fit-button" />
        );

        const infoStrings = [this.genProfilerInfo];
        if (widgetStore.isStatisticResultVisible && widgetStore.isStatisticEnabled) {
            infoStrings.push(widgetStore.statisticString);
        }

        // Histogram rendering
        if (isHistogramPlot) {
            const histData = this.histogramData;
            const binEdgeMin = histData.start;
            const binEdgeMax = histData.start + histData.bins.length * histData.binSize;
            const xPadding = binEdgeMin === binEdgeMax ? (binEdgeMax === 0 ? 1 : Math.abs(binEdgeMax * 0.05)) : 0;
            let xMin: number | undefined;
            let xMax: number | undefined;
            if (widgetStore.isHistogramAutoScaledX) {
                xMin = binEdgeMin - xPadding;
                xMax = binEdgeMax + xPadding;
            } else {
                xMin = widgetStore.histogramBorder?.xMin;
                xMax = widgetStore.histogramBorder?.xMax;
            }

            const selectedSet = new Set<number>();
            if (selectedPointIndices.length > 0) {
                for (const idx of selectedPointIndices) {
                    selectedSet.add(idx);
                }
            }

            const hasSelection = selectedSet.size > 0;
            const alphaValue = hasSelection ? 0.5 : 1.0;
            const unselectedColor = tinycolor(Colors.BLUE2).setAlpha(alphaValue).toRgbString();
            const barColors = histData.bins.map((_, i) => {
                if (hasSelection && histData.binIndices[i]) {
                    const hasBinSelected = histData.binIndices[i].some(idx => selectedSet.has(idx));
                    return hasBinSelected ? Colors.RED2 : unselectedColor;
                }
                return unselectedColor;
            });

            const histogramOptions: ChartOptions<"bar"> = {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {mode: "index", intersect: false},
                plugins: {
                    legend: {display: false}
                },
                scales: {
                    x: {
                        type: "linear",
                        offset: false,
                        title: {display: true, text: widgetStore.xColumnName, color: labelColor},
                        ticks: {
                            includeBounds: false,
                            display: true,
                            color: labelColor,
                            callback: (value: string | number, _index: number, ticks: Tick[]) => {
                                if (xMin !== undefined && xMax !== undefined) {
                                    return formatCatalogPlotTick(Number(value), xMin, xMax, ticks);
                                }
                                return String(value);
                            }
                        },
                        grid: {color: gridColor, offset: false},
                        border: {color: gridColor},
                        min: xMin,
                        max: xMax
                    },
                    y: {
                        type: widgetStore.isLogScaleY ? "logarithmic" : "linear",
                        title: {display: true, text: "Count", color: labelColor},
                        ticks: {
                            color: labelColor
                        },
                        grid: {color: gridColor},
                        border: {color: gridColor},
                        min: widgetStore.isLogScaleY ? 0.5 : 0,
                        beginAtZero: !widgetStore.isLogScaleY
                    }
                },
                onClick: (event, _elements, chart) => {
                    // Skip if a drag action (zoom/select) was just handled
                    if (this.histogramInteraction.consumeHandledDrag()) {
                        return;
                    }
                    const elements = event.native ? chart.getElementsAtEventForMode(event.native, "index", {axis: "xy", intersect: true}, false) : [];
                    if (elements.length > 0) {
                        clearTimeout(this.pendingHistogramClickHandle);
                        this.pendingHistogramClickHandle = undefined;
                        if (((event.native as MouseEvent | null)?.detail ?? 0) > 1) {
                            this.hasHistogramBarDoubleClickHandled = true;
                            this.onDeselect();
                            return;
                        }
                        const binIndex = elements[0].index;
                        if (histData.binIndices[binIndex]?.length) {
                            const binIndices = histData.binIndices[binIndex];
                            this.pendingHistogramClickHandle = setTimeout(() => {
                                this.pendingHistogramClickHandle = undefined;
                                if (this.histogramData === histData) {
                                    this.selectCatalogPoints(binIndices);
                                }
                            }, DOUBLE_CLICK_THRESHOLD);
                        }
                    }
                },
                onHover: (_event, elements, chart) => {
                    const nativeEvent = _event.native as MouseEvent;
                    if (!elements.length) {
                        if (this.histogramHoverPixel) {
                            this.histogramHoverPixel = undefined;
                            this.histogramHoverBinIndex = undefined;
                            this.histogramHoverData = undefined;
                            chart.draw();
                        }
                        return;
                    }
                    if (nativeEvent && chart.chartArea) {
                        const xScale = chart.scales["x"];
                        const yScale = chart.scales["y"];
                        if (xScale && yScale && histData.bins.length > 0) {
                            const xVal = xScale.getValueForPixel(nativeEvent.offsetX);
                            if (xVal !== undefined) {
                                const binIndex = histData.binSize > 0 ? Math.floor((xVal - histData.start) / histData.binSize) : 0;
                                const clampedIndex = Math.max(0, Math.min(binIndex, histData.bins.length - 1));
                                if (this.histogramHoverData === histData && this.histogramHoverBinIndex === clampedIndex) {
                                    return;
                                }
                                this.histogramHoverData = histData;
                                this.histogramHoverBinIndex = clampedIndex;
                                const binCenter = histData.bins[clampedIndex].x;
                                const binCount = histData.bins[clampedIndex].y;
                                widgetStore.setIndicator({x: binCenter, y: binCount});
                                const px = xScale.getPixelForValue(binCenter);
                                const py = yScale.getPixelForValue(binCount);
                                this.histogramHoverPixel = {x: px, y: py};
                                chart.draw();
                            }
                        }
                    } else {
                        this.histogramHoverPixel = undefined;
                    }
                }
            };

            const crosshairPlugin: Plugin<"bar"> = {
                id: "crosshairPlugin",
                afterDraw: (chart: Chart) => {
                    if (!this.histogramHoverPixel || !this.isHistogramMouseEntered) {
                        return;
                    }
                    const {ctx, chartArea} = chart;
                    if (!chartArea) {
                        return;
                    }
                    const {x, y} = this.histogramHoverPixel;
                    const lineColor = AppStore.Instance.isDarkTheme ? Colors.GRAY4 : Colors.DARK_GRAY3;
                    ctx.save();
                    ctx.strokeStyle = lineColor;
                    ctx.lineWidth = 1;
                    // Vertical line
                    ctx.beginPath();
                    ctx.moveTo(x, chartArea.top);
                    ctx.lineTo(x, chartArea.bottom);
                    ctx.stroke();
                    // Horizontal line
                    ctx.beginPath();
                    ctx.moveTo(chartArea.left, y);
                    ctx.lineTo(chartArea.right, y);
                    ctx.stroke();
                    ctx.restore();
                }
            };

            const dragBoxPlugin: Plugin<"bar"> = {
                id: "dragBoxPlugin",
                afterDraw: (chart: Chart) => {
                    const dragStartX = this.histogramInteraction.selectionStartX;
                    const dragCurrentX = this.histogramInteraction.selectionCurrentX;
                    if (dragStartX === undefined || dragCurrentX === undefined) {
                        return;
                    }
                    const {ctx, chartArea} = chart;
                    if (!chartArea) {
                        return;
                    }
                    const startX = Math.max(dragStartX, chartArea.left);
                    const endX = Math.min(dragCurrentX, chartArea.right);
                    const boxWidth = endX - startX;
                    const selectionColor = AppStore.Instance.isDarkTheme ? Colors.GRAY3 : Colors.DARK_GRAY1;
                    ctx.save();
                    ctx.fillStyle = selectionColor;
                    ctx.globalAlpha = 0.2;
                    ctx.fillRect(startX, chartArea.top, boxWidth, chartArea.bottom - chartArea.top);
                    ctx.globalAlpha = 1.0;
                    ctx.strokeStyle = selectionColor;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(startX, chartArea.top);
                    ctx.lineTo(startX, chartArea.bottom);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(endX, chartArea.top);
                    ctx.lineTo(endX, chartArea.bottom);
                    ctx.stroke();
                    ctx.restore();
                }
            };

            const histogramChartData = {
                datasets: [
                    {
                        data: histData.bins,
                        backgroundColor: barColors,
                        borderColor: barColors,
                        borderWidth: 1,
                        barPercentage: 1.0,
                        categoryPercentage: 1.0
                    }
                ]
            };

            return (
                <div className={"catalog-plot"}>
                    <div className={"catalog-plot-option"}>
                        {renderFileSelect}
                        {renderXSelect}
                        {renderHistogramBins}
                        {renderHistogramLog}
                        {renderStatisticSelect}
                    </div>
                    <div
                        className="catalog-chart-container"
                        data-testid="catalog-histogram-plot"
                        ref={this.onHistogramContainerRef}
                        onMouseEnter={this.onHistogramMouseEnter}
                        onMouseLeave={this.onHistogramMouseLeave}
                        onMouseDown={this.onHistogramMouseDown}
                        onMouseMove={this.onHistogramMouseMove}
                        onMouseUp={this.onHistogramMouseUp}
                        onDoubleClick={this.onHistogramDoubleClick}
                    >
                        <Bar ref={this.onHistogramPlotRef as any} data={histogramChartData} options={histogramOptions} plugins={[crosshairPlugin, dragBoxPlugin]} />
                        <ToolbarComponent isDarkMode={isDarkTheme} isVisible={this.isHistogramMouseEntered} exportImage={this.exportHistogramImage} exportData={this.exportHistogramData} />
                    </div>
                    <div className={Classes.DIALOG_FOOTER}>
                        <div className="scatter-info" data-testid="catalog-plot-info">
                            <ProfilerInfoComponent info={infoStrings} type="pre-line" separator="newLine" />
                        </div>
                        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                            <Tooltip content={"Show only selected sources at image and table viewer"}>
                                <FormGroup label={"Selected only"} inline={true} disabled={isDisabled}>
                                    <Switch checked={catalogDisplayStore.isShowingSelectedData} onChange={this.handleShowSelectedDataChanged} disabled={isDisabled} data-testid="catalog-plot-selected-only-switch" />
                                </FormGroup>
                            </Tooltip>
                            <AnchorButton intent={Intent.PRIMARY} text="Plot" onClick={this.handlePlotClick} disabled={isDisabled || !profileStore.isFileBasedCatalog} data-testid="catalog-plot-widget-plot-button" />
                        </div>
                    </div>
                </div>
            );
        }

        // Scatter plot rendering
        const scatter = this.scatterData;
        let border: Border | undefined;
        if (widgetStore.isScatterAutoScaled) {
            border = scatter.border;
        } else {
            border = widgetStore.scatterBorder;
        }

        const scatterMultiPlotMap = new Map<string, MultiPlotProps>();
        if (widgetStore.isFittingResultVisible) {
            const fitting = widgetStore.fitting;
            const minMaxX = widgetStore.minMaxX;
            if (fitting && minMaxX) {
                scatterMultiPlotMap.set("fitting", {
                    imageName: "fitting",
                    plotName: "Linear Fit",
                    data: [
                        {x: minMaxX.minVal, y: fitting.intercept + fitting.slope * minMaxX.minVal},
                        {x: minMaxX.maxVal, y: fitting.intercept + fitting.slope * minMaxX.maxVal}
                    ],
                    type: PlotType.LINES,
                    borderColor: Colors.GREEN2,
                    order: 0,
                    isHidden: false,
                    borderWidth: 2.5
                });
            }
        }

        let scatterExtraPluginOptions: ChartOptions<"scatter">["plugins"] | undefined;
        if (widgetStore.isFittingResultVisible && widgetStore.fittingResultString) {
            const fittingAnnotation: AnnotationOptions = {
                type: "label",
                xValue: border?.xMin,
                yValue: border?.yMax,
                position: {x: "start", y: "start"},
                content: widgetStore.fittingResultString.split("\n"),
                textAlign: "start",
                color: isDarkTheme ? Colors.LIGHT_GRAY4 : Colors.DARK_GRAY1,
                font: {family: "monospace", size: 9},
                padding: {top: 0, right: 0, bottom: 0, left: 0},
                adjustScaleRange: false
            };
            scatterExtraPluginOptions = {
                annotation: {
                    annotations: {fittingLabel: fittingAnnotation}
                }
            };
        }

        return (
            <div className={"catalog-plot"}>
                <div className={"catalog-plot-option"}>
                    {renderFileSelect}
                    {renderXSelect}
                    {renderYSelect}
                    {renderStatisticSelect}
                </div>
                <div className="catalog-chart-container" data-testid="catalog-scatter-plot">
                    <ScatterPlotComponent
                        data={[]}
                        xMin={border?.xMin}
                        xMax={border?.xMax}
                        yMin={border?.yMin}
                        yMax={border?.yMax}
                        xLabel={widgetStore.xColumnName}
                        yLabel={widgetStore.yColumnName}
                        isDarkMode={isDarkTheme}
                        tickTypeX={TickType.Automatic}
                        tickTypeY={TickType.Automatic}
                        graphZoomedXY={this.onScatterZoomedXY}
                        graphZoomReset={this.onScatterDoubleClick}
                        graphSelectionReset={this.onDeselect}
                        graphCursorMoved={this.onScatterCursorMoved}
                        cursorNearestPointAt={this.getNearestScatterPoint}
                        updateChartArea={this.updateScatterChartArea}
                        graphClicked={this.onGraphClicked}
                        pointRadius={0.001}
                        cursorIndicatorStyle="crosshair"
                        cursorHitRadius={5}
                        shouldScrollZoom={true}
                        multiPlotPropsMap={scatterMultiPlotMap}
                        shouldAlignChartAreaRight={true}
                        dragAction={widgetStore.dragMode}
                        onBoxSelected={this.onBoxSelected}
                        onLassoSelected={this.onLassoSelected}
                        renderOverlay={this.renderWebGLOverlay}
                        cursorNearestPoint={this.cursorNearestScatterPoint}
                        extraPluginOptions={scatterExtraPluginOptions}
                        customExportData={this.exportScatterData}
                        exportFileName={`catalog-scatter-${widgetStore.xColumnName ?? "x"}-${widgetStore.yColumnName ?? "y"}`}
                        exportRightPadding={EXPORT_RIGHT_PADDING}
                        toolbarChildren={
                            <React.Fragment>
                                <Tooltip content="Box select">
                                    <AnchorButton
                                        aria-label="Box select"
                                        icon="widget"
                                        active={widgetStore.dragMode === DragMode.Select}
                                        onClick={() => widgetStore.setDragMode(DragMode.Select)}
                                        data-testid="catalog-scatter-box-select-button"
                                    />
                                </Tooltip>
                                <Tooltip content="Lasso select">
                                    <AnchorButton
                                        icon={<CustomIcon icon="lasso" />}
                                        aria-label="Lasso select"
                                        active={widgetStore.dragMode === DragMode.Lasso}
                                        onClick={() => widgetStore.setDragMode(widgetStore.dragMode === DragMode.Lasso ? DragMode.Select : DragMode.Lasso)}
                                        data-testid="catalog-scatter-lasso-button"
                                    />
                                </Tooltip>
                                <Tooltip content="Zoom">
                                    <AnchorButton
                                        icon="search"
                                        aria-label="Zoom"
                                        active={widgetStore.dragMode === DragMode.Zoom}
                                        onClick={() => widgetStore.setDragMode(widgetStore.dragMode === DragMode.Zoom ? DragMode.Select : DragMode.Zoom)}
                                        data-testid="catalog-scatter-zoom-button"
                                    />
                                </Tooltip>
                            </React.Fragment>
                        }
                    />
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className="scatter-info" data-testid="catalog-plot-info">
                        <ProfilerInfoComponent info={infoStrings} type="pre-line" separator="newLine" />
                    </div>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                        <Tooltip content={"Show only selected sources at image and table viewer"}>
                            <FormGroup label={"Selected only"} inline={true} disabled={isDisabled}>
                                <Switch checked={catalogDisplayStore.isShowingSelectedData} onChange={this.handleShowSelectedDataChanged} disabled={isDisabled} data-testid="catalog-plot-selected-only-switch" />
                            </FormGroup>
                        </Tooltip>
                        {renderLinearRegressionButton}
                        <AnchorButton intent={Intent.PRIMARY} text="Plot" onClick={this.handlePlotClick} disabled={isDisabled || !profileStore.isFileBasedCatalog} data-testid="catalog-plot-widget-plot-button" />
                    </div>
                </div>
            </div>
        );
    }
}
