import * as React from "react";
import {AnchorButton, Button, Checkbox, FormGroup, HTMLSelect, Menu, MenuItem, NonIdealState, PopoverNext, Position, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {action, computed, type IReactionDisposer, makeObservable, observable, reaction} from "mobx";
import {observer} from "mobx-react";

import {LinePlotComponent, type LinePlotComponentProps} from "components/Shared";
import {type MultiPlotProps} from "components/Shared/LinePlot/PlotContainer/PlotContainerComponent";
import {PlotType, RegionGroupType, TickType, TimeLabelFormat} from "enums";
import {type Point2D} from "models";
import {AppStore, type DefaultWidgetConfig, type RegionGroupStore, type WidgetProps, WidgetsStore} from "stores";
import {getColorForTheme} from "utilities";

import "./SequentialProfilerComponent.scss";

type SequentialStatistic = CARTA.StatsType.Sum | CARTA.StatsType.FluxDensity | CARTA.StatsType.Mean;
const JULIAN_DATE_OFFSET = 2400000.5;

@observer
export class SequentialProfilerComponent extends React.Component<WidgetProps> {
    private readonly widgetId: string;
    private disposeGroupSelection?: IReactionDisposer;
    private disposeManagerSelection?: IReactionDisposer;
    @observable private isMultiRegionGroupEnabled = false;
    @observable private selectedRegionGroupIds: string[] = [];
    @observable private statistic: SequentialStatistic = CARTA.StatsType.FluxDensity;
    @observable private xAxisFormat: TimeLabelFormat = TimeLabelFormat.MJD;

    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "sequential-profiler",
            type: "sequential-profiler",
            minWidth: 600,
            minHeight: 225,
            defaultWidth: 800,
            defaultHeight: 300,
            title: "Light curve",
            isCloseable: true
        };
    }

    constructor(props: WidgetProps) {
        super(props);
        this.widgetId = props.id;
        const appStore = AppStore.Instance;
        const groups = appStore.regionGroupStores.filter(group => group.regionGroupType === RegionGroupType.TIME_SERIES || group.regionGroupType === RegionGroupType.REGION_SERIES);
        const firstGroup = groups.find(group => group.regionGroupId === appStore.regionGroupManagerSelectedId) ?? groups[0];
        this.selectedRegionGroupIds = firstGroup ? [firstGroup.regionGroupId] : [];
        makeObservable(this);
    }

    componentDidMount() {
        this.disposeGroupSelection = reaction(
            () => this.regionGroups.map(group => group.regionGroupId),
            (groupIds, previousGroupIds) => {
                const newGroupId = groupIds.find(id => !previousGroupIds.includes(id));
                if (newGroupId) {
                    this.selectRegionGroup(newGroupId);
                }
            }
        );
        this.disposeManagerSelection = reaction(
            () => AppStore.Instance.regionGroupManagerSelectedId,
            regionGroupId => {
                if (regionGroupId) {
                    this.selectSingleRegionGroup(regionGroupId);
                }
            }
        );
        this.ensureRegionGroup();
    }

    componentDidUpdate() {
        this.ensureRegionGroup();
    }

    componentWillUnmount() {
        this.disposeGroupSelection?.();
        this.disposeManagerSelection?.();
    }

    @action private ensureRegionGroup = () => {
        if (AppStore.Instance.timeSeriesStore.elements.length && !this.regionGroups.length) {
            const group = AppStore.Instance.createRegionGroup();
            if (group) {
                this.selectedRegionGroupIds = [group.regionGroupId];
            }
        }
    };

    @computed private get regionGroups(): RegionGroupStore[] {
        return AppStore.Instance.regionGroupStores.filter(group => group.regionGroupType === RegionGroupType.TIME_SERIES || group.regionGroupType === RegionGroupType.REGION_SERIES);
    }

    @computed private get availableRegionGroups(): RegionGroupStore[] {
        const appStore = AppStore.Instance;
        return this.regionGroups.filter(group =>
            group.regionGroupType === RegionGroupType.TIME_SERIES ? appStore.timeSeriesStore.elements.length > 0 : group.regionSeriesFrameId !== undefined && !!appStore.getFrame(group.regionSeriesFrameId)
        );
    }

    @computed private get selectedRegionGroups(): RegionGroupStore[] {
        const selectedGroups = this.availableRegionGroups.filter(group => this.selectedRegionGroupIds.includes(group.regionGroupId));
        const groups = selectedGroups.length ? selectedGroups : this.availableRegionGroups.slice(0, 1);
        return groups.filter(group => group.regionGroupType === groups[0]?.regionGroupType);
    }

    @computed private get selectedSeriesType(): RegionGroupType | undefined {
        return this.selectedRegionGroups[0]?.regionGroupType;
    }

    private get effectiveStatistic(): SequentialStatistic {
        return this.selectedSeriesType === RegionGroupType.REGION_SERIES || this.statistic !== CARTA.StatsType.Mean ? this.statistic : CARTA.StatsType.FluxDensity;
    }

    @computed private get selectedRegionGroupText(): string {
        return this.selectedRegionGroups.map(group => this.getRegionGroupLabel(group)).join(", ");
    }

    @computed private get plotGroups(): Array<{group: RegionGroupStore; entries: Array<{entry: RegionGroupStore["entries"][number]; x: number}>; data: Point2D[]}> {
        const entries = this.selectedRegionGroups
            .filter(group => group.regionGroupType === RegionGroupType.TIME_SERIES)
            .flatMap(group => group.entries)
            .filter(entry => entry.region.isDisplayed !== false && entry.region.mjdUtc !== undefined);
        const firstMjdUtc = entries.length ? Math.min(...entries.map(entry => entry.region.mjdUtc!)) : 0;

        return this.selectedRegionGroups.map(group => {
            const groupEntries = group.entries
                .filter(entry => entry.region.isDisplayed !== false && (group.regionGroupType === RegionGroupType.REGION_SERIES ? entry.region.regionId !== undefined : entry.region.mjdUtc !== undefined))
                .map(entry => ({entry, x: group.regionGroupType === RegionGroupType.REGION_SERIES ? entry.region.regionId! : this.convertMjd(entry.region.mjdUtc!, firstMjdUtc)}))
                .sort((a, b) => a.x - b.x);
            return {
                group,
                entries: groupEntries,
                data: groupEntries.map(({entry, x}) => ({
                    x,
                    y: (this.effectiveStatistic === CARTA.StatsType.FluxDensity ? entry.region.regionFluxDensity : this.effectiveStatistic === CARTA.StatsType.Mean ? entry.region.regionMean : entry.region.regionSum) ?? NaN
                }))
            };
        });
    }

    private convertMjd(mjdUtc: number, firstMjdUtc: number): number {
        switch (this.xAxisFormat) {
            case TimeLabelFormat.JD:
                return mjdUtc + JULIAN_DATE_OFFSET;
            case TimeLabelFormat.RELATIVE:
                return mjdUtc - firstMjdUtc;
            case TimeLabelFormat.MJD:
            default:
                return mjdUtc;
        }
    }

    private get xAxisLabel(): string {
        if (this.selectedSeriesType === RegionGroupType.REGION_SERIES) {
            return "Region index";
        }
        switch (this.xAxisFormat) {
            case TimeLabelFormat.JD:
                return "Time (JD UTC)";
            case TimeLabelFormat.RELATIVE:
                return "Time (days since first observation)";
            case TimeLabelFormat.MJD:
            default:
                return "Time (MJD UTC)";
        }
    }

    private getRegionGroupLabel(group: RegionGroupStore): string {
        if (group.regionGroupType === RegionGroupType.TIME_SERIES) {
            return group.regionGroupName.replace(/^Region Group/, "Light curve");
        } else if (group.regionGroupType === RegionGroupType.REGION_SERIES) {
            return group.regionGroupName.replace(/^Region Group/, "Region series");
        }
        return group.regionGroupName;
    }

    private getPlotColor = (group: RegionGroupStore) => {
        const index = this.regionGroups.findIndex(candidate => candidate.regionGroupId === group.regionGroupId);
        const color = WidgetsStore.Instance.sequentialProfileWidgets.get(this.widgetId)?.getLineColor(group.regionGroupId, index);
        return color ? getColorForTheme(color) : "#000000";
    };

    private selectFrameAtX = (x: number) => {
        const entries = this.plotGroups.flatMap(group => group.entries);
        if (!entries.length) {
            return;
        }
        const closestEntry = entries.reduce((closest, entry) => (Math.abs(entry.x - x) < Math.abs(closest.x - x) ? entry : closest), entries[0]);
        const frame = AppStore.Instance.getFrame(closestEntry.entry.frameId);
        if (frame) {
            AppStore.Instance.updateActiveImageByFrame(frame);
        }
    };

    @computed private get plotProps(): LinePlotComponentProps {
        const xValues = this.plotGroups.flatMap(group => group.data).map(point => point.x);
        const yValues = this.plotGroups
            .flatMap(group => group.data)
            .map(point => point.y)
            .filter(isFinite);
        const xMin = xValues.length ? Math.min(...xValues) : 0;
        const xMax = xValues.length ? Math.max(...xValues) : 1;
        const yMin = yValues.length ? Math.min(...yValues) : 0;
        const yMax = yValues.length ? Math.max(...yValues) : 1;
        const xPadding = xMin === xMax ? (this.selectedSeriesType === RegionGroupType.REGION_SERIES ? 1 : 1 / 86400) : (xMax - xMin) * 0.05;
        const yPadding = yMin === yMax ? Math.abs(yMin) * 0.05 || 1 : (yMax - yMin) * 0.05;
        const firstRegion = this.plotGroups.find(group => group.entries.length)?.entries[0]?.entry.region;
        const unit = this.effectiveStatistic === CARTA.StatsType.FluxDensity ? firstRegion?.regionFluxDensityUnit : firstRegion?.regionSumUnit;
        const statisticLabel = this.effectiveStatistic === CARTA.StatsType.FluxDensity ? "Flux Density" : this.effectiveStatistic === CARTA.StatsType.Mean ? "Intensity Mean" : "Intensity Sum";
        const multiPlotPropsMap = new Map<string, MultiPlotProps>();
        const widgetStore = WidgetsStore.Instance.sequentialProfileWidgets.get(this.widgetId);
        this.plotGroups.forEach(({group, data}) => {
            const plotType = group.regionGroupType === RegionGroupType.REGION_SERIES && data.length === 1 ? PlotType.POINTS : (widgetStore?.plotType ?? PlotType.LINES);
            multiPlotPropsMap.set(this.getRegionGroupLabel(group), {
                imageName: this.getRegionGroupLabel(group),
                plotName: group.regionGroupType === RegionGroupType.REGION_SERIES ? "region series" : "light curve",
                data,
                type: plotType,
                borderColor: this.getPlotColor(group),
                pointRadius: widgetStore?.linePlotPointSize ?? 3,
                borderWidth: widgetStore?.lineWidth ?? 1
            });
        });

        return {
            xMin: xMin - xPadding,
            xMax: xMax + xPadding,
            yMin: yMin - yPadding,
            yMax: yMax + yPadding,
            xLabel: this.xAxisLabel,
            yLabel: unit ? `${statisticLabel} (${unit})` : statisticLabel,
            tickTypeX: this.selectedSeriesType === RegionGroupType.REGION_SERIES ? TickType.Integer : TickType.Automatic,
            tickTypeY: TickType.Scientific,
            plotType: widgetStore?.plotType ?? PlotType.LINES,
            pointRadius: widgetStore?.linePlotPointSize ?? 3,
            borderWidth: widgetStore?.lineWidth ?? 1,
            isDarkMode: AppStore.Instance.isDarkTheme,
            imageName: this.selectedSeriesType === RegionGroupType.REGION_SERIES ? "Region series" : "Light curves",
            plotName: this.selectedSeriesType === RegionGroupType.REGION_SERIES ? "region series" : "light curve",
            graphClicked: this.selectFrameAtX,
            multiPlotPropsMap,
            testId: this.widgetId
        };
    }

    @action private toggleMultiRegionGroups = () => {
        this.isMultiRegionGroupEnabled = !this.isMultiRegionGroupEnabled;
        if (!this.isMultiRegionGroupEnabled) {
            this.selectedRegionGroupIds = this.selectedRegionGroups.slice(0, 1).map(group => group.regionGroupId);
        }
    };

    @action private selectRegionGroup = (regionGroupId: string) => {
        const group = this.regionGroups.find(candidate => candidate.regionGroupId === regionGroupId);
        if (!group) {
            return;
        }
        if (!this.isMultiRegionGroupEnabled || (this.selectedSeriesType !== undefined && group.regionGroupType !== this.selectedSeriesType)) {
            this.selectedRegionGroupIds = [regionGroupId];
        } else if (this.selectedRegionGroupIds.includes(regionGroupId)) {
            if (this.selectedRegionGroupIds.length > 1) {
                this.selectedRegionGroupIds = this.selectedRegionGroupIds.filter(id => id !== regionGroupId);
            }
        } else {
            this.selectedRegionGroupIds = [...this.selectedRegionGroupIds, regionGroupId];
        }
    };

    @action private selectSingleRegionGroup = (regionGroupId: string) => {
        if (this.regionGroups.some(group => group.regionGroupId === regionGroupId)) {
            this.selectedRegionGroupIds = [regionGroupId];
        }
    };

    @action private selectStatistic = (event: React.ChangeEvent<HTMLSelectElement>) => {
        this.statistic = Number(event.currentTarget.value) as SequentialStatistic;
    };

    @action private selectXAxisFormat = (event: React.ChangeEvent<HTMLSelectElement>) => {
        this.xAxisFormat = event.currentTarget.value as TimeLabelFormat;
    };

    private openRegionGroupManager = () => {
        WidgetsStore.Instance.sequentialProfileWidgets.get(this.widgetId)?.setSettingsTabId("management");
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget("Light curve", this.widgetId, SequentialProfilerComponent.WidgetConfig.type);
    };

    render() {
        const hasSelectedSeries = this.selectedRegionGroups.length > 0;
        const isSelectionDisabled = !this.availableRegionGroups.length;
        const selectionLabel = this.selectedSeriesType === RegionGroupType.REGION_SERIES ? "Region series" : "Light curve";
        return (
            <div className="sequential-profiler">
                <div className="sequential-profiler-controls">
                    <div className="light-curve-selection">
                        <Tooltip content={this.isMultiRegionGroupEnabled ? `Select multiple ${selectionLabel.toLowerCase()} groups` : `Select a ${selectionLabel.toLowerCase()}`} position={Position.TOP}>
                            <Checkbox label={selectionLabel} checked={this.isMultiRegionGroupEnabled} onChange={this.toggleMultiRegionGroups} disabled={isSelectionDisabled} />
                        </Tooltip>
                        <PopoverNext
                            content={
                                <Menu>
                                    {this.availableRegionGroups.map(group => {
                                        const label = this.getRegionGroupLabel(group);
                                        const isSelected = this.selectedRegionGroupIds.includes(group.regionGroupId);
                                        return (
                                            <MenuItem
                                                key={group.regionGroupId}
                                                text={isSelected ? <b>{label}</b> : label}
                                                icon={isSelected ? "tick" : "blank"}
                                                onClick={() => this.selectRegionGroup(group.regionGroupId)}
                                                shouldDismissPopover={false}
                                            />
                                        );
                                    })}
                                </Menu>
                            }
                            animation="minimal"
                            arrow={false}
                            placement="bottom"
                            shouldReturnFocusOnClose={false}
                            disabled={isSelectionDisabled}
                        >
                            <AnchorButton
                                text={
                                    <span className="light-curve-selection-text" title={this.selectedRegionGroupText}>
                                        {this.selectedRegionGroupText}
                                    </span>
                                }
                                endIcon="caret-down"
                                aria-label="Select region groups"
                            />
                        </PopoverNext>
                    </div>
                    {this.selectedSeriesType !== RegionGroupType.REGION_SERIES && (
                        <FormGroup label="X axis" inline={true}>
                            <HTMLSelect
                                value={this.xAxisFormat}
                                options={[
                                    {value: TimeLabelFormat.MJD, label: "MJD (UTC)"},
                                    {value: TimeLabelFormat.JD, label: "JD (UTC)"},
                                    {value: TimeLabelFormat.RELATIVE, label: "Relative days"}
                                ]}
                                onChange={this.selectXAxisFormat}
                            />
                        </FormGroup>
                    )}
                    <FormGroup label="Y axis" inline={true}>
                        <HTMLSelect
                            value={this.effectiveStatistic}
                            options={[
                                {value: CARTA.StatsType.FluxDensity, label: "Flux density"},
                                {value: CARTA.StatsType.Sum, label: "Intensity sum"},
                                ...(this.selectedSeriesType === RegionGroupType.REGION_SERIES ? [{value: CARTA.StatsType.Mean, label: "Intensity mean"}] : [])
                            ]}
                            onChange={this.selectStatistic}
                        />
                    </FormGroup>
                    <Button icon="series-configuration" aria-label="Light curve management" title="Light curve management" onClick={this.openRegionGroupManager} />
                </div>
                <div className="sequential-profiler-plot">
                    {hasSelectedSeries ? <LinePlotComponent {...this.plotProps} /> : <NonIdealState icon="timeline-line-chart" title="No series" description="Add time-series frames or create a region series in the management panel." />}
                </div>
                {this.selectedRegionGroups.length > 0 && (
                    <div className="sequential-profiler-legend">
                        {this.selectedRegionGroups.map(group => (
                            <div className="sequential-profiler-legend-item" key={group.regionGroupId}>
                                <span className="sequential-profiler-legend-color" style={{backgroundColor: this.getPlotColor(group)}} />
                                <span>{this.getRegionGroupLabel(group)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }
}
