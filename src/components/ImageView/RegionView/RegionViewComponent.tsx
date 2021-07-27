import * as React from "react";
import * as _ from "lodash";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {Group, Layer, Line, Rect, Stage} from "react-konva";
import Konva from "konva";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore, OverlayStore, PreferenceStore, RegionMode, RegionStore} from "stores";
import {SimpleShapeRegionComponent} from "./SimpleShapeRegionComponent";
import {LineSegmentRegionComponent} from "./LineSegmentRegionComponent";
import {PointRegionComponent} from "./PointRegionComponent";
import {canvasToImagePos, canvasToTransformedImagePos, imageToCanvasPos, transformedImageToCanvasPos} from "./shared";
import {CursorInfo, Point2D} from "models";
import {average2D, isAstBadPoint, length2D, pointDistanceSquared, scale2D, subtract2D, transformPoint} from "utilities";
import "./RegionViewComponent.scss";
import {ImageViewLayer} from "../ImageViewComponent";

export interface RegionViewComponentProps {
    frame: FrameStore;
    overlaySettings: OverlayStore;
    isRegionCornerMode: boolean;
    dragPanningEnabled: boolean;
    docked: boolean;
    width: number;
    height: number;
    left: number;
    top: number;
    cursorFrozen: boolean;
    cursorPoint?: Point2D;
    onClicked?: (cursorInfo: CursorInfo) => void;
    onRegionDoubleClicked?: (region: RegionStore) => void;
    onZoomed?: (cursorInfo: CursorInfo, delta: number) => void;
}

const DUPLICATE_POINT_THRESHOLD = 0.01;
const DOUBLE_CLICK_DISTANCE = 5;
const KEYCODE_ESC = 27;

@observer
export class RegionViewComponent extends React.Component<RegionViewComponentProps> {
    @observable creatingRegion: RegionStore;
    @observable currentCursorPos: Point2D;

    private regionStartPoint: Point2D;
    private mousePreviousClick: Point2D = {x: -1000, y: -1000};
    private mouseClickDistance: number = 0;
    private dragPanning: boolean;
    private dragOffset: Point2D;
    private initialDragPointCanvasSpace: Point2D;
    private initialDragCenter: Point2D;
    private initialPinchZoom: number;
    private initialPinchDistance: number;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    updateCursorPos = _.throttle((x: number, y: number) => {
        const frame = this.props.frame;
        if (frame.wcsInfo) {
            const imagePos = canvasToTransformedImagePos(x, y, frame, this.props.width, this.props.height);
            this.props.frame.setCursorPosition(imagePos);
        }
    }, 100);

    updateDistanceMeasureFinishPos = _.throttle((x: number, y: number) => {
        const frame = this.props.frame;
        const imagePos = canvasToTransformedImagePos(x, y, frame, this.props.width, this.props.height);
        frame.distanceMeasuring.setFinish(imagePos);
    }, 100);

    private getCursorCanvasPos = (imageX: number, imageY: number): Point2D => {
        const frame = this.props.frame;
        const posCanvasSpace = transformedImageToCanvasPos(imageX, imageY, frame, this.props.width, this.props.height);

        const width = this.props.width;
        const height = this.props.height;

        if (posCanvasSpace.x < 0 || posCanvasSpace.x > width || posCanvasSpace.y < 0 || posCanvasSpace.y > height) {
            return null;
        }
        return posCanvasSpace;
    };

    private getCursorPosImageSpace = (offsetX: number, offsetY: number): Point2D => {
        const frame = this.props.frame;
        let cursorPosImageSpace = canvasToTransformedImagePos(offsetX, offsetY, frame, this.props.width, this.props.height);
        if (frame.spatialReference) {
            cursorPosImageSpace = transformPoint(frame.spatialTransformAST, cursorPosImageSpace, true);
        }
        return cursorPosImageSpace;
    };

    @action private regionCreationStart = (mouseEvent: MouseEvent) => {
        if (this.creatingRegion) {
            return;
        }
        const frame = this.props.frame;
        const regionType = frame.regionSet.newRegionType;
        const cursorPosImageSpace = this.getCursorPosImageSpace(mouseEvent.offsetX, mouseEvent.offsetY);

        switch (regionType) {
            case CARTA.RegionType.POINT:
                this.creatingRegion = frame.regionSet.addPointRegion(cursorPosImageSpace, false);
                this.regionStartPoint = cursorPosImageSpace;
                break;
            case CARTA.RegionType.RECTANGLE:
                this.creatingRegion = frame.regionSet.addRectangularRegion(cursorPosImageSpace, 0, 0, true);
                this.regionStartPoint = cursorPosImageSpace;
                break;
            case CARTA.RegionType.ELLIPSE:
                this.creatingRegion = frame.regionSet.addEllipticalRegion(cursorPosImageSpace, 0, 0, true);
                this.regionStartPoint = cursorPosImageSpace;
                break;
            case CARTA.RegionType.POLYGON:
                this.creatingRegion = frame.regionSet.addPolygonalRegion([cursorPosImageSpace], true);
                this.polygonRegionCreating(mouseEvent);
                break;
            case CARTA.RegionType.LINE:
                this.creatingRegion = frame.regionSet.addLineRegion([cursorPosImageSpace, cursorPosImageSpace], true);
                this.regionStartPoint = cursorPosImageSpace;
                break;
            case CARTA.RegionType.POLYLINE:
                this.creatingRegion = frame.regionSet.addPolylineRegion([cursorPosImageSpace], true);
                this.polygonRegionCreating(mouseEvent);
                break;
            default:
                return;
        }
        this.creatingRegion.beginCreating();
    };

    @action private regionCreationEnd = (mouseEvent?: MouseEvent) => {
        let frame = this.props.frame;
        if (!this.creatingRegion || frame.regionSet.mode !== RegionMode.CREATING) {
            return;
        }
        const regionType = this.props.frame.regionSet.newRegionType;
        switch (regionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.LINE:
                frame = this.props.frame.spatialReference || this.props.frame;
                if (this.creatingRegion.controlPoints.length > 1 && length2D(this.creatingRegion.size) === 0) {
                    const scaleFactor = (PreferenceStore.Instance.regionSize * (this.creatingRegion.regionType === CARTA.RegionType.RECTANGLE ? 1.0 : 0.5)) / frame.zoomLevel;
                    this.creatingRegion.setSize(scale2D(this.creatingRegion.regionType === CARTA.RegionType.LINE ? {x: 2, y: 0} : {x: 1, y: 1}, scaleFactor));
                }
                break;
            case CARTA.RegionType.POINT:
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.POLYLINE:
                break;
            default:
                return;
        }

        // Handle region completion
        if (this.creatingRegion.isValid && (regionType !== CARTA.RegionType.POLYGON || this.creatingRegion.controlPoints.length > 2) && (regionType !== CARTA.RegionType.LINE || this.creatingRegion.controlPoints.length === 2) && (regionType !== CARTA.RegionType.POLYLINE || this.creatingRegion.controlPoints.length > 1)) {
            this.creatingRegion.endCreating();
            frame.regionSet.selectRegion(this.creatingRegion);
        } else {
            frame.regionSet.deleteRegion(this.creatingRegion);
        }
        this.creatingRegion = null;

        // Switch to moving mode after region creation. Use a timeout to allow the handleClick function to execute first
        setTimeout(() => this.props.frame.regionSet.setMode(RegionMode.MOVING), 1);
    };

    @action private polygonRegionAddPoint = (mouseEvent: MouseEvent) => {
        if (!this.creatingRegion) {
            return;
        }
        const cursorPosImageSpace = this.getCursorPosImageSpace(mouseEvent.offsetX, mouseEvent.offsetY);

        if (this.creatingRegion.controlPoints.length) {
            const previousPoint = this.creatingRegion.controlPoints[this.creatingRegion.controlPoints.length - 1];
            // prevent duplicate points
            if (Math.abs(previousPoint.x - cursorPosImageSpace.x) > DUPLICATE_POINT_THRESHOLD || Math.abs(previousPoint.y - cursorPosImageSpace.y) > DUPLICATE_POINT_THRESHOLD) {
                this.creatingRegion.setControlPoints([...this.creatingRegion.controlPoints, cursorPosImageSpace]);
            }
        }

        this.polygonRegionCreating(mouseEvent);
    };

    private RegionCreating(mouseEvent: MouseEvent) {
        if (!this.creatingRegion) {
            return;
        }
        const cursorPosImageSpace = this.getCursorPosImageSpace(mouseEvent.offsetX, mouseEvent.offsetY);

        let dx = cursorPosImageSpace.x - this.regionStartPoint.x;
        let dy = cursorPosImageSpace.y - this.regionStartPoint.y;
        if (mouseEvent.shiftKey && this.creatingRegion.regionType !== CARTA.RegionType.LINE) {
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
                case CARTA.RegionType.LINE:
                    const start = this.regionStartPoint;
                    if (start.x < cursorPosImageSpace.x) {
                        this.creatingRegion.setControlPoints([start, cursorPosImageSpace]);
                    } else {
                        this.creatingRegion.setControlPoints([cursorPosImageSpace, start]);
                    }
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
                case CARTA.RegionType.LINE:
                    const start = {x: cursorPosImageSpace.x - 2 * dx, y: cursorPosImageSpace.y - 2 * dy};
                    if (start.x < cursorPosImageSpace.x) {
                        this.creatingRegion.setControlPoints([start, cursorPosImageSpace]);
                    } else {
                        this.creatingRegion.setControlPoints([cursorPosImageSpace, start]);
                    }
                    break;
                default:
                    break;
            }
        }
    }

    @action private polygonRegionCreating = (mouseEvent: MouseEvent) => {
        this.currentCursorPos = {x: mouseEvent.offsetX, y: mouseEvent.offsetY};
    };

    handleDragStart = (konvaEvent: Konva.KonvaEventObject<DragEvent>) => {
        // Only handle stage drag events
        if (konvaEvent.target === konvaEvent.currentTarget) {
            if (this.props.dragPanningEnabled) {
                this.dragPanning = true;

                let cursorPoint = konvaEvent.target.getStage().getPointerPosition();
                if (this.props.frame) {
                    const frame = this.props.frame.spatialReference || this.props.frame;
                    this.initialDragPointCanvasSpace = cursorPoint;
                    this.initialDragCenter = frame.center;
                    frame.startMoving();
                }
            }
        }
    };

    handleDragMove = (konvaEvent: Konva.KonvaEventObject<DragEvent>) => {
        // Only handle stage drag events
        if (konvaEvent.target === konvaEvent.currentTarget) {
            let cursorPoint = konvaEvent.target.getStage().getPointerPosition();
            let isPanDrag = true;
            if (konvaEvent.evt.type === "touchmove") {
                const touchEvent = konvaEvent.evt as unknown as TouchEvent;

                if (touchEvent.touches.length > 1 && touchEvent.target) {
                    isPanDrag = false;
                    const rect = (touchEvent.target as any).getBoundingClientRect();
                    const touch0 = {x: touchEvent.touches[0].pageX - rect.left, y: touchEvent.touches[0].pageY - rect.top};
                    const touch1 = {x: touchEvent.touches[1].pageX - rect.left, y: touchEvent.touches[1].pageY - rect.top};
                    this.handlePinch(touch0, touch1);
                } else {
                    this.initialPinchDistance = -1;
                    this.initialPinchZoom = -1;
                }
            }

            if (isPanDrag) {
                this.handlePan(cursorPoint);
            }
            konvaEvent.target.x(0);
            konvaEvent.target.y(0);
        }
    };

    handleDragEnd = (konvaEvent: Konva.KonvaEventObject<DragEvent>) => {
        // Only handle stage drag events
        if (konvaEvent.target === konvaEvent.currentTarget) {
            this.dragPanning = false;
            this.dragOffset = null;
            const frame = this.props.frame;

            if (frame) {
                frame.endMoving();
            }
        }
        this.initialPinchDistance = -1;
        this.initialPinchZoom = -1;
    };

    handlePinch = (touch0: Point2D, touch1: Point2D) => {
        const frame = this.props.frame;

        if (!frame || !touch0 || !touch1) {
            return;
        }

        const deltaTouch = subtract2D(touch1, touch0);
        const distance = length2D(deltaTouch);
        const centerCanvasSpace = average2D([touch0, touch1]);
        // ignore invalid
        if (!isFinite(distance) || distance <= 0) {
            return;
        }

        if (this.initialPinchDistance > 0) {
            const zoomFactor = distance / this.initialPinchDistance;
            const centerImageSpace = canvasToImagePos(centerCanvasSpace.x, centerCanvasSpace.y, frame.requiredFrameView, this.props.width, this.props.height);
            frame.zoomToPoint(centerImageSpace.x, centerImageSpace.y, this.initialPinchZoom * zoomFactor);
        } else {
            this.initialPinchDistance = distance;
            this.initialPinchZoom = frame.zoomLevel;
        }
    };

    handlePan = (offset: Point2D) => {
        // ignore invalid offsets
        if (!offset || !isFinite(offset.x) || !isFinite(offset.y)) {
            return;
        }
        if (this.props.frame) {
            const frame = this.props.frame.spatialReference || this.props.frame;
            if (!this.dragOffset) {
                this.dragOffset = {x: 0, y: 0};
            } else {
                this.dragOffset = subtract2D(offset, this.initialDragPointCanvasSpace);
                const initialCenterCanvasSpace = imageToCanvasPos(this.initialDragCenter.x, this.initialDragCenter.y, frame.requiredFrameView, this.props.width, this.props.height);
                const newCenterCanvasSpace = subtract2D(initialCenterCanvasSpace, this.dragOffset);
                const newCenterImageSpace = canvasToImagePos(newCenterCanvasSpace.x, newCenterCanvasSpace.y, frame.requiredFrameView, this.props.width, this.props.height);
                frame.setCenter(newCenterImageSpace.x, newCenterImageSpace.y);
            }
        }
    };

    handleClick = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;
        const frame = this.props.frame;

        const isSecondaryClick = mouseEvent.button !== 0 || mouseEvent.ctrlKey || mouseEvent.metaKey;

        // Record click position and distance
        this.mouseClickDistance = pointDistanceSquared(mouseEvent, this.mousePreviousClick);
        this.mousePreviousClick = {x: mouseEvent.x, y: mouseEvent.y};

        // Ignore clicks that aren't on the stage, unless it's a secondary click
        if (konvaEvent.target !== konvaEvent.currentTarget && !isSecondaryClick) {
            return;
        }

        // Ignore region creation mode clicks
        if (frame.regionSet.mode === RegionMode.CREATING && mouseEvent.button === 0) {
            return;
        }

        if (frame.wcsInfo && AppStore.Instance?.activeLayer === ImageViewLayer.DistanceMeasuring) {
            const imagePos = canvasToTransformedImagePos(mouseEvent.offsetX, mouseEvent.offsetY, frame, this.props.width, this.props.height);
            const wcsPos = transformPoint(frame.wcsInfo, imagePos);
            if (!isAstBadPoint(wcsPos)) {
                const dist = frame.distanceMeasuring;
                if (!dist.isCreating && !dist.showCurve) {
                    dist.setStart(imagePos);
                    dist.setIsCreating(true);
                } else if (dist.isCreating) {
                    dist.setFinish(imagePos);
                    dist.setIsCreating(false);
                } else {
                    dist.resetPos();
                    dist.setStart(imagePos);
                    dist.setIsCreating(true);
                }
            }
        }

        // Deselect selected region if in drag-to-pan mode and user clicks on the stage
        if (this.props.dragPanningEnabled && !isSecondaryClick) {
            frame.regionSet.deselectRegion();
        }

        if (frame.wcsInfo && this.props.onClicked && (!this.props.dragPanningEnabled || isSecondaryClick)) {
            const cursorPosImageSpace = canvasToTransformedImagePos(mouseEvent.offsetX, mouseEvent.offsetY, frame, this.props.width, this.props.height);
            this.props.onClicked(frame.getCursorInfo(cursorPosImageSpace));
        }
    };

    handleWheel = (konvaEvent: Konva.KonvaEventObject<WheelEvent>) => {
        const mouseEvent = konvaEvent.evt;
        const frame = this.props.frame;
        const lineHeight = 15;
        const delta = mouseEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? mouseEvent.deltaY : mouseEvent.deltaY * lineHeight;
        if (this.props.frame.wcsInfo && this.props.onZoomed) {
            const cursorPosImageSpace = canvasToTransformedImagePos(mouseEvent.offsetX, mouseEvent.offsetY, frame, this.props.width, this.props.height);
            this.props.onZoomed(this.props.frame.getCursorInfo(cursorPosImageSpace), -delta);
        }
    };

    private handleMouseDown = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        switch (this.props.frame.regionSet.newRegionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.LINE:
                this.regionCreationStart(konvaEvent.evt);
                break;
            case CARTA.RegionType.POINT:
                this.regionCreationStart(konvaEvent.evt);
                this.regionCreationEnd();
                break;
            default:
                break;
        }
    };

    private handleMouseUp = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        this.dragPanning = false;
        switch (this.props.frame.regionSet.newRegionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.LINE:
                this.regionCreationEnd();
                break;
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.POLYLINE:
                if (!this.creatingRegion) {
                    this.regionCreationStart(konvaEvent.evt);
                } else {
                    this.polygonRegionAddPoint(konvaEvent.evt);
                }
                break;
            default:
                break;
        }
    };

    handleMove = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;
        if (this.props.dragPanningEnabled && this.dragPanning) {
            return;
        }

        const frame = this.props.frame;
        if (frame.regionSet.mode === RegionMode.CREATING && this.creatingRegion) {
            switch (this.creatingRegion.regionType) {
                case CARTA.RegionType.RECTANGLE:
                case CARTA.RegionType.ELLIPSE:
                case CARTA.RegionType.LINE:
                    this.RegionCreating(mouseEvent);
                    break;
                case CARTA.RegionType.POLYGON:
                case CARTA.RegionType.POLYLINE:
                    this.polygonRegionCreating(mouseEvent);
                    break;
                default:
                    break;
            }
        } else {
            if (frame.wcsInfo && AppStore.Instance?.activeLayer === ImageViewLayer.DistanceMeasuring && frame.distanceMeasuring.isCreating) {
                this.updateDistanceMeasureFinishPos(mouseEvent.offsetX, mouseEvent.offsetY);
            }
            if (!this.props.cursorFrozen) {
                this.updateCursorPos(mouseEvent.offsetX, mouseEvent.offsetY);
            }
        }
    };

    private handleRegionDoubleClick = (region: RegionStore) => {
        if (this.props.onRegionDoubleClicked) {
            this.props.onRegionDoubleClicked(region);
        }
    };

    @action private handleStageDoubleClick = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (this.mouseClickDistance > DOUBLE_CLICK_DISTANCE * DOUBLE_CLICK_DISTANCE) {
            // Ignore the double click distance longer than DOUBLE_CLICK_DISTANCE
            return;
        }
        if (this.creatingRegion?.regionType === CARTA.RegionType.POLYGON || this.creatingRegion?.regionType === CARTA.RegionType.POLYLINE) {
            this.regionCreationEnd();
        }
    };

    @action onKeyDown = (ev: React.KeyboardEvent) => {
        const frame = this.props.frame;
        if (frame && frame.regionSet.mode === RegionMode.CREATING && this.creatingRegion && ev.keyCode === KEYCODE_ESC) {
            frame.regionSet.deleteRegion(this.creatingRegion);
            this.creatingRegion = null;
            frame.regionSet.setMode(RegionMode.MOVING);
        }
    };

    render() {
        const frame = this.props.frame;
        const regionSet = frame.regionSet;

        let className = "region-stage";
        if (this.props.docked) {
            className += " docked";
        }

        let regionComponents = null;
        if (regionSet && regionSet.regions.length) {
            regionComponents = regionSet.regions
                .filter(r => r.isValid && r.regionId !== 0)
                .sort((a, b) => (a.boundingBoxArea > b.boundingBoxArea ? -1 : 1))
                .map(r => {
                    if (r.regionType === CARTA.RegionType.POLYGON || r.regionType === CARTA.RegionType.LINE || r.regionType === CARTA.RegionType.POLYLINE) {
                        return (
                            <LineSegmentRegionComponent
                                key={r.regionId}
                                region={r}
                                frame={frame}
                                layerWidth={this.props.width}
                                layerHeight={this.props.height}
                                selected={r === regionSet.selectedRegion}
                                onSelect={regionSet.selectRegion}
                                onDoubleClick={this.handleRegionDoubleClick}
                                listening={regionSet.mode !== RegionMode.CREATING && AppStore.Instance?.activeLayer !== ImageViewLayer.DistanceMeasuring}
                                isRegionCornerMode={this.props.isRegionCornerMode}
                            />
                        );
                    } else if (r.regionType === CARTA.RegionType.POINT) {
                        return (
                            <PointRegionComponent
                                key={r.regionId}
                                region={r}
                                frame={frame}
                                layerWidth={this.props.width}
                                layerHeight={this.props.height}
                                selected={r === regionSet.selectedRegion}
                                onSelect={regionSet.selectRegion}
                                onDoubleClick={this.handleRegionDoubleClick}
                            />
                        );
                    } else {
                        return (
                            <SimpleShapeRegionComponent
                                key={r.regionId}
                                region={r}
                                frame={frame}
                                layerWidth={this.props.width}
                                layerHeight={this.props.height}
                                selected={r === regionSet.selectedRegion}
                                onSelect={regionSet.selectRegion}
                                onDoubleClick={this.handleRegionDoubleClick}
                                listening={regionSet.mode !== RegionMode.CREATING && AppStore.Instance?.activeLayer !== ImageViewLayer.DistanceMeasuring}
                                isRegionCornerMode={this.props.isRegionCornerMode}
                            />
                        );
                    }
                });
        }

        let cursorMarker = null;

        if (this.props.cursorFrozen && this.props.cursorPoint) {
            const cursorPosPixelSpace = this.getCursorCanvasPos(this.props.cursorPoint.x, this.props.cursorPoint.y);
            const rotation = frame.spatialReference ? (frame.spatialTransform.rotation * 180.0) / Math.PI : 0.0;

            if (cursorPosPixelSpace) {
                const crosshairLength = 20;
                const crosshairThicknessWide = 3;
                const crosshairThicknessNarrow = 1;
                const crosshairGap = 7;
                cursorMarker = (
                    <Group x={Math.floor(cursorPosPixelSpace.x) + 0.5} y={Math.floor(cursorPosPixelSpace.y) + 0.5} rotation={-rotation}>
                        <Line listening={false} points={[-crosshairLength / 2 - crosshairThicknessWide / 2, 0, -crosshairGap / 2, 0]} strokeWidth={crosshairThicknessWide} stroke="black" />
                        <Line listening={false} points={[crosshairGap / 2, 0, crosshairLength / 2 + crosshairThicknessWide / 2, 0]} strokeWidth={crosshairThicknessWide} stroke="black" />
                        <Line listening={false} points={[0, -crosshairLength / 2 - crosshairThicknessWide / 2, 0, -crosshairGap / 2]} strokeWidth={crosshairThicknessWide} stroke="black" />
                        <Line listening={false} points={[0, crosshairGap / 2, 0, crosshairLength / 2 + crosshairThicknessWide / 2]} strokeWidth={crosshairThicknessWide} stroke="black" />
                        <Rect listening={false} width={crosshairGap - 1} height={crosshairGap - 1} offsetX={crosshairGap / 2 - 0.5} offsetY={crosshairGap / 2 - 0.5} strokeWidth={1} stroke="black" />

                        <Line listening={false} points={[-crosshairLength / 2 - crosshairThicknessNarrow / 2, 0, -crosshairGap / 2, 0]} strokeWidth={crosshairThicknessNarrow} stroke="white" />
                        <Line listening={false} points={[crosshairGap / 2, 0, crosshairLength / 2 + crosshairThicknessNarrow / 2, 0]} strokeWidth={crosshairThicknessNarrow} stroke="white" />
                        <Line listening={false} points={[0, -crosshairLength / 2 - crosshairThicknessNarrow / 2, 0, -crosshairGap / 2]} strokeWidth={crosshairThicknessNarrow} stroke="white" />
                        <Line listening={false} points={[0, crosshairGap / 2, 0, crosshairLength / 2 + crosshairThicknessNarrow / 2]} strokeWidth={crosshairThicknessNarrow} stroke="white" />
                    </Group>
                );
            }
        }

        let creatingLine = null;
        if (this.currentCursorPos && (this.creatingRegion?.regionType === CARTA.RegionType.POLYGON || this.creatingRegion?.regionType === CARTA.RegionType.POLYLINE) && this.creatingRegion.isValid) {
            let firstControlPoint = this.creatingRegion.controlPoints[0];
            let lastControlPoint = this.creatingRegion.controlPoints[this.creatingRegion.controlPoints.length - 1];

            if (frame.spatialReference) {
                firstControlPoint = transformPoint(frame.spatialTransformAST, firstControlPoint, false);
                lastControlPoint = transformPoint(frame.spatialTransformAST, lastControlPoint, false);
            }
            const lineStart = this.getCursorCanvasPos(firstControlPoint.x, firstControlPoint.y);
            const lineEnd = this.getCursorCanvasPos(lastControlPoint.x, lastControlPoint.y);
            let points: number[];
            if (this.creatingRegion.controlPoints.length > 1 && this.creatingRegion?.regionType !== CARTA.RegionType.POLYLINE) {
                points = [lineStart.x, lineStart.y, this.currentCursorPos.x, this.currentCursorPos.y, lineEnd.x, lineEnd.y];
            } else {
                points = [lineEnd.x, lineEnd.y, this.currentCursorPos.x, this.currentCursorPos.y];
            }
            creatingLine = <Line points={points} dash={[5]} stroke={this.creatingRegion.color} strokeWidth={this.creatingRegion.lineWidth} opacity={0.5} lineJoin={"round"} listening={false} perfectDrawEnabled={false} />;
        }

        let cursor: string;

        if (regionSet.mode === RegionMode.CREATING || AppStore.Instance?.activeLayer === ImageViewLayer.DistanceMeasuring) {
            cursor = "crosshair";
        } else if (regionSet.selectedRegion && regionSet.selectedRegion.editing) {
            cursor = "move";
        }

        return (
            <div onKeyDown={this.onKeyDown} tabIndex={0}>
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
                    draggable={regionSet.mode !== RegionMode.CREATING && this.props.dragPanningEnabled}
                    onDragStart={this.handleDragStart}
                    onDragMove={this.handleDragMove}
                    onDragEnd={this.handleDragEnd}
                    x={0}
                    y={0}
                >
                    <Layer>
                        {regionComponents}
                        {creatingLine}
                        {cursorMarker}
                    </Layer>
                </Stage>
            </div>
        );
    }
}
