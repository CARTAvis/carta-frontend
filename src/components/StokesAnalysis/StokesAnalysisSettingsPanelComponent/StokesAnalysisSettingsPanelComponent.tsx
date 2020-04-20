import * as React from "react";
import {computed, autorun} from "mobx";
import {observer} from "mobx-react";
import {Colors, Tab, Tabs} from "@blueprintjs/core";
import {LinePlotSettingsPanelComponent, LinePlotSettingsPanelComponentProps, ScatterPlotSettingsPanelComponentProps, ScatterPlotSettingsPanelComponent, SpectralSettingsComponent} from "components/Shared";
import {StokesAnalysisWidgetStore} from "stores/widgets";
import {WidgetProps, WidgetConfig, HelpType} from "stores";
import "./StokesAnalysisSettingsPanelComponent.css";

@observer
export class StokesAnalysisSettingsPanelComponent extends React.Component<WidgetProps> {

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "stokes-floating-settings",
            type: "floating-settings",
            minWidth: 350,
            minHeight: 300,
            defaultWidth: 550,
            defaultHeight: 450,
            title: "stokes-settings",
            isCloseable: true,
            parentId: "stokes",
            parentType: "stokes",
            helpType: HelpType.STOKES_ANALYSIS_SETTINGS
        };
    }

    @computed get widgetStore(): StokesAnalysisWidgetStore {
        if (this.props.appStore && this.props.appStore.widgetsStore.stokesAnalysisWidgets) {
            const widgetStore = this.props.appStore.widgetsStore.stokesAnalysisWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return null;
    }

    constructor(props: WidgetProps) {
        super(props);

        autorun(() => {
            if (this.widgetStore) {
                const appStore = this.props.appStore;
                const frame = appStore.activeFrame;
                if (frame) {
                    const regionId = this.widgetStore.effectiveRegionId;
                    const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    const selectedString = this.widgetStore.matchesSelectedRegion ? "(Active)" : "";
                    this.props.appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `Stokes Analysis Settings: ${regionString} ${selectedString}`);
                }
            }
        });
    }

    handleEqualAxesValuesChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setEqualAxesValue(changeEvent.target.checked);
    };

    render() {
        const appStore = this.props.appStore;
        const widgetStore = this.widgetStore;
        const lineSettingsProps: LinePlotSettingsPanelComponentProps = {
            darkMode: appStore.darkTheme,
            primaryDarkModeLineColor: Colors.BLUE4,
            primaryLineColor: widgetStore.primaryLineColor,
            lineWidth: widgetStore.lineWidth,
            plotType: widgetStore.plotType,
            linePlotPointSize: widgetStore.linePlotPointSize,
            setPrimaryLineColor: widgetStore.setPrimaryLineColor,
            setLineWidth: widgetStore.setLineWidth,
            setLinePlotPointSize: widgetStore.setLinePlotPointSize,
            setPlotType: widgetStore.setPlotType,
            secondaryDarkModeLineColor: Colors.ORANGE4,
            secondaryLineColor: widgetStore.secondaryLineColor,
            setSecondaryLineColor: widgetStore.setSecondaryLineColor
        };

        const scatterSettingsProrps: ScatterPlotSettingsPanelComponentProps = {
            colorMap: widgetStore.colorMap,
            scatterPlotPointSize: widgetStore.scatterPlotPointSize,
            pointTransparency: widgetStore.pointTransparency,
            equalAxes: widgetStore.equalAxes,
            setPointTransparency:  widgetStore.setPointTransparency,
            setScatterPlotPointSize: widgetStore.setScatterPlotPointSize,
            setColormap: widgetStore.setColormap,
            handleEqualAxesValuesChanged: this.handleEqualAxesValuesChanged
        };

        const hasStokes = appStore.activeFrame && appStore.activeFrame.hasStokes;

        return (
            <div className="stokes-settings">
                <Tabs id="spectralSettingTabs">
                    <Tab id="conversion" title="Conversion" panel={<SpectralSettingsComponent appStore={appStore} widgetStore={widgetStore} disable={!hasStokes}/>}/>
                    <Tab id="linePlotStyling" title="Line Plot Styling" panel={<LinePlotSettingsPanelComponent {...lineSettingsProps}/>}/>
                    <Tab id="scatterPlotStyling" title="Scatter Plot Styling" panel={<ScatterPlotSettingsPanelComponent {...scatterSettingsProrps}/>}/>
                </Tabs>
            </div>
        );
    }
}