import * as React from "react";
import * as _ from "lodash";
import "./ImageViewComponent.css";
import {AppStore} from "../../stores/AppStore";
import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {NonIdealState, Spinner} from "@blueprintjs/core";
import {OverlayComponent} from "./Overlay/OverlayComponent";
import {CursorInfo} from "../../models/CursorInfo";
import {CursorOverlayComponent} from "./CursorOverlay/CursorOverlayComponent";
import {RasterViewComponent} from "./RasterView/RasterViewComponent";
import {WidgetConfig} from "../../stores/FloatingWidgetStore";

class ImageViewComponentProps {
    appStore: AppStore;
    id: string;
    docked: boolean;
}

@observer
export class ImageViewComponent extends React.Component<ImageViewComponentProps> {
    private containerDiv: HTMLDivElement;

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "image-view",
            type: "image-view",
            minWidth: 500,
            minHeight: 500,
            defaultWidth: 600,
            defaultHeight: 600,
            title: "Image view",
            isCloseable: false
        };
    }

    onResize = (width: number, height: number) => {
        this.props.appStore.setImageViewDimensions(width, height);
    };

    onCursorMoved = (cursorInfo: CursorInfo) => {
        if (!this.props.appStore.cursorFrozen) {
            this.props.appStore.setCursorInfo(cursorInfo);
        }
    };

    onClicked = (cursorInfo: CursorInfo) => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame
            && 0 < cursorInfo.posImageSpace.x && cursorInfo.posImageSpace.x < appStore.activeFrame.frameInfo.fileInfoExtended.width
            && 0 < cursorInfo.posImageSpace.y && cursorInfo.posImageSpace.y < appStore.activeFrame.frameInfo.fileInfoExtended.height
        ) {
            appStore.activeFrame.setCenter(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y);
        }
    };

    onZoomed = (cursorInfo: CursorInfo, delta: number) => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            const zoomSpeed = 1 + Math.abs(delta / 1000.0);
            const newZoom = appStore.activeFrame.zoomLevel * (delta > 0 ? zoomSpeed : 1.0 / zoomSpeed);
            appStore.activeFrame.zoomToPoint(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y, newZoom);
        }
    };

    render() {
        const appStore = this.props.appStore;
        return (
            <div className="image-view-div" ref={(ref) => this.containerDiv = ref}>
                {appStore.astReady && appStore.activeFrame && appStore.activeFrame.valid &&
                <OverlayComponent
                    frame={appStore.activeFrame}
                    overlaySettings={appStore.overlayStore}
                    docked={this.props.docked}
                    onCursorMoved={this.onCursorMoved}
                    onClicked={this.onClicked}
                    onZoomed={this.onZoomed}
                />
                }
                {appStore.astReady && appStore.activeFrame &&
                < RasterViewComponent
                    frame={appStore.activeFrame}
                    docked={this.props.docked}
                    overlaySettings={appStore.overlayStore}
                />
                }
                {appStore.astReady && appStore.activeFrame && appStore.cursorInfo &&
                <CursorOverlayComponent
                    cursorInfo={appStore.cursorInfo}
                    mip={appStore.activeFrame.currentFrameView.mip}
                    width={appStore.overlayStore.viewWidth}
                    left={appStore.overlayStore.padding.left}
                    right={appStore.overlayStore.padding.right}
                    docked={this.props.docked}
                    unit={appStore.activeFrame.unit}
                    top={appStore.overlayStore.padding.top}
                    showImage={true}
                    showWCS={true}
                    showValue={true}
                />
                }
                {!appStore.astReady &&
                <NonIdealState icon={<Spinner className="astLoadingSpinner"/>} title={"Loading AST Library"}/>
                }
                {!appStore.activeFrame &&
                <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>
                }
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}