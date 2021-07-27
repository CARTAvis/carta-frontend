import "./ImageViewComponent.scss";
import * as React from "react";
import $ from "jquery";
import {observer} from "mobx-react";
import ReactResizeDetector from "react-resize-detector";
import {NonIdealState, Spinner} from "@blueprintjs/core";
import {ImagePanelComponent} from "./ImagePanel/ImagePanelComponent";
import {AppStore, DefaultWidgetConfig, HelpType, Padding, WidgetProps} from "stores";
import {computed} from "mobx";

export enum ImageViewLayer {
    RegionCreating = "regionCreating",
    Catalog = "catalog",
    RegionMoving = "regionMoving",
    DistanceMeasuring = "distanceMeasuring"
}

export const getImageCanvas = (padding: Padding, colorbarPosition: string, backgroundColor: string = "rgba(255, 255, 255, 0)"): HTMLCanvasElement => {
    const rasterCanvas = document.getElementById("raster-canvas") as HTMLCanvasElement;
    const contourCanvas = document.getElementById("contour-canvas") as HTMLCanvasElement;
    const overlayCanvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
    const catalogCanvas = document.getElementById("catalog-canvas") as HTMLCanvasElement;

    if (!rasterCanvas || !contourCanvas || !overlayCanvas) {
        return null;
    }

    let colorbarCanvas: HTMLCanvasElement;
    let regionCanvas: HTMLCanvasElement;
    let beamProfileCanvas: HTMLCanvasElement;

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
};

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

    onResize = (width: number, height: number) => {
        if (width > 0 && height > 0) {
            AppStore.Instance.setImageViewDimensions(width, height);
        }
    };

    @computed get panels() {
        const visibleFrames = AppStore.Instance.visibleFrames;
        return visibleFrames?.map(frame => <ImagePanelComponent key={frame.frameInfo.fileId} docked={this.props.docked} frame={frame} />) ?? [];
    }

    render() {
        const appStore = AppStore.Instance;

        let divContents: React.ReactNode | React.ReactNode[];
        if (!this.panels.length) {
            divContents = <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />;
        } else if (!appStore.astReady) {
            divContents = <NonIdealState icon={<Spinner className="astLoadingSpinner" />} title={"Loading AST Library"} />;
        } else {
            divContents = this.panels;
        }

        return (
            <div className="image-view-div" style={{gridTemplateColumns: `repeat(${appStore.numColumns}, auto)`}}>
                {divContents}
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}></ReactResizeDetector>
            </div>
        );
    }
}
