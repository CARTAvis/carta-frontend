import * as React from "react";
import * as AST from "ast_wrapper";
import * as _ from "lodash";
import {observer} from "mobx-react";
import {FrameStore, OverlayStore} from "stores";
import {CursorInfo} from "models";
import "./OverlayComponent.css";

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
            this.updateImageDimensions();
            AST.setCanvas(this.canvas);

            const plot = (styleString: string) => {
                AST.plot(
                    frame.wcsInfo,
                    frame.requiredFrameView.xMin, frame.requiredFrameView.xMax,
                    frame.requiredFrameView.yMin, frame.requiredFrameView.yMax,
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

            AST.clearLastErrorMessage();
        }
    }, 50);

    render() {
        const styleString = this.props.overlaySettings.styleString;

        // changing the frame view, padding or width/height triggers a re-render
        const frameView = this.props.frame.requiredFrameView;
        const framePadding = this.props.overlaySettings.padding;
        const w = this.props.overlaySettings.viewWidth;
        const h = this.props.overlaySettings.viewHeight;
        const moving = this.props.frame.moving;

        let className = "overlay-canvas";
        if (this.props.docked) {
            className += " docked";
        }
        return <canvas className={className} id="overlay-canvas" key={styleString} ref={(ref) => this.canvas = ref}/>;
    }
}
