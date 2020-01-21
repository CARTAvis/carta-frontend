import * as React from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";
import { NonIdealState } from "@blueprintjs/core";
import { Cell, Column, SelectionModes, Table } from "@blueprintjs/table";
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

    private handleFileReordered = (oldIndex: number, newIndex: number, length: number) => {
        if (oldIndex === newIndex) {
            return;
        }
        this.props.appStore.reorderFrame(oldIndex, newIndex, length);
    };

    render() {
        const frameNum = this.props.appStore.frameNum;
        const frameNames = this.props.appStore.frameNames;

        if (frameNum <= 0) {
            return (
                <div className="layer-list-widget">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>;
                    <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
                </div>
            );
        }

        const fileNameRenderer = (rowIndex: number) => {
            return <Cell>{rowIndex >= 0 && rowIndex < frameNum ? frameNames[rowIndex].label  : ""}</Cell>;
        };

        return (
            <div className="layer-list-widget">
                <Table
                    numRows={frameNum}
                    selectionModes={SelectionModes.ROWS_ONLY}
                    enableRowReordering={true}
                    onRowsReordered={this.handleFileReordered}
                >
                    <Column name="File name" cellRenderer={fileNameRenderer}/>
                    <Column name="Type" />
                    <Column name="Match FoV" />
                    <Column name="Match Channel" />
                    <Column name="Channel" />
                    <Column name="Stokes" />
                    <Column name="" />
                </Table>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}