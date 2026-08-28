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
import {exportTsvFile, pixelToFluxDensityUnit, toExponential} from "utilities";

import "./StatsComponent.scss";

type StatsDisplayType = CARTA.StatsType | "BeamArea" | "NumBeams" | "BeamAreaPixels";
type StatsTableValue = {num: string; unit: string};
type StatsTableRow = {name: string; type: StatsDisplayType; value: StatsTableValue};
const NUM_BEAMS_STATS_TYPE = "NumBeams";
const BEAM_AREA_STATS_TYPE = "BeamArea";
const BEAM_PIXELS_STATS_TYPE = "BeamAreaPixels";

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

    @computed get statsData(): CARTA.RegionStatsData | null {
        const appStore = AppStore.Instance;
        if (this.widgetStore.effectiveFrame) {
            const frame = this.widgetStore.effectiveFrame;
            const fileId = frame.frameInfo.fileId;
            if (fileId === undefined) {
                return null;
            }
            const regionId = this.widgetStore.effectiveRegionId;

            const frameMap = appStore.regionStats.get(fileId);
            if (!frameMap || !regionId) {
                return null;
            }
            const regionMap = frameMap.get(regionId);
            if (!regionMap) {
                return null;
            }
            return regionMap.get(this.getEffectiveStokes(frame)) || null;
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

    private static readonly StatsNameMap = new Map<StatsDisplayType, string>([
        [CARTA.StatsType.NumPixels, "NumPixels"],
        [NUM_BEAMS_STATS_TYPE, "NumBeams"],
        [BEAM_AREA_STATS_TYPE, "BeamArea"],
        [BEAM_PIXELS_STATS_TYPE, "BeamAreaPixels"],
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
                    appStore.widgetsStore.setWidgetTitle(this.widgetId, `Statistics: ${regionString} ${selectedString}`);
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

    private getEffectiveStokes = (frame = this.widgetStore.effectiveFrame): number => {
        if (!frame) {
            return 0;
        }
        const coordinate = this.widgetStore.coordinate;
        const stokesIndex = frame.polarizationInfo.findIndex(polarization => polarization.replace("Stokes ", "") === coordinate.slice(0, coordinate.length - 1));
        const stokes = stokesIndex >= frame.frameInfo.fileInfoExtended.stokes ? frame.polarizations[stokesIndex] : stokesIndex;
        return stokes === -1 ? frame.requiredStokes : stokes;
    };

    private getWidgetBeamProperties = () => {
        const frame = this.widgetStore.effectiveFrame;
        return frame ? frame.getBeamProperties(this.getEffectiveStokes(frame)) : null;
    };

    private formatTableValue = (value: number | null | undefined, unit: string): StatsTableValue => {
        return {
            num: value == null ? "" : toExponential(value, 12),
            unit: value == null || isFinite(value) ? unit : ""
        };
    };

    private formatBeamValue = (value: number | null | undefined, unit: string): StatsTableValue | null => {
        if (value == null || !isFinite(value) || value <= 0) {
            return null;
        }
        return this.formatTableValue(value, unit);
    };

    private getNumBeamsValue = (): StatsTableValue | null => {
        const beamAreaPixels = this.getWidgetBeamProperties()?.beamAreaPixels;
        const numPixels = this.statsData?.statistics?.find(statistic => statistic.statsType === CARTA.StatsType.NumPixels)?.value;
        if (numPixels == null || beamAreaPixels == null || !isFinite(numPixels) || !isFinite(beamAreaPixels) || beamAreaPixels <= 0) {
            return null;
        }
        return this.formatTableValue(numPixels / beamAreaPixels, "beam(s)");
    };

    private getBeamAreaValue = (): StatsTableValue | null => {
        const beamArea = this.getWidgetBeamProperties()?.beamArea;
        return this.formatBeamValue(beamArea, "sr");
    };

    private getBeamPixelsValue = (): StatsTableValue | null => {
        const beamAreaPixels = this.getWidgetBeamProperties()?.beamAreaPixels;
        return this.formatBeamValue(beamAreaPixels, "pixel(s)");
    };

    private getStatisticUnit = (type: CARTA.StatsType): string => {
        const frame = this.widgetStore.effectiveFrame;
        if (!frame?.headerUnit) {
            return "";
        }

        const effectivePolarization = this.widgetStore.effectivePolarization;
        const unit = effectivePolarization && [Polarizations.PFtotal, Polarizations.PFlinear].includes(effectivePolarization) ? "%" : effectivePolarization === Polarizations.Pangle ? "degree" : frame.headerUnit;

        if (type === CARTA.StatsType.NumPixels) {
            return "pixel(s)";
        }
        if (type === CARTA.StatsType.SumSq) {
            return `(${unit})^2`;
        }
        if (type === CARTA.StatsType.FluxDensity) {
            return pixelToFluxDensityUnit(unit);
        }
        return unit;
    };

    private getTableValue = (type: StatsDisplayType): StatsTableValue | null => {
        if (type === NUM_BEAMS_STATS_TYPE) {
            return this.getNumBeamsValue();
        }
        if (type === BEAM_PIXELS_STATS_TYPE) {
            return this.getBeamPixelsValue();
        }
        if (type === BEAM_AREA_STATS_TYPE) {
            return this.getBeamAreaValue();
        }

        const statistic = this.statsData?.statistics?.find(item => item.statsType === type);
        if (!statistic) {
            return null;
        }
        return this.formatTableValue(statistic.value, this.getStatisticUnit(type));
    };

    private getTableRows = (): StatsTableRow[] => {
        const rows: StatsTableRow[] = [];
        StatsComponent.StatsNameMap.forEach((name, type) => {
            const value = this.getTableValue(type);
            if (value) {
                rows.push({name, type, value});
            }
        });
        return rows;
    };

    exportData = () => {
        const frame = this.widgetStore.effectiveFrame;
        if (this.statsData && frame) {
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
            const comment = `${channelInfo}${stokesInfo}${regionInfo}`;

            const header = "# Statistic\tValue\tUnit\n";

            let rows = "";
            this.getTableRows().forEach(({name, value}) => {
                const unit = value.unit === "" ? "N/A" : value.unit;
                rows += `${name.padEnd(12)}\t${value.num}\t${unit}\n`;
            });

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
        if (this.statsData) {
            // stretch value column to cover width
            const valueWidth = Math.max(0, this.width - StatsComponent.NameColumnWidth);

            const rows = this.getTableRows().map(({name, type, value}) => (
                <tr key={type}>
                    <td style={{width: StatsComponent.NameColumnWidth}}>{name}</td>
                    <td style={{width: valueWidth}}>
                        {value.num} {value.unit}
                    </td>
                </tr>
            ));

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
            formContent = <NonIdealState icon={"folder-open"} title={"No stats data"} description={"Select a valid region from the dropdown"} />;
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
