import * as React from "react";
import * as GoldenLayout from "golden-layout";
import "./ToolbarMenuComponent.css";
import {AppStore} from "../../../stores/AppStore";
import {Button, Tooltip} from "@blueprintjs/core";
import {RenderConfigComponent} from "../../RenderConfig/RenderConfigComponent";
import {LogComponent} from "../../Log/LogComponent";
import {WidgetConfig} from "../../../stores/FloatingWidgetStore";

export class ToolbarMenuComponent extends React.Component<{ appStore: AppStore }> {
    private createdDragSources = false;

    componentDidUpdate() {
        if (this.createdDragSources) {
            return;
        }

        const layout = this.props.appStore.layoutSettings.layout;
        if (layout && !this.createdDragSources) {
            // Render config widget
            const renderConfigWidgetConfig: GoldenLayout.ReactComponentConfig = {
                type: "react-component",
                component: RenderConfigComponent.WIDGET_CONFIG.type,
                title: RenderConfigComponent.WIDGET_CONFIG.title,
                id: `${RenderConfigComponent.WIDGET_CONFIG.id}-docked`,
                isClosable: RenderConfigComponent.WIDGET_CONFIG.isCloseable,
                props: {appStore: this.props.appStore, id: `${RenderConfigComponent.WIDGET_CONFIG.id}-docked`, docked: true}
            };
            const renderConfigWidget = document.getElementById("renderConfigWidget");
            if (renderConfigWidget) {
                layout.createDragSource(renderConfigWidget, renderConfigWidgetConfig);
            }

            // Log widget
            const logWidgetConfig = {
                type: "react-component",
                component: LogComponent.WIDGET_CONFIG.type,
                title: LogComponent.WIDGET_CONFIG.title,
                id: `${LogComponent.WIDGET_CONFIG.id}-docked`,
                isClosable: LogComponent.WIDGET_CONFIG.isCloseable,
                props: {appStore: this.props.appStore, id: `${LogComponent.WIDGET_CONFIG.id}-docked`, docked: true}
            };
            const logWidget = document.getElementById("logWidget");
            if (logWidget) {
                layout.createDragSource(logWidget, logWidgetConfig);
            }

            this.createdDragSources = true;
        }
    }

    createRenderWidget = () => {
        this.createWidget(RenderConfigComponent.WIDGET_CONFIG);
    };

    createLogWidget = () => {
        this.createWidget(LogComponent.WIDGET_CONFIG);
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
                    <Button icon={"style"} id="renderConfigWidget" minimal={true} onClick={this.createRenderWidget}/>
                </Tooltip>
                <Tooltip content="Log Widget">
                    <Button icon={"application"} id="logWidget" minimal={true} onClick={this.createLogWidget}/>
                </Tooltip>
            </div>
        );
    }
}