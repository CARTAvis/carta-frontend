import * as React from "react";
import * as _ from "lodash";
import * as Plotly from "plotly.js";
import Plot from "react-plotly.js";
import {autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, AnchorButton, Intent, Tooltip, Switch, Button, MenuItem, PopoverPosition} from "@blueprintjs/core";
import {Select, IItemRendererProps} from "@blueprintjs/select";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {WidgetConfig, WidgetProps, HelpType, AppStore, WidgetsStore, CatalogStore} from "stores";
import {CatalogSubplotWidgetStore, Border, CatalogUpdateMode, DragMode, CatalogPlotType, XBorder} from "stores/widgets";
import {ProfilerInfoComponent, ClearableNumericInputComponent} from "components/Shared";
import {Colors} from "@blueprintjs/core";
import {toFixed} from "utilities";
import "./CatalogSubplotComponent.css";

@observer
export class CatalogSubplotComponent extends React.Component<WidgetProps> {
    @observable width: number;
    @observable height: number;
    private histogramY: {yMin: number, yMax: number};

    private static readonly UnsupportedDataTypes = [CARTA.ColumnType.String, CARTA.ColumnType.Bool, CARTA.ColumnType.UnsupportedType];

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "catalog-scatter",
            type: "catalog-scatter",
            minWidth: 320,
            minHeight: 400,
            defaultWidth: 600,
            defaultHeight: 350,
            title: "Catalog Scatter",
            isCloseable: true,
            helpType: HelpType.CATALOG_SCATTER
        };
    }

    constructor(props: WidgetProps) {
        super(props);
        this.histogramY = {yMin: undefined, yMax: undefined};
        autorun(() => {
            if (this.widgetStore && this.widgetStore.catalogOverlayWidgetStore) {
                let progressString = "";
                const catalogFile = this.widgetStore.catalogOverlayWidgetStore.catalogInfo;
                const fileName = catalogFile.fileInfo.name || "";
                const appStore = AppStore.Instance;
                const frame = appStore.activeFrame;
                const progress = this.widgetStore.catalogOverlayWidgetStore.progress;
                if (progress && isFinite(progress) && progress < 1) {
                    progressString = `[${toFixed(progress * 100)}% complete]`;
                }
                if (frame) {
                    const catalogFileId = catalogFile.fileId || "";
                    WidgetsStore.Instance.setWidgetTitle(this.props.id, `Catalog ${fileName} : ${catalogFileId} ${progressString}`);
                }
            } else {
                WidgetsStore.Instance.setWidgetTitle(this.props.id, `Catalog : Cursor`);
            }
        });
    }

    onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    @computed get widgetStore(): CatalogSubplotWidgetStore {
        const widgetStore = WidgetsStore.Instance.catalogSubplotWidgets.get(this.props.id);
        return widgetStore;
    }

    @computed get scatterData() {
        const widgetStore = this.widgetStore;
        let scatterDatasets: Plotly.Data[] = [];
        let data: Plotly.Data = {};
        data.type = "scattergl";
        data.mode = "markers";
        data.marker = {
            symbol: "circle", 
            color: Colors.BLUE2,
            size: 5,
            opacity: 1
        };
        data.hoverinfo = "none";
        data.x = widgetStore.xDataset;
        data.y = widgetStore.yDataset;
        scatterDatasets.push(data);
        return scatterDatasets;
    }

    @computed get histogramData() {
        const widgetStore = this.widgetStore;
        let histogramDatasets: Plotly.Data[] = [];
        let data: Plotly.Data = {};
        const xRange = widgetStore.initHistogramXBorder;
        // increase x max to include border data
        const fraction = 1.0001;
        const binWidth = (xRange.xMax * fraction - xRange.xMin) / widgetStore.nBinx;
        data.type = "histogram";
        data.hoverinfo = "none";
        data.x = widgetStore.xDataset;
        data.marker = {
            color: Colors.BLUE2
        };
        data.xbins = {
            start: xRange.xMin,
            size: binWidth,
            end: xRange.xMax * fraction
        };
        histogramDatasets.push(data);
        return histogramDatasets;
    }

    private handleColumnNameChange = (type: string, column: string) => {
        if (type === "x") {
            this.widgetStore.setColumnX(column);
        } else if (type === "y") {
            this.widgetStore.setColumnY(column);
        }
        if (this.widgetStore.plotType === CatalogPlotType.D2Scatter) {
            this.widgetStore.setScatterborder(this.widgetStore.initScatterBorder);   
        }
        if (this.widgetStore.plotType === CatalogPlotType.Histogram) {
            this.widgetStore.setHistogramXBorder(this.widgetStore.initHistogramXBorder);   
        }
    }

    private handleShowSelectedDataChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        const val = changeEvent.target.checked;
        this.widgetStore.catalogOverlayWidgetStore.setShowSelectedData(val);
        const storeId = this.widgetStore.catalogOverlayWidgetStore.storeId;
        CatalogStore.Instance.updateShowSelectedData(storeId, val);
    }

    private handleLogScaleYChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        const val = changeEvent.target.checked;
        this.widgetStore.setLogScaleY(val);
    }

    private onHover = (event: Plotly.PlotMouseEvent) => {
        const widgetStore = this.widgetStore;        
        const points = event.points;
        if (points.length && widgetStore) {
            const point = points[0];
            widgetStore.setIndicator({x: point.x as number, y: point.y as number});
        }
    }

    @computed get genProfilerInfo(): string[] {
        let profilerInfo: string[] = [];
        const widgetStore = this.widgetStore;
        const column = widgetStore.columnsName;
        const indicatorInfo = widgetStore.indicatorInfo;
        if (indicatorInfo) {
            if (widgetStore.plotType === CatalogPlotType.D2Scatter) {
                profilerInfo.push(column.x + ": " + indicatorInfo.x + ", " + column.y + ": " + indicatorInfo.y);      
            } 
            if (widgetStore.plotType === CatalogPlotType.Histogram) {
                profilerInfo.push(column.x + ": " + indicatorInfo.x + ", " + "Count: " + indicatorInfo.y);
            }
        }
        return profilerInfo;
    }

    private onDoubleClick = () => {
        const widgetsStore = this.widgetStore;
        if (widgetsStore.plotType === CatalogPlotType.D2Scatter) {
            widgetsStore.setScatterborder(widgetsStore.initScatterBorder);
        } else {
            widgetsStore.setHistogramXBorder(widgetsStore.initHistogramXBorder);
        }    
    }

    private onRelayout = (event: any) => {
        const widgetStore = this.widgetStore;
        if (widgetStore) {
            if (event.dragmode) {
                widgetStore.setDragmode(event.dragmode);
            }
            if (widgetStore.plotType === CatalogPlotType.D2Scatter) {
                if (isFinite(event["xaxis.range[0]"]) || isFinite(event["yaxis.range[0]"])) {
                    const scatterBorder: Border = {
                        xMin: isFinite(event["xaxis.range[0]"]) ? event["xaxis.range[0]"] : widgetStore.scatterborder.xMin,
                        xMax: isFinite(event["xaxis.range[1]"]) ? event["xaxis.range[1]"] : widgetStore.scatterborder.xMax,
                        yMin: isFinite(event["yaxis.range[0]"]) ? event["yaxis.range[0]"] : widgetStore.scatterborder.yMin,
                        yMax: isFinite(event["yaxis.range[1]"]) ? event["yaxis.range[1]"] : widgetStore.scatterborder.yMax
                    };
                    widgetStore.setScatterborder(scatterBorder);   
                }

                if (event["xaxis.autorange"] && event["yaxis.autorange"]) {
                    widgetStore.setScatterborder(widgetStore.initScatterBorder);
                }
            } 
            if (widgetStore.plotType === CatalogPlotType.Histogram) {
                if (isFinite(event["xaxis.range[0]"]) || isFinite(event["yaxis.range[0]"])) {
                    const histogramBorder: XBorder = {
                        xMin: isFinite(event["xaxis.range[0]"]) ? event["xaxis.range[0]"] : widgetStore.histogramBorder.xMin,
                        xMax: isFinite(event["xaxis.range[1]"]) ? event["xaxis.range[1]"] : widgetStore.histogramBorder.xMax,
                    };
                    this.widgetStore.setHistogramXBorder(histogramBorder);   
                }

                if (event["xaxis.autorange"]) {
                    widgetStore.setHistogramXBorder(widgetStore.initHistogramXBorder);
                }
            }
        }
    }

    private handlePlotClick = () => {
        const catalogOverlayWidgetStore = this.widgetStore.catalogOverlayWidgetStore;
        const appStore = AppStore.Instance;

        if (catalogOverlayWidgetStore.shouldUpdateData) {
            catalogOverlayWidgetStore.setUpdateMode(CatalogUpdateMode.PlotsUpdate);
            catalogOverlayWidgetStore.setUpdatingDataStream(true);   
            let catalogFilter = catalogOverlayWidgetStore.updateRequestDataSize;
            appStore.sendCatalogFilter(catalogFilter);
        }
    }

    // region selection
    private onLassoSelected = (event: Plotly.PlotSelectionEvent) => {
        if (event && event.points && event.points.length > 0) {
            const catalogFileId = this.widgetStore.catalogOverlayWidgetStore.catalogInfo.fileId;
            AppStore.Instance.updateCatalogProfiles(catalogFileId);
            let selectedPointIndices = [];
            const points = event.points as any;
            for (let index = 0; index < points.length; index++) {
                const selectedPoint = points[index];
                if (this.widgetStore.plotType === CatalogPlotType.D2Scatter) {
                    selectedPointIndices.push(selectedPoint.pointIndex);   
                }
    
                if (this.widgetStore.plotType === CatalogPlotType.Histogram) {
                    for (let i = 0; i < selectedPoint.pointIndices.length; i++) {
                        selectedPointIndices.push(selectedPoint.pointIndices[i]);   
                    }
                }

            }
            this.widgetStore.catalogOverlayWidgetStore.setSelectedPointIndices(selectedPointIndices, true, true);
        }
    }

    private onDeselect = () => {
        const catalogFileId = this.widgetStore.catalogOverlayWidgetStore.catalogInfo.fileId;
        AppStore.Instance.updateCatalogProfiles(catalogFileId);
        const catalogStore = CatalogStore.Instance;
        this.widgetStore.catalogOverlayWidgetStore.setSelectedPointIndices([], false, false);
        const storeId = this.widgetStore.catalogOverlayWidgetStore.storeId;
        this.widgetStore.catalogOverlayWidgetStore.setShowSelectedData(false);
        catalogStore.updateShowSelectedData(storeId, false);
    }

    // Single source selected
    private onSingleSourceClick = (event: Readonly<Plotly.PlotMouseEvent>) => {
        const selectionMode: DragMode[] = ["select", "lasso"];
        const inDragmode = selectionMode.includes(this.widgetStore.dragmode);
        if (event?.points?.length > 0 && inDragmode) {
            const catalogFileId = this.widgetStore.catalogOverlayWidgetStore.catalogInfo.fileId;
            AppStore.Instance.updateCatalogProfiles(catalogFileId);
            let selectedPointIndex = [];
            const selectedPoint = event.points[0] as any;
            if (this.widgetStore.plotType === CatalogPlotType.D2Scatter) {
                selectedPointIndex.push(selectedPoint.pointIndex);   
            }

            if (this.widgetStore.plotType === CatalogPlotType.Histogram && selectedPoint.pointIndices.length) {
                selectedPointIndex = selectedPoint.pointIndices;
            }
            
            this.widgetStore.catalogOverlayWidgetStore.setSelectedPointIndices(selectedPointIndex, true, true);
        }
    }

    private renderSystemPopOver = (column: string, itemProps: IItemRendererProps) => {
        return (
            <MenuItem
                key={column}
                text={column}
                onClick={itemProps.handleClick}
                active={itemProps.modifiers.active}
            />
        );
    }

    private updateHistogramYrange = (figure: any, graphDiv: any) => {
        // fixed react plotlyjs bug with fixed range and changed x range 
        if (this.widgetStore.plotType === CatalogPlotType.Histogram) {
            const yaxis = figure.layout.yaxis.range;
            this.histogramY = {yMin: yaxis[0], yMax: yaxis[1]}; 
        }

    }

    private onBinWidthChange = (val: number) => {
        const widgetStore = this.widgetStore;
        let bins = val; 
        if (!Number.isInteger(val)) {
            bins = Math.round(val);
        }
        if (widgetStore && bins > 0) {
            widgetStore.setnBinx(bins);
        } else if (widgetStore && bins === 0) {
            widgetStore.setnBinx(1);
        } else {
            widgetStore.setnBinx(widgetStore.initnBinx);
        }
    }

    public render() {
        const widgetStore = this.widgetStore;
        const columnsName = widgetStore.catalogOverlayWidgetStore.displayedColumnHeaders;
        const xyOptions = [];
        const fontFamily = "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
        let themeColor = Colors.LIGHT_GRAY5;
        let lableColor = Colors.GRAY1;
        let gridColor = Colors.LIGHT_GRAY1;
        let markerColor = Colors.GRAY2;
        let spikeLineClass = "catalog-subplot"; 
        
        for (let index = 0; index < columnsName.length; index++) {
            const column = columnsName[index];
            if (!CatalogSubplotComponent.UnsupportedDataTypes.includes(column.dataType)) {
                xyOptions.push(column.name); 
            }
        }

        if (AppStore.Instance.darkTheme) {
            gridColor = Colors.DARK_GRAY5;
            lableColor = Colors.LIGHT_GRAY5;
            themeColor = Colors.DARK_GRAY3;
            markerColor = Colors.GRAY4;
            spikeLineClass = "catalog-subplot-dark";
        }

        let layout: Partial<Plotly.Layout> = {
            width: this.width, 
            height: this.height - 85,
            paper_bgcolor: themeColor, 
            plot_bgcolor: themeColor,
            hovermode: "closest" ,
            xaxis: {
                title: widgetStore.columnsName.x,
                titlefont: {
                    family: fontFamily,
                    size: 12,
                    color: lableColor
                },
                showticklabels: true,
                tickfont: {
                    family: fontFamily,
                    size: 12,
                    color: lableColor
                },
                tickcolor: gridColor,
                gridcolor: gridColor,
                zerolinecolor: gridColor,
                zerolinewidth: 2,
                // box boreder
                mirror: true,
                linecolor: gridColor,
                showline: true,
                // indicator 
                spikemode: "across",
                spikedash: "solid",
                spikecolor: markerColor,
                spikethickness: 1,
                // d3 format
                tickformat: ".2e",
            },
            yaxis: {
                titlefont: {
                    family: fontFamily,
                    size: 12,
                    color: lableColor
                },
                showticklabels: true,
                tickfont: {
                    family: fontFamily,
                    size: 12,
                    color: lableColor
                },
                tickcolor: gridColor,
                gridcolor: gridColor,
                zerolinecolor: gridColor,
                zerolinewidth: 2,
                mirror: true,
                linecolor: gridColor,
                showline: true,
                spikemode: "across",
                spikedash: "solid",
                spikecolor: markerColor,
                spikethickness: 1,
            },
            margin: {
                t: 5,
                b: 40,
                l: 80,
                r: 5,
                pad: 0
            },
            showlegend: false,
            dragmode: widgetStore.dragmode,
        };
        
        let data;
        if (widgetStore.plotType === CatalogPlotType.D2Scatter) {
            data = this.scatterData;
            const border = widgetStore.scatterborder;
            layout.xaxis.range = [border.xMin, border.xMax];
            layout.yaxis.range = [border.yMin, border.yMax];
            layout.yaxis.title = widgetStore.columnsName.y;
            layout.yaxis.tickformat = ".2e";
            layout["hoverdistance"] = 5;
        } else {
            data = this.histogramData;
            const border = widgetStore.histogramBorder;
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

        const selectedPointIndices = widgetStore.catalogOverlayWidgetStore.selectedPointIndices;
        let scatterDataMarker = data[0].marker;
        if (selectedPointIndices.length > 0) {
            data[0]["selectedpoints"] = selectedPointIndices;
            data[0]["selected"] = {"marker": {"color": Colors.RED2}};
            data[0]["unselected"] = {"marker": {"opacity": 0.5}};
        } else {
            data[0]["selectedpoints"] = [];
            scatterDataMarker.color = Colors.BLUE2;
            data[0]["unselected"] = {"marker": {"opacity": 1}};
        }

        const config: Partial<Plotly.Config> = {
            displaylogo: false,
            scrollZoom: true,
            showTips: false,
            doubleClick: false,
            showAxisDragHandles: false,
            modeBarButtonsToRemove: [
                "zoomIn2d",
                "zoomOut2d",
                "resetScale2d",
                "toggleSpikelines",
                "hoverClosestCartesian",
                "hoverCompareCartesian",
            ],
        };
        const disabled = !widgetStore.enablePlotButton;
        const isScatterPlot = widgetStore.plotType === CatalogPlotType.D2Scatter;
        const isHistogramPlot = widgetStore.plotType === CatalogPlotType.Histogram;

        return(
            <div className={"catalog-subplot"}>
                <div className={"catalog-subplot-option"}>
                    <FormGroup inline={true} label="X">
                        <Select 
                            className="bp3-fill"
                            filterable={false}
                            items={xyOptions} 
                            activeItem={widgetStore.columnsName.x}
                            onItemSelect={item => this.handleColumnNameChange("x", item)}
                            itemRenderer={this.renderSystemPopOver}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                        >
                            <Button text={widgetStore.columnsName.x} rightIcon="double-caret-vertical"/>
                        </Select>
                    </FormGroup>
                    {isHistogramPlot &&
                        <ClearableNumericInputComponent
                            className={"catalog-bins"}
                            label="Bins"
                            value={widgetStore.nBinx}
                            onValueChanged={val => this.onBinWidthChange(val)}
                            onValueCleared={() => widgetStore.setnBinx(widgetStore.initnBinx)}
                            displayExponential={false}
                            updateValueOnKeyDown={true}
                            disabled={disabled}
                        />
                    }
                    {isHistogramPlot &&
                        <FormGroup label={"Log Scale"} inline={true} disabled={disabled}>
                            <Switch checked={widgetStore.logScaleY} onChange={this.handleLogScaleYChanged} disabled={disabled}/>
                        </FormGroup>
                    }
                    {isScatterPlot &&
                        <FormGroup inline={true} label="Y">
                            <Select 
                                className="bp3-fill"
                                filterable={false}
                                items={xyOptions} 
                                activeItem={widgetStore.columnsName.y}
                                onItemSelect={item => this.handleColumnNameChange("y", item)}
                                itemRenderer={this.renderSystemPopOver}
                                popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                            >
                                <Button text={widgetStore.columnsName.y} rightIcon="double-caret-vertical"/>
                            </Select>
                        </FormGroup>
                    }
                </div>
                <div className={spikeLineClass}>
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
                    />
                </div>
                <div className="catalog-subplot-footer">
                    <div className="scatter-info">
                        <ProfilerInfoComponent info={this.genProfilerInfo}/>
                    </div>
                    <div className="actions">
                        <FormGroup label={"Show only selected sources"} inline={true} disabled={disabled}>
                            <Switch checked={widgetStore.catalogOverlayWidgetStore.showSelectedData} onChange={this.handleShowSelectedDataChanged} disabled={disabled}/>
                        </FormGroup>
                        <Tooltip className="plot-button" content={"Update all subplots with all data"}>
                            <AnchorButton
                                intent={Intent.PRIMARY}
                                text="Plot All"
                                onClick={this.handlePlotClick}
                                disabled={disabled}
                            />
                        </Tooltip>
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}