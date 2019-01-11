import * as React from "react";
import * as AST from "ast_wrapper";
import * as _ from "lodash";
import {observer} from "mobx-react";
import {ASTSettingsString, FrameStore, OverlayStore} from "stores";
import {CursorInfo, Point2D} from "models";
import "./OverlayComponent.css";

export class OverlayComponentProps {
    overlaySettings: OverlayStore;
    frame: FrameStore;
    docked: boolean;
    cursorPoint: Point2D;
    cursorFrozen: boolean;
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

    updateCursorPos = _.throttle((x: number, y: number) => {
        if (this.props.frame.wcsInfo && this.props.onCursorMoved) {
            this.props.onCursorMoved(this.getCursorInfo({x, y}));
        }
    }, 100);

    handleMouseMove = (ev: React.MouseEvent<HTMLCanvasElement>) => {
        this.updateCursorPos(ev.nativeEvent.offsetX, ev.nativeEvent.offsetY);
    };

    handleClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
        const cursorPosCanvasSpace = {x: ev.nativeEvent.offsetX, y: ev.nativeEvent.offsetY};
        if (this.props.frame.wcsInfo && this.props.onClicked) {
            this.props.onClicked(this.getCursorInfo(cursorPosCanvasSpace));
        }
    };

    handleScroll = (ev: React.WheelEvent<HTMLCanvasElement>) => {
        const lineHeight = 15;
        const delta = ev.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? ev.deltaY : ev.deltaY * lineHeight;
        const cursorPosCanvasSpace = {x: ev.nativeEvent.offsetX, y: ev.nativeEvent.offsetY};
        if (this.props.frame.wcsInfo && this.props.onZoomed) {
            this.props.onZoomed(this.getCursorInfo(cursorPosCanvasSpace), -delta);
        }
    };

    private getCursorInfo(cursorPosCanvasSpace: Point2D) {
        const settings = this.props.overlaySettings;
        const frameView = this.props.frame.requiredFrameView;

        const LT = {x: settings.padding.left, y: settings.padding.top};
        const RB = {x: settings.viewWidth - settings.padding.right, y: settings.viewHeight - settings.padding.bottom};
        const cursorPosImageSpace = {
            x: ((cursorPosCanvasSpace.x - LT.x) / (RB.x - LT.x)) * (frameView.xMax - frameView.xMin) + frameView.xMin - 1,
            // y coordinate is flipped in image space
            y: ((cursorPosCanvasSpace.y - LT.y) / (RB.y - LT.y)) * (frameView.yMin - frameView.yMax) + frameView.yMax - 1
        };
        
        const currentView = this.props.frame.currentFrameView;

        const cursorPosLocalImage = {
            x: Math.round((cursorPosImageSpace.x - currentView.xMin) / currentView.mip),
            y: Math.round((cursorPosImageSpace.y - currentView.yMin) / currentView.mip)
        };
        
        const roundedPosImageSpace = {
            x: cursorPosLocalImage.x * currentView.mip + currentView.xMin,
            y: cursorPosLocalImage.y * currentView.mip + currentView.yMin
        };

        const textureWidth = Math.floor((currentView.xMax - currentView.xMin) / currentView.mip);
        const textureHeight = Math.floor((currentView.yMax - currentView.yMin) / currentView.mip);

        let value = undefined;
        if (cursorPosLocalImage.x >= 0 && cursorPosLocalImage.x < textureWidth && cursorPosLocalImage.y >= 0 && cursorPosLocalImage.y < textureHeight) {
            const index = (cursorPosLocalImage.y * textureWidth + cursorPosLocalImage.x);
            value = this.props.frame.rasterData[index];
        }

        let cursorPosWCS, cursorPosFormatted;
        if (this.props.frame.validWcs) {
            // We need to compare X and Y coordinates in both directions
            // to avoid a confusing drop in precision at rounding threshold
            const offsetBlock = [[0, 0], [1, 1], [-1, -1]];
            
            // Shift image space coordinates to 1-indexed when passing to AST
            const cursorNeighbourhood = offsetBlock.map((offset) => AST.pixToWCS(this.props.frame.wcsInfo, roundedPosImageSpace.x + 1 + offset[0], roundedPosImageSpace.y + 1 + offset[1]));
            
            cursorPosWCS = cursorNeighbourhood[0];
            
            const normalizedNeighbourhood = cursorNeighbourhood.map((pos) =>  AST.normalizeCoordinates(this.props.frame.wcsInfo, pos.x, pos.y));
            
            let precisionX = 0;
            let precisionY = 0;
            
            while (true) {
                let astString = new ASTSettingsString();
                astString.add("Format(1)", this.props.overlaySettings.numbers.cursorFormatStringX(precisionX));
                astString.add("Format(2)", this.props.overlaySettings.numbers.cursorFormatStringY(precisionY));
                astString.add("System", this.props.overlaySettings.global.implicitSystem);
                
                let formattedNeighbourhood = normalizedNeighbourhood.map((pos) => AST.getFormattedCoordinates(this.props.frame.wcsInfo, pos.x, pos.y, astString.toString()));
                let [p, n1, n2] = formattedNeighbourhood;

                if (!p.x || !p.y || p.x === "<bad>" || p.y === "<bad>") {
                    cursorPosFormatted = null;
                    break;
                }

                if (p.x !== n1.x && p.x !== n2.x && p.y !== n1.y && p.y !== n2.y) {
                    cursorPosFormatted = {x: p.x, y: p.y};
                    break;
                }
                
                if (p.x === n1.x || p.x === n2.x) {
                    precisionX += 1;
                }
                
                if (p.y === n1.y || p.y === n2.y) {
                    precisionY += 1;
                }
            }
        }
        
        return {
            posCanvasSpace: cursorPosCanvasSpace,
            posImageSpace: cursorPosImageSpace,
            posWCS: cursorPosWCS,
            infoWCS: cursorPosFormatted,
            value: value
        };
    }

    private getCursorCanvasPos(imageX: number, imageY: number): Point2D {
        const settings = this.props.overlaySettings;
        const frameView = this.props.frame.requiredFrameView;

        const LT = {x: settings.padding.left * devicePixelRatio, y: settings.padding.top * devicePixelRatio};
        const RB = {x: settings.viewWidth * devicePixelRatio - settings.padding.right * devicePixelRatio, y: settings.viewHeight * devicePixelRatio - settings.padding.bottom * devicePixelRatio};
        const posCanvasSpace = {
            x: Math.floor(LT.x + (imageX + 1 - frameView.xMin) / (frameView.xMax - frameView.xMin) * (RB.x - LT.x)),
            y: Math.floor(LT.y + (frameView.yMax - imageY - 1) / (frameView.yMax - frameView.yMin) * (RB.y - LT.y))
        };

        if (posCanvasSpace.x < LT.x || posCanvasSpace.x > RB.x || posCanvasSpace.y < LT.y || posCanvasSpace.y > RB.y) {
            return null;
        }
        return posCanvasSpace;
    }

    updateImageDimensions() {
        this.canvas.width = this.props.overlaySettings.viewWidth * devicePixelRatio;
        this.canvas.height = this.props.overlaySettings.viewHeight * devicePixelRatio;
    }

    renderCanvas = () => {
        const settings = this.props.overlaySettings;
        const frame = this.props.frame;
        const pixelRatio = devicePixelRatio;

        if (frame.wcsInfo) {
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

            plot(settings.styleString);

            if (/No grid curves can be drawn for axis/.test(AST.getLastErrorMessage())) {
                // Try to re-plot without the grid
                plot(settings.styleString.replace(/Gap\(\d\)=[^,]+, ?/g, "").replace("Grid=1", "Grid=0"));
            }

            AST.clearLastErrorMessage();
        }

        // Draw frozen cursor
        if (this.props.cursorFrozen && this.props.cursorPoint) {
            let cursorPosCanvas = this.getCursorCanvasPos(this.props.cursorPoint.x, this.props.cursorPoint.y);
            if (cursorPosCanvas) {
                const ctx = this.canvas.getContext("2d");
                const crosshairLength = 20 * devicePixelRatio;
                const posX = cursorPosCanvas.x + 0.5;
                const posY = cursorPosCanvas.y + 0.5;
                ctx.save();
                ctx.resetTransform();
                ctx.fillStyle = "black";
                ctx.fillRect(posX - crosshairLength / 2.0 - 1.5, posY - 1.5, crosshairLength + 3, 3);
                ctx.fillRect(posX - 1.5, posY - crosshairLength / 2.0 - 1.5, 3, crosshairLength + 3);
                ctx.fillStyle = "white";
                ctx.fillRect(posX - crosshairLength / 2.0 - 0.5, posY - 0.5, crosshairLength + 1, 1);
                ctx.fillRect(posX - 0.5, posY - crosshairLength / 2.0 - 0.5, 1, crosshairLength + 1);
                ctx.restore();
            }
        }
    };

    render() {
        const styleString = this.props.overlaySettings.styleString;
        const frameView = this.props.frame.requiredFrameView;
        const framePadding = this.props.overlaySettings.padding;
        const w = this.props.overlaySettings.viewWidth;
        const h = this.props.overlaySettings.viewHeight;
        const frozen = this.props.cursorFrozen;

        let className = "overlay-canvas";
        if (this.props.docked) {
            className += " docked";
        }
        return <canvas className={className} id="overlay-canvas" key={styleString} ref={(ref) => this.canvas = ref} onWheel={this.handleScroll} onClick={this.handleClick} onMouseMove={this.handleMouseMove}/>;
    }
}
