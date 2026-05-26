import * as React from "react";
import {Layer, Line, Rect, Stage} from "react-konva";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import type Konva from "konva";
import * as _ from "lodash";
import {action, type IReactionDisposer, makeObservable, observable, reaction, runInAction} from "mobx";
import {observer} from "mobx-react";

import {DialogId, ImageViewLayer, RegionMode} from "enums";
import {type CursorInfo, type Point2D, ZoomPoint} from "models";
import {AppStore, PreferenceStore} from "stores";
import {type FrameStore, type RegionStore} from "stores/Frame";
import {add2D, average2D, getRectFromPoints, length2D, pointDistanceSquared, type Rect2D, scale2D, subtract2D, transformPoint} from "utilities";

import {CompassAnnotation, RulerAnnotation} from "./CompassAndRulerAnnotationComponent";
import {CursorRegionComponent} from "./CursorRegionComponent";
import {LineSegmentRegionComponent} from "./LineSegmentRegionComponent";
import {PointRegionComponent} from "./PointRegionComponent";
import {isRegionInSelectionRect} from "./regionSelectionCanvasGeometry";
import {adjustPosToMutatedStage, canvasToImagePos, canvasToTransformedImagePos, imageToCanvasPos, transformedImageToCanvasPos} from "./shared";
import {SimpleShapeRegionComponent} from "./SimpleShapeRegionComponent";

import "./RegionViewComponent.scss";

export interface RegionViewComponentProps {
    frame: FrameStore;
    dragPanningEnabled: boolean;
    docked: boolean;
    width: number;
    height: number;
    left: number;
    top: number;
    onClickToCenter: (cursorInfo: CursorInfo) => void;
}

const LINE_HEIGHT = 15;
const DUPLICATE_POINT_THRESHOLD = 0.01;
const DOUBLE_CLICK_DISTANCE = 5;
const KEYCODE_ESC = 27;
const POINTER_DRAG_THRESHOLD = 4;

interface RegionSelectionBox {
    start: Point2D;
    end: Point2D;
}

interface MiddleClickPanState {
    dragNode: Konva.Node;
    start: Point2D;
    started: boolean;
}

type SuppressedClickButton = number | "all";

@observer
export class RegionViewComponent extends React.Component<RegionViewComponentProps> {
    @observable creatingRegion: RegionStore | null = null;
    @observable currentCursorPos: Point2D = {x: 0, y: 0};
    @observable private regionSelectionBox: RegionSelectionBox | null = null;
    @observable private frame: FrameStore;

    private readonly disposers: IReactionDisposer[] = [];
    private stageRef;
    private stageResizeOffset: Point2D;
    private regionStartPoint: Point2D;
    private mousePreviousClick: Point2D = {x: -1000, y: -1000};
    private mouseClickDistance: number = 0;
    private dragPanning: boolean;
    private initialStagePosition: Point2D;
    private initialDragCenter: Point2D;
    private initialPinchZoom: number;
    private initialPinchDistance: number;
    private suppressedClickButton: SuppressedClickButton | null = null;
    private suppressNextRegionClickSelection = false;
    private regionSelectionStartedOnRegion = false;
    private regionSelectionDragNode: Konva.Node | null = null;
    private middleClickPan: MiddleClickPanState | null = null;
    private layerRef = React.createRef<any>();

    constructor(props: any) {
        super(props);

        this.frame = props.frame;
        this.stageRef = React.createRef();
        this.stageResizeOffset = {x: 0, y: 0};

        makeObservable(this);

        // Sync stage when matched, tracking frame's spatialReference only.
        this.disposers.push(
            reaction(
                () => this.frame?.spatialReference,
                spatialReference => {
                    if (spatialReference) {
                        this.syncStage(spatialReference.centerMovement, spatialReference.zoomLevel);
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => {
                    const frame = this.frame;
                    if (frame) {
                        if (frame.spatialReference) {
                            // Update stage when spatial reference move/zoom(frame is sibling),
                            // tracking spatial reference's centerMovement/zoomLevel to move/zoom stage.
                            return {centerMovement: frame.spatialReference.centerMovement, zoom: frame.spatialReference.zoomLevel};
                        }
                        return {centerMovement: frame.centerMovement, zoom: frame.zoomLevel};
                    }
                    return undefined;
                },
                (reference, prevReference) => {
                    const frame = this.frame;
                    if (reference && (reference.centerMovement.x !== prevReference?.centerMovement?.x || reference.centerMovement.y !== prevReference?.centerMovement?.y || reference.zoom !== prevReference?.zoom) && frame) {
                        this.syncStage(reference.centerMovement, reference.zoom);
                    }
                }
            )
        );
    }

    componentDidMount() {
        const frame = this.frame?.spatialReference ?? this.frame;
        if (frame) {
            this.syncStage(frame.centerMovement, frame.zoomLevel);
        }
    }

    componentWillUnmount() {
        this.restoreRegionSelectionDragNode();
        this.restoreMiddleClickPan();
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    }

    @action componentDidUpdate(prevProps) {
        // Update observable frame when props change
        if (prevProps.frame !== this.props.frame) {
            this.frame = this.props.frame;
        }

        // Resizing image viewer triggers re-render of region view,
        // and regions' coordinates change accordingly under the stage's position & scale if zoom =\= 1,
        // therefore the offset must be saved in order to center the stage correctly.
        if (prevProps.width !== this.props.width || prevProps.height !== this.props.height) {
            const stage = this.stageRef.current;
            if (stage) {
                const offset = {x: ((this.props.width - prevProps.width) / 2) * this.frame.aspectRatio, y: (this.props.height - prevProps.height) / 2};
                const zoom = stage.scaleX();
                const mutatedOffset = scale2D(offset, (1 - zoom) / zoom);
                this.stageResizeOffset = add2D(this.stageResizeOffset, mutatedOffset);

                const frame = this.frame?.spatialReference ?? this.frame;
                if (frame) {
                    this.syncStage(frame.centerMovement, frame.zoomLevel);
                }
            }
        }
    }

    updateCursorPos = _.throttle((x: number, y: number) => {
        const frame = this.frame;
        if (frame.wcsInfo) {
            const imagePos = canvasToTransformedImagePos(x, y, frame, this.props.width, this.props.height);
            this.frame.setCursorPosition(imagePos);
        }
    }, 100);

    private getCursorPosImageSpace = (offsetX: number, offsetY: number): Point2D => {
        const frame = this.frame;
        let cursorPosImageSpace = canvasToTransformedImagePos(offsetX, offsetY, frame, this.props.width, this.props.height);
        if (frame.spatialReference && frame.spatialTransformAST) {
            cursorPosImageSpace = transformPoint(frame.spatialTransformAST, cursorPosImageSpace, true);
        }
        return cursorPosImageSpace;
    };

    @action private regionCreationStart = (mouseEvent: MouseEvent) => {
        if (this.creatingRegion) {
            return;
        }
        const frame = this.frame;
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
            case CARTA.RegionType.ANNPOINT:
                this.creatingRegion = frame.regionSet.addAnnPointRegion(cursorPosImageSpace, frame.pointShapeCache, false);
                this.regionStartPoint = cursorPosImageSpace;
                break;
            case CARTA.RegionType.ANNRECTANGLE:
                this.creatingRegion = frame.regionSet.addAnnRectangularRegion(cursorPosImageSpace, 0, 0, true);
                this.regionStartPoint = cursorPosImageSpace;
                break;
            case CARTA.RegionType.ANNELLIPSE:
                this.creatingRegion = frame.regionSet.addAnnEllipticalRegion(cursorPosImageSpace, 0, 0, true);
                this.regionStartPoint = cursorPosImageSpace;
                break;
            case CARTA.RegionType.ANNPOLYGON:
                this.creatingRegion = frame.regionSet.addAnnPolygonalRegion([cursorPosImageSpace], true);
                this.polygonRegionCreating(mouseEvent);
                break;
            case CARTA.RegionType.ANNLINE:
                this.creatingRegion = frame.regionSet.addAnnLineRegion([cursorPosImageSpace, cursorPosImageSpace], true);
                this.regionStartPoint = cursorPosImageSpace;
                break;
            case CARTA.RegionType.ANNPOLYLINE:
                this.creatingRegion = frame.regionSet.addAnnPolylineRegion([cursorPosImageSpace], true);
                this.polygonRegionCreating(mouseEvent);
                break;
            case CARTA.RegionType.ANNVECTOR:
                this.creatingRegion = frame.regionSet.addAnnVectorRegion([cursorPosImageSpace, cursorPosImageSpace], true);
                this.regionStartPoint = cursorPosImageSpace;
                break;
            case CARTA.RegionType.ANNTEXT:
                this.creatingRegion = frame.regionSet.addAnnTextRegion(cursorPosImageSpace, 0, 0, true);
                this.regionStartPoint = cursorPosImageSpace;
                break;
            case CARTA.RegionType.ANNCOMPASS:
                this.creatingRegion = frame.regionSet.addAnnCompassRegion(cursorPosImageSpace, 100, true);
                this.regionStartPoint = cursorPosImageSpace;
                break;
            case CARTA.RegionType.ANNRULER:
                this.creatingRegion = frame.regionSet.addAnnRulerRegion([cursorPosImageSpace, cursorPosImageSpace], true);
                this.regionStartPoint = cursorPosImageSpace;
                break;
            default:
                return;
        }
        this.creatingRegion.beginCreating();
    };

    @action private regionCreationEnd = (mouseEvent?: MouseEvent) => {
        let frame = this.frame;
        if (!this.creatingRegion || frame.regionSet.mode !== RegionMode.CREATING) {
            return;
        }
        const regionType = this.frame.regionSet.newRegionType;
        switch (regionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.LINE:
            case CARTA.RegionType.ANNLINE:
            case CARTA.RegionType.ANNVECTOR:
            case CARTA.RegionType.ANNTEXT:
                frame = this.frame.spatialReference || this.frame;
                if (this.creatingRegion.controlPoints.length > 1 && length2D(this.creatingRegion.size) === 0) {
                    const scaleFactor =
                        (PreferenceStore.Instance.regionSize * (this.creatingRegion.regionType === CARTA.RegionType.RECTANGLE || this.creatingRegion.regionType === CARTA.RegionType.ANNRECTANGLE ? 1.0 : 0.5)) / frame.zoomLevel;
                    this.creatingRegion.setSize(scale2D(this.creatingRegion.regionType === CARTA.RegionType.LINE ? {x: 2, y: 0} : {x: 1, y: 1}, scaleFactor));
                }
                break;
            case CARTA.RegionType.ANNCOMPASS:
            case CARTA.RegionType.ANNRULER:
            case CARTA.RegionType.POINT:
            case CARTA.RegionType.ANNPOINT:
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.ANNPOLYGON:
            case CARTA.RegionType.POLYLINE:
            case CARTA.RegionType.ANNPOLYLINE:
                break;
            default:
                return;
        }

        const isCreatingPolygonalRegion = this.creatingRegion.isPolygonalRegion;

        // Handle region completion
        if (
            this.creatingRegion.isValid &&
            (!isCreatingPolygonalRegion || this.creatingRegion.controlPoints.length > 2) &&
            ((regionType !== CARTA.RegionType.LINE && regionType !== CARTA.RegionType.ANNLINE && regionType !== CARTA.RegionType.ANNVECTOR) || this.creatingRegion.controlPoints.length === 2)
        ) {
            this.creatingRegion.endCreating();
            frame.regionSet.selectSingleRegion(this.creatingRegion);
        } else {
            frame.regionSet.deleteRegion(this.creatingRegion);
        }

        if (isCreatingPolygonalRegion) {
            // avoid mouse up event triggering region creation start
            setTimeout(() => {
                runInAction(() => {
                    this.creatingRegion = null;
                });
            }, 1);
        } else {
            this.creatingRegion = null;
        }

        // Switch to moving mode after region creation. Use a timeout to allow the handleClick function to execute first
        setTimeout(() => {
            this.frame.regionSet.setMode(RegionMode.MOVING);
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

    private regionCreating(mouseEvent: MouseEvent) {
        if (!this.creatingRegion) {
            return;
        }
        const cursorPosImageSpace = this.getCursorPosImageSpace(mouseEvent.offsetX, mouseEvent.offsetY);
        const frame = this.frame;
        const zoomLevel = frame.spatialReference?.zoomLevel || frame.zoomLevel;

        let dx = cursorPosImageSpace.x - this.regionStartPoint.x;
        let dy = cursorPosImageSpace.y - this.regionStartPoint.y;
        if (mouseEvent.shiftKey && this.creatingRegion.regionType !== CARTA.RegionType.LINE) {
            const maxDiff = Math.max(Math.abs(dx), Math.abs(dy));
            dx = Math.sign(dx) * maxDiff;
            dy = Math.sign(dy) * maxDiff;
        }
        const isCtrlPressed = mouseEvent.ctrlKey || mouseEvent.metaKey;
        const isRegionCornerMode = AppStore.Instance.preferenceStore.isRegionCornerMode;
        if ((isRegionCornerMode && !isCtrlPressed) || (!isRegionCornerMode && isCtrlPressed)) {
            // corner-to-corner region creation
            const endPoint = {x: this.regionStartPoint.x + dx, y: this.regionStartPoint.y + dy};
            const center = {x: (this.regionStartPoint.x + endPoint.x) / 2.0, y: (this.regionStartPoint.y + endPoint.y) / 2.0};
            switch (this.creatingRegion.regionType) {
                case CARTA.RegionType.RECTANGLE:
                case CARTA.RegionType.ANNRECTANGLE:
                    this.creatingRegion.setControlPoints([center, {x: Math.abs(dx), y: Math.abs(dy)}]);
                    break;
                case CARTA.RegionType.ANNTEXT:
                    this.creatingRegion.setControlPoints([center, {x: Math.abs((dx * zoomLevel) / AppStore.Instance.imageRatio), y: Math.abs((dy * zoomLevel) / AppStore.Instance.imageRatio)}]);
                    break;
                case CARTA.RegionType.ELLIPSE:
                case CARTA.RegionType.ANNELLIPSE:
                    this.creatingRegion.setControlPoints([center, {y: Math.abs(dx) / 2.0, x: Math.abs(dy) / 2.0}]);
                    break;
                case CARTA.RegionType.LINE:
                case CARTA.RegionType.ANNLINE:
                case CARTA.RegionType.ANNVECTOR:
                case CARTA.RegionType.ANNRULER:
                    this.creatingRegion.setControlPoints([this.regionStartPoint, cursorPosImageSpace]);
                    break;
                default:
                    break;
            }
        } else {
            // center-to-corner region creation
            switch (this.creatingRegion.regionType) {
                case CARTA.RegionType.RECTANGLE:
                case CARTA.RegionType.ANNRECTANGLE:
                    this.creatingRegion.setControlPoints([this.regionStartPoint, {x: 2 * Math.abs(dx), y: 2 * Math.abs(dy)}]);
                    break;
                case CARTA.RegionType.ANNTEXT:
                    this.creatingRegion.setControlPoints([this.regionStartPoint, {x: 2 * Math.abs((dx * zoomLevel) / AppStore.Instance.imageRatio), y: 2 * Math.abs((dy * zoomLevel) / AppStore.Instance.imageRatio)}]);
                    break;
                case CARTA.RegionType.ELLIPSE:
                case CARTA.RegionType.ANNELLIPSE:
                    this.creatingRegion.setControlPoints([this.regionStartPoint, {y: Math.abs(dx), x: Math.abs(dy)}]);
                    break;
                case CARTA.RegionType.LINE:
                case CARTA.RegionType.ANNLINE:
                case CARTA.RegionType.ANNVECTOR:
                    this.creatingRegion.setControlPoints([{x: cursorPosImageSpace.x - 2 * dx, y: cursorPosImageSpace.y - 2 * dy}, cursorPosImageSpace]);
                    break;
                case CARTA.RegionType.ANNRULER:
                    this.creatingRegion.setControlPoints([this.regionStartPoint, cursorPosImageSpace]);
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
        if (this.regionSelectionBox) {
            return;
        }

        // Only handle stage drag events
        if (konvaEvent.target === konvaEvent.currentTarget) {
            if (this.props.dragPanningEnabled) {
                this.dragPanning = true;
                if (this.frame) {
                    const frame = this.frame.spatialReference || this.frame;
                    const stage = konvaEvent.target.getStage();
                    if (stage) {
                        const stagePosition = stage.getPosition();
                        this.initialStagePosition = stagePosition;
                        this.initialDragCenter = frame.center;
                        frame.startMoving();
                    }
                }
            }
        }
    };

    handleDragMove = (konvaEvent: Konva.KonvaEventObject<DragEvent>) => {
        if (this.regionSelectionBox) {
            return;
        }

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
                const stage = konvaEvent.target.getStage();
                if (stage) {
                    const stagePosition = stage.getPosition();
                    this.handlePan(stagePosition);
                }
            }
        }
    };

    handleDragEnd = (konvaEvent: Konva.KonvaEventObject<DragEvent>) => {
        if (this.regionSelectionBox) {
            return;
        }

        this.finishMiddleClickPan();

        // Only handle stage drag events
        if (konvaEvent.target === konvaEvent.currentTarget) {
            this.dragPanning = false;
            const frame = this.frame;

            if (frame) {
                frame.endMoving();
            }
        }
        this.initialPinchDistance = -1;
        this.initialPinchZoom = -1;
    };

    handlePinch = (touch0: Point2D, touch1: Point2D) => {
        const frame = this.frame;

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
        if (this.frame) {
            const frame = this.frame.spatialReference || this.frame;
            const dragOffset = subtract2D(currentStagePosition, this.initialStagePosition);
            const initialCenterCanvasSpace = imageToCanvasPos(this.initialDragCenter.x, this.initialDragCenter.y, frame.requiredFrameView, this.props.width, this.props.height);
            const newCenterCanvasSpace = subtract2D(initialCenterCanvasSpace, dragOffset);
            const newCenterImageSpace = canvasToImagePos(newCenterCanvasSpace.x, newCenterCanvasSpace.y, frame.requiredFrameView, this.props.width, this.props.height);
            frame.setCenter(newCenterImageSpace.x, newCenterImageSpace.y);
        }
    };

    handleClick = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;
        const frame = this.frame;

        if (this.shouldSuppressClick(mouseEvent)) {
            return;
        }

        const isSecondaryClick = mouseEvent.button !== 0 || mouseEvent.ctrlKey || mouseEvent.metaKey;

        // Record click position and distance
        this.mouseClickDistance = pointDistanceSquared(mouseEvent, this.mousePreviousClick);
        this.mousePreviousClick = {x: mouseEvent.x, y: mouseEvent.y};

        // Ignore clicks that aren't on the stage. Allow middle-click to pass through for panning,
        // but block modifier-clicks on regions so they don't pan/center when clicking a region.
        const isMiddleClick = mouseEvent.button === 1;
        if (konvaEvent.target !== konvaEvent.currentTarget && !isMiddleClick) {
            return;
        }

        // Ignore region creation mode clicks
        if (frame.regionSet.mode === RegionMode.CREATING && mouseEvent.button === 0) {
            return;
        }

        // Clicking on empty stage in drag-to-pan mode should clear selection and highlight cursor region.
        if (this.props.dragPanningEnabled && !isSecondaryClick && mouseEvent.button === 0) {
            frame.regionSet.clearSelection();
        }

        if (frame.wcsInfo && this.props.onClickToCenter && (!this.props.dragPanningEnabled || isSecondaryClick)) {
            const cursorPosImageSpace = canvasToTransformedImagePos(mouseEvent.offsetX, mouseEvent.offsetY, frame, this.props.width, this.props.height);
            this.props.onClickToCenter(frame.getCursorInfo(cursorPosImageSpace));
        }
    };

    private syncStage = (refCenterMovement: Point2D, refFrameZoom: number) => {
        const stage = this.stageRef.current;
        if (stage && refCenterMovement && isFinite(refCenterMovement.x) && isFinite(refCenterMovement.y) && isFinite(refFrameZoom)) {
            stage.scale({x: refFrameZoom / AppStore.Instance.imageRatio, y: refFrameZoom / AppStore.Instance.imageRatio});
            const origin = {x: (this.props.width * (1 - refFrameZoom * this.frame.aspectRatio)) / 2, y: (this.props.height * (1 - refFrameZoom)) / 2};
            const centerMovementCanvas = {x: refCenterMovement.x * ((refFrameZoom * this.frame.aspectRatio) / devicePixelRatio), y: -refCenterMovement.y * (refFrameZoom / devicePixelRatio)};
            const newOrigin = add2D(origin, centerMovementCanvas);
            // Correct the origin if region view is ever resized
            const correctedOrigin = subtract2D(newOrigin, scale2D(this.stageResizeOffset, refFrameZoom));
            stage.position(correctedOrigin);
        }
    };

    public stageZoomToPoint = (x: number, y: number, zoom: number) => {
        const stage = this.stageRef.current;
        if (stage) {
            const oldScale = stage.scaleX();
            const origin = stage.getPosition();
            const cursorPointTo = {
                x: (x - origin.x) / oldScale,
                y: (y - origin.y) / oldScale
            };
            const newOrigin = {
                x: x - cursorPointTo.x * zoom,
                y: y - cursorPointTo.y * zoom
            };
            stage.scale({x: zoom, y: zoom});
            stage.position(newOrigin);
        }
    };

    handleWheel = (konvaEvent: Konva.KonvaEventObject<WheelEvent>) => {
        const mouseEvent = konvaEvent.evt;
        const frame = this.frame;
        if (frame) {
            const cursorPosImageSpace = canvasToTransformedImagePos(mouseEvent.offsetX, mouseEvent.offsetY, frame, this.props.width, this.props.height);
            const delta = -mouseEvent.deltaY * (mouseEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? 1 : LINE_HEIGHT);
            const zoomSpeed = 1 + Math.abs(delta / 750.0);

            // If frame is spatially matched, apply zoom to the reference frame, rather than the active frame
            const newZoom = (frame.spatialReference ? frame.spatialReference.zoomLevel : frame.zoomLevel) * (delta > 0 ? zoomSpeed : 1.0 / zoomSpeed);
            frame.zoomToPoint(cursorPosImageSpace.x, cursorPosImageSpace.y, newZoom, true);

            // Zoom stage
            const zoomCenter = PreferenceStore.Instance.zoomPoint === ZoomPoint.CURSOR ? {x: mouseEvent.offsetX, y: mouseEvent.offsetY} : {x: this.props.width / 2, y: this.props.height / 2};
            this.stageZoomToPoint(zoomCenter.x, zoomCenter.y, newZoom);
        }
    };

    private shouldStartRegionSelection = (konvaEvent: Konva.KonvaEventObject<MouseEvent>): boolean => {
        const mouseEvent = konvaEvent.evt;
        const targetId = konvaEvent.target?.id?.();
        return mouseEvent.button === 0 && mouseEvent.shiftKey && !targetId && !this.frame.regionSet.isLocked;
    };

    private getRegionSelectionCanvasPoint = (mouseEvent: MouseEvent): Point2D => {
        return adjustPosToMutatedStage({x: mouseEvent.offsetX, y: mouseEvent.offsetY}, this.stageRef.current);
    };

    private disableDraggableNode = (node: Konva.Node): Konva.Node => {
        node.draggable(false);
        return node;
    };

    private restoreDraggableNode = (node: Konva.Node | null): void => {
        if (node) {
            node.draggable(true);
        }
    };

    private restoreRegionSelectionDragNode = (): void => {
        this.restoreDraggableNode(this.regionSelectionDragNode);
        this.regionSelectionDragNode = null;
    };

    private restoreMiddleClickPan = (): void => {
        if (this.middleClickPan) {
            this.restoreDraggableNode(this.middleClickPan.dragNode);
        }
        this.middleClickPan = null;
    };

    private suppressNextClick = (button: SuppressedClickButton = "all"): void => {
        this.suppressedClickButton = button;
    };

    private clearSuppressedClick = (button?: number): void => {
        if (this.suppressedClickButton && (button === undefined || this.suppressedClickButton === "all" || this.suppressedClickButton === button)) {
            this.suppressedClickButton = null;
        }
    };

    private shouldSuppressClick = (mouseEvent: MouseEvent): boolean => {
        if (!this.suppressedClickButton) {
            return false;
        }

        if (this.suppressedClickButton === "all" || this.suppressedClickButton === mouseEvent.button) {
            this.suppressedClickButton = null;
            return true;
        }

        return false;
    };

    private finishMiddleClickPan = (): void => {
        const shouldSuppressClick = this.middleClickPan?.started;
        this.restoreMiddleClickPan();
        if (shouldSuppressClick) {
            this.suppressNextClick(1);
        }
    };

    private getRegionSelectionDragNode = (konvaEvent: Konva.KonvaEventObject<MouseEvent>): Konva.Node | null => {
        let node: Konva.Node | null = konvaEvent.target;
        while (node && node !== konvaEvent.currentTarget) {
            if (node.draggable()) {
                return node;
            }
            node = node.getParent();
        }
        return null;
    };

    private shouldSuppressRegionSelection = (evt?: MouseEvent): boolean => {
        if (evt?.button === 0 && this.suppressNextRegionClickSelection) {
            this.suppressNextRegionClickSelection = false;
            return true;
        }
        return false;
    };

    @action private handleStageMouseDown = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (this.frame.regionSet.mode === RegionMode.CREATING) {
            this.handleMouseDown(konvaEvent);
            return;
        }

        const mouseEvent = konvaEvent.evt;
        if (mouseEvent.button === 1) {
            this.clearSuppressedClick(1);
        }
        if (this.props.dragPanningEnabled && mouseEvent.button === 1 && konvaEvent.target !== konvaEvent.currentTarget) {
            const dragNode = this.getRegionSelectionDragNode(konvaEvent);
            if (dragNode) {
                this.middleClickPan = {
                    dragNode: this.disableDraggableNode(dragNode),
                    start: {x: mouseEvent.x, y: mouseEvent.y},
                    started: false
                };
            }
            return;
        }

        if (this.shouldStartRegionSelection(konvaEvent)) {
            const start = this.getRegionSelectionCanvasPoint(mouseEvent);
            this.regionSelectionBox = {start, end: start};
            this.regionSelectionStartedOnRegion = konvaEvent.target !== konvaEvent.currentTarget;
            const dragNode = this.regionSelectionStartedOnRegion ? this.getRegionSelectionDragNode(konvaEvent) : null;
            if (dragNode) {
                this.regionSelectionDragNode = this.disableDraggableNode(dragNode);
            }
            this.suppressNextClick();
        }
    };

    private handleMouseDown = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        switch (this.frame.regionSet.newRegionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.LINE:
            case CARTA.RegionType.ANNLINE:
            case CARTA.RegionType.ANNVECTOR:
            case CARTA.RegionType.ANNTEXT:
            case CARTA.RegionType.ANNRULER:
                this.regionCreationStart(konvaEvent.evt);
                break;
            case CARTA.RegionType.POINT:
            case CARTA.RegionType.ANNPOINT:
            case CARTA.RegionType.ANNCOMPASS:
                this.regionCreationStart(konvaEvent.evt);
                this.regionCreationEnd();
                break;
            default:
                break;
        }
    };

    @action private handleStageMouseUp = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        this.finishMiddleClickPan();

        if (this.regionSelectionBox) {
            this.finishRegionSelection();
            return;
        }

        if (this.frame.regionSet.mode === RegionMode.CREATING) {
            this.handleMouseUp(konvaEvent);
        }
    };

    private handleMouseUp = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        this.dragPanning = false;
        switch (this.frame.regionSet.newRegionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.LINE:
            case CARTA.RegionType.ANNLINE:
            case CARTA.RegionType.ANNVECTOR:
            case CARTA.RegionType.ANNTEXT:
            case CARTA.RegionType.ANNRULER:
                this.regionCreationEnd();
                break;
            case CARTA.RegionType.POLYGON:
            case CARTA.RegionType.ANNPOLYGON:
            case CARTA.RegionType.POLYLINE:
            case CARTA.RegionType.ANNPOLYLINE:
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

    @action handleMove = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;
        if (this.regionSelectionBox) {
            this.regionSelectionBox.end = this.getRegionSelectionCanvasPoint(mouseEvent);
            return;
        }

        if (this.middleClickPan && !this.middleClickPan.started) {
            if (mouseEvent.buttons & 4) {
                const dragDistance = pointDistanceSquared(mouseEvent, this.middleClickPan.start);
                if (dragDistance < POINTER_DRAG_THRESHOLD * POINTER_DRAG_THRESHOLD) {
                    return;
                }
                this.middleClickPan.started = true;
                this.stageRef.current?.startDrag();
            } else {
                this.restoreMiddleClickPan();
            }
            return;
        }

        if (this.props.dragPanningEnabled && this.dragPanning) {
            return;
        }

        const frame = this.frame;
        if (frame.regionSet.mode === RegionMode.CREATING && this.creatingRegion) {
            switch (this.creatingRegion.regionType) {
                case CARTA.RegionType.RECTANGLE:
                case CARTA.RegionType.ANNRECTANGLE:
                case CARTA.RegionType.ELLIPSE:
                case CARTA.RegionType.ANNELLIPSE:
                case CARTA.RegionType.LINE:
                case CARTA.RegionType.ANNLINE:
                case CARTA.RegionType.ANNVECTOR:
                case CARTA.RegionType.ANNTEXT:
                case CARTA.RegionType.ANNRULER:
                    this.regionCreating(mouseEvent);
                    break;
                case CARTA.RegionType.POLYGON:
                case CARTA.RegionType.ANNPOLYGON:
                case CARTA.RegionType.POLYLINE:
                case CARTA.RegionType.ANNPOLYLINE:
                    this.polygonRegionCreating(mouseEvent);
                    break;
                default:
                    break;
            }
        } else {
            if (!AppStore.Instance.isCursorFrozen) {
                this.updateCursorPos(mouseEvent.offsetX, mouseEvent.offsetY);
                if (this.frame !== AppStore.Instance.hoveredFrame) {
                    AppStore.Instance.setHoveredFrame(this.frame);
                }
            }
        }
    };

    private getRegionSelectionRect = (): Rect2D | undefined => {
        if (!this.regionSelectionBox) {
            return undefined;
        }
        const {start, end} = this.regionSelectionBox;
        return getRectFromPoints(start, end);
    };

    private isSelectionRectLargeEnough = (rect: Rect2D): boolean => {
        return rect.width >= POINTER_DRAG_THRESHOLD && rect.height >= POINTER_DRAG_THRESHOLD;
    };

    @action private finishRegionSelection = () => {
        const selectionRect = this.getRegionSelectionRect();
        const isLargeEnough = !!selectionRect && this.isSelectionRectLargeEnough(selectionRect);
        this.suppressNextRegionClickSelection = this.regionSelectionStartedOnRegion && isLargeEnough;
        this.regionSelectionStartedOnRegion = false;
        this.regionSelectionBox = null;
        this.restoreRegionSelectionDragNode();
        this.clearSuppressedClick();

        if (!selectionRect || !isLargeEnough) {
            return;
        }

        const selectionGeometryContext = {
            frame: this.frame,
            layerWidth: this.props.width,
            layerHeight: this.props.height,
            stage: this.stageRef.current
        };
        const selectedIds = this.frame.regionSet.regionsAndAnnotationsForRender
            .filter(region => region.isVisible && !region.isLocked && isRegionInSelectionRect(region, selectionRect, selectionGeometryContext))
            .map(region => region.regionId);

        this.frame.regionSet.applyRegionBoxSelection(selectedIds);
    };

    @action private handleStageDoubleClick = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (this.mouseClickDistance > DOUBLE_CLICK_DISTANCE * DOUBLE_CLICK_DISTANCE) {
            // Ignore the double click distance longer than DOUBLE_CLICK_DISTANCE
            return;
        }
        if (this.creatingRegion?.isPolygonalRegion) {
            this.regionCreationEnd();
        }
    };

    @action onKeyDown = (ev: React.KeyboardEvent) => {
        const frame = this.frame;
        if (frame && frame.regionSet.mode === RegionMode.CREATING && this.creatingRegion && ev.keyCode === KEYCODE_ESC) {
            frame.regionSet.deleteRegion(this.creatingRegion);
            this.creatingRegion = null;
            frame.regionSet.setMode(RegionMode.MOVING);
            AppStore.Instance.updateActiveLayer(ImageViewLayer.RegionMoving);
        }
    };

    render() {
        const frame = this.frame;
        const regionSet = frame.regionSet;
        const className = classNames("region-stage", {docked: this.props.docked});

        AppStore.Instance.updateLayerPixelRatio(this.layerRef);

        let creatingLine: JSX.Element | null = null;
        const selectionRect = this.getRegionSelectionRect();
        const selectionBox =
            selectionRect && this.isSelectionRectLargeEnough(selectionRect) ? (
                <Rect x={selectionRect.x} y={selectionRect.y} width={selectionRect.width} height={selectionRect.height} fill={"rgba(45, 114, 210, 0.12)"} stroke={"#2D72D2"} strokeWidth={1} listening={false} />
            ) : null;
        if (this.currentCursorPos && this.creatingRegion?.isPolygonalRegion && this.creatingRegion.isValid) {
            let firstControlPoint = this.creatingRegion.controlPoints[0];
            let lastControlPoint = this.creatingRegion.controlPoints[this.creatingRegion.controlPoints.length - 1];

            if (frame.spatialReference && frame.spatialTransformAST) {
                firstControlPoint = transformPoint(frame.spatialTransformAST, firstControlPoint, false);
                lastControlPoint = transformPoint(frame.spatialTransformAST, lastControlPoint, false);
            }
            const lineStart = transformedImageToCanvasPos(firstControlPoint, frame, this.props.width, this.props.height, this.stageRef.current);
            const lineEnd = transformedImageToCanvasPos(lastControlPoint, frame, this.props.width, this.props.height, this.stageRef.current);
            const cusorCanvasPos = adjustPosToMutatedStage(this.currentCursorPos, this.stageRef.current);
            let points: number[];
            if (this.creatingRegion.controlPoints.length > 1 && this.creatingRegion?.regionType !== CARTA.RegionType.POLYLINE && this.creatingRegion?.regionType !== CARTA.RegionType.ANNPOLYLINE) {
                points = [lineStart.x ?? 0, lineStart.y ?? 0, cusorCanvasPos.x ?? 0, cusorCanvasPos.y ?? 0, lineEnd.x ?? 0, lineEnd.y ?? 0];
            } else {
                points = [lineEnd.x ?? 0, lineEnd.y ?? 0, cusorCanvasPos.x ?? 0, cusorCanvasPos.y ?? 0];
            }
            creatingLine = (
                <Line points={points} dash={[5]} stroke={this.creatingRegion.color} strokeWidth={this.creatingRegion.lineWidth} strokeScaleEnabled={false} opacity={0.5} lineJoin={"round"} listening={false} perfectDrawEnabled={false} />
            );
        }

        let cursor: string = "default";
        if (regionSet.mode === RegionMode.CREATING) {
            cursor = "crosshair";
        } else if (regionSet.focusedRegion && regionSet.focusedRegion.isEditing) {
            cursor = "move";
        } else if (regionSet.focusedRegion === regionSet.regions[0] || !regionSet.focusedRegion) {
            cursor = "default";
        }

        return (
            <div onKeyDown={this.onKeyDown} tabIndex={0}>
                <Stage
                    ref={this.stageRef}
                    className={className}
                    width={this.props.width}
                    height={this.props.height}
                    style={{left: this.props.left, top: this.props.top, cursor}}
                    onClick={this.handleClick}
                    onWheel={this.handleWheel}
                    onMouseMove={this.handleMove}
                    onDblClick={this.handleStageDoubleClick}
                    onMouseDown={this.handleStageMouseDown}
                    onMouseUp={this.handleStageMouseUp}
                    draggable={regionSet.mode !== RegionMode.CREATING && this.props.dragPanningEnabled && !this.regionSelectionBox}
                    onDragStart={this.handleDragStart}
                    onDragMove={this.handleDragMove}
                    onDragEnd={this.handleDragEnd}
                    x={0}
                    y={0}
                >
                    <Layer ref={this.layerRef} opacity={regionSet.isLocked ? 0.7 : 1} listening={!regionSet.isLocked}>
                        <RegionComponents
                            frame={frame}
                            regions={frame?.regionSet?.regionsAndAnnotationsForRender}
                            width={this.props.width}
                            height={this.props.height}
                            stageRef={this.stageRef}
                            shouldSuppressSelect={this.shouldSuppressRegionSelection}
                        />
                        <CursorRegionComponent frame={frame} width={this.props.width} height={this.props.height} stageRef={this.stageRef} />
                        {creatingLine}
                        {selectionBox}
                    </Layer>
                </Stage>
            </div>
        );
    }
}

interface RegionComponentsProps {
    frame: FrameStore;
    regions: RegionStore[];
    width: number;
    height: number;
    stageRef: any;
    shouldSuppressSelect?: (evt?: MouseEvent) => boolean;
}

@observer
class RegionComponents extends React.Component<RegionComponentsProps> {
    private handleSelect = (region: RegionStore, evt?: MouseEvent) => {
        if (this.props.shouldSuppressSelect?.(evt)) {
            return;
        }

        this.props.frame.regionSet.selectRegionFromList(region, this.props.regions, {toggle: !!(evt?.ctrlKey || evt?.metaKey)});
    };
    private handleRegionDoubleClicked = (region: RegionStore) => {
        const appStore = AppStore.Instance;
        if (region) {
            const frame = appStore.getFrame(region.fileId);
            if (frame) {
                const isMultiSelected = frame.regionSet.selectedRegionCount > 1 && frame.regionSet.selectedRegionIds.has(region.regionId);
                if (!isMultiSelected) {
                    frame.regionSet.selectSingleRegion(region);
                } else {
                    frame.regionSet.setFocusedRegion(region);
                }
                appStore.dialogStore.showDialog(DialogId.Region);
            }
        }
    };

    public render() {
        const regions = this.props.regions;

        if (!AppStore.Instance.fileBrowserStore.isLoadingDialogOpen && regions?.length) {
            const regionSet = this.props.frame?.regionSet;
            return regions.map(r => {
                const isFocused = r === regionSet.focusedRegion;
                const commonProps = {
                    region: r,
                    frame: this.props.frame,
                    layerWidth: this.props.width,
                    layerHeight: this.props.height,
                    stageRef: this.props.stageRef,
                    selected: regionSet.selectedRegionIds.has(r.regionId),
                    isFocused,
                    onSelect: this.handleSelect,
                    onDoubleClick: this.handleRegionDoubleClicked
                };

                if (r.regionType === CARTA.RegionType.POINT || r.regionType === CARTA.RegionType.ANNPOINT) {
                    return <PointRegionComponent {...commonProps} key={r.regionId} />;
                } else if (r.regionType === CARTA.RegionType.ANNCOMPASS) {
                    return <CompassAnnotation {...commonProps} key={r.regionId} />;
                } else if (r.regionType === CARTA.RegionType.ANNRULER) {
                    return <RulerAnnotation {...commonProps} key={r.regionId} />;
                } else {
                    const allProps = {
                        ...commonProps,
                        listening: regionSet.mode !== RegionMode.CREATING,
                        isRegionCornerMode: AppStore.Instance.preferenceStore.isRegionCornerMode
                    };
                    return r.isPolygonalRegion || r.isLineLikeRegion ? <LineSegmentRegionComponent {...allProps} key={r.regionId} /> : <SimpleShapeRegionComponent {...allProps} key={r.regionId} />;
                }
            });
        }
        return null;
    }
}
