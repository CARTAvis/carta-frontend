import * as React from "react";
import {Colors} from "@blueprintjs/core";
import * as AST from "ast_wrapper";
import {LabelType, OverlayState} from "../../../states/OverlayState";
import {observer} from "mobx-react";
import {CursorInfo} from "../../../models/CursorInfo";
import {FrameState} from "../../../states/FrameState";
import {Point2D} from "../../../models/Point2D";
import "./OverlayComponent.css";

export class OverlayComponentProps {
    width: number;
    height: number;
    overlaySettings: OverlayState;
    frame: FrameState;
    onCursorMoved?: (cursorInfo: CursorInfo) => void;
    onClicked?: (cursorInfo: CursorInfo) => void;
    onZoomed?: (cursorInfo: CursorInfo, delta: number) => void;
}

@observer
export class OverlayComponent extends React.Component<OverlayComponentProps> {
    canvas: HTMLCanvasElement;
    padding = [0, 0, 0, 0];
    imageBounds1 = {x: 0, y: 0};
    imageBounds2 = {x: 1, y: 1};

    componentDidMount() {
        if (this.canvas) {
            if (this.props.frame.wcsInfo) {
                this.updateImageDimensions();
            }
            this.renderCanvas();
        }
    }

    componentDidUpdate() {
        if (this.canvas) {
            if (this.props.frame.wcsInfo) {
                this.updateImageDimensions();
            }
            this.renderCanvas();
        }
    }

    handleMouseMove = (ev: React.MouseEvent<HTMLCanvasElement>) => {
        const cursorPosCanvasSpace = {x: ev.nativeEvent.offsetX, y: ev.nativeEvent.offsetY};
        if (this.props.frame.wcsInfo && this.props.onCursorMoved) {
            this.props.onCursorMoved(this.getCursorInfo(cursorPosCanvasSpace));
        }
    };

    handleClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
        const cursorPosCanvasSpace = {x: ev.nativeEvent.offsetX, y: ev.nativeEvent.offsetY};
        if (this.props.frame.wcsInfo && this.props.onClicked) {
            this.props.onClicked(this.getCursorInfo(cursorPosCanvasSpace));
        }
    };

    handleScroll = (ev: React.WheelEvent<HTMLCanvasElement>) => {
        const cursorPosCanvasSpace = {x: ev.nativeEvent.offsetX, y: ev.nativeEvent.offsetY};
        if (this.props.frame.wcsInfo && this.props.onZoomed) {
            this.props.onZoomed(this.getCursorInfo(cursorPosCanvasSpace), ev.deltaY);
        }
    };

    private getCursorInfo(cursorPosCanvasSpace: Point2D) {
        const LT = {x: this.padding[0], y: this.padding[2]};
        const RB = {x: this.props.width - this.padding[1], y: this.props.height - this.padding[3]};
        const cursorPosImageSpace = {
            x: ((cursorPosCanvasSpace.x - LT.x) / (RB.x - LT.x)) * (this.imageBounds2.x - this.imageBounds1.x) + this.imageBounds1.x,
            // y coordinate is flipped in image space
            y: ((cursorPosCanvasSpace.y - LT.y) / (RB.y - LT.y)) * (this.imageBounds1.y - this.imageBounds2.y) + this.imageBounds2.y
        };
        const cursorPosWCS = AST.pixToWCS(this.props.frame.wcsInfo, cursorPosImageSpace.x, cursorPosImageSpace.y);
        const cursorPosFormatted = AST.getFormattedCoordinates(this.props.frame.wcsInfo, cursorPosWCS.x, cursorPosWCS.y, "Format(1) = d.1, Format(2) = d.1");
        return {
            posCanvasSpace: cursorPosCanvasSpace,
            posImageSpace: cursorPosImageSpace,
            posWCS: cursorPosWCS,
            infoWCS: cursorPosFormatted
        };
    }

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

        this.imageBounds2 = {x: this.props.frame.requiredFrameView.xMax, y: this.props.frame.requiredFrameView.yMax};
        this.imageBounds1 = {x: this.props.frame.requiredFrameView.xMin, y: this.props.frame.requiredFrameView.yMin};

        // this.imageBounds2.x = this.props.width - paddingSize * (paddingRatios[0] + paddingRatios[1]);
        // this.imageBounds2.y = this.props.height - paddingSize * (paddingRatios[2] + paddingRatios[3]);
        // this.imageBounds1 = {x: 0, y: 0};
        this.padding = paddingRatios.map(r => r * paddingSize * devicePixelRatio);
    }

    renderCanvas = () => {
        const settings = this.props.overlaySettings;

        if (this.props.frame.wcsInfo) {
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
                this.props.frame.wcsInfo,
                this.imageBounds1.x, this.imageBounds2.x,
                this.imageBounds1.y, this.imageBounds2.y,
                this.props.width * devicePixelRatio, this.props.height * devicePixelRatio,
                settings.padding[0], settings.padding[1], settings.padding[2], settings.padding[3],
                // this.padding[0], this.padding[1], this.padding[2], this.padding[3],
                settings.styleString);
        }
    };

    render() {
        const styleString = this.props.overlaySettings.styleString;
        const frameView = this.props.frame.requiredFrameView;
        const framePadding = this.props.overlaySettings.padding;
        const w = this.props.width;
        const h = this.props.height;
        return <canvas className="overlay-canvas" key={styleString} ref={(ref) => this.canvas = ref} onWheel={this.handleScroll} onClick={this.handleClick} onMouseMove={this.handleMouseMove}/>;
    }
}