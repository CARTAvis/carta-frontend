import * as React from "react";
import * as _ from "lodash";
import * as Plotly from "plotly.js";
import Plot from "react-plotly.js";
import {autorun, computed, observable, values} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, HTMLSelect} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {WidgetConfig, WidgetProps, HelpType} from "stores";
import {CatalogScatterWidgetStore} from "stores/widgets";
import {ScatterPlotComponent, ScatterPlotComponentProps} from "components/Shared";
import {TickType} from "components/Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {Colors} from "@blueprintjs/core";
import {toFixed, getTableDataByType} from "utilities";
import "./CatalogScatterComponent.css";
import {Point2D} from "models";

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
            // add
            helpType: HelpType.CATALOG_OVERLAY
        };
    }

    constructor(props: WidgetProps) {
        super(props);
        // this.catalog2D = [];
        autorun(() => {
            if (this.widgetStore && this.widgetStore.catalogOverlayWidgetStore) {
                let progressString = "";
                const fileName = this.widgetStore.catalogOverlayWidgetStore.catalogInfo.fileInfo.name || "";
                const appStore = this.props.appStore;
                const frame = appStore.activeFrame;
                const progress = this.widgetStore.catalogOverlayWidgetStore.progress;
                if (progress && isFinite(progress) && progress < 1) {
                    progressString = `[${toFixed(progress * 100)}% complete]`;
                }
                if (frame) {
                    // const regionId = this.widgetStore.catalogOverlayWidgetStore.regionIdMap.get(frame.frameInfo.fileId) || 0;
                    // const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    // const selectedString = this.matchesSelectedRegion ? "(Selected)" : "";
                    this.props.appStore.widgetsStore.setWidgetTitle(this.props.id, `Catalog ${fileName} : ${progressString}`);
                }
            } else {
                this.props.appStore.widgetsStore.setWidgetTitle(this.props.id, `Catalog : Cursor`);
            }
        });
    }

    onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    @computed get widgetStore(): CatalogScatterWidgetStore {
        const widgetStore = this.props.appStore.widgetsStore.catalogScatterWidgets.get(this.props.id); 
        return widgetStore;
    }

    @computed get scatterData() {
        const widgetStore = this.widgetStore;
        const columnsName = widgetStore.columnsName;
        // Todo update chart with partial data
        let catalog2D = [];
        if (columnsName.x && columnsName.y) {
            for (let index = 0; index < widgetStore.xDataset.length; index++) {
                const x = widgetStore.xDataset[index];
                const y = widgetStore.yDataset[index];
                catalog2D.push({x: x, y: y});
            }   
        }
        return catalog2D;
    }

    @computed get scatterDatasets() {
        const widgetStore = this.widgetStore;
        let scatterDatasets: Plotly.Data[] = [];
        let data: Plotly.Data = {};
        data.type = "scattergl";
        data.mode = "markers";
        // data.marker = {
        //     symbol: "circle", 
        //     color: "red",
        //     size: 5,
        //     // line: {
        //     //     width: 1.5
        //     // }
        // };
        data.x = widgetStore.xDataset;
        data.y = widgetStore.yDataset;
        scatterDatasets.push(data);
        return scatterDatasets;
    }

    private handleColumnNameChange(type: string, changeEvent: React.ChangeEvent<HTMLSelectElement>) {
        const val = changeEvent.currentTarget.value;
        if (type === "x") {
            this.widgetStore.setColumnX(val);
        } else if (type === "y") {
            this.widgetStore.setColumnY(val);
        }
    }

    public render() {
        const widgetStore = this.widgetStore;
        const appStore = this.props.appStore;
        const columnsName = widgetStore.catalogOverlayWidgetStore.displayedColumnHeaders;
        const xyOptions = [];
        for (let index = 0; index < columnsName.length; index++) {
            const column = columnsName[index];
            if (this.DataTypes.indexOf(column.dataType) !== -1) {
                xyOptions.push(<option key={column.name + "_" + index} value={column.name}>{column.name}</option>);   
            }
        }

        // let scatter2D: ScatterPlotComponentProps = {
        //     xLabel: widgetStore.columnsName.x,
        //     yLabel: widgetStore.columnsName.y,
        //     darkMode: appStore.darkTheme,
        //     plotName: "profile",
        //     showXAxisTicks: true,
        //     showXAxisLabel: true,
        //     usePointSymbols: true,
        //     zeroLineWidth: 2,
        //     isGroupSubPlot: false,
        //     scrollZoom: true,
        //     // settings
        //     pointRadius: 2
        // };
        // scatter2D.data = this.scatterData;

        let layout: Partial<Plotly.Layout> = {
            width: this.width, 
            height: this.height - 35,
            // paper_bgcolor: "rgba(255,255,255, 0)", 
            // plot_bgcolor: "rgba(255,255,255, 0)",
            // xaxis: {
            //     autorange: false,
            //     showgrid: false,
            //     zeroline: false,
            //     showline: false,
            //     showticklabels: false
            // },
            // yaxis: {
            //     autorange: false,
            //     showgrid: false,
            //     zeroline: false,
            //     showline: false,
            //     showticklabels: false
            // },
            // margin: {
            //     l: 0,
            //     r: 0,
            //     b: 0,
            //     t: 0,
            //     pad: 0
            // },
            showlegend: false
        };
        const data = this.scatterDatasets;

        return(
            <div className={"catalog-2D"}>
                <div className={"catalog-2D-option"}>
                    <FormGroup inline={true} label="X">
                        <HTMLSelect className="bp3-fill" value={widgetStore.columnsName.x} onChange={changeEvent => this.handleColumnNameChange("x", changeEvent)}>
                            {xyOptions}
                        </HTMLSelect>
                    </FormGroup>
                    <FormGroup inline={true} label="Y">
                        <HTMLSelect className="bp3-fill" value={widgetStore.columnsName.y} onChange={changeEvent => this.handleColumnNameChange("y", changeEvent)}>
                            {xyOptions}
                        </HTMLSelect>
                    </FormGroup>
                </div>
                <div className={"catalog-2D-scatter"}>
                    {/* <ScatterPlotComponent {...scatter2D}/> */}
                    <Plot
                        data={data}
                        layout={layout}
                        config={{scrollZoom: true}}
                        useResizeHandler={true}
                    />
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}