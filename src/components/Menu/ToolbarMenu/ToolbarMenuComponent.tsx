import * as React from "react";
import * as GoldenLayout from "golden-layout";
import {observer} from "mobx-react";
import {Button, ButtonGroup, Tooltip} from "@blueprintjs/core";
import {AppStore} from "../../../stores/AppStore";
import {WidgetConfig} from "../../../stores/WidgetsStore";
import {RenderConfigComponent} from "../../RenderConfig/RenderConfigComponent";
import {LogComponent} from "../../Log/LogComponent";
import {AnimatorComponent} from "../../Animator/AnimatorComponent";
import "./ToolbarMenuComponent.css";
import {SpatialProfilerComponent} from "../../SpatialProfiler/SpatialProfilerComponent";
import {SpectralProfilerComponent} from "../../SpectralProfiler/SpectralProfilerComponent";

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
            this.createDragSource(layout, SpatialProfilerComponent.WIDGET_CONFIG, "spatialProfilerButton");
            this.createDragSource(layout, SpectralProfilerComponent.WIDGET_CONFIG, "spectralProfilerButton");
            this.createdDragSources = true;
        }
    }

    public render() {
        let className = "toolbar-menu";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }
        return (
            <ButtonGroup className={className}>
                <Tooltip content="Render Config Widget">
                    <Button icon={"style"} id="renderConfigButton" onClick={this.props.appStore.widgetsStore.createFloatingRenderWidget}/>
                </Tooltip>
                <Tooltip content="Log Widget">
                    <Button icon={"application"} id="logButton" onClick={this.props.appStore.widgetsStore.createFloatingLogWidget}/>
                </Tooltip>
                <Tooltip content="Animator Widget">
                    <Button icon={"layers"} id="animatorButton" onClick={this.props.appStore.widgetsStore.createFloatingAnimatorWidget}/>
                </Tooltip>
                <Tooltip content="Spatial Profiler">
                    <Button icon={"timeline-line-chart"} id="spatialProfilerButton" onClick={this.props.appStore.widgetsStore.createFloatingSpatialProfilerWidget}/>
                </Tooltip>
                <Tooltip content="Spectral Profiler">
                    <Button icon={"step-chart"} id="spectralProfilerButton" onClick={this.props.appStore.widgetsStore.createFloatingSpectralProfilerWidget}/>
                </Tooltip>
            </ButtonGroup>
        );
    }
}