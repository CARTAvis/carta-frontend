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
import {CatalogScatterWidgetStore, Border, CatalogUpdateMode, DragMode} from "stores/widgets";
import {ProfilerInfoComponent} from "components/Shared";
import {Colors} from "@blueprintjs/core";
import {toFixed} from "utilities";
import "./CatalogScatterComponent.css";

@observer
export class CatalogScatterComponent extends React.Component<WidgetProps> {
    @observable width: number;
    @observable height: number;

    private readonly DataTypes = [CARTA.EntryType.DOUBLE, CARTA.EntryType.FLOAT, CARTA.EntryType.INT, CARTA.EntryType.LONGLONG];

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

    @computed get widgetStore(): CatalogScatterWidgetStore {
        const widgetStore = WidgetsStore.Instance.catalogScatterWidgets.get(this.props.id);
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

    private handleColumnNameChange = (type: string, column: string) => {
        if (type === "x") {
            this.widgetStore.setColumnX(column);
        } else if (type === "y") {
            this.widgetStore.setColumnY(column);
        }
        this.widgetStore.setBorder(this.widgetStore.initBorder);
    }

    private handleShowSelectedDataChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        const val = changeEvent.target.checked;
        this.widgetStore.catalogOverlayWidgetStore.setShowSelectedData(val);
        const storeId = this.widgetStore.catalogOverlayWidgetStore.storeId;
        CatalogStore.Instance.updateShowSelectedData(storeId, val);
    }

    private onHover = (event: Plotly.PlotMouseEvent) => {
        const points = event.points;
        if (points.length) {
            const point = points[0];
            this.widgetStore.setIndicator({x: point.x as number, y: point.y as number});
            const border: Border = {
                xMin: point.xaxis.range[0],
                xMax: point.xaxis.range[1],
                yMin: point.yaxis.range[0],
                yMax: point.yaxis.range[1]
            };
            this.widgetStore.setBorder(border);   
        }
    }

    private genProfilerInfo = (): string[] => {
        let profilerInfo: string[] = [];
        const widgetStore = this.widgetStore;
        const column = widgetStore.columnsName;
        const indicatorInfo = widgetStore.indicatorInfo;
        if (indicatorInfo) {
            profilerInfo.push(column.x + ": " + indicatorInfo.x + ", " + column.y + ": " + indicatorInfo.y);   
        }
        return profilerInfo;
    }

    private onDoubleClick = () => {
        const border = this.widgetStore.initBorder;
        this.widgetStore.setBorder(border);
    }

    private onRelayout = (event: any) => {
        if (event.dragmode) {
            this.widgetStore.setDragmode(event.dragmode);
        }
    }

    private handlePlotClick = () => {
        const catalogOverlayWidgetStore = this.widgetStore.catalogOverlayWidgetStore;
        const appStore = AppStore.Instance;

        if (catalogOverlayWidgetStore.shouldUpdateData) {
            catalogOverlayWidgetStore.setUpdateMode(CatalogUpdateMode.PlotsUpdate);
            catalogOverlayWidgetStore.setPlotingData(true);   
            let catalogFilter = catalogOverlayWidgetStore.updateRequestDataSize;
            appStore.sendCatalogFilter(catalogFilter);
        }
    }

    // region selection
    private onLassoSelected = (event: Plotly.PlotSelectionEvent) => {
        if (event && event.points && event.points.length > 0) {
            let selectedPointIndexs = [];
            const points = event.points;
            for (let index = 0; index < points.length; index++) {
                const selectedPoint = points[index];
                selectedPointIndexs.push(selectedPoint.pointIndex);
            }
            this.widgetStore.catalogOverlayWidgetStore.setselectedPointIndexs(selectedPointIndexs, true);
            const storeId = this.widgetStore.catalogOverlayWidgetStore.storeId;
            CatalogStore.Instance.updateSelectedPoints(storeId, selectedPointIndexs);
        }
    }

    private onDeselect = () => {
        const catalogStore = CatalogStore.Instance;
        this.widgetStore.catalogOverlayWidgetStore.setselectedPointIndexs([]);
        const storeId = this.widgetStore.catalogOverlayWidgetStore.storeId;
        catalogStore.updateSelectedPoints(storeId, []);
        this.widgetStore.catalogOverlayWidgetStore.setShowSelectedData(false);
        catalogStore.updateShowSelectedData(storeId, false);
    }

    // Single source selected
    private onSingleSourceClick = (event: Readonly<Plotly.PlotMouseEvent>) => {
        const dragmode: DragMode[] = ["select", "lasso"];
        const inDragmode = dragmode.includes(this.widgetStore.dragmode);
        if (event && event.points && event.points.length > 0 && inDragmode) {
            let selectedPointIndex = [];
            const selectedPoint = event.points[0];
            selectedPointIndex.push(selectedPoint.pointIndex);
            this.widgetStore.catalogOverlayWidgetStore.setselectedPointIndexs(selectedPointIndex, true);
            const storeId = this.widgetStore.catalogOverlayWidgetStore.storeId;
            CatalogStore.Instance.updateSelectedPoints(storeId, selectedPointIndex);
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

    public render() {
        const widgetStore = this.widgetStore;
        const columnsName = widgetStore.catalogOverlayWidgetStore.displayedColumnHeaders;
        const xyOptions = [];
        const fontFamily = "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
        let themeColor = Colors.LIGHT_GRAY5;
        let lableColor = Colors.GRAY1;
        let gridColor = Colors.LIGHT_GRAY1;
        let markerColor = Colors.GRAY2;
        let spikeLineClass = "catalog-2D-scatter"; 
        
        for (let index = 0; index < columnsName.length; index++) {
            const column = columnsName[index];
            if (this.DataTypes.indexOf(column.dataType) !== -1) {
                xyOptions.push(column.name); 
            }
        }

        if (AppStore.Instance.darkTheme) {
            gridColor = Colors.DARK_GRAY5;
            lableColor = Colors.LIGHT_GRAY5;
            themeColor = Colors.DARK_GRAY3;
            markerColor = Colors.GRAY4;
            spikeLineClass = "catalog-2D-scatter-dark";
        }

        const border = widgetStore.border;
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
                range: [border.xMin, border.xMax],
                // d3 format
                tickformat: ".2e",
            },
            yaxis: {
                title: widgetStore.columnsName.y,
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
                range: [border.yMin, border.yMax],
                tickformat: ".2e",
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
        let data = this.scatterData;
        const selectedPointIndexs = widgetStore.catalogOverlayWidgetStore.selectedPointIndexs;
        let scatterDataMarker = data[0].marker;
        if (selectedPointIndexs.length > 0) {
            data[0]["selectedpoints"] = selectedPointIndexs;
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
        const disabled = !widgetStore.catalogOverlayWidgetStore.enableLoadButton;

        return(
            <div className={"catalog-2D"}>
                <div className={"catalog-2D-option"}>
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
                </div>
                <div className={spikeLineClass}>
                    <Plot
                        data={data}
                        layout={layout}
                        config={config}
                        useResizeHandler={true}
                        onHover={this.onHover}
                        onDoubleClick={this.onDoubleClick}
                        onRelayout={this.onRelayout}
                        onSelected={this.onLassoSelected}
                        onDeselect={this.onDeselect}
                        onClick={this.onSingleSourceClick}
                    />
                </div>
                <div className="catalog-2D-footer" >
                    <div className="scatter-info">
                        <ProfilerInfoComponent info={this.genProfilerInfo()}/>
                    </div>
                    <div className="actions">
                        <FormGroup label={"Show only selected sources"} inline={true} disabled={disabled}>
                            <Switch checked={widgetStore.catalogOverlayWidgetStore.showSelectedData} onChange={this.handleShowSelectedDataChanged} disabled={disabled}/>
                        </FormGroup>
                        <Tooltip className="plot-button" content={"Update scatter plot with all data"}>
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