import * as React from "react";
import * as AST from "ast_wrapper";
import classNames from "classnames";
import * as _ from "lodash";
import {observer} from "mobx-react";

import {CursorInfo, SPECTRAL_TYPE_STRING} from "models";
import {AppStore, OverlayStore, PreferenceStore} from "stores";
import {FrameStore} from "stores/Frame";

import "./OverlayComponent.scss";

export class OverlayComponentProps {
    overlaySettings: OverlayStore;
    frame: FrameStore;
    docked: boolean;
    onClicked?: (cursorInfo: CursorInfo) => void;
    onZoomed?: (cursorInfo: CursorInfo, delta: number) => void;
}

@observer
export class OverlayComponent extends React.Component<OverlayComponentProps> {
    canvas: HTMLCanvasElement;

    componentDidMount() {
        if (this.canvas) {
            if (PreferenceStore.Instance.limitOverlayRedraw) {
                this.throttledRenderCanvas();
            } else {
                requestAnimationFrame(this.renderCanvas);
            }
        }
    }

    componentDidUpdate() {
        AppStore.Instance.resetImageRatio();
        if (PreferenceStore.Instance.limitOverlayRedraw) {
            this.throttledRenderCanvas();
        } else {
            requestAnimationFrame(this.renderCanvas);
        }
    }

    updateImageDimensions() {
        if (this.canvas) {
            const frame = this.props.frame;
            this.canvas.width = (frame?.isPreview ? frame?.previewViewWidth : this.props.overlaySettings.viewWidth) * devicePixelRatio * AppStore.Instance.imageRatio;
            this.canvas.height = (frame?.isPreview ? frame?.previewViewHeight : this.props.overlaySettings.viewHeight) * devicePixelRatio * AppStore.Instance.imageRatio;
        }
    }

    renderCanvas = () => {
        const settings = this.props.overlaySettings;
        const frame = this.props.frame;
        const pixelRatio = devicePixelRatio * AppStore.Instance.imageRatio;

        const wcsInfo = frame.spatialReference ? frame.transformedWcsInfo : frame.wcsInfo;
        const frameView = frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
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
                    (this.props.frame.isPreview ? this.props.frame?.previewViewWidth : this.props.overlaySettings.viewWidth) * pixelRatio,
                    (this.props.frame.isPreview ? this.props.frame?.previewViewHeight : this.props.overlaySettings.viewHeight) * pixelRatio,
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

            // Override the AST tolerance during motion
            if (frame.moving) {
                const tolVal = Math.max((settings.global.tolerance * 2) / 100.0, 0.1);
                currentStyleString += `, Tol=${tolVal}`;
            }

            if (!this.props.frame.validWcs) {
                //Remove system and format entries
                currentStyleString = currentStyleString.replace(/System=.*?,/, "").replaceAll(/Format\(\d\)=.*?,/g, "");
            }

            if (!settings.title.customText) {
                currentStyleString += `, Title=${frame.filename}`;
            } else if (frame.titleCustomText?.length) {
                currentStyleString += `, Title=${frame.titleCustomText}`;
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
        this.canvas = ref;
    };

    render() {
        const frame = this.props.frame;
        const refFrame = frame.spatialReference ?? frame;
        // changing the frame view, padding or width/height triggers a re-render

        const w = frame?.isPreview ? frame?.previewViewWidth : this.props.overlaySettings.viewWidth;
        const h = frame?.isPreview ? frame?.previewViewHeight : this.props.overlaySettings.viewHeight;

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
        const formatStringX = this.props.overlaySettings.numbers.formatStringX;
        const formatStyingY = this.props.overlaySettings.numbers.formatStringY;

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

        const className = classNames("overlay-canvas", {docked: this.props.docked});
        return <canvas className={className} style={{width: w, height: h}} id="overlay-canvas" ref={this.getRef} />;
    }
}
