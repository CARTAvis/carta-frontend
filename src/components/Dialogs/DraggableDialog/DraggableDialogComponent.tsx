// Based on code from https://github.com/palantir/blueprint/issues/336
import * as React from "react";
import {createRoot} from "react-dom/client";
import {ResizeEnable, Rnd} from "react-rnd";
import {Button, Classes, Dialog, DialogProps} from "@blueprintjs/core";
import {observer} from "mobx-react";

import {AppStore, HelpStore, HelpType} from "stores";

import "./DraggableDialogComponent.scss";

export class ResizableDialogComponentProps {
    dialogProps: DialogProps;
    defaultWidth: number;
    defaultHeight: number;
    minWidth?: number;
    minHeight?: number;
    enableResizing: boolean;
    helpType?: HelpType;
    onResizeStop?: (newWidth: number, newHeight: number) => void;
    dialogId: string;
    children?: React.ReactNode;
}

@observer
export class DraggableDialogComponent extends React.Component<ResizableDialogComponentProps> {
    private dd = React.createRef<HTMLDivElement>();
    private rnd: Rnd;

    private onOpening = () => {
        // workaround for the blue focus box suppressed to the top after blueprintjs v4 upgrade.
        const focusTrap = this.dd.current.getElementsByClassName(Classes.OVERLAY_START_FOCUS_TRAP)[0] as HTMLDivElement;
        const container = this.dd.current.getElementsByClassName(Classes.DIALOG_CONTAINER)[0] as HTMLDivElement;
        if (focusTrap?.getAttribute("tabindex") === "0" && container) {
            focusTrap.removeAttribute("tabindex");
            container.focus();
        }

        // add help button in dialog header
        const header = this.dd.current.getElementsByClassName(Classes.DIALOG_HEADER);
        if (this.props.helpType && header?.length > 0 && this.dd.current.getElementsByClassName("help-button").length === 0) {
            const helpButton = <Button icon="help" minimal={true} onClick={this.onClickHelpButton} />;
            const helpButtonDiv = document.createElement("div") as HTMLDivElement;
            helpButtonDiv.setAttribute("class", "help-button");

            const root = createRoot(helpButtonDiv);
            root.render(helpButton);

            const closeButton = this.dd.current.getElementsByClassName(Classes.DIALOG_CLOSE_BUTTON);
            if (closeButton.length > 0) {
                closeButton[0].before(helpButtonDiv);
            } else {
                header[0].append(helpButtonDiv);
            }
        }

        const dialog = this.dd.current.getElementsByClassName(Classes.DIALOG)?.[0];
        if (dialog) {
            dialog.setAttribute("data-testid", this.props.dialogId);
        }

        const closeButton = this.dd.current.getElementsByClassName(Classes.DIALOG_CLOSE_BUTTON)?.[0];
        if (closeButton) {
            closeButton.setAttribute("data-testid", `${this.props.dialogId}-header-close-button`);
        }
    };

    private onClickHelpButton = () => {
        const centerX = (this.rnd.draggable.state as any).x + this.rnd.resizable.size.width * 0.5;
        HelpStore.Instance.showHelpDrawer(this.props.helpType, centerX);
    };

    private onResizeStop = (e, direction, elementRef: HTMLDivElement) => {
        if (this.props.onResizeStop) {
            this.props.onResizeStop(elementRef.offsetWidth, elementRef.offsetHeight);
        }
    };

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

        const appStore = AppStore.Instance;
        const zIndexManager = appStore.zIndexManager;

        return (
            <div className={"draggable-dialog"} ref={this.dd}>
                {this.props.dialogProps.isOpen && (
                    <Rnd
                        enableResizing={resizeSettings}
                        bounds={".gl-container-app"}
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
                        dragHandleClassName={Classes.DIALOG_HEADER}
                        ref={c => {
                            this.rnd = c;
                        }}
                        onResizeStop={this.onResizeStop}
                        style={{zIndex: zIndexManager.findIndex(this.props.dialogId)}}
                        onMouseDown={() => zIndexManager.updateIndexOnSelect(this.props.dialogId)}
                    >
                        <Dialog
                            portalClassName="dialog-portal"
                            usePortal={false}
                            enforceFocus={false}
                            autoFocus={true}
                            {...this.props.dialogProps}
                            children={this.props.children}
                            onClose={() => appStore.dialogStore.hideDialog(this.props.dialogId)}
                            onOpening={this.onOpening}
                        />
                    </Rnd>
                )}
            </div>
        );
    }
}
