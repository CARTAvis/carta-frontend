import * as React from "react";
import {observer} from "mobx-react";
import {computed, autorun} from "mobx";
import {Colors} from "@blueprintjs/core";
import {LinePlotSettingsPanelComponentProps, LinePlotSettingsPanelComponent} from "components/Shared";
import {HistogramWidgetStore} from "stores/widgets";
import {WidgetProps, WidgetConfig} from "stores";

@observer
export class HistogramSettingsPanelComponent extends React.Component<WidgetProps> {

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "histogram-floating-settings",
            type: "floating-settings",
            minWidth: 280,
            minHeight: 225,
            defaultWidth: 300,
            defaultHeight: 350,
            title: "histogram-settings",
            isCloseable: true,
            parentId: "histogram",
            parentType: "histogram"
        };
    }

    @computed get widgetStore(): HistogramWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.histogramWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.histogramWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return null;
    }

    @computed get matchesSelectedRegion() {
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;
        if (frame) {
            const widgetRegion = this.widgetStore.regionIdMap.get(frame.frameInfo.fileId);
            if (frame.regionSet.selectedRegion && frame.regionSet.selectedRegion.regionId !== 0) {
                return widgetRegion === frame.regionSet.selectedRegion.regionId;
            }
        }
        return false;
    }

    constructor(props: WidgetProps) {
        super(props);

        // Update widget title when region or coordinate changes
        autorun(() => {
            const appStore = this.props.appStore;
            if (this.widgetStore && appStore.activeFrame) {
                let regionString = "Unknown";
                const regionId = this.widgetStore.regionIdMap.get(appStore.activeFrame.frameInfo.fileId) || -1;

                if (regionId === -1) {
                    regionString = "Image";
                } else if (appStore.activeFrame.regionSet) {
                    const region = appStore.activeFrame.regionSet.regions.find(r => r.regionId === regionId);
                    if (region) {
                        regionString = region.nameString;
                    }
                }
                const selectedString = this.matchesSelectedRegion ? "(Selected)" : "";
                appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `Histogram Settings: ${regionString} ${selectedString}`);
            } else {
                appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `Histogram Settings`);
            }
        });
    }

    private handleLogScaleChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setLogScale(changeEvent.target.checked);
    };

    render() {
        const widgetStore = this.widgetStore;
        const lineSettingsProps: LinePlotSettingsPanelComponentProps = {
            darkMode: this.props.appStore.darkTheme,
            primaryDarkModeLineColor: Colors.BLUE4,
            primaryLineColor: widgetStore.primaryLineColor,
            lineWidth: widgetStore.lineWidth,
            plotType: widgetStore.plotType,
            linePlotPointSize: widgetStore.linePlotPointSize,
            setPrimaryLineColor: widgetStore.setPrimaryLineColor,
            setLineWidth: widgetStore.setLineWidth,
            setLinePlotPointSize: widgetStore.setLinePlotPointSize,
            setPlotType: widgetStore.setPlotType,
            isAutoScaledX: widgetStore.isAutoScaledX,
            isAutoScaledY: widgetStore.isAutoScaledY,
            clearXYBounds: widgetStore.clearXYBounds,
            logScaleY: widgetStore.logScaleY,
            handleLogScaleChanged: this.handleLogScaleChanged
        };
        return (
            <LinePlotSettingsPanelComponent {...lineSettingsProps}/>
        );
    }
}