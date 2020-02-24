import * as React from "react";
import {observer} from "mobx-react";
import {autorun, computed, observable} from "mobx";
import {HTMLTable, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {WidgetConfig, WidgetProps, HelpType} from "stores";
import {StatsWidgetStore} from "stores/widgets";
import {toExponential} from "utilities";
import {RegionSelectorComponent} from "components";
import "./StatsComponent.css";

@observer
export class StatsComponent extends React.Component<WidgetProps> {

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "stats",
            type: "stats",
            minWidth: 300,
            minHeight: 200,
            defaultWidth: 300,
            defaultHeight: 250,
            title: "Statistics",
            isCloseable: true,
            helpType: HelpType.STATS
        };
    }

    @observable width: number = 0;
    @observable height: number = 0;

    @computed get widgetStore(): StatsWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.statsWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.statsWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new StatsWidgetStore(this.props.appStore);
    }

    @computed get statsData(): CARTA.RegionStatsData {
        const appStore = this.props.appStore;
        if (appStore.activeFrame && this.widgetStore.effectiveFrame) {
            let fileId = this.widgetStore.effectiveFrame.frameInfo.fileId;
            let regionId = this.widgetStore.effectiveRegionId;
            appStore.setRequiredFrame(this.widgetStore.effectiveFrame);

            const frameMap = appStore.regionStats.get(fileId);
            if (!frameMap) {
                return null;
            }
            return frameMap.get(regionId);
        }
        return null;
    }

    private static readonly STATS_NAME_MAP = new Map<CARTA.StatsType, string>([
        [CARTA.StatsType.NumPixels, "NumPixels"],
        [CARTA.StatsType.Sum, "Sum"],
        [CARTA.StatsType.FluxDensity, "FluxDensity"],
        [CARTA.StatsType.Mean, "Mean"],
        [CARTA.StatsType.Sigma, "StdDev"],
        [CARTA.StatsType.Min, "Min"],
        [CARTA.StatsType.Max, "Max"],
        [CARTA.StatsType.RMS, "RMS"],
        [CARTA.StatsType.SumSq, "SumSq"]
    ]);

    private static readonly NAME_COLUMN_WIDTH = 70;

    constructor(props: WidgetProps) {
        super(props);
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === StatsComponent.WIDGET_CONFIG.type) {
            // Assign the next unique ID
            const id = props.appStore.widgetsStore.addStatsWidget();
            props.appStore.widgetsStore.changeWidgetId(props.id, id);
        } else {
            if (!this.props.appStore.widgetsStore.statsWidgets.has(this.props.id)) {
                console.log(`can't find store for widget with id=${this.props.id}`);
                this.props.appStore.widgetsStore.statsWidgets.set(this.props.id, new StatsWidgetStore(this.props.appStore));
            }
        }
        // Update widget title when region or coordinate changes
        autorun(() => {
            const appStore = this.props.appStore;
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

    private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    public render() {
        const appStore = this.props.appStore;

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
                <HTMLTable>
                    <thead className={this.props.appStore.darkTheme ? "dark-theme" : ""}>
                    <tr>
                        <th style={{width: StatsComponent.NAME_COLUMN_WIDTH}}>Statistic</th>
                        <th style={{width: valueWidth}}>Value</th>
                    </tr>
                    </thead>
                    <tbody className={this.props.appStore.darkTheme ? "dark-theme" : ""}>
                    {rows}
                    </tbody>
                </HTMLTable>
            );
        } else {
            formContent = <NonIdealState icon={"folder-open"} title={"No stats data"} description={"Select a valid region from the dropdown"}/>;
        }

        let className = "stats-widget";
        if (this.widgetStore.matchesSelectedRegion) {
            className += " linked-to-selected";
        }

        if (appStore.darkTheme) {
            className += " dark-theme";
        }

        return (
            <div className={className}>
                <div className="stats-toolbar">
                    <RegionSelectorComponent widgetStore={this.widgetStore} appStore={this.props.appStore}/>
                </div>
                <div className="stats-display">
                    {formContent}
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}