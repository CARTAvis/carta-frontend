import * as React from "react";
import "./ImageViewComponent.css";
import {AppStore} from "../../stores/AppStore";
import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {NonIdealState, Spinner} from "@blueprintjs/core";
import {OverlayComponent} from "./Overlay/OverlayComponent";
import {CursorInfo} from "../../models/CursorInfo";
import {CursorOverlayComponent} from "./CursorOverlay/CursorOverlayComponent";
import {RasterViewComponent} from "./RasterView/RasterViewComponent";

@observer
export class ImageViewComponent extends React.Component<{ appStore: AppStore }> {

    containerDiv: HTMLDivElement;

    onResize = (width: number, height: number) => {
        this.props.appStore.setImageViewDimensions(width, height);
    };

    onCursorMoved = (cursorInfo: CursorInfo) => {
        this.props.appStore.cursorInfo = cursorInfo;
    };

    onClicked = (cursorInfo: CursorInfo) => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
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
                    onCursorMoved={this.onCursorMoved}
                    onClicked={this.onClicked}
                    onZoomed={this.onZoomed}
                />
                }
                {appStore.astReady && appStore.activeFrame &&
                < RasterViewComponent
                    frame={appStore.activeFrame}
                    overlaySettings={appStore.overlayStore}
                />
                }
                {appStore.astReady && appStore.activeFrame && appStore.cursorInfo &&
                <CursorOverlayComponent
                    cursorInfo={appStore.cursorInfo}
                    mip={appStore.activeFrame.currentFrameView.mip}
                    width={appStore.overlayStore.viewWidth}
                    unit={appStore.activeFrame.unit}
                    bottom={0}
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
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}