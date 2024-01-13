// This is a component that uses rasterViewComponent to construct something on the same level as imagePanel component
import * as React from "react";
import { observer } from "mobx-react";

import { TileWebGLService } from "services";
import { AppStore } from "stores";
import { FrameInfo, FrameStore } from "stores/Frame";

import { RasterViewComponent } from "../RasterView/RasterViewComponent";
import { RegionViewComponent } from "../RegionView/RegionViewComponent";
import { OverlayComponent } from "../Overlay/OverlayComponent";
import { ToolbarComponent } from "../Toolbar/ToolbarComponent";
import { ImageViewLayer } from "../ImageViewComponent";
import { action, makeObservable, observable } from "mobx";
import { CARTA } from "carta-protobuf";
import { CursorOverlayComponent } from "../CursorOverlay/CursorOverlayComponent";

export class ChannelMapViewComponentProps {
    docked: boolean;
    pixelHighlightValue: number;
    frame: FrameStore;
    gl: WebGL2RenderingContext;
    renderWidth: number;
    renderHeight: number;
    numImageRow: number;
    numImageColumn: number;
}

export class ChannelMapStore {
    private static staticInstance: ChannelMapStore;
    
    static get Instance() {
        return ChannelMapStore.staticInstance;
    }

    constructor(frame: FrameStore, numColumns: number = 3, numRows: number = 2) {
        makeObservable(this);
        ChannelMapStore.staticInstance = this;
        this.masterFrame = frame;
        this.startChannel = 0;
        this.numColumns = numColumns;
        this.numRows = numRows
    };

    @observable masterFrame: FrameStore;
    @observable channelFrames: FrameStore[] = [];
    @observable startChannel: number;
    @observable numColumns: number;
    @observable numRows: number;

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
    
    @action setChannelFrames(frame: FrameStore) {
        const frames = this.channelFrames.slice();
        frames.push(frame);
        this.channelFrames = frames;
        console.log(this.channelFrames)
    };

    @action flipPage(next: boolean = true) {
        this.channelFrames = [];
        const newStart = next ? this.startChannel + this.numColumns * this.numRows : this.startChannel - this.numColumns * this.numRows;
        // Check new start valid with masterFrame
        if (newStart >= 0) {
            this.setStartChannel(newStart);
        }
    };

    @action requestChannelMapFrames() {
        const frameInfo = this.masterFrame.frameInfo;
        for (let i = 0; i < this.numColumns * this.numRows; i++) {
            AppStore.Instance.backendService.loadFile(frameInfo.directory, frameInfo.fileInfo.name, frameInfo.hdu, -100 * (i + 1), false)
            .then(ack => {
                const newFrameInfo: FrameInfo = {
                    fileId: ack.fileId,
                    directory: frameInfo.directory,
                    lelExpr: false,
                    hdu: frameInfo.hdu,
                    fileInfo: new CARTA.FileInfo(ack.fileInfo),
                    fileInfoExtended: new CARTA.FileInfoExtended(ack.fileInfoExtended),
                    fileFeatureFlags: ack.fileFeatureFlags,
                    renderMode: CARTA.RenderMode.RASTER,
                    beamTable: ack.beamTable
                };

                const newFrame = new FrameStore(newFrameInfo);
                this.setChannelFrames(newFrame);
                newFrame.setChannel(this.startChannel + i)

                // The following will need to be updated for better compatibility.
                AppStore.Instance.visibleFrames.push(newFrame);
                AppStore.Instance.setActiveFrame(this.masterFrame);
            })
            .catch(err => console.log(err)); 
        }
    }
};

export const ChannelMapViewComponent: React.FC<ChannelMapViewComponentProps> = observer((props: ChannelMapViewComponentProps) => {
    const regionViewRef = React.useRef<RegionViewComponent>();
    const cursorOverlayRef = React.useRef<CursorOverlayComponent>();
    // For some reason, the channelMapStore.channelFrames observable is not triggering rerender, the following is a temporary solution.
    const [channelFrames, setChannelFrames] = React.useState<FrameStore[]>([]);
    const channelMapStore = new ChannelMapStore(props.frame, props.numImageColumn, props.numImageRow);
    // const channelFrames = observable(channelMapStore.channelFrames);
    // let channelFrames: FrameStore[] = observable([]);
    // const [rerenderTrigger, setRerenderTrigger] = React.useState<boolean>(true);
    console.log(props.frame.overlayStore.colorbar.width)
    const imageRenderWidth = (props.renderWidth - props.frame.overlayStore.colorbar.totalWidth - props.frame.overlayStore.defaultGap) / props.numImageColumn;
    const imageRenderHeight = ((props.renderHeight - cursorOverlayRef.current?.divElement.clientHeight) / props.numImageRow);

    React.useEffect(() => {
        /*
        This code snippet is run when the channel map component is loaded.
        Multiple frames of the same file is loaded with the backend, using specific fileId to denote that it is temporary frame used for channel map.
        The different frames are push to an array of FrameStore, the location where this is stored is still under consideration.
        Currently, they are pushed to visibleFrames in AppStore, which is for testing purposes only and need to be updated.
        The channels are set to the assigned channel number, but the updateChannel method in AppStore is not triggered for some reason and needs to be fixed at this point.
        */
        // The following is a temporary solution to channelMapStore.channelFrames problem.
        channelMapStore.setStartChannel(props.frame.channel);
        console.log('updating start channel to', props.frame.channel , channelMapStore.startChannel)
        const frameInfo = props.frame.frameInfo;
        for (let i = 0; i < channelFrames.length; i++) {
            channelFrames[i].setChannel(channelMapStore.startChannel + i)
        };
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

    }, [props.frame.channel]);

    React.useEffect(() => {
        // The following is a temporary solution to channelMapStore.channelFrames problem.
        // const newFrame = channelMapStore.requestChannelMapFrames();
        console.log('initializing frames for channel map')
        const frameInfo = props.frame.frameInfo;
        for (let i = 0; i < channelMapStore.numColumns * channelMapStore.numRows; i++) {
            AppStore.Instance.backendService.loadFile(frameInfo.directory, frameInfo.fileInfo.name, frameInfo.hdu, -100 * (i + 1), false)
            .then(ack => {
                const newFrameInfo: FrameInfo = {
                    fileId: ack.fileId,
                    directory: frameInfo.directory,
                    lelExpr: false,
                    hdu: frameInfo.hdu,
                    fileInfo: new CARTA.FileInfo(ack.fileInfo),
                    fileInfoExtended: new CARTA.FileInfoExtended(ack.fileInfoExtended),
                    fileFeatureFlags: ack.fileFeatureFlags,
                    renderMode: CARTA.RenderMode.RASTER,
                    beamTable: ack.beamTable
                };

                const newFrame = new FrameStore(newFrameInfo);
                channelMapStore.setChannelFrames(newFrame);
                newFrame.setChannel(channelMapStore.startChannel + i)
                setChannelFrames(prev => [...prev, newFrame]);

                // The following will need to be updated for better compatibility.
                AppStore.Instance.visibleFrames.push(newFrame);
                AppStore.Instance.setActiveFrame(channelMapStore.masterFrame);
            })
            .catch(err => console.log(err)); 
        }
    }, []);

    const onRegionViewZoom = (zoom: number) => {
        const frame = props.frame;
        if (frame) {
            regionViewRef?.current.stageZoomToPoint(frame.renderWidth / 2, frame.renderHeight / 2, zoom);
        }
    };

    const fitZoomFrameAndRegion = () => {
        const frame = props.frame;
        if (frame) {
            const zoom = frame.fitZoom();
            if (zoom) {
                onRegionViewZoom(zoom);
            }
        }
    };

    return (
        <>
            <div style={{top: cursorOverlayRef.current?.divElement.clientHeight, position: "absolute"}}>
                        {channelFrames.map((frame, index) => {
                            const appStore = AppStore.Instance;
                            // console.log(rerenderTrigger)
                            const column = index % props.numImageColumn;
                            const row = Math.floor(index / props.numImageColumn);
                            const overlayStore = frame.overlayStore;
                            overlayStore.fullViewHeight = imageRenderHeight;
                            overlayStore.fullViewWidth = imageRenderWidth;
                            if (column === 0 && row === props.numImageRow - 1) {
                                overlayStore.numbers.setBottomHidden(false);
                                overlayStore.labels.setBottomHidden(false);
                                overlayStore.numbers.setLeftHidden(false);
                                overlayStore.labels.setLeftHidden(false);
                            } else if (column === 0) {
                                overlayStore.numbers.setLeftHidden(false);
                                overlayStore.labels.setLeftHidden(false);
                                overlayStore.numbers.setBottomHidden(true);
                                overlayStore.labels.setBottomHidden(true); 
                            } else if (row === props.numImageRow - 1) {
                                overlayStore.numbers.setBottomHidden(false);
                                overlayStore.labels.setBottomHidden(false);
                                overlayStore.numbers.setLeftHidden(true);
                                overlayStore.labels.setLeftHidden(true);
                            } else {
                                overlayStore.numbers.setBottomHidden(true);
                                overlayStore.labels.setBottomHidden(true);
                                overlayStore.numbers.setLeftHidden(true);
                                overlayStore.labels.setLeftHidden(true);
                            }
                            overlayStore.setBase(0);
                            overlayStore.setDefaultGap(2);
                            overlayStore.setIsChannelMap(true);
            
                            return (
                                <>
                                    <RasterViewComponent
                                        frame={frame}
                                        gl={TileWebGLService.Instance.gl}
                                        overlayStore={overlayStore}
                                        renderWidth={imageRenderWidth}
                                        renderHeight={imageRenderHeight}
                                        docked={props.docked}
                                        pixelHighlightValue={props.pixelHighlightValue}
                                        numImageColumns={props.numImageColumn}
                                        numImageRows={props.numImageRow}
                                        row={row}
                                        column={column}
                                        tileBasedRender={true}
                                    />
                                    <OverlayComponent frame={frame} overlaySettings={overlayStore} top={imageRenderHeight * row} left={imageRenderWidth * column} docked={props.docked} />
                                    <RegionViewComponent
                                        ref={ref => regionViewRef.current = ref}
                                        frame={frame}
                                        width={overlayStore.renderWidth}
                                        height={overlayStore.renderHeight}
                                        top={overlayStore.viewHeight * row + overlayStore.paddingTop}
                                        left={overlayStore.viewWidth * column + overlayStore.paddingLeft}
                                        onClickToCenter={null}
                                        overlaySettings={overlayStore}
                                        dragPanningEnabled={appStore.preferenceStore.dragPanning}
                                        docked={props.docked}
                                    />
                                    <ToolbarComponent
                                        docked={props.docked}
                                        visible={true}
                                        frame={frame}
                                        activeLayer={ImageViewLayer.RegionMoving}
                                        onActiveLayerChange={appStore.updateActiveLayer}
                                        onRegionViewZoom={onRegionViewZoom}
                                        onZoomToFit={fitZoomFrameAndRegion}
                                    />
                                </>
                            );
                        })}
            </div>
            <CursorOverlayComponent
                ref={ref => cursorOverlayRef.current = ref}
                cursorInfo={props.frame.cursorInfo}
                cursorValue={props.frame.cursorInfo.isInsideImage ? props.frame.cursorValue.value : undefined}
                isValueCurrent={props.frame.isCursorValueCurrent}
                spectralInfo={props.frame.spectralInfo}
                width={props.frame.overlayStore.fullViewWidth}
                left={0}
                right={props.frame.overlayStore.padding.right}
                docked={props.docked}
                unit={props.frame.requiredUnit}
                top={0}
                currentStokes={AppStore.Instance.activeFrame.requiredPolarizationInfo}
                cursorValueToPercentage={props.frame.requiredUnit === "%"}
                isPreview={props.frame.isPreview}
            />
        </>
    );
        // <Observer>
        //     {() => 
        //     }
        // </Observer>
});