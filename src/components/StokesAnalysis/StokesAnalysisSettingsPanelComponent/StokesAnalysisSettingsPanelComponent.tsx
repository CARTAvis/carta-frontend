import * as React from "react";
import {computed, autorun} from "mobx";
import {observer} from "mobx-react";
import {Colors} from "@blueprintjs/core";
import {LinePlotSettingsPanelComponent, LinePlotSettingsPanelComponentProps, ScatterPlotSettingsPanelComponentProps, ScatterPlotSettingsPanelComponent} from "components/Shared";
import {StokesAnalysisWidgetStore} from "stores/widgets";
import {WidgetProps, WidgetConfig} from "stores";
import "./StokesAnalysisSettingsPanelComponent.css";

@observer
export class StokesAnalysisSettingsPanelComponent extends React.Component<WidgetProps> {

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "stokes-floating-settings",
            type: "floating-settings",
            minWidth: 350,
            minHeight: 300,
            defaultWidth: 350,
            defaultHeight: 550,
            title: "stokes-settings",
            isCloseable: true,
            parentId: "stokes",
            parentType: "stokes"
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

        autorun(() => {
            if (this.widgetStore) {
                const appStore = this.props.appStore;
                const frame = appStore.activeFrame;
                if (frame) {
                    const regionId = this.widgetStore.regionIdMap.get(frame.frameInfo.fileId) || 0;
                    const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    const selectedString = this.matchesSelectedRegion ? "(Selected)" : "";
                    this.props.appStore.widgetsStore.setWidgetTitle(this.props.floatingSettingsId, `Stokes Analysis Settings: ${regionString} ${selectedString}`);
                }
            }
        });
    }

    handleWcsValuesChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setUseWcsValues(changeEvent.target.checked);
    };

    handleEqualAxesValuesChanged = (changeEvent: React.ChangeEvent<HTMLInputElement>) => {
        this.widgetStore.setEqualAxesValue(changeEvent.target.checked);
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
            useWcsValues: widgetStore.useWcsValues,
            setPrimaryLineColor: widgetStore.setPrimaryLineColor,
            setLineWidth: widgetStore.setLineWidth,
            setLinePlotPointSize: widgetStore.setLinePlotPointSize,
            handleWcsValuesChanged: this.handleWcsValuesChanged,
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

        return (
            <React.Fragment>
                <div className="stokes-settings">
                    <p>Line Plots:</p>
                    <div className={"stokes-line-settings"}>
                        <LinePlotSettingsPanelComponent {...lineSettingsProps}/>
                    </div>
                    <p>Scatter Plot:</p>
                    <div className={"stokes-scatter-settings"}>
                        <ScatterPlotSettingsPanelComponent {...scatterSettingsProrps}/>
                    </div>
                </div>
            </React.Fragment>
        );
    }
}