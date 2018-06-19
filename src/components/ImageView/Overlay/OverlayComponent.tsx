import * as React from "react";
import {Colors} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {LabelType, OverlayState} from "../../../states/OverlayState";
import {observer} from "mobx-react";
import {CursorInfo} from "../../../models/CursorInfo";

export class OverlayComponentProps {
    wcsInfo: number;
    width: number;
    height: number;
    overlaySettings: OverlayState;
    onCursorMoved?: (cursorInfo: CursorInfo) => void;
}

@observer
export class OverlayComponent extends React.Component<OverlayComponentProps> {
    canvas: HTMLCanvasElement;
    padding = [0, 0, 0, 0];
    imageBounds1 = {x: 0, y: 0};
    imageBounds2 = {x: 1, y: 1};

    componentDidMount() {
        if (this.canvas) {
            if (this.props.wcsInfo) {
                this.updateImageDimensions();
            }
            this.renderCanvas();
        }
    }

    componentDidUpdate() {
        if (this.canvas) {
            if (this.props.wcsInfo) {
                this.updateImageDimensions();
            }
            this.renderCanvas();
        }
    }

    handleMouseMove = (ev: React.MouseEvent<HTMLCanvasElement>) => {
        const cursorPosCanvasSpace = {x: ev.nativeEvent.offsetX, y: ev.nativeEvent.offsetY};
        if (this.props.wcsInfo) {
            const LT = {x: this.padding[0], y: this.padding[2]};
            const RB = {x: this.props.width - this.padding[1], y: this.props.height - this.padding[3]};
            const cursorPosImageSpace = {
                x: ((cursorPosCanvasSpace.x - LT.x) / (RB.x - LT.x)) * (this.imageBounds2.x - this.imageBounds1.x) + this.imageBounds1.x,
                // y coordinate is flipped in image space
                y: ((cursorPosCanvasSpace.y - LT.y) / (RB.y - LT.y)) * (this.imageBounds1.y - this.imageBounds2.y) + this.imageBounds2.y
            };
            const cursorPosWCS = AST.pixToWCS(this.props.wcsInfo, cursorPosImageSpace.x, cursorPosImageSpace.y);
            const cursorPosFormatted = AST.getFormattedCoordinates(this.props.wcsInfo, cursorPosWCS.x, cursorPosWCS.y, "Format(1) = d.1, Format(2) = d.1");
            if (this.props.onCursorMoved) {
                this.props.onCursorMoved({
                    posCanvasSpace: cursorPosCanvasSpace,
                    posImageSpace: cursorPosImageSpace,
                    posWCS: cursorPosWCS,
                    infoWCS: cursorPosFormatted
                });
            }
        }
    };

    updateImageDimensions() {
        this.canvas.width = this.props.width * devicePixelRatio;
        this.canvas.height = this.props.height * devicePixelRatio;

        const settings = this.props.overlaySettings;
        const displayTitle = settings.title.visible;
        const displayLabelText = settings.axis.map((axis) => {
            if (axis.labelVisible !== undefined) {
                return axis.labelVisible;
            }
            return settings.axes.labelVisible !== false;
        });
        const displayNumText = settings.axis.map((axis) => {
            if (settings.labelType === LabelType.Interior) {
                return false;
            }
            if (axis.numberVisible !== undefined) {
                return axis.numberVisible;
            }
            return settings.axes.numberVisible !== false;
        });

        let paddingSize = 65;
        const minSize = Math.min(this.canvas.width, this.canvas.height);
        const scalingStartSize = 600;
        if (minSize < scalingStartSize) {
            paddingSize = Math.max(15, minSize / scalingStartSize * paddingSize);
        }
        const paddingRatios = [
            Math.max(0.2, (displayLabelText[1] ? 0.5 : 0) + (displayNumText[1] ? 0.6 : 0)),
            0.2,
            (displayTitle ? 1.0 : 0.2),
            Math.max(0.2, (displayLabelText[0] ? 0.4 : 0) + (displayNumText[0] ? 0.6 : 0))
        ];

        this.imageBounds2.x = this.props.width - paddingSize * (paddingRatios[0] + paddingRatios[1]);
        this.imageBounds2.y = this.props.height - paddingSize * (paddingRatios[2] + paddingRatios[3]);
        this.imageBounds1 = {x: 0, y: 0};
        this.padding = paddingRatios.map(r => r * paddingSize * devicePixelRatio);
    }

    renderCanvas = () => {
        const settings = this.props.overlaySettings;

        if (this.props.wcsInfo) {
            // Set default AST palette
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

            AST.setCanvas(this.canvas);
            AST.plot(
                this.props.wcsInfo,
                this.imageBounds1.x, this.imageBounds2.x,
                this.imageBounds1.y, this.imageBounds2.y,
                this.props.width * devicePixelRatio, this.props.height * devicePixelRatio,
                this.padding[0], this.padding[1], this.padding[2], this.padding[3],
                settings.styleString);
        }
    };

    render() {
        const backgroundColor = "#F2F2F2";
        const styleString = this.props.overlaySettings.styleString;
        return <canvas key={styleString} ref={(ref) => this.canvas = ref} style={{width: "100%", height: "100%", backgroundColor: backgroundColor}} onMouseMove={this.handleMouseMove}/>;
    }
}