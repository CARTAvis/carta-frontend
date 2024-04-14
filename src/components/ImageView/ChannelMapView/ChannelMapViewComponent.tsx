import * as React from "react";
import _ from "lodash";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {CursorInfo, FrameView, Point2D} from "models";
import {ChannelMapTileService, ChannelMapWebGLService} from "services";
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
    gl: WebGL2RenderingContext;
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
        makeObservable(this);
        ChannelMapStore.staticInstance = this;
        // this.masterFrame = frame;
        this.startChannel = 0;
        this.numColumns = 2;
        this.numRows = 2;
        this.overlayStores = {corner: undefined, left: undefined, bottom: undefined, inner: undefined};
        this.overlayStoreCanvasReference = {corner: undefined, left: undefined, bottom: undefined, inner: undefined};
    }

    @observable masterFrame: FrameStore;
    @observable startChannel: number;
    @observable numColumns: number;
    @observable numRows: number;
    public overlayStores: {corner: OverlayStore; left: OverlayStore; bottom: OverlayStore; inner: OverlayStore};
    public overlayStoreCanvasReference: {corner: any; left: any; bottom: any; inner: any};
    public contourStoreCanvasReference: any;
    public vectorCanvasReference: any;
    public catalogCanvasReference: any;

    @action setOverlayStores(overlayStore: OverlayStore, position: string) {
        if (position === "corner") {
            this.overlayStores.corner = overlayStore;
        } else if (position === "left") {
            this.overlayStores.left = overlayStore;
        } else if (position === "bottom") {
            this.overlayStores.bottom = overlayStore;
        } else {
            this.overlayStores.inner = overlayStore;
        }
    }

    @action updateOverlayStoreSize(width: number, height: number) {
        this.overlayStores?.corner?.setViewDimension(width + this.overlayStores?.corner?.paddingLeft, height + this.overlayStores.corner?.paddingBottom);
        this.overlayStores?.left?.setViewDimension(width + this.overlayStores?.left?.paddingLeft, height);
        this.overlayStores?.bottom?.setViewDimension(width, height + this.overlayStores?.bottom?.paddingBottom);
        this.overlayStores?.inner?.setViewDimension(width, height);
    }

    @action setMasterFrame(masterFrame: FrameStore) {
        this.masterFrame = masterFrame;

        const appStore = AppStore.Instance;
        const frames = appStore.frames.filter(frame => frame.frameInfo.fileId !== masterFrame.frameInfo.fileId);
        frames.forEach(frame => appStore.channelMapTileService.handleFileClosed(frame.frameInfo.fileId));
    }

    @action setStartChannel(startChannel: number) {
        // Add checks for valid startChannel number for the masterFrame
        this.startChannel = startChannel;
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

    @action flipPage(next: boolean = true) {
        // this.channelFrames = [];
        const newStart = next ? this.startChannel + this.numColumns * this.numRows : this.startChannel - this.numColumns * this.numRows;
        // Check new start valid with masterFrame
        if (newStart >= 0) {
            this.setStartChannel(newStart);
        }
    }

    @action setPixelHighlightValue = (val: number) => {
        if (!AppStore.Instance.isExportingImage) {
            this.pixelHighlightValue = val;
        }
    };
    @action requestChannels = () => {
        const frame = this.masterFrame;
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
            appStore.channelMapTileService.requestChannelMapTiles(tiles, frame.frameInfo.fileId, frame.channel, frame.stokes, midPointTileCoords, compressionQuality, {min: this.startChannel, max: this.channelRange});
        }
    };
    throttledRequestChannels = _.throttle(this.requestChannels, 1000);

    public overlayStore(index: number, imageRenderWidth: number, imageRenderHeight: number) {
        const column = index % this.numColumns;
        const row = Math.floor(index / this.numColumns);

        this.updateOverlayStoreSize(imageRenderWidth, imageRenderHeight);

        if (column === 0 && row === this.numRows - 1) {
            this.setOverlayStores(this.overlayStores?.corner || new OverlayStore(imageRenderWidth, imageRenderHeight, 0, 2, false, false, false, false, true), "corner");
            return this.overlayStores.corner;
        } else if (column === 0) {
            this.setOverlayStores(this.overlayStores?.left || new OverlayStore(imageRenderWidth, imageRenderHeight, 0, 2, false, false, true, true, true), "left");
            return this.overlayStores.left;
        } else if (row === this.numRows - 1) {
            this.setOverlayStores(this.overlayStores?.bottom || new OverlayStore(imageRenderWidth, imageRenderHeight, 0, 2, true, true, false, false, true), "bottom");
            return this.overlayStores.bottom;
        } else {
            this.setOverlayStores(this.overlayStores?.inner || new OverlayStore(imageRenderWidth, imageRenderHeight, 0, 2, true, true, true, true, true), "inner");
            return this.overlayStores.inner;
        }
    }

    @computed get numChannels(): number {
        return this.numColumns * this.numRows;
    }

    @computed get channelRange(): number {
        return this.startChannel + this.numChannels - 1;
    }

    @computed get channelArray(): number[] {
        const channelArray = [];
        for (let i = this.startChannel; i < this.startChannel + this.numChannels; i += 1) {
            channelArray.push(i);
        }
        return channelArray;
    }
}

export const ChannelMapViewComponent: React.FC<ChannelMapViewComponentProps> = observer((props: ChannelMapViewComponentProps) => {
    const regionViewRef = React.useRef<RegionViewComponent>();
    const cursorOverlayRef = React.useRef<CursorOverlayComponent>();
    const toolbarRef = React.useRef<ToolbarComponent>();
    const cornerOverlayComponent = React.useRef<HTMLCanvasElement>();
    const leftOverlayComponent = React.useRef<HTMLCanvasElement>();
    const innerOverlayComponent = React.useRef<HTMLCanvasElement>();
    const bottomOverlayComponent = React.useRef<HTMLCanvasElement>();
    const channelMapStore = props.channelMapStore;
    const frame = channelMapStore.masterFrame;
    const colorBarSetting = AppStore.Instance.overlayStore.colorbar;
    const colorbarOffset = 10 + colorBarSetting.totalWidth + (colorBarSetting.position === "bottom" || colorBarSetting.position === "top" ? 10 : 0);
    const cursorInfoOffset = isFinite(cursorOverlayRef.current?.divElement.clientHeight) ? cursorOverlayRef.current?.divElement.clientHeight : 0;
    const toolbarOffset = 34;

    const heightOffset = 10 + (colorBarSetting.position !== "right" ? colorbarOffset : 0) + cursorInfoOffset + toolbarOffset + 40;
    const widthOffset = colorbarOffset + 40; // 40 is for the number and label width of the ast grid
    const fullRenderWidth = props.renderWidth - widthOffset;
    const fullRenderHeight = props.renderHeight - heightOffset;
    const imageRenderWidth = fullRenderWidth / channelMapStore.numColumns;
    const imageRenderHeight = fullRenderHeight / channelMapStore.numRows;

    frame?.overlayStore?.setChannelMapRenderWidth(imageRenderWidth);
    frame?.overlayStore?.setChannelMapRenderHeight(imageRenderHeight);

    React.useEffect(() => {
        if (channelMapStore.masterFrame) {
            channelMapStore.throttledRequestChannels();
        }
    }, [
        channelMapStore.masterFrame,
        channelMapStore.startChannel,
        channelMapStore.numColumns,
        channelMapStore.numRows,
        channelMapStore.masterFrame?.center,
        channelMapStore.masterFrame?.requiredFrameView,
        channelMapStore.masterFrame?.zoomLevel
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

    return frame ? (
        <>
            <div style={{top: cursorInfoOffset + (frame.overlayStore.colorbar.position === "top" ? colorbarOffset : 0), left: 40, position: "absolute"}}>
                {channelMapStore.channelArray.map((channel, index) => {
                    const appStore = AppStore.Instance;
                    const column = index % channelMapStore.numColumns;
                    const row = Math.floor(index / channelMapStore.numColumns);
                    let overlayComponentTop = imageRenderHeight * row;
                    let overlayComponentLeft = imageRenderWidth * column;

                    const overlayStore = channelMapStore.overlayStore(index, imageRenderWidth, imageRenderHeight);
                    let overlayCanvasRef;
                    let thisIs;
                    let contourCanvasRef;
                    let vectorCanvasRef;
                    let catalogCanvasRef;

                    if (!(row === 0 && column === 0)) {
                        contourCanvasRef = channelMapStore.contourStoreCanvasReference?.canvas;
                        vectorCanvasRef = channelMapStore.vectorCanvasReference?.canvas;
                        catalogCanvasRef = channelMapStore.catalogCanvasReference?.canvas;
                    }

                    if (column === 0 && row === channelMapStore.numRows - 1) {
                        overlayComponentLeft -= overlayStore.paddingLeft;
                        if (!cornerOverlayComponent.current) cornerOverlayComponent.current = channelMapStore.overlayStoreCanvasReference.corner;
                        overlayCanvasRef = channelMapStore.overlayStoreCanvasReference.corner;
                        thisIs = "corner";
                    } else if (column === 0) {
                        overlayComponentLeft -= overlayStore.paddingLeft;
                        thisIs = "left";
                        if (!leftOverlayComponent.current) leftOverlayComponent.current = channelMapStore.overlayStoreCanvasReference.left;
                        overlayCanvasRef = channelMapStore.overlayStoreCanvasReference.left;
                    } else if (row === channelMapStore.numRows - 1) {
                        thisIs = "bottom";
                        if (!bottomOverlayComponent.current) {
                            bottomOverlayComponent.current = channelMapStore.overlayStoreCanvasReference.bottom;
                        }
                        overlayCanvasRef = channelMapStore.overlayStoreCanvasReference.bottom;
                    } else {
                        thisIs = "inner";
                        if (!innerOverlayComponent.current) innerOverlayComponent.current = channelMapStore.overlayStoreCanvasReference.inner;
                        overlayCanvasRef = channelMapStore.overlayStoreCanvasReference.inner;
                    }

                    return (
                        <>
                            <RasterViewComponent
                                key={`raster-view-component-${frame.frameInfo.fileId}-${channel}`}
                                frame={frame}
                                webGLService={ChannelMapWebGLService.Instance}
                                tileService={ChannelMapTileService.Instance}
                                overlayStore={overlayStore}
                                renderWidth={overlayStore.fullViewWidth}
                                renderHeight={overlayStore.fullViewHeight}
                                top={overlayComponentTop}
                                left={overlayComponentLeft}
                                docked={props.docked}
                                pixelHighlightValue={props.channelMapStore.pixelHighlightValue}
                                numImageColumns={1}
                                numImageRows={1}
                                row={0}
                                column={0}
                                tileBasedRender={true}
                                channel={channel}
                            />
                            <ContourViewComponent
                                overlayStore={overlayStore}
                                ref={ref => {
                                    if (row === 0 && column === 0) channelMapStore.contourStoreCanvasReference = ref;
                                }}
                                frame={frame}
                                docked={props.docked}
                                row={row}
                                column={column}
                                top={overlayComponentTop}
                                left={overlayComponentLeft}
                                refCanvas={contourCanvasRef}
                            />
                            <VectorOverlayViewComponent
                                ref={ref => {
                                    if (row === 0 && column === 0) channelMapStore.vectorCanvasReference = ref;
                                }}
                                overlayStore={overlayStore}
                                frame={frame}
                                docked={props.docked}
                                row={row}
                                column={column}
                                top={overlayComponentTop}
                                left={overlayComponentLeft}
                                refCanvas={vectorCanvasRef}
                            />
                            <OverlayComponent
                                ref={ref => {
                                    if ((column === 0 && row === 0) || (column === 0 && row === channelMapStore.numRows - 1) || (column === 1 && row === 0) || (column === 1 && row === channelMapStore.numRows - 1)) {
                                        channelMapStore.overlayStoreCanvasReference[thisIs] = ref;
                                        if (ref?.canvas) ref.canvas.id = `${column}_${row}`;
                                    }
                                }}
                                frame={frame}
                                width={channelMapStore.overlayStores?.inner?.fullViewWidth}
                                height={channelMapStore.overlayStores?.inner?.fullViewHeight}
                                overlaySettings={overlayStore}
                                top={overlayComponentTop}
                                left={overlayComponentLeft}
                                docked={props.docked}
                                column={column}
                                row={row}
                                refCanvas={
                                    (column === 0 && row === 0) || (column === 0 && row === channelMapStore.numRows - 1) || (column === 1 && row === 0) || (column === 1 && row === channelMapStore.numRows - 1)
                                        ? undefined
                                        : overlayCanvasRef?.canvas
                                }
                            />
                            <CatalogViewGLComponent
                                ref={ref => {
                                    if (row === 0 && column === 0) channelMapStore.catalogCanvasReference = ref;
                                }}
                                frame={frame}
                                docked={props.docked}
                                top={overlayComponentTop}
                                left={overlayComponentLeft}
                                refCanvas={catalogCanvasRef}
                                overlayStore={overlayStore}
                            />
                            <RegionViewComponent
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
                        </>
                    );
                })}
                <BeamProfileOverlayComponent frame={frame} top={imageRenderHeight * (channelMapStore.numRows - 1)} left={0} docked={props.docked} padding={10} />
            </div>
            {frame.overlayStore.colorbar.visible && (
                <ColorbarComponent
                    frame={frame}
                    onCursorHoverValueChanged={props.channelMapStore.setPixelHighlightValue}
                    width={fullRenderWidth + 40}
                    height={fullRenderHeight + 40}
                    top={frame.overlayStore.colorbar.position === "bottom" ? cursorInfoOffset + fullRenderHeight + 40 : cursorInfoOffset}
                    length={frame.overlayStore.colorbar.position === "right" ? fullRenderHeight : fullRenderWidth}
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
                right={frame?.overlayStore.padding.right}
                docked={props.docked}
                unit={frame.requiredUnit}
                top={0}
                currentStokes={AppStore.Instance.activeFrame?.requiredPolarizationInfo}
                cursorValueToPercentage={frame.requiredUnit === "%"}
                isPreview={frame.isPreview}
            />
        </>
    ) : (
        <div>Testing</div>
    );
});
