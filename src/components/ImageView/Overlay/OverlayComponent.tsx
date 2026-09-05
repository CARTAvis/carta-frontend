import * as React from "react";
import * as AST from "ast_wrapper";
import classNames from "classnames";
import * as _ from "lodash";
import {observer} from "mobx-react";

import {ImageType, SkyRefIs} from "enums";
import {type ImageItem} from "models";
import {AppStore, OverlaySettings, type OverlayStore, PreferenceStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {setAstSystem} from "utilities";

import "./OverlayComponent.scss";

interface OffsetCoordAxisSetting {
    unit: string;
    format: string;
}

interface OffsetCoordAxisSettings {
    axis1: OffsetCoordAxisSetting;
    axis2: OffsetCoordAxisSetting;
}

export class OverlayComponentProps {
    overlaySettings: OverlaySettings;
    overlayStore: OverlayStore;
    image: ImageItem;
    isDocked: boolean;
    top?: number;
    left?: number;
    isUnscaled?: boolean;
    channelMapDrawFunction?: (canvas: HTMLCanvasElement) => void;
}

@observer
export class OverlayComponent extends React.Component<OverlayComponentProps> {
    canvas: HTMLCanvasElement;
    private static readonly OffsetCoordUnitSwitchFactor = 2;

    componentDidMount() {
        this.updateImage();
    }

    componentDidUpdate() {
        this.updateImage();
    }

    updateImage() {
        AppStore.Instance.resetImageRatio();
        if (PreferenceStore.Instance.shouldLimitOverlayRedraw) {
            this.throttledRenderCanvas();
        } else {
            requestAnimationFrame(this.renderCanvas);
        }
    }

    updateImageDimensions() {
        if (this.canvas) {
            this.canvas.width = this.props.overlayStore.viewWidth * devicePixelRatio * AppStore.Instance.imageRatio;
            this.canvas.height = this.props.overlayStore.viewHeight * devicePixelRatio * AppStore.Instance.imageRatio;
        }
    }

    private getLatReferenceSize(frame: FrameStore, viewSizeArcsec: number): number {
        if (frame.skyRefIs !== SkyRefIs.Pole || !frame.wcsInfoOffset) {
            return viewSizeArcsec;
        }

        const wcsInfoOffsetSky = AST.copy(frame.wcsInfoOffset);
        if (!wcsInfoOffsetSky) {
            return viewSizeArcsec;
        }

        let centerWcs: {x: number; y: number} | undefined;
        try {
            AST.setI(wcsInfoOffsetSky, "Current", 2);
            centerWcs = AST.transformPoint(wcsInfoOffsetSky, frame.center.x, frame.center.y, true);
        } finally {
            AST.deleteObject(wcsInfoOffsetSky);
        }

        if (!centerWcs || !isFinite(centerWcs.y)) {
            return viewSizeArcsec;
        }

        const latValueArcsec = (Math.abs(centerWcs.y) * (3600 * 180)) / Math.PI;
        return Math.max(viewSizeArcsec, latValueArcsec);
    }

    private getOffsetCoordAxisSetting(referenceSizeArcsec: number): OffsetCoordAxisSetting {
        if (referenceSizeArcsec < 60 * OverlayComponent.OffsetCoordUnitSwitchFactor) {
            return {unit: "arcsec", format: "s.*"};
        }
        if (referenceSizeArcsec < 3600 * OverlayComponent.OffsetCoordUnitSwitchFactor) {
            return {unit: "arcmin", format: "m.*"};
        }
        return {unit: "deg", format: "d.*"};
    }

    private getOffsetCoordAxisSettings(frame: FrameStore, viewSizeArcsec: number): OffsetCoordAxisSettings {
        const axis2ReferenceSize = this.getLatReferenceSize(frame, viewSizeArcsec);
        const axis2Setting = this.getOffsetCoordAxisSetting(axis2ReferenceSize);
        // Pole-mode axis 1 is offset longitude (0-360 deg), so keep degree formatting regardless of view size.
        const axis1Setting = frame.skyRefIs === SkyRefIs.Pole ? {unit: "deg", format: "d.*"} : axis2Setting;
        return {
            axis1: axis1Setting,
            axis2: axis2Setting
        };
    }

    renderCanvas = () => {
        const settings = this.props.overlaySettings;
        const frame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image.store?.baseFrame : this.props.image?.store;
        const appStore = AppStore.Instance;
        const padding = this.props.overlayStore.padding;

        if (!frame) {
            return;
        }

        const wcsInfoSelected = frame.isOffsetCoord ? frame.wcsInfoOffset : frame.wcsInfo;
        const wcsInfo = frame.spatialReference ? frame.transformedWcsInfo : wcsInfoSelected;
        const zoomFrame = frame.spatialReference ?? frame;
        const zoomX = zoomFrame.effectiveZoomLevel.x;
        const zoomY = zoomFrame.effectiveZoomLevel.y;
        const zoomRatio = isFinite(zoomX) && isFinite(zoomY) && zoomY > 0 ? zoomX / zoomY : 1;
        const effectiveAspectRatio = zoomRatio * frame.aspectRatio;

        const frameView = this.props.isUnscaled
            ? {
                  xMin: padding.left * appStore.pixelRatio,
                  xMax: this.props.overlayStore.viewWidth * appStore.pixelRatio - padding.right * appStore.pixelRatio,
                  yMin: (effectiveAspectRatio ?? 1) * padding.bottom * appStore.pixelRatio,
                  yMax: (effectiveAspectRatio ?? 1) * this.props.overlayStore.viewHeight * appStore.pixelRatio - padding.top * appStore.pixelRatio,
                  mip: 1
              }
            : frame.spatialReference
              ? frame.spatialReference.requiredFrameView
              : frame.requiredFrameView;
        if (wcsInfo && frameView && this.canvas) {
            // Take aspect ratio scaling into account
            const tempWcsInfo = AST.copy(wcsInfo);
            if (!tempWcsInfo) {
                console.log("Create wcs info copy failed.");
                return;
            }

            this.updateImageDimensions();
            AST.setCanvas(this.canvas);
            if (!frame.hasSquarePixels) {
                const currentWcsIndex = parseInt(AST.getString(tempWcsInfo, "Current"), 10);
                const scaleMapping = AST.scaleMap2D(1.0, 1.0 / effectiveAspectRatio);
                const newFrame = AST.frame(2, "Domain=PIXEL");
                try {
                    AST.addFrame(tempWcsInfo, 1, scaleMapping, newFrame);
                } finally {
                    AST.deleteObject(newFrame);
                    AST.deleteObject(scaleMapping);
                }
                const newBaseIndex = parseInt(AST.getString(tempWcsInfo, "Nframe"), 10);
                AST.setI(tempWcsInfo, "Base", newBaseIndex);
                AST.setI(tempWcsInfo, "Current", OverlaySettings.Instance.isImgCoordinates ? newBaseIndex : currentWcsIndex);
            }

            // move the ast setting here to ensure ast is updated before plotting
            if (!(frame.isPVImage && frame.spectralAxis?.valid) && !(frame.isSwappedZ && frame.spectralAxis?.valid)) {
                const formatStringX = settings.numbers.formatStringX;
                const formatStringY = settings.numbers.formatStringY;
                const explicitSystem = settings.global.explicitSystem;
                const dirAxesSetting = `${frame.dirX > 2 || frame.dirXLabel === "" ? "" : `Label(${frame.dirX})=${frame.dirXLabel},`} ${frame.dirY > 2 || frame.dirYLabel === "" ? "" : `Label(${frame.dirY})=${frame.dirYLabel},`}`;

                if (formatStringX !== undefined && formatStringY !== undefined && explicitSystem !== undefined && OverlaySettings.Instance.isWcsCoordinates && frame.isValidWcs) {
                    AST.set(tempWcsInfo, `Format(${frame.dirX})=${formatStringX}, Format(${frame.dirY})=${formatStringY},` + dirAxesSetting);
                    setAstSystem(tempWcsInfo, explicitSystem, settings.global);
                }
            }

            if (frame.isOffsetCoord && OverlaySettings.Instance.isWcsCoordinates) {
                const fovSizeInArcsec = frame.getWcsSizeInArcsec(frame.fovSize);
                const viewSizeArcsec = Math.min(fovSizeInArcsec.x, fovSizeInArcsec.y);
                const {axis1, axis2} = this.getOffsetCoordAxisSettings(frame, viewSizeArcsec);

                // disable unit labels when custom labels on
                if (settings.labels.hasCustomText) {
                    AST.set(tempWcsInfo, `Format(1)=${axis1.format}, Format(2)=${axis2.format}, Unit(1)="", Unit(2)=""`);
                } else {
                    AST.set(tempWcsInfo, `Format(1)=${axis1.format}, Format(2)=${axis2.format}, Unit(1)=${axis1.unit}, Unit(2)=${axis2.unit}`);
                }
            }

            if (settings.labels.hasCustomText) {
                // Disable the PV image labels when custom labels are set
                AST.set(tempWcsInfo, `Unit(1)="", Unit(2)=""`);
            }

            const plot = (styleString: string) => {
                AST.plot(
                    tempWcsInfo,
                    frameView.xMin,
                    frameView.xMax,
                    frameView.yMin / effectiveAspectRatio,
                    frameView.yMax / effectiveAspectRatio,
                    this.props.overlayStore.viewWidth * appStore.pixelRatio,
                    this.props.overlayStore.viewHeight * appStore.pixelRatio,
                    padding.left * appStore.pixelRatio,
                    padding.right * appStore.pixelRatio,
                    padding.top * appStore.pixelRatio,
                    padding.bottom * appStore.pixelRatio,
                    styleString
                );
            };

            let currentStyleString = this.props.overlayStore.styleString(frame);

            // Override the AST tolerance during motion
            if (frame.isMoving) {
                const tolVal = Math.max((settings.global.tolerance * 2) / 100.0, 0.1);
                currentStyleString += `, Tol=${tolVal}`;
            }

            if (!frame.isValidWcs) {
                //Remove system and format entries
                currentStyleString = currentStyleString.replace(/System=.*?,/, "").replaceAll(/Format\(\d\)=.*?,/g, "");
            }

            if (!settings.title.hasCustomText) {
                currentStyleString += `, Title="${this.props.image?.store?.filename.replace(/%/g, "%%%%").replace(/"/g, "”")}"`;
            } else if (this.props.image?.store?.titleCustomText?.length) {
                currentStyleString += `, Title="${this.props.image?.store?.titleCustomText.replace(/%/g, "%%%%").replace(/"/g, "”")}"`;
            } else {
                currentStyleString += `, Title=${""}`;
            }

            if (frame.isOffsetCoord) {
                currentStyleString += `, LabelUnits=1`;
            }

            plot(currentStyleString);

            if (/No grid curves can be drawn for axis/.test(AST.getLastErrorMessage())) {
                // Try to re-plot without the grid
                plot(currentStyleString.replace(/Gap\(\d\)=[^,]+, ?/g, "").replace("Grid=1", "Grid=0"));
            }

            AST.deleteObject(tempWcsInfo);
            AST.clearLastErrorMessage();

            if (this.props.channelMapDrawFunction) {
                this.props.channelMapDrawFunction(this.canvas);
            }
        }
    };

    throttledRenderCanvas = _.throttle(this.renderCanvas, 50);

    private getRef = ref => {
        this.canvas = ref;
    };

    render() {
        const frame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image.store?.baseFrame : this.props.image?.store;

        if (!frame) {
            return null;
        }

        const refFrame = frame.spatialReference ?? frame;
        // changing the frame view, padding or width/height triggers a re-render

        const w = this.props.overlayStore.viewWidth;
        const h = this.props.overlayStore.viewHeight;
        // Dummy variables for triggering re-render
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const styleString = this.props.overlayStore.styleString;
        const frameView = refFrame.requiredFrameView;
        const framePadding = this.props.overlayStore.padding;
        const isMoving = frame.isMoving;
        const system = this.props.overlaySettings.global.system;
        const globalColor = this.props.overlaySettings.global.color;
        const titleColor = this.props.overlaySettings.title.color;
        const gridColor = this.props.overlaySettings.grid.color;
        const borderColor = this.props.overlaySettings.border.color;
        const oticksColor = this.props.overlaySettings.ticks.color;
        const axesColor = this.props.overlaySettings.axes.color;
        const numbersColor = this.props.overlaySettings.numbers.color;
        const labelsColor = this.props.overlaySettings.labels.color;
        const isDarkTheme = AppStore.Instance.isDarkTheme;
        const title = this.props.overlaySettings.title.hasCustomText ? this.props.image?.store?.titleCustomText : this.props.image?.store?.filename;
        const ratio = AppStore.Instance.imageRatio;
        const isRaDecReference = this.props.overlaySettings.labels.hasRaDecReference;
        const titleStyleString = this.props.overlaySettings.title.styleString;
        const gridStyleString = this.props.overlaySettings.grid.styleString;
        const borderStyleString = this.props.overlaySettings.border.styleString;
        const ticksStyleString = this.props.overlaySettings.ticks.styleString;
        const axesStyleString = this.props.overlaySettings.axes.styleString;
        const numbersStyleString = this.props.overlaySettings.numbers.styleString;
        const labelsStyleString = this.props.overlaySettings.labels.styleString;
        const channelMapStartChannel = AppStore.Instance.channelMapStore.startChannel;
        const channelMapNumColumns = AppStore.Instance.channelMapStore.numColumns;
        const channelMapNumRows = AppStore.Instance.channelMapStore.numRows;
        const channelMapChannelNum = AppStore.Instance.channelMapStore.numChannels;
        const isOffsetCoord = frame.isOffsetCoord;
        const skyRefIs = frame.skyRefIs;
        const offsetWcs = frame.wcsInfoOffset;

        if (frame.isSwappedZ) {
            const requiredChannel = frame.requiredChannel;
        }
        /* eslint-enable @typescript-eslint/no-unused-vars */
        // Trigger switching AST overlay axis for PV image and swapped Z
        /* eslint-disable @typescript-eslint/no-unused-vars */
        const isRestFrameActive = frame.isRestFrameActive;
        const restFrameRedshift = frame.restFrameRedshift;
        const spectralType = frame.spectralType;
        const spectralUnit = frame.spectralUnit;
        const spectralSystem = frame.spectralSystem;
        const restFreqInHz = frame.restFreqStore?.restFreqInHz;

        if (!(frame.isPVImage && frame.spectralAxis?.valid) && !(frame.isSwappedZ && frame.spectralAxis?.valid)) {
            // Keep dummy variable reads for MobX dependency tracking
            const formatStringX = this.props.overlaySettings.numbers.formatStringX;
            const formatStringY = this.props.overlaySettings.numbers.formatStringY;
            const explicitSystem = this.props.overlaySettings.global.explicitSystem;
            const isWcsCoordinates = OverlaySettings.Instance.isWcsCoordinates;
        }
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const className = classNames("overlay-canvas", {docked: this.props.isDocked});

        return <canvas className={className} style={{top: this.props.top || 0, left: this.props.left || 0, width: w, height: h}} id="overlay-canvas" ref={this.getRef} key={`overlay-canvas-${frame.frameInfo.fileId}`} />;
    }
}
