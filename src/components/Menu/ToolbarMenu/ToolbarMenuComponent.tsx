import * as React from "react";
import * as GoldenLayout from "golden-layout";
import {observer} from "mobx-react";
import {Button, ButtonGroup, Tooltip} from "@blueprintjs/core";
import {AppStore, WidgetConfig} from "stores";
import {AnimatorComponent, HistogramComponent, LogComponent, RegionListComponent, RenderConfigComponent, SpatialProfilerComponent, SpectralProfilerComponent, StatsComponent, StokesAnalysisComponent} from "components";
import "./ToolbarMenuComponent.css";

@observer
export class ToolbarMenuComponent extends React.Component<{ appStore: AppStore }> {
    private createdDragSources = false;

    private createDragSource(layout: GoldenLayout, widgetConfig: WidgetConfig, elementId: string) {
        const glConfig: GoldenLayout.ReactComponentConfig = {
            type: "react-component",
            component: widgetConfig.type,
            title: widgetConfig.title,
            id: widgetConfig.id,
            isClosable: widgetConfig.isCloseable,
            props: {appStore: this.props.appStore, id: widgetConfig.id, docked: true}
        };

        const widgetElement = document.getElementById(elementId);
        if (widgetElement) {
            layout.createDragSource(widgetElement, glConfig);
        }
    }

    componentDidUpdate() {
        if (this.createdDragSources) {
            return;
        }

        const layout = this.props.appStore.widgetsStore.dockedLayout;
        if (layout && !this.createdDragSources) {
            this.createDragSource(layout, RenderConfigComponent.WIDGET_CONFIG, "renderConfigButton");
            this.createDragSource(layout, LogComponent.WIDGET_CONFIG, "logButton");
            this.createDragSource(layout, AnimatorComponent.WIDGET_CONFIG, "animatorButton");
            this.createDragSource(layout, RegionListComponent.WIDGET_CONFIG, "regionListButton");
            this.createDragSource(layout, SpatialProfilerComponent.WIDGET_CONFIG, "spatialProfilerButton");
            this.createDragSource(layout, SpectralProfilerComponent.WIDGET_CONFIG, "spectralProfilerButton");
            this.createDragSource(layout, StatsComponent.WIDGET_CONFIG, "statsButton");
            this.createDragSource(layout, HistogramComponent.WIDGET_CONFIG, "histogramButton");
            this.createDragSource(layout, StokesAnalysisComponent.WIDGET_CONFIG, "stokesAnalysisButton");
            this.createdDragSources = true;
        }
    }

    public render() {
        let className = "toolbar-menu";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }

        const commonTooltip = <span><br/><i><small>Drag to place docked widget<br/>Click to place a floating widget</small></i></span>;
        return (
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
            </ButtonGroup>
        );
    }
}