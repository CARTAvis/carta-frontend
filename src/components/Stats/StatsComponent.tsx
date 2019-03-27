import * as React from "react";
import {observer} from "mobx-react";
import {autorun, computed, observable} from "mobx";
import {ControlGroup, FormGroup, HTMLSelect, HTMLTable, IOptionProps, NonIdealState} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {WidgetConfig, WidgetProps} from "stores";
import {StatsWidgetStore} from "stores/widgets";
import "./StatsComponent.css";
import {Stats} from "fs";

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
            isCloseable: true
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
        return new StatsWidgetStore();
    }

    @computed get statsData(): CARTA.RegionStatsData {
        const appStore = this.props.appStore;

        if (appStore.activeFrame) {
            let fileId = this.widgetStore.fileId;
            let regionId = this.widgetStore.regionId;
            // Replace "current file" fileId with active frame's fileId
            if (this.widgetStore.fileId === -1) {
                fileId = appStore.activeFrame.frameInfo.fileId;
            }

            const frameMap = appStore.regionStats.get(fileId);
            if (!frameMap) {
                return null;
            }
            const data = frameMap.get(regionId);
            if (data) {
                return data;
            }
        }
        return null;
    }

    private static readonly STATS_NAME_MAP = new Map<CARTA.StatsType, string>([
        [CARTA.StatsType.Sum, "Sum"],
        [CARTA.StatsType.Mean, "Mean"],
        [CARTA.StatsType.RMS, "RMS"],
        [CARTA.StatsType.Sigma, "Sigma"],
        [CARTA.StatsType.SumSq, "SumSq"],
        [CARTA.StatsType.Min, "Min"],
        [CARTA.StatsType.Max, "Max"],
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
                this.props.appStore.widgetsStore.statsWidgets.set(this.props.id, new StatsWidgetStore());
            }
        }
        // Update widget title when region or coordinate changes
        autorun(() => {
            const appStore = this.props.appStore;
            if (this.widgetStore) {
                let regionString = "Unknown";

                if (this.widgetStore.regionId === -1) {
                    regionString = "Image";
                } else if (appStore.activeFrame && appStore.activeFrame.regionSet) {
                    const region = appStore.activeFrame.regionSet.regions.find(r => r.regionId === this.widgetStore.regionId);
                    if (region) {
                        regionString = region.nameString;
                    }
                }
                appStore.widgetsStore.setWidgetTitle(this.props.id, `Statistics: ${regionString}`);
            } else {
                appStore.widgetsStore.setWidgetTitle(this.props.id, `Statistics`);
            }
        });
    }

    private handleRegionChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.widgetStore.setRegionId(parseInt(changeEvent.target.value));
    };

    private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    public render() {

        const appStore = this.props.appStore;

        // Fill region select options with all non-temporary regions that are closed
        let profileRegionOptions: IOptionProps[] = [{value: -1, label: "Image"}];
        if (appStore.activeFrame && appStore.activeFrame.regionSet) {
            profileRegionOptions = profileRegionOptions.concat(this.props.appStore.activeFrame.regionSet.regions.filter(r => !r.isTemporary && r.isClosedRegion).map(r => {
                return {
                    value: r.regionId,
                    label: r.nameString
                };
            }));
        }

        let formContent;
        if (this.statsData) {
            // stretch value column to cover width
            const valueWidth = Math.max(0, this.width - StatsComponent.NAME_COLUMN_WIDTH);

            let rows = [];
            StatsComponent.STATS_NAME_MAP.forEach((name, type) => {
                const index = this.statsData.statistics.findIndex(s => s.statsType === type);
                if (index >= 0) {
                    const value = this.statsData.statistics[index].value;
                    rows.push((
                        <tr key={type}>
                            <td style={{width: StatsComponent.NAME_COLUMN_WIDTH}}>{name}</td>
                            <td style={{width: valueWidth}}>{value}</td>
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

        return (
            <div className={"stats-widget"}>
                <ControlGroup fill={true} vertical={true}>
                    <FormGroup label={"Region"} inline={true}>
                        <HTMLSelect value={this.widgetStore.regionId} options={profileRegionOptions} onChange={this.handleRegionChanged}/>
                    </FormGroup>
                </ControlGroup>
                <div className="stats-display">
                    {formContent}
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}