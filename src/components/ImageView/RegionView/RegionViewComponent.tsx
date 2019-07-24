import * as React from "react";
import * as _ from "lodash";
import * as AST from "ast_wrapper";
import {action, observable} from "mobx";
import {observer} from "mobx-react";
import {Group, Layer, Line, Rect, Stage} from "react-konva";
import {CARTA} from "carta-protobuf";
import {ASTSettingsString, FrameStore, OverlayStore, RegionMode, RegionStore} from "stores";
import {RegionComponent} from "./RegionComponent";
import {PolygonRegionComponent} from "./PolygonRegionComponent";
import {CursorInfo, Point2D} from "models";
import "./RegionViewComponent.css";

export interface RegionViewComponentProps {
    frame: FrameStore;
    overlaySettings: OverlayStore;
    isRegionCornerMode: boolean;
    docked: boolean;
    width: number;
    height: number;
    left: number;
    top: number;
    cursorFrozen: boolean;
    cursorPoint?: Point2D;
    initCenter: (cursorInfo: CursorInfo) => void;
    onCursorMoved?: (cursorInfo: CursorInfo) => void;
    onClicked?: (cursorInfo: CursorInfo) => void;
    onRegionDoubleClicked?: (region: RegionStore) => void;
    onZoomed?: (cursorInfo: CursorInfo, delta: number) => void;
}

const DUPLICATE_POINT_THRESHOLD = 0.01;

@observer
export class RegionViewComponent extends React.Component<RegionViewComponentProps> {
    @observable creatingRegion: RegionStore;
    private regionStartPoint: Point2D;
    @observable currentCursorPos: Point2D;

    constructor(props: RegionViewComponentProps) {
        super(props);
        const center = {x: props.width / 2, y: props.height / 2};
        this.props.initCenter(this.getCursorInfo(center));
    }

    updateCursorPos = _.throttle((x: number, y: number) => {
        if (this.props.frame.wcsInfo && this.props.onCursorMoved) {
            this.props.onCursorMoved(this.getCursorInfo({x, y}));
        }
    }, 100);

    private getCursorInfo(cursorPosCanvasSpace: Point2D): CursorInfo {
        const cursorPosImageSpace = this.getImagePos(cursorPosCanvasSpace.x, cursorPosCanvasSpace.y);

        let cursorPosWCS, cursorPosFormatted;
        if (this.props.frame.validWcs) {
            // We need to compare X and Y coordinates in both directions
            // to avoid a confusing drop in precision at rounding threshold
            const offsetBlock = [[0, 0], [1, 1], [-1, -1]];

            // Shift image space coordinates to 1-indexed when passing to AST
            const cursorNeighbourhood = offsetBlock.map((offset) => AST.pixToWCS(this.props.frame.wcsInfo, cursorPosImageSpace.x + 1 + offset[0], cursorPosImageSpace.y + 1 + offset[1]));

            cursorPosWCS = cursorNeighbourhood[0];

            const normalizedNeighbourhood = cursorNeighbourhood.map((pos) => AST.normalizeCoordinates(this.props.frame.wcsInfo, pos.x, pos.y));

            let precisionX = 0;
            let precisionY = 0;

            while (true) {
                let astString = new ASTSettingsString();
                astString.add("Format(1)", this.props.overlaySettings.numbers.cursorFormatStringX(precisionX));
                astString.add("Format(2)", this.props.overlaySettings.numbers.cursorFormatStringY(precisionY));
                astString.add("System", this.props.overlaySettings.global.explicitSystem);

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
        };
    }

    private getCursorCanvasPos(imageX: number, imageY: number): Point2D {
        const frameView = this.props.frame.requiredFrameView;
        const width = this.props.width;
        const height = this.props.height;
        const posCanvasSpace = {
            x: Math.floor((imageX + 1 - frameView.xMin) / (frameView.xMax - frameView.xMin) * width),
            y: Math.floor((frameView.yMax - imageY - 1) / (frameView.yMax - frameView.yMin) * height)
        };

        if (posCanvasSpace.x < 0 || posCanvasSpace.x > width || posCanvasSpace.y < 0 || posCanvasSpace.y > height) {
            return null;
        }
        return posCanvasSpace;
    }

    private getImagePos(canvasX: number, canvasY: number): Point2D {
        const frameView = this.props.frame.requiredFrameView;
        return {
            x: (canvasX / this.props.width) * (frameView.xMax - frameView.xMin) + frameView.xMin - 1,
            // y coordinate is flipped in image space
            y: (canvasY / this.props.height) * (frameView.yMin - frameView.yMax) + frameView.yMax - 1
        };
    }

    handleMouseDown = (konvaEvent) => {
        if (this.creatingRegion) {
            return;
        }

        const mouseEvent = konvaEvent.evt as MouseEvent;
        const frame = this.props.frame;
        const regionType = frame.regionSet.newRegionType;

        const cursorPosImageSpace = this.getImagePos(mouseEvent.offsetX, mouseEvent.offsetY);
        switch (regionType) {
            case CARTA.RegionType.RECTANGLE:
                this.creatingRegion = frame.regionSet.addRectangularRegion(cursorPosImageSpace, 0, 0, true);
                break;
            case CARTA.RegionType.ELLIPSE:
                this.creatingRegion = frame.regionSet.addEllipticalRegion(cursorPosImageSpace, 0, 0, true);
                break;
            default:
                return;
        }
        this.regionStartPoint = cursorPosImageSpace;
        this.creatingRegion.beginCreating();
    };

    handleMouseUp = (konvaEvent) => {
        const frame = this.props.frame;
        const regionType = frame.regionSet.newRegionType;

        switch (regionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ELLIPSE:
                this.handleMouseUpRegularRegion();
                break;
            case CARTA.RegionType.POLYGON:
                this.handleMouseUpPolygonRegion(konvaEvent.evt as MouseEvent);
                break;
            default:
                break;
        }
    };

    private handleMouseUpRegularRegion() {
        if (this.creatingRegion) {
            if (this.creatingRegion.isValid) {
                this.creatingRegion.endCreating();
                this.props.frame.regionSet.selectRegion(this.creatingRegion);
                this.creatingRegion = null;
            } else {
                this.props.frame.regionSet.deleteRegion(this.creatingRegion);
            }
        }
        // Switch to moving mode after region creation. Use a timeout to allow the handleClick function to execute first
        setTimeout(() => this.props.frame.regionSet.mode = RegionMode.MOVING, 1);
    }

    @action
    private handleMouseUpPolygonRegion(mouseEvent: MouseEvent) {
        const frame = this.props.frame;
        const cursorPosImageSpace = this.getImagePos(mouseEvent.offsetX, mouseEvent.offsetY);
        if (this.creatingRegion) {
            if (this.creatingRegion.controlPoints.length) {
                const previousPoint = this.creatingRegion.controlPoints[this.creatingRegion.controlPoints.length - 1];
                // prevent duplicate points
                if (Math.abs(previousPoint.x - cursorPosImageSpace.x) > DUPLICATE_POINT_THRESHOLD || Math.abs(previousPoint.y - cursorPosImageSpace.y) > DUPLICATE_POINT_THRESHOLD) {
                    this.creatingRegion.setControlPoints([...this.creatingRegion.controlPoints, cursorPosImageSpace]);
                }
            }
        } else {
            this.creatingRegion = frame.regionSet.addPolygonalRegion([cursorPosImageSpace], true);
            this.creatingRegion.beginCreating();
        }
        this.handlePolygonRegionMouseMove(mouseEvent);
    }

    handleClick = (konvaEvent) => {
        const mouseEvent = konvaEvent.evt as MouseEvent;
        if (konvaEvent.target.nodeType !== "Stage" && ((mouseEvent.button === 0 && !(mouseEvent.ctrlKey || mouseEvent.metaKey)) || mouseEvent.button === 2)) {
            return;
        }

        if (this.props.frame.regionSet.mode === RegionMode.CREATING && mouseEvent.button === 0) {
            return;
        }

        const cursorPosCanvasSpace = {x: mouseEvent.offsetX, y: mouseEvent.offsetY};
        if (this.props.frame.wcsInfo && this.props.onClicked) {
            this.props.onClicked(this.getCursorInfo(cursorPosCanvasSpace));
        }
    };

    handleWheel = (konvaEvent) => {
        const mouseEvent = konvaEvent.evt as WheelEvent;
        const lineHeight = 15;
        const delta = mouseEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? mouseEvent.deltaY : mouseEvent.deltaY * lineHeight;
        const cursorPosCanvasSpace = {x: mouseEvent.offsetX, y: mouseEvent.offsetY};
        if (this.props.frame.wcsInfo && this.props.onZoomed) {
            this.props.onZoomed(this.getCursorInfo(cursorPosCanvasSpace), -delta);
        }
    };

    handleMove = (konvaEvent) => {
        const mouseEvent = konvaEvent.evt as MouseEvent;
        if (this.props.frame.regionSet.mode === RegionMode.CREATING && this.creatingRegion) {
            switch (this.creatingRegion.regionType) {
                case CARTA.RegionType.RECTANGLE:
                case CARTA.RegionType.ELLIPSE:
                    this.handleRegularRegionMouseMove(mouseEvent);
                    break;
                case CARTA.RegionType.POLYGON:
                    this.handlePolygonRegionMouseMove(mouseEvent);
                    break;
                default:
                    break;
            }
        } else if (!this.props.cursorFrozen) {
            this.updateCursorPos(mouseEvent.offsetX, mouseEvent.offsetY);
        }
    };

    private handleRegularRegionMouseMove(mouseEvent: MouseEvent) {
        const cursorPosImageSpace = this.getImagePos(mouseEvent.offsetX, mouseEvent.offsetY);
        let dx = (cursorPosImageSpace.x - this.regionStartPoint.x);
        let dy = (cursorPosImageSpace.y - this.regionStartPoint.y);
        if (mouseEvent.shiftKey) {
            const maxDiff = Math.max(Math.abs(dx), Math.abs(dy));
            dx = Math.sign(dx) * maxDiff;
            dy = Math.sign(dy) * maxDiff;
        }
        const isCtrlPressed = mouseEvent.ctrlKey || mouseEvent.metaKey;
        if ((this.props.isRegionCornerMode && !isCtrlPressed) || (!this.props.isRegionCornerMode && isCtrlPressed)) {
            // corner-to-corner region creation
            const endPoint = {x: this.regionStartPoint.x + dx, y: this.regionStartPoint.y + dy};
            const center = {x: (this.regionStartPoint.x + endPoint.x) / 2.0, y: (this.regionStartPoint.y + endPoint.y) / 2.0};
            switch (this.creatingRegion.regionType) {
                case CARTA.RegionType.RECTANGLE:
                    this.creatingRegion.setControlPoints([center, {x: Math.abs(dx), y: Math.abs(dy)}]);
                    break;
                case CARTA.RegionType.ELLIPSE:
                    this.creatingRegion.setControlPoints([center, {y: Math.abs(dx) / 2.0, x: Math.abs(dy) / 2.0}]);
                    break;
                default:
                    break;
            }
        } else {
            // center-to-corner region creation
            switch (this.creatingRegion.regionType) {
                case CARTA.RegionType.RECTANGLE:
                    this.creatingRegion.setControlPoints([this.regionStartPoint, {x: 2 * Math.abs(dx), y: 2 * Math.abs(dy)}]);
                    break;
                case CARTA.RegionType.ELLIPSE:
                    this.creatingRegion.setControlPoints([this.regionStartPoint, {y: Math.abs(dx), x: Math.abs(dy)}]);
                    break;
                default:
                    break;
            }
        }
    }

    @action
    private handlePolygonRegionMouseMove(mouseEvent: MouseEvent) {
        this.currentCursorPos = {x: mouseEvent.offsetX, y: mouseEvent.offsetY};
    }

    private handleRegionDoubleClick = (region: RegionStore) => {
        if (this.props.onRegionDoubleClicked) {
            this.props.onRegionDoubleClicked(region);
        }
    };

    private handleStageDoubleClick = (konvaEvt) => {
        const mouseEvent = konvaEvt.evt as MouseEvent;
        if (this.props.frame.regionSet.mode === RegionMode.CREATING && this.creatingRegion && this.creatingRegion.regionType === CARTA.RegionType.POLYGON) {
            // Handle region completion
            if (this.creatingRegion.isValid && this.creatingRegion.controlPoints.length > 2) {
                this.creatingRegion.endCreating();
                this.props.frame.regionSet.selectRegion(this.creatingRegion);
                this.creatingRegion = null;
            } else {
                this.props.frame.regionSet.deleteRegion(this.creatingRegion);
                this.creatingRegion = null;
            }
            // Switch to moving mode after region creation. Use a timeout to allow the handleClick function to execute first
            setTimeout(() => this.props.frame.regionSet.mode = RegionMode.MOVING, 1);
        }
    };

    render() {
        const frame = this.props.frame;
        const regionSet = frame.regionSet;

        let className = "region-stage";
        if (this.props.docked) {
            className += " docked";
        }

        let regionRects = null;
        let regionPolygons = null;
        if (regionSet && regionSet.regions.length) {
            regionRects = regionSet.regions.filter(r => (r.regionType === CARTA.RegionType.RECTANGLE || r.regionType === CARTA.RegionType.ELLIPSE) && r.isValid)
                .sort((a, b) => a.boundingBoxArea > b.boundingBoxArea ? -1 : 1)
                .map(
                    r => (
                        <RegionComponent
                            key={r.regionId}
                            region={r}
                            frame={frame}
                            layerWidth={this.props.width}
                            layerHeight={this.props.height}
                            selected={r === regionSet.selectedRegion}
                            onSelect={regionSet.selectRegion}
                            onDoubleClick={this.handleRegionDoubleClick}
                            listening={regionSet.mode !== RegionMode.CREATING}
                            isRegionCornerMode={this.props.isRegionCornerMode}
                        />
                    )
                );

            regionPolygons = regionSet.regions.filter(r => r.regionType === CARTA.RegionType.POLYGON && r.isValid)
                .map(
                    r => (
                        <PolygonRegionComponent
                            key={r.regionId}
                            region={r}
                            frame={frame}
                            layerWidth={this.props.width}
                            layerHeight={this.props.height}
                            selected={r === regionSet.selectedRegion}
                            onSelect={regionSet.selectRegion}
                            onDoubleClick={this.handleRegionDoubleClick}
                            listening={regionSet.mode !== RegionMode.CREATING}
                        />
                    )
                );
        }

        let cursorMarker = null;

        if (this.props.cursorFrozen && this.props.cursorPoint) {
            let cursorPosCanvas = this.getCursorCanvasPos(this.props.cursorPoint.x, this.props.cursorPoint.y);
            if (cursorPosCanvas) {
                const crosshairLength = 20 * devicePixelRatio;
                const crosshairThicknessWide = 3;
                const crosshairThicknessNarrow = 1;
                const crosshairGap = 7;
                cursorMarker = (
                    <Group x={Math.floor(cursorPosCanvas.x) + 0.5} y={Math.floor(cursorPosCanvas.y) + 0.5}>
                        <Line listening={false} points={[-crosshairLength / 2 - crosshairThicknessWide / 2, 0, -crosshairGap / 2, 0]} strokeWidth={crosshairThicknessWide} stroke="black"/>
                        <Line listening={false} points={[crosshairGap / 2, 0, crosshairLength / 2 + crosshairThicknessWide / 2, 0]} strokeWidth={crosshairThicknessWide} stroke="black"/>
                        <Line listening={false} points={[0, -crosshairLength / 2 - crosshairThicknessWide / 2, 0, -crosshairGap / 2]} strokeWidth={crosshairThicknessWide} stroke="black"/>
                        <Line listening={false} points={[0, crosshairGap / 2, 0, crosshairLength / 2 + crosshairThicknessWide / 2]} strokeWidth={crosshairThicknessWide} stroke="black"/>
                        <Rect listening={false} width={crosshairGap - 1} height={crosshairGap - 1} offsetX={crosshairGap / 2 - 0.5} offsetY={crosshairGap / 2 - 0.5} strokeWidth={1} stroke="black"/>

                        <Line listening={false} points={[-crosshairLength / 2 - crosshairThicknessNarrow / 2, 0, -crosshairGap / 2, 0]} strokeWidth={crosshairThicknessNarrow} stroke="white"/>
                        <Line listening={false} points={[crosshairGap / 2, 0, crosshairLength / 2 + crosshairThicknessNarrow / 2, 0]} strokeWidth={crosshairThicknessNarrow} stroke="white"/>
                        <Line listening={false} points={[0, -crosshairLength / 2 - crosshairThicknessNarrow / 2, 0, -crosshairGap / 2]} strokeWidth={crosshairThicknessNarrow} stroke="white"/>
                        <Line listening={false} points={[0, crosshairGap / 2, 0, crosshairLength / 2 + crosshairThicknessNarrow / 2]} strokeWidth={crosshairThicknessNarrow} stroke="white"/>
                    </Group>
                );
            }
        }

        let polygonCreatingLine = null;
        if (this.currentCursorPos && this.creatingRegion && this.creatingRegion.regionType === CARTA.RegionType.POLYGON && this.creatingRegion.isValid) {
            const firstControlPoint = this.creatingRegion.controlPoints[0];
            const lastControlPoint = this.creatingRegion.controlPoints[this.creatingRegion.controlPoints.length - 1];
            const lineStart = this.getCursorCanvasPos(lastControlPoint.x, lastControlPoint.y);
            const lineEnd = this.getCursorCanvasPos(firstControlPoint.x, firstControlPoint.y);
            polygonCreatingLine = (
                <Line
                    points={[lineStart.x, lineStart.y, this.currentCursorPos.x, this.currentCursorPos.y, lineEnd.x, lineEnd.y]}
                    dash={[5]}
                    stroke={this.creatingRegion.color}
                    strokeWidth={this.creatingRegion.lineWidth}
                    opacity={0.5}
                    lineJoin={"round"}
                    listening={false}
                    perfectDrawEnabled={false}
                />
            );
        }

        let cursor: string;

        if (frame.regionSet.mode === RegionMode.CREATING) {
            cursor = "crosshair";
        } else if (frame.regionSet.selectedRegion && frame.regionSet.selectedRegion.editing) {
            cursor = "move";
        }

        return (
            <Stage
                className={className}
                width={this.props.width}
                height={this.props.height}
                style={{left: this.props.left, top: this.props.top, cursor}}
                onClick={this.handleClick}
                onWheel={this.handleWheel}
                onMouseMove={this.handleMove}
                onDblClick={this.handleStageDoubleClick}
                onMouseDown={regionSet.mode === RegionMode.CREATING ? this.handleMouseDown : null}
                onMouseUp={regionSet.mode === RegionMode.CREATING ? this.handleMouseUp : null}
            >
                <Layer>
                    {regionRects}
                    {regionPolygons}
                    {polygonCreatingLine}
                    {cursorMarker}
                </Layer>
            </Stage>
        );
    }
}