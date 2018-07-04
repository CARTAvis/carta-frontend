import {FrameState} from "../../../states/FrameState";
import * as React from "react";
import {observer} from "mobx-react";
import {OverlayState} from "../../../states/OverlayState";
import "./RasterViewComponent.css";

export class RasterViewComponentProps {
    overlaySettings: OverlayState;
    frame: FrameState;
}

@observer
export class RasterViewComponent extends React.Component<RasterViewComponentProps> {
    private canvas: HTMLCanvasElement;
    private canvasContext: CanvasRenderingContext2D;

    componentDidMount() {
        if (this.canvas) {
            this.canvasContext = this.canvas.getContext("2d");
            this.updateCanvas();
        }
    }

    componentDidUpdate() {
        if (this.canvas) {
            this.updateCanvas();
        }
    }

    private updateCanvas = () => {
        const frame = this.props.frame;
        this.canvas.width = frame.renderWidth;
        this.canvas.height = frame.renderHeight;
        this.canvasContext.save();
        this.canvasContext.scale(1, -1);
        this.canvasContext.translate(0, -this.canvas.height);
        //this.canvasContext.fillStyle = "black";
        //this.canvasContext.fillRect(0, 0, this.canvas.width - 1, this.canvas.height);
        const current = frame.currentFrameView;
        const full = frame.requiredFrameView;
        const fullWidth = full.xMax - full.xMin;
        const fullHeight = full.yMax - full.yMin;

        const LT = {x: (current.xMin - full.xMin) / fullWidth, y: (current.yMin - full.yMin) / fullHeight};
        const RB = {x: (current.xMax - full.xMin) / fullWidth, y: (current.yMax - full.yMin) / fullHeight};
        this.canvasContext.fillStyle = "red";
        this.canvasContext.fillRect(LT.x * frame.renderWidth, LT.y * frame.renderHeight, (RB.x - LT.x) * frame.renderWidth, (RB.y - LT.y) * frame.renderWidth);
        this.canvasContext.restore();
    };

    render() {
        const frame = this.props.frame;
        const frameView = frame.requiredFrameView;
        const padding = this.props.overlaySettings.padding;
        return (
            <div className="raster-div">
                <canvas
                    className="raster-canvas"
                    ref={(ref) => this.canvas = ref}
                    style={{
                        top: padding.top,
                        left: padding.left,
                        width: frame.renderWidth,
                        height: frame.renderHeight
                    }}
                />
            </div>);
    }
}