import * as React from "react";
import {computed, autorun} from "mobx";
import {observer} from "mobx-react";
import {FormGroup, Switch, Colors, NumericInput} from "@blueprintjs/core";
import {ColorResult} from "react-color";
import {ColormapComponent} from "components/RenderConfig/ColormapConfigComponent/ColormapComponent";
import {ColorPickerComponent, PlotTypeSelectorComponent, PlotType} from "components/Shared";
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

    private getThemeDefaultColor (darkThemeLineColor: string, lineColor: {colorHex: string, fixed: boolean}): string {
        if (this.props.appStore.darkTheme && !lineColor.fixed) {
            return darkThemeLineColor;
        }
        return lineColor.colorHex;
    }

    render() {
        const widgetStore = this.widgetStore;
        const linePlotsSettings = (
            <React.Fragment>
                <FormGroup inline={true} label="Primary Color">
                    <ColorPickerComponent
                        color={this.getThemeDefaultColor(Colors.BLUE4, widgetStore.primaryLineColor)}
                        presetColors={[...RegionStore.SWATCH_COLORS, "transparent"]}
                        setColor={(color: ColorResult) => {
                            widgetStore.setPrimaryLineColor(color.hex === "transparent" ? "#000000" : color.hex, true);
                        }}
                        disableAlpha={true}
                        darkTheme={this.props.appStore.darkTheme}
                    />
                </FormGroup>
                <FormGroup inline={true} label="Secondary Color">
                    <ColorPickerComponent
                        color={this.getThemeDefaultColor(Colors.ORANGE4, widgetStore.secondaryLineColor)}
                        presetColors={[...RegionStore.SWATCH_COLORS, "transparent"]}
                        setColor={(color: ColorResult) => {
                            widgetStore.setSecondaryLineColor(color.hex === "transparent" ? "#000000" : color.hex, true);
                        }}
                        disableAlpha={true}
                        darkTheme={this.props.appStore.darkTheme}
                    />
                </FormGroup>
                <FormGroup  inline={true} label="Line Width" labelInfo="(px)">
                    <NumericInput
                            placeholder="Line Width"
                            min={StokesAnalysisWidgetStore.MIN_LINE_WIDTH}
                            max={StokesAnalysisWidgetStore.MAX_LINE_WIDTH}
                            value={widgetStore.lineWidth}
                            stepSize={0.5}
                            disabled={widgetStore.plotType === PlotType.POINTS}
                            onValueChange={(value: number) => widgetStore.setLineWidth(value)}
                    />
                </FormGroup>
                <FormGroup  inline={true} label="Point Size" labelInfo="(px)">
                    <NumericInput
                            placeholder="Point Size"
                            min={StokesAnalysisWidgetStore.MIN_LINE_POINT_SIZE}
                            max={StokesAnalysisWidgetStore.MAX_POINT_SIZE}
                            value={widgetStore.linePlotPointSize}
                            stepSize={0.5}
                            disabled={widgetStore.plotType !== PlotType.POINTS}
                            onValueChange={(value: number) => widgetStore.setLinePlotPointSize(value)}
                    />
                </FormGroup>
                <FormGroup inline={true} label={"Use WCS Values"}>
                    <Switch checked={widgetStore.useWcsValues} onChange={this.handleWcsValuesChanged}/>
                </FormGroup>
                <FormGroup inline={true} label={"Line Style"}>
                    <PlotTypeSelectorComponent value={widgetStore.plotType} onValueChanged={widgetStore.setPlotType}/>
                </FormGroup>
            </React.Fragment>
        );

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
                        {widgetStore && linePlotsSettings}
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