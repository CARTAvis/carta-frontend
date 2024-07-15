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
    width?: number;
    height?: number;
    refCanvas?: any;
    channel?: number;
    unScaled?: boolean;
    onClicked?: (cursorInfo: CursorInfo) => void;
    onZoomed?: (cursorInfo: CursorInfo, delta: number) => void;
    thisIs?: string;
}

@observer
export class OverlayComponent extends React.Component<OverlayComponentProps> {
    canvas: HTMLCanvasElement;
    channelNumberCanvas: HTMLCanvasElement;

    componentDidMount() {
        if (this.canvas && !this.props.refCanvas) {
            if (PreferenceStore.Instance.limitOverlayRedraw) {
                this.throttledRenderCanvas();
            } else {
                requestAnimationFrame(this.renderCanvas);
            }
        } else if (this.canvas && this.props.refCanvas) {
            const destCanvas = this.canvas.getContext("2d");
            destCanvas.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    componentDidUpdate() {
        AppStore.Instance.resetImageRatio();
        const thisIs = this.props.thisIs;
        const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;
        const paddingLeft = this.props.overlaySettings.padding.left * pixelRatio;
        const paddingBottom = this.props.overlaySettings.padding.bottom * pixelRatio;
        if (this.props.refCanvas) {
            requestAnimationFrame(() => {
                this.updateImageDimensions();
                const destCanvas = this.canvas.getContext("2d");
                const w = this.props.refCanvas.width;
                const h = this.props.refCanvas.height;
                const destWidth = this.canvas.width - (thisIs === "left" || thisIs === "corner" ? 0 : paddingLeft);
                const destHeight = this.canvas.height - (thisIs === "bottom" || thisIs === "corner" ? 0 : paddingBottom);
                destCanvas.clearRect(0, 0, this.canvas.width, this.canvas.height);
                if (thisIs === "left") {
                    destCanvas.drawImage(this.props.refCanvas, 0, 0, w, h - paddingBottom, 0, 0, destWidth, destHeight);
                } else if (thisIs === "bottom") {
                    destCanvas.drawImage(this.props.refCanvas, paddingLeft, 0, w - paddingLeft, h, paddingLeft, 0, destWidth, destHeight);
                } else if (thisIs === "inner") {
                    destCanvas.drawImage(this.props.refCanvas, paddingLeft, 0, w - paddingLeft, h - paddingBottom, paddingLeft, 0, destWidth, destHeight);
                }
            });
        } else {
            if (PreferenceStore.Instance.limitOverlayRedraw) {
                this.throttledRenderCanvas();
            } else {
                requestAnimationFrame(this.renderCanvas);
            }
        }

        if (this.props.channel !== undefined && this.channelNumberCanvas) {
            requestAnimationFrame(() => {
                const destCanvas = this.channelNumberCanvas.getContext("2d");
                this.channelNumberCanvas.width = this.props.overlaySettings.viewWidth * devicePixelRatio * AppStore.Instance.imageRatio;
                this.channelNumberCanvas.height = this.props.overlaySettings.viewHeight * devicePixelRatio * AppStore.Instance.imageRatio;
                destCanvas.font = "24px Arial";
                destCanvas.fillStyle = "red";
                destCanvas.textAlign = "left";
                destCanvas.textBaseline = "top";
                destCanvas.fillText(`${this.props.channel}`, this.props.overlaySettings.paddingLeft * devicePixelRatio * AppStore.Instance.imageRatio + 10, 10);
            });
        }
    }

    componentWillUnmount(): void {
        if (this.props.refCanvas) {
            const destCanvas = this.canvas.getContext("2d");
            const w = this.props.refCanvas.width;
            const h = this.props.refCanvas.height;
            destCanvas.clearRect(0, 0, w, h);
        }
    }

    updateImageDimensions() {
        if (this.canvas) {
            this.canvas.width = this.props.overlaySettings.viewWidth * devicePixelRatio * AppStore.Instance.imageRatio;
            this.canvas.height = this.props.overlaySettings.viewHeight * devicePixelRatio * AppStore.Instance.imageRatio;
        }
    }

    renderCanvas = () => {
        const settings = this.props.overlaySettings;
        const frame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image.store?.baseFrame : this.props.image?.store;
        const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;

        const wcsInfo = frame.spatialReference ? frame.transformedWcsInfo : frame.wcsInfo;
        const frameView = this.props.unScaled
            ? {
                  xMin: settings.padding.left * pixelRatio,
                  xMax: this.props.overlaySettings.viewWidth * pixelRatio - settings.padding.right * pixelRatio,
                  yMin: settings.padding.bottom * pixelRatio,
                  yMax: this.props.overlaySettings.viewHeight * pixelRatio - settings.padding.top * pixelRatio,
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

            const plot = (styleString: string) => {
                AST.plot(
                    tempWcsInfo,
                    frameView.xMin,
                    frameView.xMax,
                    frameView.yMin / frame.aspectRatio,
                    frameView.yMax / frame.aspectRatio,
                    this.props.overlaySettings.viewWidth * pixelRatio,
                    this.props.overlaySettings.viewHeight * pixelRatio,
                    settings.padding.left * pixelRatio,
                    settings.padding.right * pixelRatio,
                    settings.padding.top * pixelRatio,
                    settings.padding.bottom * pixelRatio,
                    styleString,
                    frame.distanceMeasuring?.showCurve,
                    frame.isPVImage,
                    frame.distanceMeasuring?.transformedStart?.x,
                    frame.distanceMeasuring?.transformedStart?.y,
                    frame.distanceMeasuring?.transformedFinish?.x,
                    frame.distanceMeasuring?.transformedFinish?.y
                );
            };

            let currentStyleString = settings.styleString(frame);

            // console.log('frameView', frameView)

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

            plot(currentStyleString);

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
        if (ref?.id === "channel-number-canvas") {
            this.channelNumberCanvas = ref;
        } else {
            this.canvas = ref;
        }
    };

    render() {
        const frame = this.props.image?.type === ImageType.COLOR_BLENDING ? this.props.image.store?.baseFrame : this.props.image?.store;
        const refFrame = frame.spatialReference ?? frame;
        // changing the frame view, padding or width/height triggers a re-render

        const w = this.props.overlaySettings?.viewWidth;
        const h = this.props.overlaySettings?.viewHeight;
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
        const distanceMeasuring = frame.distanceMeasuring;
        const distanceMeasuringShowCurve = frame.distanceMeasuring?.showCurve;
        const distanceMeasuringStart = frame.distanceMeasuring?.start;
        const distanceMeasuringFinish = frame.distanceMeasuring?.finish;
        const distanceMeasuringTransformedStart = frame.distanceMeasuring?.transformedStart;
        const distanceMeasuringTransformedFinish = frame.distanceMeasuring?.transformedFinish;
        const distanceMeasuringColor = frame.distanceMeasuring?.color;
        const distanceMeasuringFontSize = frame.distanceMeasuring?.fontSize;
        const distanceMeasuringLineWidth = frame.distanceMeasuring?.lineWidth;
        const title = this.props.overlaySettings.title.customText ? frame.titleCustomText : frame.filename;
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
                <canvas className={className} style={{top: this.props.top || 0, left: this.props.left || 0, width: w, height: h}} id="overlay-canvas" ref={this.getRef} />
                <canvas className={className} style={{top: this.props.top || 0, left: this.props.left || 0, width: w, height: h}} id="channel-number-canvas" ref={this.getRef} />
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
