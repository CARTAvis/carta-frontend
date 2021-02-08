import * as React from "react";
import {observer} from "mobx-react";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {HTMLTable, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {DefaultWidgetConfig, WidgetProps, HelpType, WidgetsStore, AppStore} from "stores";
import {StatsWidgetStore} from "stores/widgets";
import {toExponential} from "utilities";
import {RegionSelectorComponent} from "components";
import {ExportToolbarComponent} from "./ExportToolbar/ExportToolbarComponent";
import "./StatsComponent.scss";

@observer
export class StatsComponent extends React.Component<WidgetProps> {

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "stats",
            type: "stats",
            minWidth: 300,
            minHeight: 200,
            defaultWidth: 325,
            defaultHeight: 250,
            title: "Statistics",
            isCloseable: true,
            helpType: HelpType.STATS
        };
    }

    @observable width: number = 0;
    @observable height: number = 0;
    @observable isMouseEntered = false;

    @computed get widgetStore(): StatsWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.statsWidgets) {
            const widgetStore = widgetsStore.statsWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new StatsWidgetStore();
    }

    @computed get statsData(): CARTA.RegionStatsData {
        const appStore = AppStore.Instance;
        if (this.widgetStore.effectiveFrame) {
            let fileId = this.widgetStore.effectiveFrame.frameInfo.fileId;
            let regionId = this.widgetStore.effectiveRegionId;

            const frameMap = appStore.regionStats.get(fileId);
            if (!frameMap) {
                return null;
            }
            return frameMap.get(regionId);
        }
        return null;
    }

    @action showMouseEnterWidget = () => {
        this.isMouseEntered = true;
    };

    @action hideMouseEnterWidget = () => {
        this.isMouseEntered = false;
    };

    private static readonly STATS_NAME_MAP = new Map<CARTA.StatsType, string>([
        [CARTA.StatsType.NumPixels, "NumPixels"],
        [CARTA.StatsType.Sum, "Sum"],
        [CARTA.StatsType.FluxDensity, "FluxDensity"],
        [CARTA.StatsType.Mean, "Mean"],
        [CARTA.StatsType.Sigma, "StdDev"],
        [CARTA.StatsType.Min, "Min"],
        [CARTA.StatsType.Max, "Max"],
        [CARTA.StatsType.Extrema, "Extrema"],
        [CARTA.StatsType.RMS, "RMS"],
        [CARTA.StatsType.SumSq, "SumSq"]
    ]);

    private static readonly NAME_COLUMN_WIDTH = 70;

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        const appStore = AppStore.Instance;
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === StatsComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = appStore.widgetsStore.addStatsWidget();
            appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!appStore.widgetsStore.statsWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                appStore.widgetsStore.statsWidgets.set(this.props.id, new StatsWidgetStore());
            }
        }
        // Update widget title when region or coordinate changes
        autorun(() => {
            if (this.widgetStore && this.widgetStore.effectiveFrame) {
                let regionString = "Unknown";

                const regionId = this.widgetStore.effectiveRegionId;
                const selectedString = this.widgetStore.matchesSelectedRegion ? "(Active)" : "";
                if (regionId === -1) {
                    regionString = "Image";
                } else if (this.widgetStore.effectiveFrame.regionSet) {
                    const region = this.widgetStore.effectiveFrame.regionSet.regions.find(r => r.regionId === regionId);
                    if (region) {
                        regionString = region.nameString;
                    }
                }
                appStore.widgetsStore.setWidgetTitle(this.props.id, `Statistics: ${regionString} ${selectedString}`);
            } else {
                appStore.widgetsStore.setWidgetTitle(this.props.id, `Statistics`);
            }
        });
    }

    @action private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    onMouseEnter = () => {
        this.showMouseEnterWidget();
    };

    onMouseLeave = () => {
        this.hideMouseEnterWidget();
    };

    private static GetTimestamp() {
        const now = new Date();
        return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
    }

    exportData = () => {
        const plotName = "Statistics";
        const xLabel = "Statistic";
        const yLabel = "Value";
        const zLabel = "Unit";
        let comment = `# xLabel: ${xLabel}\n# yLabel: ${yLabel}\n# zLabel: ${zLabel}\n`;

        const header = "# x\ty\tz\n";

        // read data from the table
        let rows = "";
        let table = document.getElementsByClassName('stats-table-data')[0];
        let tr = table.getElementsByTagName('tr');
        for (let i=1; i<tr.length; i++) {  // ignore the first line
            let row_data = tr[i].getElementsByTagName("td");
            let x_data = row_data[0].innerHTML;
            let yz_data = row_data[1].innerHTML.replace(" ", "\t");
            rows += `${x_data}\t${yz_data}\n`
        }

        // output file
        const tsvData = `data:text/tab-separated-values;charset=utf-8,${comment}${header}${rows}`;
        const dataURL = encodeURI(tsvData).replace(/#/g, "%23");

        const a = document.createElement("a") as HTMLAnchorElement;
        a.href = dataURL;
        a.download = `${plotName}-${StatsComponent.GetTimestamp()}.tsv`;
        a.dispatchEvent(new MouseEvent("click"));
    }

    public render() {
        const appStore = AppStore.Instance;

        let formContent;
        if (this.statsData) {
            // stretch value column to cover width
            const valueWidth = Math.max(0, this.width - StatsComponent.NAME_COLUMN_WIDTH);

            let rows = [];
            StatsComponent.STATS_NAME_MAP.forEach((name, type) => {
                const index = this.statsData.statistics.findIndex(s => s.statsType === type);
                if (index >= 0) {
                    let unitString = "";
                    const frame = this.widgetStore.effectiveFrame;
                    if (frame && frame.unit) {
                        const unit = frame.unit;
                        if (type === CARTA.StatsType.NumPixels) {
                            unitString = "pixel(s)";
                        } else if (type === CARTA.StatsType.SumSq) {
                            unitString = `(${unit})^2`;
                        } else if (type === CARTA.StatsType.FluxDensity) {
                            if (unit === "Jy/beam") {
                                unitString = "Jy";
                            } else {
                                return;
                            }
                        } else {
                            unitString = unit;
                        }
                    }

                    const value = this.statsData.statistics[index].value;
                    const valueString = isFinite(value) ? `${(type === CARTA.StatsType.NumPixels) ? value : toExponential(value, 4)} ${unitString}` : `${value}`;
                    rows.push((
                        <tr key={type}>
                            <td style={{width: StatsComponent.NAME_COLUMN_WIDTH}}>{name}</td>
                            <td style={{width: valueWidth}}>{valueString}</td>
                        </tr>
                    ));
                }
            });

            formContent = (
                <HTMLTable className="stats-table-data" >
                    <thead className={appStore.darkTheme ? "dark-theme" : ""}>
                    <tr>
                        <th style={{width: StatsComponent.NAME_COLUMN_WIDTH}}>Statistic</th>
                        <th style={{width: valueWidth}}>Value</th>
                    </tr>
                    </thead>
                    <tbody className={appStore.darkTheme ? "dark-theme" : ""}>
                    {rows}
                    </tbody>
                </HTMLTable>
            );
        } else {
            formContent = <NonIdealState icon={"folder-open"} title={"No stats data"} description={"Select a valid region from the dropdown"}/>;
        }

        let className = "stats-widget";
        if (appStore.darkTheme) {
            className += " dark-theme";
        }
        
        let exportToolbarComponent;
        if (this.statsData!==null) {
            exportToolbarComponent = (
                <ExportToolbarComponent
                    visible={this.isMouseEntered}
                    exportData={this.exportData}
                />
            );
        } else {
            exportToolbarComponent = null;
        }

        return (
            <div className={className}>
                <div className="stats-toolbar">
                    <RegionSelectorComponent widgetStore={this.widgetStore}/>
                </div>
                <div 
                    className="stats-display"
                    onMouseEnter={this.onMouseEnter}
                    onMouseLeave={this.onMouseLeave}
                >
                    {formContent}
                    {exportToolbarComponent}
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}