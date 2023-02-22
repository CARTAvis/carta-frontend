import * as React from "react";
import ReactResizeDetector from "react-resize-detector";
import {NonIdealState, Spinner} from "@blueprintjs/core";
import $ from "jquery";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {Point2D, Zoom} from "models";
import {AppStore, DefaultWidgetConfig, HelpType, Padding, WidgetProps} from "stores";
import {toFixed} from "utilities";

import {ImagePanelComponent} from "./ImagePanel/ImagePanelComponent";

import "./ImageViewComponent.scss";

export enum ImageViewLayer {
    RegionCreating = "regionCreating",
    Catalog = "catalog",
    RegionMoving = "regionMoving",
    DistanceMeasuring = "distanceMeasuring"
}

export function getImageViewCanvas(padding: Padding, colorbarPosition: string, backgroundColor: string = "rgba(255, 255, 255, 0)") {
    const appStore = AppStore.Instance;
    const imageViewCanvas = document.createElement("canvas") as HTMLCanvasElement;
    const pixelRatio = devicePixelRatio * appStore.imageRatio;
    imageViewCanvas.width = appStore.overlayStore.fullViewWidth * pixelRatio;
    imageViewCanvas.height = appStore.overlayStore.fullViewHeight * pixelRatio;
    const ctx = imageViewCanvas.getContext("2d");
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, imageViewCanvas.width, imageViewCanvas.height);
    appStore.visibleFrames.forEach((frame, index) => {
        const column = index % appStore.numImageColumns;
        const row = Math.floor(index / appStore.numImageColumns);
        const panelCanvas = getPanelCanvas(column, row, padding, colorbarPosition, backgroundColor);
        const viewHeight = frame.previewViewHeight || appStore.overlayStore.viewHeight;
        const viewWidth = frame.previewViewWidth || appStore.overlayStore.viewWidth;
        if (panelCanvas) {
            ctx.drawImage(panelCanvas, viewWidth * column * pixelRatio, viewHeight * row * pixelRatio);
        }
    });

    return imageViewCanvas;
}

export function getPanelCanvas(column: number, row: number, padding: Padding, colorbarPosition: string, backgroundColor: string = "rgba(255, 255, 255, 0)") {
    const panelElement = $(`#image-panel-${column}-${row}`)?.first();
    if (!panelElement?.length) {
        return null;
    }
    const rasterCanvas = panelElement.find(".raster-canvas")?.[0] as HTMLCanvasElement;
    const contourCanvas = panelElement.find(".contour-canvas")?.[0] as HTMLCanvasElement;
    const overlayCanvas = panelElement.find(".overlay-canvas")?.[0] as HTMLCanvasElement;
    const catalogCanvas = panelElement.find(".catalog-canvas")?.[0] as HTMLCanvasElement;
    const vectorOverlayCanvas = panelElement.find(".vector-overlay-canvas")?.[0] as HTMLCanvasElement;

    if (!rasterCanvas || !contourCanvas || !overlayCanvas || !vectorOverlayCanvas) {
        return null;
    }

    const colorbarCanvas = panelElement.find(".colorbar-stage")?.children()?.children("canvas")?.[0] as HTMLCanvasElement;
    const beamProfileCanvas = panelElement.find(".beam-profile-stage")?.children()?.children("canvas")?.[0] as HTMLCanvasElement;
    const regionCanvas = panelElement.find(".region-stage")?.children()?.children("canvas")?.[0] as HTMLCanvasElement;

    const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;
    const composedCanvas = document.createElement("canvas") as HTMLCanvasElement;
    composedCanvas.width = overlayCanvas.width;
    composedCanvas.height = overlayCanvas.height;

    const ctx = composedCanvas.getContext("2d");
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
    ctx.drawImage(rasterCanvas, padding.left * pixelRatio, padding.top * pixelRatio);
    ctx.drawImage(contourCanvas, padding.left * pixelRatio, padding.top * pixelRatio);
    ctx.drawImage(vectorOverlayCanvas, padding.left * pixelRatio, padding.top * pixelRatio);
    if (colorbarCanvas) {
        let xPos, yPos;
        switch (colorbarPosition) {
            case "top":
                xPos = 0;
                yPos = padding.top * pixelRatio - colorbarCanvas.height;
                break;
            case "bottom":
                xPos = 0;
                yPos = overlayCanvas.height - colorbarCanvas.height - AppStore.Instance.overlayStore.colorbarHoverInfoHeight * pixelRatio;
                break;
            case "right":
            default:
                xPos = padding.left * pixelRatio + rasterCanvas.width;
                yPos = 0;
                break;
        }
        ctx.drawImage(colorbarCanvas, xPos, yPos);
    }

    if (beamProfileCanvas) {
        ctx.drawImage(beamProfileCanvas, padding.left * pixelRatio, padding.top * pixelRatio);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(overlayCanvas, 0, 0);

    if (catalogCanvas) {
        ctx.drawImage(catalogCanvas, padding.left * pixelRatio, padding.top * pixelRatio);
    }

    if (regionCanvas) {
        ctx.drawImage(regionCanvas, padding.left * pixelRatio, padding.top * pixelRatio);
    }

    return composedCanvas;
}

@observer
export class ImageViewComponent extends React.Component<WidgetProps> {
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

    private imagePanelRefs: any[];
    private ratioIndicatorTimeoutHandle;
    private cachedImageSize: Point2D;
    private cachedGridSize: Point2D;

    @observable showRatioIndicator: boolean = false;

    onResize = (width: number, height: number) => {
        if (width > 0 && height > 0) {
            const appStore = AppStore.Instance;
            const requiresAutoFit = appStore.preferenceStore.zoomMode === Zoom.FIT && appStore.overlayStore.fullViewWidth <= 1 && appStore.overlayStore.fullViewHeight <= 1;
            appStore.setImageViewDimensions(width, height);
            if (requiresAutoFit) {
                this.imagePanelRefs?.forEach(imagePanelRef => imagePanelRef?.fitZoomFrameAndRegion());
            }
        }
    };

    @action setRatioIndicatorVisible = (val: boolean) => {
        this.showRatioIndicator = val;
    };

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        this.imagePanelRefs = [];
        const appStore = AppStore.Instance;

        autorun(() => {
            const imageSize = {x: appStore.overlayStore.renderWidth, y: appStore.overlayStore.renderHeight};
            const imageGridSize = {x: appStore.numImageColumns, y: appStore.numImageRows};
            // Compare to cached image size to prevent duplicate events when changing frames
            const imageSizeChanged = !this.cachedImageSize || this.cachedImageSize.x !== imageSize.x || this.cachedImageSize.y !== imageSize.y;
            const gridSizeChanged = !this.cachedGridSize || this.cachedGridSize.x !== imageGridSize.x || this.cachedGridSize.y !== imageGridSize.y;
            if (imageSizeChanged || gridSizeChanged) {
                this.cachedImageSize = imageSize;
                this.cachedGridSize = imageGridSize;
                clearTimeout(this.ratioIndicatorTimeoutHandle);
                this.setRatioIndicatorVisible(true);
                this.ratioIndicatorTimeoutHandle = setTimeout(() => this.setRatioIndicatorVisible(false), 1000);
            }
        });
    }

    private collectImagePanelRef = ref => {
        this.imagePanelRefs.push(ref);
    };

    @computed get panels() {
        const appStore = AppStore.Instance;
        const visibleFrames = appStore.visibleFrames;
        this.imagePanelRefs = [];
        if (!visibleFrames) {
            return [];
        }
        return visibleFrames.map((frame, index) => {
            const column = index % appStore.numImageColumns;
            const row = Math.floor(index / appStore.numImageColumns);

            return <ImagePanelComponent ref={this.collectImagePanelRef} key={frame.frameInfo.fileId} docked={this.props.docked} frame={frame} row={row} column={column} />;
        });
    }

    render() {
        const appStore = AppStore.Instance;

        let divContents: React.ReactNode | React.ReactNode[];
        if (!this.panels.length) {
            divContents = <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />;
        } else if (!appStore.astReady) {
            divContents = <NonIdealState icon={<Spinner className="astLoadingSpinner" />} title={"Loading AST Library"} />;
        } else {
            const effectiveImageSize = {x: Math.floor(appStore.overlayStore.renderWidth), y: Math.floor(appStore.overlayStore.renderHeight)};
            const ratio = effectiveImageSize.x / effectiveImageSize.y;
            const gridSize = {x: appStore.numImageColumns, y: appStore.numImageRows};

            let gridSizeNode: React.ReactNode;
            if (gridSize.x * gridSize.y > 1) {
                gridSizeNode = (
                    <p>
                        {gridSize.x} &times; {gridSize.y}
                    </p>
                );
            }
            divContents = (
                <React.Fragment>
                    {this.panels}
                    <div style={{opacity: this.showRatioIndicator ? 1 : 0}} className={"image-ratio-popup"}>
                        <p>
                            {effectiveImageSize.x} &times; {effectiveImageSize.y} ({toFixed(ratio, 2)})
                        </p>
                        {gridSizeNode}
                    </div>
                </React.Fragment>
            );
        }

        return (
            <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}>
                <div className="image-view-div" style={{gridTemplateColumns: `repeat(${appStore.numImageColumns}, auto)`}}>
                    {divContents}
                </div>
            </ReactResizeDetector>
        );
    }
}
