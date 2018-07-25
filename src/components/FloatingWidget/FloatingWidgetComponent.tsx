import * as React from "react";
import "./FloatingWidgetComponent.css";
import Rnd from "react-rnd";
import {Icon} from "@blueprintjs/core";
import * as GoldenLayout from "golden-layout";
import {AppStore} from "../../stores/AppStore";

class FloatingWidgetComponentProps {
    title: string;
    layout: GoldenLayout;
    type: string;
    id: string;
    appStore: AppStore;
    minWidth: number;
    minHeight: number;
    children?: any;
    zIndex?: number;
    isSelected?: boolean;
    onSelected?: () => void;
    onClosed?: () => void;
}

export class FloatingWidgetComponent extends React.Component<FloatingWidgetComponentProps> {

    private pinElementRef: HTMLElement;
    private createdDragSources = false;

    componentDidUpdate() {
        if (this.createdDragSources) {
            console.log("Already created drag sources, skipping...");
        }

        if (this.props.layout && !this.createdDragSources) {
            // Render config widget
            let widgetConfig: GoldenLayout.ItemConfigType;

            if (this.props.type === "render-config") {
                widgetConfig = {
                    type: "react-component",
                    component: "render-config",
                    title: "Render Configuration",
                    id: this.props.id,
                    props: {appStore: this.props.appStore, id: this.props.id, docked: true}
                };
            }
            else if (this.props.type === "log") {
                widgetConfig = {
                    type: "react-component",
                    component: "log",
                    title: "Log",
                    id: this.props.id,
                    props: {appStore: this.props.appStore, id: this.props.id, docked: true}
                };
            }

            if (this.pinElementRef && widgetConfig) {
                this.props.layout.createDragSource(this.pinElementRef, widgetConfig);
            }

            this.createdDragSources = true;
        }
    }

    constructor(props: FloatingWidgetComponentProps) {
        super(props);
    }

    public render() {
        const headerHeight = 24;
        const titleClass = this.props.isSelected ? "floating-header selected" : "floating-header";
        return (
            <Rnd
                className="floating-widget"
                style={{zIndex: this.props.zIndex}}
                default={{
                    x: 100,
                    y: 100,
                    width: 320,
                    height: 200,
                }}
                minWidth={this.props.minWidth}
                minHeight={this.props.minHeight + headerHeight}
                bounds={".App"}
                dragHandleClassName={"floating-title"}
                onMouseDown={this.props.onSelected}
            >
                <div className={titleClass}>
                    <div className={"floating-title"}>
                        {this.props.title}
                    </div>
                    <div className="floating-header-button" ref={ref => this.pinElementRef = ref}>
                        <Icon icon={"pin"}/>
                    </div>
                    <div onMouseDown={this.props.onClosed} className="floating-header-button">
                        <Icon icon={"cross"}/>
                    </div>
                </div>
                <div className="floating-content">
                    {this.props.children}
                </div>
            </Rnd>
        );
    }
}