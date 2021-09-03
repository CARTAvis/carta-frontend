import * as React from "react";
import * as AST from "ast_wrapper";
import * as _ from "lodash";
import {observer} from "mobx-react";
import {AppStore, FrameStore, OverlayStore, PreferenceStore} from "stores";
import {CursorInfo, SPECTRAL_TYPE_STRING} from "models";
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
        if (PreferenceStore.Instance.limitOverlayRedraw) {
            this.throttledRenderCanvas();
        } else {
            requestAnimationFrame(this.renderCanvas);
        }
    }

    updateImageDimensions() {
        this.canvas.width = this.props.overlaySettings.viewWidth * devicePixelRatio * AppStore.Instance.exportImageRatio;
        this.canvas.height = this.props.overlaySettings.viewHeight * devicePixelRatio * AppStore.Instance.exportImageRatio;
    }

    renderCanvas = () => {
        const settings = this.props.overlaySettings;
        const frame = this.props.frame;
        const pixelRatio = devicePixelRatio * AppStore.Instance.exportImageRatio;

        const wcsInfo = frame.spatialReference ? frame.transformedWcsInfo : frame.wcsInfo;
        const frameView = frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
        if (wcsInfo && frameView) {
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
                    settings.viewWidth * pixelRatio,
                    settings.viewHeight * pixelRatio,
                    settings.padding.left * pixelRatio,
                    settings.padding.right * pixelRatio,
                    settings.padding.top * pixelRatio,
                    settings.padding.bottom * pixelRatio,
                    styleString,
                    frame.distanceMeasuring.showCurve,
                    frame.isPVImage,
                    frame.distanceMeasuring.transformedStart.x,
                    frame.distanceMeasuring.transformedStart.y,
                    frame.distanceMeasuring.transformedFinish.x,
                    frame.distanceMeasuring.transformedFinish.y
                );
            };

            let currentStyleString = settings.styleString;
            // Override the AST tolerance during motion
            if (frame.moving) {
                const tolVal = Math.max((settings.global.tolerance * 2) / 100.0, 0.1);
                currentStyleString += `, Tol=${tolVal}`;
            }

            if (!this.props.frame.validWcs) {
                //Remove system and format entries
                currentStyleString = currentStyleString.replace(/System=.*?,/, "").replaceAll(/Format\(\d\)=.*?,/g, "");
            }

            if (settings.title.customText && frame.titleCustomText?.length) {
                currentStyleString += `, Title=${frame.titleCustomText}`;
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

    render() {
        const styleString = this.props.overlaySettings.styleString;

        const frame = this.props.frame;
        const refFrame = frame.spatialReference ?? frame;
        // changing the frame view, padding or width/height triggers a re-render

        const w = this.props.overlaySettings.viewWidth;
        const h = this.props.overlaySettings.viewHeight;

        // Dummy variables for triggering re-render
        /* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
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
        const distanceMeasuringShowCurve = frame.distanceMeasuring.showCurve;
        const distanceMeasuringStart = frame.distanceMeasuring.transformedStart;
        const distanceMeasuringFinish = frame.distanceMeasuring.transformedFinish;
        const title = frame.titleCustomText;
        /* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

        // Trigger switching AST overlay axis for PV image
        if (frame.isPVImage && frame.spectralAxis?.valid) {
            AST.set(
                frame.wcsInfo,
                `${frame.spectralType ? `System(2)=${frame.spectralType},` : ""}` +
                    `${frame.spectralUnit ? `Unit(2)=${frame.spectralUnit},` : ""}` +
                    `${frame.spectralSystem ? `StdOfRest=${frame.spectralSystem},` : ""}` +
                    `${frame.spectralType && frame.spectralSystem ? `Label(2)=[${frame.spectralSystem}] ${SPECTRAL_TYPE_STRING.get(frame.spectralType)},` : ""}`
            );
        }

        let className = "overlay-canvas";
        if (this.props.docked) {
            className += " docked";
        }
        return <canvas className={className} style={{width: w, height: h}} id="overlay-canvas" key={styleString} ref={ref => (this.canvas = ref)} />;
    }
}
