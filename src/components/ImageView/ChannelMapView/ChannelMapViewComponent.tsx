import * as React from "react";
import {NonIdealState} from "@blueprintjs/core";
import classNames from "classnames";
import {observer} from "mobx-react";

import {CursorInfo, ImageType} from "models";
import {AppStore, FrameStore} from "stores";

import {BeamProfileOverlayComponent} from "../BeamProfileOverlay/BeamProfileOverlayComponent";
import {ColorbarComponent} from "../Colorbar/ColorbarComponent";
import {CursorOverlayComponent} from "../CursorOverlay/CursorOverlayComponent";
import {OverlayComponent} from "../Overlay/OverlayComponent";
import {RasterViewComponent} from "../RasterView/RasterViewComponent";
import {RegionViewComponent} from "../RegionView/RegionViewComponent";
import {ToolbarComponent} from "../Toolbar/ToolbarComponent";

import {ChannelMapLabelComponent} from "./ChannelMapLabelComponent";

export class ChannelMapViewComponentProps {
    docked: boolean;
}

export const ChannelMapViewComponent: React.FC<ChannelMapViewComponentProps> = observer((props: ChannelMapViewComponentProps) => {
    const regionViewRef = React.useRef<RegionViewComponent>();
    const appStore = AppStore.Instance;
    const channelMapStore = appStore.channelMapStore;
    const frame = channelMapStore.displayedFrame;
    const image = channelMapStore.displayedImage;
    const overlaySettings = appStore.overlaySettings;

    const [imageToolbarVisible, setImageToolbarVisible] = React.useState(false);

    if (!frame) {
        return <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />;
    }

    const outerPadding = frame.channelMapOuterOverlayStore.padding;
    const outerViewWidth = frame.channelMapOuterOverlayStore.viewWidth;
    const outerViewHeight = frame.channelMapOuterOverlayStore.viewHeight;
    const outerRenderWidth = frame.channelMapOuterOverlayStore.renderWidth;
    const outerRenderHeight = frame.channelMapOuterOverlayStore.renderHeight;

    const innerRenderWidth = frame.channelMapInnerOverlayStore.renderWidth;
    const innerRenderHeight = frame.channelMapInnerOverlayStore.renderHeight;
    const gapX = frame.channelMapInnerOverlayStore.gapX;
    const gapY = frame.channelMapInnerOverlayStore.gapY;

    const lastRow = Math.floor((channelMapStore.channelArray.length - 1) / channelMapStore.numColumns);

    const onMouseEnter = () => {
        setImageToolbarVisible(true);
    };

    const onMouseLeave = () => {
        setImageToolbarVisible(false);
    };

    const onRegionViewZoom = (frame: FrameStore, zoom: number) => {
        if (frame) {
            regionViewRef?.current?.stageZoomToPoint(frame.renderWidth / 2, frame.renderHeight / 2, zoom);
        }
    };

    const fitZoomFrameAndRegion = (frame: FrameStore) => {
        if (frame) {
            const zoom = frame.fitZoom();
            if (zoom) {
                onRegionViewZoom(frame, zoom);
            }
        }
    };

    const onClickToCenter = (frame: FrameStore, cursorInfo: CursorInfo) => {
        frame?.setCenter(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y);
    };

    if (image?.type === ImageType.COLOR_BLENDING) {
        return <NonIdealState icon={"error"} title={"Not supported"} description={"Color blending images in channel map view is not supported"} />;
    }

    const overlayComponents = channelMapStore.channelArray.map((channel, index) => {
        const column = index % channelMapStore.numColumns;
        const row = Math.floor(index / channelMapStore.numColumns);
        const left = outerPadding.left + (innerRenderWidth + gapX) * column;
        const top = outerPadding.top + (innerRenderHeight + gapY) * row;
        const isCornerOverlay = column === 0 && (row === channelMapStore.numRows - 1 || row === lastRow);

        return (
            channel < frame?.frameInfo.fileInfoExtended.depth && (
                <div
                    key={index}
                    onClick={() => {
                        frame.setChannel(channel);
                        appStore.setActiveImage(image);
                    }}
                    style={{top}}
                >
                    {frame?.frameInfo.fileInfoExtended.depth > 1 && (
                        <ChannelMapLabelComponent
                            image={{
                                type: ImageType.FRAME,
                                store: frame
                            }}
                            overlaySettings={overlaySettings}
                            top={top}
                            left={left}
                            width={innerRenderWidth}
                            height={innerRenderHeight}
                            docked={props.docked}
                            channel={channel}
                            highlighted={channel === frame.requiredChannel}
                        />
                    )}
                    <RegionViewComponent
                        key={`region-view-component-${index}`}
                        frame={frame}
                        width={innerRenderWidth}
                        height={innerRenderHeight}
                        top={top}
                        left={left}
                        onClickToCenter={cursorInfo => onClickToCenter(frame, cursorInfo)}
                        dragPanningEnabled={appStore.preferenceStore.dragPanning}
                        docked={props.docked}
                    />
                    {isCornerOverlay && <BeamProfileOverlayComponent frame={frame} top={top} left={left} docked={props.docked} padding={10} />}
                </div>
            )
        );
    });

    return (
        <div
            id="image-panel-0-0"
            className="image-panel-div"
            key={"channel-map"}
            style={{
                width: outerViewWidth,
                height: outerViewHeight
            }}
            onMouseOver={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <ChannelMapInnerOverlayComponent frame={frame} docked={props.docked} />
            {overlayComponents}
            <RasterViewComponent
                key={"raster-view-component-channel-map"}
                image={image}
                docked={props.docked}
                pixelHighlightValue={channelMapStore.pixelHighlightValue}
                row={0}
                column={0}
                renderWidth={outerRenderWidth}
                renderHeight={outerRenderHeight}
                channel={channelMapStore.channelArray}
            />
            <CursorOverlayComponent
                cursorInfo={frame.cursorInfo}
                cursorValue={frame.cursorInfo.isInsideImage ? frame.cursorValue.value : undefined}
                isValueCurrent={frame.isCursorValueCurrent}
                spectralInfo={frame.spectralInfo}
                width={outerViewWidth}
                left={outerPadding.left}
                right={outerPadding.right}
                docked={props.docked}
                unit={frame.requiredUnit}
                top={outerPadding.top}
                currentStokes={AppStore.Instance.activeFrame?.requiredPolarizationInfo}
                cursorValueToPercentage={frame.requiredUnit === "%"}
                isPreview={frame.isPreview}
                visible={imageToolbarVisible}
            />
            <ToolbarComponent
                docked={props.docked}
                visible={imageToolbarVisible}
                frame={frame}
                activeLayer={AppStore.Instance.activeLayer}
                onActiveLayerChange={AppStore.Instance.updateActiveLayer}
                onRegionViewZoom={zoom => onRegionViewZoom(frame, zoom)}
                onZoomToFit={() => fitZoomFrameAndRegion(frame)}
            />
            {overlaySettings.colorbar.visible && <ColorbarComponent frame={frame} onCursorHoverValueChanged={channelMapStore.setPixelHighlightValue} />}
            <OverlayComponent
                key={`overlay-view-component-outer`}
                image={{
                    type: ImageType.FRAME,
                    store: frame
                }}
                overlaySettings={overlaySettings}
                overlayStore={frame.channelMapOuterOverlayStore}
                docked={props.docked}
                unscaled={true}
            />
        </div>
    );
});

const ChannelMapInnerOverlayComponent = observer(({frame, docked}: {frame: FrameStore; docked: boolean}) => {
    const appStore = AppStore.Instance;
    const overlaySettings = appStore.overlaySettings;
    const channelMapStore = appStore.channelMapStore;
    const lastRow = Math.floor((channelMapStore.channelArray.length - 1) / channelMapStore.numColumns);
    const columnOfLastFrame = channelMapStore.channelArray.length - lastRow * channelMapStore.numColumns - 1;

    const outerPadding = frame.channelMapOuterOverlayStore.padding;
    const innerPadding = frame.channelMapInnerOverlayStore.padding;
    const innerViewWidth = frame.channelMapInnerOverlayStore.viewWidth;
    const innerViewHeight = frame.channelMapInnerOverlayStore.viewHeight;
    const innerRenderWidth = frame.channelMapInnerOverlayStore.renderWidth;
    const innerRenderHeight = frame.channelMapInnerOverlayStore.renderHeight;
    const gapX = frame.channelMapInnerOverlayStore.gapX;
    const gapY = frame.channelMapInnerOverlayStore.gapY;

    const canvasRef = React.useRef(null);
    const getCanvasRefMap = (): Map<number, {overlayType: "left" | "bottom" | "inner"; node: HTMLCanvasElement}> => {
        if (!canvasRef.current) {
            canvasRef.current = new Map();
        }
        return canvasRef.current;
    };

    const draw = sourceCanvas => {
        if (!sourceCanvas) {
            return;
        }

        const sourceWidth = sourceCanvas.width;
        const sourceHeight = sourceCanvas.height;
        const pixelRatio = AppStore.Instance.pixelRatio;
        // when border > 1, include the area of the border
        const extraBorderWidth = overlaySettings.border.width - 1;
        // when the padding is x.5, exclude a smaller area (x instead of x.5) when redrawing
        const innerPaddingLeft = Math.floor(innerPadding.left * pixelRatio - extraBorderWidth);
        const innerPaddingBottom = Math.floor(innerPadding.bottom * pixelRatio - extraBorderWidth);

        channelMapStore.channelArray.forEach((channel, index) => {
            const canvasRefObject = getCanvasRefMap().get(index);
            if (!canvasRefObject) {
                return;
            }

            const {overlayType, node: destCanvas} = canvasRefObject;
            const ctx = destCanvas?.getContext("2d");
            if (!ctx) {
                return;
            }

            destCanvas.width = sourceWidth;
            destCanvas.height = sourceHeight;
            ctx.clearRect(0, 0, destCanvas.width, destCanvas.height);
            ctx.imageSmoothingEnabled = false;

            let x = 0,
                y = 0,
                w = sourceWidth,
                h = sourceHeight;
            if (overlayType === "left") {
                h -= innerPaddingBottom;
            } else if (overlayType === "bottom") {
                x += innerPaddingLeft;
                w -= innerPaddingLeft;
            } else if (overlayType === "inner") {
                x += innerPaddingLeft;
                w -= innerPaddingLeft;
                h -= innerPaddingBottom;
            }
            ctx.drawImage(sourceCanvas, x, y, w, h, x, y, w, h);
        });
    };

    const className = classNames("overlay-canvas", {docked: docked});

    return (
        <>
            {channelMapStore.channelArray.map((channel, index) => {
                const column = index % channelMapStore.numColumns;
                const row = Math.floor(index / channelMapStore.numColumns);

                let overlayType: "corner" | "left" | "bottom" | "inner";
                if (column === 0 && (row === channelMapStore.numRows - 1 || row === lastRow)) {
                    overlayType = "corner";
                } else if (column === 0) {
                    overlayType = "left";
                } else if (row === channelMapStore.numRows - 1 || row === lastRow || (row === lastRow - 1 && column > columnOfLastFrame)) {
                    overlayType = "bottom";
                } else {
                    overlayType = "inner";
                }

                const left = outerPadding.left + (innerRenderWidth + gapX) * column - innerPadding.left;
                const top = outerPadding.top + (innerRenderHeight + gapY) * row - innerPadding.top;

                return overlayType !== "corner" ? (
                    <canvas
                        className={className}
                        key={index}
                        ref={node => {
                            const map = getCanvasRefMap();
                            if (node) {
                                map.set(index, {overlayType, node});
                            } else {
                                map.delete(index);
                            }
                        }}
                        style={{left, top, width: innerViewWidth, height: innerViewHeight}}
                    />
                ) : null;
            })}
            <OverlayComponent
                image={{
                    type: ImageType.FRAME,
                    store: frame
                }}
                overlaySettings={overlaySettings}
                overlayStore={frame.channelMapInnerOverlayStore}
                top={outerPadding.top + (innerRenderHeight + gapY) * lastRow - innerPadding.top}
                docked={docked}
                channelMapDrawFunction={draw}
            />
        </>
    );
});
