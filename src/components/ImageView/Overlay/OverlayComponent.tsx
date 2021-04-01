import * as React from "react";
import * as AST from "ast_wrapper";
import * as _ from "lodash";
import {observer} from "mobx-react";
import {AppStore, FrameStore, OverlayStore} from "stores";
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
            this.renderCanvas();
        }
    }

    componentDidUpdate() {
        if (this.canvas) {
            this.renderCanvas();
        }
    }

    updateImageDimensions() {
        this.canvas.width = this.props.overlaySettings.viewWidth * devicePixelRatio;
        this.canvas.height = this.props.overlaySettings.viewHeight * devicePixelRatio;
    }

    renderCanvas = _.throttle(() => {
        const settings = this.props.overlaySettings;
        const frame = this.props.frame;
        const pixelRatio = devicePixelRatio;

        if (frame.wcsInfo) {
            const wcsInfo = frame.spatialReference ? frame.transformedWcsInfo : frame.wcsInfo;
            const frameView = frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;

            this.updateImageDimensions();
            AST.setCanvas(this.canvas);

            // Take aspect ratio scaling into account
            let tempWcsInfo = AST.copy(wcsInfo);

            if (frame.aspectRatio !== 1.0) {
                const scaleMapping = AST.scaleMap2D(1.0, 1.0 / frame.aspectRatio);
                const newFrame = AST.frame(2, "Domain=PIXEL");
                AST.addFrame(tempWcsInfo, 1, scaleMapping, newFrame);
                AST.setI(tempWcsInfo, "Base", 3);
                AST.setI(tempWcsInfo, "Current", 2);
            }

            const plot = (styleString: string) => {
                AST.plot(
                    tempWcsInfo,
                    frameView.xMin, frameView.xMax,
                    frameView.yMin / frame.aspectRatio, frameView.yMax / frame.aspectRatio,
                    settings.viewWidth * pixelRatio, settings.viewHeight * pixelRatio,
                    settings.padding.left * pixelRatio, settings.padding.right * pixelRatio, settings.padding.top * pixelRatio, settings.padding.bottom * pixelRatio,
                    styleString);
            };

            let currentStyleString = settings.styleString;
            // Override the AST tolerance during motion
            if (frame.moving) {
                const tolVal = Math.max(settings.global.tolerance * 2 / 100.0, 0.1);
                currentStyleString += `, Tol=${tolVal}`;
            }

            plot(currentStyleString);

            if (/No grid curves can be drawn for axis/.test(AST.getLastErrorMessage())) {
                // Try to re-plot without the grid
                plot(currentStyleString.replace(/Gap\(\d\)=[^,]+, ?/g, "").replace("Grid=1", "Grid=0"));
            }

            AST.delete(tempWcsInfo);
            AST.clearLastErrorMessage();
        }
    }, 50);

    render() {
        const styleString = this.props.overlaySettings.styleString;

        const frame = this.props.frame;
        const refFrame = frame.spatialReference || frame;
        // changing the frame view, padding or width/height triggers a re-render

        // Dummy variables for triggering re-render
        /* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
        const frameView = refFrame.requiredFrameView;
        const framePadding = this.props.overlaySettings.padding;
        const w = this.props.overlaySettings.viewWidth;
        const h = this.props.overlaySettings.viewHeight;
        const moving = frame.moving;
        const globalColor = this.props.overlaySettings.global.color;
        const titleColor = this.props.overlaySettings.title.color;
        const gridColor = this.props.overlaySettings.grid.color;
        const borderColor = this.props.overlaySettings.border.color;
        const oticksColor = this.props.overlaySettings.ticks.color;
        const axesColor = this.props.overlaySettings.axes.color;
        const numbersColor = this.props.overlaySettings.numbers.color;
        const labelsColor = this.props.overlaySettings.labels.color;
        const darktheme = AppStore.Instance.darkTheme;
        /* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

        // Trigger switching AST overlay axis for PV image
        if (frame.isPVImage && frame.spectralAxis?.valid) {
            AST.set(frame.wcsInfo, `${frame.spectralType ? `System(${frame.spectralAxis.dimension})=${frame.spectralType},` : ""}` +
                                    `${frame.spectralUnit ? `Unit(${frame.spectralAxis.dimension})=${frame.spectralUnit},` : ""}` +
                                    `${frame.spectralSystem ? `StdOfRest=${frame.spectralSystem},` : ""}` +
                                    `${frame.spectralType && frame.spectralSystem ? `Label(${frame.spectralAxis.dimension})=[${frame.spectralSystem}] ${SPECTRAL_TYPE_STRING.get(frame.spectralType)},` : ""}`
            );
        }

        let className = "overlay-canvas";
        if (this.props.docked) {
            className += " docked";
        }
        return <canvas className={className} id="overlay-canvas" key={styleString} ref={(ref) => this.canvas = ref}/>;
    }
}
