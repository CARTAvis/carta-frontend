// Based on code from https://github.com/palantir/blueprint/issues/336
import * as React from "react";
import {ResizeEnable, Rnd} from "react-rnd";
import {Dialog, IDialogProps} from "@blueprintjs/core";
import "./DraggableDialogComponent.css";

export class ResizableDialogComponentProps {
    dialogProps: IDialogProps;
    defaultWidth: number;
    defaultHeight: number;
    minWidth?: number;
    minHeight?: number;
    enableResizing: boolean;
}

export class DraggableDialogComponent extends React.Component<ResizableDialogComponentProps> {
    render() {
        const w = window,
            d = document,
            e = d.documentElement,
            g = d.getElementsByTagName("body")[0],
            windowWidth = w.innerWidth || e.clientWidth || g.clientWidth,
            windowHeight = w.innerHeight || e.clientHeight || g.clientHeight;

        const resizeEnabled = this.props.enableResizing;
        const resizeSettings: ResizeEnable = {
            top: resizeEnabled,
            bottom: resizeEnabled,
            left: resizeEnabled,
            right: resizeEnabled,
            topLeft: resizeEnabled,
            topRight: resizeEnabled,
            bottomLeft: resizeEnabled,
            bottomRight: resizeEnabled
        };

        return (
            <div className={"draggable-dialog"}>
                {this.props.dialogProps.isOpen &&
                <Rnd
                    enableResizing={resizeSettings}
                    bounds={".gl-container"}
                    dragGrid={[1, 1]}
                    resizeGrid={[25, 25]}
                    default={{
                        x: Math.floor(Math.max((windowWidth - this.props.defaultWidth) / 2, 0)),
                        y: Math.floor(Math.max((windowHeight - this.props.defaultHeight) / 2, 0)),
                        width: Math.min(this.props.defaultWidth, windowWidth),
                        height: Math.min(this.props.defaultHeight, windowHeight)
                    }}
                    minWidth={this.props.minWidth}
                    minHeight={this.props.minHeight}
                    dragHandleClassName={"bp3-dialog-header"}
                >
                    <Dialog hasBackdrop={false} usePortal={false} {...this.props.dialogProps} children={this.props.children} enforceFocus={false} autoFocus={false}/>
                </Rnd>
                }
            </div>
        );
    }
}