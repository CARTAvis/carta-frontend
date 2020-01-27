import * as React from "react";
import {observer} from "mobx-react";
import {Button, ButtonGroup, Tooltip} from "@blueprintjs/core";
import {AppStore, WidgetConfig} from "stores";
import {AnimatorComponent, HistogramComponent, LayerListComponent, LogComponent, RegionListComponent, RenderConfigComponent, SpatialProfilerComponent, SpectralProfilerComponent, StatsComponent, StokesAnalysisComponent} from "components";
import "./ToolbarMenuComponent.css";

@observer
export class ToolbarMenuComponent extends React.Component<{ appStore: AppStore }> {
    public static get DRAGSOURCE_WIDGETCONFIG_MAP(): Map<string, WidgetConfig> {
        return new Map<string, WidgetConfig>([
            ["renderConfigButton", RenderConfigComponent.WIDGET_CONFIG],
            ["layerListButton", LayerListComponent.WIDGET_CONFIG],
            ["logButton", LogComponent.WIDGET_CONFIG],
            ["animatorButton", AnimatorComponent.WIDGET_CONFIG],
            ["regionListButton", RegionListComponent.WIDGET_CONFIG],
            ["spatialProfilerButton", SpatialProfilerComponent.WIDGET_CONFIG],
            ["spectralProfilerButton", SpectralProfilerComponent.WIDGET_CONFIG],
            ["statsButton", StatsComponent.WIDGET_CONFIG],
            ["histogramButton", HistogramComponent.WIDGET_CONFIG],
            ["stokesAnalysisButton", StokesAnalysisComponent.WIDGET_CONFIG],
        ]);
    }

    public render() {
        let className = "toolbar-menu";
        let dialogClassName = "dialog-toolbar-menu";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
            dialogClassName += " bp3-dark";
        }

        const dialogStore = this.props.appStore.dialogStore;

        const commonTooltip = <span><br/><i><small>Drag to place docked widget<br/>Click to place a floating widget</small></i></span>;
        return (
            <React.Fragment>
                <ButtonGroup className={className}>
                    <Tooltip content={<span>Region List Widget{commonTooltip}</span>}>
                        <Button icon={"th-list"} id="regionListButton" onClick={this.props.appStore.widgetsStore.createFloatingRegionListWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Log Widget{commonTooltip}</span>}>
                        <Button icon={"application"} id="logButton" onClick={this.props.appStore.widgetsStore.createFloatingLogWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Spatial Profiler{commonTooltip}</span>}>
                        <Button icon={"pulse"} id="spatialProfilerButton" className={"profiler-button"} onClick={this.props.appStore.widgetsStore.createFloatingSpatialProfilerWidget}>
                            xy
                        </Button>
                    </Tooltip>
                    <Tooltip content={<span>Spectral Profiler{commonTooltip}</span>}>
                        <Button icon={"pulse"} id="spectralProfilerButton" className={"profiler-button"} onClick={this.props.appStore.widgetsStore.createFloatingSpectralProfilerWidget}>
                            &nbsp;z
                        </Button>
                    </Tooltip>
                    <Tooltip content={<span>Statistics Widget{commonTooltip}</span>}>
                        <Button icon={"calculator"} id="statsButton" onClick={this.props.appStore.widgetsStore.createFloatingStatsWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Histogram Widget{commonTooltip}</span>}>
                        <Button icon={"timeline-bar-chart"} id="histogramButton" onClick={this.props.appStore.widgetsStore.createFloatingHistogramWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Animator Widget{commonTooltip}</span>}>
                        <Button icon={"video"} id="animatorButton" onClick={this.props.appStore.widgetsStore.createFloatingAnimatorWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Render Config Widget{commonTooltip}</span>}>
                        <Button icon={"style"} id="renderConfigButton" onClick={this.props.appStore.widgetsStore.createFloatingRenderWidget}/>
                    </Tooltip>
                    <Tooltip content={<span>Stokes Analysis Widget{commonTooltip}</span>}>
                        <Button icon={"pulse"} id="stokesAnalysisButton" className={"profiler-button"} onClick={this.props.appStore.widgetsStore.createFloatingStokesWidget}>
                            &nbsp;s
                        </Button>
                    </Tooltip>
                    <Tooltip content={<span>Layer List Widget{commonTooltip}</span>}>
                        <Button icon={"layers"} id="layerListButton" onClick={this.props.appStore.widgetsStore.createFloatingLayerListWidget}/>
                    </Tooltip>
                </ButtonGroup>
                <ButtonGroup className={dialogClassName}>
                    <Tooltip content={<span>File Info</span>}>
                        <Button icon={"info-sign"} onClick={dialogStore.showFileInfoDialog} className={dialogStore.fileInfoDialogVisible ? "bp3-active" : ""}/>
                    </Tooltip>
                    <Tooltip content={<span>Preference</span>}>
                        <Button icon={"properties"} onClick={dialogStore.showPreferenceDialog} className={dialogStore.preferenceDialogVisible ? "bp3-active" : ""}/>
                    </Tooltip>
                    <Tooltip content={<span>Overlay Settings</span>}>
                        <Button icon={"settings"} onClick={dialogStore.showOverlaySettings} className={dialogStore.overlaySettingsDialogVisible ? "bp3-active" : ""}/>
                    </Tooltip>
                    <Tooltip content={<span>Contours</span>}>
                        <Button icon={"heatmap"} onClick={dialogStore.showContourDialog} className={dialogStore.contourDialogVisible ? "bp3-active" : ""}/>
                    </Tooltip>
                    <Tooltip content={<span>Debug Execution</span>}>
                        <Button icon={"console"} onClick={dialogStore.showDebugExecutionDialog} className={dialogStore.debugExecutionDialogVisible ? "bp3-active" : ""}/>
                    </Tooltip>
                </ButtonGroup>
            </React.Fragment>
        );
    }
}