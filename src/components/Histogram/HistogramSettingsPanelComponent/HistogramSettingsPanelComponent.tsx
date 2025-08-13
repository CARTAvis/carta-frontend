import * as React from "react";
import {Tab, Tabs} from "@blueprintjs/core";
import {autorun, computed} from "mobx";
import {observer} from "mobx-react";

import {LinePlotSettingsPanelComponent, LinePlotSettingsPanelComponentProps, ScrollShadow} from "components/Shared";
import {LineKey} from "models";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
import {HistogramWidgetStore} from "stores/Widgets";
import {parseNumber} from "utilities";

import {HistogramConfigPanelComponent} from "./HistogramConfigPanelComponent";

import "./HistogramSettingsPanelComponent.scss";

const KEYCODE_ENTER = 13;

export enum HistogramSettingsTabs {
    STYLING,
    CONFIG
}

@observer
export class HistogramSettingsPanelComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
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
            const widgetStore = widgetsStore.histogramWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return undefined;
    }

    constructor(props: WidgetProps) {
        super(props);

        // Update widget title when region or coordinate changes
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
                const selectedString = this.widgetStore.matchesSelectedRegion ? "(Active)" : "";
                if (this.props.floatingSettingsId) {
                    appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `Histogram Settings: ${regionString} ${selectedString}`);
                }
            } else {
                if (this.props.floatingSettingsId) {
                    appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `Histogram Settings`);
                }
            }
        });
    }

    private handleLogScaleChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        if (this.widgetStore) {
            this.widgetStore.setLogScale(changeEvent.target.checked);
        }
    };

    handleSelectedTabChanged = (newTabId: React.ReactText) => {
        if (this.widgetStore) {
            this.widgetStore.setSettingsTabId(Number.parseInt(newTabId.toString()));
        }
    };

    handleMeanRmsChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        if (this.widgetStore) {
            this.widgetStore.setMeanRmsVisible(changeEvent.target.checked);
        }
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

        const minX = parseNumber(widgetStore.minX ?? 0, widgetStore.linePlotInitXYBoundaries.minXVal ?? 0);
        const maxX = parseNumber(widgetStore.maxX ?? 0, widgetStore.linePlotInitXYBoundaries.maxXVal ?? 0);
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
        if (!widgetStore) {
            return;
        }

        const minX = parseNumber(widgetStore.minX ?? 0, widgetStore.linePlotInitXYBoundaries.minXVal ?? 0);
        const maxX = parseNumber(widgetStore.maxX ?? 0, widgetStore.linePlotInitXYBoundaries.maxXVal ?? 0);
        if (isFinite(val) && val !== maxX && val > minX) {
            widgetStore.setXBounds(minX, val);
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
        if (!widgetStore) {
            return;
        }

        const minY = parseNumber(widgetStore.minY ?? 0, widgetStore.linePlotInitXYBoundaries.minYVal ?? 0);
        const maxY = parseNumber(widgetStore.maxY ?? 0, widgetStore.linePlotInitXYBoundaries.maxYVal ?? 0);
        if (isFinite(val) && val !== minY && val < maxY) {
            widgetStore.setYBounds(val, maxY);
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
        if (!widgetStore) {
            return;
        }

        const minY = parseNumber(widgetStore.minY ?? 0, widgetStore.linePlotInitXYBoundaries.minYVal ?? 0);
        const maxY = parseNumber(widgetStore.maxY ?? 0, widgetStore.linePlotInitXYBoundaries.maxYVal ?? 0);
        if (isFinite(val) && val !== maxY && val > minY) {
            widgetStore.setYBounds(minY, val);
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
            logScaleY: widgetStore.logScaleY,
            handleLogScaleChanged: this.handleLogScaleChanged,
            meanRmsVisible: widgetStore.meanRmsVisible,
            handleMeanRmsChanged: this.handleMeanRmsChanged,
            xMinVal: parseNumber(widgetStore.minX ?? 0, widgetStore.linePlotInitXYBoundaries.minXVal ?? 0),
            handleXMinChange: this.handleXMinChange,
            xMaxVal: parseNumber(widgetStore.maxX ?? 0, widgetStore.linePlotInitXYBoundaries.maxXVal ?? 0),
            handleXMaxChange: this.handleXMaxChange,
            yMinVal: parseNumber(widgetStore.minY ?? 0, widgetStore.linePlotInitXYBoundaries.minYVal ?? 0),
            handleYMinChange: this.handleYMinChange,
            yMaxVal: parseNumber(widgetStore.maxY ?? 0, widgetStore.linePlotInitXYBoundaries.maxYVal ?? 0),
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
