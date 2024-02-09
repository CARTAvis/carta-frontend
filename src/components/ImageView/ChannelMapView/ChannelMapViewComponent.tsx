// This is a component that uses rasterViewComponent to construct something on the same level as imagePanel component
import * as React from "react";
// import { ImageViewLayer } from "../ImageViewComponent";
import { action, computed, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";

import { CursorInfo, FrameView, Point2D } from "models";
import { TileWebGLService } from "services";
import { AppStore, OverlayStore } from "stores";
import { FrameStore } from "stores/Frame";
import { GetRequiredTiles } from "utilities";

import { ColorbarComponent } from "../Colorbar/ColorbarComponent";
// import { CARTA } from "carta-protobuf";
import { CursorOverlayComponent } from "../CursorOverlay/CursorOverlayComponent";
import { OverlayComponent } from "../Overlay/OverlayComponent";
import { RasterViewComponent } from "../RasterView/RasterViewComponent";
import { RegionViewComponent } from "../RegionView/RegionViewComponent";
import { ToolbarComponent } from "../Toolbar/ToolbarComponent";

export class ChannelMapViewComponentProps {
    frame: FrameStore;
    docked: boolean;
    gl: WebGL2RenderingContext;
    channelMapStore: ChannelMapStore;
    renderWidth: number;
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
    };

    @observable masterFrame: FrameStore;
    @observable startChannel: number;
    @observable numColumns: number;
    @observable numRows: number;
    private overlayStores: {corner: OverlayStore, left: OverlayStore, bottom: OverlayStore, inner: OverlayStore};

    @action setOverlayStores(overlayStore: OverlayStore, position: string) {
        if (position === 'corner') {
            this.overlayStores.corner = overlayStore;
        } else if (position === 'left') {
            this.overlayStores.left = overlayStore;
        } else if (position === 'bottom') {
            this.overlayStores.bottom = overlayStore;
        } else {
            this.overlayStores.inner = overlayStore;
        }
    };

    @action updateOverlayStoreSize(width: number, height: number) {
        for (const overlayStore of Object.values(this.overlayStores)) {
            // overlayStore && overlayStore.setViewDimension(width, height);
            overlayStore && overlayStore.setViewDimension(width + overlayStore.paddingLeft, height + overlayStore.paddingBottom)
        }
    }

    @action setMasterFrame(masterFrame: FrameStore) {
        console.log('setting master frame')
        this.masterFrame = masterFrame;
    };

    @action setStartChannel(startChannel: number) {
        // Add checks for valid startChannel number for the masterFrame
        this.startChannel = startChannel;
    };

    @action setNumColumns(numColumns: number) {
        if (isFinite(numColumns) && numColumns > 0) {
            this.numColumns = numColumns;
        }
    };
    
    @action setNumRows(numRows: number) {
        if (isFinite(numRows) && numRows > 0) {
            this.numRows = numRows;
        }
    };

    @action flipPage(next: boolean = true) {
        // this.channelFrames = [];
        const newStart = next ? this.startChannel + this.numColumns * this.numRows : this.startChannel - this.numColumns * this.numRows;
        // Check new start valid with masterFrame
        if (newStart >= 0) {
            this.setStartChannel(newStart);
        }
    };

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

        if (true) { // if channel map is active
            // Calculate new required frame view (cropped to file size)
            const reqView = frame.requiredFrameView(this.overlayStores.inner.renderWidth, this.overlayStores.inner.renderHeight);
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
            console.log('requesting', tiles, croppedReq, imageSize)
            const midPointImageCoords = {x: (reqView.xMax + reqView.xMin) / 2.0, y: (reqView.yMin + reqView.yMax) / 2.0};
            // TODO: dynamic tile size
            const tileSizeFullRes = reqView.mip * 256;
            const midPointTileCoords = {x: midPointImageCoords.x / tileSizeFullRes - 0.5, y: midPointImageCoords.y / tileSizeFullRes - 0.5};
            // If BUNIT = km/s, adopted compressionQuality is set to 32 regardless the preferences setup
            const bunitVariant = ["km/s", "km s-1", "km s^-1", "km.s-1"];
            const compressionQuality = bunitVariant.includes(frame.headerUnit) ? Math.max(appStore.preferenceStore.imageCompressionQuality, 32) : appStore.preferenceStore.imageCompressionQuality;
            // testing using arbitrary channel range
            console.log('requesting channel range', {min: this.startChannel, max: this.channelRange})
            appStore.tileService.requestTiles(tiles, frame.frameInfo.fileId, frame.channel, frame.stokes, midPointTileCoords, compressionQuality, true, {min: this.startChannel, max: this.channelRange});
        }
    };

    public overlayStore(index: number, imageRenderWidth: number, imageRenderHeight: number) {
            const column = index % this.numColumns;
            const row = Math.floor(index / this.numColumns);

            this.updateOverlayStoreSize(imageRenderWidth, imageRenderHeight);

            if (column === 0 && row === this.numRows - 1) {
                this.setOverlayStores(this.overlayStores?.corner || new OverlayStore(imageRenderWidth, imageRenderHeight, 0, 2, false, false, false, false, true), 'corner');
                return this.overlayStores.corner;
            } else if (column === 0) {
                this.setOverlayStores(this.overlayStores?.left || new OverlayStore(imageRenderWidth, imageRenderHeight, 0, 2, false, false, true, true, true), 'left');
                return this.overlayStores.left;
            } else if (row === this.numRows - 1) {
                this.setOverlayStores(this.overlayStores?.bottom || new OverlayStore(imageRenderWidth, imageRenderHeight, 0, 2, true, true, false, false, true), 'bottom');
                return this.overlayStores.bottom;
            } else {
                this.setOverlayStores(this.overlayStores?.inner || new OverlayStore(imageRenderWidth, imageRenderHeight, 0, 2, true, true, true, true, true), 'inner');
                return this.overlayStores.inner;
            }
    };

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
    };
};

export const ChannelMapViewComponent: React.FC<ChannelMapViewComponentProps> = observer((props: ChannelMapViewComponentProps) => {
    const regionViewRef = React.useRef<RegionViewComponent>();
    const cursorOverlayRef = React.useRef<CursorOverlayComponent>();
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
    const imageRenderWidth = (props.renderWidth - frame?.overlayStore.colorbar.totalWidth - frame?.overlayStore.defaultGap - 40) / channelMapStore.numColumns;
    const imageRenderHeight = isFinite(cursorOverlayRef.current?.divElement.clientHeight) ? ((props.renderHeight - cursorOverlayRef.current?.divElement.clientHeight - 40) / channelMapStore.numRows) : 0;

    // React.useEffect(() => {
        /*
        This code snippet is run when the channel map component is loaded.
        Multiple frames of the same file is loaded with the backend, using specific fileId to denote that it is temporary frame used for channel map.
        The different frames are push to an array of FrameStore, the location where this is stored is still under consideration.
        Currently, they are pushed to visibleFrames in AppStore, which is for testing purposes only and need to be updated.
        The channels are set to the assigned channel number, but the updateChannel method in AppStore is not triggered for some reason and needs to be fixed at this point.
        */
        // The following is a temporary solution to channelMapStore.channelFrames problem.
        // channelMapStore.setStartChannel(frame.channel);
        // console.log('updating start channel to', props.frame.channel , channelMapStore.startChannel)
        // const frameInfo = props.frame.frameInfo;
        // for (let i = 0; i < channelFrames.length; i++) {
        //     channelFrames[i].setChannel(channelMapStore.startChannel + i)
        // };
        // setChannelFrames([]);
        // for (let i = 0; i < channelMapStore.numColumns * channelMapStore.numRows; i++) {
        //     AppStore.Instance.backendService.loadFile(frameInfo.directory, frameInfo.fileInfo.name, frameInfo.hdu, -100 * (i + 1), false)
        //     .then(ack => {
        //         const newFrameInfo: FrameInfo = {
        //             fileId: ack.fileId,
        //             directory: frameInfo.directory,
        //             lelExpr: false,
        //             hdu: frameInfo.hdu,
        //             fileInfo: new CARTA.FileInfo(ack.fileInfo),
        //             fileInfoExtended: new CARTA.FileInfoExtended(ack.fileInfoExtended),
        //             fileFeatureFlags: ack.fileFeatureFlags,
        //             renderMode: CARTA.RenderMode.RASTER,
        //             beamTable: ack.beamTable
        //         };

        //         const newFrame = new FrameStore(newFrameInfo);
        //         channelMapStore.setChannelFrames(newFrame);
        //         console.log('setting channel to ', channelMapStore.startChannel + i)
        //         newFrame.setChannel(channelMapStore.startChannel + i)
        //         setChannelFrames(prev => [...prev, newFrame]);

        //         // The following will need to be updated for better compatibility.
        //         // AppStore.Instance.visibleFrames.push(newFrame);
        //         // AppStore.Instance.setActiveFrame(channelMapStore.masterFrame);
        //     })
        //     .catch(err => console.log(err)); 
        // }

    // }, [props.frame?.channel]);

    React.useEffect(() => {
        AppStore.Instance.channelMapStore.requestChannels();
    }, [channelMapStore.startChannel, channelMapStore.numColumns, channelMapStore.numRows]);

    // React.useEffect(() => {
    //     // The following is a temporary solution to channelMapStore.channelFrames problem.
    //     // const newFrame = channelMapStore.requestChannelMapFrames();
    //     console.log('initializing frames for channel map')
    //     setChannelFrames([]);
    //     const frameInfo = props.frame?.frameInfo;
    //     for (let i = 0; i < channelMapStore.numColumns * channelMapStore.numRows; i++) {
    //         AppStore.Instance.backendService.loadFile(frameInfo.directory, frameInfo.fileInfo.name, frameInfo.hdu, -100 * (i + 1), false)
    //         .then(ack => {
    //             const newFrameInfo: FrameInfo = {
    //                 fileId: ack.fileId,
    //                 directory: frameInfo.directory,
    //                 lelExpr: false,
    //                 hdu: frameInfo.hdu,
    //                 fileInfo: new CARTA.FileInfo(ack.fileInfo),
    //                 fileInfoExtended: new CARTA.FileInfoExtended(ack.fileInfoExtended),
    //                 fileFeatureFlags: ack.fileFeatureFlags,
    //                 renderMode: CARTA.RenderMode.RASTER,
    //                 beamTable: ack.beamTable
    //             };

    //             const newFrame = new FrameStore(newFrameInfo);
    //             // channelMapStore.setChannelFrames(newFrame);
    //             newFrame.setChannel(channelMapStore.startChannel + i)
    //             setChannelFrames(prev => [...prev, newFrame]);

    //             // The following will need to be updated for better compatibility.
    //             AppStore.Instance.visibleFrames.push(newFrame);
    //             AppStore.Instance.setActiveFrame(channelMapStore.masterFrame);
    //         })
    //         .catch(err => console.log(err)); 
    //     }
    //     // updateChannelFrames(channelFrames);
    // }, [props.frame.channel]);

    // const updateChannelFrames = (channelFrames: FrameStore[]) => {
    //     console.log('updating channel frames')
    //     channelFrames.forEach((frame, index) => {
    //         const appStore = AppStore.Instance;
    //         const column = index % props.numImageColumn;
    //         const row = Math.floor(index / props.numImageColumn);
    //         const overlayStore = frame.overlayStore;
    //         overlayStore.fullViewHeight = imageRenderHeight;
    //         overlayStore.fullViewWidth = imageRenderWidth;
    //         const paddingLeft =  (overlayStore.numbers.leftShow || overlayStore.labels.leftShow) ?  overlayStore.base + overlayStore.numberWidth + overlayStore.labelWidth : 0;
    //         const paddingBottom = (overlayStore.numbers.bottomShow || overlayStore.labels.bottomShow) ? overlayStore.base + overlayStore.numberWidth + overlayStore.labelWidth + (overlayStore.colorbar.visible && overlayStore.colorbar.position === "bottom" ? overlayStore.colorbar.totalWidth : 0) + overlayStore.colorbarHoverInfoHeight : 0;
    //         const labelNumberPadding = paddingLeft;
    //         overlayStore.setIsChannelMap(true);
    //         // const labelNumberPadding = (props.frame.overlayStore.labelWidth + props.frame.overlayStore.numberWidth);
            
    //         // let overlayComponentWidth = frame.overlayStore.viewWidth;
    //         // let overlayComponentHeight = frame.overlayStore.viewHeight;
    //         // console.log(overlayComponentWidth, overlayComponentHeight)
    //         let overlayComponentTop = imageRenderHeight * row;
    //         let overlayComponentLeft = imageRenderWidth * column;
    //         if (column === 0 && row === props.numImageRow - 1) {
    //             overlayStore.numbers.setBottomHidden(false);
    //             overlayStore.labels.setBottomHidden(false);
    //             overlayStore.numbers.setLeftHidden(false);
    //             overlayStore.labels.setLeftHidden(false);
    //             // overlayComponentWidth += overlayStore.padding.left;
    //             // overlayComponentHeight += overlayStore.padding.bottom;
    //             // overlayComponentLeft -= overlayStore.padding.left;
    //             overlayStore.fullViewWidth += labelNumberPadding;
    //             overlayStore.fullViewHeight += labelNumberPadding;
    //             // overlayComponentLeft -= labelNumberPadding;
    //         } else if (column === 0) {
    //             overlayStore.numbers.setLeftHidden(false);
    //             overlayStore.labels.setLeftHidden(false);
    //             overlayStore.numbers.setBottomHidden(true);
    //             overlayStore.labels.setBottomHidden(true);
    //             overlayStore.fullViewWidth += labelNumberPadding;
    //             // overlayComponentLeft -= labelNumberPadding;
    //         } else if (row === props.numImageRow - 1) {
    //             overlayStore.numbers.setBottomHidden(false);
    //             overlayStore.labels.setBottomHidden(false);
    //             overlayStore.numbers.setLeftHidden(true);
    //             overlayStore.labels.setLeftHidden(true);
    //             overlayStore.fullViewHeight += paddingBottom;
    //         } else {
    //             overlayStore.numbers.setBottomHidden(true);
    //             overlayStore.labels.setBottomHidden(true);
    //             overlayStore.numbers.setLeftHidden(true);
    //             overlayStore.labels.setLeftHidden(true);
    //         }
    //         overlayStore.setBase(0);
    //         overlayStore.setDefaultGap(2);
    //         overlayStore.setIsChannelMap(true);
    //         console.log(overlayStore.padding)
    //     });
    // }

    const onRegionViewZoom = (frame: FrameStore, zoom: number) => {
        if (frame) {
            regionViewRef?.current.stageZoomToPoint(frame.renderWidth / 2, frame.renderHeight / 2, zoom);
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
            <div style={{top: cursorOverlayRef.current?.divElement.clientHeight, left: 40, position: "absolute"}}>
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

                    if (column === 0 && row === channelMapStore.numRows - 1) {
                        // overlayStore.numbers.setBottomHidden(false);
                        // overlayStore.labels.setBottomHidden(false);
                        // overlayStore.numbers.setLeftHidden(false);
                        // overlayStore.labels.setLeftHidden(false);
                        // overlayStore.fullViewWidth = imageRenderWidth + paddingLeft;
                        // overlayStore.fullViewHeight = imageRenderHeight + paddingBottom;

                        // overlayComponentLeft -= paddingLeft;
                        overlayComponentLeft -= overlayStore.paddingLeft;
                    } else if (column === 0) {
                        // overlayStore.numbers.setLeftHidden(false);
                        // overlayStore.labels.setLeftHidden(false);
                        // overlayStore.numbers.setBottomHidden(true);
                        // overlayStore.labels.setBottomHidden(true);
                        // overlayStore.fullViewWidth = imageRenderWidth + paddingLeft;
                        // overlayStore.fullViewHeight = imageRenderHeight;

                        overlayComponentLeft -= overlayStore.paddingLeft;
                    } else if (row === channelMapStore.numRows - 1) {
                        // overlayStore.numbers.setBottomHidden(false);
                        // overlayStore.labels.setBottomHidden(false);
                        // overlayStore.numbers.setLeftHidden(true);
                        // overlayStore.labels.setLeftHidden(true);
                        // overlayStore.fullViewHeight = imageRenderHeight + paddingBottom;
                        // overlayStore.fullViewWidth = imageRenderWidth;
                    } else {
                        // overlayStore.numbers.setBottomHidden(true);
                        // overlayStore.labels.setBottomHidden(true);
                        // overlayStore.numbers.setLeftHidden(true);
                        // overlayStore.labels.setLeftHidden(true);
                        // overlayStore.fullViewHeight = imageRenderHeight;
                        // overlayStore.fullViewWidth = imageRenderWidth;
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
                    return (
                        <>
                            <RasterViewComponent
                                key={`raster-view-component-${channel}`}
                                frame={frame}
                                gl={TileWebGLService.Instance.gl}
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
                            <OverlayComponent frame={frame} width={overlayStore.fullViewWidth} height={overlayStore.fullViewHeight} overlaySettings={overlayStore} top={overlayComponentTop} left={overlayComponentLeft} docked={props.docked} />
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
            </div>
                {frame.overlayStore.colorbar.visible && <ColorbarComponent frame={frame} onCursorHoverValueChanged={props.channelMapStore.setPixelHighlightValue} />}
                <ToolbarComponent
                    docked={props.docked}
                    visible={true}
                    frame={frame}
                    activeLayer={AppStore.Instance.activeLayer}
                    onActiveLayerChange={AppStore.Instance.updateActiveLayer}
                    onRegionViewZoom={zoom => onRegionViewZoom(frame, zoom)}
                    onZoomToFit={() => fitZoomFrameAndRegion(frame)}
                />
                <CursorOverlayComponent
                    ref={ref => cursorOverlayRef.current = ref}
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
                    currentStokes={AppStore.Instance.activeFrame.requiredPolarizationInfo}
                    cursorValueToPercentage={frame.requiredUnit === "%"}
                    isPreview={frame.isPreview}
                />
        </>
    ) : (<div>Testing</div>);
});