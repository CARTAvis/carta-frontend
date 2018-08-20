// Based on code from https://github.com/palantir/blueprint/issues/336
import * as React from "react";
import "./ResizableDialogComponent.css";
import {Rnd} from "react-rnd";
import {Dialog, IDialogProps} from "@blueprintjs/core";

export class ResizableDialogComponentProps {
    dialogProps: IDialogProps;
    defaultWidth: number;
    defaultHeight: number;
}

export class ResizableDialogComponent extends React.Component<ResizableDialogComponentProps> {
    render() {
        const w = window,
            d = document,
            e = d.documentElement,
            g = d.getElementsByTagName("body")[0],
            windowWidth = w.innerWidth || e.clientWidth || g.clientWidth,
            windowHeight = w.innerHeight || e.clientHeight || g.clientHeight;
        return (
            <div className={"resizable-dialog"}>
                {this.props.dialogProps.isOpen &&
                <Rnd
                    bounds={".gl-container"}
                    resizeGrid={[25, 25]}
                    default={{
                        x: Math.max((windowWidth - this.props.defaultWidth) / 2, 0),
                        y: Math.max((windowHeight - this.props.defaultHeight) / 2, 0),
                        width: Math.min(this.props.defaultWidth, windowWidth),
                        height: Math.min(this.props.defaultHeight, windowHeight)
                    }}
                    dragHandleClassName={"bp3-dialog-header"}
                >
                    <Dialog hasBackdrop={false} usePortal={false} {...this.props.dialogProps} children={this.props.children}/>
                </Rnd>
                }
            </div>
        );
    }
}