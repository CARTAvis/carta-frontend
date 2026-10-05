import * as React from "react";
import {FormGroup, HTMLSelect, HTMLTable, NonIdealState} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {action, autorun, computed, type IReactionDisposer, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {RegionSelectorComponent, ResizeDetector} from "components/Shared";
import {ToolbarComponent} from "components/Shared/LinePlot/Toolbar/ToolbarComponent";
import {HelpType, Polarizations} from "enums";
import {FULL_POLARIZATIONS} from "models";
import {AppStore, type DefaultWidgetConfig, type WidgetProps} from "stores";
import {StatsWidgetStore} from "stores/Widgets";
import {exportTsvFile, getAnnulusSignalToNoise, pixelToFluxDensityUnit, toExponential} from "utilities";

import "./StatsComponent.scss";

@observer
export class StatsComponent extends React.Component<WidgetProps> {
    private widgetId: string;
    private readonly cachedWidgetStore: StatsWidgetStore;
    private readonly disposers: IReactionDisposer[] = [];

    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "stats",
            type: "stats",
            minWidth: 400,
            minHeight: 200,
            defaultWidth: 490,
            defaultHeight: 325,
            title: "Statistics",
            isCloseable: true,
            helpType: HelpType.STATS
        };
    }

    @observable width: number = 490;
    @observable height: number = 325;
    @observable isMouseEntered = false;

    get widgetStore(): StatsWidgetStore {
        return this.cachedWidgetStore;
    }

    private getStatsData = (regionId: number | null): CARTA.RegionStatsData | null => {
        const frame = this.widgetStore.effectiveFrame;
        if (!frame || regionId === null) {
            return null;
        }
        const coordinate = this.widgetStore.coordinate;
        const stokesIndex = frame.polarizationInfo.findIndex(polarization => polarization.replace("Stokes ", "") === coordinate.slice(0, coordinate.length - 1));
        const stokes = stokesIndex >= frame.frameInfo.fileInfoExtended.stokes ? frame.polarizations[stokesIndex] : stokesIndex;
        const data = AppStore.Instance.regionStats
            .get(frame.frameInfo.fileId)
            ?.get(regionId)
            ?.get(stokes === -1 ? frame.requiredStokes : stokes);
        return data?.channel === frame.requiredChannel ? data : null;
    };

    @computed get statsData(): CARTA.RegionStatsData | null {
        return this.getStatsData(this.widgetStore.statsRegionId);
    }

    @computed get backgroundStatsData(): CARTA.RegionStatsData | null {
        return this.getStatsData(this.widgetStore.backgroundStatsRegionId);
    }

    @computed get signalToNoise(): string | null {
        if (!this.widgetStore.hasBackground) {
            return null;
        }
        const data = this.statsData;
        const background = this.backgroundStatsData;
        if (!data || !background) {
            return null;
        }
        return toExponential(getAnnulusSignalToNoise(data, background), 12);
    }

    @computed get statistics(): CARTA.StatisticsValue.$Properties[] {
        return this.statsData?.statistics ?? [];
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

    private static readonly StatsNameMap = new Map<CARTA.StatsType, string>([
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

    private static readonly NameColumnWidth = 90;

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        this.widgetId = props.id;
        const appStore = AppStore.Instance;
        // Check if this widget hasn't been assigned an ID yet
        if (!props.docked && props.id === StatsComponent.WidgetConfig.type) {
            // Assign the next unique ID
            const id = appStore.widgetsStore.addStatsWidget();
            if (id) {
                appStore.widgetsStore.changeWidgetId(props.id, id);
                this.widgetId = id;
            }
        } else {
            if (!appStore.widgetsStore.statsWidgets.has(this.widgetId)) {
                appStore.widgetsStore.statsWidgets.set(this.widgetId, new StatsWidgetStore());
            }
        }
        this.cachedWidgetStore = appStore.widgetsStore.statsWidgets.get(this.widgetId) ?? new StatsWidgetStore();
        // Update widget title when region or coordinate changes
        this.disposers.push(
            autorun(() => {
                if (this.widgetStore && this.widgetStore.effectiveFrame) {
                    let regionString = "Unknown";

                    const regionId = this.widgetStore.effectiveRegionId;
                    const selectedString = this.widgetStore.isMatchingSelectedRegion ? "(Active)" : "";
                    if (regionId === -1) {
                        regionString = "Image";
                    } else if (this.widgetStore.effectiveFrame.regionSet) {
                        const region = this.widgetStore.effectiveFrame.regionSet.regions.find(r => r.regionId === regionId);
                        if (region) {
                            regionString = region.nameString;
                        }
                    }
                    const component = this.widgetStore.isAnnulus ? ` (${this.widgetStore.effectiveRegion?.statsArea === "inner" ? "Inner disk" : "Annulus"})` : "";
                    appStore.widgetsStore.setWidgetTitle(this.widgetId, `Statistics: ${regionString}${component} ${selectedString}`);
                } else {
                    appStore.widgetsStore.setWidgetTitle(this.widgetId, `Statistics`);
                }
            })
        );

        // When frame is changed(coordinateOptions changes), coordinate stays unchanged if new frame also supports it, otherwise defaults to 'z'
        this.disposers.push(
            autorun(() => {
                if (this.widgetStore.effectiveFrame && (!this.widgetStore.effectiveFrame.coordinateOptionsZ.find(option => option.value === this.widgetStore.coordinate) || !this.widgetStore.effectiveFrame.polarizationInfo)) {
                    this.widgetStore.setCoordinate("z");
                }
            })
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

    onMouseEnter = () => {
        this.showMouseEnterWidget();
    };

    onMouseLeave = () => {
        this.hideMouseEnterWidget();
    };

    private getTableValue = (value: number | null | undefined, type: CARTA.StatsType) => {
        let numString = "";
        let unitString = "";

        if (value != null) {
            const frame = this.widgetStore.effectiveFrame;
            if (frame && frame.headerUnit) {
                let unit: string;
                const effectivePolarization = this.widgetStore.effectivePolarization;
                if (effectivePolarization && [Polarizations.PFtotal, Polarizations.PFlinear].includes(effectivePolarization)) {
                    unit = "%";
                } else if (effectivePolarization === Polarizations.Pangle) {
                    unit = "degree";
                } else {
                    unit = frame.headerUnit;
                }

                if (type === CARTA.StatsType.NumPixels) {
                    unitString = "pixel(s)";
                } else if (type === CARTA.StatsType.SumSq) {
                    unitString = `(${unit})^2`;
                } else if (type === CARTA.StatsType.FluxDensity) {
                    unitString = pixelToFluxDensityUnit(unit);
                } else {
                    unitString = unit;
                }
            }

            numString = toExponential(value, 12);
            unitString = isFinite(value) ? unitString : "";
        }

        return {num: numString, unit: unitString};
    };

    exportData = () => {
        const frame = this.widgetStore.effectiveFrame;
        if (this.statsData && frame && (!this.widgetStore.hasBackground || this.signalToNoise !== null)) {
            const fileName = frame.filename;
            const plotName = "statistics";
            const title = `# ${fileName} ${plotName}\n`;

            let regionInfo = "";
            const regionId = this.widgetStore.effectiveRegionId;
            if (regionId !== -1 && regionId !== null) {
                const regionProperties = frame.getRegionProperties(regionId);
                regionProperties?.forEach(regionProperty => (regionInfo += `# ${regionProperty}\n`));
            } else {
                regionInfo += "# full image\n";
            }
            const channelInfo = frame.channelInfo ? `# channel: ${frame.spectralInfo.channel}\n` : "";
            const stokesInfo = frame.hasStokes ? `# stokes: ${frame.requiredPolarizationInfo}\n` : "";
            const componentInfo = this.widgetStore.isAnnulus ? `# component: ${this.widgetStore.effectiveRegion?.statsArea}\n` : "";
            const comment = `${channelInfo}${stokesInfo}${regionInfo}${componentInfo}`;

            const header = "# Statistic\tValue\tUnit\n";

            let rows = "";
            StatsComponent.StatsNameMap.forEach((name, type) => {
                const statistic = this.statistics.find(s => s.statsType === type);
                if (statistic) {
                    const value = this.getTableValue(statistic.value, type);
                    rows += `${name.padEnd(12)}\t${value.num}\t${value.unit || "N/A"}\n`;
                }
            });
            if (this.widgetStore.hasBackground) {
                rows += `# background: ${this.widgetStore.effectiveRegion?.statsBackground}\n`;
                rows += `S/N\t${this.signalToNoise}\tN/A\n`;
            }

            exportTsvFile(fileName, plotName, `${title}${comment}${header}${rows}`);
        }
    };

    public render() {
        const appStore = AppStore.Instance;

        const widgetStore = this.widgetStore;

        let isStokesSelectEnabled = false;
        let stokesClassName = "unlinked-to-selected";
        const coordinateOptions = [{value: "z", label: "Current"}];

        if (widgetStore.effectiveFrame?.regionSet) {
            isStokesSelectEnabled = widgetStore.effectiveFrame.hasStokes;
            coordinateOptions.push(...widgetStore.effectiveFrame.coordinateOptionsZ);

            if (isStokesSelectEnabled && widgetStore.isEffectiveFrameEqualToActiveFrame && widgetStore.coordinate === FULL_POLARIZATIONS.get(widgetStore.effectiveFrame.requiredPolarization) + "z") {
                stokesClassName = classNames("linked-to-selected-stokes", {"dark-theme": appStore.isDarkTheme});
            }
        }

        let formContent;
        let exportDataComponent: React.JSX.Element | null = null;
        if (this.statsData && (!this.widgetStore.hasBackground || this.signalToNoise !== null)) {
            const valueWidth = Math.max(0, this.width - StatsComponent.NameColumnWidth);
            const rows: React.JSX.Element[] = [];
            StatsComponent.StatsNameMap.forEach((name, type) => {
                const statistic = this.statistics.find(s => s.statsType === type);
                if (statistic) {
                    const value = this.getTableValue(statistic.value, type);
                    rows.push(
                        <tr key={type}>
                            <td style={{width: StatsComponent.NameColumnWidth}}>{name}</td>
                            <td style={{width: valueWidth}}>
                                {value.num} {value.unit}
                            </td>
                        </tr>
                    );
                }
            });

            if (widgetStore.hasBackground) {
                rows.push(
                    <tr key="signal-to-noise">
                        <td>S/N</td>
                        <td>{this.signalToNoise}</td>
                    </tr>
                );
            }
            formContent = (
                <HTMLTable data-testid="statistics-table">
                    <thead className={appStore.isDarkTheme ? "dark-theme" : ""}>
                        <tr>
                            <th style={{width: StatsComponent.NameColumnWidth}}>Statistic</th>
                            <th style={{width: valueWidth}}>Value</th>
                        </tr>
                    </thead>
                    <tbody className={appStore.isDarkTheme ? "dark-theme" : ""}>{rows}</tbody>
                </HTMLTable>
            );

            exportDataComponent = (
                <div className="stats-export-data">
                    <ToolbarComponent isDarkMode={appStore.isDarkTheme} isVisible={this.isMouseEntered} exportData={this.exportData} />
                </div>
            );
        } else {
            formContent = <NonIdealState icon={"folder-open"} title={"No stats data"} description={widgetStore.shouldUseAnalysisRegions ? "Waiting for annulus and inner-disk statistics" : "Select a valid region from the dropdown"} />;
        }

        const className = classNames("stats-widget", {"dark-theme": appStore.isDarkTheme});

        return (
            <ResizeDetector onResize={this.onResize}>
                <div className={className}>
                    <div className="stats-toolbar">
                        <RegionSelectorComponent widgetStore={this.widgetStore} />
                        <FormGroup label={"Polarization"} inline={true} disabled={!isStokesSelectEnabled}>
                            <HTMLSelect className={stokesClassName} value={widgetStore.coordinate} options={coordinateOptions} onChange={this.handleCoordinateChanged} disabled={!isStokesSelectEnabled} data-testid="polarization-dropdown" />
                        </FormGroup>
                    </div>
                    <div className="stats-display" onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                        {formContent}
                        {exportDataComponent}
                    </div>
                </div>
            </ResizeDetector>
        );
    }
}
