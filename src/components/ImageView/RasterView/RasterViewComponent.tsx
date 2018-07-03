import {FrameState} from "../../../states/FrameState";
import * as React from "react";
import {observer} from "mobx-react";
import {OverlayState} from "../../../states/OverlayState";
import "./RasterViewComponent.css";

export class RasterViewComponentProps {
    width: number;
    height: number;
    overlaySettings: OverlayState;
    frame: FrameState;
}

@observer
export class RasterViewComponent extends React.Component<RasterViewComponentProps> {
    canvas: HTMLCanvasElement;

    componentDidUpdate() {
        if (this.canvas) {
            const padding = this.props.overlaySettings.padding;
            this.canvas.width = this.props.width - padding[0] - padding[1];
            this.canvas.height = this.props.height - padding[2] - padding[3];
            console.log(`Updated canvas dimensions: ${this.canvas.width}x${this.canvas.height}`);
            this.renderCanvas();
        }
    }

    renderCanvas = () => {

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
                        top: padding[2],
                        left: padding[0],
                        width: this.props.width - padding[0] - padding[1],
                        height: this.props.height - padding[2] - padding[3]
                    }}
                />
            </div>);
    }
}