import * as React from "react";
import {NonIdealState} from "@blueprintjs/core";
import _ from "lodash";
import {action, computed, makeObservable, observable, reaction} from "mobx";
import {observer} from "mobx-react";

import {CursorInfo, FrameView, ImageType, Point2D} from "models";
import {TileService, TileWebGLService} from "services";
import {AppStore, OverlayStore} from "stores";
import {FrameStore} from "stores/Frame";
import {GetRequiredTiles} from "utilities";

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

export class ChannelMapStore {
    private static staticInstance: ChannelMapStore;
    @observable pixelHighlightValue: number = NaN;

    static get Instance() {
        if (!ChannelMapStore.staticInstance) {
            ChannelMapStore.staticInstance = new ChannelMapStore();
        }
        return ChannelMapStore.staticInstance;
    }

    // constructor(frame: FrameStore, numColumns: number = 3, numRows: number = 2) {
    constructor() {
        const overlayStore = AppStore.Instance.overlayStore;
        makeObservable(this);
        ChannelMapStore.staticInstance = this;
        this.startChannel = 0;
        this.numColumns = 2;
        this.numRows = 2;
        this.overlayStores = {corner: undefined, outer: new OverlayStore(0, 0, 0, 0, false, false, true, undefined, undefined, undefined, undefined, undefined, undefined, overlayStore.labels, undefined, undefined, undefined)};
    }

    @observable masterFrame: FrameStore;
    @observable _auxiliaryFrame: FrameStore;
    @observable auxiliaryFrameChannel: number = 0;
    @observable startChannel: number = 0;
    @observable numColumns: number;
    @observable numRows: number;
    @observable showAuxiliaryFrame: boolean = false;
    @observable singleChannelContour: boolean = true;
    @observable singleContourChannel: number = 0;
    @observable overlayStores: {corner: OverlayStore; outer: OverlayStore};

    @action setOverlayStores(overlayStore: OverlayStore) {
        this.overlayStores.corner = overlayStore;
    }

    @action updateOverlayStoreSize(width: number, height: number) {
        this.overlayStores?.corner?.setViewDimension(width + this.overlayStores?.corner?.paddingLeft, height + this.overlayStores.corner?.paddingBottom);
    }

    @action setMasterFrame(masterFrame: FrameStore) {
        this.masterFrame = masterFrame;

        const appStore = AppStore.Instance;
        const frames = appStore.frames.filter(frame => frame.frameInfo.fileId !== masterFrame.frameInfo.fileId);
        frames.forEach(frame => appStore.tileService.handleFileClosed(frame.frameInfo.fileId));
    }

    @action setAuxiliaryFrame(frame: FrameStore) {
        this._auxiliaryFrame = frame;
    }

    @action setStartChannel(startChannel: number) {
        // Add checks for valid startChannel number for the masterFrame
        if (startChannel < 0 || startChannel > this.masterFrame.frameInfo.fileInfoExtended.depth) {
            return;
        }
        this.startChannel = startChannel;
    }

    @action setPrevChannel() {
        this.setStartChannel(this.startChannel - 1);
    }

    @action setNextChannel() {
        this.setStartChannel(this.startChannel + 1);
    }

    @action setPrevPage() {
        const newStart = this.startChannel - this.numColumns * this.numRows;

        if (newStart >= 0) {
            this.setStartChannel(newStart);
        }
    }

    @action setNextPage() {
        const newStart = this.startChannel + this.numColumns * this.numRows;

        if (newStart >= 0) {
            this.setStartChannel(newStart);
        }
    }

    @action setAuxiliaryFrameChannel(channel: number) {
        this.auxiliaryFrameChannel = channel;
    }

    @action setNumColumns(numColumns: number) {
        if (isFinite(numColumns) && numColumns > 0) {
            this.numColumns = numColumns;
        }
    }

    @action setNumRows(numRows: number) {
        if (isFinite(numRows) && numRows > 0) {
            this.numRows = numRows;
        }
    }

    @action setPixelHighlightValue = (val: number) => {
        if (!AppStore.Instance.isExportingImage) {
            this.pixelHighlightValue = val;
        }
    };

    @action setShowAuxiliaryFrame = (show: boolean) => {
        this.showAuxiliaryFrame = show;
    };

    @action setSingleChannelContour = (singleChannel: boolean) => {
        this.singleChannelContour = singleChannel;
    };

    @action setSingleContourChannel = (channel: number) => {
        this.singleContourChannel = channel;
    };

    @action requestChannels = (channelRange?: {min: number; max: number}) => {
        const frame = this.showAuxiliaryFrame ? this.auxiliaryFrame || this.masterFrame : this.masterFrame;
        const requiredChannel = this.showAuxiliaryFrame ? this.auxiliaryFrameChannel : frame.channel;
        if (!frame) {
            return;
        }

        if (true) {
            // if channel map is active
            // Calculate new required frame view (cropped to file size)
            const reqView = frame.requiredFrameView;
            const croppedReq: FrameView = {
                xMin: Math.max(0, reqView.xMin),
                xMax: Math.min(frame.frameInfo.fileInfoExtended.width, reqView.xMax),
                yMin: Math.max(0, reqView.yMin),
                yMax: Math.min(frame.frameInfo.fileInfoExtended.height, reqView.yMax),
                mip: reqView.mip
            };
            const appStore = AppStore.Instance;
            const imageSize: Point2D = {x: frame.frameInfo.fileInfoExtended.width, y: frame.frameInfo.fileInfoExtended.height};
            const tiles = GetRequiredTiles(croppedReq, imageSize, {x: 256, y: 256});
            const midPointImageCoords = {x: (reqView.xMax + reqView.xMin) / 2.0, y: (reqView.yMin + reqView.yMax) / 2.0};
            // TODO: dynamic tile size
            const tileSizeFullRes = reqView.mip * 256;
            const midPointTileCoords = {x: midPointImageCoords.x / tileSizeFullRes - 0.5, y: midPointImageCoords.y / tileSizeFullRes - 0.5};
            // If BUNIT = km/s, adopted compressionQuality is set to 32 regardless the preferences setup
            const bunitVariant = ["km/s", "km s-1", "km s^-1", "km.s-1"];
            const compressionQuality = bunitVariant.includes(frame.headerUnit) ? Math.max(appStore.preferenceStore.imageCompressionQuality, 32) : appStore.preferenceStore.imageCompressionQuality;
            appStore.tileService.requestChannelMapTiles(tiles, frame.frameInfo.fileId, requiredChannel, frame.stokes, midPointTileCoords, compressionQuality, channelRange || {min: this.startChannel, max: this.channelRange});
        }
    };

    @action throttledRequestChannels = _.debounce(this.requestChannels, 100);

    public overlayStore(imageRenderWidth?: number, imageRenderHeight?: number) {
        const overlay = AppStore.Instance.overlayStore;
        if (imageRenderWidth && imageRenderHeight) {
            this.updateOverlayStoreSize(imageRenderWidth, imageRenderHeight);
        }

        this.setOverlayStores(
            this.overlayStores?.corner ||
                new OverlayStore(
                    imageRenderWidth,
                    imageRenderHeight,
                    1,
                    2,
                    true,
                    false,
                    true,
                    overlay.global,
                    overlay.title,
                    overlay.grid,
                    overlay.border,
                    overlay.axes,
                    overlay.numbers,
                    undefined,
                    overlay.ticks,
                    overlay.colorbar,
                    overlay.beam
                )
        );
        return this.overlayStores.corner;
    }

    @computed get numChannels(): number {
        return this.numColumns * this.numRows;
    }

    @computed get channelRange(): number {
        return Math.min(this.startChannel + this.numChannels - 1, this.masterFrame?.frameInfo?.fileInfoExtended?.depth - 1);
    }

    @computed get channelArray(): number[] {
        const channelArray = [];
        for (let i = this.startChannel; i < this.startChannel + this.numChannels; i += 1) {
            if (i > this.masterFrame.frameInfo.fileInfoExtended.depth - 1) {
                break;
            }
            channelArray.push(i);
        }
        return channelArray;
    }

    @computed get auxiliaryFrame(): FrameStore {
        if (!this._auxiliaryFrame && this.masterFrame?.spatialSiblings[0]) {
            return this.masterFrame?.spatialSiblings[0];
        } else {
            return this._auxiliaryFrame;
        }
    }
}

export const ChannelMapViewComponent: React.FC<ChannelMapViewComponentProps> = observer((props: ChannelMapViewComponentProps) => {
    const regionViewRef = React.useRef<RegionViewComponent>();
    const cursorOverlayRef = React.useRef<CursorOverlayComponent>();
    const toolbarRef = React.useRef<ToolbarComponent>();
    const channelMapStore = props.channelMapStore;
    const frame = channelMapStore.masterFrame;
    const colorBarSetting = AppStore.Instance.overlayStore.colorbar;
    const titleSetting = channelMapStore.overlayStores?.outer?.title;
    const titleOffset = titleSetting?.visible ? titleSetting?.fontSize : 0;
    const colorbarOffset = colorBarSetting.stageWidth;
    const cursorInfoOffset = isFinite(cursorOverlayRef.current?.divElement.clientHeight) ? cursorOverlayRef.current?.divElement.clientHeight : 0;
    const toolbarOffset = 30 + 10 + 10; // overlayPadding bottom + height of button + 10 for aesthetic

    const [overlayComponentRef, setOverlayComponentRef] = React.useState<OverlayComponent>();
    const [contourCanvasRef, setContourCanvasRef] = React.useState<ContourViewComponent>();
    const [vectorOverlayViewComponentRef, setVectorOverlayViewComponentRef] = React.useState<VectorOverlayViewComponent>();
    const [catalogViewGLComponentRef, setCatalogViewGLComponentRef] = React.useState<CatalogViewGLComponent>();

    const heightOffset = (colorBarSetting.position === "right" ? 0 : colorbarOffset) + cursorInfoOffset + toolbarOffset + titleOffset;
    const widthOffset = colorBarSetting.position === "right" ? colorbarOffset : 5; // 40 is for the number and label width of the ast grid
    const channelMapViewWidth = props.renderWidth - widthOffset;
    const channelMapViewHeight = props.renderHeight - heightOffset;

    // The channel map has one overlayComponent for each of the channel display, but the title and labels are achieved with an outer overlay. The border and ticks of the outer overlay is set to invisible.
    // Therefore the numberOffset is the number of the inner overlays and the label offset is corresponding to the outer overlay.
    const numberOffset = channelMapStore.overlayStores?.corner?.numberWidth || 0;
    const labelOffset = channelMapStore.overlayStores?.outer?.labelWidth || 0;
    const outerOffset = numberOffset + labelOffset;
    const imageRenderWidth = (channelMapViewWidth - outerOffset) / channelMapStore.numColumns;
    const imageRenderHeight = (channelMapViewHeight - outerOffset) / channelMapStore.numRows;

    const overlayStore = channelMapStore.overlayStore(Math.floor(imageRenderWidth), Math.floor(imageRenderHeight));
    channelMapStore.overlayStores.outer.setViewDimension(Math.floor(channelMapViewWidth), Math.floor(props.renderHeight - toolbarOffset - cursorInfoOffset + (colorBarSetting.position === "right" ? 0 : colorbarOffset)));
    channelMapStore.overlayStores.outer.setIsChannelMap(false);
    // channelMapStore.overlayStores.outer.labels.setVisible(true);
    // channelMapStore.overlayStores.outer.labels.setHidden(false);
    channelMapStore.overlayStores.outer.numbers.setVisible(false);
    channelMapStore.overlayStores.outer.border.setVisible(false);
    channelMapStore.overlayStores.outer.ticks.setLength(0);
    channelMapStore.overlayStores.outer.ticks.setMajorLength(0);

    // React.useEffect(() => {
    //     const disposer = autorun(() => {
    //         if (channelMapStore.masterFrame) {
    //             channelMapStore.throttledRequestChannels();
    //         }
    //     });

    //     return () => {
    //         disposer();
    //     };
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [
    //     channelMapStore,
    //     channelMapStore.masterFrame,
    //     channelMapStore.numColumns,
    //     channelMapStore.numRows,
    //     channelMapStore.masterFrame?.center,
    //     channelMapStore.masterFrame?.requiredFrameView,
    //     channelMapStore.masterFrame?.zoomLevel,
    //     channelMapStore.auxiliaryFrame,
    //     channelMapStore.auxiliaryFrameChannel,
    //     channelMapStore.singleChannelContour,
    //     channelMapStore.singleContourChannel,
    //     channelMapStore.masterFrame?.spatialReference
    // ]);

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
                let channelRange;
                if (prevEndChannel < startChannel || endChannel < prevStartChannel) {
                    channelRange = {min: startChannel, max: endChannel};
                } else if (prevEndChannel < endChannel) {
                    channelRange = {min: (prevEndChannel as number) + 1, max: endChannel};
                } else if (startChannel < prevStartChannel) {
                    channelRange = {min: startChannel, max: (prevStartChannel as number) - 1};
                } else {
                    channelRange = {min: channelMapStore.startChannel as number, max: channelMapStore.channelRange};
                }
                if (channelMapStore.masterFrame) {
                    channelMapStore.throttledRequestChannels(channelRange);
                }
            }
        );
        // const disposer = autorun(() => {
        //     const stat = [
        //         channelMapStore.startChannel,
        //         channelMapStore.channelRange,
        //         channelMapStore,
        //         channelMapStore.masterFrame,
        //         channelMapStore.numColumns,
        //         channelMapStore.numRows,
        //         channelMapStore.masterFrame?.center,
        //         channelMapStore.masterFrame?.requiredFrameView,
        //         channelMapStore.masterFrame?.zoomLevel,
        //         channelMapStore.auxiliaryFrame,
        //         channelMapStore.auxiliaryFrameChannel,
        //         channelMapStore.singleChannelContour,
        //         channelMapStore.singleContourChannel,
        //         channelMapStore.masterFrame?.spatialReference]
        //     if (channelMapStore.masterFrame) {
        //         channelMapStore.throttledRequestChannels();
        //     }
        // })

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
                                />
                            </div>
                        )
                    );
                })}
                <BeamProfileOverlayComponent frame={frame} top={imageRenderHeight * (channelMapStore.numRows - 1)} left={0} docked={props.docked} padding={10} />
                {channelMapStore.showAuxiliaryFrame && channelMapStore.auxiliaryFrame ? (
                    <RasterViewComponent
                        key={`raster-view-component`}
                        image={{
                            type: ImageType.FRAME,
                            store: channelMapStore.auxiliaryFrame
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
                        channel={channelMapStore.channelArray.map(channel => channelMapStore.auxiliaryFrameChannel)}
                    />
                ) : (
                    <RasterViewComponent
                        key={`raster-view-component-channel-map`}
                        image={{
                            type: ImageType.FRAME,
                            store: frame
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
                        channel={channelMapStore.channelArray}
                    />
                )}
            </div>
            {frame.overlayStore.colorbar.visible && (
                <ColorbarComponent
                    frame={frame}
                    onCursorHoverValueChanged={props.channelMapStore.setPixelHighlightValue}
                    width={channelMapViewWidth}
                    height={channelMapViewHeight}
                    top={frame.overlayStore.colorbar.position === "bottom" ? cursorInfoOffset + channelMapViewHeight + titleOffset : cursorInfoOffset}
                    length={frame.overlayStore.colorbar.position === "right" ? channelMapViewHeight - outerOffset : channelMapViewWidth - outerOffset - 20}
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
                overlaySettings={channelMapStore.overlayStores.outer}
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
