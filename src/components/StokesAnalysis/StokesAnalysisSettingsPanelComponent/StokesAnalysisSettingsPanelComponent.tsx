import * as React from "react";
import {computed, autorun} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, Switch, Colors, NumericInput} from "@blueprintjs/core";
import {ColorResult} from "react-color";
import {ColormapComponent} from "components/RenderConfig/ColormapConfigComponent/ColormapComponent";
import {ColorPickerComponent, PlotTypeSelectorComponent, PlotType, LinePlotSettingsPanelComponent, LinePlotSettingsPanelComponentProps} from "components/Shared";
import {StokesAnalysisWidgetStore} from "stores/widgets";
import {WidgetProps, RegionStore, WidgetConfig} from "stores";
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
            defaultHeight: 530,
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

        const scatterPlotsSettings = (
            <React.Fragment>
                <FormGroup inline={true} label="Color Map">
                    <ColormapComponent
                        inverted={false}
                        selectedItem={widgetStore.colorMap}
                        onItemSelect={(selected) => { widgetStore.setColormap(selected); }}
                    />
                </FormGroup>
                <FormGroup  inline={true} label="Symbol Size" labelInfo="(px)">
                    <NumericInput
                            placeholder="Symbol Size"
                            min={StokesAnalysisWidgetStore.MIN_SCATTER_POINT_SIZE}
                            max={StokesAnalysisWidgetStore.MAX_POINT_SIZE}
                            value={widgetStore.scatterPlotPointSize}
                            stepSize={0.5}
                            onValueChange={(value: number) => widgetStore.setScatterPlotPointSize(value)}
                    />
                </FormGroup>
                <FormGroup  inline={true} label="Transparency">
                    <NumericInput
                            placeholder="transparency"
                            min={StokesAnalysisWidgetStore.MIN_POINT_TRANSPARENCY}
                            max={StokesAnalysisWidgetStore.MAX_POINT_TRANSPARENCY}
                            value={widgetStore.pointTransparency}
                            stepSize={0.1}
                            onValueChange={(value: number) => widgetStore.setPointTransparency(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label={"Equal Axes"}>
                    <Switch checked={widgetStore.equalAxes} onChange={this.handleEqualAxesValuesChanged}/>
                </FormGroup>
            </React.Fragment>
        );
        return (
            <React.Fragment>
                <div className="stokes-settings">
                    <p>Line Plots:</p>
                    <div className={"stokes-line-settings"}>
                        {widgetStore && <LinePlotSettingsPanelComponent {...lineSettingsProps}/>}
                    </div>
                    <p>Scatter Plot:</p>
                    <div className={"stokes-scatter-settings"}>
                        {widgetStore && scatterPlotsSettings}
                    </div>
                </div>
            </React.Fragment>
        );
    }
}