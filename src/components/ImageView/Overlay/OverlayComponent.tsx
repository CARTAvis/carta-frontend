import * as React from "react";
import {Colors} from "@blueprintjs/core";
import * as AST from "../../../wrappers/ast_wrapper";
import {LabelType, OverlaySettings} from "../../../Models/OverlaySettings";

export class OverlayComponentProps {
    astReady: boolean;
    width: number;
    height: number;
    settings: OverlaySettings;
}

export class OverlayComponent extends React.Component<OverlayComponentProps> {

    canvas: HTMLCanvasElement;

    componentDidMount() {
        if (this.canvas) {
            this.updateCanvas();
        }
    }

    componentDidUpdate() {
        if (this.canvas) {
            this.updateCanvas();
        }
    }

    updateCanvas = () => {
        const settings = this.props.settings;

        this.canvas.width = this.props.width * devicePixelRatio;
        this.canvas.height = this.props.height * devicePixelRatio;

        if (this.props.astReady) {
            AST.setPalette([         // AST color index:
                Colors.BLACK,        // 0
                Colors.WHITE,        // 1
                Colors.RED3,         // 2
                Colors.GREEN3,       // 3
                Colors.BLUE3,        // 4
                Colors.TURQUOISE3,   // 5
                Colors.VERMILION3,   // 6
                Colors.GOLD3,        // 7
                Colors.LIGHT_GRAY3   // 8
            ]);
            let fontSize = 18 * devicePixelRatio;
            let padding = 65;
            const displayTitle = settings.title.visible;
            const displayLabelText = settings.axes.labelVisible;
            const displayNumText = (settings.axes.numberVisible !== false) && settings.labelType !== LabelType.Interior;
            const minSize = Math.min(this.canvas.width, this.canvas.height);
            const scalingStartSize = 600;
            if (minSize < scalingStartSize) {
                fontSize = Math.max(10, minSize / scalingStartSize * fontSize);
                padding = Math.max(15, minSize / scalingStartSize * padding);
                console.log(fontSize);
            }
            AST.setFont(`${fontSize}px sans-serif`);

            AST.setCanvas(this.canvas);
            const paddingRatios = [
                (displayLabelText ? 0.4 : 0) + (displayNumText ? 0.6 : 0),
                0.2,
                (displayTitle ? 1.0 : 0.2),
                (displayLabelText ? 0.4 : 0) + (displayNumText ? 0.6 : 0)
            ];

            AST.plot(
                0, this.props.width - padding * (paddingRatios[0] + paddingRatios[1]),
                0, this.props.height - padding * (paddingRatios[2] + paddingRatios[3]),
                this.props.width * devicePixelRatio, this.props.height * devicePixelRatio,
                paddingRatios[0] * padding * devicePixelRatio, paddingRatios[1] * padding * devicePixelRatio,
                paddingRatios[2] * padding * devicePixelRatio, paddingRatios[3] * padding * devicePixelRatio,
                this.props.settings.stringify());
        }
    };

    render() {
        const backgroundColor = "#F2F2F2";
        return <canvas ref={(ref) => this.canvas = ref} style={{width: "100%", height: "100%", backgroundColor: backgroundColor}}/>;
    }
}