import * as React from "react";
import * as Plotly from "plotly.js";
import Plot from "react-plotly.js";
import {action, autorun, computed, runInAction, observable, makeObservable} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, AnchorButton, Intent, Switch, Button, MenuItem, PopoverPosition, NonIdealState} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {Select, IItemRendererProps, ItemPredicate} from "@blueprintjs/select";
import ReactResizeDetector from "react-resize-detector";
import FuzzySearch from "fuzzy-search";
import {CARTA} from "carta-protobuf";
import {CatalogUpdateMode, WidgetProps, AppStore, WidgetsStore, CatalogStore, CatalogProfileStore, DefaultWidgetConfig, CatalogOnlineQueryProfileStore} from "stores";
import {CatalogPlotWidgetStore, Border, DragMode, XBorder, CatalogPlotWidgetStoreProps, CatalogWidgetStore, CatalogPlotType} from "stores/widgets";
import {ProfilerInfoComponent, ClearableNumericInputComponent} from "components/Shared";
import {Colors} from "@blueprintjs/core";
import {toFixed, minMaxArray} from "utilities";
import {TypedArray} from "models/Processed";
import "./CatalogPlotComponent.scss";

@observer
export class CatalogPlotComponent extends React.Component<WidgetProps> {
    @observable width: number;
    @observable height: number;
    @observable profileId: string;
    @observable catalogFileId: number;
    @observable componentId: string;
    private plotType: CatalogPlotType;
    private histogramY: {yMin: number; yMax: number};
    private static emptyColumn = "None";
    private catalogFileNames: Map<number, string>;

    private static readonly UnsupportedDataTypes = [CARTA.ColumnType.String, CARTA.ColumnType.Bool, CARTA.ColumnType.UnsupportedType];

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "catalog-plot",
            type: "catalog-plot",
            minWidth: 320,
            minHeight: 400,
            defaultWidth: 600,
            defaultHeight: 350,
            title: "Catalog Plot",
            isCloseable: true,
            componentId: "catalog-plot-component"
        };
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        this.histogramY = {yMin: undefined, yMax: undefined};
        const catalogPlot = CatalogStore.Instance.getAssociatedIdByWidgetId(this.props.id);
        this.componentId = catalogPlot.catalogPlotComponentId;
        this.catalogFileId = catalogPlot.catalogFileId;
        this.catalogFileNames = new Map<number, string>();
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
                    WidgetsStore.Instance.setWidgetTitle(this.props.id, `Catalog ${this.plotType} : ${fileName} ${progressString}`);
                } else {
                    WidgetsStore.Instance.setWidgetTitle(this.props.id, `Catalog ${this.plotType}`);
                }
            } else {
                WidgetsStore.Instance.setWidgetTitle(this.props.id, `Catalog ${this.plotType}`);
            }
        });
    }

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    @computed get widgetStore(): CatalogPlotWidgetStore {
        const catalogWidgetMap = CatalogStore.Instance.catalogPlots.get(this.componentId);
        if (!catalogWidgetMap) {
            return undefined;
        }
        let widgetStoreId = catalogWidgetMap.get(this.catalogFileId);
        if (!widgetStoreId) {
            widgetStoreId = this.addNewWidgetStore();
        }
        const widgetStore = WidgetsStore.Instance.catalogPlotWidgets.get(widgetStoreId);
        return widgetStore;
    }

    @computed get profileStore(): CatalogProfileStore | CatalogOnlineQueryProfileStore {
        return CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
    }

    @computed get catalogWidgetStore(): CatalogWidgetStore {
        const widgetStoreId = CatalogStore.Instance.catalogWidgets.get(this.catalogFileId);
        return WidgetsStore.Instance.catalogWidgets.get(widgetStoreId);
    }

    @action handleCatalogFileChange = (fileId: number) => {
        this.catalogFileId = fileId;
        const widgetStore = WidgetsStore.Instance;
        const catalogStore = CatalogStore.Instance;
        const catalogWidgetMap = catalogStore.catalogPlots.get(this.componentId);
        const plotWidgetStoreId = catalogWidgetMap.get(fileId);
        if (plotWidgetStoreId) {
            const plotWidgetStore = widgetStore.catalogPlotWidgets.get(plotWidgetStoreId);
            const profileStore = catalogStore.catalogProfileStores.get(this.catalogFileId);
            const xColumn = plotWidgetStore.xColumnName === CatalogPlotComponent.emptyColumn;
            const yColumn = plotWidgetStore.yColumnName === CatalogPlotComponent.emptyColumn;
            switch (plotWidgetStore.plotType) {
                case CatalogPlotType.D2Scatter:
                    if (!xColumn && !yColumn && plotWidgetStore.scatterborder === undefined) {
                        const scatterCoords = profileStore.get2DPlotData(plotWidgetStore.xColumnName, plotWidgetStore.yColumnName, profileStore.catalogData);
                        const scatterBorder = this.getScatterBorder(scatterCoords.wcsX, scatterCoords.wcsY);
                        plotWidgetStore.setScatterborder(scatterBorder);
                    }
                    break;
                case CatalogPlotType.Histogram:
                    if (!xColumn && plotWidgetStore.histogramBorder === undefined) {
                        const histogramCoords = profileStore.get1DPlotData(plotWidgetStore.xColumnName);
                        const histogramXBorder = this.getHistogramXBorder(histogramCoords.wcsData);
                        plotWidgetStore.setHistogramXBorder(histogramXBorder);
                    }
                    break;
                default:
                    break;
            }
        } else {
            this.addNewWidgetStore();
        }
    };

    private addNewWidgetStore = () => {
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
                catalogStore.setCatalogPlots(this.componentId, this.catalogFileId, scatterPlotId);
                return scatterPlotId;
            case CatalogPlotType.Histogram:
                const historgramProps: CatalogPlotWidgetStoreProps = {
                    xColumnName: CatalogPlotComponent.emptyColumn,
                    plotType: this.plotType
                };
                const histogramPlotId = appStore.widgetsStore.addCatalogPlotWidget(historgramProps);
                catalogStore.setCatalogPlots(this.componentId, this.catalogFileId, histogramPlotId);
                return histogramPlotId;
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

    @computed get initScatterBorder(): Border {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        const coords = profileStore.get2DPlotData(widgetStore.xColumnName, widgetStore.yColumnName, profileStore.catalogData);
        return this.getScatterBorder(coords.wcsX, coords.wcsY);
    }

    @computed get initHistogramXBorder(): XBorder {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        const coords = profileStore.get1DPlotData(widgetStore.xColumnName);
        return this.getHistogramXBorder(coords.wcsData);
    }

    @computed get scatterData() {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        const coords = profileStore.get2DPlotData(widgetStore.xColumnName, widgetStore.yColumnName, profileStore.catalogData);
        let scatterDatasets: Plotly.Data[] = [];
        let data: Partial<Plotly.PlotData> = {};
        data.type = "scattergl";
        data.mode = "markers";
        data.marker = {
            symbol: "circle",
            color: Colors.BLUE2,
            opacity: 1
        };
        data.hoverinfo = "none";
        data.x = coords.wcsX?.slice(0);
        data.y = coords.wcsY?.slice(0);
        scatterDatasets.push(data);

        const border = this.getScatterBorder(coords.wcsX, coords.wcsY);
        return {data: scatterDatasets, border: border};
    }

    @computed get histogramData() {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        const coords = profileStore.get1DPlotData(widgetStore.xColumnName);
        let histogramDatasets: Plotly.Data[] = [];
        let data: Partial<Plotly.PlotData> = {};
        const xRange = this.getHistogramXBorder(coords.wcsData);
        // increase x range to include border data
        const fraction = 1.001;
        const start = xRange.xMin;
        const nBinx = widgetStore.nBinx ? widgetStore.nBinx : this.numBinsX;
        const end = start + (xRange.xMax - xRange.xMin) * fraction;
        const size = (end - start) / nBinx;
        data.type = "histogram";
        data.hoverinfo = "none";
        data.x = coords.wcsData?.slice(0);
        data.marker = {
            color: Colors.BLUE2
        };
        data.xbins = {
            start: start,
            size: size,
            end: end
        };
        histogramDatasets.push(data);
        return {data: histogramDatasets, border: xRange};
    }

    @computed get enablePlotButton(): boolean {
        const emptyColumn = CatalogPlotComponent.emptyColumn;
        const profileStore = this.profileStore;
        const widgetStore = this.widgetStore;
        if (widgetStore?.plotType === CatalogPlotType.Histogram) {
            return widgetStore.xColumnName !== emptyColumn && !profileStore.loadingData && !profileStore.updatingDataStream;
        } else if (widgetStore?.plotType === CatalogPlotType.D2Scatter) {
            return widgetStore.xColumnName !== emptyColumn && widgetStore.yColumnName !== emptyColumn && !profileStore.loadingData && !profileStore.updatingDataStream;
        } else {
            return false;
        }
    }

    @computed get genProfilerInfo(): string[] {
        let profileInfo: string[] = [];
        const widgetStore = this.widgetStore;
        const indicatorInfo = widgetStore.indicatorInfo;
        if (indicatorInfo) {
            if (widgetStore.plotType === CatalogPlotType.D2Scatter) {
                profileInfo.push(`${widgetStore.xColumnName}: ${indicatorInfo.x}, ${widgetStore.yColumnName}: ${indicatorInfo.y}`);
            } else if (widgetStore.plotType === CatalogPlotType.Histogram) {
                profileInfo.push(`${widgetStore.xColumnName}: ${indicatorInfo.x}, Count: ${indicatorInfo.y}`);
            }
        }
        return profileInfo;
    }

    @computed get numBinsX(): number {
        const widgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        const coords = profileStore.get1DPlotData(widgetStore.xColumnName);
        const nBinx = Math.ceil(Math.sqrt(coords.wcsData?.length));
        return nBinx;
    }

    private handleColumnNameChange = (type: string, column: string) => {
        const widgetsStore = this.widgetStore;
        if (type === "x") {
            widgetsStore.setColumnX(column);
        } else if (type === "y") {
            widgetsStore.setColumnY(column);
        }
        if (widgetsStore.plotType === CatalogPlotType.D2Scatter) {
            if (widgetsStore.xColumnName === CatalogPlotComponent.emptyColumn || widgetsStore.yColumnName === CatalogPlotComponent.emptyColumn) {
                return;
            }
            widgetsStore.setScatterborder(this.initScatterBorder);
        } else if (widgetsStore.plotType === CatalogPlotType.Histogram) {
            if (column === CatalogPlotComponent.emptyColumn) {
                return;
            }
            widgetsStore.setHistogramXBorder(this.initHistogramXBorder);
        }
    };

    private handleShowSelectedDataChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        const widgetsStore = this.widgetStore;
        const catalogWidgetStore = this.catalogWidgetStore;
        const val = changeEvent.target.checked;
        if (widgetsStore && catalogWidgetStore) {
            catalogWidgetStore.setShowSelectedData(val);
        }
    };

    private handleLogScaleYChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        const val = changeEvent.target.checked;
        this.widgetStore.setLogScaleY(val);
    };

    private onHover = (event: Plotly.PlotMouseEvent) => {
        const widgetStore = this.widgetStore;
        const points = event.points;
        if (points.length && widgetStore) {
            const point = points[0];
            widgetStore.setIndicator({x: point.x as number, y: point.y as number});
        }
    };

    private onDoubleClick = () => {
        const widgetsStore = this.widgetStore;
        if (widgetsStore.plotType === CatalogPlotType.D2Scatter) {
            widgetsStore.setScatterborder(this.initScatterBorder);
        } else {
            widgetsStore.setHistogramXBorder(this.initHistogramXBorder);
        }
    };

    private onRelayout = (event: any) => {
        const widgetStore = this.widgetStore;
        if (widgetStore) {
            if (event.dragmode) {
                widgetStore.setDragmode(event.dragmode);
            }
            if (widgetStore.plotType === CatalogPlotType.D2Scatter) {
                const xMin = event["xaxis.range[0]"];
                const xMax = event["xaxis.range[1]"];
                const yMin = event["yaxis.range[0]"];
                const yMax = event["yaxis.range[1]"];
                if (isFinite(xMin) || isFinite(yMin)) {
                    const scatterBorder: Border = {
                        xMin: isFinite(xMin) ? xMin : widgetStore.scatterborder.xMin,
                        xMax: isFinite(xMax) ? xMax : widgetStore.scatterborder.xMax,
                        yMin: isFinite(yMin) ? yMin : widgetStore.scatterborder.yMin,
                        yMax: isFinite(yMax) ? yMax : widgetStore.scatterborder.yMax
                    };
                    widgetStore.setScatterborder(scatterBorder);
                }

                if (event["xaxis.autorange"] && event["yaxis.autorange"]) {
                    widgetStore.setScatterborder(this.initScatterBorder);
                }
            }
            if (widgetStore.plotType === CatalogPlotType.Histogram) {
                const xMin = event["xaxis.range[0]"];
                const xMax = event["xaxis.range[1]"];
                if (isFinite(xMin) || isFinite(xMax)) {
                    const histogramBorder: XBorder = {
                        xMin: isFinite(xMin) ? xMin : widgetStore.histogramBorder.xMin,
                        xMax: isFinite(xMax) ? xMax : widgetStore.histogramBorder.xMax
                    };
                    this.widgetStore.setHistogramXBorder(histogramBorder);
                }

                if (event["xaxis.autorange"]) {
                    widgetStore.setHistogramXBorder(this.initHistogramXBorder);
                }
            }
        }
    };

    private handlePlotClick = () => {
        const appStore = AppStore.Instance;
        const profileStore = this.profileStore;
        if (profileStore?.shouldUpdateData) {
            profileStore.setUpdateMode(CatalogUpdateMode.PlotsUpdate);
            profileStore.setUpdatingDataStream(true);
            let catalogFilter = profileStore.updateRequestDataSize;
            appStore.sendCatalogFilter(catalogFilter);
        }
    };

    // region selection
    private onLassoSelected = (event: Plotly.PlotSelectionEvent) => {
        if (event && event.points && event.points.length > 0) {
            const catalogStore = CatalogStore.Instance;
            const profileStore = this.profileStore;
            const catalogFileId = profileStore.catalogInfo.fileId;
            const catalogWidgetStore = this.catalogWidgetStore;
            catalogStore.updateCatalogProfiles(catalogFileId);

            let selectedPointIndices;
            if (this.widgetStore.plotType === CatalogPlotType.D2Scatter) {
                const points = event.points;
                selectedPointIndices = Array(points.length);
                for (let index = 0; index < points.length; index++) {
                    selectedPointIndices[index] = points[index].pointIndex;
                }
            } else if (this.widgetStore.plotType === CatalogPlotType.Histogram) {
                const points = event.points as any;
                let arraySize = 0;
                for (let i = 0; i < points.length; i++) {
                    const count = points[i].pointIndices.length;
                    arraySize = arraySize + count;
                }
                selectedPointIndices = Array(arraySize);
                for (let i = 0; i < points.length; i++) {
                    const selectedPoints = points[i].pointIndices;
                    const size = selectedPoints.length;
                    for (let j = 0; j < size; j++) {
                        selectedPointIndices[i * size + j] = selectedPoints[j];
                    }
                }
            }

            if (selectedPointIndices?.length) {
                profileStore.setSelectedPointIndices(selectedPointIndices, true);
                catalogWidgetStore.setCatalogTableAutoScroll(true);
            }
        }
    };

    private onDeselect = () => {
        const catalogStore = CatalogStore.Instance;
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.catalogWidgetStore;
        catalogStore.updateCatalogProfiles(this.catalogFileId);
        profileStore.setSelectedPointIndices([], false);
        catalogWidgetStore.setCatalogTableAutoScroll(false);
        catalogWidgetStore.setShowSelectedData(false);
    };

    // Single source selected
    private onSingleSourceClick = (event: Readonly<Plotly.PlotMouseEvent>) => {
        const selectionMode: DragMode[] = ["select", "lasso"];
        const inDragmode = selectionMode.includes(this.widgetStore.dragmode);
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.catalogWidgetStore;
        if (event?.points?.length > 0 && inDragmode) {
            const catalogStore = CatalogStore.Instance;
            const catalogFileId = profileStore.catalogInfo.fileId;
            catalogStore.updateCatalogProfiles(catalogFileId);
            let selectedPointIndex = [];
            const selectedPoint = event.points[0] as any;
            if (this.widgetStore.plotType === CatalogPlotType.D2Scatter) {
                selectedPointIndex.push(selectedPoint.pointIndex);
            } else if (this.widgetStore.plotType === CatalogPlotType.Histogram && selectedPoint.pointIndices.length) {
                selectedPointIndex = selectedPoint.pointIndices;
            }

            profileStore.setSelectedPointIndices(selectedPointIndex, true);
            catalogWidgetStore.setCatalogTableAutoScroll(true);
        }
    };

    private renderColumnNamePopOver = (column: string, itemProps: IItemRendererProps) => {
        return <MenuItem key={column} text={column} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private filterColumn: ItemPredicate<string> = (query: string, columnName: string) => {
        const fileSearcher = new FuzzySearch([columnName]);
        return fileSearcher.search(query).length > 0;
    };

    private updateHistogramYrange = (figure: any, graphDiv: any) => {
        // fixed react plotlyjs bug with fixed range and changed x range
        if (this.widgetStore.plotType === CatalogPlotType.Histogram) {
            const yaxis = figure.layout.yaxis.range;
            this.histogramY = {yMin: yaxis[0], yMax: yaxis[1]};
        }
    };

    private onNumBinChange = (val: number) => {
        this.widgetStore.setNumBinsX(val);
        this.onDeselect();
    };

    private renderFilePopOver = (fileId: number, itemProps: IItemRendererProps) => {
        const fileName = this.catalogFileNames.get(fileId);
        let text = `${fileId}: ${fileName}`;
        return <MenuItem key={fileId} text={text} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    public render() {
        const profileStore = this.profileStore;
        const widgetStore = this.widgetStore;
        const catalogWidgetStore = this.catalogWidgetStore;
        const catalogFileIds = CatalogStore.Instance.activeCatalogFiles;
        const scale = 1 / devicePixelRatio;
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
        const ratio = isScatterPlot ? devicePixelRatio : 1;
        const fontFamily = "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
        let themeColor = Colors.LIGHT_GRAY5;
        let lableColor = Colors.GRAY1;
        let gridColor = Colors.LIGHT_GRAY1;
        let markerColor = Colors.GRAY2;
        let spikeLineClass = "catalog-plotly";
        let catalogScatterClass = "catalog-scatter";

        let catalogFileItems = [];
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
                    className="bp3-fill"
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
                    className="bp3-fill"
                    items={xyOptions}
                    activeItem={widgetStore.xColumnName}
                    onItemSelect={item => this.handleColumnNameChange("x", item)}
                    itemRenderer={this.renderColumnNamePopOver}
                    popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                    filterable={true}
                    noResults={noResults}
                    itemPredicate={this.filterColumn}
                    resetOnSelect={true}
                >
                    <Button text={widgetStore.xColumnName} rightIcon="double-caret-vertical" />
                </Select>
            </FormGroup>
        );

        const renderHistogramLog = (
            <FormGroup label={"Log Scale"} inline={true} disabled={disabled}>
                <Switch checked={widgetStore.logScaleY} onChange={this.handleLogScaleYChanged} disabled={disabled} />
            </FormGroup>
        );

        const renderYSelect = (
            <FormGroup inline={true} label="Y">
                <Select
                    className="bp3-fill"
                    items={xyOptions}
                    activeItem={widgetStore.yColumnName}
                    onItemSelect={item => this.handleColumnNameChange("y", item)}
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

        if (widgetStore.xColumnName === CatalogPlotComponent.emptyColumn || widgetStore.yColumnName === CatalogPlotComponent.emptyColumn) {
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

        if (AppStore.Instance.darkTheme) {
            gridColor = Colors.DARK_GRAY5;
            lableColor = Colors.LIGHT_GRAY5;
            themeColor = Colors.DARK_GRAY3;
            markerColor = Colors.GRAY4;
            spikeLineClass = "catalog-plotly-dark";
        }

        let layout: Partial<Plotly.Layout> = {
            width: this.width * ratio,
            height: (this.height - 85) * ratio,
            paper_bgcolor: themeColor,
            plot_bgcolor: themeColor,
            hovermode: "closest",
            xaxis: {
                title: widgetStore.xColumnName,
                titlefont: {
                    family: fontFamily,
                    size: 12 * ratio,
                    color: lableColor
                },
                showticklabels: true,
                tickfont: {
                    family: fontFamily,
                    size: 12 * ratio,
                    color: lableColor
                },
                tickcolor: gridColor,
                gridcolor: gridColor,
                zerolinecolor: gridColor,
                zerolinewidth: 2 * ratio,
                // box boreder
                mirror: true,
                linecolor: gridColor,
                showline: true,
                // indicator
                spikemode: "across",
                spikedash: "solid",
                spikecolor: markerColor,
                spikethickness: 1 * ratio,
                // d3 format
                tickformat: ".2e"
            },
            yaxis: {
                titlefont: {
                    family: fontFamily,
                    size: 12 * ratio,
                    color: lableColor
                },
                showticklabels: true,
                tickfont: {
                    family: fontFamily,
                    size: 12 * ratio,
                    color: lableColor
                },
                tickcolor: gridColor,
                gridcolor: gridColor,
                zerolinecolor: gridColor,
                zerolinewidth: 2 * ratio,
                mirror: true,
                linecolor: gridColor,
                showline: true,
                spikemode: "across",
                spikedash: "solid",
                spikecolor: markerColor,
                spikethickness: 1 * ratio
            },
            margin: {
                t: 5 * ratio,
                b: 40 * ratio,
                l: 80 * ratio,
                r: 5 * ratio,
                pad: 0
            },
            showlegend: false,
            dragmode: widgetStore.dragmode
        };

        let data;
        if (widgetStore.plotType === CatalogPlotType.D2Scatter) {
            data = this.scatterData.data;
            data[0].marker.size = 5 * ratio;
            let border;
            if (widgetStore.isScatterAutoScaled) {
                border = this.scatterData.border;
            } else {
                border = widgetStore.scatterborder;
            }
            layout.xaxis.range = [border.xMin, border.xMax];
            layout.yaxis.range = [border.yMin, border.yMax];
            layout.yaxis.title = widgetStore.yColumnName;
            layout.yaxis.tickformat = ".2e";
        } else {
            data = this.histogramData.data;
            let border;
            if (widgetStore.isHistogramAutoScaledX) {
                border = this.histogramData.border;
            } else {
                border = widgetStore.histogramBorder;
            }
            layout.xaxis.range = [border.xMin, border.xMax];
            layout.yaxis.range = [this.histogramY?.yMin, this.histogramY?.yMax];
            layout.yaxis.fixedrange = true;
            // autorange will trigger y axis range change
            layout.yaxis.autorange = true;
            layout.yaxis.rangemode = "tozero";
            layout.yaxis.title = "Count";
            if (widgetStore.logScaleY) {
                layout.yaxis.type = "log";
            }
        }

        const selectedPointIndices = profileStore.selectedPointIndices;
        let scatterDataMarker = data[0].marker;
        if (selectedPointIndices.length > 0) {
            data[0]["selectedpoints"] = selectedPointIndices;
            data[0]["selected"] = {marker: {color: Colors.RED2}};
            data[0]["unselected"] = {marker: {opacity: 0.5}};
        } else {
            data[0]["selectedpoints"] = [];
            scatterDataMarker.color = Colors.BLUE2;
            data[0]["unselected"] = {marker: {opacity: 1}};
        }

        const config: Partial<Plotly.Config> = {
            displaylogo: false,
            scrollZoom: true,
            showTips: false,
            doubleClick: false,
            showAxisDragHandles: false,
            modeBarButtonsToRemove: ["zoomIn2d", "zoomOut2d", "resetScale2d", "toggleSpikelines", "hoverClosestCartesian", "hoverCompareCartesian"]
        };

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
            />
        );

        return (
            <div className={"catalog-plot"}>
                <div className={"catalog-plot-option"}>
                    {renderFileSelect}
                    {renderXSelect}
                    {isHistogramPlot && renderHistogramBins}
                    {isHistogramPlot && renderHistogramLog}
                    {isScatterPlot && renderYSelect}
                </div>
                <div className={`${spikeLineClass} ${isScatterPlot && devicePixelRatio > 1 ? catalogScatterClass : ""}`}>
                    <Plot
                        data={data}
                        layout={layout}
                        config={config}
                        onHover={this.onHover}
                        onDoubleClick={this.onDoubleClick}
                        onRelayout={this.onRelayout}
                        onSelected={this.onLassoSelected}
                        onDeselect={this.onDeselect}
                        onClick={this.onSingleSourceClick}
                        onInitialized={this.updateHistogramYrange}
                        onUpdate={this.updateHistogramYrange}
                        style={{transform: isScatterPlot ? `scale(${scale})` : "scale(1)", transformOrigin: "top left"}}
                    />
                </div>
                <div className="bp3-dialog-footer">
                    <div className="scatter-info">
                        <ProfilerInfoComponent info={this.genProfilerInfo} />
                    </div>
                    <div className="bp3-dialog-footer-actions">
                        <Tooltip2 content={"Show only selected sources at image and table viewer"}>
                            <FormGroup label={"Selected only"} inline={true} disabled={disabled}>
                                <Switch checked={catalogWidgetStore.showSelectedData} onChange={this.handleShowSelectedDataChanged} disabled={disabled} />
                            </FormGroup>
                        </Tooltip2>
                        <AnchorButton intent={Intent.PRIMARY} text="Plot" onClick={this.handlePlotClick} disabled={disabled || !profileStore.isFileBasedCatalog} />
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}></ReactResizeDetector>
            </div>
        );
    }
}
