import * as React from "react";
import {NonIdealState} from "@blueprintjs/core";
import _ from "lodash";
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
    const frame = channelMapStore.masterFrame;
    const image = channelMapStore.masterImage;
    const overlayStore = appStore.overlayStore;
    const colorBarSetting = overlayStore.colorbar;
    const colorbarOffset = overlayStore.colorbar.visible ? colorBarSetting.stageWidth + overlayStore?.colorbarHoverInfoHeight : 0;

    const [overlayComponentRef, setOverlayComponentRef] = React.useState<OverlayComponent>();
    const [imageToolbarVisible, setImageToolbarVisible] = React.useState(false);

    const renderWidth = overlayStore.fullViewWidth;
    const renderHeight = overlayStore.fullViewHeight;

    const channelMapViewWidth = renderWidth - overlayStore.paddingRight - overlayStore.paddingLeft;
    const channelMapViewHeight = renderHeight - overlayStore.paddingBottom - overlayStore.paddingTop;

    const lastRow = Math.floor((channelMapStore.channelArray.length - 1) / channelMapStore.numColumns);
    const columnOfLastFrame = channelMapStore.channelArray.length - lastRow * channelMapStore.numColumns - 1;

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

    const overlayComponents = channelMapStore.channelArray.map((channel, index) => {
        const appStore = AppStore.Instance;
        const overlayStore = appStore.overlayStore;
        const column = index % channelMapStore.numColumns;
        const row = Math.floor(index / channelMapStore.numColumns);

        let imageViewWidth = channelMapViewWidth / channelMapStore.numColumns;
        let imageViewHeight = channelMapViewHeight / channelMapStore.numRows;

        let overlayComponentTop = imageViewHeight * row + overlayStore.paddingTop;
        let overlayComponentLeft = imageViewWidth * column + overlayStore.paddingLeft;

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

        let imageTop = overlayComponentTop + overlayStore.channelMapInnerPadding(overlayType).top;
        let imageLeft = overlayComponentLeft;

        const imageRenderWidth = frame?.renderWidth;
        const imageRenderHeight = frame?.renderHeight;

        return (
            channel < channelMapStore.masterFrame?.frameInfo.fileInfoExtended.depth && (
                <div key={index} onClick={() => channelMapStore.masterFrame.setChannel(channel)} style={{top: overlayComponentTop}}>
                    <ChannelMapInnerOverlayComponent
                        index={index}
                        frame={frame}
                        renderWidth={renderWidth}
                        renderHeight={renderHeight}
                        docked={props.docked}
                        overlayComponentRef={overlayComponentRef}
                        setOverlayComponentRef={setOverlayComponentRef}
                    />
                    {channelMapStore.masterFrame?.frameInfo.fileInfoExtended.depth > 1 && (
                        <ChannelMapLabelComponent
                            image={{
                                type: ImageType.FRAME,
                                store: frame
                            }}
                            overlaySettings={overlayStore}
                            top={imageTop}
                            left={imageLeft}
                            width={imageRenderWidth}
                            height={imageRenderHeight}
                            docked={props.docked}
                            channel={channel}
                            highlighted={channel === channelMapStore.masterFrame.requiredChannel}
                        />
                    )}
                    <RegionViewComponent
                        key={`region-view-component-${index}`}
                        frame={frame}
                        width={imageRenderWidth}
                        height={imageRenderHeight}
                        top={imageTop}
                        left={imageLeft}
                        onClickToCenter={cursorInfo => onClickToCenter(frame, cursorInfo)}
                        overlaySettings={overlayStore}
                        dragPanningEnabled={appStore.preferenceStore.dragPanning}
                        docked={props.docked}
                    />
                    {overlayType === "corner" && <BeamProfileOverlayComponent frame={frame} top={imageTop} left={imageLeft} docked={props.docked} padding={10} />}
                </div>
            )
        );
    });

    return frame ? (
        <div id={`image-panel`} key={"channel-map"} onMouseOver={onMouseEnter} onMouseLeave={onMouseLeave}>
            <div
                style={{
                    width: renderWidth - overlayStore.paddingRight,
                    height: renderHeight - overlayStore.paddingBottom,
                    position: "absolute"
                }}
            >
                {overlayComponents}
                <RasterViewComponent
                    key={"raster-view-component-channel-map"}
                    image={image}
                    docked={props.docked}
                    pixelHighlightValue={channelMapStore.pixelHighlightValue}
                    renderWidth={channelMapViewWidth}
                    renderHeight={channelMapViewHeight}
                    row={0}
                    column={0}
                    leftPadding={overlayStore.paddingLeft}
                    channel={channelMapStore.channelArray}
                />
                <CursorOverlayComponent
                    cursorInfo={frame.cursorInfo}
                    cursorValue={frame.cursorInfo.isInsideImage ? frame.cursorValue.value : undefined}
                    isValueCurrent={frame.isCursorValueCurrent}
                    spectralInfo={frame.spectralInfo}
                    width={
                        channelMapStore.masterFrame?.frameInfo.fileInfoExtended.depth < channelMapStore.numColumns
                            ? channelMapStore.masterFrame.renderWidth + overlayStore.paddingLeft + overlayStore.paddingRight
                            : renderWidth - overlayStore.base
                    }
                    left={overlayStore.paddingLeft}
                    right={overlayStore.paddingRight}
                    docked={props.docked}
                    unit={frame.requiredUnit}
                    top={overlayStore.paddingTop + overlayStore.base}
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
                    bottom={0}
                    right={0}
                />
            </div>
            {overlayStore.colorbar.visible && (
                <ColorbarComponent
                    frame={frame}
                    onCursorHoverValueChanged={channelMapStore.setPixelHighlightValue}
                    width={renderWidth}
                    height={renderHeight}
                    leftOffset={overlayStore.colorbar.position === "right" ? overlayStore.paddingTop * 2 : overlayStore.paddingLeft}
                    left={overlayStore.colorbar.position === "right" ? renderWidth - overlayStore.paddingRight : 0}
                    top={overlayStore.colorbar.position === "bottom" ? renderHeight - colorbarOffset : overlayStore.colorbar.position === "right" ? 0 : overlayStore.paddingTop - colorbarOffset}
                    length={overlayStore.colorbar.position === "right" ? channelMapViewHeight - overlayStore.paddingTop : channelMapViewWidth}
                />
            )}
            <OverlayComponent
                key={`overlay-view-component-outer`}
                image={{
                    type: ImageType.FRAME,
                    store: frame
                }}
                overlaySettings={overlayStore}
                top={overlayStore.base}
                left={0}
                docked={props.docked}
                type={"channel-map-outer"}
                width={renderWidth - overlayStore.base}
                height={renderHeight - overlayStore.base}
                unScaled={true}
            />
        </div>
    ) : (
        <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"} />
    );
});

const ChannelMapInnerOverlayComponent = observer(
    ({
        index,
        frame,
        renderWidth,
        renderHeight,
        overlayComponentRef,
        setOverlayComponentRef,
        docked
    }: {
        index: number;
        frame: FrameStore;
        renderWidth: number;
        renderHeight: number;
        overlayComponentRef: OverlayComponent | undefined;
        setOverlayComponentRef: (ref: OverlayComponent | undefined) => void;
        docked: boolean;
    }) => {
        const appStore = AppStore.Instance;
        const overlayStore = appStore.overlayStore;
        const channelMapStore = appStore.channelMapStore;
        const column = index % channelMapStore.numColumns;
        const row = Math.floor(index / channelMapStore.numColumns);
        const lastRow = Math.floor((channelMapStore.channelArray.length - 1) / channelMapStore.numColumns);
        const columnOfLastFrame = channelMapStore.channelArray.length - lastRow * channelMapStore.numColumns - 1;

        const channelMapViewWidth = renderWidth - overlayStore.paddingLeft - overlayStore.paddingRight;
        const channelMapViewHeight = renderHeight - overlayStore.paddingBottom - overlayStore.paddingTop;
        const imageRenderWidth = channelMapViewWidth / channelMapStore.numColumns;
        const imageRenderHeight = channelMapViewHeight / channelMapStore.numRows;
        let overlayComponentTop = imageRenderHeight * row + overlayStore.paddingTop;
        let overlayComponentLeft = imageRenderWidth * column + overlayStore.paddingLeft;
        let overlayType: "corner" | "left" | "bottom" | "inner";

        const canvasRef = React.useRef<HTMLCanvasElement>(null);

        const getCornerOverlay = () => {
            const left = overlayComponentLeft;

            return (
                <OverlayComponent
                    key={`overlay-view-component`}
                    ref={ref => {
                        setOverlayComponentRef(ref);
                        if (ref?.canvas) {
                            ref.canvas.id = `${column}_${row}`;
                        }
                    }}
                    image={{
                        type: ImageType.FRAME,
                        store: frame
                    }}
                    overlaySettings={overlayStore}
                    top={overlayComponentTop}
                    left={left}
                    docked={docked}
                    width={Math.ceil(imageRenderWidth) + overlayStore.paddingLeft}
                    height={Math.ceil(imageRenderHeight) + overlayStore.paddingBottom}
                    type={"channel-map-inner"}
                />
            );
        };
        let width = channelMapViewWidth / channelMapStore.numColumns;
        let height = channelMapViewHeight / channelMapStore.numRows;

        if (column === 0) {
            overlayType = "left";
            width += overlayStore.paddingLeft;
            overlayComponentLeft -= overlayStore.paddingLeft;
        } else if (row === channelMapStore.numRows - 1 || row === lastRow || (row === lastRow - 1 && column > columnOfLastFrame)) {
            overlayType = "bottom";
            height += overlayStore.paddingBottom;
        } else {
            overlayType = "inner";
        }
        const getRef = (ref: HTMLCanvasElement) => {
            if (ref) {
                ref.id = `${column}_${row}`;
                canvasRef.current = ref;
            }
        };

        const draw = () => {
            const canvas = canvasRef.current;
            if (canvas && overlayComponentRef?.canvas) {
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    requestAnimationFrame(() => {
                        const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;
                        canvas.width = width * pixelRatio;
                        canvas.height = height * pixelRatio;
                        const destCanvas = canvas.getContext("2d", {willReadFrequently: true});
                        const w = overlayComponentRef.canvas.width;
                        const h = overlayComponentRef.canvas.height;
                        const destWidth = canvas.width;
                        const destHeight = canvas.height;
                        const cornerPaddingLeft = overlayStore.paddingLeft * pixelRatio;
                        const cornerPaddingBottom = overlayStore.paddingBottom * pixelRatio;
                        destCanvas.clearRect(0, 0, canvas.width, canvas.height);
                        if (overlayType === "left") {
                            destCanvas.drawImage(overlayComponentRef.canvas, 0, 0, w, h - cornerPaddingBottom, 0, 0, destWidth, destHeight);
                        } else if (overlayType === "bottom") {
                            destCanvas.drawImage(overlayComponentRef.canvas, cornerPaddingLeft, 0, w - cornerPaddingLeft, h, 0, 0, destWidth, destHeight);
                        } else if (overlayType === "inner") {
                            destCanvas.drawImage(overlayComponentRef.canvas, cornerPaddingLeft, 0, w - cornerPaddingLeft, h - cornerPaddingBottom, 0, 0, destWidth, destHeight);
                        }
                    });
                }
            }
        };

        const throttledDraw = _.throttle(draw, 50);

        React.useEffect(() => {
            throttledDraw();
        }, [
            throttledDraw,
            overlayComponentRef,
            width,
            height,
            channelMapStore.startChannel,
            channelMapStore.endChannel,
            channelMapStore.masterFrame,
            channelMapStore.numColumns,
            channelMapStore.numRows,
            channelMapStore.masterFrame?.center,
            channelMapStore.masterFrame?.requiredFrameView,
            channelMapStore.masterFrame?.requiredFrameView.xMin,
            channelMapStore.masterFrame?.requiredFrameView.xMax,
            channelMapStore.masterFrame?.requiredFrameView.yMin,
            channelMapStore.masterFrame?.requiredFrameView.yMax,
            channelMapStore.masterFrame?.zooming,
            channelMapStore.masterFrame?.zoomLevel,
            channelMapStore.masterFrame?.spatialReference,
            channelMapStore.masterFrame?.channel,
            channelMapStore.masterFrame?.isOffsetCoord,
            channelMapStore.masterFrame?.wcsInfoShifted,
            channelMapStore.masterFrame?.titleCustomText,
            channelMapStore.masterFrame?.filename,
            overlayStore.styleString,
            overlayStore.padding,
            channelMapStore.masterFrame?.moving,
            overlayStore.global.system,
            overlayStore.global.color,
            overlayStore.title.color,
            overlayStore.grid.color,
            overlayStore.border.color,
            overlayStore.ticks.color,
            overlayStore.axes.color,
            overlayStore.numbers.color,
            overlayStore.labels.color,
            overlayStore.title.styleString,
            overlayStore.grid.styleString,
            overlayStore.border.styleString,
            overlayStore.ticks.styleString,
            overlayStore.axes.styleString,
            overlayStore.numbers.styleString,
            overlayStore.labels.styleString
        ]);

        return (
            <>
                {column === 0 && (row === channelMapStore.numRows - 1 || row === lastRow) ? (
                    getCornerOverlay()
                ) : (
                    <canvas key={`overlay-view-component-${index}`} id={`${column}_${row}`} style={{position: "absolute", top: overlayComponentTop, left: overlayComponentLeft, width: width, height: height, zIndex: 2}} ref={getRef} />
                )}
            </>
        );
    }
);
