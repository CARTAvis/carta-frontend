import * as React from "react";
import $ from "jquery";
import {observer} from "mobx-react";
import {autorun, makeObservable, observable, runInAction} from "mobx";
import {NonIdealState, Spinner, Tag} from "@blueprintjs/core";
import ResizeObserver from "react-resize-detector/build/withPolyfill";
import {OverlayComponent} from "./Overlay/OverlayComponent";
import {CursorOverlayComponent} from "./CursorOverlay/CursorOverlayComponent";
import {ColorbarComponent} from "./Colorbar/ColorbarComponent";
import {RasterViewComponent} from "./RasterView/RasterViewComponent";
import {ToolbarComponent} from "./Toolbar/ToolbarComponent";
import {BeamProfileOverlayComponent} from "./BeamProfileOverlay/BeamProfileOverlayComponent";
import {RegionViewComponent} from "./RegionView/RegionViewComponent";
import {ContourViewComponent} from "./ContourView/ContourViewComponent";
import {CatalogViewComponent} from "./CatalogView/CatalogViewComponent";
import {AppStore, RegionStore, DefaultWidgetConfig, WidgetProps, HelpType, Padding} from "stores";
import {CursorInfo, Point2D} from "models";
import {toFixed} from "utilities";
import "./ImageViewComponent.scss";

export const getImageCanvas = (padding: Padding, colorbarPosition: string, backgroundColor: string = "rgba(255, 255, 255, 0)"): HTMLCanvasElement => {
    const rasterCanvas = document.getElementById("raster-canvas") as HTMLCanvasElement;
    const contourCanvas = document.getElementById("contour-canvas") as HTMLCanvasElement;
    const overlayCanvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;

    if (!rasterCanvas || !contourCanvas || !overlayCanvas) {
        return null;
    }

    let colorbarCanvas: HTMLCanvasElement;
    let regionCanvas: HTMLCanvasElement;
    let beamProfileCanvas: HTMLCanvasElement;
    let catalogCanvas: HTMLCanvasElement;
    const colorbarQuery = $(".colorbar-stage").children().children("canvas");
    if (colorbarQuery && colorbarQuery.length) {
        colorbarCanvas = colorbarQuery[0] as HTMLCanvasElement;
    }

    const beamProfileQuery = $(".beam-profile-stage").children().children("canvas");
    if (beamProfileQuery && beamProfileQuery.length) {
        beamProfileCanvas = beamProfileQuery[0] as HTMLCanvasElement;
    }

    const regionQuery = $(".region-stage").children().children("canvas");
    if (regionQuery && regionQuery.length) {
        regionCanvas = regionQuery[0] as HTMLCanvasElement;
    }

    const catalogQuery = $(".catalog-plotly")?.children()?.children()?.children(".gl-container")?.children(".gl-canvas-context");
    if (catalogQuery && catalogQuery.length) {
        catalogCanvas = catalogQuery[0] as HTMLCanvasElement;
    }

    const composedCanvas = document.createElement("canvas") as HTMLCanvasElement;
    composedCanvas.width = overlayCanvas.width;
    composedCanvas.height = overlayCanvas.height;

    const ctx = composedCanvas.getContext("2d");
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
    ctx.drawImage(rasterCanvas, padding.left * devicePixelRatio, padding.top * devicePixelRatio);
    ctx.drawImage(contourCanvas, padding.left * devicePixelRatio, padding.top * devicePixelRatio);
    if (colorbarCanvas) {
        let xPos, yPos;
        switch (colorbarPosition) {
            case "top":
                xPos = 0;
                yPos = padding.top * devicePixelRatio - colorbarCanvas.height;
                break;
            case "bottom":
                xPos = 0;
                yPos = overlayCanvas.height - colorbarCanvas.height - AppStore.Instance.overlayStore.colorbarHoverInfoHeight * devicePixelRatio;
                break;
            case "right":
            default:
                xPos = padding.left * devicePixelRatio + rasterCanvas.width;
                yPos = 0;
                break;
        }
        ctx.drawImage(colorbarCanvas, xPos, yPos);
    }

    if (beamProfileCanvas) {
        ctx.drawImage(beamProfileCanvas, padding.left * devicePixelRatio, padding.top * devicePixelRatio);
    }

    if (regionCanvas) {
        ctx.drawImage(regionCanvas, padding.left * devicePixelRatio, padding.top * devicePixelRatio);
    }

    if (catalogCanvas) {
        if (devicePixelRatio === 1) {
            ctx.drawImage(catalogCanvas, padding.left * devicePixelRatio, padding.top * devicePixelRatio, catalogCanvas.width / 2, catalogCanvas.height / 2);   
        } else {
            ctx.drawImage(catalogCanvas, padding.left * devicePixelRatio, padding.top * devicePixelRatio);
        }
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(overlayCanvas, 0, 0);

    return composedCanvas;
};

export enum ImageViewLayer {
    RegionCreating = "regionCreating",
    Catalog = "catalog",
    RegionMoving = "regionMoving"
}

@observer
export class ImageViewComponent extends React.Component<WidgetProps> {
    private ratioIndicatorTimeoutHandle;
    private cachedImageSize: Point2D;

    @observable showRatioIndicator: boolean;
    readonly activeLayer: ImageViewLayer;

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "image-view",
            type: "image-view",
            minWidth: 500,
            minHeight: 500,
            defaultWidth: 600,
            defaultHeight: 600,
            title: "Image view",
            isCloseable: false,
            helpType: HelpType.IMAGE_VIEW
        };
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        this.activeLayer = AppStore.Instance.activeLayer;
        autorun(() => {
            const frame = AppStore.Instance.activeFrame;
            if (frame) {
                const imageSize = {x: frame.renderWidth, y: frame.renderHeight};
                // Compare to cached image size to prevent duplicate events when changing frames
                if (!this.cachedImageSize || this.cachedImageSize.x !== imageSize.x || this.cachedImageSize.y !== imageSize.y) {
                    this.cachedImageSize = imageSize;
                    clearTimeout(this.ratioIndicatorTimeoutHandle);
                    runInAction(() => this.showRatioIndicator = true);
                    this.ratioIndicatorTimeoutHandle = setTimeout(() => runInAction(() => {
                        this.showRatioIndicator = false;
                    }), 1000);
                }
            }
        });
    }

    onResize = (width: number, height: number) => {
        if (width > 0 && height > 0) {
            AppStore.Instance.setImageViewDimensions(width, height);
        }
    };

    onClicked = (cursorInfo: CursorInfo) => {
        const frame = AppStore.Instance.activeFrame;
        if (frame) {
            frame.setCenter(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y);
        }
    };

    onZoomed = (cursorInfo: CursorInfo, delta: number) => {
        const frame = AppStore.Instance.activeFrame;
        if (frame) {
            const zoomSpeed = 1 + Math.abs(delta / 750.0);

            // If frame is spatially matched, apply zoom to the reference frame, rather than the active frame
            if (frame.spatialReference) {
                const newZoom = frame.spatialReference.zoomLevel * (delta > 0 ? zoomSpeed : 1.0 / zoomSpeed);
                frame.zoomToPoint(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y, newZoom, true);
            } else {
                const newZoom = frame.zoomLevel * (delta > 0 ? zoomSpeed : 1.0 / zoomSpeed);
                frame.zoomToPoint(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y, newZoom, true);
            }
        }
    };

    onMouseEnter = () => {
        AppStore.Instance.showImageToolbar();
    };

    onMouseLeave = () => {
        AppStore.Instance.hideImageToolbar();
    };

    private handleRegionDoubleClicked = (region: RegionStore) => {
        const appStore = AppStore.Instance;
        if (region) {
            const frame = appStore.getFrame(region.fileId);
            if (frame) {
                frame.regionSet.selectRegion(region);
                appStore.dialogStore.showRegionDialog();
            }
        }
    };

    render() {
        const appStore = AppStore.Instance;
        const overlayStore = appStore.overlayStore;
        let divContents;
        if (appStore.activeFrame && appStore.activeFrame.isRenderable && appStore.astReady) {
            const effectiveWidth = appStore.activeFrame.renderWidth * (appStore.activeFrame.renderHiDPI ? devicePixelRatio : 1);
            const effectiveHeight = appStore.activeFrame.renderHeight * (appStore.activeFrame.renderHiDPI ? devicePixelRatio : 1);
            const imageRatioTagOffset = {x: overlayStore.padding.left + overlayStore.viewWidth / 2.0, y: overlayStore.padding.top + overlayStore.viewHeight / 2.0};

            divContents = (
                <React.Fragment>
                    {appStore.activeFrame.valid &&
                    <OverlayComponent
                        frame={appStore.activeFrame}
                        overlaySettings={overlayStore}
                        docked={this.props.docked}
                    />
                    }
                    {appStore.activeFrame.cursorInfo &&
                    <CursorOverlayComponent
                        cursorInfo={appStore.activeFrame.cursorInfo}
                        cursorValue={appStore.activeFrame.cursorInfo.isInsideImage ? appStore.activeFrame.cursorValue.value : undefined}
                        isValueCurrent={appStore.activeFrame.isCursorValueCurrent}
                        spectralInfo={appStore.activeFrame.spectralInfo}
                        width={overlayStore.viewWidth}
                        left={overlayStore.padding.left}
                        right={overlayStore.padding.right}
                        docked={this.props.docked}
                        unit={appStore.activeFrame.unit}
                        top={overlayStore.padding.top}
                        currentStokes={appStore.activeFrame.hasStokes ? appStore.activeFrame.stokesInfo[appStore.activeFrame.requiredStokes] : ""}
                        showImage={true}
                        showWCS={true}
                        showValue={true}
                        showChannel={false}
                        showSpectral={true}
                        showStokes={true}
                    />
                    }
                    {appStore.activeFrame && overlayStore.colorbar.visible &&
                    <ColorbarComponent/>
                    }
                    {appStore.activeFrame &&
                    <BeamProfileOverlayComponent
                        top={overlayStore.padding.top}
                        left={overlayStore.padding.left}
                        docked={this.props.docked}
                        padding={10}
                    />
                    }
                    {appStore.activeFrame &&
                    <RegionViewComponent
                        frame={appStore.activeFrame}
                        width={appStore.activeFrame.renderWidth}
                        height={appStore.activeFrame.renderHeight}
                        top={overlayStore.padding.top}
                        left={overlayStore.padding.left}
                        onClicked={this.onClicked}
                        onRegionDoubleClicked={this.handleRegionDoubleClicked}
                        onZoomed={this.onZoomed}
                        overlaySettings={overlayStore}
                        isRegionCornerMode={appStore.preferenceStore.isRegionCornerMode}
                        dragPanningEnabled={appStore.preferenceStore.dragPanning}
                        cursorFrozen={appStore.cursorFrozen}
                        cursorPoint={appStore.activeFrame.cursorInfo.posImageSpace}
                        docked={this.props.docked && (this.activeLayer === ImageViewLayer.RegionMoving || this.activeLayer === ImageViewLayer.RegionCreating)}
                    />
                    }
                    {appStore.activeFrame &&
                    <CatalogViewComponent
                        width={appStore.activeFrame.renderWidth}
                        height={appStore.activeFrame.renderHeight}
                        activeLayer={this.activeLayer}
                        docked={this.props.docked && appStore.activeLayer === ImageViewLayer.Catalog}
                        onClicked={this.onClicked}
                        onZoomed={this.onZoomed}
                    />
                    }
                    <ToolbarComponent
                        docked={this.props.docked}
                        visible={appStore.imageToolbarVisible}
                        vertical={false}
                        onActiveLayerChange={appStore.updateActiveLayer}
                        activeLayer={this.activeLayer}
                    />
                    <div style={{opacity: this.showRatioIndicator ? 1 : 0, left: imageRatioTagOffset.x, top: imageRatioTagOffset.y}} className={"tag-image-ratio"}>
                        <Tag large={true}>
                            {effectiveWidth} x {effectiveHeight} ({toFixed(effectiveWidth / effectiveHeight, 2)})
                        </Tag>
                    </div>
                </React.Fragment>
            );
        } else if (!appStore.astReady) {
            divContents = <NonIdealState icon={<Spinner className="astLoadingSpinner"/>} title={"Loading AST Library"}/>;
        } else {
            divContents = <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>;
        }

        return (
            <div className="image-view-div" onMouseOver={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                <RasterViewComponent
                    docked={this.props.docked}
                />
                <ContourViewComponent
                    docked={this.props.docked}
                />
                {divContents}
                <ResizeObserver handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}>
                </ResizeObserver>
            </div>
        );
    }
}
