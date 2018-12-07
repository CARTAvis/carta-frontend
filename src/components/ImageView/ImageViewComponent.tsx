import * as React from "react";
import {observer} from "mobx-react";
import {WidgetConfig, WidgetProps} from "../../stores/WidgetsStore";
import ReactResizeDetector from "react-resize-detector";
import {NonIdealState, Spinner, Colors} from "@blueprintjs/core";
import {OverlayComponent} from "./Overlay/OverlayComponent";
import {CursorInfo} from "../../models/CursorInfo";
import {CursorOverlayComponent} from "./CursorOverlay/CursorOverlayComponent";
import {RasterViewComponent} from "./RasterView/RasterViewComponent";
import {ToolbarComponent} from "./Toolbar/ToolbarComponent";
import "./ImageViewComponent.css";

export const exportImage = (padding, darkTheme) => {
    const rasterCanvas = document.getElementById("raster-canvas") as HTMLCanvasElement;
    const overlayCanvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
    
    const composedCanvas = document.createElement("canvas") as HTMLCanvasElement;
    composedCanvas.width = overlayCanvas.width;
    composedCanvas.height = overlayCanvas.height;
        
    const ctx = composedCanvas.getContext("2d");
    ctx.fillStyle = darkTheme ? Colors.DARK_GRAY3 : Colors.LIGHT_GRAY5;
    ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.drawImage(rasterCanvas, padding.left, padding.top);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(overlayCanvas, 0, 0);
    
    const dataURL = composedCanvas.toDataURL().replace("image/png", "image/octet-stream");
    
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`;
    
    const a = document.createElement("a") as HTMLAnchorElement;
    a.href = dataURL;
    a.download = `CARTA-exported-image-${timestamp}.png`;
    a.dispatchEvent(new MouseEvent("click"));
};

@observer
export class ImageViewComponent extends React.Component<WidgetProps> {
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
            // Shift from one-indexed image space position to zero-indexed
            appStore.activeFrame.setCenter(cursorInfo.posImageSpace.x + 1, cursorInfo.posImageSpace.y + 1);
        }
    };

    onZoomed = (cursorInfo: CursorInfo, delta: number) => {
        const appStore = this.props.appStore;
        if (appStore.activeFrame) {
            const zoomSpeed = 1 + Math.abs(delta / 1000.0);
            const newZoom = appStore.activeFrame.zoomLevel * (delta > 0 ? zoomSpeed : 1.0 / zoomSpeed);
            // Shift from one-indexed image space position to zero-indexed
            appStore.activeFrame.zoomToPoint(cursorInfo.posImageSpace.x + 1, cursorInfo.posImageSpace.y + 1, newZoom);
        }
    };
    
    onMouseEnter = () => {
        this.props.appStore.showImageToolbar();
    };
    
    onMouseLeave = () => {
        this.props.appStore.hideImageToolbar();
    };

    render() {
        const appStore = this.props.appStore;
        return (
            <div
                className="image-view-div"
                ref={(ref) => this.containerDiv = ref}
                onMouseEnter={this.onMouseEnter}
                onMouseLeave={this.onMouseLeave}
            >
                {appStore.astReady && appStore.activeFrame && appStore.activeFrame.valid &&
                <OverlayComponent
                    frame={appStore.activeFrame}
                    overlaySettings={appStore.overlayStore}
                    docked={this.props.docked}
                    onCursorMoved={this.onCursorMoved}
                    onClicked={this.onClicked}
                    onZoomed={this.onZoomed}
                    cursorFrozen={appStore.cursorFrozen}
                    cursorPoint={appStore.cursorInfo ? appStore.cursorInfo.posImageSpace : null}
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
                    spectralInfo={appStore.activeFrame.spectralInfo}
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
                    showChannel={false}
                    showSpectral={true}
                />
                }
                {appStore.astReady && appStore.activeFrame &&
                <ToolbarComponent
                    appStore={appStore}
                    docked={this.props.docked}
                    visible={appStore.imageToolbarVisible}
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
