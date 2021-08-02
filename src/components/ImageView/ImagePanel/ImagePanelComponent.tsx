import * as React from "react";
import {observer} from "mobx-react";
import {action, autorun, computed, makeObservable, observable, runInAction} from "mobx";
import {Tag} from "@blueprintjs/core";
import {OverlayComponent} from "../Overlay/OverlayComponent";
import {CursorOverlayComponent} from "../CursorOverlay/CursorOverlayComponent";
import {ColorbarComponent} from "../Colorbar/ColorbarComponent";
import {RasterViewComponent} from "../RasterView/RasterViewComponent";
import {ToolbarComponent} from "../Toolbar/ToolbarComponent";
import {BeamProfileOverlayComponent} from "../BeamProfileOverlay/BeamProfileOverlayComponent";
import {RegionViewComponent} from "../RegionView/RegionViewComponent";
import {ContourViewComponent} from "../ContourView/ContourViewComponent";
import {CatalogViewGLComponent} from "../CatalogView/CatalogViewGLComponent";
import {ImageViewLayer} from "../ImageViewComponent";
import {AppStore, RegionStore, FrameStore} from "stores";
import {CursorInfo, CursorInfoVisibility, Point2D} from "models";
import {toFixed} from "utilities";
import "./ImagePanelComponent.scss";

interface ImagePanelComponentProps {
    docked: boolean;
    frame: FrameStore;
    row: number;
    column: number;
}

@observer
export class ImagePanelComponent extends React.Component<ImagePanelComponentProps> {
    private ratioIndicatorTimeoutHandle;
    private cachedImageSize: Point2D;

    @observable showRatioIndicator: boolean = false;
    @observable pixelHighlightValue: number = NaN;
    readonly activeLayer: ImageViewLayer;

    @action setPixelHighlightValue = (val: number) => {
        this.pixelHighlightValue = val;
    };

    constructor(props: ImagePanelComponentProps) {
        super(props);
        makeObservable(this);

        this.activeLayer = AppStore.Instance.activeLayer;
        autorun(() => {
            const frame = props.frame;
            if (frame) {
                const imageSize = {x: frame.renderWidth, y: frame.renderHeight};
                // Compare to cached image size to prevent duplicate events when changing frames
                if (!this.cachedImageSize || this.cachedImageSize.x !== imageSize.x || this.cachedImageSize.y !== imageSize.y) {
                    this.cachedImageSize = imageSize;
                    clearTimeout(this.ratioIndicatorTimeoutHandle);
                    runInAction(() => (this.showRatioIndicator = true));
                    this.ratioIndicatorTimeoutHandle = setTimeout(
                        () =>
                            runInAction(() => {
                                this.showRatioIndicator = false;
                            }),
                        1000
                    );
                }
            }
        });
    }

    onClicked = (cursorInfo: CursorInfo) => {
        const frame = this.props.frame;
        if (frame) {
            frame.setCenter(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y);
        }
    };

    onZoomed = (cursorInfo: CursorInfo, delta: number) => {
        const frame = this.props.frame;
        if (frame) {
            const zoomSpeed = 1 + Math.abs(delta / 750.0);

            // If frame is spatially matched, apply zoom to the reference frame, rather than the active frame
            if (frame.spatialReference) {
                const newZoom = frame.spatialReference.zoomLevel * (delta > 0 ? zoomSpeed : 1.0 / zoomSpeed);
                frame.zoomToPoint(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y, newZoom, true);
            } else {
                const newZoom = frame.zoomLevel * (delta > 0 ? zoomSpeed : 1.0 / zoomSpeed);
                frame.zoomToPoint(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y, newZoom, true);
            }
        }
    };

    onMouseEnter = () => {
        AppStore.Instance.showImageToolbar();
    };

    onMouseLeave = () => {
        AppStore.Instance.hideImageToolbar();
    };

    private handleRegionDoubleClicked = (region: RegionStore) => {
        const appStore = AppStore.Instance;
        if (region) {
            const frame = appStore.getFrame(region.fileId);
            if (frame) {
                frame.regionSet.selectRegion(region);
                appStore.dialogStore.showRegionDialog();
            }
        }
    };

    @computed get cursorInfoRequired() {
        const appStore = AppStore.Instance;
        switch (appStore.preferenceStore.cursorInfoVisible) {
            case CursorInfoVisibility.Always:
                return true;
            case CursorInfoVisibility.HideTiled:
                return appStore.numRows * appStore.numColumns === 1;
            case CursorInfoVisibility.ActiveImage:
                return appStore.activeFrame === this.props.frame;
            default:
                return false;
        }
    }

    render() {
        const appStore = AppStore.Instance;
        const overlayStore = appStore.overlayStore;

        const frame = this.props.frame;
        if (frame && frame.isRenderable && appStore.astReady) {
            const effectiveWidth = frame.renderWidth * (frame.renderHiDPI ? devicePixelRatio : 1);
            const effectiveHeight = frame.renderHeight * (frame.renderHiDPI ? devicePixelRatio : 1);
            const imageRatioTagOffset = {x: overlayStore.padding.left + overlayStore.viewWidth / 2.0, y: overlayStore.padding.top + overlayStore.viewHeight / 2.0};

            return (
                <div className="image-panel-div" style={{width: overlayStore.viewWidth, height: overlayStore.viewHeight}} onMouseOver={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                    <RasterViewComponent frame={frame} docked={this.props.docked} pixelHighlightValue={this.pixelHighlightValue} row={this.props.row} column={this.props.column} />
                    <ContourViewComponent frame={frame} docked={this.props.docked} />
                    {frame.valid && <OverlayComponent frame={frame} overlaySettings={overlayStore} docked={this.props.docked} />}
                    {this.cursorInfoRequired && frame.cursorInfo && (
                        <CursorOverlayComponent
                            cursorInfo={frame.cursorInfo}
                            cursorValue={frame.cursorInfo.isInsideImage ? frame.cursorValue.value : undefined}
                            isValueCurrent={frame.isCursorValueCurrent}
                            spectralInfo={frame.spectralInfo}
                            width={overlayStore.viewWidth}
                            left={overlayStore.padding.left}
                            right={overlayStore.padding.right}
                            docked={this.props.docked}
                            unit={frame.unit}
                            top={overlayStore.padding.top}
                            currentStokes={frame.hasStokes ? frame.stokesInfo[frame.requiredStokes] : ""}
                            showImage={true}
                            showWCS={true}
                            showValue={true}
                            showChannel={false}
                            showSpectral={true}
                            showStokes={true}
                        />
                    )}
                    {frame && overlayStore.colorbar.visible && <ColorbarComponent onCursorHoverValueChanged={this.setPixelHighlightValue} />}
                    {frame && <BeamProfileOverlayComponent top={overlayStore.padding.top} left={overlayStore.padding.left} docked={this.props.docked} padding={10} />}
                    {frame && <CatalogViewGLComponent frame={frame} docked={this.props.docked} onZoomed={this.onZoomed} />}
                    {frame && (
                        <RegionViewComponent
                            frame={frame}
                            width={frame.renderWidth}
                            height={frame.renderHeight}
                            top={overlayStore.padding.top}
                            left={overlayStore.padding.left}
                            onClicked={this.onClicked}
                            onRegionDoubleClicked={this.handleRegionDoubleClicked}
                            onZoomed={this.onZoomed}
                            overlaySettings={overlayStore}
                            isRegionCornerMode={appStore.preferenceStore.isRegionCornerMode}
                            dragPanningEnabled={appStore.preferenceStore.dragPanning}
                            cursorFrozen={appStore.cursorFrozen}
                            cursorPoint={frame.cursorInfo.posImageSpace}
                            docked={this.props.docked && (this.activeLayer === ImageViewLayer.RegionMoving || this.activeLayer === ImageViewLayer.RegionCreating)}
                        />
                    )}
                    <ToolbarComponent docked={this.props.docked} visible={appStore.imageToolbarVisible} vertical={false} frame={frame} onActiveLayerChange={appStore.updateActiveLayer} activeLayer={this.activeLayer} />
                    <div style={{opacity: this.showRatioIndicator ? 1 : 0, left: imageRatioTagOffset.x, top: imageRatioTagOffset.y}} className={"tag-image-ratio"}>
                        <Tag large={true}>
                            {effectiveWidth} x {effectiveHeight} ({toFixed(effectiveWidth / effectiveHeight, 2)})
                        </Tag>
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }
}
