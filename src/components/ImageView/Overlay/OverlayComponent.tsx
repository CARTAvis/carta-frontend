import * as React from "react";
import * as AST from "ast_wrapper";
import classNames from "classnames";
import * as _ from "lodash";
import {observer} from "mobx-react";

import {CursorInfo, ImageItem, ImageType, SPECTRAL_TYPE_STRING} from "models";
import {AppStore, OverlayStore, PreferenceStore} from "stores";

import "./OverlayComponent.scss";

export class OverlayComponentProps {
    overlaySettings: OverlayStore;
    image: ImageItem;
    docked: boolean;
    top?: number;
    left?: number;
    refCanvas?: any;
    onClicked?: (cursorInfo: CursorInfo) => void;
    onZoomed?: (cursorInfo: CursorInfo, delta: number) => void;
    thisIs?: "left" | "bottom" | "corner" | "inner";
    width?: number;
    height?: number;
    type?: "channel-map-inner" | "channel-map-outer";
    unScaled?: boolean;
}

@observer
export class OverlayComponent extends React.Component<OverlayComponentProps> {
    canvas: HTMLCanvasElement;

    componentDidMount() {
        this.updateImage();
    }

    componentDidUpdate() {
        this.updateImage();
    }

    componentWillUnmount(): void {
        if (this.props.refCanvas) {
            const destCanvas = this.canvas.getContext("2d");
            const w = this.props.refCanvas.width;
            const h = this.props.refCanvas.height;
            destCanvas.clearRect(0, 0, w, h);
        }
    }

    updateImage() {
        AppStore.Instance.resetImageRatio();
        if (this.canvas && !this.props.refCanvas) {
            if (PreferenceStore.Instance.limitOverlayRedraw) {
                this.throttledRenderCanvas();
            } else {
                requestAnimationFrame(this.renderCanvas);
            }
        }
    }

    updateImageDimensions() {
        if (this.canvas) {
            this.canvas.width = (this.props.width ?? this.props.overlaySettings.viewWidth) * devicePixelRatio * AppStore.Instance.imageRatio;
            this.canvas.height = (this.props.height ?? this.props.overlaySettings.viewHeight) * devicePixelRatio * AppStore.Instance.imageRatio;
        }
    }

    renderCanvas = () => {
        const settings = this.props.overlaySettings;
        const frame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image.store?.baseFrame : this.props.image?.store;
        const appStore = AppStore.Instance;
        const padding = this.props.type === "channel-map-inner" ? settings.channelMapInnerPadding(this.props.thisIs) : settings.padding;

        const wcsInfoSelected = frame.isOffsetCoord ? frame.wcsInfoShifted : frame.wcsInfo;
        const wcsInfo = frame.spatialReference ? frame.transformedWcsInfo : wcsInfoSelected;
        const frameView = this.props.unScaled
            ? {
                  xMin: padding.left * appStore.pixelRatio,
                  xMax: (this.props.width ?? this.props.overlaySettings.viewWidth) * appStore.pixelRatio - padding.right * appStore.pixelRatio,
                  yMin: padding.bottom * appStore.pixelRatio,
                  yMax: (this.props.height ?? this.props.overlaySettings.viewHeight) * appStore.pixelRatio - padding.top * appStore.pixelRatio,
                  mip: 1
              }
            : frame.spatialReference
              ? frame.spatialReference.requiredFrameView
              : frame.requiredFrameView;
        if (wcsInfo && frameView && this.canvas && !this.props.refCanvas) {
            // Take aspect ratio scaling into account
            const tempWcsInfo = AST.copy(wcsInfo);
            if (!tempWcsInfo) {
                console.log("Create wcs info copy failed.");
                return;
            }

            this.updateImageDimensions();
            AST.setCanvas(this.canvas);
            if (!frame.hasSquarePixels) {
                const scaleMapping = AST.scaleMap2D(1.0, 1.0 / frame.aspectRatio);
                const newFrame = AST.frame(2, "Domain=PIXEL");
                AST.addFrame(tempWcsInfo, 1, scaleMapping, newFrame);
                AST.setI(tempWcsInfo, "Base", 3);
                AST.setI(tempWcsInfo, "Current", 2);
            }

            if (frame.isOffsetCoord) {
                const fovSizeInArcsec = frame.getWcsSizeInArcsec(frame.fovSize);
                const viewSize = fovSizeInArcsec.x > fovSizeInArcsec.y ? fovSizeInArcsec.y : fovSizeInArcsec.x;
                const factor = 2; // jump factor
                let unit;
                let format;

                if (viewSize < 60 * factor) {
                    unit = "arcsec";
                    format = "s.*";
                } else if (viewSize < 3600 * factor) {
                    unit = "arcmin";
                    format = "m.*";
                } else {
                    unit = "deg";
                    format = "d.*";
                }

                AST.set(tempWcsInfo, `Format(1)=${format}, Format(2)=${format}, Unit(1)=${unit}, Unit(2)=${unit}`);
            }

            const plot = (styleString: string) => {
                AST.plot(
                    tempWcsInfo,
                    frameView.xMin,
                    frameView.xMax,
                    frameView.yMin / frame.aspectRatio,
                    frameView.yMax / frame.aspectRatio,
                    (this.props.width ?? this.props.overlaySettings.viewWidth) * appStore.pixelRatio,
                    (this.props.height ?? this.props.overlaySettings.viewHeight) * appStore.pixelRatio,
                    padding.left * appStore.pixelRatio,
                    padding.right * appStore.pixelRatio,
                    padding.top * appStore.pixelRatio,
                    padding.bottom * appStore.pixelRatio,
                    styleString
                );
            };

            let currentStyleString;

            if (this.props.type === "channel-map-inner") {
                currentStyleString = settings.channelMapInnerStyleString(frame);
            } else if (this.props.type === "channel-map-outer") {
                currentStyleString = settings.channelMapOuterStyleString(frame);
            } else {
                currentStyleString = settings.styleString(frame);
            }

            // Override the AST tolerance during motion
            if (frame.moving) {
                const tolVal = Math.max((settings.global.tolerance * 2) / 100.0, 0.1);
                currentStyleString += `, Tol=${tolVal}`;
            }

            if (!frame.validWcs) {
                //Remove system and format entries
                currentStyleString = currentStyleString.replace(/System=.*?,/, "").replaceAll(/Format\(\d\)=.*?,/g, "");
            }

            if (!settings.title.customText) {
                currentStyleString += `, Title=${this.props.image?.store?.filename}`;
            } else if (this.props.image?.store?.titleCustomText?.length) {
                currentStyleString += `, Title=${this.props.image?.store?.titleCustomText}`;
            } else {
                currentStyleString += `, Title=${""}`;
            }

            if (frame.isOffsetCoord) {
                currentStyleString += `, LabelUnits=1`;
            }

            plot(currentStyleString);
            console.log(this.canvas.id, currentStyleString);
            // Outer Labelling=Exterior, Color=0, Tol=0.02, DrawTitle=0, Font(Title)=2, Size(Title)=18, Grid=0, Width(Grid)=1, Border=0, Width(Border)=1, TickAll=1, Width(Ticks)=1, MinTickLen=0.00, MajTickLen=0.00, DrawAxes=0, Width(Axes)=1, NumLab=0, Font(NumLab)=0, Size(NumLab)=12, TextLab=1, Font(TextLab)=0, Size(TextLab)=15, LabelUp=0, TitleGap=0, NumLabGap=0, TextLabGap=0.018808777429467086, TextGapType=plot, Title=S255_IR_sci.spw29.cube.I.pbcor.fits

            // Inner Labelling=Exterior, Color=0, Tol=0.02, System=ICRS, Equinox=2000, DrawTitle=0, Font(Title)=2, Size(Title)=18, Grid=0, Width(Grid)=1, Border=1, Width(Border)=1, TickAll=1, Width(Ticks)=1, MinTickLen=0.01, MajTickLen=0.02, DrawAxes=0, Width(Axes)=1, NumLab=1, Font(NumLab)=0, Size(NumLab)=12, TextLab=0, Font(TextLab)=0, Size(TextLab)=15, LabelUp=0, TitleGap=0.012861736334405145, NumLabGap=0.006430868167202572, TextLabGap=0.05144694533762058, TextGapType=plot, Title=S255_IR_sci.spw29.cube.I.pbcor.fits

            // Regular Labelling=Exterior, Color=0, Tol=0.02, System=ICRS, Equinox=2000, DrawTitle=0, Font(Title)=2, Size(Title)=18, Grid=0, Width(Grid)=1, Border=1, Width(Border)=1, TickAll=1, Width(Ticks)=1, MinTickLen=0.01, MajTickLen=0.02, DrawAxes=0, Width(Axes)=1, NumLab=1, Font(NumLab)=0, Size(NumLab)=12, TextLab=1, Font(TextLab)=0, Size(TextLab)=15, LabelUp=0, TitleGap=0.016181229773462782, NumLabGap=0.008090614886731391, TextLabGap=0.03559870550161812, TextGapType=plot, Title=S255_IR_sci.spw29.cube.I.pbcor.fits

            if (/No grid curves can be drawn for axis/.test(AST.getLastErrorMessage())) {
                // Try to re-plot without the grid
                plot(currentStyleString.replace(/Gap\(\d\)=[^,]+, ?/g, "").replace("Grid=1", "Grid=0"));
            }

            AST.deleteObject(tempWcsInfo);
            AST.clearLastErrorMessage();
        }
    };

    throttledRenderCanvas = _.throttle(this.renderCanvas, 50);

    private getRef = ref => {
        this.canvas = ref;
    };

    render() {
        const frame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image.store?.baseFrame : this.props.image?.store;
        const refFrame = frame.spatialReference ?? frame;
        // changing the frame view, padding or width/height triggers a re-render

        const w = this.props.width ?? this.props.overlaySettings?.viewWidth;
        const h = this.props.height ?? this.props.overlaySettings?.viewHeight;
        // Dummy variables for triggering re-render
        /* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
        const styleString = this.props.overlaySettings.styleString;
        const frameView = refFrame.requiredFrameView;
        const framePadding = this.props.overlaySettings.padding;
        const moving = frame.moving;
        const system = this.props.overlaySettings.global.system;
        const globalColor = this.props.overlaySettings.global.color;
        const titleColor = this.props.overlaySettings.title.color;
        const gridColor = this.props.overlaySettings.grid.color;
        const borderColor = this.props.overlaySettings.border.color;
        const oticksColor = this.props.overlaySettings.ticks.color;
        const axesColor = this.props.overlaySettings.axes.color;
        const numbersColor = this.props.overlaySettings.numbers.color;
        const labelsColor = this.props.overlaySettings.labels.color;
        const darktheme = AppStore.Instance.darkTheme;
        const title = this.props.overlaySettings.title.customText ? this.props.image?.store?.titleCustomText : this.props.image?.store?.filename;
        const ratio = AppStore.Instance.imageRatio;
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
        const channelMapMasterFrame = AppStore.Instance.channelMapStore.masterFrame;
        const channelMapChannelNum = AppStore.Instance.channelMapStore.numChannels;
        const channelMapShowChannelString = AppStore.Instance.channelMapStore.showChannelString;
        const channelMapShowChannelStringLabel = AppStore.Instance.channelMapStore.showChannelStringLabel;
        const channelMapShowSpectralString = AppStore.Instance.channelMapStore.showSpectralString;
        const channelMapShowSpectralStringLabel = AppStore.Instance.channelMapStore.showSpectralStringLabel;
        const channelMapShowVelocityString = AppStore.Instance.channelMapStore.showVelocityString;
        const channelMapShowVelocityStringLabel = AppStore.Instance.channelMapStore.showVelocityStringLabel;
        const offsetCoord = frame.isOffsetCoord;
        const offsetWcs = frame.wcsInfoShifted;

        if (!this.props.refCanvas) {
            if (frame.isSwappedZ) {
                const requiredChannel = frame.requiredChannel;
            }
            /* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

            // Trigger switching AST overlay axis for PV image
            const spectralAxisSetting =
                `${frame.spectralType ? `System(${frame.spectral})=${frame.spectralType},` : ""}` +
                `${frame.spectralUnit ? `Unit(${frame.spectral})=${frame.spectralUnit},` : ""}` +
                `${frame.spectralSystem ? `StdOfRest=${frame.spectralSystem},` : ""}` +
                `${frame.restFreqStore.restFreqInHz ? `RestFreq=${frame.restFreqStore.restFreqInHz} Hz,` : ""}` +
                `${frame.spectralType && frame.spectralSystem ? `Label(${frame.spectral})=[${frame.spectralSystem}] ${SPECTRAL_TYPE_STRING.get(frame.spectralType)},` : ""}`;

            const dirAxesSetting = `${frame.dirX > 2 || frame.dirXLabel === "" ? "" : `Label(${frame.dirX})=${frame.dirXLabel},`} ${frame.dirY > 2 || frame.dirYLabel === "" ? "" : `Label(${frame.dirY})=${frame.dirYLabel},`}`;

            if (frame.isPVImage && frame.spectralAxis?.valid) {
                AST.set(frame.wcsInfo, spectralAxisSetting);
            } else if (frame.isSwappedZ && frame.spectralAxis?.valid) {
                AST.set(frame.wcsInfo, spectralAxisSetting + dirAxesSetting);
            } else {
                const formatStringX = this.props.overlaySettings.numbers.formatStringX;
                const formatStyingY = this.props.overlaySettings.numbers.formatStringY;
                const explicitSystem = this.props.overlaySettings.global.explicitSystem;
                if (formatStringX !== undefined && formatStyingY !== undefined && explicitSystem !== undefined) {
                    AST.set(frame.wcsInfo, `Format(${frame.dirX})=${formatStringX}, Format(${frame.dirY})=${formatStyingY}, System=${explicitSystem},` + dirAxesSetting);
                }
            }
        }

        const className = classNames("overlay-canvas", {docked: this.props.docked});

        return (
            <>
                <canvas
                    className={className}
                    style={{top: this.props.top || 0, left: this.props.left || 0, width: w, height: h, border: "1px solid green"}}
                    id="overlay-canvas"
                    ref={this.getRef}
                    key={`overlay-canvas-${frame.frameInfo.fileId}`}
                />
            </>
        );
    }
}

/* Fix channel map overlay problem
    Global:
        In enable multi-panel, the preferenceStore.channelMapEnabled should be changed accordingly.
        In multi-panel, there are raster bug. Might be related to viewWidth and height not changing.
        Changing interior and exterior labelling do not update.
    Title:
        When title is enabled in channel map, it should not be rendered for each channel view.
    Border:
        Border is not shown for top and right because of base = 0 for overlayStore.
    Number:
        Number toggle is not working.
        Font and font size are not working.
        Color is not working.
        Precision is not working.
    Label:
        Nothing is working.
    Colorbar:
        The tick mark is not extended to the entire colorbar.
*/
