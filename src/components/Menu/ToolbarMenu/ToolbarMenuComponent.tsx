import * as React from "react";
import "./ToolbarMenuComponent.css";
import {AppStore} from "../../../stores/AppStore";
import {Button, Tooltip} from "@blueprintjs/core";

export class ToolbarMenuComponent extends React.Component<{ appStore: AppStore }> {
    private createdDragSources = false;

    componentDidUpdate() {
        if (this.createdDragSources) {
            return;
        }

        const layout = this.props.appStore.layoutSettings.layout;
        if (layout && !this.createdDragSources) {
            // Render config widget
            const renderConfigWidgetConfig = {
                type: "react-component",
                component: "render-config",
                title: "Render Configuration",
                id: "render-config-docked",
                props: {appStore: this.props.appStore, id: "render-config-docked", docked: true}
            };
            const renderConfigWidget = document.getElementById("renderConfigWidget");
            if (renderConfigWidget) {
                layout.createDragSource(renderConfigWidget, renderConfigWidgetConfig);
            }

            // Log widget
            const logWidgetConfig = {
                type: "react-component",
                component: "log",
                title: "Log",
                id: "log-docked",
                props: {appStore: this.props.appStore, id: "log-docked", docked: true}
            };
            const logWidget = document.getElementById("logWidget");
            if (logWidget) {
                layout.createDragSource(logWidget, logWidgetConfig);
            }

            this.createdDragSources = true;
        }
    }

    createRenderWidget = () => {
        const floatingWidgetStore = this.props.appStore.floatingWidgetStore;
        const existingRenderWidgets = floatingWidgetStore.widgets.filter(w => w.type === "render-config");

        floatingWidgetStore.addWidget({
            id: `render-config-${existingRenderWidgets.length}`,
            type: "render-config",
            minWidth: 250,
            minHeight: 200
        });
    };

    createLogWidget = () => {
        const floatingWidgetStore = this.props.appStore.floatingWidgetStore;
        const existingRenderWidgets = floatingWidgetStore.widgets.filter(w => w.type === "log");

        floatingWidgetStore.addWidget({
            id: `log-${existingRenderWidgets.length}`,
            type: "log",
            minWidth: 450,
            minHeight: 200
        });
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