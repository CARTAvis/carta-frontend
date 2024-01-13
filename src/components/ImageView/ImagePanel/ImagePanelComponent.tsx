import * as React from "react";
import classNames from "classnames";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ImageViewLayer} from "components";
import {CursorInfo, CursorInfoVisibility, Zoom} from "models";
import {PreviewWebGLService, TileWebGLService} from "services";
import {AnimationMode, AppStore} from "stores";
import {FrameStore} from "stores/Frame";

import {BeamProfileOverlayComponent} from "../BeamProfileOverlay/BeamProfileOverlayComponent";
import {CatalogViewGLComponent} from "../CatalogView/CatalogViewGLComponent";
import {ChannelMapViewComponent} from "../ChannelMapView/ChannelMapViewComponent";
import {ColorbarComponent} from "../Colorbar/ColorbarComponent";
import {ContourViewComponent} from "../ContourView/ContourViewComponent";
import {CursorOverlayComponent} from "../CursorOverlay/CursorOverlayComponent";
import {OverlayComponent} from "../Overlay/OverlayComponent";
import {RasterViewComponent} from "../RasterView/RasterViewComponent";
import {RegionViewComponent} from "../RegionView/RegionViewComponent";
import {ToolbarComponent} from "../Toolbar/ToolbarComponent";
import {VectorOverlayViewComponent} from "../VectorOverlayView/VectorOverlayView";

import "./ImagePanelComponent.scss";

interface ImagePanelComponentProps {
    docked: boolean;
    frame: FrameStore;
    row: number;
    column: number;
}

@observer
export class ImagePanelComponent extends React.Component<ImagePanelComponentProps> {
    @observable pixelHighlightValue: number = NaN;
    @observable imageToolbarVisible: boolean = false;

    private regionViewRef: RegionViewComponent;

    @action setPixelHighlightValue = (val: number) => {
        if (!AppStore.Instance.isExportingImage) {
            this.pixelHighlightValue = val;
        }
    };

    constructor(props: ImagePanelComponentProps) {
        super(props);
        makeObservable(this);
    }

    componentDidMount() {
        this.fitZoomOfLoadingMultipleFiles();
    }

    componentDidUpdate() {
        this.fitZoomOfLoadingMultipleFiles();
    }

    private fitZoomOfLoadingMultipleFiles = () => {
        if (AppStore.Instance.isLoadingMultipleFiles && AppStore.Instance.preferenceStore.zoomMode === Zoom.FIT) {
            this.fitZoomFrameAndRegion();
        }
    };

    public fitZoomFrameAndRegion = () => {
        const frame = this.props.frame;
        if (frame) {
            const zoom = frame.fitZoom();
            if (zoom) {
                this.onRegionViewZoom(zoom);
            }
        }
    };

    private getRegionViewRef = ref => {
        this.regionViewRef = ref;
    };

    private onRegionViewZoom = (zoom: number) => {
        const frame = this.props.frame;
        if (frame) {
            this.regionViewRef?.stageZoomToPoint(frame.renderWidth / 2, frame.renderHeight / 2, zoom);
        }
    };

    onClickToCenter = (cursorInfo: CursorInfo) => {
        this.props.frame?.setCenter(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y);
    };

    @action onMouseEnter = () => {
        this.imageToolbarVisible = true;
    };

    @action onMouseLeave = () => {
        this.imageToolbarVisible = false;
    };

    onMouseDown = ev => {
        const appStore = AppStore.Instance;
        if (this.props.frame !== appStore.activeFrame) {
            appStore.setActiveFrame(this.props.frame);
            ev.stopPropagation();
        }
    };

    onMouseWheel = ev => {
        const appStore = AppStore.Instance;
        if (this.props.frame !== appStore.activeFrame) {
            appStore.setActiveFrame(this.props.frame);
            ev.stopPropagation();
        }
    };

    @computed get cursorInfoRequired() {
        const appStore = AppStore.Instance;
        switch (appStore.preferenceStore.cursorInfoVisible) {
            case CursorInfoVisibility.Always:
                return true;
            case CursorInfoVisibility.HideTiled:
                return appStore.numImageRows * appStore.numImageColumns === 1;
            case CursorInfoVisibility.ActiveImage:
                return appStore.activeFrame === this.props.frame;
            default:
                return false;
        }
    }

    render() {
        const appStore = AppStore.Instance;
        const overlayStore = appStore.overlayStore;
        const activeLayer = appStore.activeLayer;

        const frame = this.props.frame;
        if (frame?.isRenderable && appStore.astReady) {
            const isActive = frame === appStore.activeFrame && (appStore.numImageRows * appStore.numImageColumns > 1 || appStore.previewFrames.size > 0);
            const className = classNames("image-panel-div", {active: isActive});

            let style: React.CSSProperties = {width: frame.overlayStore.viewWidth, height: frame.overlayStore.viewHeight};
            if (isActive) {
                // Disable border radius rounding in inner corners
                if (this.props.row !== 0) {
                    style.borderTopLeftRadius = 0;
                    style.borderTopRightRadius = 0;
                }
                if (this.props.column !== 0) {
                    style.borderTopLeftRadius = 0;
                    style.borderBottomLeftRadius = 0;
                }
                if (this.props.row !== appStore.numImageRows - 1) {
                    style.borderBottomLeftRadius = 0;
                    style.borderBottomRightRadius = 0;
                }
                if (this.props.column !== appStore.numImageColumns - 1) {
                    style.borderTopRightRadius = 0;
                    style.borderBottomRightRadius = 0;
                }
            }

            // const channelFrames = [frame, frame, frame, frame, frame, frame] // using one frame to mock the array of frames at different channels

            return (
                <div id={`image-panel-${this.props.column}-${this.props.row}`} className={className} style={style} onWheel={this.onMouseWheel} onMouseDown={this.onMouseDown} onMouseOver={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                    {/* <RasterViewComponent
                        frame={frame}
                        overlayStore={frame.overlayStore}
                        gl={frame.isPreview ? PreviewWebGLService.Instance.gl : TileWebGLService.Instance.gl}
                        docked={this.props.docked}
                        pixelHighlightValue={this.pixelHighlightValue}
                        renderWidth={frame.renderWidth}
                        renderHeight={frame.renderHeight}
                        row={this.props.row}
                        column={this.props.column}
                        tileBasedRender={!frame.isPreview}
                        rasterData={frame.previewPVRasterData}
                        numImageColumns={appStore.numImageColumns}
                        numImageRows={appStore.numImageRows}
                    /> */}
                    <ChannelMapViewComponent
                        frame={frame}
                        gl={TileWebGLService.Instance.gl}
                        pixelHighlightValue={this.pixelHighlightValue}
                        docked={this.props.docked}
                        renderWidth={frame.overlayStore.imageViewerSettingStore.fullViewWidth}
                        renderHeight={frame.overlayStore.imageViewerSettingStore.fullViewHeight}
                        numImageColumn={3}
                        numImageRow={3}
                    />
                    <ContourViewComponent frame={frame} docked={this.props.docked} row={this.props.row} column={this.props.column} />
                    <VectorOverlayViewComponent frame={frame} docked={this.props.docked} row={this.props.row} column={this.props.column} />
                    {/* <OverlayComponent frame={frame} overlaySettings={overlayStore} docked={this.props.docked} /> */}
                    {/* {this.cursorInfoRequired && frame.cursorInfo && (
                        <CursorOverlayComponent
                            cursorInfo={frame.cursorInfo}
                            cursorValue={frame.cursorInfo.isInsideImage ? (frame.isPreview ? frame.previewCursorValue.value : frame.cursorValue.value) : undefined}
                            isValueCurrent={frame.isCursorValueCurrent}
                            spectralInfo={frame.spectralInfo}
                            width={frame.overlayStore.viewWidth}
                            left={frame.overlayStore.padding.left}
                            right={frame.overlayStore.padding.right}
                            docked={this.props.docked}
                            unit={frame.requiredUnit}
                            top={frame.overlayStore.padding.top}
                            currentStokes={appStore.activeFrame.requiredPolarizationInfo}
                            cursorValueToPercentage={frame.requiredUnit === "%"}
                            isPreview={frame.isPreview}
                        />
                    )} */}
                    {frame.overlayStore.colorbar.visible && <ColorbarComponent frame={frame} onCursorHoverValueChanged={this.setPixelHighlightValue} />}
                    <BeamProfileOverlayComponent frame={frame} top={frame.overlayStore.padding.top} left={frame.overlayStore.padding.left} docked={this.props.docked} padding={10} />
                    <CatalogViewGLComponent frame={frame} docked={this.props.docked} />
                    {/* <RegionViewComponent
                        ref={this.getRegionViewRef}
                        frame={frame}
                        width={frame.renderWidth}
                        height={frame.renderHeight}
                        top={frame.overlayStore.padding.top}
                        left={frame.overlayStore.padding.left}
                        onClickToCenter={this.onClickToCenter}
                        overlaySettings={frame.overlayStore}
                        dragPanningEnabled={appStore.preferenceStore.dragPanning}
                        docked={this.props.docked && activeLayer !== ImageViewLayer.Catalog}
                    /> */}
                    {!(appStore.animatorStore.animationActive && appStore.animatorStore.animationMode === AnimationMode.FRAME) && (
                        <ToolbarComponent
                            docked={this.props.docked}
                            visible={this.imageToolbarVisible}
                            frame={frame}
                            activeLayer={activeLayer}
                            onActiveLayerChange={appStore.updateActiveLayer}
                            onRegionViewZoom={this.onRegionViewZoom}
                            onZoomToFit={this.fitZoomFrameAndRegion}
                        />
                    )}
                </div>
            );
        } else {
            return null;
        }
    }
}
