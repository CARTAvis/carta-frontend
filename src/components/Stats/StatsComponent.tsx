import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {HTMLTable, NonIdealState, FormGroup, HTMLSelect} from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {DefaultWidgetConfig, WidgetProps, HelpType, WidgetsStore, AppStore} from "stores";
import {StatsWidgetStore} from "stores/widgets";
import {toExponential, exportTsvFile} from "utilities";
import {RegionSelectorComponent} from "components/Shared";
import {ToolbarComponent} from "components/Shared/LinePlot/Toolbar/ToolbarComponent";
import "./StatsComponent.scss";

@observer
export class StatsComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "stats",
            type: "stats",
            minWidth: 400,
            minHeight: 200,
            defaultWidth: 475,
            defaultHeight: 325,
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
            let coordinate = this.widgetStore.coordinate;

            const frameMap = appStore.regionStats.get(fileId);
            if (!frameMap) {
                return null;
            }
            const regionMap = frameMap.get(regionId);
            if (!regionMap) {
                return null;
            }
            const stokes = this.widgetStore.effectiveFrame.stokesInfo.findIndex(stokes => stokes.replace("Stokes ", "") === coordinate.slice(0, coordinate.length - 1));
            return regionMap.get(stokes === -1 ? this.widgetStore.effectiveFrame.requiredStokes : stokes);
        }
        return null;
    }

    @action showMouseEnterWidget = () => {
        this.isMouseEntered = true;
    };

    @action hideMouseEnterWidget = () => {
        this.isMouseEntered = false;
    };

    private handleCoordinateChanged = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        this.widgetStore.setCoordinate(changeEvent.target.value);
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

    private static readonly NAME_COLUMN_WIDTH = 90;

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

        // When frame is changed(coordinateOptions changes), coordinate stays unchanged if new frame also supports it, otherwise defaults to 'z'
        autorun(() => {
            if (this.widgetStore.effectiveFrame && (!this.widgetStore.effectiveFrame.stokesInfo.find(stokes => `${stokes.replace("Stokes ", "")}z` === this.widgetStore.coordinate) || !this.widgetStore.effectiveFrame.stokesInfo)) {
                this.widgetStore.setCoordinate("z");
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

    private getTableValue = (index: number, type: CARTA.StatsType) => {
        let numString = "";
        let unitString = "";

        if (this.statsData && isFinite(index) && index >= 0 && index < this.statsData.statistics?.length) {
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
                    }
                } else {
                    unitString = unit;
                }
            }

            const value = this.statsData.statistics[index].value;
            numString = toExponential(value, 12);
            unitString = isFinite(value) ? unitString : "";
        }

        return {num: numString, unit: unitString};
    };

    exportData = () => {
        const frame = this.widgetStore.effectiveFrame;
        if (this.statsData && frame) {
            const fileName = frame.filename;
            const plotName = "statistics";
            const title = `# ${fileName} ${plotName}\n`;

            let regionInfo = "";
            const regionId = this.widgetStore.effectiveRegionId;
            if (regionId !== -1) {
                const regionProperties = frame.getRegionProperties(regionId);
                regionProperties?.forEach(regionProperty => (regionInfo += `# ${regionProperty}\n`));
            } else {
                regionInfo += "# full image\n";
            }
            let channelInfo = frame.channelInfo ? `# channel: ${frame.spectralInfo.channel}\n` : "";
            let stokesInfo = frame.hasStokes ? `# stokes: ${frame.stokesInfo[frame.requiredStokes]}\n` : "";
            let comment = `${channelInfo}${stokesInfo}${regionInfo}`;

            const header = "# Statistic\tValue\tUnit\n";

            let rows = "";
            StatsComponent.STATS_NAME_MAP.forEach((name, type) => {
                const index = this.statsData.statistics?.findIndex(s => s.statsType === type);
                if (index >= 0 && index < this.statsData.statistics?.length) {
                    const value = this.getTableValue(index, type);
                    value.unit = value.unit === "" ? "N/A" : value.unit;
                    rows += `${name.padEnd(12)}\t${value.num}\t${value.unit}\n`;
                }
            });

            exportTsvFile(fileName, plotName, `${title}${comment}${header}${rows}`);
        }
    };

    public render() {
        const appStore = AppStore.Instance;

        const widgetStore = this.widgetStore;

        let enableStokesSelect = false;
        let stokesClassName = "unlinked-to-selected";
        const coordinateOptions = [{value: "z", label: "Current"}];

        if (widgetStore.effectiveFrame?.regionSet) {
            enableStokesSelect = widgetStore.effectiveFrame.hasStokes;
            const stokesInfo = widgetStore.effectiveFrame.stokesInfo;
            stokesInfo.forEach(stokes => coordinateOptions.push({value: `${stokes.replace("Stokes ", "")}z`, label: stokes}));

            if (enableStokesSelect && widgetStore.isEffectiveFrameEqualToActiveFrame && widgetStore.coordinate === stokesInfo[widgetStore.effectiveFrame.requiredStokes] + "z") {
                stokesClassName = classNames("linked-to-selected-stokes", {"dark-theme": appStore.darkTheme});
            }
        }

        let formContent;
        let exportDataComponent = null;
        if (this.statsData) {
            // stretch value column to cover width
            const valueWidth = Math.max(0, this.width - StatsComponent.NAME_COLUMN_WIDTH);

            let rows = [];
            StatsComponent.STATS_NAME_MAP.forEach((name, type) => {
                const index = this.statsData.statistics?.findIndex(s => s.statsType === type);
                if (index >= 0 && index < this.statsData.statistics.length) {
                    const value = this.getTableValue(index, type);
                    rows.push(
                        <tr key={type}>
                            <td style={{width: StatsComponent.NAME_COLUMN_WIDTH}}>{name}</td>
                            <td style={{width: valueWidth}}>
                                {value.num} {value.unit}
                            </td>
                        </tr>
                    );
                }
            });

            formContent = (
                <HTMLTable>
                    <thead className={appStore.darkTheme ? "dark-theme" : ""}>
                        <tr>
                            <th style={{width: StatsComponent.NAME_COLUMN_WIDTH}}>Statistic</th>
                            <th style={{width: valueWidth}}>Value</th>
                        </tr>
                    </thead>
                    <tbody className={appStore.darkTheme ? "dark-theme" : ""}>{rows}</tbody>
                </HTMLTable>
            );

            exportDataComponent = (
                <div className="stats-export-data">
                    <ToolbarComponent darkMode={appStore.darkTheme} visible={this.isMouseEntered} exportData={this.exportData} />
                </div>
            );
        } else {
            formContent = <NonIdealState icon={"folder-open"} title={"No stats data"} description={"Select a valid region from the dropdown"} />;
        }

        const className = classNames("stats-widget", {"dark-theme": appStore.darkTheme});

        return (
            <div className={className}>
                <div className="stats-toolbar">
                    <RegionSelectorComponent widgetStore={this.widgetStore} />
                    <FormGroup label={"Polarization"} inline={true} disabled={!enableStokesSelect}>
                        <HTMLSelect className={stokesClassName} value={widgetStore.coordinate} options={coordinateOptions} onChange={this.handleCoordinateChanged} disabled={!enableStokesSelect} />
                    </FormGroup>
                </div>
                <div className="stats-display" onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                    {formContent}
                    {exportDataComponent}
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}></ReactResizeDetector>
            </div>
        );
    }
}
