import * as React from "react";
import {Tab, Tabs} from "@blueprintjs/core";
import {autorun, computed} from "mobx";
import {observer} from "mobx-react";

import {LinePlotSettingsPanelComponent, LinePlotSettingsPanelComponentProps, ScatterPlotSettingsPanelComponent, ScatterPlotSettingsPanelComponentProps, SmoothingSettingsComponent, SpectralSettingsComponent} from "components/Shared";
import {LineKey} from "models";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
import {StokesAnalysisWidgetStore} from "stores/Widgets";

import "./StokesAnalysisSettingsPanelComponent.scss";

export enum StokesAnalysisSettingsTabs {
    CONVERSION,
    LINE_PLOT_STYLING,
    SCATTER_PLOT_STYLING,
    SMOOTHING
}

@observer
export class StokesAnalysisSettingsPanelComponent extends React.Component<WidgetProps> {
    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "stokes-floating-settings",
            type: "floating-settings",
            minWidth: 350,
            minHeight: 300,
            defaultWidth: 475,
            defaultHeight: 450,
            title: "stokes-settings",
            isCloseable: true,
            parentId: "stokes",
            parentType: "stokes",
            helpType: [HelpType.STOKES_ANALYSIS_SETTINGS_CONVERSION, HelpType.STOKES_ANALYSIS_SETTINGS_LINE_PLOT_STYLING, HelpType.STOKES_ANALYSIS_SETTINGS_SCATTER_PLOT_STYLING, HelpType.STOKES_ANALYSIS_SETTINGS_SMOOTHING]
        };
    }

    @computed get widgetStore(): StokesAnalysisWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.stokesAnalysisWidgets) {
            const widgetStore = widgetsStore.stokesAnalysisWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return null;
    }

    constructor(props: WidgetProps) {
        super(props);
        const appStore = AppStore.Instance;

        autorun(() => {
            if (this.widgetStore) {
                const frame = this.widgetStore.effectiveFrame;
                if (frame) {
                    const regionId = this.widgetStore.effectiveRegionId;
                    const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    const selectedString = this.widgetStore.matchesSelectedRegion ? "(Active)" : "";
                    appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `Stokes Analysis Settings: ${regionString} ${selectedString}`);
                }
            }
        });
    }

    handleEqualAxesValuesChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setEqualAxesValue(changeEvent.target.checked);
    };

    handleInvertedColorMapChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setInvertedColorMap(changeEvent.target.checked);
    };
    handleSelectedTabChanged = (newTabId: React.ReactText) => {
        this.widgetStore.setSettingsTabId(Number.parseInt(newTabId.toString()));
    };

    render() {
        const widgetStore = this.widgetStore;
        const lineSettingsProps: LinePlotSettingsPanelComponentProps = {
            lineColorMap: new Map<LineKey, string>([
                ["Primary", widgetStore.primaryLineColor],
                ["Secondary", widgetStore.secondaryLineColor]
            ]),
            lineOptions: [
                {value: "Primary", label: "Primary"},
                {value: "Secondary", label: "Secondary"}
            ],
            lineWidth: widgetStore.lineWidth,
            plotType: widgetStore.plotType,
            linePlotPointSize: widgetStore.linePlotPointSize,
            setLineColor: (lineKey: LineKey, color: string) => {
                if (lineKey === "Primary") {
                    widgetStore.setPrimaryLineColor(color);
                } else if (lineKey === "Secondary") {
                    widgetStore.setSecondaryLineColor(color);
                }
            },
            setLineWidth: widgetStore.setLineWidth,
            setLinePlotPointSize: widgetStore.setLinePlotPointSize,
            setPlotType: widgetStore.setPlotType
        };

        const scatterSettingsProps: ScatterPlotSettingsPanelComponentProps = {
            colorMap: widgetStore.colorMap,
            scatterPlotPointSize: widgetStore.scatterPlotPointSize,
            pointTransparency: widgetStore.pointTransparency,
            equalAxes: widgetStore.equalAxes,
            setPointTransparency: widgetStore.setPointTransparency,
            setScatterPlotPointSize: widgetStore.setScatterPlotPointSize,
            setColormap: widgetStore.setColormap,
            handleEqualAxesValuesChanged: this.handleEqualAxesValuesChanged,
            invertedColorMap: widgetStore.invertedColorMap,
            handleInvertedColorMapChanged: this.handleInvertedColorMapChanged
        };

        const hasStokes = widgetStore.effectiveFrame && widgetStore.effectiveFrame.hasStokes;

        return (
            <div className="stokes-settings">
                <Tabs id="spectralSettingTabs" selectedTabId={widgetStore.settingsTabId} onChange={this.handleSelectedTabChanged}>
                    <Tab
                        id={StokesAnalysisSettingsTabs.CONVERSION}
                        title="Conversion"
                        panel={<SpectralSettingsComponent frame={widgetStore.effectiveFrame} onSpectralCoordinateChange={widgetStore.setSpectralCoordinate} onSpectralSystemChange={widgetStore.setSpectralSystem} disable={!hasStokes} />}
                    />
                    <Tab id={StokesAnalysisSettingsTabs.LINE_PLOT_STYLING} title="Line Plot Styling" panel={<LinePlotSettingsPanelComponent {...lineSettingsProps} />} />
                    <Tab id={StokesAnalysisSettingsTabs.SCATTER_PLOT_STYLING} title="Scatter Plot Styling" panel={<ScatterPlotSettingsPanelComponent {...scatterSettingsProps} />} />
                    <Tab id={StokesAnalysisSettingsTabs.SMOOTHING} title="Smoothing" panel={<SmoothingSettingsComponent smoothingStore={widgetStore.smoothingStore} diableStyle={true} diableDecimation={true} />} />
                </Tabs>
            </div>
        );
    }
}
