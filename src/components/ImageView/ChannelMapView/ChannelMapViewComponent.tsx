// This is a component that uses rasterViewComponent to construct something on the same level as imagePanel component
import * as React from "react";
// import { ImageViewLayer } from "../ImageViewComponent";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {CursorInfo, FrameView, Point2D} from "models";
import {AppStore, OverlayStore} from "stores";
import {FrameStore} from "stores/Frame";
import {GetRequiredTiles} from "utilities";

import {ColorbarComponent} from "../Colorbar/ColorbarComponent";
// import { CARTA } from "carta-protobuf";
import {CursorOverlayComponent} from "../CursorOverlay/CursorOverlayComponent";
import {OverlayComponent} from "../Overlay/OverlayComponent";
import {RasterViewComponent} from "../RasterView/RasterViewComponent";
import {RegionViewComponent} from "../RegionView/RegionViewComponent";
import {ToolbarComponent} from "../Toolbar/ToolbarComponent";
import { ContourViewComponent } from "../ContourView/ContourViewComponent";
import { ChannelMapWebGLService, TileService } from "services";
import _ from "lodash";

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
    }
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
            // testing using arbitrary channel range
            // console.log("requesting channel range", {min: this.startChannel, max: this.channelRange});
            appStore.tileService.requestChannelMapTiles(tiles, frame.frameInfo.fileId, frame.channel, frame.stokes, midPointTileCoords, compressionQuality, {min: this.startChannel, max: this.channelRange});
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
    const canvasRef = React.useRef<HTMLCanvasElement>();
    // For some reason, the channelMapStore.channelFrames observable is not triggering rerender, the following is a temporary solution.
    // const [channelFrames, setChannelFrames] = React.useState<FrameStore[]>([]);
    // const channelMapStore = new ChannelMapStore(props.frame, props.numImageColumn, props.numImageRow);
    const channelMapStore = props.channelMapStore;
    // const channelFrames = observable(channelMapStore.channelFrames);
    // let channelFrames: FrameStore[] = observable([]);
    // const [rerenderTrigger, setRerenderTrigger] = React.useState<boolean>(true);
    const frame = channelMapStore.masterFrame;
    // const channelFrames = []
    // for (let i = 0; i < channelMapStore.numChannels; i++) {
    //     channelFrames.push(i + channelMapStore.startChannel);
    // }
    const colorBarSetting = AppStore.Instance.overlayStore.colorbar;
    const colorbarOffset = 10 + colorBarSetting.totalWidth + (colorBarSetting.position === "bottom" || colorBarSetting.position === "top" ? 10 : 0);
    const cursorInfoOffset = isFinite(cursorOverlayRef.current?.divElement.clientHeight) ? cursorOverlayRef.current?.divElement.clientHeight : 0;
    const toolbarOffset = 34;

    const heightOffset = 10+ (colorBarSetting.position !== "right" ? colorbarOffset : 0) + cursorInfoOffset + toolbarOffset + 40;
    const widthOffset = colorbarOffset + 40; // 40 is for the number and label width of the ast grid
    const fullRenderWidth = props.renderWidth - widthOffset;
    const fullRenderHeight = props.renderHeight - heightOffset;
    const imageRenderWidth =  fullRenderWidth / channelMapStore.numColumns;
    const imageRenderHeight = fullRenderHeight / channelMapStore.numRows;

    frame?.overlayStore?.setChannelMapRenderWidth(imageRenderWidth);
    frame?.overlayStore?.setChannelMapRenderHeight(imageRenderHeight);

//     const cornerOverlayComponent = React.useMemo(() => <OverlayComponent
//     frame={frame}
//     width={channelMapStore.overlayStores?.corner?.fullViewWidth}
//     height={channelMapStore.overlayStores?.corner?.fullViewHeight}
//     overlaySettings={channelMapStore.overlayStores?.corner}
//     docked={props.docked}
// />, []);
//     const leftOverlayComponent = React.useMemo(() => <OverlayComponent
//     frame={frame}
//     width={channelMapStore.overlayStores?.left?.fullViewWidth}
//     height={channelMapStore.overlayStores?.left?.fullViewHeight}
//     overlaySettings={channelMapStore.overlayStores?.left}
//     docked={props.docked}
// />, []);
//     const bottomOverlayComponent = React.useMemo(() => <OverlayComponent
//     frame={frame}
//     width={channelMapStore.overlayStores?.bottom?.fullViewWidth}
//     height={channelMapStore.overlayStores?.bottom?.fullViewHeight}
//     overlaySettings={channelMapStore.overlayStores?.bottom}
//     docked={props.docked}
// />, []);
//     const innerOverlayComponent = React.useMemo(() => <OverlayComponent
//     frame={frame}
//     width={channelMapStore.overlayStores?.inner?.fullViewWidth}
//     height={channelMapStore.overlayStores?.inner?.fullViewHeight}
//     overlaySettings={channelMapStore.overlayStores?.inner}
//     docked={props.docked}
// />, []);

    React.useEffect(() => {
        if (channelMapStore.masterFrame) {
            channelMapStore.throttledRequestChannels();
        }
    }, [channelMapStore.masterFrame, channelMapStore.startChannel, channelMapStore.numColumns, channelMapStore.numRows, channelMapStore.masterFrame?.center, channelMapStore.masterFrame?.requiredFrameView, channelMapStore.masterFrame?.zoomLevel]);

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

    // React.useEffect(() => {
    //     const a = <OverlayComponent
    //         ref={ref => (cornerOverlayComponent.current = ref)}
    //         frame={frame}
    //         width={channelMapStore.overlayStores?.corner?.fullViewWidth}
    //         height={channelMapStore.overlayStores?.corner?.fullViewHeight}
    //         overlaySettings={channelMapStore.overlayStores?.corner}
    //         docked={props.docked}
    //     />
    
    //     const b = <OverlayComponent
    //         ref={ref => (leftOverlayComponent.current = ref)}
    //         frame={frame}
    //         width={channelMapStore.overlayStores?.left?.fullViewWidth}
    //         height={channelMapStore.overlayStores?.left?.fullViewHeight}
    //         overlaySettings={channelMapStore.overlayStores?.left}
    //         docked={props.docked}
    //     /> 
    
    //     const c = <OverlayComponent
    //         ref={ref => (bottomOverlayComponent.current = ref)}
    //         frame={frame}
    //         width={channelMapStore.overlayStores?.bottom?.fullViewWidth}
    //         height={channelMapStore.overlayStores?.bottom?.fullViewHeight}
    //         overlaySettings={channelMapStore.overlayStores?.bottom}
    //         docked={props.docked}
    //     />
    
    //     const d = <OverlayComponent
    //         ref={ref => (innerOverlayComponent.current = ref)}
    //         frame={frame}
    //         width={channelMapStore.overlayStores?.inner?.fullViewWidth}
    //         height={channelMapStore.overlayStores?.inner?.fullViewHeight}
    //         overlaySettings={channelMapStore.overlayStores?.inner}
    //         docked={props.docked}
    //     />
    //     console.log(innerOverlayComponent.current)
    // }, [])

    return frame ? (
        <>
            <div style={{top: cursorInfoOffset + (frame.overlayStore.colorbar.position === "top" ? colorbarOffset : 0), left: 40, position: "absolute"}}>
                {channelMapStore.channelArray.map((channel, index) => {
                    const appStore = AppStore.Instance;
                    const column = index % channelMapStore.numColumns;
                    const row = Math.floor(index / channelMapStore.numColumns);
                    // const overlayStore = channelMapStore.overlayStore(index, imageRenderWidth, imageRenderHeight);
                    // const overlayStore = new OverlayStore();
                    // overlayStore.fullViewHeight = imageRenderHeight;
                    // overlayStore.fullViewWidth = imageRenderWidth;
                    let overlayComponentTop = imageRenderHeight * row;
                    let overlayComponentLeft = imageRenderWidth * column;
                    // const paddingLeft =  (overlayStore.numbers.leftShow || overlayStore.labels.leftShow) ?  overlayStore.base + overlayStore.numberWidth + overlayStore.labelWidth : 0;
                    // if (column === 0 && row === props.numImageRow - 1) {
                    //     overlayComponentLeft -= paddingLeft;
                    // } else if (column === 0) {
                    //     overlayComponentLeft -= paddingLeft;
                    // }
                    // overlayStore._fullViewHeight = imageRenderHeight;
                    // overlayStore._fullViewWidth = imageRenderWidth;
                    // const paddingLeft =  (overlayStore.numbers.leftShow || overlayStore.labels.leftShow) ?  overlayStore.base + overlayStore.numberWidth + overlayStore.labelWidth : 0;
                    // const paddingBottom = (overlayStore.numbers.bottomShow || overlayStore.labels.bottomShow) ? overlayStore.base + overlayStore.numberWidth + overlayStore.labelWidth + (overlayStore.colorbar.visible && overlayStore.colorbar.position === "bottom" ? overlayStore.colorbar.totalWidth : 0) + overlayStore.colorbarHoverInfoHeight : 0;
                    // const labelNumberPadding = paddingLeft;
                    // // const labelNumberPadding = (props.frame.overlayStore.labelWidth + props.frame.overlayStore.numberWidth);

                    // // let overlayComponentWidth = frame.overlayStore.viewWidth;
                    // // let overlayComponentHeight = frame.overlayStore.viewHeight;
                    // // console.log(overlayComponentWidth, overlayComponentHeight)
                    // let overlayComponentTop = imageRenderHeight * row;
                    // let overlayComponentLeft = imageRenderWidth * column;

                    const overlayStore = channelMapStore.overlayStore(index, imageRenderWidth, imageRenderHeight);
                    let overlayCanvasRef
                    let overlayComp

                    if (column === 0 && row === channelMapStore.numRows - 1) {
                        // overlayStore.numbers.setBottomHidden(false);
                        // overlayStore.labels.setBottomHidden(false);
                        // overlayStore.numbers.setLeftHidden(false);
                        // overlayStore.labels.setLeftHidden(false);
                        // overlayStore.fullViewWidth = imageRenderWidth + paddingLeft;
                        // overlayStore.fullViewHeight = imageRenderHeight + paddingBottom;

                        // overlayComponentLeft -= paddingLeft;
                        // renderCanvas = cornerOverlayComponent.current?.canvas;
                        overlayComponentLeft -= overlayStore.paddingLeft;
                        overlayComp = cornerOverlayComponent.current ? 
                    //     <OverlayComponent
                    //     refCanvas={cornerOverlayComponent.current}
                    //     frame={frame}
                    //     width={channelMapStore.overlayStores?.corner?.fullViewWidth}
                    //     height={channelMapStore.overlayStores?.corner?.fullViewHeight}
                    //     top={overlayComponentTop}
                    //     left={overlayComponentLeft}
                    //     overlaySettings={channelMapStore.overlayStores?.corner}
                    //     docked={props.docked}
                    // /> 
                    undefined
                    :       
                        <OverlayComponent
                            ref={ref => (cornerOverlayComponent.current = ref?.canvas)}
                            frame={frame}
                            width={channelMapStore.overlayStores?.corner?.fullViewWidth}
                            height={channelMapStore.overlayStores?.corner?.fullViewHeight}
                            top={overlayComponentTop}
                            left={overlayComponentLeft}
                            overlaySettings={channelMapStore.overlayStores?.corner}
                            docked={props.docked}
                        />
                    // if (!cornerOverlayComponent.current) {
                        overlayCanvasRef = cornerOverlayComponent.current;
                    //     <OverlayComponent
                    //         ref={ref => (cornerOverlayComponent.current = ref?.canvas)}
                    //         frame={frame}
                    //         width={channelMapStore.overlayStores?.corner?.fullViewWidth}
                    //         height={channelMapStore.overlayStores?.corner?.fullViewHeight}
                    //         top={overlayComponentTop}
                    //         left={overlayComponentLeft}
                    //         overlaySettings={channelMapStore.overlayStores?.corner}
                    //         docked={props.docked}
                    //     />
                    // }
                    } else if (column === 0) {
                        // overlayStore.numbers.setLeftHidden(false);
                        // overlayStore.labels.setLeftHidden(false);
                        // overlayStore.numbers.setBottomHidden(true);
                        // overlayStore.labels.setBottomHidden(true);
                        // overlayStore.fullViewWidth = imageRenderWidth + paddingLeft;
                        // overlayStore.fullViewHeight = imageRenderHeight;
                        
                        // renderCanvas = leftOverlayComponent.current?.canvas;
                        overlayComponentLeft -= overlayStore.paddingLeft;
                        overlayComp = leftOverlayComponent.current ? 
                        // <OverlayComponent
                        //         refCanvas={leftOverlayComponent.current}
                        //         frame={frame}
                        //         width={channelMapStore.overlayStores?.left?.fullViewWidth}
                        //         height={channelMapStore.overlayStores?.left?.fullViewHeight}
                        //         top={overlayComponentTop}
                        //         left={overlayComponentLeft}
                        //         overlaySettings={channelMapStore.overlayStores?.left}
                        //         docked={props.docked}
                        //     /> 
                            undefined
                            : 
                        <OverlayComponent
                            ref={ref => (leftOverlayComponent.current = ref?.canvas)}
                            frame={frame}
                            width={channelMapStore.overlayStores?.left?.fullViewWidth}
                            height={channelMapStore.overlayStores?.left?.fullViewHeight}
                            top={overlayComponentTop}
                            left={overlayComponentLeft}
                            overlaySettings={channelMapStore.overlayStores?.left}
                            docked={props.docked}
                        />;
                        // if (!leftOverlayComponent.current) {
                            overlayCanvasRef = leftOverlayComponent.current;
                        //     <OverlayComponent
                        //         ref={ref => (leftOverlayComponent.current = ref?.canvas)}
                        //         frame={frame}
                        //         width={channelMapStore.overlayStores?.left?.fullViewWidth}
                        //         height={channelMapStore.overlayStores?.left?.fullViewHeight}
                        //         top={overlayComponentTop}
                        //         left={overlayComponentLeft}
                        //         overlaySettings={channelMapStore.overlayStores?.left}
                        //         docked={props.docked}
                        //     />
                        // }
                    } else if (row === channelMapStore.numRows - 1) {
                        // overlayStore.numbers.setBottomHidden(false);
                        // overlayStore.labels.setBottomHidden(false);
                        // overlayStore.numbers.setLeftHidden(true);
                        // overlayStore.labels.setLeftHidden(true);
                        // overlayStore.fullViewHeight = imageRenderHeight + paddingBottom;
                        // overlayStore.fullViewWidth = imageRenderWidth;
                        // renderCanvas = bottomOverlayComponent.current?.canvas;

                        overlayComp = bottomOverlayComponent.current ? 
                        // <OverlayComponent
                        //         refCanvas={bottomOverlayComponent.current}
                        //         frame={frame}
                        //         width={channelMapStore.overlayStores?.bottom?.fullViewWidth}
                        //         height={channelMapStore.overlayStores?.bottom?.fullViewHeight}
                        //         top={overlayComponentTop}
                        //         left={overlayComponentLeft}
                        //         overlaySettings={channelMapStore.overlayStores?.bottom}
                        //         docked={props.docked}
                        //     />
                            undefined
                            : 
                            <OverlayComponent
                                ref={ref => (bottomOverlayComponent.current = ref?.canvas)}
                                frame={frame}
                                width={channelMapStore.overlayStores?.bottom?.fullViewWidth}
                                height={channelMapStore.overlayStores?.bottom?.fullViewHeight}
                                top={overlayComponentTop}
                                left={overlayComponentLeft}
                                overlaySettings={channelMapStore.overlayStores?.bottom}
                                docked={props.docked}
                            />

                        // if (!bottomOverlayComponent.current) {
                            overlayCanvasRef = bottomOverlayComponent.current;
                        //     <OverlayComponent
                        //         ref={ref => (bottomOverlayComponent.current = ref?.canvas)}
                        //         frame={frame}
                        //         width={channelMapStore.overlayStores?.bottom?.fullViewWidth}
                        //         height={channelMapStore.overlayStores?.bottom?.fullViewHeight}
                        //         top={overlayComponentTop}
                        //         left={overlayComponentLeft}
                        //         overlaySettings={channelMapStore.overlayStores?.bottom}
                        //         docked={props.docked}
                        //     />
                        // }
                    } else {
                        // overlayStore.numbers.setBottomHidden(true);
                        // overlayStore.labels.setBottomHidden(true);
                        // overlayStore.numbers.setLeftHidden(true);
                        // overlayStore.labels.setLeftHidden(true);
                        // overlayStore.fullViewHeight = imageRenderHeight;
                        // overlayStore.fullViewWidth = imageRenderWidth;
                        // renderCanvas = innerOverlayComponent.current?.canvas;

                        overlayComp = innerOverlayComponent.current ? 
                    //     <OverlayComponent
                    //     refCanvas={innerOverlayComponent.current}
                    //     frame={frame}
                    //     width={channelMapStore.overlayStores?.inner?.fullViewWidth}
                    //     height={channelMapStore.overlayStores?.inner?.fullViewHeight}
                    //     top={overlayComponentTop}
                    //     left={overlayComponentLeft}
                    //     overlaySettings={channelMapStore.overlayStores?.inner}
                    //     docked={props.docked}
                    // /> 
                    undefined
                    : 
                        <OverlayComponent
                                ref={ref => (innerOverlayComponent.current = ref?.canvas)}
                                frame={frame}
                                width={channelMapStore.overlayStores?.inner?.fullViewWidth}
                                height={channelMapStore.overlayStores?.inner?.fullViewHeight}
                                top={overlayComponentTop}
                                left={overlayComponentLeft}
                                overlaySettings={channelMapStore.overlayStores?.inner}
                                docked={props.docked}
                            />;
                        // if (!innerOverlayComponent.current) {
                        //     overlayCanvasRef = innerOverlayComponent.current;
                        //     <OverlayComponent
                        //         ref={ref => (innerOverlayComponent.current = ref?.canvas)}
                        //         frame={frame}
                        //         width={channelMapStore.overlayStores?.inner?.fullViewWidth}
                        //         height={channelMapStore.overlayStores?.inner?.fullViewHeight}
                        //         top={overlayComponentTop}
                        //         left={overlayComponentLeft}
                        //         overlaySettings={channelMapStore.overlayStores?.inner}
                        //         docked={props.docked}
                        //     />;
                        // }
                        overlayCanvasRef = innerOverlayComponent.current;
                    }
                    // overlayStore.setBase(0);
                    // overlayStore.setDefaultGap(2);
                    // overlayStore.setIsChannelMap(true);
                    // console.log(frame?.channel)
                    // console.log(index, overlayStore.fullViewHeight, overlayStore.fullViewWidth, imageRenderHeight + paddingBottom, imageRenderWidth + paddingLeft)

                    // console.log(overlayStore.base, overlayStore.numberWidth, overlayStore.labelWidth, overlayStore.colorbarHoverInfoHeight, overlayStore.colorbar.totalWidth)
                    // console.log(paddingBottom)
                    // console.log(overlayComponentWidth, overlayComponentHeight)
                    // const overlayComponentTop = overlayStore.fullViewHeight * row;
                    // const overlayComponentLeft = overlayStore.fullViewWidth * column;
                    if (canvasRef.current && overlayCanvasRef) {
                        const destCanvas = canvasRef.current.getContext("2d");
                        destCanvas.drawImage(overlayCanvasRef, 0, 0);
                    }

                    return (
                        <>
                            <RasterViewComponent
                                key={`raster-view-component-${channel}`}
                                frame={frame}
                                webGLService={ChannelMapWebGLService.Instance}
                                tileService={TileService.Instance}
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
                            <OverlayComponent
                                frame={frame}
                                width={channelMapStore.overlayStores?.inner?.fullViewWidth}
                                height={channelMapStore.overlayStores?.inner?.fullViewHeight}
                                overlaySettings={overlayStore}
                                top={overlayComponentTop}
                                left={overlayComponentLeft}
                                docked={props.docked} />
                            {/* <canvas style={{top: overlayComponentTop || 0, left: overlayComponentLeft || 0, width: overlayStore.viewWidth, height: overlayStore.viewHeight}} id="overlay-canvas" ref={ref => canvasRef.current = ref} /> */}
                            {/* {overlayComp} */}
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
                            {/* <ContourViewComponent frame={frame} docked={props.docked} row={row} column={column} /> */}
                        </>
                    );
                })}
            </div>
            {frame.overlayStore.colorbar.visible && <ColorbarComponent frame={frame} onCursorHoverValueChanged={props.channelMapStore.setPixelHighlightValue} width={fullRenderWidth + 40} height={fullRenderHeight + 40} top={frame.overlayStore.colorbar.position === "bottom" ? cursorInfoOffset + fullRenderHeight + 40 : cursorInfoOffset}  length={frame.overlayStore.colorbar.position === "right" ? fullRenderHeight : fullRenderWidth} />}
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
