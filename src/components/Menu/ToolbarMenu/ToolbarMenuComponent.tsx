import * as React from "react";
import * as GoldenLayout from "golden-layout";
import "./ToolbarMenuComponent.css";
import {AppStore} from "../../../stores/AppStore";
import {Button, Tooltip} from "@blueprintjs/core";
import {RenderConfigComponent} from "../../RenderConfig/RenderConfigComponent";
import {LogComponent} from "../../Log/LogComponent";
import {WidgetConfig} from "../../../stores/FloatingWidgetStore";
import {AnimatorComponent} from "../../Animator/AnimatorComponent";

export class ToolbarMenuComponent extends React.Component<{ appStore: AppStore }> {
    private createdDragSources = false;

    private createDragSource(layout: GoldenLayout, widgetConfig: WidgetConfig, elementId: string) {
        const glConfig: GoldenLayout.ReactComponentConfig = {
            type: "react-component",
            component: widgetConfig.type,
            title: widgetConfig.title,
            id: `${widgetConfig.id}-docked`,
            isClosable: widgetConfig.isCloseable,
            props: {appStore: this.props.appStore, id: `${widgetConfig.id}-docked`, docked: true}
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

        const layout = this.props.appStore.layoutSettings.layout;
        if (layout && !this.createdDragSources) {
            this.createDragSource(layout, RenderConfigComponent.WIDGET_CONFIG, "renderConfigButton");
            this.createDragSource(layout, LogComponent.WIDGET_CONFIG, "logButton");
            this.createDragSource(layout, AnimatorComponent.WIDGET_CONFIG, "animatorButton");
            this.createdDragSources = true;
        }
    }

    createRenderWidget = () => {
        this.createWidget(RenderConfigComponent.WIDGET_CONFIG);
    };

    createLogWidget = () => {
        this.createWidget(LogComponent.WIDGET_CONFIG);
    };

    createAnimatorWidget = () => {
        this.createWidget(AnimatorComponent.WIDGET_CONFIG);
    };

    createWidget = (widgetConfig: WidgetConfig) => {
        const floatingWidgetStore = this.props.appStore.floatingWidgetStore;
        const existingRenderWidgets = floatingWidgetStore.widgets.filter(w => w.type === widgetConfig.type);
        widgetConfig.id = `${widgetConfig.id}-${existingRenderWidgets.length}`;
        floatingWidgetStore.addWidget(widgetConfig);
    };

    public render() {
        return (
            <div className="toolbar-menu">
                <Tooltip content="Render Config Widget">
                    <Button icon={"style"} id="renderConfigButton" minimal={true} onClick={this.createRenderWidget}/>
                </Tooltip>
                <Tooltip content="Log Widget">
                    <Button icon={"application"} id="logButton" minimal={true} onClick={this.createLogWidget}/>
                </Tooltip>
                <Tooltip content="Animator Widget">
                    <Button icon={"layers"} id="animatorButton" minimal={true} onClick={this.createAnimatorWidget}/>
                </Tooltip>
            </div>
        );
    }
}