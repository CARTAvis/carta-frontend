import * as React from "react";
import {NonIdealState, Spinner} from "@blueprintjs/core";
import {action, autorun, type IReactionDisposer, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ResizeDetector} from "components/Shared";
import {HelpType, ImageType} from "enums";
import {type Point2D, Zoom} from "models";
import {AppStore, type DefaultWidgetConfig, type Padding, type WidgetProps} from "stores";
import {LayoutStore} from "stores";
import {toFixed} from "utilities";

import {ChannelMapViewComponent} from "./ChannelMapView/ChannelMapViewComponent";
import {ImagePanelComponent} from "./ImagePanel/ImagePanelComponent";

import "./ImageViewComponent.scss";

/**
 * Search for an element by id in the main document and all FlexLayout popout
 * windows' documents. This is needed because when a widget is rendered in a
 * FlexLayout popout the DOM lives in a different document from the main window.
 */
function findElementInAllDocuments(id: string): HTMLElement | null {
    const el = document.getElementById(id);
    if (el) {
        return el;
    }
    const model = LayoutStore.Instance.layoutModel;
    if (model) {
        for (const [, layoutConfig] of model.getLayouts()) {
            const win = layoutConfig.getWindow();
            if (win && !win.closed) {
                const found = win.document.getElementById(id);
                if (found) {
                    return found;
                }
            }
        }
    }
    return null;
}

export function getImageViewCanvas(padding: Padding, colorbarPosition: string, backgroundColor: string = "rgba(255, 255, 255, 0)") {
    const appStore = AppStore.Instance;
    const config = appStore.imageViewConfigStore;

    const imageViewCanvas = document.createElement("canvas") as HTMLCanvasElement;
    imageViewCanvas.width = appStore.fullViewWidth * appStore.pixelRatio;
    imageViewCanvas.height = appStore.fullViewHeight * appStore.pixelRatio;
    const ctx = imageViewCanvas.getContext("2d");
    if (!ctx) {
        return imageViewCanvas;
    }
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, imageViewCanvas.width, imageViewCanvas.height);
    config.visibleImages.forEach((image, index) => {
        const frame = image?.type === ImageType.COLOR_BLENDING ? image.store?.baseFrame : image?.store;
        if (!frame) {
            return;
        }
        const column = index % config.numImageColumns;
        const row = Math.floor(index / config.numImageColumns);
        const viewWidth = (appStore.channelMapStore.isChannelMapEnabled ? frame.channelMapOuterOverlayStore.viewWidth : frame.overlayStore.viewWidth) * appStore.pixelRatio;
        const viewHeight = (appStore.channelMapStore.isChannelMapEnabled ? frame.channelMapOuterOverlayStore.viewHeight : frame.overlayStore.viewHeight) * appStore.pixelRatio;
        const panelCanvas = getPanelCanvas(column, row, viewWidth, viewHeight, padding, colorbarPosition, backgroundColor);
        if (panelCanvas) {
            ctx.drawImage(panelCanvas, frame.overlayStore.viewWidth * column * appStore.pixelRatio, frame.overlayStore.viewHeight * row * appStore.pixelRatio);
        }
    });

    return imageViewCanvas;
}

export function getPanelCanvas(column: number, row: number, viewWidth: number, viewHeight: number, padding: Padding, colorbarPosition: string, backgroundColor: string = "rgba(255, 255, 255, 0)") {
    const panelElement = findElementInAllDocuments(`image-panel-${column}-${row}`);
    if (!panelElement) {
        return null;
    }
    // Derive the document from the panel element so that the composited canvas is
    // created in the same browsing context as the source canvases (important when
    // the image viewer is rendered in a FlexLayout popout window).
    const ownerDoc = panelElement.ownerDocument;
    const rasterCanvas = panelElement.querySelector(".raster-canvas") as HTMLCanvasElement;
    const contourCanvas = panelElement.querySelector(".contour-canvas") as HTMLCanvasElement;
    const overlayCanvasArray = panelElement.querySelectorAll(".overlay-canvas") as NodeListOf<HTMLCanvasElement>;
    const catalogCanvas = panelElement.querySelector(".catalog-canvas") as HTMLCanvasElement;
    const vectorOverlayCanvas = panelElement.querySelector(".vector-overlay-canvas") as HTMLCanvasElement;

    if (!rasterCanvas || !overlayCanvasArray?.length) {
        return null;
    }

    const colorbarCanvas = panelElement.querySelector(".colorbar-stage canvas") as HTMLCanvasElement;
    const beamProfileCanvas = panelElement.querySelector(".beam-profile-stage canvas") as HTMLCanvasElement;
    const regionDivArray = panelElement.querySelectorAll(".region-stage") as NodeListOf<HTMLDivElement>;
    const channelMapLabelArray = panelElement.querySelectorAll(".channel-map-label-span") as NodeListOf<HTMLSpanElement>;

    const appStore = AppStore.Instance;
    const composedCanvas = ownerDoc.createElement("canvas") as HTMLCanvasElement;
    composedCanvas.width = viewWidth;
    composedCanvas.height = viewHeight;

    const ctx = composedCanvas.getContext("2d");
    if (!ctx) {
        return null;
    }
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
        const beamProfileDiv = panelElement.querySelector(".beam-profile-stage") as HTMLDivElement;
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
            if (regionCanvas) {
                ctx.drawImage(regionCanvas, regionDiv.offsetLeft * appStore.pixelRatio, regionDiv.offsetTop * appStore.pixelRatio);
            }
        }
    }

    return composedCanvas;
}

@observer
export class ImageViewComponent extends React.Component<WidgetProps> {
    public static get WidgetConfig(): DefaultWidgetConfig {
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
    private ratioIndicatorTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
    private cachedImageSize: Point2D;
    private cachedGridSize: Point2D;
    private readonly disposers: IReactionDisposer[] = [];

    @observable shouldShowRatioIndicator: boolean = false;

    onResize = (width: number, height: number) => {
        if (width > 0 && height > 0) {
            const appStore = AppStore.Instance;
            const isAutoFitRequired = appStore.preferenceStore.zoomMode === Zoom.FIT && appStore.fullViewWidth <= 1 && appStore.fullViewHeight <= 1;
            appStore.setImageViewDimensions(width, height);
            if (isAutoFitRequired) {
                this.imagePanelRefs?.forEach(imagePanelRef => imagePanelRef?.fitZoomFrameAndRegion());
            }
        }
    };

    @action setRatioIndicatorVisible = (isVisible: boolean) => {
        this.shouldShowRatioIndicator = isVisible;
    };

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        this.imagePanelRefs = [];

        const appStore = AppStore.Instance;

        this.disposers.push(
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
                const isImageSizeChanged = !this.cachedImageSize || this.cachedImageSize.x !== imageSize.x || this.cachedImageSize.y !== imageSize.y;
                const isGridSizeChanged = !this.cachedGridSize || this.cachedGridSize.x !== imageGridSize.x || this.cachedGridSize.y !== imageGridSize.y;
                if (isImageSizeChanged || isGridSizeChanged) {
                    this.cachedImageSize = imageSize;
                    this.cachedGridSize = imageGridSize;
                    clearTimeout(this.ratioIndicatorTimeoutHandle);
                    this.ratioIndicatorTimeoutHandle = undefined;
                    this.setRatioIndicatorVisible(true);
                    this.ratioIndicatorTimeoutHandle = setTimeout(() => this.setRatioIndicatorVisible(false), 1000);
                }
            })
        );
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
        clearTimeout(this.ratioIndicatorTimeoutHandle);
        this.ratioIndicatorTimeoutHandle = undefined;
    }

    private collectImagePanelRef = ref => {
        this.imagePanelRefs.push(ref);
    };

    get panels() {
        const appStore = AppStore.Instance;
        const config = appStore.imageViewConfigStore;
        const visibleImages = config.visibleImages;
        this.imagePanelRefs = [];
        if (!visibleImages) {
            return [];
        }

        return appStore.channelMapStore.isChannelMapEnabled
            ? [<ChannelMapViewComponent isDocked={this.props.docked} key="channel-map-panel" />]
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
        } else if (!appStore.isAstReady) {
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
                    <div style={{opacity: this.shouldShowRatioIndicator ? 1 : 0}} className={"image-ratio-popup"}>
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
                <div className="image-view-div" style={{gridTemplateColumns: `repeat(${config.numImageColumns}, 1fr)`, gridTemplateRows: `repeat(${config.numImageRows}, 1fr)`}} data-testid="viewer-div">
                    {divContents}
                </div>
            </ResizeDetector>
        );
    }
}
