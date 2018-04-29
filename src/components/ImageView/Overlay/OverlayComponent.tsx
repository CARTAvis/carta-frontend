import * as React from "react";
import {Colors} from "@blueprintjs/core";
import * as AST from "../../../wrappers/ast_wrapper";

export class OverlayComponentProps {
    astReady: boolean;
    width: number;
    height: number;
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
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;

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
            let fontSize = 16;
            let padding = 100;
            const minSize = Math.min(this.canvas.width, this.canvas.height);
            const scalingStartSize = 600;
            if (minSize < scalingStartSize) {
                fontSize = Math.max(6, minSize / scalingStartSize * fontSize);
                padding = Math.max(10, minSize / scalingStartSize * padding);
                console.log(fontSize);
            }
            AST.setFont(`${fontSize}px sans-serif`);

            AST.setCanvas(this.canvas);
            AST.plot({
                imageX1: 0, imageX2: this.canvas.width,
                imageY1: 0, imageY2: this.canvas.height,
                width: this.canvas.width, height: this.canvas.height,
                padding: padding,
                labelType: AST.LABEL_EXTERIOR,
                color: 4,
                gridColor: 2,
                sys: AST.SYS_GALACTIC
            });
        }
    };

    render() {
        const backgroundColor = "#F2F2F2";
        return <canvas ref={(ref) => this.canvas = ref} style={{width: "100%", height: "100%", backgroundColor: backgroundColor}}/>;
    }
}