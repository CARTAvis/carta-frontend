import * as React from "react";
import { observable } from "mobx";
import { observer } from "mobx-react";
import { NonIdealState } from "@blueprintjs/core";
import { Cell, Column, RowHeaderCell, SelectionModes, Table } from "@blueprintjs/table";
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
        const frames = this.props.appStore.frames;
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

        const rowHeaderCellRenderer = (rowIndex: number) => {
            return <RowHeaderCell name={rowIndex.toString()}/>;
        };
        const fileNameRenderer = (rowIndex: number) => {
            return <Cell>{rowIndex >= 0 && rowIndex < frameNum && frameNames[rowIndex] ? frameNames[rowIndex].label  : ""}</Cell>;
        };
        const channelRenderer = (rowIndex: number) => {
            return <Cell>{rowIndex >= 0 && rowIndex < frameNum && frames[rowIndex] ? frames[rowIndex].channel  : ""}</Cell>;
        };
        const stokesRenderer = (rowIndex: number) => {
            return <Cell>{rowIndex >= 0 && rowIndex < frameNum && frames[rowIndex] ? frames[rowIndex].stokes  : ""}</Cell>;
        };

        return (
            <div className="layer-list-widget">
                <Table
                    numRows={frameNum}
                    rowHeaderCellRenderer={rowHeaderCellRenderer}
                    enableRowHeader={true}
                    enableRowReordering={true}
                    selectionModes={SelectionModes.ROWS_ONLY}
                    enableMultipleSelection={true}
                    onRowsReordered={this.handleFileReordered}
                >
                    <Column name="File name" cellRenderer={fileNameRenderer}/>
                    <Column name="Type"/>
                    <Column name="Channel" cellRenderer={channelRenderer}/>
                    <Column name="Stokes" cellRenderer={stokesRenderer}/>
                    <Column name=""/>
                </Table>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}