import * as React from "react";
import {Bar} from "react-chartjs-2";
import {AnchorButton, Button, Classes, Colors, FormGroup, Intent, MenuItem, NonIdealState, PopoverPosition, Switch, Tooltip} from "@blueprintjs/core";
import {type ItemPredicate, type ItemRendererProps, Select} from "@blueprintjs/select";
import {CARTA} from "carta-protobuf";
import {BarController, BarElement, Chart, type ChartArea, type ChartOptions, Legend, LinearScale, LogarithmicScale, type Plugin, PointElement} from "chart.js";
import {type AnnotationOptions} from "chartjs-plugin-annotation";
import FuzzySearch from "fuzzy-search";
import * as GSL from "gsl_wrapper";
import * as _ from "lodash";
import {action, autorun, computed, type IReactionDisposer, makeObservable, observable, reaction, runInAction} from "mobx";
import {observer} from "mobx-react";
import tinycolor from "tinycolor2";

import {ClearableNumericInputComponent, ProfilerInfoComponent, ResizeDetector} from "components/Shared";
import {type MultiPlotProps} from "components/Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {ToolbarComponent} from "components/Shared/LinePlot/Toolbar/ToolbarComponent";
import {ScatterPlotComponent} from "components/Shared/ScatterPlot/ScatterPlotComponent";
import {CatalogPlotType, CatalogUpdateMode, PlotType, TickType} from "enums";
import {type Point2D} from "models";
import {AppStore, type CatalogOnlineQueryProfileStore, type CatalogProfileStore, CatalogStore, type DefaultWidgetConfig, type WidgetProps, WidgetsStore} from "stores";
import {type Border, type CatalogPlotWidgetStore, type CatalogPlotWidgetStoreProps, type CatalogWidgetStore, type DragMode, type XBorder} from "stores/Widgets";
import {closestPointIndexToCursor, computeHistogramBins, exportTsvFile, getTimestamp, minMaxArray, pointInPolygon, toExponential, toFixed, type TypedArray} from "utilities";

import {CatalogScatterWebGL} from "./CatalogScatterWebGL";

import "./CatalogPlotComponent.scss";

Chart.register(BarController, BarElement, Legend, LinearScale, LogarithmicScale, PointElement);

const DEFAULT_NUM_BINS = 10; // default fallback

@observer
export class CatalogPlotComponent extends React.Component<WidgetProps> {
    @observable width: number = 680;
    @observable height: number = 400;
    @observable profileId: string = "";
    @observable catalogFileId: number = 0;
    @observable componentId: string = "";
    @observable private histogramChartArea: ChartArea | undefined;
    @observable private isHistogramMouseEntered: boolean = false;
    private plotType: CatalogPlotType;
    private static emptyColumn = "None";
    private catalogFileNames: Map<number, string>;
    private readonly disposers: IReactionDisposer[] = [];
    private widgetId: string;
    private histogramPlotRef: Chart<"bar"> | null = null;
    private cursorNearestScatterPoint: {x: number; y: number} | undefined;
    private histogramHoverPixel: {x: number; y: number} | undefined;
    private webglOverlayRef: CatalogScatterWebGL | null = null;

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
        this.componentId = catalogPlot.catalogPlotComponentId;
        this.catalogFileId = catalogPlot.catalogFileId;
        this.catalogFileNames = new Map<number, string>();

        makeObservable(this);

        this.disposers.push(
            autorun(() => {
                const profileStore = this.profileStore;
                const widgetStore = this.widgetStore;
                const catalogFileIds = CatalogStore.Instance.activeCatalogFiles;
                if (!catalogFileIds?.includes(this.catalogFileId) && catalogFileIds?.length > 0) {
                    runInAction(() => {
                        this.catalogFileId = catalogFileIds[0];
                    });
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
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    }

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

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

    @computed get catalogWidgetStore(): CatalogWidgetStore | undefined {
        const widgetStoreId = CatalogStore.Instance.catalogWidgets.get(this.catalogFileId);
        return widgetStoreId !== undefined ? WidgetsStore.Instance.catalogWidgets.get(widgetStoreId) : undefined;
    }

    @action handleCatalogFileChange = (fileId: number) => {
        this.catalogFileId = fileId;
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
                                const scatterBorder = this.getScatterBorder(scatterCoords.wcsX, scatterCoords.wcsY);
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
                                const histogramXBorder = this.getHistogramXBorder(histogramCoords.wcsData);
                                plotWidgetStore.setHistogramXBorder(histogramXBorder);
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

    private getScatterBorder(xArray: number[], yArray: number[]): Border {
        const xBounds = minMaxArray(xArray);
        const yBounds = minMaxArray(yArray);
        return {
            xMin: xBounds.minVal,
            xMax: xBounds.maxVal,
            yMin: yBounds.minVal,
            yMax: yBounds.maxVal
        };
    }

    private getHistogramXBorder(xArray: number[] | TypedArray): XBorder {
        const xBounds = minMaxArray(xArray);
        return {
            xMin: xBounds.minVal,
            xMax: xBounds.maxVal
        };
    }

    @computed get initScatterBorder(): Border | undefined {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        if (!widgetStore || !profileStore || !widgetStore.xColumnName || !widgetStore.yColumnName) {
            return undefined;
        }
        const coords = profileStore.get2DPlotData(widgetStore.xColumnName, widgetStore.yColumnName, profileStore.catalogData);
        return coords.wcsX && coords.wcsY ? this.getScatterBorder(coords.wcsX, coords.wcsY) : undefined;
    }

    @computed get initHistogramXBorder(): XBorder | undefined {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        if (!widgetStore || !profileStore || !widgetStore.xColumnName) {
            return undefined;
        }
        const coords = profileStore.get1DPlotData(widgetStore.xColumnName);
        return coords.wcsData ? this.getHistogramXBorder(coords.wcsData) : undefined;
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
        const xData = coords.wcsX ? Array.from(coords.wcsX.slice(0, numVisibleRows)) : [];
        const yData = coords.wcsY ? Array.from(coords.wcsY.slice(0, numVisibleRows)) : [];

        if (!coords.wcsX || !coords.wcsY) {
            return {xData, yData, border: undefined};
        }
        const border = this.getScatterBorder(coords.wcsX, coords.wcsY);
        return {xData, yData, border};
    }
    @computed get histogramData() {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        if (!widgetStore || !profileStore || !widgetStore.xColumnName) {
            return {bins: [] as Point2D[], binSize: 0, start: 0, binIndices: [] as number[][], border: undefined};
        }
        // dummy values to trigger update, since profileStore.catalogData is not observable

        const numVisibleRows = profileStore.numVisibleRows;

        const coords = profileStore.get1DPlotData(widgetStore.xColumnName);
        if (!coords.wcsData) {
            return {bins: [] as Point2D[], binSize: 0, start: 0, binIndices: [] as number[][], border: undefined};
        }
        const slicedData = coords.wcsData.slice(0, numVisibleRows);
        const nBinX = widgetStore.nBinX ? widgetStore.nBinX : this.numBinsX;
        const result = computeHistogramBins(slicedData, nBinX);
        const xRange = this.getHistogramXBorder(coords.wcsData);
        return {bins: result.bins, binSize: result.binSize, start: result.start, binIndices: result.binIndices, border: xRange};
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
        const catalogWidgetStore = this.catalogWidgetStore;
        const isChecked = changeEvent.target.checked;
        if (widgetsStore && catalogWidgetStore) {
            catalogWidgetStore.setShowSelectedData(isChecked);
            catalogWidgetStore.setCatalogTableAutoScroll(true);
        }
    };

    private handleLogScaleYChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        const isLogScaleY = changeEvent.target.checked;
        this.widgetStore?.setLogScaleY(isLogScaleY);
    };

    private onScatterCursorMoved = (x: number, y: number) => {
        const scatter = this.scatterData;
        if (scatter.xData.length === 0) {
            this.cursorNearestScatterPoint = undefined;
            return;
        }
        const points: Point2D[] = scatter.xData.map((xVal, i) => ({x: xVal, y: scatter.yData[i]}));
        const nearest = points[closestPointIndexToCursor({x, y}, points)];
        this.cursorNearestScatterPoint = nearest;
        this.widgetStore?.setIndicator(nearest);
    };

    private onDoubleClick = () => {
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

        this.onDeselect();
    };

    private selectCatalogPoints(rawIndices: number[]) {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.catalogWidgetStore;
        if (!rawIndices.length || !profileStore || !catalogWidgetStore) {
            return;
        }
        CatalogStore.Instance.updateCatalogProfiles(profileStore.catalogInfo.fileId);
        profileStore.setSelectedPointIndices(profileStore.getOriginIndices(rawIndices), true);
        catalogWidgetStore.setCatalogTableAutoScroll(true);
    }

    private onScatterZoomedXY = (xMin: number, xMax: number, yMin: number, yMax: number) => {
        const widgetStore = this.widgetStore;
        if (widgetStore) {
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
        const numPoints = Math.min(scatter.xData.length, scatter.yData.length);
        const selected: number[] = [];
        for (let i = 0; i < numPoints; i++) {
            if (pointInPolygon({x: scatter.xData[i], y: scatter.yData[i]}, polygon)) {
                selected.push(i);
            }
        }
        this.selectCatalogPoints(selected);
    };

    private onGraphClicked = (x: number, y: number, _data: {x: number; y: number; z?: number}[]) => {
        const selectionMode: DragMode[] = ["select", "lasso"];
        const widgetStore = this.widgetStore;
        if (!widgetStore || !selectionMode.includes(widgetStore.dragMode)) {
            return;
        }
        const scatter = this.scatterData;
        if (!scatter.xData.length) {
            return;
        }
        const points: Point2D[] = scatter.xData.map((xVal, i) => ({x: xVal, y: scatter.yData[i]}));
        const nearestIndex = closestPointIndexToCursor({x, y}, points);
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
        const catalogStore = CatalogStore.Instance;
        const profileStore = this.profileStore;
        const widgetsStore = this.widgetStore;
        const catalogWidgetStore = this.catalogWidgetStore;
        catalogStore.updateCatalogProfiles(this.catalogFileId);
        profileStore?.setSelectedPointIndices([], false);
        catalogWidgetStore?.setShowSelectedData(false);
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

    private formatTickValue = (value: number, rangeMin: number, rangeMax: number): string => {
        const difference = rangeMax - rangeMin;
        const exponential = difference.toExponential(2);
        const power = parseFloat(exponential.split("e")[1]);
        const maxPower = parseFloat(rangeMax.toExponential(1).split("e")[1]);
        const minPower = parseFloat(rangeMin.toExponential(1).split("e")[1]);
        if (maxPower >= 5 || minPower <= -5) {
            return toExponential(value, 2);
        } else if (power <= 0) {
            return value.toFixed(Math.abs(power) + 1);
        } else {
            return String(value);
        }
    };

    private getScatterDragAction = (): "boxSelect" | "lassoSelect" | "zoom" | "pan" => {
        const dragmode = this.widgetStore?.dragMode;
        if (dragmode === "lasso") {
            return "lassoSelect";
        }
        if (dragmode === "select") {
            return "boxSelect";
        }
        if (dragmode === "zoom") {
            return "zoom";
        }
        if (dragmode === "pan") {
            return "pan";
        }
        return "boxSelect";
    };

    @action private updateHistogramChartArea = (chart: Chart) => {
        if (chart.chartArea) {
            this.histogramChartArea = chart.chartArea;
        }
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
        this.histogramPlotRef?.draw();
    };

    private onHistogramWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        const chart = this.histogramPlotRef;
        const widgetStore = this.widgetStore;
        if (!chart || !widgetStore) {
            return;
        }
        event.preventDefault();
        const xScale = chart.scales["x"];
        if (!xScale) {
            return;
        }
        const currentMin = xScale.min;
        const currentMax = xScale.max;
        const range = currentMax - currentMin;
        const zoomFactor = event.deltaY > 0 ? 0.1 : -0.1;
        const mouseX = xScale.getValueForPixel(event.nativeEvent.offsetX) ?? currentMin + range / 2;
        const fraction = (mouseX - currentMin) / range;
        const newMin = currentMin + range * zoomFactor * fraction;
        const newMax = currentMax - range * zoomFactor * (1 - fraction);
        if (newMax > newMin) {
            widgetStore.setHistogramXBorder({xMin: newMin, xMax: newMax});
        }
    };

    private selectHistogramBinsInRange(xMin: number, xMax: number) {
        const {bins, binSize, binIndices} = this.histogramData;
        const selected: number[] = [];
        for (let i = 0; i < bins.length; i++) {
            const halfBin = binSize / 2;
            if (bins[i].x + halfBin >= xMin && bins[i].x - halfBin <= xMax) {
                selected.push(...binIndices[i]);
            }
        }
        this.selectCatalogPoints(selected);
    }

    private histogramDragStartX: number | undefined;
    private histogramDragCurrentX: number | undefined;
    private histogramPanPrevX: number | undefined;
    private isHistogramDragHandled = false;

    private onHistogramMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.button === 0) {
            const widgetStore = this.widgetStore;
            if (widgetStore?.histogramDragMode === "pan") {
                this.histogramPanPrevX = event.nativeEvent.offsetX;
            } else {
                this.histogramDragStartX = event.nativeEvent.offsetX;
                this.histogramDragCurrentX = undefined;
            }
        }
    };

    private onHistogramMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        const offsetX = event.nativeEvent.offsetX;
        const chart = this.histogramPlotRef;
        const widgetStore = this.widgetStore;
        if (this.histogramPanPrevX !== undefined && chart && widgetStore) {
            const xScale = chart.scales["x"];
            if (xScale) {
                const prevVal = xScale.getValueForPixel(this.histogramPanPrevX);
                const currentVal = xScale.getValueForPixel(offsetX);
                if (prevVal !== undefined && currentVal !== undefined) {
                    const delta = prevVal - currentVal;
                    const currentMin = xScale.min;
                    const currentMax = xScale.max;
                    widgetStore.setHistogramXBorder({xMin: currentMin + delta, xMax: currentMax + delta});
                }
                this.histogramPanPrevX = offsetX;
            }
        } else if (this.histogramDragStartX !== undefined) {
            this.histogramDragCurrentX = offsetX;
            this.histogramPlotRef?.draw();
        }
    };

    private onHistogramMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
        if (this.histogramPanPrevX !== undefined) {
            this.histogramPanPrevX = undefined;
            return;
        }
        const chart = this.histogramPlotRef;
        const widgetStore = this.widgetStore;
        if (this.histogramDragStartX !== undefined && this.histogramDragCurrentX !== undefined && chart && widgetStore) {
            const xScale = chart.scales["x"];
            if (xScale && Math.abs(event.nativeEvent.offsetX - this.histogramDragStartX) > 3) {
                this.isHistogramDragHandled = true;
                const x1 = xScale.getValueForPixel(this.histogramDragStartX);
                const x2 = xScale.getValueForPixel(this.histogramDragCurrentX);
                if (x1 !== undefined && x2 !== undefined) {
                    const newMin = Math.min(x1, x2);
                    const newMax = Math.max(x1, x2);
                    if (widgetStore.histogramDragMode === "select") {
                        this.selectHistogramBinsInRange(newMin, newMax);
                    } else {
                        widgetStore.setHistogramXBorder({xMin: newMin, xMax: newMax});
                    }
                }
            }
        }
        this.histogramDragStartX = undefined;
        this.histogramDragCurrentX = undefined;
    };

    private exportHistogramImage = () => {
        const chart = this.histogramPlotRef;
        if (!chart) {
            return;
        }
        const composed = document.createElement("canvas") as HTMLCanvasElement;
        composed.width = chart.canvas.width;
        composed.height = chart.canvas.height;
        const ctx = composed.getContext("2d");
        if (!ctx) {
            return;
        }
        this.fillPlotBackground(ctx, composed.width, composed.height);
        ctx.drawImage(chart.canvas, 0, 0);
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

    private readWebGLPixelsFlipped(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): ImageData {
        const {width, height} = canvas;
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        const flipped = new Uint8ClampedArray(width * height * 4);
        const rowSize = width * 4;
        for (let row = 0; row < height; row++) {
            flipped.set(pixels.subarray(row * rowSize, (row + 1) * rowSize), (height - 1 - row) * rowSize);
        }
        return new ImageData(flipped, width, height);
    }

    private compositeScatterCanvases(chartCanvas: HTMLCanvasElement, webglCanvas: HTMLCanvasElement, gl: WebGL2RenderingContext): HTMLCanvasElement {
        const composed = document.createElement("canvas");
        composed.width = chartCanvas.width;
        composed.height = chartCanvas.height;
        const ctx = composed.getContext("2d")!;

        this.fillPlotBackground(ctx, composed.width, composed.height);
        ctx.drawImage(chartCanvas, 0, 0);

        const webglImageData = this.readWebGLPixelsFlipped(gl, webglCanvas);
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = webglCanvas.width;
        tempCanvas.height = webglCanvas.height;
        tempCanvas.getContext("2d")!.putImageData(webglImageData, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0, composed.width, composed.height);

        return composed;
    }

    private downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string) {
        canvas.toBlob(blob => {
            if (blob) {
                const link = document.createElement("a");
                link.download = filename.substring(0, 200) + `-${getTimestamp()}.png`;
                link.href = URL.createObjectURL(blob);
                link.dispatchEvent(new MouseEvent("click"));
            }
        }, "image/png");
    }

    private exportScatterImage = () => {
        const webgl = this.webglOverlayRef;
        if (!webgl) {
            return;
        }
        webgl.draw();
        const {gl} = webgl;
        const webglCanvas = webgl.canvasRef.current;
        if (!gl || !webglCanvas || webglCanvas.width === 0 || webglCanvas.height === 0) {
            return;
        }

        const chartCanvas = webglCanvas.closest<HTMLElement>(".scatter-plot-component")?.querySelector<HTMLCanvasElement>("canvas:not([data-overlay])");
        if (!chartCanvas) {
            return;
        }

        const xColumn = this.widgetStore?.xColumnName ?? "x";
        const yColumn = this.widgetStore?.yColumnName ?? "y";
        const composed = this.compositeScatterCanvases(chartCanvas, webglCanvas, gl);
        this.downloadCanvasAsPng(composed, `catalog-scatter-${xColumn}-${yColumn}`);
    };

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
                darkMode={AppStore.Instance.isDarkTheme}
                onRef={ref => (this.webglOverlayRef = ref)}
            />
        );
    };

    public render() {
        const profileStore = this.profileStore;
        const widgetStore = this.widgetStore;
        const catalogWidgetStore = this.catalogWidgetStore;
        const catalogFileIds = CatalogStore.Instance.activeCatalogFiles;
        if (!widgetStore || !profileStore || !catalogWidgetStore || catalogFileIds === undefined || catalogFileIds?.length === 0) {
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
            <FormGroup inline={true} label="File">
                <Select
                    className={Classes.FILL}
                    filterable={false}
                    items={catalogFileItems}
                    activeItem={this.catalogFileId}
                    onItemSelect={this.handleCatalogFileChange}
                    itemRenderer={this.renderFilePopOver}
                    popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                >
                    <Button text={this.catalogFileId} endIcon="double-caret-vertical" />
                </Select>
            </FormGroup>
        );

        const renderXSelect = (
            <FormGroup inline={true} label="X">
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
                <Switch checked={widgetStore.isLogScaleY} onChange={this.handleLogScaleYChanged} disabled={isDisabled} />
            </FormGroup>
        );

        const renderYSelect = (
            <FormGroup inline={true} label="Y">
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
                    <Button text={widgetStore.yColumnName} endIcon="double-caret-vertical" />
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
            let xMin: number | undefined;
            let xMax: number | undefined;
            if (widgetStore.isHistogramAutoScaledX) {
                xMin = binEdgeMin;
                xMax = binEdgeMax;
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

            const chartAreaPlugin: Plugin<"bar"> = {
                id: "chartAreaTracker",
                afterLayout: (chart: Chart) => {
                    this.updateHistogramChartArea(chart);
                }
            };

            const histogramOptions: ChartOptions<"bar"> = {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: {display: false}
                },
                scales: {
                    x: {
                        type: "linear",
                        title: {display: true, text: widgetStore.xColumnName, color: labelColor},
                        ticks: {
                            color: labelColor,
                            callback: (value: string | number) => {
                                if (xMin !== undefined && xMax !== undefined) {
                                    return this.formatTickValue(Number(value), xMin, xMax);
                                }
                                return String(value);
                            }
                        },
                        grid: {color: gridColor},
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
                        min: widgetStore.isLogScaleY ? 1 : 0,
                        beginAtZero: !widgetStore.isLogScaleY
                    }
                },
                onClick: (_event, elements) => {
                    // Skip if a drag action (zoom/select) was just handled
                    if (this.isHistogramDragHandled) {
                        this.isHistogramDragHandled = false;
                        return;
                    }
                    if (widgetStore.histogramDragMode === "select" && elements.length > 0) {
                        const binIndex = elements[0].index;
                        if (histData.binIndices[binIndex]?.length) {
                            const matched = profileStore.getOriginIndices(histData.binIndices[binIndex]);
                            profileStore.setSelectedPointIndices(matched, true);
                            this.catalogWidgetStore?.setCatalogTableAutoScroll(true);
                        }
                    }
                },
                onHover: (_event, _elements, chart) => {
                    const nativeEvent = _event.native as MouseEvent;
                    if (nativeEvent && chart.chartArea) {
                        const xScale = chart.scales["x"];
                        const yScale = chart.scales["y"];
                        if (xScale && yScale && histData.bins.length > 0 && histData.binSize > 0) {
                            const xVal = xScale.getValueForPixel(nativeEvent.offsetX);
                            if (xVal !== undefined) {
                                const binIndex = Math.floor((xVal - histData.start) / histData.binSize);
                                const clampedIndex = Math.max(0, Math.min(binIndex, histData.bins.length - 1));
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
                    const lineColor = isDarkTheme ? Colors.GRAY4 : Colors.GRAY2;
                    ctx.save();
                    ctx.strokeStyle = lineColor;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 4]);
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
                    if (this.histogramDragStartX === undefined || this.histogramDragCurrentX === undefined) {
                        return;
                    }
                    const {ctx, chartArea} = chart;
                    if (!chartArea) {
                        return;
                    }
                    const startX = Math.max(this.histogramDragStartX, chartArea.left);
                    const endX = Math.min(this.histogramDragCurrentX, chartArea.right);
                    const boxWidth = endX - startX;
                    ctx.save();
                    ctx.fillStyle = Colors.GRAY3;
                    ctx.globalAlpha = 0.2;
                    ctx.fillRect(startX, chartArea.top, boxWidth, chartArea.bottom - chartArea.top);
                    ctx.globalAlpha = 1.0;
                    ctx.strokeStyle = Colors.GRAY3;
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
                <ResizeDetector onResize={this.onResize} throttleTime={33}>
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
                            onMouseEnter={this.onHistogramMouseEnter}
                            onMouseLeave={this.onHistogramMouseLeave}
                            onWheel={this.onHistogramWheel}
                            onMouseDown={this.onHistogramMouseDown}
                            onMouseMove={this.onHistogramMouseMove}
                            onMouseUp={this.onHistogramMouseUp}
                            onDoubleClick={this.onDoubleClick}
                        >
                            <Bar ref={this.onHistogramPlotRef as any} data={histogramChartData} options={histogramOptions} plugins={[chartAreaPlugin, crosshairPlugin, dragBoxPlugin]} />
                            <ToolbarComponent isDarkMode={isDarkTheme} isVisible={this.isHistogramMouseEntered} exportImage={this.exportHistogramImage} exportData={this.exportHistogramData}>
                                <Tooltip content="Box select">
                                    <AnchorButton icon="widget" active={widgetStore.histogramDragMode === "select"} onClick={() => widgetStore.setHistogramDragMode("select")} />
                                </Tooltip>
                                <Tooltip content="Zoom">
                                    <AnchorButton icon="zoom-in" active={widgetStore.histogramDragMode === "zoom"} onClick={() => widgetStore.setHistogramDragMode("zoom")} />
                                </Tooltip>
                                <Tooltip content="Pan">
                                    <AnchorButton icon="move" active={widgetStore.histogramDragMode === "pan"} onClick={() => widgetStore.setHistogramDragMode("pan")} />
                                </Tooltip>
                            </ToolbarComponent>
                        </div>
                        <div className={Classes.DIALOG_FOOTER}>
                            <div className="scatter-info" data-testid="catalog-plot-info">
                                <ProfilerInfoComponent info={infoStrings} type="pre-line" separator="newLine" />
                            </div>
                            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                                <Tooltip content={"Show only selected sources at image and table viewer"}>
                                    <FormGroup label={"Selected only"} inline={true} disabled={isDisabled}>
                                        <Switch checked={catalogWidgetStore.isShowingSelectedData} onChange={this.handleShowSelectedDataChanged} disabled={isDisabled} />
                                    </FormGroup>
                                </Tooltip>
                                <AnchorButton intent={Intent.PRIMARY} text="Plot" onClick={this.handlePlotClick} disabled={isDisabled || !profileStore.isFileBasedCatalog} data-testid="catalog-plot-widget-plot-button" />
                            </div>
                        </div>
                    </div>
                </ResizeDetector>
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
            <ResizeDetector onResize={this.onResize} throttleTime={33}>
                <div className={"catalog-plot"}>
                    <div className={"catalog-plot-option"}>
                        {renderFileSelect}
                        {renderXSelect}
                        {renderYSelect}
                        {renderStatisticSelect}
                    </div>
                    <div className="catalog-chart-container" data-testid="catalog-scatter-plot">
                        <ScatterPlotComponent
                            width={this.width}
                            height={this.height - 110}
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
                            graphZoomReset={this.onDoubleClick}
                            graphCursorMoved={this.onScatterCursorMoved}
                            graphClicked={this.onGraphClicked}
                            pointRadius={0.001}
                            shouldScrollZoom={true}
                            multiPlotPropsMap={scatterMultiPlotMap}
                            dragAction={this.getScatterDragAction()}
                            onBoxSelected={this.onBoxSelected}
                            onLassoSelected={this.onLassoSelected}
                            renderOverlay={this.renderWebGLOverlay}
                            cursorNearestPoint={this.cursorNearestScatterPoint}
                            extraPluginOptions={scatterExtraPluginOptions}
                            customExportData={this.exportScatterData}
                            customExportImage={this.exportScatterImage}
                            toolbarChildren={
                                <React.Fragment>
                                    <Tooltip content="Box select">
                                        <AnchorButton icon="widget" active={widgetStore.dragMode === "select"} onClick={() => widgetStore.setDragMode("select")} />
                                    </Tooltip>
                                    <Tooltip content="Lasso select">
                                        <AnchorButton icon="polygon-filter" active={widgetStore.dragMode === "lasso"} onClick={() => widgetStore.setDragMode("lasso")} />
                                    </Tooltip>
                                    <Tooltip content="Zoom">
                                        <AnchorButton icon="zoom-in" active={widgetStore.dragMode === "zoom"} onClick={() => widgetStore.setDragMode("zoom")} />
                                    </Tooltip>
                                    <Tooltip content="Pan">
                                        <AnchorButton icon="move" active={widgetStore.dragMode === "pan"} onClick={() => widgetStore.setDragMode("pan")} />
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
                                    <Switch checked={catalogWidgetStore.isShowingSelectedData} onChange={this.handleShowSelectedDataChanged} disabled={isDisabled} />
                                </FormGroup>
                            </Tooltip>
                            {renderLinearRegressionButton}
                            <AnchorButton intent={Intent.PRIMARY} text="Plot" onClick={this.handlePlotClick} disabled={isDisabled || !profileStore.isFileBasedCatalog} data-testid="catalog-plot-widget-plot-button" />
                        </div>
                    </div>
                </div>
            </ResizeDetector>
        );
    }
}
