import * as React from "react";
import {Tab, Tabs} from "@blueprintjs/core";
import {autorun, computed, type IReactionDisposer} from "mobx";
import {observer} from "mobx-react";
import type {LineKey} from "models";

import {LinePlotSettingsPanelComponent, type LinePlotSettingsPanelComponentProps, ScrollShadow} from "components/Shared";
import {HelpType, HistogramSettingsTabs} from "enums";
import {AppStore, type DefaultWidgetConfig, type WidgetProps, WidgetsStore} from "stores";
import {type HistogramWidgetStore} from "stores/Widgets";
import {parseNumber} from "utilities";

import {HistogramConfigPanelComponent} from "./HistogramConfigPanelComponent";

import "./HistogramSettingsPanelComponent.scss";

const KEYCODE_ENTER = 13;

@observer
export class HistogramSettingsPanelComponent extends React.Component<WidgetProps> {
    private widgetId: string;
    private floatingSettingsId: string | undefined;
    private readonly disposers: IReactionDisposer[] = [];

    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "histogram-floating-settings",
            type: "floating-settings",
            minWidth: 280,
            minHeight: 225,
            defaultWidth: 375,
            defaultHeight: 320,
            title: "histogram-settings",
            isCloseable: true,
            parentId: "histogram",
            parentType: "histogram",
            helpType: HelpType.HISTOGRAM_SETTINGS
        };
    }

    @computed get widgetStore(): HistogramWidgetStore | undefined {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.histogramWidgets) {
            const widgetStore = widgetsStore.histogramWidgets.get(this.widgetId);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return undefined;
    }

    constructor(props: WidgetProps) {
        super(props);
        this.widgetId = props.id;
        this.floatingSettingsId = props.floatingSettingsId;

        // Update widget title when region or coordinate changes
        this.disposers.push(
            autorun(() => {
                const appStore = AppStore.Instance;
                if (this.widgetStore && this.widgetStore.effectiveFrame) {
                    let regionString = "Unknown";
                    const regionId = this.widgetStore.effectiveRegionId;

                    if (regionId === -1) {
                        regionString = "Image";
                    } else if (this.widgetStore.effectiveFrame.regionSet) {
                        const region = this.widgetStore.effectiveFrame.regionSet.regions.find(r => r.regionId === regionId);
                        if (region) {
                            regionString = region.nameString;
                        }
                    }
                    const selectedString = this.widgetStore.isMatchingSelectedRegion ? "(Active)" : "";
                    if (this.floatingSettingsId) {
                        appStore.widgetsStore.setWidgetTitle(this.floatingSettingsId, `Histogram Settings: ${regionString} ${selectedString}`);
                    }
                } else {
                    if (this.floatingSettingsId) {
                        appStore.widgetsStore.setWidgetTitle(this.floatingSettingsId, `Histogram Settings`);
                    }
                }
            })
        );
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    }

    private handleLogScaleChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore?.setLogScale(changeEvent.target.checked);
    };

    handleSelectedTabChanged = (newTabId: React.ReactText) => {
        this.widgetStore?.setSettingsTabId(Number.parseInt(newTabId.toString()));
    };

    handleMeanRmsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore?.setMeanRmsVisible(changeEvent.target.checked);
    };

    handleXMinChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return;
        }

        const minX = parseNumber(widgetStore.minX, widgetStore.linePlotInitXYBoundaries.minXVal);
        const maxX = parseNumber(widgetStore.maxX, widgetStore.linePlotInitXYBoundaries.maxXVal);
        if (minX === undefined || maxX === undefined) {
            return;
        }
        if (isFinite(val) && val !== minX && val < maxX) {
            widgetStore.setXBounds(val, maxX);
        } else {
            ev.currentTarget.value = minX.toString();
        }
    };

    handleXMaxChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minX = parseNumber(widgetStore?.minX, widgetStore?.linePlotInitXYBoundaries.minXVal);
        const maxX = parseNumber(widgetStore?.maxX, widgetStore?.linePlotInitXYBoundaries.maxXVal);
        if (minX === undefined || maxX === undefined) {
            return;
        }
        if (isFinite(val) && val !== maxX && val > minX) {
            widgetStore?.setXBounds(minX, val);
        } else {
            ev.currentTarget.value = maxX.toString();
        }
    };

    handleYMinChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minY = parseNumber(widgetStore?.minY, widgetStore?.linePlotInitXYBoundaries.minYVal);
        const maxY = parseNumber(widgetStore?.maxY, widgetStore?.linePlotInitXYBoundaries.maxYVal);
        if (minY === undefined || maxY === undefined) {
            return;
        }
        if (isFinite(val) && val !== minY && val < maxY) {
            widgetStore?.setYBounds(val, maxY);
        } else {
            ev.currentTarget.value = minY.toString();
        }
    };

    handleYMaxChange = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }

        const val = parseFloat(ev.currentTarget.value);
        const widgetStore = this.widgetStore;
        const minY = parseNumber(widgetStore?.minY, widgetStore?.linePlotInitXYBoundaries.minYVal);
        const maxY = parseNumber(widgetStore?.maxY, widgetStore?.linePlotInitXYBoundaries.maxYVal);
        if (minY === undefined || maxY === undefined) {
            return;
        }
        if (isFinite(val) && val !== maxY && val > minY) {
            widgetStore?.setYBounds(minY, val);
        } else {
            ev.currentTarget.value = maxY.toString();
        }
    };

    render() {
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return null;
        }

        const lineSettingsProps: LinePlotSettingsPanelComponentProps = {
            lineColorMap: new Map<LineKey, string>([["Primary", widgetStore.primaryLineColor]]),
            lineOptions: [{value: "Primary", label: "Primary"}],
            lineWidth: widgetStore.lineWidth,
            plotType: widgetStore.plotType,
            linePlotPointSize: widgetStore.linePlotPointSize,
            setLineColor: (lineKey: LineKey, color: string) => widgetStore.setPrimaryLineColor(color),
            setLineWidth: widgetStore.setLineWidth,
            setLinePlotPointSize: widgetStore.setLinePlotPointSize,
            setPlotType: widgetStore.setPlotType,
            isAutoScaledX: widgetStore.isAutoScaledX,
            isAutoScaledY: widgetStore.isAutoScaledY,
            clearXYBounds: widgetStore.clearXYBounds,
            logScaleY: widgetStore.isLogScaleY,
            handleLogScaleChanged: this.handleLogScaleChanged,
            meanRmsVisible: widgetStore.isMeanRmsVisible,
            handleMeanRmsChanged: this.handleMeanRmsChanged,
            xMinVal: parseNumber(widgetStore.minX, widgetStore.linePlotInitXYBoundaries.minXVal),
            handleXMinChange: this.handleXMinChange,
            xMaxVal: parseNumber(widgetStore.maxX, widgetStore.linePlotInitXYBoundaries.maxXVal),
            handleXMaxChange: this.handleXMaxChange,
            yMinVal: parseNumber(widgetStore.minY, widgetStore.linePlotInitXYBoundaries.minYVal),
            handleYMinChange: this.handleYMinChange,
            yMaxVal: parseNumber(widgetStore.maxY, widgetStore.linePlotInitXYBoundaries.maxYVal),
            handleYMaxChange: this.handleYMaxChange
        };

        return (
            <ScrollShadow>
                <div className="histogram-settings-panel">
                    <Tabs id="histogramSettingTabs" selectedTabId={widgetStore.settingsTabId} onChange={this.handleSelectedTabChanged}>
                        <Tab id={HistogramSettingsTabs.CONFIG} panelClassName="config-tab-panel" title="Configuration" panel={<HistogramConfigPanelComponent widgetStore={widgetStore} />} />
                        <Tab id={HistogramSettingsTabs.STYLING} panelClassName="styling-tab-panel" title="Styling" panel={<LinePlotSettingsPanelComponent {...lineSettingsProps} />} />
                    </Tabs>
                </div>
            </ScrollShadow>
        );
    }
}
