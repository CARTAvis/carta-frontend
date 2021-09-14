import * as React from "react";
import * as _ from "lodash";
import classNames from "classnames";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {Group, Layer, Line, Rect, Stage} from "react-konva";
import Konva from "konva";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore, OverlayStore, PreferenceStore, RegionMode, RegionStore} from "stores";
import {SimpleShapeRegionComponent} from "./SimpleShapeRegionComponent";
import {LineSegmentRegionComponent} from "./LineSegmentRegionComponent";
import {PointRegionComponent} from "./PointRegionComponent";
import {ImageViewLayer} from "../ImageViewComponent";
import {canvasToImagePos, canvasToTransformedImagePos, imageToCanvasPos, transformedImageToCanvasPos} from "./shared";
import {CursorInfo, Point2D} from "models";
import {average2D, isAstBadPoint, length2D, pointDistanceSquared, scale2D, subtract2D, transformPoint} from "utilities";
import "./RegionViewComponent.scss";

export interface RegionViewComponentProps {
    frame: FrameStore;
    overlaySettings: OverlayStore;
    dragPanningEnabled: boolean;
    docked: boolean;
    width: number;
    height: number;
    left: number;
    top: number;
    cursorFrozen: boolean;
    stageOrigin: Point2D;
    getStageRef: (ref) => void;
    onMoveStageOrigin: (newOrigin: Point2D) => void;
    onClickToCenter: (cursorInfo: CursorInfo) => void;
    onZoomed?: (cursorInfo: CursorInfo, delta: number) => void;
}

const DUPLICATE_POINT_THRESHOLD = 0.01;
const DOUBLE_CLICK_DISTANCE = 5;
const KEYCODE_ESC = 27;

@observer
export class RegionViewComponent extends React.Component<RegionViewComponentProps> {
    @observable creatingRegion: RegionStore;
    @observable currentCursorPos: Point2D;

    private stageRef;
    private regionStartPoint: Point2D;
    private mousePreviousClick: Point2D = {x: -1000, y: -1000};
    private mouseClickDistance: number = 0;
    private dragPanning: boolean;
    private dragOffset: Point2D;
    private initialStagePosition: Point2D;
    private initialDragCenter: Point2D;
    private initialPinchZoom: number;
    private initialPinchDistance: number;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    private getStageRef = (ref) => {
        this.stageRef = ref;
        this.props.getStageRef(ref);
    };

    updateCursorPos = _.throttle((x: number, y: number) => {
        const frame = this.props.frame;
        if (frame.wcsInfo) {
            const imagePos = canvasToTransformedImagePos(x, y, frame, this.props.width, this.props.height);
            this.props.frame.setCursorPosition(imagePos);
        }
    }, 100);

    updateDistanceMeasureFinishPos = _.throttle((x: number, y: number) => {
        const frame = this.props.frame;
        frame.distanceMeasuring.finish = this.getDistanceMeasureImagePos(x, y);
        frame.distanceMeasuring.updateTransformedPos(frame.spatialTransform);
    }, 100);

    private getCursorPosImageSpace = (offsetX: number, offsetY: number): Point2D => {
        const frame = this.props.frame;
        let cursorPosImageSpace = canvasToTransformedImagePos(offsetX, offsetY, frame, this.props.width, this.props.height);
        if (frame.spatialReference) {
            cursorPosImageSpace = transformPoint(frame.spatialTransformAST, cursorPosImageSpace, true);
        }
        return cursorPosImageSpace;
    };

    private getDistanceMeasureImagePos = (offsetX: number, offsetY: number): Point2D => {
        const frame = this.props.frame;
        const frameView = frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
        const spatialTransform = frame.spatialReference?.spatialTransform ?? frame.spatialTransform;
        let imagePos = canvasToImagePos(offsetX, offsetY, frameView, this.props.width, this.props.height, spatialTransform);
        if (frame.spatialReference) {
            imagePos = frame.spatialTransform.transformCoordinate(imagePos, false);
        }
        return imagePos;
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
        if (
            this.creatingRegion.isValid &&
            ((regionType !== CARTA.RegionType.POLYGON && regionType !== CARTA.RegionType.POLYLINE) || this.creatingRegion.controlPoints.length > 2) &&
            (regionType !== CARTA.RegionType.LINE || this.creatingRegion.controlPoints.length === 2)
        ) {
            this.creatingRegion.endCreating();
            frame.regionSet.selectRegion(this.creatingRegion);
        } else {
            frame.regionSet.deleteRegion(this.creatingRegion);
        }

        if (regionType === CARTA.RegionType.POLYGON || regionType === CARTA.RegionType.POLYLINE) {
            // avoid mouse up event triggering region creation start
            setTimeout(() => {
                this.creatingRegion = null;
            }, 1);
        } else {
            this.creatingRegion = null;
        }

        // Switch to moving mode after region creation. Use a timeout to allow the handleClick function to execute first
        setTimeout(() => {
            this.props.frame.regionSet.setMode(RegionMode.MOVING);
            AppStore.Instance.updateActiveLayer(ImageViewLayer.RegionMoving);
        }, 1);
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
        if ((AppStore.Instance.preferenceStore.isRegionCornerMode && !isCtrlPressed) || (!AppStore.Instance.preferenceStore.isRegionCornerMode && isCtrlPressed)) {
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
                if (this.props.frame) {
                    const frame = this.props.frame.spatialReference || this.props.frame;
                    const stagePosition = konvaEvent.target.getStage().getPosition();
                    this.initialStagePosition = stagePosition;
                    this.initialDragCenter = frame.center;
                    frame.startMoving();
                }
            }
        }
    };

    handleDragMove = (konvaEvent: Konva.KonvaEventObject<DragEvent>) => {
        // Only handle stage drag events
        if (konvaEvent.target === konvaEvent.currentTarget) {
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
                const stagePosition = konvaEvent.target.getStage().getPosition();
                this.handlePan(stagePosition);
            }
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
            const stagePosition = konvaEvent.target.getStage().getPosition();
            this.props.onMoveStageOrigin(stagePosition);
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

    handlePan = (currentStagePosition: Point2D) => {
        // ignore invalid offsets
        if (!currentStagePosition || !isFinite(currentStagePosition.x) || !isFinite(currentStagePosition.y)) {
            return;
        }
        if (this.props.frame) {
            const frame = this.props.frame.spatialReference || this.props.frame;
            if (!this.dragOffset) {
                this.dragOffset = {x: 0, y: 0};
            } else {
                this.dragOffset = subtract2D(currentStagePosition, this.initialStagePosition);
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
            const imagePos = this.getDistanceMeasureImagePos(mouseEvent.offsetX, mouseEvent.offsetY);
            const wcsPos = transformPoint(frame.wcsInfo, imagePos);
            if (!isAstBadPoint(wcsPos)) {
                const dist = frame.distanceMeasuring;
                if (!dist.isCreating && !dist.showCurve) {
                    dist.start = imagePos;
                    dist.setIsCreating(true);
                } else if (dist.isCreating) {
                    dist.finish = imagePos;
                    dist.updateTransformedPos(frame.spatialTransform);
                    dist.setIsCreating(false);
                } else {
                    dist.resetPos();
                    dist.start = imagePos;
                    dist.setIsCreating(true);
                }
            }
        }

        // Deselect selected region if in drag-to-pan mode and user clicks on the stage
        if (this.props.dragPanningEnabled && !isSecondaryClick) {
            frame.regionSet.deselectRegion();
        }

        if (frame.wcsInfo && this.props.onClickToCenter && (!this.props.dragPanningEnabled || isSecondaryClick)) {
            const cursorPosImageSpace = canvasToTransformedImagePos(mouseEvent.offsetX, mouseEvent.offsetY, frame, this.props.width, this.props.height);
            this.props.onClickToCenter(frame.getCursorInfo(cursorPosImageSpace));

            // Move stage origin according to center moving track
            const centerOffset = subtract2D({x: mouseEvent.offsetX, y: mouseEvent.offsetY}, {x: this.props.width / 2, y: this.props.height / 2});
            const newStageOrigin = subtract2D(this.stageRef.getPosition(), centerOffset);
            this.props.onMoveStageOrigin(newStageOrigin);
            this.stageRef.x(newStageOrigin.x);
            this.stageRef.y(newStageOrigin.y);
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

    /*
    private handleRegionDoubleClick = (region: RegionStore) => {
        const appStore = AppStore.Instance;
        if (region) {
            const frame = appStore.getFrame(region.fileId);
            if (frame) {
                frame.regionSet.selectRegion(region);
                appStore.dialogStore.showRegionDialog();
            }
        }
    };
    */

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
            AppStore.Instance.updateActiveLayer(ImageViewLayer.RegionMoving);
        }
    };

    render() {
        const frame = this.props.frame;
        const regionSet = frame.regionSet;
        const className = classNames("region-stage", {docked: this.props.docked});

        /*
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
                                isRegionCornerMode={AppStore.Instance.preferenceStore.isRegionCornerMode}
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
                                isRegionCornerMode={AppStore.Instance.preferenceStore.isRegionCornerMode}
                            />
                        );
                    }
                });
        }
        */

        let creatingLine = null;
        if (this.currentCursorPos && (this.creatingRegion?.regionType === CARTA.RegionType.POLYGON || this.creatingRegion?.regionType === CARTA.RegionType.POLYLINE) && this.creatingRegion.isValid) {
            let firstControlPoint = this.creatingRegion.controlPoints[0];
            let lastControlPoint = this.creatingRegion.controlPoints[this.creatingRegion.controlPoints.length - 1];

            if (frame.spatialReference) {
                firstControlPoint = transformPoint(frame.spatialTransformAST, firstControlPoint, false);
                lastControlPoint = transformPoint(frame.spatialTransformAST, lastControlPoint, false);
            }
            const lineStart = transformedImageToCanvasPos(firstControlPoint.x, firstControlPoint.y, frame, this.props.width, this.props.height);
            const lineEnd = transformedImageToCanvasPos(lastControlPoint.x, lastControlPoint.y, frame, this.props.width, this.props.height);
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
                    ref={this.getStageRef}
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
                        {<RegionComponents frame={frame} regions={frame?.regionSet?.regionsForRender} width={this.props.width} height={this.props.height} stageOrigin={this.props.stageOrigin}/>}
                        {/*regionComponents*/}
                    </Layer>
                    <Layer>
                        {this.props.cursorFrozen && <CursorLayerComponent width={this.props.width} height={this.props.height} frame={frame} cursorPoint={frame.cursorInfo.posImageSpace}/>}
                        {creatingLine}
                    </Layer>
                </Stage>
            </div>
        );
    }
}

class RegionComponents extends React.Component<{frame: FrameStore; regions: RegionStore[]; width: number; height: number; stageOrigin: Point2D}> {
    private handleRegionDoubleClicked = (region: RegionStore) => {
        const appStore = AppStore.Instance;
        if (region) {
            const frame = appStore.getFrame(region.fileId);
            if (frame) {
                frame.regionSet.selectRegion(region);
                appStore.dialogStore.showRegionDialog();
            }
        }
    };

    public render() {
        const regions = this.props.regions;
        if (regions?.length) {
            const regionSet = this.props.frame?.regionSet;
            return regions.map(r => {
                const commonProps = {
                    key: r.regionId,
                    region: r,
                    frame: this.props.frame,
                    layerWidth: this.props.width,
                    layerHeight: this.props.height,
                    stageOrigin: this.props.stageOrigin,
                    selected: r === regionSet.selectedRegion,
                    onSelect: regionSet.selectRegion,
                    onDoubleClick: this.handleRegionDoubleClicked
                };

                if (r.regionType === CARTA.RegionType.POINT) {
                    return <PointRegionComponent {...commonProps} />;
                } else {
                    const otherProps = {
                        listening: regionSet.mode !== RegionMode.CREATING && AppStore.Instance?.activeLayer !== ImageViewLayer.DistanceMeasuring,
                        isRegionCornerMode: AppStore.Instance.preferenceStore.isRegionCornerMode
                    };
                    return r.regionType === CARTA.RegionType.POLYGON || r.regionType === CARTA.RegionType.LINE || r.regionType === CARTA.RegionType.POLYLINE ?
                        <LineSegmentRegionComponent {...commonProps} {...otherProps} /> :
                        <SimpleShapeRegionComponent {...commonProps} {...otherProps} />;
                }
            });
        }
        return null;
    }
};

const CursorLayerComponent: React.FC<{width: number; height: number; frame: FrameStore; cursorPoint: Point2D}> = props => {
    const frame = props.frame;
    const width = props.width;
    const height = props.height;

    if (frame) {
        const cursorPosPixelSpace = transformedImageToCanvasPos(props.cursorPoint.x, props.cursorPoint.y, frame, width, height);
        if (cursorPosPixelSpace?.x >= 0 && cursorPosPixelSpace?.x <= width && cursorPosPixelSpace?.y >= 0 && cursorPosPixelSpace?.y <= height) {
            const crosshairLength = 20;
            const crosshairThicknessWide = 3;
            const crosshairThicknessNarrow = 1;
            const crosshairGap = 7;
            const rotation = frame.spatialReference ? (frame.spatialTransform.rotation * 180.0) / Math.PI : 0.0;
            return (
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
    return null;
};
