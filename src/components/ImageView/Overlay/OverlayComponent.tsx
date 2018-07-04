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
    overlaySettings: OverlayState;
    frame: FrameState;
    onCursorMoved?: (cursorInfo: CursorInfo) => void;
    onClicked?: (cursorInfo: CursorInfo) => void;
    onZoomed?: (cursorInfo: CursorInfo, delta: number) => void;
}

@observer
export class OverlayComponent extends React.Component<OverlayComponentProps> {
    canvas: HTMLCanvasElement;

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
            this.props.onZoomed(this.getCursorInfo(cursorPosCanvasSpace), -ev.deltaY);
        }
    };

    private getCursorInfo(cursorPosCanvasSpace: Point2D) {
        const settings = this.props.overlaySettings;
        const frameView = this.props.frame.requiredFrameView;

        const LT = {x: settings.padding.left, y: settings.padding.top};
        const RB = {x: settings.viewWidth - settings.padding.right, y: settings.viewHeight - settings.padding.bottom};
        const cursorPosImageSpace = {
            x: ((cursorPosCanvasSpace.x - LT.x) / (RB.x - LT.x)) * (frameView.xMax - frameView.xMin) + frameView.xMin,
            // y coordinate is flipped in image space
            y: ((cursorPosCanvasSpace.y - LT.y) / (RB.y - LT.y)) * (frameView.yMin - frameView.yMax) + frameView.yMax
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
        this.canvas.width = this.props.overlaySettings.viewWidth * devicePixelRatio;
        this.canvas.height = this.props.overlaySettings.viewHeight * devicePixelRatio;
    }

    renderCanvas = () => {
        const settings = this.props.overlaySettings;
        const frame = this.props.frame;
        if (frame.wcsInfo) {
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
                frame.wcsInfo,
                frame.requiredFrameView.xMin, frame.requiredFrameView.xMax,
                frame.requiredFrameView.yMin, frame.requiredFrameView.yMax,
                settings.viewWidth * devicePixelRatio, settings.viewHeight * devicePixelRatio,
                settings.padding.left, settings.padding.right, settings.padding.top, settings.padding.bottom,
                settings.styleString);
        }
    };

    render() {
        const styleString = this.props.overlaySettings.styleString;
        const frameView = this.props.frame.requiredFrameView;
        const framePadding = this.props.overlaySettings.padding;
        const w = this.props.overlaySettings.viewWidth;
        const h = this.props.overlaySettings.viewHeight;
        return <canvas className="overlay-canvas" key={styleString} ref={(ref) => this.canvas = ref} onWheel={this.handleScroll} onClick={this.handleClick} onMouseMove={this.handleMouseMove}/>;
    }
}