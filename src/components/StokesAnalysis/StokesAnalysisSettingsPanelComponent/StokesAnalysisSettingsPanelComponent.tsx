import * as React from "react";
import {Tab, Tabs} from "@blueprintjs/core";
import {autorun, type IReactionDisposer, makeObservable} from "mobx";
import {observer} from "mobx-react";
import type {LineKey} from "models";

import {
    LinePlotSettingsPanelComponent,
    type LinePlotSettingsPanelComponentProps,
    ScatterPlotSettingsPanelComponent,
    type ScatterPlotSettingsPanelComponentProps,
    ScrollShadow,
    SmoothingSettingsComponent,
    SpectralSettingsComponent
} from "components/Shared";
import {HelpType, StokesAnalysisSettingsTabs} from "enums";
import {AppStore, type DefaultWidgetConfig, type WidgetProps, WidgetsStore} from "stores";
import {type StokesAnalysisWidgetStore} from "stores/Widgets";

import "./StokesAnalysisSettingsPanelComponent.scss";

@observer
export class StokesAnalysisSettingsPanelComponent extends React.Component<WidgetProps> {
    private widgetId: string;
    private floatingSettingsId: string | undefined;
    private cachedWidgetStore: StokesAnalysisWidgetStore | null = null;
    private readonly disposers: IReactionDisposer[] = [];

    public static get WidgetConfig(): DefaultWidgetConfig {
        return {
            id: "stokes-floating-settings",
            type: "floating-settings",
            minWidth: 470,
            minHeight: 300,
            defaultWidth: 475,
            defaultHeight: 400,
            title: "stokes-settings",
            isCloseable: true,
            parentId: "stokes",
            parentType: "stokes",
            helpType: [HelpType.STOKES_ANALYSIS_SETTINGS_CONVERSION, HelpType.STOKES_ANALYSIS_SETTINGS_LINE_PLOT_STYLING, HelpType.STOKES_ANALYSIS_SETTINGS_SCATTER_PLOT_STYLING, HelpType.STOKES_ANALYSIS_SETTINGS_SMOOTHING]
        };
    }

    get widgetStore(): StokesAnalysisWidgetStore | null {
        if (!this.cachedWidgetStore) {
            this.cachedWidgetStore = WidgetsStore.Instance.stokesAnalysisWidgets.get(this.widgetId) ?? null;
        }
        return this.cachedWidgetStore;
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);
        const appStore = AppStore.Instance;
        this.widgetId = props.id;
        this.floatingSettingsId = props.floatingSettingsId;

        this.disposers.push(
            autorun(() => {
                if (this.widgetStore && this.floatingSettingsId) {
                    const frame = this.widgetStore.effectiveFrame;
                    if (frame) {
                        const regionId = this.widgetStore.effectiveRegionId;
                        const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                        const selectedString = this.widgetStore.isMatchingSelectedRegion ? "(Active)" : "";
                        appStore.widgetsStore.setWidgetTitle(this.floatingSettingsId, `Stokes Analysis Settings: ${regionString} ${selectedString}`);
                    }
                }
            })
        );
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    }

    handleEqualAxesValuesChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore?.setEqualAxesValue(changeEvent.target.checked);
    };

    handleInvertedColorMapChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore?.setInvertedColorMap(changeEvent.target.checked);
    };

    handleSelectedTabChanged = (newTabId: React.ReactText) => {
        this.widgetStore?.setSettingsTabId(Number.parseInt(newTabId.toString()));
    };

    render() {
        const widgetStore = this.widgetStore;
        if (!widgetStore) {
            return null;
        }

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
            areAxesEqual: widgetStore.areAxesEqual,
            setPointTransparency: widgetStore.setPointTransparency,
            setScatterPlotPointSize: widgetStore.setScatterPlotPointSize,
            setColormap: widgetStore.setColormap,
            handleEqualAxesValuesChanged: this.handleEqualAxesValuesChanged,
            isColorMapInverted: widgetStore.isInvertedColorMap,
            handleInvertedColorMapChanged: this.handleInvertedColorMapChanged,
            shouldShowReferenceAxes: widgetStore.shouldShowReferenceAxes,
            referenceAxesThickness: widgetStore.referenceAxesThickness,
            referenceAxesColor: widgetStore.referenceAxesColor,
            setShowReferenceAxes: widgetStore.setShowReferenceAxes
        };

        const hasStokes = widgetStore.effectiveFrame && widgetStore.effectiveFrame.hasStokes;

        return (
            <ScrollShadow>
                <div className="stokes-settings">
                    <Tabs id="spectralSettingTabs" selectedTabId={widgetStore.settingsTabId} onChange={this.handleSelectedTabChanged}>
                        <Tab
                            id={StokesAnalysisSettingsTabs.CONVERSION}
                            title="Conversion"
                            panel={
                                widgetStore.effectiveFrame ? (
                                    <SpectralSettingsComponent
                                        frame={widgetStore.effectiveFrame}
                                        onSpectralCoordinateChange={widgetStore.setSpectralCoordinate}
                                        onSpectralSystemChange={widgetStore.setSpectralSystem}
                                        disable={!hasStokes || !widgetStore.effectiveFrame?.isSpectralChannel}
                                    />
                                ) : (
                                    <div>No frame available</div>
                                )
                            }
                        />
                        <Tab id={StokesAnalysisSettingsTabs.LINE_PLOT_STYLING} title="Line Plot Styling" panel={<LinePlotSettingsPanelComponent {...lineSettingsProps} />} />
                        <Tab id={StokesAnalysisSettingsTabs.SCATTER_PLOT_STYLING} title="Scatter Plot Styling" panel={<ScatterPlotSettingsPanelComponent {...scatterSettingsProps} />} />
                        <Tab id={StokesAnalysisSettingsTabs.SMOOTHING} title="Smoothing" panel={<SmoothingSettingsComponent smoothingStore={widgetStore.smoothingStore} diableStyle={true} diableDecimation={true} />} />
                    </Tabs>
                </div>
            </ScrollShadow>
        );
    }
}
