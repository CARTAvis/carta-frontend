import * as React from "react";
import {NonIdealState, Spinner} from "@blueprintjs/core";
import $ from "jquery";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ResizeDetector} from "components/Shared";
import {ImageType, Point2D, Zoom} from "models";
import {AppStore, DefaultWidgetConfig, HelpType, Padding, WidgetProps} from "stores";
import {toFixed} from "utilities";

import {ChannelMapViewComponent} from "./ChannelMapView/ChannelMapViewComponent";
import {ImagePanelComponent} from "./ImagePanel/ImagePanelComponent";

import "./ImageViewComponent.scss";

export enum ImageViewLayer {
    RegionCreating = "regionCreating",
    Catalog = "catalog",
    RegionMoving = "regionMoving"
}

export function getImageViewCanvas(padding: Padding, colorbarPosition: string, backgroundColor: string = "rgba(255, 255, 255, 0)") {
    const appStore = AppStore.Instance;
    const config = appStore.imageViewConfigStore;

    const imageViewCanvas = document.createElement("canvas") as HTMLCanvasElement;
    imageViewCanvas.width = appStore.fullViewWidth * appStore.pixelRatio;
    imageViewCanvas.height = appStore.fullViewHeight * appStore.pixelRatio;
    const ctx = imageViewCanvas.getContext("2d");
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, imageViewCanvas.width, imageViewCanvas.height);
    config.visibleImages.forEach((image, index) => {
        const frame = image?.type === ImageType.COLOR_BLENDING ? image.store?.baseFrame : image?.store;
        const column = index % config.numImageColumns;
        const row = Math.floor(index / config.numImageColumns);
        const viewWidth = (appStore.channelMapStore.channelMapEnabled ? frame.channelMapOuterOverlayStore.viewWidth : frame.overlayStore.viewWidth) * appStore.pixelRatio;
        const viewHeight = (appStore.channelMapStore.channelMapEnabled ? frame.channelMapOuterOverlayStore.viewHeight : frame.overlayStore.viewHeight) * appStore.pixelRatio;
        const panelCanvas = getPanelCanvas(column, row, viewWidth, viewHeight, padding, colorbarPosition, backgroundColor);
        if (panelCanvas) {
            ctx.drawImage(panelCanvas, frame.overlayStore.viewWidth * column * appStore.pixelRatio, frame.overlayStore.viewHeight * row * appStore.pixelRatio);
        }
    });

    return imageViewCanvas;
}

export function getPanelCanvas(column: number, row: number, viewWidth: number, viewHeight: number, padding: Padding, colorbarPosition: string, backgroundColor: string = "rgba(255, 255, 255, 0)") {
    const panelElement = $(`#image-panel-${column}-${row}`)?.first();
    if (!panelElement?.length) {
        return null;
    }
    const rasterCanvas = panelElement.find(".raster-canvas")?.[0] as HTMLCanvasElement;
    const contourCanvas = panelElement.find(".contour-canvas")?.[0] as HTMLCanvasElement;
    const overlayCanvasArray = panelElement.find(".overlay-canvas") as JQuery<HTMLCanvasElement>;
    const catalogCanvas = panelElement.find(".catalog-canvas")?.[0] as HTMLCanvasElement;
    const vectorOverlayCanvas = panelElement.find(".vector-overlay-canvas")?.[0] as HTMLCanvasElement;

    if (!rasterCanvas || !overlayCanvasArray?.length) {
        return null;
    }

    const colorbarCanvas = panelElement.find(".colorbar-stage")?.children()?.children("canvas")?.[0] as HTMLCanvasElement;
    const beamProfileCanvas = panelElement.find(".beam-profile-stage")?.children()?.children("canvas")?.[0] as HTMLCanvasElement;
    const regionDivArray = panelElement.find(".region-stage") as JQuery<HTMLDivElement>;
    const channelMapLabelArray = panelElement.find(".channel-map-label-span") as JQuery<HTMLSpanElement>;

    const appStore = AppStore.Instance;
    const composedCanvas = document.createElement("canvas") as HTMLCanvasElement;
    composedCanvas.width = viewWidth;
    composedCanvas.height = viewHeight;

    const ctx = composedCanvas.getContext("2d");
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, composedCanvas.width, composedCanvas.height);
    ctx.drawImage(rasterCanvas, padding.left * appStore.pixelRatio, padding.top * appStore.pixelRatio);

    if (contourCanvas) {
        ctx.drawImage(contourCanvas, padding.left * appStore.pixelRatio, padding.top * appStore.pixelRatio);
    }

    if (vectorOverlayCanvas) {
        ctx.drawImage(vectorOverlayCanvas, padding.left * appStore.pixelRatio, padding.top * appStore.pixelRatio);
    }

    if (colorbarCanvas) {
        let xPos, yPos;
        switch (colorbarPosition) {
            case "top":
                xPos = 0;
                yPos = padding.top * appStore.pixelRatio - colorbarCanvas.height;
                break;
            case "bottom":
                xPos = 0;
                yPos = viewHeight - colorbarCanvas.height - AppStore.Instance.overlaySettings.colorbarHoverInfoHeight * appStore.pixelRatio;
                break;
            case "right":
            default:
                xPos = padding.left * appStore.pixelRatio + rasterCanvas.width;
                yPos = 0;
                break;
        }
        ctx.drawImage(colorbarCanvas, xPos, yPos);
    }

    if (beamProfileCanvas) {
        const beamProfileDiv = panelElement.find(".beam-profile-stage")?.[0] as HTMLDivElement;
        const offsetLeft = beamProfileDiv?.offsetLeft * appStore.pixelRatio || 0;
        const offsetTop = beamProfileDiv?.offsetTop * appStore.pixelRatio || 0;
        ctx.drawImage(beamProfileCanvas, offsetLeft, offsetTop);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const overlayCanvas of overlayCanvasArray) {
        ctx.drawImage(overlayCanvas, overlayCanvas.offsetLeft * appStore.pixelRatio, overlayCanvas.offsetTop * appStore.pixelRatio);
    }

    if (catalogCanvas) {
        ctx.drawImage(catalogCanvas, padding.left * appStore.pixelRatio, padding.top * appStore.pixelRatio);
    }

    if (channelMapLabelArray?.length) {
        for (const channelMapLabel of channelMapLabelArray) {
            const style = getComputedStyle(channelMapLabel);
            const offsetLeft = (channelMapLabel.offsetLeft + parseFloat(style.paddingLeft)) * appStore.pixelRatio;
            const offsetTop = (channelMapLabel.offsetTop + parseFloat(style.paddingTop)) * appStore.pixelRatio;

            const fontSize = parseFloat(style.fontSize);
            const scaledFontSize = fontSize * appStore.pixelRatio;
            const fontStyle = style.fontStyle;
            const fontVariant = style.fontVariant;
            const fontWeight = style.fontWeight;
            const fontFamily = style.fontFamily;
            ctx.font = `${fontStyle} ${fontVariant} ${fontWeight} ${scaledFontSize}px ${fontFamily}`;

            ctx.fillStyle = style.color;
            ctx.textBaseline = "bottom";

            const divElementArray = channelMapLabel.querySelectorAll("div");
            let line = 1;
            const lineHeight = parseFloat(style.lineHeight) * appStore.pixelRatio;
            for (const divElement of divElementArray) {
                if (divElement.textContent) {
                    ctx.fillText(divElement.textContent, offsetLeft, offsetTop + lineHeight * line);
                    line++;
                }
            }
        }
    }

    if (regionDivArray?.length) {
        for (const regionDiv of regionDivArray) {
            const regionCanvas = regionDiv?.children[0]?.querySelector("canvas");
            ctx.drawImage(regionCanvas, regionDiv.offsetLeft * appStore.pixelRatio, regionDiv.offsetTop * appStore.pixelRatio);
        }
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
            const requiresAutoFit = appStore.preferenceStore.zoomMode === Zoom.FIT && appStore.fullViewWidth <= 1 && appStore.fullViewHeight <= 1;
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
            const visibleFrames = appStore.imageViewConfigStore.visibleFrames;
            if (!visibleFrames.length) {
                return;
            }

            const firstFrame = visibleFrames[0];
            if (!firstFrame) {
                return;
            }

            const imageSize = {x: firstFrame.overlayStore.renderWidth, y: firstFrame.overlayStore.renderHeight};
            const imageGridSize = {x: appStore.imageViewConfigStore.numImageColumns, y: appStore.imageViewConfigStore.numImageRows};
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
        const config = appStore.imageViewConfigStore;
        const visibleImages = config.visibleImages;
        this.imagePanelRefs = [];
        if (!visibleImages) {
            return [];
        }

        return appStore.channelMapStore.channelMapEnabled
            ? [<ChannelMapViewComponent docked={this.props.docked} key="channel-map-panel" />]
            : visibleImages.map((image, index) => {
                  const column = index % config.numImageColumns;
                  const row = Math.floor(index / config.numImageColumns);

                  return <ImagePanelComponent ref={this.collectImagePanelRef} key={`${image?.type}-${image?.store?.id}`} docked={this.props.docked} image={image} row={row} column={column} />;
              });
    }

    render() {
        const appStore = AppStore.Instance;
        const config = appStore.imageViewConfigStore;

        let divContents: React.ReactNode | React.ReactNode[];
        if (!this.panels.length) {
            divContents = <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />;
        } else if (!appStore.astReady) {
            divContents = <NonIdealState icon={<Spinner className="astLoadingSpinner" />} title={"Loading AST Library"} />;
        } else {
            const firstFrame = appStore.imageViewConfigStore.visibleFrames?.[0];
            const effectiveImageSize = {x: Math.floor(firstFrame?.overlayStore?.renderWidth), y: Math.floor(firstFrame?.overlayStore?.renderHeight)};
            const ratio = effectiveImageSize.x / effectiveImageSize.y;
            const gridSize = {x: config.numImageColumns, y: config.numImageRows};

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
            <ResizeDetector onResize={this.onResize} throttleTime={33}>
                <div className="image-view-div" style={{gridTemplateColumns: `repeat(${config.numImageColumns}, auto)`, gridTemplateRows: `repeat(${config.numImageRows}, 1fr)`}} data-testid="viewer-div">
                    {divContents}
                </div>
            </ResizeDetector>
        );
    }
}
