// Based on code from https://github.com/palantir/blueprint/issues/336
import * as React from "react";
import * as ReactDOM from "react-dom";
import {ResizeEnable, Rnd} from "react-rnd";
import {Dialog, IDialogProps, Button} from "@blueprintjs/core";
import "./DraggableDialogComponent.css";
import { AppStore, HelpType } from "stores";

export class ResizableDialogComponentProps {
    appStore: AppStore;
    dialogProps: IDialogProps;
    defaultWidth: number;
    defaultHeight: number;
    minWidth?: number;
    minHeight?: number;
    enableResizing: boolean;
    helpType?: HelpType;
}

export class DraggableDialogComponent extends React.Component<ResizableDialogComponentProps> {

    private dd: HTMLDivElement;

    componentDidUpdate() {
        const header = this.dd.getElementsByClassName("bp3-dialog-header");
        if (this.props.helpType && header.length > 0 && this.dd.getElementsByClassName("help-button").length === 0) {
            const helpButton = <Button icon="help" minimal={true} onClick={() => this.props.appStore.helpStore.showHelpDrawer(this.props.helpType)}/>;
            const helpButtonDiv = document.createElement("div") as HTMLDivElement;
            helpButtonDiv.setAttribute("class", "help-button");
            ReactDOM.render(helpButton, helpButtonDiv);
            const closeButton = this.dd.getElementsByClassName("bp3-dialog-close-button");
            if (closeButton.length > 0) {
                closeButton[0].before(helpButtonDiv);
            } else {
                header[0].append(helpButtonDiv);
            }
        }
    }

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
            <div className={"draggable-dialog"} ref={ref => this.dd = ref}>
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