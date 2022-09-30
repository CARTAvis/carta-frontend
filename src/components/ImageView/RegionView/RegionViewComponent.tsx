import * as React from "react";
import * as _ from "lodash";
import classNames from "classnames";
import {action, makeObservable, observable, reaction} from "mobx";
import {observer} from "mobx-react";
import {Layer, Line, Stage} from "react-konva";
import Konva from "konva";
import {CARTA} from "carta-protobuf";
import {AppStore, OverlayStore, PreferenceStore} from "stores";
import {FrameStore, RegionMode, RegionStore} from "stores/Frame";
import {CursorRegionComponent} from "./CursorRegionComponent";
import {PointRegionComponent} from "./PointRegionComponent";
import {SimpleShapeRegionComponent} from "./SimpleShapeRegionComponent";
import {LineSegmentRegionComponent} from "./LineSegmentRegionComponent";
import {ImageViewLayer} from "../ImageViewComponent";
import {adjustPosToMutatedStage, canvasToImagePos, canvasToTransformedImagePos, imageToCanvasPos, transformedImageToCanvasPos} from "./shared";
import {CursorInfo, Point2D, ZoomPoint} from "models";
import {add2D, average2D, isAstBadPoint, length2D, pointDistanceSquared, scale2D, subtract2D, transformPoint} from "utilities";
import "./RegionViewComponent.scss";
import {CompassAnnotation, RulerAnnotation} from "./InvariantShapes";

export interface RegionViewComponentProps {
    frame: FrameStore;
    overlaySettings: OverlayStore;
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

@observer
export class RegionViewComponent extends React.Component<RegionViewComponentProps> {
    @observable creatingRegion: RegionStore;
    @observable currentCursorPos: Point2D;

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
    private layerRef = React.createRef<any>();

    constructor(props: any) {
        super(props);
        makeObservable(this);

        this.stageRef = React.createRef();
        this.stageResizeOffset = {x: 0, y: 0};

        // Sync stage when matched, tracking frame's spatialReference only.
        reaction(
            () => this.props.frame?.spatialReference,
            spatialReference => {
                if (spatialReference) {
                    this.syncStage(spatialReference.centerMovement, spatialReference.zoomLevel);
                }
            }
        );

        reaction(
            () => {
                const frame = this.props.frame;
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
            (reference, prevReferece) => {
                const frame = this.props.frame;
                if (reference && (reference.centerMovement.x !== prevReferece?.centerMovement?.x || reference.centerMovement.y !== prevReferece?.centerMovement?.y || reference.zoom !== prevReferece?.zoom) && frame) {
                    this.syncStage(reference.centerMovement, reference.zoom);
                }
            }
        );
    }

    componentDidMount() {
        const frame = this.props.frame?.spatialReference ?? this.props.frame;
        if (frame) {
            this.syncStage(frame.centerMovement, frame.zoomLevel);
        }
    }

    componentDidUpdate(prevProps) {
        // Resizing image viewer triggers re-render of region view,
        // and regions' coordinates change accordingly under the stage's position & scale if zoom =\= 1,
        // therefore the offset must be saved in order to center the stage correctly.
        if (prevProps.width !== this.props.width || prevProps.height !== this.props.height) {
            const stage = this.stageRef.current;
            if (stage) {
                const offset = {x: (this.props.width - prevProps.width) / 2, y: (this.props.height - prevProps.height) / 2};
                const zoom = stage.scaleX();
                const mutatedOffset = scale2D(offset, (1 - zoom) / zoom);
                this.stageResizeOffset = add2D(this.stageResizeOffset, mutatedOffset);
            }
        }
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
            case CARTA.RegionType.ANNPOINT:
                this.creatingRegion = frame.regionSet.addAnnPointRegion(cursorPosImageSpace, false);
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
                this.creatingRegion = frame.regionSet.addAnnCompassRegion([cursorPosImageSpace, cursorPosImageSpace], true);
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
        let frame = this.props.frame;
        if (!this.creatingRegion || frame.regionSet.mode !== RegionMode.CREATING) {
            return;
        }
        const regionType = this.props.frame.regionSet.newRegionType;
        switch (regionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.LINE:
            case CARTA.RegionType.ANNLINE:
            case CARTA.RegionType.ANNVECTOR:
            case CARTA.RegionType.ANNTEXT:
                frame = this.props.frame.spatialReference || this.props.frame;
                if (this.creatingRegion.controlPoints.length > 1 && length2D(this.creatingRegion.size) === 0) {
                    const scaleFactor =
                        (PreferenceStore.Instance.regionSize * (this.creatingRegion.regionType === CARTA.RegionType.RECTANGLE || this.creatingRegion.regionType === CARTA.RegionType.ANNRECTANGLE ? 1.0 : 0.5)) / frame.zoomLevel;
                    this.creatingRegion.setSize(scale2D(this.creatingRegion.regionType === CARTA.RegionType.LINE ? {x: 2, y: 0} : {x: 1, y: 1}, scaleFactor));
                    console.log("creating region setting size", this.creatingRegion.size);
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

        // Handle region completion
        if (
            this.creatingRegion.isValid &&
            ((regionType !== CARTA.RegionType.POLYGON && regionType !== CARTA.RegionType.POLYLINE) || this.creatingRegion.controlPoints.length > 2) &&
            ((regionType !== CARTA.RegionType.LINE && regionType !== CARTA.RegionType.ANNLINE && regionType !== CARTA.RegionType.ANNVECTOR) || this.creatingRegion.controlPoints.length === 2)
        ) {
            this.creatingRegion.endCreating();
            frame.regionSet.selectRegion(this.creatingRegion);
            console.log("region creation completed,", this.creatingRegion);
        } else {
            frame.regionSet.deleteRegion(this.creatingRegion);
            console.log("region got deleted");
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
        const isRegionCornerMode = AppStore.Instance.preferenceStore.isRegionCornerMode;
        const endPoint = {x: this.regionStartPoint.x + dx, y: this.regionStartPoint.y + dy};
        const center = {x: (this.regionStartPoint.x + endPoint.x) / 2.0, y: (this.regionStartPoint.y + endPoint.y) / 2.0};
        if ((isRegionCornerMode && !isCtrlPressed) || (!isRegionCornerMode && isCtrlPressed)) {
            // corner-to-corner region creation
            switch (this.creatingRegion.regionType) {
                case CARTA.RegionType.RECTANGLE:
                case CARTA.RegionType.ANNRECTANGLE:
                case CARTA.RegionType.ANNTEXT:
                    console.log("setting control point corner to corner");
                    this.creatingRegion.setControlPoints([center, {x: Math.abs(dx), y: Math.abs(dy)}]);
                    break;

                // this.creatingRegion.setControlPoints([center, {x: Math.abs(dx), y: Math.abs(dy)}]);
                // // (this.creatingRegion as CompassAnnotationStore).setEndPoints([this.regionStartPoint, endPoint]);
                // break;
                case CARTA.RegionType.ELLIPSE:
                case CARTA.RegionType.ANNELLIPSE:
                    this.creatingRegion.setControlPoints([center, {y: Math.abs(dx) / 2.0, x: Math.abs(dy) / 2.0}]);
                    break;
                case CARTA.RegionType.LINE:
                case CARTA.RegionType.ANNLINE:
                case CARTA.RegionType.ANNVECTOR:
                case CARTA.RegionType.ANNCOMPASS:
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
                case CARTA.RegionType.ANNTEXT:
                    console.log("setting control point center to corner");
                    this.creatingRegion.setControlPoints([this.regionStartPoint, {x: 2 * Math.abs(dx), y: 2 * Math.abs(dy)}]);
                    console.log(this.creatingRegion.controlPoints);
                    break;
                case CARTA.RegionType.ELLIPSE:
                case CARTA.RegionType.ANNELLIPSE:
                    this.creatingRegion.setControlPoints([this.regionStartPoint, {y: Math.abs(dx), x: Math.abs(dy)}]);
                    break;
                case CARTA.RegionType.LINE:
                case CARTA.RegionType.ANNLINE:
                case CARTA.RegionType.ANNVECTOR:
                case CARTA.RegionType.ANNCOMPASS:
                case CARTA.RegionType.ANNRULER:
                    this.creatingRegion.setControlPoints([{x: cursorPosImageSpace.x - 2 * dx, y: cursorPosImageSpace.y - 2 * dy}, cursorPosImageSpace]);
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

    handlePan = (currentStagePosition: Point2D) => {
        // ignore invalid offsets
        if (!currentStagePosition || !isFinite(currentStagePosition.x) || !isFinite(currentStagePosition.y)) {
            return;
        }
        if (this.props.frame) {
            const frame = this.props.frame.spatialReference || this.props.frame;
            const dragOffset = subtract2D(currentStagePosition, this.initialStagePosition);
            const initialCenterCanvasSpace = imageToCanvasPos(this.initialDragCenter.x, this.initialDragCenter.y, frame.requiredFrameView, this.props.width, this.props.height);
            const newCenterCanvasSpace = subtract2D(initialCenterCanvasSpace, dragOffset);
            const newCenterImageSpace = canvasToImagePos(newCenterCanvasSpace.x, newCenterCanvasSpace.y, frame.requiredFrameView, this.props.width, this.props.height);
            frame.setCenter(newCenterImageSpace.x, newCenterImageSpace.y);
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

        if (frame.wcsInfo && AppStore.Instance?.activeLayer === ImageViewLayer.DistanceMeasuring && !isSecondaryClick) {
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

        if (frame.wcsInfo && this.props.onClickToCenter && ((!this.props.dragPanningEnabled && AppStore.Instance?.activeLayer !== ImageViewLayer.DistanceMeasuring) || isSecondaryClick)) {
            const cursorPosImageSpace = canvasToTransformedImagePos(mouseEvent.offsetX, mouseEvent.offsetY, frame, this.props.width, this.props.height);
            this.props.onClickToCenter(frame.getCursorInfo(cursorPosImageSpace));
        }
    };

    private syncStage = (refCenterMovement: Point2D, refFrameZoom: number) => {
        const stage = this.stageRef.current;
        if (stage && refCenterMovement && isFinite(refCenterMovement.x) && isFinite(refCenterMovement.y) && isFinite(refFrameZoom)) {
            stage.scale({x: refFrameZoom / AppStore.Instance.imageRatio, y: refFrameZoom / AppStore.Instance.imageRatio});
            const origin = scale2D({x: this.props.width / 2, y: this.props.height / 2}, 1 - refFrameZoom);
            const centerMovementCanvas = scale2D({x: refCenterMovement.x, y: -refCenterMovement.y}, refFrameZoom / devicePixelRatio);
            const newOrigin = add2D(origin, centerMovementCanvas);
            // Correct the origin if region view is ever resized
            const correctedOrigin = subtract2D(newOrigin, scale2D(this.stageResizeOffset, refFrameZoom));
            stage.position(correctedOrigin);
        }
    };

    public centerStage = () => {
        const stage = this.stageRef.current;
        if (stage) {
            const zoom = stage.scaleX();
            const newOrigin = scale2D({x: this.props.width / 2, y: this.props.height / 2}, 1 - zoom);
            // Correct the origin if region view is ever resized
            const correctedOrigin = subtract2D(newOrigin, scale2D(this.stageResizeOffset, zoom));
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
        const frame = this.props.frame;
        if (frame) {
            const cursorPosImageSpace = canvasToTransformedImagePos(mouseEvent.offsetX, mouseEvent.offsetY, frame, this.props.width, this.props.height);
            const cursorInfo = this.props.frame.getCursorInfo(cursorPosImageSpace);
            const delta = -mouseEvent.deltaY * (mouseEvent.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? 1 : LINE_HEIGHT);
            const zoomSpeed = 1 + Math.abs(delta / 750.0);

            // If frame is spatially matched, apply zoom to the reference frame, rather than the active frame
            const newZoom = (frame.spatialReference ? frame.spatialReference.zoomLevel : frame.zoomLevel) * (delta > 0 ? zoomSpeed : 1.0 / zoomSpeed);
            frame.zoomToPoint(cursorInfo.posImageSpace.x, cursorInfo.posImageSpace.y, newZoom, true);

            // Zoom stage
            const zoomCenter = PreferenceStore.Instance.zoomPoint === ZoomPoint.CURSOR ? {x: mouseEvent.offsetX, y: mouseEvent.offsetY} : {x: this.props.width / 2, y: this.props.height / 2};
            this.stageZoomToPoint(zoomCenter.x, zoomCenter.y, newZoom);
        }
    };

    private handleMouseDown = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        switch (this.props.frame.regionSet.newRegionType) {
            case CARTA.RegionType.RECTANGLE:
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.LINE:
            case CARTA.RegionType.ANNLINE:
            case CARTA.RegionType.ANNVECTOR:
            case CARTA.RegionType.ANNTEXT:
            case CARTA.RegionType.ANNCOMPASS:
            case CARTA.RegionType.ANNRULER:
                this.regionCreationStart(konvaEvent.evt);
                break;
            case CARTA.RegionType.POINT:
            case CARTA.RegionType.ANNPOINT:
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
            case CARTA.RegionType.ANNRECTANGLE:
            case CARTA.RegionType.ELLIPSE:
            case CARTA.RegionType.ANNELLIPSE:
            case CARTA.RegionType.LINE:
            case CARTA.RegionType.ANNLINE:
            case CARTA.RegionType.ANNVECTOR:
            case CARTA.RegionType.ANNTEXT:
            case CARTA.RegionType.ANNCOMPASS:
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

    handleMove = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;
        if (this.props.dragPanningEnabled && this.dragPanning) {
            return;
        }
        console.log("handlemove");

        const frame = this.props.frame;
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
                case CARTA.RegionType.ANNCOMPASS:
                case CARTA.RegionType.ANNRULER:
                    this.RegionCreating(mouseEvent);
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
            if (frame.wcsInfo && AppStore.Instance?.activeLayer === ImageViewLayer.DistanceMeasuring && frame.distanceMeasuring.isCreating) {
                this.updateDistanceMeasureFinishPos(mouseEvent.offsetX, mouseEvent.offsetY);
            }
            if (!AppStore.Instance.cursorFrozen) {
                this.updateCursorPos(mouseEvent.offsetX, mouseEvent.offsetY);
                if (this.props.frame !== AppStore.Instance.hoveredFrame) {
                    AppStore.Instance.setHoveredFrame(this.props.frame);
                }
            }
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
            AppStore.Instance.updateActiveLayer(ImageViewLayer.RegionMoving);
        }
    };

    render() {
        const frame = this.props.frame;
        const regionSet = frame.regionSet;
        const className = classNames("region-stage", {docked: this.props.docked});

        AppStore.Instance.updateLayerPixelRatio(this.layerRef);

        let creatingLine = null;
        if (this.currentCursorPos && (this.creatingRegion?.regionType === CARTA.RegionType.POLYGON || this.creatingRegion?.regionType === CARTA.RegionType.POLYLINE) && this.creatingRegion.isValid) {
            let firstControlPoint = this.creatingRegion.controlPoints[0];
            let lastControlPoint = this.creatingRegion.controlPoints[this.creatingRegion.controlPoints.length - 1];

            if (frame.spatialReference) {
                firstControlPoint = transformPoint(frame.spatialTransformAST, firstControlPoint, false);
                lastControlPoint = transformPoint(frame.spatialTransformAST, lastControlPoint, false);
            }
            const lineStart = transformedImageToCanvasPos(firstControlPoint, frame, this.props.width, this.props.height, this.stageRef.current);
            const lineEnd = transformedImageToCanvasPos(lastControlPoint, frame, this.props.width, this.props.height, this.stageRef.current);
            const cusorCanvasPos = adjustPosToMutatedStage(this.currentCursorPos, this.stageRef.current);
            let points: number[];
            if (this.creatingRegion.controlPoints.length > 1 && this.creatingRegion?.regionType !== CARTA.RegionType.POLYLINE) {
                points = [lineStart.x, lineStart.y, cusorCanvasPos.x, cusorCanvasPos.y, lineEnd.x, lineEnd.y];
            } else {
                points = [lineEnd.x, lineEnd.y, cusorCanvasPos.x, cusorCanvasPos.y];
            }
            creatingLine = (
                <Line points={points} dash={[5]} stroke={this.creatingRegion.color} strokeWidth={this.creatingRegion.lineWidth} strokeScaleEnabled={false} opacity={0.5} lineJoin={"round"} listening={false} perfectDrawEnabled={false} />
            );
        }

        let cursor: string;
        if (regionSet.mode === RegionMode.CREATING || AppStore.Instance?.activeLayer === ImageViewLayer.DistanceMeasuring) {
            cursor = "crosshair";
        } else if (regionSet.selectedRegion && regionSet.selectedRegion.editing) {
            cursor = "move";
        } else if (regionSet.selectedRegion === regionSet.regions[0] || !regionSet.selectedRegion) {
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
                    onMouseDown={regionSet.mode === RegionMode.CREATING ? this.handleMouseDown : null}
                    onMouseUp={regionSet.mode === RegionMode.CREATING ? this.handleMouseUp : null}
                    draggable={regionSet.mode !== RegionMode.CREATING && this.props.dragPanningEnabled}
                    onDragStart={this.handleDragStart}
                    onDragMove={this.handleDragMove}
                    onDragEnd={this.handleDragEnd}
                    x={0}
                    y={0}
                >
                    <Layer ref={this.layerRef}>
                        <RegionComponents frame={frame} regions={frame?.regionSet?.regionsAndAnnotationsForRender} width={this.props.width} height={this.props.height} stageRef={this.stageRef} />
                        <CursorRegionComponent frame={frame} width={this.props.width} height={this.props.height} stageRef={this.stageRef} />
                        {creatingLine}
                    </Layer>
                </Stage>
            </div>
        );
    }
}

@observer
class RegionComponents extends React.Component<{frame: FrameStore; regions: RegionStore[]; width: number; height: number; stageRef: any}> {
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
        if (!AppStore.Instance.fileBrowserStore.isLoadingDialogOpen && regions?.length) {
            const regionSet = this.props.frame?.regionSet;
            return regions.map(r => {
                const commonProps = {
                    key: r.regionId,
                    region: r,
                    frame: this.props.frame,
                    layerWidth: this.props.width,
                    layerHeight: this.props.height,
                    stageRef: this.props.stageRef,
                    selected: r === regionSet.selectedRegion,
                    onSelect: regionSet.selectRegion,
                    onDoubleClick: this.handleRegionDoubleClicked
                };

                if (r.regionType === CARTA.RegionType.POINT || r.regionType === CARTA.RegionType.ANNPOINT) {
                    return <PointRegionComponent {...commonProps} />;
                } else if (r.regionType === CARTA.RegionType.ANNCOMPASS) {
                    return <CompassAnnotation {...commonProps} />;
                } else if (r.regionType === CARTA.RegionType.ANNRULER) {
                    return <RulerAnnotation {...commonProps} />;
                } else {
                    const allProps = {
                        ...commonProps,
                        listening: regionSet.mode !== RegionMode.CREATING && AppStore.Instance?.activeLayer !== ImageViewLayer.DistanceMeasuring,
                        isRegionCornerMode: AppStore.Instance.preferenceStore.isRegionCornerMode
                    };
                    return r.regionType === CARTA.RegionType.POLYGON ||
                        r.regionType === CARTA.RegionType.LINE ||
                        r.regionType === CARTA.RegionType.POLYLINE ||
                        r.regionType === CARTA.RegionType.ANNPOLYGON ||
                        r.regionType === CARTA.RegionType.ANNLINE ||
                        r.regionType === CARTA.RegionType.ANNVECTOR ||
                        r.regionType === CARTA.RegionType.ANNPOLYLINE ? (
                        <LineSegmentRegionComponent {...allProps} />
                    ) : (
                        <SimpleShapeRegionComponent {...allProps} />
                    );
                }
            });
        }
        return null;
    }
}
