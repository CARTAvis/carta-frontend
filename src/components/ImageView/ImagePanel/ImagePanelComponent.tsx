import * as React from "react";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {AnimationMode, CursorInfoVisibility, ImageType, ImageViewLayer} from "enums";
import {type CursorInfo, type ImageItem, type Point2D, Zoom} from "models";
import {AppStore, type ColorBlendingStore, type FrameStore} from "stores";

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
    @observable isImageToolbarVisible: boolean = false;

    private regionViewRef: RegionViewComponent;

    @action setPixelHighlightValue = (val: number) => {
        if (!AppStore.Instance.isExportingImage) {
            this.pixelHighlightValue = val;
        }
    };

    get frame(): FrameStore | null {
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

    private onRegionViewZoom = (zoom: number | Point2D) => {
        if (this.frame) {
            this.regionViewRef?.stageZoomToPoint(this.frame.renderWidth / 2, this.frame.renderHeight / 2, zoom);
        }
    };

    onClickToCenter = (cursorInfo: CursorInfo) => {
        this.frame?.setCenter(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y);
    };

    @action onMouseEnter = () => {
        this.isImageToolbarVisible = true;
    };

    @action onMouseLeave = () => {
        this.isImageToolbarVisible = false;
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

    get isCursorInfoRequired() {
        const appStore = AppStore.Instance;
        switch (appStore.preferenceStore.cursorInfoVisible) {
            case CursorInfoVisibility.Always:
                return true;
            case CursorInfoVisibility.HideTiled:
                return appStore.imageViewConfigStore.imagesPerPage === 1;
            case CursorInfoVisibility.ActiveImage:
                return appStore.activeImage?.store === this.props.image.store;
            default:
                return false;
        }
    }

    render() {
        const appStore = AppStore.Instance;
        const activeLayer = appStore.activeLayer;

        const frame = this.frame;
        const overlaySettings = appStore.overlaySettings;
        if (frame?.isRenderable && appStore.isAstReady) {
            const isActive = appStore.isActiveImage(this.props.image) && (appStore.imageViewConfigStore.imagesPerPage > 1 || appStore.previewFrames.size > 0);
            const isColorBlending = this.props.image?.type === ImageType.COLOR_BLENDING;
            const className = classNames("image-panel-div", {active: isActive});

            const style: React.CSSProperties = {
                width: frame.overlayStore.viewWidth,
                height: frame.overlayStore.viewHeight
            };
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

            const shouldShowRaster = !isColorBlending || (isColorBlending && (this.props.image.store as ColorBlendingStore).isRasterVisible);
            const shouldShowContour = !isColorBlending || (isColorBlending && (this.props.image.store as ColorBlendingStore).isContourVisible);
            const shouldShowVector = !isColorBlending || (isColorBlending && (this.props.image.store as ColorBlendingStore).isVectorOverlayVisible);

            return (
                <div id={`image-panel-${this.props.column}-${this.props.row}`} className={className} style={style} onWheel={this.onMouseWheel} onMouseDown={this.onMouseDown} onMouseOver={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                    {shouldShowRaster && <RasterViewComponent image={this.props.image} isDocked={this.props.docked} pixelHighlightValue={this.pixelHighlightValue} row={this.props.row} column={this.props.column} />}
                    {shouldShowContour && <ContourViewComponent frame={frame} docked={this.props.docked} row={this.props.row} column={this.props.column} />}
                    {shouldShowVector && <VectorOverlayViewComponent frame={frame} docked={this.props.docked} row={this.props.row} column={this.props.column} />}
                    {appStore.overlaySettings?.isVisible && <OverlayComponent image={this.props.image} overlaySettings={overlaySettings} overlayStore={frame.overlayStore} isDocked={this.props.docked} />}
                    {this.isCursorInfoRequired && frame.cursorInfo && !isColorBlending && (
                        <CursorOverlayComponent
                            cursorInfo={frame.cursorInfo}
                            cursorValue={frame.cursorInfo.isInsideImage ? ((frame.isPreview && frame.previewCursorValue ? frame.previewCursorValue.value : frame.cursorValue?.value) ?? 0) : 0}
                            isValueCurrent={frame.isCursorValueCurrent}
                            spectralInfo={frame.spectralInfo}
                            width={frame.overlayStore.viewWidth}
                            left={frame.overlayStore.padding.left}
                            right={frame.overlayStore.padding.right}
                            isDocked={this.props.docked}
                            unit={frame.requiredUnit}
                            top={frame.overlayStore.padding.top}
                            currentStokes={appStore.activeFrame?.requiredPolarizationInfo}
                            hasCursorValueToPercentage={frame.requiredUnit === "%"}
                            isPreview={frame.isPreview}
                        />
                    )}
                    {appStore.overlaySettings.colorbar.isVisible && !isColorBlending && <ColorbarComponent frame={frame} onCursorHoverValueChanged={this.setPixelHighlightValue} />}
                    {!isColorBlending && <BeamProfileOverlayComponent frame={frame} top={frame.overlayStore.padding.top} left={frame.overlayStore.padding.left} docked={this.props.docked} padding={10} />}
                    <CatalogViewGLComponent frame={frame} docked={this.props.docked} />
                    <RegionViewComponent
                        ref={this.getRegionViewRef}
                        frame={frame}
                        width={frame.renderWidth}
                        height={frame.renderHeight}
                        top={frame.overlayStore.padding.top}
                        left={frame.overlayStore.padding.left}
                        onClickToCenter={this.onClickToCenter}
                        dragPanningEnabled={appStore.preferenceStore.isDragPanning}
                        docked={this.props.docked && activeLayer !== ImageViewLayer.Catalog}
                    />
                    {!(appStore.animatorStore.isAnimationActive && appStore.animatorStore.animationMode === AnimationMode.FRAME) && (
                        <ToolbarComponent
                            isDocked={this.props.docked}
                            isVisible={this.isImageToolbarVisible}
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
