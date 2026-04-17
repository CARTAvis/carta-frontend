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

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
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
                    if (this.widgetStore?.enableStatistic) {
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
            const xColumn = plotWidgetStore?.xColumnName === CatalogPlotComponent.emptyColumn;
            const yColumn = plotWidgetStore?.yColumnName === CatalogPlotComponent.emptyColumn;
            switch (plotWidgetStore?.plotType) {
                case CatalogPlotType.D2Scatter:
                    if (!xColumn && !yColumn && plotWidgetStore.scatterborder === undefined) {
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
                    if (!xColumn && plotWidgetStore.histogramBorder === undefined) {
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
        const nBinx = widgetStore.nBinx ? widgetStore.nBinx : this.numBinsX;
        const result = computeHistogramBins(slicedData, nBinx);
        const xRange = this.getHistogramXBorder(coords.wcsData);
        return {bins: result.bins, binSize: result.binSize, start: result.start, binIndices: result.binIndices, border: xRange};
    }

    @computed get enablePlotButton(): boolean {
        const emptyColumn = CatalogPlotComponent.emptyColumn;
        const profileStore = this.profileStore;
        const widgetStore = this.widgetStore;
        if (!profileStore || !widgetStore) {
            return false;
        }

        if (widgetStore?.plotType === CatalogPlotType.Histogram) {
            return widgetStore.xColumnName !== emptyColumn && !profileStore.loadingData && !profileStore.updatingDataStream;
        } else if (widgetStore?.plotType === CatalogPlotType.D2Scatter) {
            return widgetStore.xColumnName !== emptyColumn && widgetStore.yColumnName !== emptyColumn && !profileStore.loadingData && !profileStore.updatingDataStream;
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
        const nBinx = coords.wcsData?.length ? Math.ceil(Math.sqrt(coords.wcsData.length)) : DEFAULT_NUM_BINS;
        return nBinx;
    }

    private updateStatistic = () => {
        const profileStore = this.profileStore;
        const widgetStore = this.widgetStore;
        if (!widgetStore?.enableStatistic || !profileStore || !widgetStore.statisticColumnName) {
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
        const val = changeEvent.target.checked;
        if (widgetsStore && catalogWidgetStore) {
            catalogWidgetStore.setShowSelectedData(val);
            catalogWidgetStore.setCatalogTableAutoScroll(true);
        }
    };

    private handleLogScaleYChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        const val = changeEvent.target.checked;
        this.widgetStore?.setLogScaleY(val);
    };

    private onScatterCursorMoved = (x: number, y: number) => {
        const scatter = this.scatterData;
        if (scatter.xData.length > 0) {
            const points: Point2D[] = scatter.xData.map((xVal, i) => ({x: xVal, y: scatter.yData[i]}));
            const idx = closestPointIndexToCursor({x, y}, points);
            this.cursorNearestScatterPoint = points[idx];
            const widgetStore = this.widgetStore;
            if (widgetStore) {
                widgetStore.setIndicator({x: this.cursorNearestScatterPoint.x, y: this.cursorNearestScatterPoint.y});
            }
        } else {
            this.cursorNearestScatterPoint = undefined;
        }
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
            // Also deselect on double-click
            this.onDeselect();
        } else {
            const initBorder = this.initHistogramXBorder;
            if (initBorder) {
                widgetsStore?.setHistogramXBorder(initBorder);
            }
        }
    };

    private onScatterZoomedXY = (xMin: number, xMax: number, yMin: number, yMax: number) => {
        const widgetStore = this.widgetStore;
        if (widgetStore) {
            widgetStore.setScatterborder({xMin, xMax, yMin, yMax});
        }
    };
    // Box selection handler for scatter plots
    private onBoxSelected = (xMin: number, xMax: number, yMin: number, yMax: number) => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.catalogWidgetStore;
        const widgetStore = this.widgetStore;
        if (!profileStore || !catalogWidgetStore || !widgetStore) {
            return;
        }

        const catalogStore = CatalogStore.Instance;
        const catalogFileId = profileStore.catalogInfo.fileId;
        catalogStore.updateCatalogProfiles(catalogFileId);

        const scatter = this.scatterData;
        const selectedPointIndices: number[] = [];
        const numPoints = Math.min(scatter.xData.length, scatter.yData.length);
        for (let i = 0; i < numPoints; i++) {
            const x = scatter.xData[i];
            const y = scatter.yData[i];
            if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
                selectedPointIndices.push(i);
            }
        }

        if (selectedPointIndices.length) {
            const matched = profileStore.getOriginIndices(selectedPointIndices);
            profileStore.setSelectedPointIndices(matched, true);
            catalogWidgetStore.setCatalogTableAutoScroll(true);
        }
    };

    // Lasso selection handler for scatter plots
    private onLassoSelected = (polygon: Point2D[]) => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.catalogWidgetStore;
        const widgetStore = this.widgetStore;
        if (!profileStore || !catalogWidgetStore || !widgetStore || polygon.length < 3) {
            return;
        }

        const catalogStore = CatalogStore.Instance;
        const catalogFileId = profileStore.catalogInfo.fileId;
        catalogStore.updateCatalogProfiles(catalogFileId);

        const scatter = this.scatterData;
        const selectedPointIndices: number[] = [];
        const numPoints = Math.min(scatter.xData.length, scatter.yData.length);
        for (let i = 0; i < numPoints; i++) {
            if (pointInPolygon({x: scatter.xData[i], y: scatter.yData[i]}, polygon)) {
                selectedPointIndices.push(i);
            }
        }

        if (selectedPointIndices.length) {
            const matched = profileStore.getOriginIndices(selectedPointIndices);
            profileStore.setSelectedPointIndices(matched, true);
            catalogWidgetStore.setCatalogTableAutoScroll(true);
        }
    };

    // Single-click handler for scatter plots
    private onGraphClicked = (x: number, y: number, _data: {x: number; y: number; z?: number}[]) => {
        const selectionMode: DragMode[] = ["select", "lasso"];
        const widgetStore = this.widgetStore;
        const isInDragmode = widgetStore && selectionMode.includes(widgetStore.dragmode);
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.catalogWidgetStore;
        if (!isInDragmode || !profileStore || !catalogWidgetStore) {
            return;
        }

        const catalogStore = CatalogStore.Instance;
        const catalogFileId = profileStore.catalogInfo.fileId;
        catalogStore.updateCatalogProfiles(catalogFileId);

        // Find nearest point to click
        const scatter = this.scatterData;
        const numPoints = Math.min(scatter.xData.length, scatter.yData.length);
        let minDist = Infinity;
        let nearestIndex = -1;
        for (let i = 0; i < numPoints; i++) {
            const dx = scatter.xData[i] - x;
            const dy = scatter.yData[i] - y;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
                minDist = dist;
                nearestIndex = i;
            }
        }

        if (nearestIndex >= 0) {
            const matched = profileStore.getOriginIndices([nearestIndex]);
            profileStore.setSelectedPointIndices(matched, true);
            catalogWidgetStore.setCatalogTableAutoScroll(true);
        }
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

    // region selection - histogram box selection
    private onHistogramBoxSelected = (xMin: number, xMax: number) => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.catalogWidgetStore;
        if (!profileStore || !catalogWidgetStore) {
            return;
        }

        const catalogStore = CatalogStore.Instance;
        const catalogFileId = profileStore.catalogInfo.fileId;
        catalogStore.updateCatalogProfiles(catalogFileId);

        const histogram = this.histogramData;
        const selectedPointIndices: number[] = [];
        for (let i = 0; i < histogram.bins.length; i++) {
            const binLeft = histogram.start + i * histogram.binSize;
            const binRight = binLeft + histogram.binSize;
            // Check if bin overlaps with selection range
            if (binRight >= xMin && binLeft <= xMax) {
                selectedPointIndices.push(...histogram.binIndices[i]);
            }
        }

        if (selectedPointIndices.length) {
            const matched = profileStore.getOriginIndices(selectedPointIndices);
            profileStore.setSelectedPointIndices(matched, true);
            catalogWidgetStore.setCatalogTableAutoScroll(true);
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
        const dragmode = this.widgetStore?.dragmode;
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

    private histogramDragStartX: number | undefined;
    private histogramDragCurrentX: number | undefined;
    private histogramPanPrevX: number | undefined;

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
        const chart = this.histogramPlotRef;
        const widgetStore = this.widgetStore;
        if (this.histogramPanPrevX !== undefined && chart && widgetStore) {
            const xScale = chart.scales["x"];
            if (xScale) {
                const prevVal = xScale.getValueForPixel(this.histogramPanPrevX);
                const currentVal = xScale.getValueForPixel(event.nativeEvent.offsetX);
                if (prevVal !== undefined && currentVal !== undefined) {
                    const delta = prevVal - currentVal;
                    const currentMin = xScale.min;
                    const currentMax = xScale.max;
                    widgetStore.setHistogramXBorder({xMin: currentMin + delta, xMax: currentMax + delta});
                }
                this.histogramPanPrevX = event.nativeEvent.offsetX;
            }
        } else if (this.histogramDragStartX !== undefined) {
            this.histogramDragCurrentX = event.nativeEvent.offsetX;
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
            if (xScale) {
                const x1 = xScale.getValueForPixel(this.histogramDragStartX);
                const x2 = xScale.getValueForPixel(this.histogramDragCurrentX);
                if (x1 !== undefined && x2 !== undefined && Math.abs(event.nativeEvent.offsetX - this.histogramDragStartX) > 3) {
                    const newMin = Math.min(x1, x2);
                    const newMax = Math.max(x1, x2);
                    widgetStore.setHistogramXBorder({xMin: newMin, xMax: newMax});
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
        const canvas = chart.canvas;
        const composedCanvas = document.createElement("canvas") as HTMLCanvasElement;
        composedCanvas.width = canvas.width;
        composedCanvas.height = canvas.height;
        const ctx = composedCanvas.getContext("2d");
        if (ctx) {
            const isDarkMode = AppStore.Instance.darkTheme;
            ctx.fillStyle = AppStore.Instance.preferenceStore.transparentImageBackground ? "rgba(255, 255, 255, 0.0)" : isDarkMode ? Colors.DARK_GRAY1 : Colors.LIGHT_GRAY5;
            ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
            ctx.drawImage(canvas, 0, 0);
            composedCanvas.toBlob(blob => {
                if (blob) {
                    const link = document.createElement("a") as HTMLAnchorElement;
                    const columnName = this.widgetStore?.xColumnName ?? "histogram";
                    link.download = `catalog-histogram-${columnName}`.substring(0, 200) + `-${getTimestamp()}.png`;
                    link.href = URL.createObjectURL(blob);
                    link.dispatchEvent(new MouseEvent("click"));
                }
            }, "image/png");
        }
    };

    private exportHistogramData = () => {
        const histData = this.histogramData;
        const columnName = this.widgetStore?.xColumnName ?? "histogram";
        const comment = `# Catalog Histogram: ${columnName}\n# bin_center\tcount`;
        const rows = histData.bins.map(bin => `${toExponential(bin.x, 10)}\t${bin.y}`);
        const content = comment + "\n" + rows.join("\n");
        exportTsvFile("catalog", `histogram-${columnName}`, content);
    };

    private exportScatterImage = () => {
        const webgl = this.webglOverlayRef;
        if (!webgl) {
            return;
        }
        // Force a fresh draw to ensure the WebGL buffer has current content
        webgl.draw();
        const gl = webgl.gl;
        const webglCanvas = webgl.canvasRef.current;
        if (!gl || !webglCanvas || webglCanvas.width === 0 || webglCanvas.height === 0) {
            return;
        }

        // Find the Chart.js canvas via the DOM
        const scatterContainer = document.querySelector<HTMLElement>('[data-testid="catalog-scatter-plot"] .scatter-plot-component');
        const chartCanvas = scatterContainer?.querySelector<HTMLCanvasElement>("canvas:not([data-overlay])");
        if (!chartCanvas) {
            return;
        }

        const composedCanvas = document.createElement("canvas");
        composedCanvas.width = chartCanvas.width;
        composedCanvas.height = chartCanvas.height;
        const ctx = composedCanvas.getContext("2d");
        if (!ctx) {
            return;
        }

        const isDarkTheme = AppStore.Instance.darkTheme;
        ctx.fillStyle = AppStore.Instance.preferenceStore.transparentImageBackground ? "rgba(255, 255, 255, 0.0)" : isDarkTheme ? Colors.DARK_GRAY1 : Colors.LIGHT_GRAY5;
        ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
        ctx.drawImage(chartCanvas, 0, 0);

        // Read WebGL pixels directly via gl.readPixels for maximum reliability
        const w = webglCanvas.width;
        const h = webglCanvas.height;
        const pixels = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        // Flip vertically (WebGL y=0 is bottom, canvas y=0 is top)
        const flipped = new Uint8ClampedArray(w * h * 4);
        const rowSize = w * 4;
        for (let row = 0; row < h; row++) {
            const srcOffset = row * rowSize;
            const dstOffset = (h - 1 - row) * rowSize;
            flipped.set(pixels.subarray(srcOffset, srcOffset + rowSize), dstOffset);
        }

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
            tempCtx.putImageData(new ImageData(flipped, w, h), 0, 0);
            ctx.drawImage(tempCanvas, 0, 0, composedCanvas.width, composedCanvas.height);
        }

        const widgetStore = this.widgetStore;
        const plotName = `scatter-${widgetStore?.xColumnName ?? "x"}-${widgetStore?.yColumnName ?? "y"}`;
        composedCanvas.toBlob(blob => {
            if (blob) {
                const link = document.createElement("a");
                link.download = `catalog-${plotName}`.substring(0, 200) + `-${getTimestamp()}.png`;
                link.href = URL.createObjectURL(blob);
                link.dispatchEvent(new MouseEvent("click"));
            }
        }, "image/png");
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

        if (widgetStore.showFittingResult && widgetStore.fittingResultString) {
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
            border = widgetStore.scatterborder;
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
                darkMode={AppStore.Instance.darkTheme}
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
        const disabled = !this.enablePlotButton;
        const isScatterPlot = this.plotType === CatalogPlotType.D2Scatter;
        const isHistogramPlot = this.plotType === CatalogPlotType.Histogram;
        const isDarkTheme = AppStore.Instance.darkTheme;
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
                    <Button text={this.catalogFileId} rightIcon="double-caret-vertical" />
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
                    <Button text={widgetStore.xColumnName} rightIcon="double-caret-vertical" data-testid="catalog-plot-widget-x-dropdown" />
                </Select>
            </FormGroup>
        );

        const renderHistogramLog = (
            <FormGroup label={"Log scale"} inline={true} disabled={disabled}>
                <Switch checked={widgetStore.logScaleY} onChange={this.handleLogScaleYChanged} disabled={disabled} />
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
                    <Button text={widgetStore.yColumnName} rightIcon="double-caret-vertical" />
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
                    <Button text={widgetStore.statisticColumnName} rightIcon="double-caret-vertical" data-testid="catalog-plot-widget-stat-dropdown" />
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
                value={widgetStore.nBinx ? widgetStore.nBinx : this.numBinsX}
                onValueChanged={val => this.onNumBinChange(val)}
                onValueCleared={() => this.onNumBinChange(this.numBinsX)}
                displayExponential={false}
                disabled={disabled}
                data-testid="catalog-plot-widget-bin-input"
            />
        );

        const renderLinearRegressionButton = (
            <AnchorButton intent={Intent.PRIMARY} text="Linear fit" onClick={() => this.handleFittingClick(selectedPointIndices)} disabled={disabled || selectedPointIndices?.length === 1} data-testid="catalog-plot-widget-fit-button" />
        );

        const infoStrings = [this.genProfilerInfo];
        if (widgetStore.showStatisticResult && widgetStore.enableStatistic) {
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
                        type: widgetStore.logScaleY ? "logarithmic" : "linear",
                        title: {display: true, text: "Count", color: labelColor},
                        ticks: {
                            color: labelColor
                        },
                        grid: {color: gridColor},
                        border: {color: gridColor},
                        min: widgetStore.logScaleY ? 1 : 0,
                        beginAtZero: !widgetStore.logScaleY
                    }
                },
                onClick: (_event, elements) => {
                    if (elements.length > 0) {
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
                            <Bar ref={this.onHistogramPlotRef as any} data={histogramChartData} options={histogramOptions} plugins={[chartAreaPlugin, crosshairPlugin]} />
                            <ToolbarComponent darkMode={isDarkTheme} visible={this.isHistogramMouseEntered} exportImage={this.exportHistogramImage} exportData={this.exportHistogramData}>
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
                                    <FormGroup label={"Selected only"} inline={true} disabled={disabled}>
                                        <Switch checked={catalogWidgetStore.showSelectedData} onChange={this.handleShowSelectedDataChanged} disabled={disabled} />
                                    </FormGroup>
                                </Tooltip>
                                <AnchorButton intent={Intent.PRIMARY} text="Plot" onClick={this.handlePlotClick} disabled={disabled || !profileStore.isFileBasedCatalog} data-testid="catalog-plot-widget-plot-button" />
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
            border = widgetStore.scatterborder;
        }

        const scatterMultiPlotMap = new Map<string, MultiPlotProps>();
        if (widgetStore.showFittingResult) {
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
                    hidden: false,
                    borderWidth: 2.5
                });
            }
        }

        let scatterExtraPluginOptions: ChartOptions<"scatter">["plugins"] | undefined;
        if (widgetStore.showFittingResult && widgetStore.fittingResultString) {
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
                            darkMode={isDarkTheme}
                            tickTypeX={TickType.Automatic}
                            tickTypeY={TickType.Automatic}
                            graphZoomedXY={this.onScatterZoomedXY}
                            graphZoomReset={this.onDoubleClick}
                            graphCursorMoved={this.onScatterCursorMoved}
                            graphClicked={this.onGraphClicked}
                            pointRadius={0.001}
                            scrollZoom={true}
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
                                        <AnchorButton icon="widget" active={widgetStore.dragmode === "select"} onClick={() => widgetStore.setDragmode("select")} />
                                    </Tooltip>
                                    <Tooltip content="Lasso select">
                                        <AnchorButton icon="polygon-filter" active={widgetStore.dragmode === "lasso"} onClick={() => widgetStore.setDragmode("lasso")} />
                                    </Tooltip>
                                    <Tooltip content="Zoom">
                                        <AnchorButton icon="zoom-in" active={widgetStore.dragmode === "zoom"} onClick={() => widgetStore.setDragmode("zoom")} />
                                    </Tooltip>
                                    <Tooltip content="Pan">
                                        <AnchorButton icon="move" active={widgetStore.dragmode === "pan"} onClick={() => widgetStore.setDragmode("pan")} />
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
                                <FormGroup label={"Selected only"} inline={true} disabled={disabled}>
                                    <Switch checked={catalogWidgetStore.showSelectedData} onChange={this.handleShowSelectedDataChanged} disabled={disabled} />
                                </FormGroup>
                            </Tooltip>
                            {renderLinearRegressionButton}
                            <AnchorButton intent={Intent.PRIMARY} text="Plot" onClick={this.handlePlotClick} disabled={disabled || !profileStore.isFileBasedCatalog} data-testid="catalog-plot-widget-plot-button" />
                        </div>
                    </div>
                </div>
            </ResizeDetector>
        );
    }
}
