import * as React from "react";
import classNames from "classnames";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ImageViewLayer} from "components";
import {CursorInfo, CursorInfoVisibility, ImageItem, ImageType, Zoom} from "models";
import {AnimationMode, AppStore, type FrameStore} from "stores";

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

import "./ImagePanelComponent.scss";

interface ImagePanelComponentProps {
    docked: boolean;
    image: ImageItem;
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

    @computed get frame(): FrameStore {
        return this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image.store?.baseFrame : this.props.image?.store;
    }

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
        if (this.frame) {
            const zoom = this.frame.fitZoom();
            if (zoom) {
                this.onRegionViewZoom(zoom);
            }
        }
    };

    private getRegionViewRef = ref => {
        this.regionViewRef = ref;
    };

    private onRegionViewZoom = (zoom: number) => {
        if (this.frame) {
            this.regionViewRef?.stageZoomToPoint(this.frame.renderWidth / 2, this.frame.renderHeight / 2, zoom);
        }
    };

    onClickToCenter = (cursorInfo: CursorInfo) => {
        this.frame?.setCenter(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y);
    };

    @action onMouseEnter = () => {
        this.imageToolbarVisible = true;
    };

    @action onMouseLeave = () => {
        this.imageToolbarVisible = false;
    };

    onMouseDown = ev => {
        const appStore = AppStore.Instance;
        if (!appStore.isActiveImage(this.props.image)) {
            appStore.updateActiveImage(this.props.image);
            ev.stopPropagation();
        }
    };

    onMouseWheel = ev => {
        const appStore = AppStore.Instance;
        if (!appStore.isActiveImage(this.props.image)) {
            appStore.updateActiveImage(this.props.image);
            ev.stopPropagation();
        }
    };

    @computed get cursorInfoRequired() {
        const appStore = AppStore.Instance;
        switch (appStore.preferenceStore.cursorInfoVisible) {
            case CursorInfoVisibility.Always:
                return true;
            case CursorInfoVisibility.HideTiled:
                return appStore.imageViewConfigStore.imagesPerPage === 1;
            case CursorInfoVisibility.ActiveImage:
                return appStore.activeFrame === this.frame;
            default:
                return false;
        }
    }

    render() {
        const appStore = AppStore.Instance;
        const overlayStore = appStore.overlayStore;
        const activeLayer = appStore.activeLayer;

        if (this.frame?.isRenderable && appStore.astReady) {
            const isActive = appStore.isActiveImage(this.props.image) && (appStore.imageViewConfigStore.imagesPerPage > 1 || appStore.previewFrames.size > 0);
            const isColorBlending = this.props.image?.type === ImageType.COLOR_BLENDING;
            const className = classNames("image-panel-div", {active: isActive});

            let style: React.CSSProperties = {width: this.frame.previewViewWidth || overlayStore.viewWidth, height: this.frame.previewViewHeight || overlayStore.viewHeight};
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
                if (this.props.row !== appStore.imageViewConfigStore.numImageRows - 1) {
                    style.borderBottomLeftRadius = 0;
                    style.borderBottomRightRadius = 0;
                }
                if (this.props.column !== appStore.imageViewConfigStore.numImageColumns - 1) {
                    style.borderTopRightRadius = 0;
                    style.borderBottomRightRadius = 0;
                }
            }

            return (
                <div id={`image-panel-${this.props.column}-${this.props.row}`} className={className} style={style} onWheel={this.onMouseWheel} onMouseDown={this.onMouseDown} onMouseOver={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                    <RasterViewComponent frame={this.frame} docked={this.props.docked} pixelHighlightValue={this.pixelHighlightValue} row={this.props.row} column={this.props.column} />
                    <ContourViewComponent frame={this.frame} docked={this.props.docked} row={this.props.row} column={this.props.column} />
                    <VectorOverlayViewComponent frame={this.frame} docked={this.props.docked} row={this.props.row} column={this.props.column} />
                    <OverlayComponent frame={this.frame} overlaySettings={overlayStore} docked={this.props.docked} />
                    {this.cursorInfoRequired && this.frame.cursorInfo && !isColorBlending && (
                        <CursorOverlayComponent
                            cursorInfo={this.frame.cursorInfo}
                            cursorValue={this.frame.cursorInfo.isInsideImage ? (this.frame.isPreview ? this.frame.previewCursorValue.value : this.frame.cursorValue.value) : undefined}
                            isValueCurrent={this.frame.isCursorValueCurrent}
                            spectralInfo={this.frame.spectralInfo}
                            width={this.frame.previewViewWidth || overlayStore.viewWidth}
                            left={overlayStore.padding.left}
                            right={overlayStore.padding.right}
                            docked={this.props.docked}
                            unit={this.frame.requiredUnit}
                            top={overlayStore.padding.top}
                            currentStokes={appStore.activeFrame.requiredPolarizationInfo}
                            cursorValueToPercentage={this.frame.requiredUnit === "%"}
                            isPreview={this.frame.isPreview}
                        />
                    )}
                    {overlayStore.colorbar.visible && !isColorBlending && <ColorbarComponent frame={this.frame} onCursorHoverValueChanged={this.setPixelHighlightValue} />}
                    <BeamProfileOverlayComponent frame={this.frame} top={overlayStore.padding.top} left={overlayStore.padding.left} docked={this.props.docked} padding={10} />
                    <CatalogViewGLComponent frame={this.frame} docked={this.props.docked} />
                    <RegionViewComponent
                        ref={this.getRegionViewRef}
                        frame={this.frame}
                        width={this.frame.renderWidth}
                        height={this.frame.renderHeight}
                        top={overlayStore.padding.top}
                        left={overlayStore.padding.left}
                        onClickToCenter={this.onClickToCenter}
                        overlaySettings={overlayStore}
                        dragPanningEnabled={appStore.preferenceStore.dragPanning}
                        docked={this.props.docked && activeLayer !== ImageViewLayer.Catalog}
                    />
                    {!(appStore.animatorStore.animationActive && appStore.animatorStore.animationMode === AnimationMode.FRAME) && (
                        <ToolbarComponent
                            docked={this.props.docked}
                            visible={this.imageToolbarVisible}
                            frame={this.frame}
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
