import * as React from "react";
import {Tab, Tabs} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {RegionGroupManagerComponent} from "components/RegionGroup/RegionGroupManagerComponent";
import {LinePlotSettingsPanelComponent, ScrollShadow} from "components/Shared";
import {RegionGroupType} from "enums";
import {AppStore, type DefaultWidgetConfig, type WidgetProps, WidgetsStore} from "stores";

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

    render() {
        const widgetStore = WidgetsStore.Instance.sequentialProfileWidgets.get(this.props.id);
        if (!widgetStore) {
            return null;
        }

        const groups = AppStore.Instance.regionGroupStores.filter(group => group.regionGroupType === RegionGroupType.TIME_SERIES || group.regionGroupType === RegionGroupType.REGION_SERIES);
        return (
            <ScrollShadow>
                <div className="sequential-profiler-settings">
                    <Tabs id="sequentialProfilerSettingsTabs" selectedTabId={widgetStore.settingsTabId} onChange={tabId => widgetStore.setSettingsTabId(tabId as "styling" | "management")}>
                        <Tab
                            id="styling"
                            title="Styling"
                            panel={
                                <LinePlotSettingsPanelComponent
                                    lineColorMap={new Map(groups.map((group, index) => [group.regionGroupId, widgetStore.getLineColor(group.regionGroupId, index)]))}
                                    lineOptions={groups.map(group => ({value: group.regionGroupId, label: group.regionGroupName}))}
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
