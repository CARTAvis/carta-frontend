import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {action, computed, makeObservable, observable} from "mobx";
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
import {AppStore, FrameStore} from "stores";
import {CursorInfo, CursorInfoVisibility} from "models";
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
    readonly activeLayer: ImageViewLayer;

    private regionViewRef;

    @action setPixelHighlightValue = (val: number) => {
        this.pixelHighlightValue = val;
    };

    constructor(props: ImagePanelComponentProps) {
        super(props);
        makeObservable(this);

        this.activeLayer = AppStore.Instance.activeLayer;
    }

    private getRegionViewRef = ref => {
        this.regionViewRef = ref;
    };

    private onRegionViewZoom = (zoom: number, isZoomToFit: boolean = false) => {
        const frame = this.props.frame;
        if (frame) {
            if (isZoomToFit) {
                this.regionViewRef?.resetStage();
            }
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

        const frame = this.props.frame;
        if (frame?.isRenderable && appStore.astReady) {
            const isActive = frame === appStore.activeFrame && appStore.numImageRows * appStore.numImageColumns > 1;
            const className = classNames("image-panel-div", {active: isActive});

            let style: React.CSSProperties = {width: overlayStore.viewWidth, height: overlayStore.viewHeight};
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

            return (
                <div id={`image-panel-${this.props.column}-${this.props.row}`} className={className} style={style} onWheel={this.onMouseWheel} onMouseDown={this.onMouseDown} onMouseOver={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                    <RasterViewComponent frame={frame} docked={this.props.docked} pixelHighlightValue={this.pixelHighlightValue} row={this.props.row} column={this.props.column} />
                    {false && <ContourViewComponent frame={frame} docked={this.props.docked} row={this.props.row} column={this.props.column} />}
                    <OverlayComponent frame={frame} overlaySettings={overlayStore} docked={this.props.docked} />
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
                            currentStokes={appStore.activeFrame.requiredStokes >= 0 && appStore.activeFrame.requiredStokes < appStore.activeFrame.stokesInfo?.length ? appStore.activeFrame.requiredStokesInfo : ""}
                        />
                    )}
                    {overlayStore.colorbar.visible && <ColorbarComponent frame={frame} onCursorHoverValueChanged={this.setPixelHighlightValue} />}
                    <BeamProfileOverlayComponent frame={frame} top={overlayStore.padding.top} left={overlayStore.padding.left} docked={this.props.docked} padding={10} />
                    {false && <CatalogViewGLComponent frame={frame} docked={this.props.docked} />}
                    <RegionViewComponent
                        ref={this.getRegionViewRef}
                        frame={frame}
                        width={frame.renderWidth}
                        height={frame.renderHeight}
                        top={overlayStore.padding.top}
                        left={overlayStore.padding.left}
                        onClickToCenter={this.onClickToCenter}
                        overlaySettings={overlayStore}
                        dragPanningEnabled={appStore.preferenceStore.dragPanning}
                        cursorFrozen={appStore.cursorFrozen}
                        docked={this.props.docked && (this.activeLayer === ImageViewLayer.RegionMoving || this.activeLayer === ImageViewLayer.RegionCreating)}
                    />
                    <ToolbarComponent docked={this.props.docked} visible={this.imageToolbarVisible} frame={frame} activeLayer={this.activeLayer} onActiveLayerChange={appStore.updateActiveLayer} onRegionViewZoom={this.onRegionViewZoom} />
                </div>
            );
        } else {
            return null;
        }
    }
}
