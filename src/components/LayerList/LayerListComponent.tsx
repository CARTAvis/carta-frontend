import * as React from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";
import { NonIdealState } from "@blueprintjs/core";
import ReactResizeDetector from "react-resize-detector";
import { WidgetConfig, WidgetProps } from "stores";
import "./LayerListComponent.css";

@observer
export class LayerListComponent extends React.Component<WidgetProps> {
    @observable width: number = 0;
    @observable height: number = 0;

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "layer-list",
            type: "layer-list",
            minWidth: 350,
            minHeight: 180,
            defaultWidth: 650,
            defaultHeight: 180,
            title: "Layer List",
            isCloseable: true
        };
    }

    private onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
    };

    render() {
        const frames = this.props.appStore.frames;

        if (frames.length === 0) {
            return (
                <div className="layer-list-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>;
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
                </div>
            );
        }

        return (
            <div className="layer-list-widget">
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}