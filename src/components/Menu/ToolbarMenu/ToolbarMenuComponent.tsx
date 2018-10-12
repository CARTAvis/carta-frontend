import * as React from "react";
import * as GoldenLayout from "golden-layout";
import {observer} from "mobx-react";
import {Button, Tooltip} from "@blueprintjs/core";
import {AppStore} from "../../../stores/AppStore";
import {WidgetConfig} from "../../../stores/WidgetsStore";
import {RenderConfigComponent} from "../../RenderConfig/RenderConfigComponent";
import {LogComponent} from "../../Log/LogComponent";
import {AnimatorComponent} from "../../Animator/AnimatorComponent";
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
            this.createdDragSources = true;
        }
    }

    createRenderWidget = () => {
        let config = RenderConfigComponent.WIDGET_CONFIG;
        config.id = this.props.appStore.widgetsStore.addNewRenderConfigWidget();
        this.props.appStore.widgetsStore.addFloatingWidget(config);
    };

    createLogWidget = () => {
        this.props.appStore.widgetsStore.addFloatingWidget(LogComponent.WIDGET_CONFIG);
    };

    createAnimatorWidget = () => {
        this.props.appStore.widgetsStore.addFloatingWidget(AnimatorComponent.WIDGET_CONFIG);
    };

    public render() {
        let className = "toolbar-menu";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }
        return (
            <div className={className}>
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