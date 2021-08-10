import "./ImageViewComponent.scss";
import * as React from "react";
import $ from "jquery";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {NonIdealState, Spinner} from "@blueprintjs/core";
import {ImagePanelComponent} from "./ImagePanel/ImagePanelComponent";
import {AppStore, DefaultWidgetConfig, HelpType, Padding, WidgetProps} from "stores";
import {Point2D} from "models";
import {toFixed} from "utilities";
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
    imageViewCanvas.width = appStore.overlayStore.fullViewWidth * devicePixelRatio;
    imageViewCanvas.height = appStore.overlayStore.fullViewHeight * devicePixelRatio;
    const ctx = imageViewCanvas.getContext("2d");
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, imageViewCanvas.width, imageViewCanvas.height);
    appStore.visibleFrames.forEach((frame, index) => {
        const column = index % appStore.numImageColumns;
        const row = Math.floor(index / appStore.numImageColumns);
        const panelCanvas = getPanelCanvas(column, row, padding, colorbarPosition, backgroundColor);
        if (panelCanvas) {
            ctx.drawImage(panelCanvas, appStore.overlayStore.viewWidth * column * devicePixelRatio, appStore.overlayStore.viewHeight * row * devicePixelRatio);
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

    if (!rasterCanvas || !contourCanvas || !overlayCanvas) {
        return null;
    }

    const colorbarCanvas = panelElement.find(".colorbar-stage")?.children()?.children("canvas")?.[0] as HTMLCanvasElement;
    const beamProfileCanvas = panelElement.find(".beam-profile-stage")?.children()?.children("canvas")?.[0] as HTMLCanvasElement;
    const regionCanvas = panelElement.find(".region-stage")?.children()?.children("canvas")?.[0] as HTMLCanvasElement;

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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(overlayCanvas, 0, 0);

    if (catalogCanvas) {
        ctx.drawImage(catalogCanvas, padding.left * devicePixelRatio, padding.top * devicePixelRatio);
    }

    if (regionCanvas) {
        ctx.drawImage(regionCanvas, padding.left * devicePixelRatio, padding.top * devicePixelRatio);
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

    private ratioIndicatorTimeoutHandle;
    private cachedImageSize: Point2D;
    private cachedGridSize: Point2D;

    @observable showRatioIndicator: boolean = false;

    onResize = (width: number, height: number) => {
        if (width > 0 && height > 0) {
            AppStore.Instance.setImageViewDimensions(width, height);
        }
    };

    @action setRatioIndicatorVisible = (val: boolean) => {
        this.showRatioIndicator = val;
    };

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

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

    @computed get panels() {
        const appStore = AppStore.Instance;
        const visibleFrames = appStore.visibleFrames;
        if (!visibleFrames) {
            return [];
        }
        return visibleFrames.map((frame, index) => {
            const column = index % appStore.numImageColumns;
            const row = Math.floor(index / appStore.numImageColumns);

            return <ImagePanelComponent key={frame.frameInfo.fileId} docked={this.props.docked} frame={frame} row={row} column={column} />;
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
