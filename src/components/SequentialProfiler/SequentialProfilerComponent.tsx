import * as React from "react";
import {Button, FormGroup, HTMLSelect, NonIdealState} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {LinePlotComponent, type LinePlotComponentProps} from "components/Shared";
import {PlotType, RegionGroupType, TickType, TimeLabelFormat} from "enums";
import {type Point2D} from "models";
import {AppStore, type DefaultWidgetConfig, type RegionGroupStore, type WidgetProps} from "stores";

import "./SequentialProfilerComponent.scss";

type SequentialStatistic = CARTA.StatsType.Sum | CARTA.StatsType.FluxDensity;
const JULIAN_DATE_OFFSET = 2400000.5;

@observer
export class SequentialProfilerComponent extends React.Component<WidgetProps> {
    private readonly widgetId: string;
    @observable private selectedRegionGroupId: string | undefined;
    @observable private statistic: SequentialStatistic = CARTA.StatsType.FluxDensity;
    @observable private xAxisFormat: TimeLabelFormat = TimeLabelFormat.MJD;

    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "sequential-profiler",
            type: "sequential-profiler",
            minWidth: 400,
            minHeight: 225,
            defaultWidth: 650,
            defaultHeight: 300,
            title: "Light curve",
            isCloseable: true
        };
    }

    constructor(props: WidgetProps) {
        super(props);
        this.widgetId = props.id;
        const groups = AppStore.Instance.regionGroupStores.filter(group => group.regionGroupType === RegionGroupType.TIME_SERIES);
        this.selectedRegionGroupId = groups[0]?.regionGroupId;
        makeObservable(this);
    }

    componentDidMount() {
        this.ensureRegionGroup();
    }

    @action private ensureRegionGroup = () => {
        if (!this.regionGroup) {
            this.selectedRegionGroupId = AppStore.Instance.createRegionGroup().regionGroupId;
        }
    };

    @computed private get regionGroups(): RegionGroupStore[] {
        return AppStore.Instance.regionGroupStores.filter(group => group.regionGroupType === RegionGroupType.TIME_SERIES);
    }

    @computed private get regionGroup(): RegionGroupStore | undefined {
        return this.regionGroups.find(group => group.regionGroupId === this.selectedRegionGroupId) ?? this.regionGroups[0];
    }

    @computed private get data(): Point2D[] {
        const entries = (this.regionGroup?.entries ?? []).filter(entry => entry.region.isDisplayed !== false && entry.region.mjdUtc !== undefined);
        const firstMjdUtc = entries.length ? Math.min(...entries.map(entry => entry.region.mjdUtc!)) : 0;
        return entries.map(entry => ({x: this.convertMjd(entry.region.mjdUtc!, firstMjdUtc), y: (this.statistic === CARTA.StatsType.FluxDensity ? entry.region.regionFluxDensity : entry.region.regionSum) ?? NaN})).sort((a, b) => a.x - b.x);
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
        return group.regionGroupType === RegionGroupType.TIME_SERIES ? group.regionGroupName.replace(/^Region Group/, "Light curve") : group.regionGroupName;
    }

    @computed private get plotProps(): LinePlotComponentProps {
        const xValues = this.data.map(point => point.x);
        const yValues = this.data.map(point => point.y).filter(isFinite);
        const xMin = xValues.length ? Math.min(...xValues) : 0;
        const xMax = xValues.length ? Math.max(...xValues) : 1;
        const yMin = yValues.length ? Math.min(...yValues) : 0;
        const yMax = yValues.length ? Math.max(...yValues) : 1;
        const xPadding = xMin === xMax ? 1 / 86400 : 0;
        const yPadding = yMin === yMax ? Math.abs(yMin) * 0.05 || 1 : (yMax - yMin) * 0.05;
        const firstRegion = this.regionGroup?.entries.find(entry => entry.region.isDisplayed !== false && entry.region.mjdUtc !== undefined)?.region;
        const unit = this.statistic === CARTA.StatsType.FluxDensity ? firstRegion?.regionFluxDensityUnit : firstRegion?.regionSumUnit;
        const statisticLabel = this.statistic === CARTA.StatsType.FluxDensity ? "Flux Density" : "Intensity Sum";

        return {
            data: this.data,
            fullResolutionData: this.data,
            xMin: xMin - xPadding,
            xMax: xMax + xPadding,
            yMin: yMin - yPadding,
            yMax: yMax + yPadding,
            xLabel: this.xAxisLabel,
            yLabel: unit ? `${statisticLabel} (${unit})` : statisticLabel,
            tickTypeY: TickType.Scientific,
            plotType: PlotType.LINES,
            pointRadius: 3,
            borderWidth: 1,
            isDarkMode: AppStore.Instance.isDarkTheme,
            imageName: this.regionGroup ? this.getRegionGroupLabel(this.regionGroup) : undefined,
            plotName: "light curve",
            testId: this.widgetId
        };
    }

    @action private selectRegionGroup = (event: React.ChangeEvent<HTMLSelectElement>) => {
        this.selectedRegionGroupId = event.currentTarget.value;
    };

    @action private selectStatistic = (event: React.ChangeEvent<HTMLSelectElement>) => {
        this.statistic = Number(event.currentTarget.value) as SequentialStatistic;
    };

    @action private selectXAxisFormat = (event: React.ChangeEvent<HTMLSelectElement>) => {
        this.xAxisFormat = event.currentTarget.value as TimeLabelFormat;
    };

    private openRegionGroupManager = () => {
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget("Light curve", this.widgetId, SequentialProfilerComponent.WidgetConfig.type);
    };

    render() {
        const hasTimeSeries = AppStore.Instance.timeSeriesStore.elements.length > 0;
        return (
            <div className="sequential-profiler">
                <div className="sequential-profiler-controls">
                    <FormGroup label="Light curve" inline={true}>
                        <HTMLSelect value={this.regionGroup?.regionGroupId ?? ""} options={this.regionGroups.map(group => ({value: group.regionGroupId, label: this.getRegionGroupLabel(group)}))} onChange={this.selectRegionGroup} />
                    </FormGroup>
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
                    <FormGroup label="Y axis" inline={true}>
                        <HTMLSelect
                            value={this.statistic}
                            options={[
                                {value: CARTA.StatsType.FluxDensity, label: "Flux density"},
                                {value: CARTA.StatsType.Sum, label: "Intensity sum"}
                            ]}
                            onChange={this.selectStatistic}
                        />
                    </FormGroup>
                    <Button icon="cog" aria-label="Manage region groups" title="Manage region groups" onClick={this.openRegionGroupManager} />
                </div>
                <div className="sequential-profiler-plot">
                    {hasTimeSeries ? <LinePlotComponent {...this.plotProps} /> : <NonIdealState icon="timeline-line-chart" title="No time series" description="Add images to the time series to create a light curve." />}
                </div>
            </div>
        );
    }
}
