// Based on code from https://github.com/palantir/blueprint/issues/336
import * as React from "react";
import {createRoot} from "react-dom/client";
import {type DraggableData, type ResizeEnable, Rnd} from "react-rnd";
import {Button, Classes, Dialog, type DialogProps} from "@blueprintjs/core";
import {type IReactionDisposer, reaction} from "mobx";
import {observer} from "mobx-react";

import {type HelpType} from "enums";
import {AppStore, type DialogGeometry, HelpStore} from "stores";

import "./DraggableDialogComponent.scss";

export class ResizableDialogComponentProps {
    dialogProps: DialogProps;
    defaultWidth: number;
    defaultHeight: number;
    minWidth?: number;
    minHeight?: number;
    isResizingEnabled: boolean;
    helpType?: HelpType;
    onResizeStop?: (newWidth: number, newHeight: number) => void;
    dialogId: string;
    children?: React.ReactNode;
}

function getViewportDimensions() {
    const documentElement = document.documentElement;
    const body = document.getElementsByTagName("body")[0];

    return {
        width: window.innerWidth || documentElement.clientWidth || body.clientWidth,
        height: window.innerHeight || documentElement.clientHeight || body.clientHeight
    };
}

@observer
export class DraggableDialogComponent extends React.Component<ResizableDialogComponentProps> {
    private dd = React.createRef<HTMLDivElement>();
    private rnd: Rnd | null = null;
    private geometryDisposer: IReactionDisposer | undefined;

    componentDidMount() {
        // Move an open dialog when a workspace restore places it, or puts it back in the middle.
        this.geometryDisposer = reaction(() => AppStore.Instance.dialogStore.dialogGeometries.get(this.props.dialogId), this.onGeometryChanged);
    }

    /**
     * Applies a place that the dialog store got from somewhere else than this dialog. A drag or a
     * resize keeps the place where the dialog already is. Applying it again would move a dialog that
     * the user left partly outside the layout area.
     */
    private onGeometryChanged = (geometry: DialogGeometry | undefined) => {
        const position = this.rnd?.getDraggablePosition();
        const element = this.rnd?.getSelfElement();
        const isWhereItIs = geometry && position && element && geometry.x === position.x && geometry.y === position.y && geometry.width === element.offsetWidth && geometry.height === element.offsetHeight;
        if (!isWhereItIs) {
            this.applyGeometry();
        }
    };

    componentWillUnmount() {
        this.geometryDisposer?.();
    }

    /**
     * Puts an open dialog where the dialog store says. A dialog that has no place in the store goes
     * to the middle of the window, where it opens. The dialog stays inside the layout area, below the
     * menu bar. A dialog that can be resized is made at least as large as its minimum size, and at
     * most as large as the layout area. A dialog that cannot be resized keeps its size.
     *
     * The positions are those of `getDraggablePosition` and `updatePosition` of `Rnd`, counted from
     * the top left corner of the app. The default position of `Rnd`, and the position that its drag
     * and resize callbacks give, are counted from the element around the dialog, which is below the
     * menu bar. So they are not used.
     */
    private applyGeometry = () => {
        const rnd = this.rnd;
        const element = rnd?.getSelfElement();
        if (!rnd || !element) {
            return;
        }
        const origin = (element.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? {left: 0, top: 0};
        const isResizable = this.props.isResizingEnabled;
        let {x, y, width, height} = AppStore.Instance.dialogStore.dialogGeometries.get(this.props.dialogId) ?? this.centeredGeometry(origin);
        if (!isResizable) {
            width = element.offsetWidth;
            height = element.offsetHeight;
        }
        const area = document.querySelector(".layout-container")?.getBoundingClientRect();
        if (area) {
            if (isResizable) {
                width = Math.max(this.props.minWidth ?? 0, Math.min(width, area.width));
                height = Math.max(this.props.minHeight ?? 0, Math.min(height, area.height));
            }
            x = Math.max(area.left - origin.left, Math.min(x, area.right - origin.left - width));
            y = Math.max(area.top - origin.top, Math.min(y, area.bottom - origin.top - height));
        }
        rnd.updatePosition({x, y});
        if (isResizable) {
            rnd.updateSize({width, height});
        }
    };

    /** Returns where the dialog opens, in the middle of the window, counted from `origin`. */
    private centeredGeometry = (origin: {left: number; top: number}) => {
        const {width: windowWidth, height: windowHeight} = getViewportDimensions();
        const wrapper = this.dd.current?.getBoundingClientRect() ?? {left: 0, top: 0};
        return {
            x: Math.floor(Math.max((windowWidth - this.props.defaultWidth) / 2, 0)) + wrapper.left - origin.left,
            y: Math.floor(Math.max((windowHeight - this.props.defaultHeight) / 2, 0)) + wrapper.top - origin.top,
            width: Math.min(this.props.defaultWidth, windowWidth),
            height: Math.min(this.props.defaultHeight, windowHeight)
        };
    };

    /** Keeps the `Rnd` of the open dialog, and places a dialog that opens where the dialog store says. */
    private setRnd = (rnd: Rnd | null) => {
        const isOpening = rnd !== null && this.rnd === null;
        this.rnd = rnd;
        if (isOpening && AppStore.Instance.dialogStore.dialogGeometries.has(this.props.dialogId)) {
            this.applyGeometry();
        }
    };

    /** Keeps in the dialog store where the dialog is and how large it is. */
    private saveGeometry = (element: HTMLElement) => {
        const position = this.rnd?.getDraggablePosition();
        if (position) {
            AppStore.Instance.dialogStore.setDialogGeometry(this.props.dialogId, {x: position.x, y: position.y, width: element.offsetWidth, height: element.offsetHeight});
        }
    };

    private onDragStop = (_e: unknown, data: DraggableData) => {
        this.saveGeometry(data.node);
    };

    private onOpening = () => {
        if (!this.dd.current) {
            return;
        }

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
            const helpButton = <Button icon="help" variant="minimal" onClick={this.onClickHelpButton} />;
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

        const helpButton = this.dd.current.getElementsByClassName("help-button")?.[0];
        if (helpButton) {
            helpButton.setAttribute("data-testid", `${this.props.dialogId}-header-help-button`);
        }
    };

    private onClickHelpButton = () => {
        if (this.props.helpType && this.rnd) {
            const centerX = (this.rnd.draggable.state as any).x + this.rnd.resizable.size.width * 0.5;
            HelpStore.Instance.showHelpDrawer(this.props.helpType, centerX);
        }
    };

    private onResizeStop = (e, direction, elementRef: HTMLDivElement) => {
        this.saveGeometry(elementRef);
        if (this.props.onResizeStop) {
            this.props.onResizeStop(elementRef.offsetWidth, elementRef.offsetHeight);
        }
    };

    render() {
        const {width: windowWidth, height: windowHeight} = getViewportDimensions();

        const isResizeEnabled = this.props.isResizingEnabled;
        const resizeSettings: ResizeEnable = {
            top: isResizeEnabled,
            bottom: isResizeEnabled,
            left: isResizeEnabled,
            right: isResizeEnabled,
            topLeft: isResizeEnabled,
            topRight: isResizeEnabled,
            bottomLeft: isResizeEnabled,
            bottomRight: isResizeEnabled
        };

        const appStore = AppStore.Instance;
        const zIndexManager = appStore.zIndexManager;

        return (
            <div className={"draggable-dialog"} data-dialog-id={this.props.dialogId} ref={this.dd}>
                {this.props.dialogProps.isOpen && (
                    <Rnd
                        enableResizing={resizeSettings}
                        bounds={".layout-container"}
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
                        ref={this.setRnd}
                        onResizeStop={this.onResizeStop}
                        onDragStop={this.onDragStop}
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
