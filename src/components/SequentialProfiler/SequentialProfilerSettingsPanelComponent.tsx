import * as React from "react";
import {Checkbox, FormGroup, HTMLSelect, Tab, Tabs} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {RegionGroupManagerComponent} from "components/RegionGroup/RegionGroupManagerComponent";
import {LinePlotSettingsPanelComponent, ScrollShadow} from "components/Shared";
import {RegionGroupType} from "enums";
import {AppStore, type DefaultWidgetConfig, type RegionGroupStore, type WidgetProps, WidgetsStore} from "stores";
import {SEQUENTIAL_X_AXIS_OPTIONS, SEQUENTIAL_Y_AXIS_OPTIONS, type SequentialStatistic, type SequentialXAxisFormat} from "stores/Widgets/SequentialProfileWidgetStore";

import "./SequentialProfilerSettingsPanelComponent.scss";

@observer
export class SequentialProfilerSettingsPanelComponent extends React.Component<WidgetProps> {
    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "sequential-profiler-floating-settings",
            type: "floating-settings",
            minWidth: 400,
            minHeight: 300,
            defaultWidth: 500,
            defaultHeight: 550,
            title: "Light curve Settings",
            isCloseable: true,
            parentId: "sequential-profiler",
            parentType: "sequential-profiler"
        };
    }

    private getCurveName = (group: RegionGroupStore) => {
        if (group.regionGroupType === RegionGroupType.TIME_SERIES) {
            return group.regionGroupName.replace(/^Region Group/, "Light curve");
        }
        if (group.regionGroupType === RegionGroupType.REGION_SERIES) {
            return group.regionGroupName.replace(/^Region Group/, "Region series");
        }
        return group.regionGroupName;
    };

    render() {
        const widgetStore = WidgetsStore.Instance.sequentialProfileWidgets.get(this.props.id);
        if (!widgetStore) {
            return null;
        }

        const groups = AppStore.Instance.regionGroupStores.filter(group => group.regionGroupType === RegionGroupType.TIME_SERIES || group.regionGroupType === RegionGroupType.REGION_SERIES);
        return (
            <ScrollShadow>
                <div className="sequential-profiler-settings">
                    <Tabs id="sequentialProfilerSettingsTabs" selectedTabId={widgetStore.settingsTabId} onChange={tabId => widgetStore.setSettingsTabId(tabId as "axes" | "styling" | "management")}>
                        <Tab
                            id="axes"
                            title="Axes"
                            panel={
                                <>
                                    <FormGroup label="X axis" inline={true}>
                                        <HTMLSelect
                                            value={widgetStore.xAxisFormat}
                                            options={SEQUENTIAL_X_AXIS_OPTIONS.filter(option => widgetStore.visibleXAxisFormats.includes(option.value))}
                                            disabled={!widgetStore.visibleXAxisFormats.length}
                                            onChange={event => widgetStore.setXAxisFormat(event.currentTarget.value as SequentialXAxisFormat)}
                                        />
                                    </FormGroup>
                                    <FormGroup label="Y axis" inline={true}>
                                        <HTMLSelect value={widgetStore.statistic} options={SEQUENTIAL_Y_AXIS_OPTIONS} onChange={event => widgetStore.setStatistic(Number(event.currentTarget.value) as SequentialStatistic)} />
                                    </FormGroup>
                                    <FormGroup label="Options shown in the X-axis dropdown">
                                        <Checkbox
                                            label="Select all"
                                            checked={widgetStore.visibleXAxisFormats.length === SEQUENTIAL_X_AXIS_OPTIONS.length}
                                            indeterminate={widgetStore.visibleXAxisFormats.length > 0 && widgetStore.visibleXAxisFormats.length < SEQUENTIAL_X_AXIS_OPTIONS.length}
                                            onChange={event => widgetStore.setAllXAxisFormatsVisible(event.currentTarget.checked)}
                                        />
                                        {SEQUENTIAL_X_AXIS_OPTIONS.map(option => {
                                            const isVisible = widgetStore.visibleXAxisFormats.includes(option.value);
                                            return <Checkbox key={option.value} label={option.label} checked={isVisible} onChange={event => widgetStore.setXAxisFormatVisibility(option.value, event.currentTarget.checked)} />;
                                        })}
                                    </FormGroup>
                                </>
                            }
                        />
                        <Tab
                            id="styling"
                            title="Styling"
                            panel={
                                <LinePlotSettingsPanelComponent
                                    lineColorMap={new Map(groups.map((group, index) => [group.regionGroupId, widgetStore.getLineColor(group.regionGroupId, index)]))}
                                    lineOptions={groups.map(group => ({value: group.regionGroupId, label: this.getCurveName(group)}))}
                                    lineWidth={widgetStore.lineWidth}
                                    linePlotPointSize={widgetStore.linePlotPointSize}
                                    plotType={widgetStore.plotType}
                                    setLineColor={widgetStore.setLineColor}
                                    setLineWidth={widgetStore.setLineWidth}
                                    setLinePlotPointSize={widgetStore.setLinePlotPointSize}
                                    setPlotType={widgetStore.setPlotType}
                                />
                            }
                        />
                        <Tab id="management" title="Management" panel={<RegionGroupManagerComponent id={this.props.id} docked={false} />} />
                    </Tabs>
                </div>
            </ScrollShadow>
        );
    }
}
