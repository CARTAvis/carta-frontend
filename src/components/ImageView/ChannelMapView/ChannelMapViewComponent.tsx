import * as React from "react";
import {NonIdealState} from "@blueprintjs/core";
import {reaction} from "mobx";
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
    const toolbarRef = React.useRef<ToolbarComponent>();
    const channelMapStore = props.channelMapStore;
    const frame = channelMapStore.masterFrame;
    const outerOverlay = channelMapStore.overlayStores.outer;
    const colorBarSetting = AppStore.Instance.overlayStore.colorbar;
    const titleSetting = outerOverlay?.title;
    const titleOffset = titleSetting?.visible ? titleSetting?.fontSize : 0;
    const colorbarOffset = frame?.overlayStore.colorbar.visible ? colorBarSetting.stageWidth : 0;
    const cursorInfoOffset = isFinite(cursorOverlayRef.current?.divElement.clientHeight) ? cursorOverlayRef.current?.divElement.clientHeight : 0;
    const toolbarOffset = 30 + 10 + 10; // overlayPadding bottom + height of button + 10 for aesthetic

    const [overlayComponentRef, setOverlayComponentRef] = React.useState<OverlayComponent>();
    const [contourCanvasRef, setContourCanvasRef] = React.useState<ContourViewComponent>();
    const [vectorOverlayViewComponentRef, setVectorOverlayViewComponentRef] = React.useState<VectorOverlayViewComponent>();
    const [catalogViewGLComponentRef, setCatalogViewGLComponentRef] = React.useState<CatalogViewGLComponent>();

    const heightOffset = (colorBarSetting.position === "right" ? 0 : colorbarOffset) + cursorInfoOffset + toolbarOffset + titleOffset;
    const widthOffset = (colorBarSetting.position === "right" ? colorbarOffset : 0) + 5;
    const channelMapViewWidth = props.renderWidth - widthOffset;
    const channelMapViewHeight = props.renderHeight - heightOffset;

    // The channel map has one overlayComponent for each of the channel display, but the title and labels are achieved with an outer overlay. The border and ticks of the outer overlay is set to invisible.
    // Therefore the numberOffset is the number of the inner overlays and the label offset is corresponding to the outer overlay.
    const numberOffset = channelMapStore.overlayStores?.corner?.numberWidth || 0;
    const labelOffset = outerOverlay?.labelWidth || 0;
    const outerOffset = numberOffset + labelOffset;
    const imageRenderWidth = (channelMapViewWidth - outerOffset) / channelMapStore.numColumns;
    const imageRenderHeight = (channelMapViewHeight - outerOffset) / channelMapStore.numRows;

    const overlayStore = channelMapStore.overlayStore(Math.floor(imageRenderWidth), Math.floor(imageRenderHeight));
    const overlayWidth = Math.floor(channelMapViewWidth);
    const overlayHeight = Math.floor(props.renderHeight - toolbarOffset - cursorInfoOffset - (colorBarSetting.position === "bottom" ? colorbarOffset : 0));
    if (outerOverlay && isFinite(overlayWidth) && isFinite(overlayHeight)) {
        outerOverlay.setViewDimension(overlayWidth, overlayHeight);
        outerOverlay.numbers.setVisible(false);
        outerOverlay.border.setVisible(false);
        outerOverlay.ticks.setLength(0);
        outerOverlay.ticks.setMajorLength(0);
    }

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
        channelMapStore.masterFrame?.spatialReference
    ]);

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

    const setCornerOverlay = () => {
        const row = channelMapStore.numRows - 1;
        const lastRow = Math.floor((channelMapStore.channelArray.length - 1) / channelMapStore.numColumns);
        const column = 0;
        const channel = row * channelMapStore.numColumns + channelMapStore.startChannel;
        const overlayComponentTop = imageRenderHeight * lastRow;
        const overlayComponentLeft = imageRenderWidth * column - overlayStore.paddingLeft;

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
                left={overlayComponentLeft}
                docked={props.docked}
                channel={channelMapStore.showAuxiliaryFrame ? channelMapStore.auxiliaryFrameChannel : channel}
            />
        );
    };

    return frame ? (
        <>
            <div style={{top: titleOffset + cursorInfoOffset + (frame.overlayStore.colorbar.position === "top" ? colorbarOffset : 0), left: outerOffset, position: "absolute"}}>
                {channelMapStore.channelArray.map((channel, index) => {
                    const appStore = AppStore.Instance;
                    const column = index % channelMapStore.numColumns;
                    const row = Math.floor(index / channelMapStore.numColumns);
                    const lastRow = Math.floor((channelMapStore.channelArray.length - 1) / channelMapStore.numColumns);
                    const columnOfLastFrame = channelMapStore.channelArray.length - lastRow * channelMapStore.numColumns - 1;
                    let overlayComponentTop = imageRenderHeight * row;
                    let overlayComponentLeft = imageRenderWidth * column;
                    overlayComponentLeft -= overlayStore.paddingLeft;

                    let thisIs;

                    if (column === 0 && (row === channelMapStore.numRows - 1 || row === lastRow)) {
                        thisIs = "corner";
                    } else if (column === 0) {
                        thisIs = "left";
                    } else if (row === channelMapStore.numRows - 1 || row === lastRow || (row === lastRow - 1 && column > columnOfLastFrame)) {
                        thisIs = "bottom";
                    } else {
                        thisIs = "inner";
                    }

                    const cornerOverlay = setCornerOverlay();

                    return (
                        channel < channelMapStore.masterFrame?.frameInfo.fileInfoExtended.depth && (
                            <div key={index}>
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
                                {column === 0 && (row === channelMapStore.numRows - 1 || row === lastRow) ? (
                                    cornerOverlay
                                ) : (
                                    <OverlayComponent
                                        key={`overlay-view-component-${index}`}
                                        thisIs={thisIs}
                                        image={{
                                            type: ImageType.FRAME,
                                            store: channelMapStore.showAuxiliaryFrame && channelMapStore.auxiliaryFrame ? channelMapStore.auxiliaryFrame : frame
                                        }}
                                        overlaySettings={overlayStore}
                                        top={overlayComponentTop}
                                        left={overlayComponentLeft}
                                        docked={props.docked}
                                        channel={channelMapStore.showAuxiliaryFrame ? channelMapStore.auxiliaryFrameChannel : channel}
                                        refCanvas={column === 0 && (row === channelMapStore.numRows - 1 || row === lastRow) ? undefined : overlayComponentRef?.canvas}
                                    />
                                )}
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
                                    width={overlayStore.renderWidth}
                                    height={overlayStore.renderHeight}
                                    top={overlayComponentTop + overlayStore.paddingTop}
                                    left={overlayComponentLeft + overlayStore.paddingLeft}
                                    onClickToCenter={cursorInfo => onClickToCenter(frame, cursorInfo)}
                                    overlaySettings={overlayStore}
                                    dragPanningEnabled={appStore.preferenceStore.dragPanning}
                                    docked={props.docked}
                                    highlighted={channel === channelMapStore.masterFrame.requiredChannel}
                                />
                            </div>
                        )
                    );
                })}
                <BeamProfileOverlayComponent frame={frame} top={imageRenderHeight * (channelMapStore.numRows - 1)} left={0} docked={props.docked} padding={10} />
                <RasterViewComponent
                    key={`raster-view-component-${channelMapStore.showAuxiliaryFrame && channelMapStore.auxiliaryFrame ? "auxiliary" : "channel-map"}`}
                    image={{
                        type: ImageType.FRAME,
                        store: channelMapStore.showAuxiliaryFrame && channelMapStore.auxiliaryFrame ? channelMapStore.auxiliaryFrame : frame
                    }}
                    webGLService={TileWebGLService.Instance}
                    tileService={TileService.Instance}
                    overlayStore={overlayStore}
                    docked={props.docked}
                    pixelHighlightValue={props.channelMapStore.pixelHighlightValue}
                    renderWidth={channelMapViewWidth - outerOffset}
                    renderHeight={channelMapViewHeight - outerOffset}
                    row={0}
                    column={0}
                    left={0}
                    tileBasedRender={true}
                    channel={channelMapStore.showAuxiliaryFrame && channelMapStore.auxiliaryFrame ? channelMapStore.channelArray.map(channel => channelMapStore.auxiliaryFrameChannel) : channelMapStore.channelArray}
                />
            </div>
            {frame.overlayStore.colorbar.visible && (
                <ColorbarComponent
                    frame={frame}
                    onCursorHoverValueChanged={props.channelMapStore.setPixelHighlightValue}
                    width={props.renderWidth}
                    height={props.renderHeight}
                    leftOffset={frame.overlayStore.colorbar.position === "right" ? 0 : outerOffset}
                    left={frame.overlayStore.colorbar.position === "right" ? channelMapViewWidth : 0}
                    top={frame.overlayStore.colorbar.position === "bottom" ? cursorInfoOffset + channelMapViewHeight + titleOffset : cursorInfoOffset + titleOffset}
                    length={frame.overlayStore.colorbar.position === "right" ? channelMapViewHeight - outerOffset : channelMapViewWidth - outerOffset}
                />
            )}
            <ToolbarComponent
                ref={ref => (toolbarRef.current = ref)}
                docked={props.docked}
                visible={true}
                frame={frame}
                activeLayer={AppStore.Instance.activeLayer}
                onActiveLayerChange={AppStore.Instance.updateActiveLayer}
                onRegionViewZoom={zoom => onRegionViewZoom(frame, zoom)}
                onZoomToFit={() => fitZoomFrameAndRegion(frame)}
                bottom={10}
                right={0}
            />
            <CursorOverlayComponent
                ref={ref => (cursorOverlayRef.current = ref)}
                cursorInfo={frame.cursorInfo}
                cursorValue={frame.cursorInfo.isInsideImage ? frame.cursorValue.value : undefined}
                isValueCurrent={frame.isCursorValueCurrent}
                spectralInfo={frame.spectralInfo}
                width={frame?.overlayStore.renderWidth}
                left={0}
                right={0}
                docked={props.docked}
                unit={frame.requiredUnit}
                top={0}
                currentStokes={AppStore.Instance.activeFrame?.requiredPolarizationInfo}
                cursorValueToPercentage={frame.requiredUnit === "%"}
                isPreview={frame.isPreview}
            />
            <OverlayComponent
                key={`overlay-view-component-outer`}
                image={{
                    type: ImageType.FRAME,
                    store: frame
                }}
                overlaySettings={outerOverlay}
                top={cursorOverlayRef.current?.divElement.clientHeight}
                left={0}
                docked={props.docked}
                unScaled={true}
            />
        </>
    ) : (
        <NonIdealState />
    );
});
