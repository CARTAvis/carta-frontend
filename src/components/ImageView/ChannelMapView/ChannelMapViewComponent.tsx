import * as React from "react";
import {NonIdealState} from "@blueprintjs/core";
import {autorun, reaction} from "mobx";
import {observer} from "mobx-react";

import {CursorInfo, ImageType} from "models";
import {TileService, TileWebGLService} from "services";
import {AppStore, ChannelMapStore, FrameStore} from "stores";

import {BeamProfileOverlayComponent} from "../BeamProfileOverlay/BeamProfileOverlayComponent";
import {CatalogViewGLComponent} from "../CatalogView/CatalogViewGLComponent";
import {ColorbarComponent} from "../Colorbar/ColorbarComponent";
import {ContourViewComponent} from "../ContourView/ContourViewComponent";
import {CursorOverlayComponent} from "../CursorOverlay/CursorOverlayComponent";
import {OverlayComponent} from "../Overlay/OverlayComponent";
import {RasterViewComponent} from "../RasterView/RasterViewComponent";
import {RegionViewComponent} from "../RegionView/RegionViewComponent";
import {ToolbarComponent} from "../Toolbar/ToolbarComponent";
import {VectorOverlayViewComponent} from "../VectorOverlayView/VectorOverlayView";

import {ChannelMapLabelComponent} from "./ChannelMapLabelComponent";

export class ChannelMapViewComponentProps {
    frame: FrameStore;
    docked: boolean;
    channelMapStore: ChannelMapStore;
    renderWidth: number; // width/height of the area where channel map is showing
    renderHeight: number;
}

export const ChannelMapViewComponent: React.FC<ChannelMapViewComponentProps> = observer((props: ChannelMapViewComponentProps) => {
    const regionViewRef = React.useRef<RegionViewComponent>();
    const cursorOverlayRef = React.useRef<CursorOverlayComponent>();
    const channelMapStore = props.channelMapStore;
    const frame = channelMapStore.masterFrame;
    const image = channelMapStore.masterImage;
    const overlayStore = AppStore.Instance.overlayStore;
    const colorBarSetting = overlayStore.colorbar;
    const colorbarOffset = overlayStore.colorbar.visible ? colorBarSetting.stageWidth + frame?.overlayStore?.colorbarHoverInfoHeight : 0;

    const [overlayComponentRef, setOverlayComponentRef] = React.useState<OverlayComponent>();
    const [contourCanvasRef, setContourCanvasRef] = React.useState<ContourViewComponent>();
    const [vectorOverlayViewComponentRef, setVectorOverlayViewComponentRef] = React.useState<VectorOverlayViewComponent>();
    const [catalogViewGLComponentRef, setCatalogViewGLComponentRef] = React.useState<CatalogViewGLComponent>();
    const [imageToolbarVisible, setImageToolbarVisible] = React.useState(false);

    // const heightOffset = colorBarSetting.position === "right" ? 0 : colorbarOffset;
    // const widthOffset = colorBarSetting.position === "right" ? colorbarOffset : 0;
    const channelMapViewWidth = props.renderWidth - overlayStore.paddingRight - overlayStore.paddingLeft;
    const channelMapViewHeight = props.renderHeight - overlayStore.paddingBottom - overlayStore.paddingTop;

    // const numberOffset = overlayStore.numberWidth || 0;
    // const leftOuterOffset = overlayStore.paddingLeft + numberOffset;
    // const bottomOuterOffset = overlayStore.paddingBottom + numberOffset + overlayStore.paddingTop;
    // const leftOuterOffset = overlayStore.paddingLeft;
    // const bottomOuterOffset = overlayStore.paddingBottom;
    // const imageRenderWidth = Math.floor(overlayStore.renderWidth);
    // const imageRenderHeight = Math.floor(overlayStore.renderHeight);
    // const imageRenderWidth = Math.floor((channelMapViewWidth - overlayStore.paddingLeft) / channelMapStore.numColumns);
    // const imageRenderHeight = Math.floor((channelMapViewHeight - overlayStore.paddingBottom) / channelMapStore.numRows);
    const imageRenderWidth = Math.floor(channelMapViewWidth / channelMapStore.numColumns);
    const imageRenderHeight = Math.floor(channelMapViewHeight / channelMapStore.numRows);
    console.log("imageRenderWidth", imageRenderWidth, "imageRenderHeight", imageRenderHeight, channelMapViewWidth, channelMapViewHeight);

    // const overlayStore = channelMapStore.overlayStore(Math.floor(imageRenderWidth), Math.floor(imageRenderHeight));

    React.useEffect(() => {
        const disposer = reaction(
            () => [
                channelMapStore.startChannel,
                channelMapStore.channelRange,
                channelMapStore,
                channelMapStore.masterFrame,
                channelMapStore.numColumns,
                channelMapStore.numRows,
                channelMapStore.masterFrame?.center,
                channelMapStore.masterFrame?.requiredFrameView,
                channelMapStore.masterFrame?.zoomLevel,
                channelMapStore.auxiliaryFrame,
                channelMapStore.auxiliaryFrameChannel,
                channelMapStore.singleChannelContour,
                channelMapStore.singleContourChannel,
                channelMapStore.masterFrame?.spatialReference
            ],
            (
                [startChannel, endChannel, _channelMapStore, masterFrame, numColumns, numRows, center, requiredFrameView, zoomLevel, auxiliaryFrame, auxiliaryFrameChannel, singleChannelContour, singleContourChannel, spatialReference],
                [
                    prevStartChannel,
                    prevEndChannel,
                    prevChannelMapStore,
                    prevMasterFrame,
                    prevNumColumns,
                    prevNumRows,
                    prevCenter,
                    prevRequiredFrameView,
                    prevZoomLevel,
                    prevAuxiliaryFrame,
                    prevAuxiliaryFrameChannel,
                    prevSingleChannelContour,
                    prevSingleContourChannel,
                    prevSpatialReference
                ]
            ) => {
                if (frame && channelMapStore && frame?.requiredFrameView) {
                    channelMapStore.throttledRequestChannels(frame);
                }
            }
        );

        return () => {
            disposer();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        channelMapStore.startChannel,
        channelMapStore.channelRange,
        channelMapStore,
        channelMapStore.masterFrame,
        channelMapStore.numColumns,
        channelMapStore.numRows,
        channelMapStore.masterFrame?.center,
        channelMapStore.masterFrame?.requiredFrameView,
        channelMapStore.masterFrame?.zoomLevel,
        channelMapStore.auxiliaryFrame,
        channelMapStore.auxiliaryFrameChannel,
        channelMapStore.singleChannelContour,
        channelMapStore.singleContourChannel,
        channelMapStore.masterFrame?.spatialReference,
        channelMapStore.masterFrame?.channel
    ]);

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
        const lastRow = Math.floor((channelMapStore.channelArray.length - 1) / channelMapStore.numColumns);
        const columnOfLastFrame = channelMapStore.channelArray.length - lastRow * channelMapStore.numColumns - 1;

        let overlayComponentTop = imageRenderHeight * row;
        let overlayComponentLeft = imageRenderWidth * column + overlayStore.paddingLeft;
        let imageTop = overlayComponentTop + overlayStore.paddingTop;
        let imageLeft = overlayComponentLeft;

        let thisIs: "corner" | "left" | "bottom" | "inner";
        let width = imageRenderWidth;
        let height = imageRenderHeight;

        if (column === 0 && (row === channelMapStore.numRows - 1 || row === lastRow)) {
            thisIs = "corner";
            width += overlayStore.paddingLeft;
            height += overlayStore.paddingBottom;
            overlayComponentLeft -= overlayStore.paddingLeft;
            // imageLeft += overlayStore.paddingLeft;
        } else if (column === 0) {
            thisIs = "left";
            width += overlayStore.paddingLeft;
            height += overlayStore.base;
            overlayComponentLeft -= overlayStore.paddingLeft;
            // imageLeft += overlayStore.paddingLeft;
        } else if (row === channelMapStore.numRows - 1 || row === lastRow || (row === lastRow - 1 && column > columnOfLastFrame)) {
            thisIs = "bottom";
            width += overlayStore.base;
            height += overlayStore.paddingBottom;
        } else {
            thisIs = "inner";
            width += overlayStore.base;
            height += overlayStore.base;
        }

        return (
            channel < channelMapStore.masterFrame?.frameInfo.fileInfoExtended.depth && (
                <div key={index} onClick={() => channelMapStore.masterFrame.setChannel(channel)} style={{top: overlayComponentTop}}>
                    <ContourViewComponent
                        key={`contour-view-component-${index}`}
                        overlayStore={overlayStore}
                        ref={ref => {
                            if (row === 0 && column === 0) setContourCanvasRef(ref);
                        }}
                        frame={frame}
                        channel={channelMapStore.singleChannelContour ? channelMapStore.singleContourChannel : channel}
                        docked={props.docked}
                        row={0}
                        column={0}
                        top={overlayComponentTop}
                        left={overlayComponentLeft}
                        refCanvas={!(row === 0 && column === 0) && channelMapStore.singleChannelContour ? contourCanvasRef?.canvas : undefined} // if set to one contour, turn on, if contour per channel, turn off.
                    />
                    <VectorOverlayViewComponent
                        key={`vector-view-component-${index}`}
                        ref={ref => {
                            if (row === 0 && column === 0) setVectorOverlayViewComponentRef(ref);
                        }}
                        overlayStore={overlayStore}
                        frame={frame}
                        docked={props.docked}
                        row={row}
                        column={column}
                        top={overlayComponentTop}
                        left={overlayComponentLeft}
                        refCanvas={row === 0 && column === 0 ? undefined : vectorOverlayViewComponentRef?.canvas}
                    />
                    <ChannelMapInnerOverlayComponent
                        index={index}
                        frame={frame}
                        renderWidth={props.renderWidth}
                        renderHeight={props.renderHeight}
                        docked={props.docked}
                        overlayComponentRef={overlayComponentRef}
                        setOverlayComponentRef={setOverlayComponentRef}
                    />
                    <ChannelMapLabelComponent
                        image={{
                            type: ImageType.FRAME,
                            store: channelMapStore.showAuxiliaryFrame && channelMapStore.auxiliaryFrame ? channelMapStore.auxiliaryFrame : frame
                        }}
                        overlaySettings={overlayStore}
                        top={imageTop}
                        left={imageLeft}
                        width={overlayStore.channelMapInnerWidth(width, thisIs)}
                        height={overlayStore.channelMapInnerHeight(height, thisIs)}
                        docked={props.docked}
                        channel={channelMapStore.showAuxiliaryFrame ? channelMapStore.auxiliaryFrameChannel : channel}
                    />
                    <CatalogViewGLComponent
                        key={`catalog-view-component-${index}`}
                        ref={ref => {
                            if (row === 0 && column === 0) setCatalogViewGLComponentRef(ref);
                        }}
                        frame={frame}
                        docked={props.docked}
                        top={overlayComponentTop}
                        left={overlayComponentLeft}
                        overlayStore={overlayStore}
                        refCanvas={row === 0 && column === 0 ? undefined : catalogViewGLComponentRef?.canvas}
                    />
                    <RegionViewComponent
                        key={`region-view-component-${index}`}
                        frame={frame}
                        width={overlayStore.channelMapInnerWidth(width, thisIs)}
                        height={overlayStore.channelMapInnerHeight(height, thisIs)}
                        top={imageTop}
                        left={imageLeft}
                        onClickToCenter={cursorInfo => onClickToCenter(frame, cursorInfo)}
                        overlaySettings={overlayStore}
                        dragPanningEnabled={appStore.preferenceStore.dragPanning}
                        docked={props.docked}
                        highlighted={channel === channelMapStore.masterFrame.requiredChannel}
                    />
                </div>
            )
        );
    });

    return frame ? (
        <div id={`image-panel`} key={"channel-map"} onMouseOver={onMouseEnter} onMouseLeave={onMouseLeave}>
            <div
                style={{
                    // top: overlayStore.paddingTop,
                    // left: overlayStore.paddingLeft,
                    width: channelMapViewWidth,
                    height: channelMapViewHeight,
                    position: "absolute"
                }}
            >
                {overlayComponents}
                <RasterViewComponent
                    key={`raster-view-component-${channelMapStore.showAuxiliaryFrame && channelMapStore.auxiliaryFrame ? "auxiliary" : "channel-map"}`}
                    image={image}
                    webGLService={TileWebGLService.Instance}
                    tileService={TileService.Instance}
                    docked={props.docked}
                    pixelHighlightValue={props.channelMapStore.pixelHighlightValue}
                    renderWidth={channelMapViewWidth}
                    renderHeight={channelMapViewHeight}
                    row={0}
                    column={0}
                    left={overlayStore.paddingLeft}
                    tileBasedRender={true}
                    channel={channelMapStore.showAuxiliaryFrame && channelMapStore.auxiliaryFrame ? channelMapStore.channelArray.map(channel => channelMapStore.auxiliaryFrameChannel) : channelMapStore.channelArray}
                />

                <BeamProfileOverlayComponent frame={frame} top={imageRenderHeight * (channelMapStore.numRows - 1)} left={overlayStore.paddingLeft} docked={props.docked} padding={10} />
                <CursorOverlayComponent
                    ref={ref => (cursorOverlayRef.current = ref)}
                    cursorInfo={frame.cursorInfo}
                    cursorValue={frame.cursorInfo.isInsideImage ? frame.cursorValue.value : undefined}
                    isValueCurrent={frame.isCursorValueCurrent}
                    spectralInfo={frame.spectralInfo}
                    width={imageRenderWidth * channelMapStore.numColumns + overlayStore.paddingLeft + overlayStore.paddingRight}
                    left={overlayStore.paddingLeft}
                    right={overlayStore.paddingRight}
                    docked={props.docked}
                    unit={frame.requiredUnit}
                    top={overlayStore.paddingTop}
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
            {frame.overlayStore.colorbar.visible && (
                <ColorbarComponent
                    frame={frame}
                    onCursorHoverValueChanged={props.channelMapStore.setPixelHighlightValue}
                    width={props.renderWidth}
                    height={props.renderHeight}
                    leftOffset={frame.overlayStore.colorbar.position === "right" ? overlayStore.paddingTop : overlayStore.paddingLeft}
                    left={frame.overlayStore.colorbar.position === "right" ? props.renderWidth - overlayStore.paddingRight : 0}
                    top={frame.overlayStore.colorbar.position === "bottom" ? props.renderHeight - colorbarOffset : frame.overlayStore.colorbar.position === "right" ? 0 : overlayStore.paddingTop - colorbarOffset}
                    length={frame.overlayStore.colorbar.position === "right" ? channelMapViewHeight : channelMapViewWidth}
                />
            )}
            <OverlayComponent
                key={`overlay-view-component-outer`}
                image={{
                    type: ImageType.FRAME,
                    store: frame
                }}
                overlaySettings={overlayStore}
                top={0}
                left={0}
                docked={props.docked}
                type={"channel-map-outer"}
                width={props.renderWidth - overlayStore.paddingRight}
                height={props.renderHeight}
                unScaled={true}
            />
        </div>
    ) : (
        <NonIdealState />
    );
});

const ChannelMapInnerOverlayComponent = ({
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
    const imageRenderWidth = Math.floor(channelMapViewWidth / channelMapStore.numColumns);
    const imageRenderHeight = Math.floor(channelMapViewHeight / channelMapStore.numRows);
    let overlayComponentTop = imageRenderHeight * row + overlayStore.paddingTop;
    let overlayComponentLeft = imageRenderWidth * column + overlayStore.paddingLeft;
    let thisIs: "corner" | "left" | "bottom" | "inner";

    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    const setCornerOverlay = () => {
        console.log("setCornerOverlay", overlayComponentRef?.canvas);
        const left = overlayComponentLeft - overlayStore.paddingLeft;

        return (
            <OverlayComponent
                key={`overlay-view-component`}
                ref={ref => {
                    setOverlayComponentRef(ref);
                    if (ref?.canvas) {
                        ref.canvas.id = `${column}_${row}`;
                    }
                }}
                thisIs={"corner"}
                image={{
                    type: ImageType.FRAME,
                    store: channelMapStore.showAuxiliaryFrame && channelMapStore.auxiliaryFrame ? channelMapStore.auxiliaryFrame : frame
                }}
                overlaySettings={overlayStore}
                top={overlayComponentTop}
                left={left}
                docked={docked}
                width={Math.floor(imageRenderWidth) + overlayStore.paddingLeft}
                height={Math.floor(imageRenderHeight) + overlayStore.paddingBottom}
                type={"channel-map-inner"}
                // unScaled={true}
                // channel={channelMapStore.showAuxiliaryFrame ? channelMapStore.auxiliaryFrameChannel : channel}
            />
        );
    };
    const cornerOverlay = setCornerOverlay();
    let width = Math.floor(channelMapViewWidth / channelMapStore.numColumns);
    let height = Math.floor(channelMapViewHeight / channelMapStore.numRows);

    if (column === 0) {
        thisIs = "left";
        width += overlayStore.paddingLeft;
        overlayComponentLeft -= overlayStore.paddingLeft;
    } else if (row === channelMapStore.numRows - 1 || row === lastRow || (row === lastRow - 1 && column > columnOfLastFrame)) {
        thisIs = "bottom";
        height += overlayStore.paddingBottom;
    } else {
        thisIs = "inner";
    }
    const getRef = (ref: HTMLCanvasElement) => {
        if (ref) {
            ref.id = `${column}_${row}`;
            canvasRef.current = ref;
        }
    };

    React.useEffect(() => {
        const disposer = autorun(() => {
            const canvas = canvasRef.current;
            if (canvas && overlayComponentRef?.canvas) {
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    requestAnimationFrame(() => {
                        console.log("canvas", canvas);
                        const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;
                        canvas.width = width * pixelRatio;
                        canvas.height = height * pixelRatio;
                        const destCanvas = canvas.getContext("2d", {willReadFrequently: true});
                        const w = overlayComponentRef.canvas.width;
                        const h = overlayComponentRef.canvas.height;
                        // const destWidth = canvas.width - (thisIs === "left" || thisIs === "corner" ? 0 : paddingLeft);
                        // const destHeight = canvas.height - (thisIs === "bottom" || thisIs === "corner" ? 0 : paddingBottom);
                        // const destWidth = overlayStore.channelMapInnerWidth(canvas.width / pixelRatio, thisIs) * pixelRatio;
                        // const destHeight = overlayStore.channelMapInnerHeight(canvas.height / pixelRatio, thisIs) * pixelRatio;
                        const destWidth = canvas.width;
                        const destHeight = canvas.height;
                        const cornerPaddingLeft = overlayStore.paddingLeft * pixelRatio;
                        const cornerPaddingBottom = overlayStore.paddingBottom * pixelRatio;
                        destCanvas.clearRect(0, 0, canvas.width, canvas.height);
                        if (thisIs === "left") {
                            destCanvas.drawImage(overlayComponentRef.canvas, 0, 0, w, h - cornerPaddingBottom, 0, 0, destWidth, destHeight);
                        } else if (thisIs === "bottom") {
                            destCanvas.drawImage(overlayComponentRef.canvas, cornerPaddingLeft, 0, w - cornerPaddingLeft, h, 0, 0, destWidth, destHeight);
                        } else if (thisIs === "inner") {
                            destCanvas.drawImage(overlayComponentRef.canvas, cornerPaddingLeft, 0, w - cornerPaddingLeft, h - cornerPaddingBottom, 0, 0, destWidth, destHeight);
                        }
                        // if (thisIs === "left") {
                        //     destCanvas.drawImage(overlayComponentRef.canvas, 0, 0, w, h - overlayStore.paddingBottom, 0, 0, destWidth, destHeight);
                        // } else if (thisIs === "bottom") {
                        //     destCanvas.drawImage(overlayComponentRef.canvas, overlayStore.paddingLeft, 0, w - overlayStore.paddingLeft, h, overlayStore.paddingLeft, 0, destWidth, destHeight);
                        // } else if (thisIs === "inner") {
                        //     destCanvas.drawImage(overlayComponentRef.canvas, overlayStore.paddingLeft, 0, w - overlayStore.paddingLeft, h - overlayStore.paddingBottom, overlayStore.paddingLeft, 0, destWidth, destHeight);
                        // }
                    });
                }
            }
        });

        return () => {
            disposer();
        };
    }, [
        overlayComponentRef,
        width,
        height,
        channelMapStore.startChannel,
        channelMapStore.channelRange,
        channelMapStore,
        channelMapStore.masterFrame,
        channelMapStore.numColumns,
        channelMapStore.numRows,
        channelMapStore.masterFrame?.center,
        channelMapStore.masterFrame?.requiredFrameView,
        channelMapStore.masterFrame?.zoomLevel,
        channelMapStore.auxiliaryFrame,
        channelMapStore.auxiliaryFrameChannel,
        channelMapStore.singleChannelContour,
        channelMapStore.singleContourChannel,
        channelMapStore.masterFrame?.spatialReference,
        channelMapStore.masterFrame?.channel
    ]);

    return (
        <>
            {column === 0 && (row === channelMapStore.numRows - 1 || row === lastRow) ? (
                cornerOverlay
            ) : (
                <canvas key={`overlay-view-component-${index}`} id={`${column}_${row}`} style={{position: "absolute", top: overlayComponentTop, left: overlayComponentLeft, width: width, height: height, zIndex: 2}} ref={getRef} />
            )}
        </>
    );
};
