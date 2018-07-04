import * as React from "react";
import "./ImageViewComponent.css";
import {AppState} from "../../states/AppState";
import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {NonIdealState, Spinner} from "@blueprintjs/core";
import {OverlayComponent} from "./Overlay/OverlayComponent";
import {CursorInfo} from "../../models/CursorInfo";
import {CursorOverlayComponent} from "./CursorOverlay/CursorOverlayComponent";
import {RasterViewComponent} from "./RasterView/RasterViewComponent";

@observer
export class ImageViewComponent extends React.Component<{ appState: AppState }> {

    containerDiv: HTMLDivElement;

    onResize = (width: number, height: number) => {
        this.props.appState.setImageViewDimensions(width, height);
    };

    onCursorMoved = (cursorInfo: CursorInfo) => {
        this.props.appState.cursorInfo = cursorInfo;
    };

    onClicked = (cursorInfo: CursorInfo) => {
        const appState = this.props.appState;
        if (appState.activeFrame) {
            appState.activeFrame.setCenter(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y);
        }
    };

    onZoomed = (cursorInfo: CursorInfo, delta: number) => {
        const appState = this.props.appState;
        if (appState.activeFrame) {
            const zoomSpeed = 1 + Math.abs(delta / 2000.0);
            this.props.appState.activeFrame.setZoom(this.props.appState.activeFrame.zoomLevel * (delta > 0 ? zoomSpeed : 1.0 / zoomSpeed));
        }
    };

    render() {
        const appState = this.props.appState;
        return (
            <div className="image-view-div" ref={(ref) => this.containerDiv = ref}>
                {appState.astReady && appState.activeFrame && appState.activeFrame.valid &&
                <OverlayComponent
                    frame={appState.activeFrame}
                    overlaySettings={appState.overlayState}
                    onCursorMoved={this.onCursorMoved}
                    onClicked={this.onClicked}
                    onZoomed={this.onZoomed}
                />
                }
                {appState.astReady && appState.activeFrame && appState.activeFrame.valid &&
                <RasterViewComponent
                    frame={appState.activeFrame}
                    overlaySettings={appState.overlayState}
                />
                }
                {appState.astReady && appState.cursorInfo &&
                <CursorOverlayComponent
                    cursorInfo={appState.cursorInfo}
                    width={appState.overlayState.viewWidth}
                    bottom={0}
                    showImage={true}
                    showWCS={true}
                    showValue={true}
                />
                }
                {!appState.astReady &&
                <NonIdealState visual={<Spinner className="astLoadingSpinner"/>} title={"Loading AST Library"}/>
                }
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize}/>
            </div>
        );
    }
}