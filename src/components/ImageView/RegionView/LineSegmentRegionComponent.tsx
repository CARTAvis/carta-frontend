import * as React from "react";
import {Arrow, Group, Line} from "react-konva";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import type Konva from "konva";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {type Point2D} from "models";
import {AppStore} from "stores";
import {type FrameStore, type RegionStore, type VectorAnnotationStore} from "stores/Frame";
import {Add2D, Angle2D, Average2D, ClosestPointOnLine, Rotate2D, Subtract2D, TransformPoint} from "utilities";

import {Anchor, NonEditableAnchor, ROTATOR_ANCHOR_HEIGHT} from "./InvariantShapes";
import {AdjustPosToUnityStage, CanvasToTransformedImagePos, TransformedImageToCanvasPos} from "./shared";

interface LineSegmentRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    listening: boolean;
    selected: boolean;
    isRegionCornerMode: boolean;
    stageRef: any;
    onSelect?: (region: RegionStore) => void;
    onDoubleClick?: (region: RegionStore) => void;
}

const NEW_ANCHOR_MAX_DISTANCE = 16;
const INVALID_POLYGON_COLOR = Colors.ROSE4;
const DOUBLE_CLICK_THRESHOLD = 300;

@observer
export class LineSegmentRegionComponent extends React.Component<LineSegmentRegionComponentProps> {
    @observable hoverIndex: number = -1;
    @observable hoverIntersection: Point2D | null = null;

    private previousCursorStyle: string;
    private addControlPointTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    componentDidUpdate() {
        AppStore.Instance.resetImageRatio();
    }

    componentWillUnmount() {
        clearTimeout(this.addControlPointTimer);
        this.addControlPointTimer = undefined;
    }

    private handleContextMenu = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        konvaEvent.evt.preventDefault();
    };

    private handleDoubleClick = () => {
        clearTimeout(this.addControlPointTimer);
        this.addControlPointTimer = undefined;
        this.props.onDoubleClick?.(this.props.region);
    };

    @action private handleClick = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;

        if (mouseEvent.button === 0 && !(mouseEvent.ctrlKey || mouseEvent.metaKey)) {
            const region = this.props.region;
            this.props.onSelect?.(region);

            // Add a new control point to the region between two existing control points
            if (
                region.regionType !== CARTA.RegionType.LINE &&
                region.regionType !== CARTA.RegionType.ANNLINE &&
                region.regionType !== CARTA.RegionType.ANNVECTOR &&
                this.hoverIntersection &&
                this.hoverIndex >= 0 &&
                this.hoverIndex < region.controlPoints.length
            ) {
                const currentControlPoints = region.controlPoints.slice(0);
                currentControlPoints.splice(this.hoverIndex + 1, 0, this.hoverIntersection);
                // Skip SET_REGION update, since the new control point lies on the line between two existing points
                clearTimeout(this.addControlPointTimer);
                this.addControlPointTimer = undefined;
                this.addControlPointTimer = setTimeout(() => {
                    region.setControlPoints(currentControlPoints, true, false);
                    this.hoverIntersection = null;
                }, DOUBLE_CLICK_THRESHOLD);
            }
        }
    };

    private handleAnchorDragStart = () => {
        this.props.onSelect?.(this.props.region);
        this.props.region.beginEditing();
    };

    private handleAnchorDragEnd = () => {
        this.props.region.endEditing();
    };

    @action private handleAnchorDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.currentTarget) {
            const node = konvaEvent.target;
            const region = this.props.region;
            const frame = this.props.frame;
            const index = node.index;
            const anchor = node.id();
            const evt = konvaEvent.evt;
            const offsetPoint = AdjustPosToUnityStage(node.position(), this.props.stageRef.current);
            if (anchor.includes("rotator")) {
                // Calculate rotation from anchor position
                let newAnchorPoint = CanvasToTransformedImagePos(offsetPoint.x, offsetPoint.y, frame, this.props.layerWidth, this.props.layerHeight);
                if (frame.spatialReference && frame.spatialTransformAST) {
                    newAnchorPoint = TransformPoint(frame.spatialTransformAST, newAnchorPoint, true);
                }
                const delta = Subtract2D(newAnchorPoint, region.center);
                const topAnchorPosition = Rotate2D({x: 1, y: 0}, (region.rotation * Math.PI) / 180.0);
                const angle = (180.0 / Math.PI) * Angle2D(topAnchorPosition, delta);
                region.setRotation(region.rotation + angle);
            } else if (index >= 0 && index < region.controlPoints.length) {
                let positionImageSpace = CanvasToTransformedImagePos(offsetPoint.x, offsetPoint.y, frame, this.props.layerWidth, this.props.layerHeight);
                if (frame.spatialReference && frame.spatialTransformAST) {
                    positionImageSpace = TransformPoint(frame.spatialTransformAST, positionImageSpace, true);
                }
                const isCtrlPressed = evt.ctrlKey || evt.metaKey;
                if (
                    (region.regionType !== CARTA.RegionType.LINE && region.regionType !== CARTA.RegionType.ANNLINE && region.regionType !== CARTA.RegionType.ANNVECTOR) ||
                    (this.props.isRegionCornerMode && !isCtrlPressed) ||
                    (!this.props.isRegionCornerMode && isCtrlPressed)
                ) {
                    region.setControlPoint(index, positionImageSpace);
                    this.hoverIntersection = null;
                } else {
                    if (index === 0) {
                        region.setControlPoints([positionImageSpace, {x: region.center.x * 2 - positionImageSpace.x, y: region.center.y * 2 - positionImageSpace.y}]);
                    } else {
                        region.setControlPoints([{x: region.center.x * 2 - positionImageSpace.x, y: region.center.y * 2 - positionImageSpace.y}, positionImageSpace]);
                    }
                    this.hoverIntersection = null;
                }
            }
        }
    };

    private handleAnchorDoubleClick = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const node = konvaEvent.target;
        if (node) {
            const index = node.index;
            const region = this.props.region;
            // Can only remove points if the polygon currently has 4 or more control points
            if (index >= 0 && index < region.controlPoints.length && region.controlPoints.length >= 4) {
                // grab a copy of the array and remove the clicked control point
                const existingPoints = region.controlPoints.slice(0);
                existingPoints.splice(index, 1);
                region.setControlPoints(existingPoints);
            }
        }
    };

    @action private handleStrokeMouseEnter = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const stage = konvaEvent.target?.getStage();
        const container = stage?.container();
        if (container) {
            this.previousCursorStyle = container.style.cursor;
        }
        this.handleMouseMove(konvaEvent);
    };

    @action private handleStrokeMouseLeave = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        this.hoverIntersection = null;
        const stage = konvaEvent.target?.getStage();
        const container = stage?.container();
        if (container) {
            container.style.cursor = this.previousCursorStyle;
        }
    };

    @action private handleMouseMove = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;
        const region = this.props.region;
        const frame = this.props.frame;

        if (this.props.selected && region.controlPoints.length >= 2) {
            let positionImageSpace = CanvasToTransformedImagePos(mouseEvent.offsetX, mouseEvent.offsetY, frame, this.props.layerWidth, this.props.layerHeight);
            if (frame.spatialReference && frame.spatialTransformAST) {
                positionImageSpace = TransformPoint(frame.spatialTransformAST, positionImageSpace, true);
            }
            let minDistance = Number.MAX_VALUE;
            let closestIndex = -1;
            let closestPoint: Point2D | null = null;
            // Find closest point on each line segment, select the closest overall that actually lies on the line segment
            for (let i = 0; i < (region.regionType === CARTA.RegionType.POLYLINE ? region.controlPoints.length - 1 : region.controlPoints.length); i++) {
                const pointCheck = ClosestPointOnLine(positionImageSpace, region.controlPoints[i], region.controlPoints[(i + 1) % region.controlPoints.length]);
                if (pointCheck.bounded && pointCheck.distance < minDistance) {
                    minDistance = pointCheck.distance;
                    closestPoint = pointCheck.point;
                    closestIndex = i;
                }
            }

            if (closestIndex >= 0 && minDistance <= NEW_ANCHOR_MAX_DISTANCE) {
                this.hoverIntersection = closestPoint;
                this.hoverIndex = closestIndex;
                const stage = konvaEvent.target?.getStage();
                const container = stage?.container();
                if (container) {
                    container.style.cursor = "crosshair";
                }
            } else {
                this.hoverIntersection = null;
                const stage = konvaEvent.target?.getStage();
                const container = stage?.container();
                if (container) {
                    container.style.cursor = this.previousCursorStyle;
                }
            }
        }
    };

    private handleAnchorMouseEnter = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const stage = konvaEvent.target?.getStage();
        const container = stage?.container();
        if (container) {
            this.previousCursorStyle = container.style.cursor;
            container.style.cursor = "move";
        }
    };

    private handleAnchorMouseOut = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const stage = konvaEvent.target?.getStage();
        const container = stage?.container();
        if (container) {
            container.style.cursor = this.previousCursorStyle;
        }
    };

    @action handleDragStart = () => {
        this.props.onSelect?.(this.props.region);
        this.props.region.beginEditing();
        this.hoverIntersection = null;
    };

    @action handleDragEnd = () => {
        this.props.region.endEditing();
    };

    @action handleDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            const region = this.props.region;
            const frame = this.props.frame;
            const centerImageSpace = Average2D(region.controlPoints);
            const position = AdjustPosToUnityStage(konvaEvent.target.position(), this.props.stageRef.current);
            let newPosition = CanvasToTransformedImagePos(position.x, position.y, frame, this.props.layerWidth, this.props.layerHeight);
            if (frame.spatialReference && frame.spatialTransformAST) {
                newPosition = TransformPoint(frame.spatialTransformAST, newPosition, true);
            }
            const deltaPosition = Subtract2D(newPosition, centerImageSpace);
            const newPoints = region.controlPoints.map(p => Add2D(p, deltaPosition));
            region.setControlPoints(newPoints, false, false);
        }
    };

    private anchorNode(x: number, y: number, rotation: number = 0, key: number, isRotator: boolean = false): React.ReactNode {
        return (
            <Anchor
                key={key}
                anchor={isRotator ? "rotator" : `anchor-${key}`}
                x={x}
                y={y}
                rotation={rotation}
                isRotator={isRotator}
                onMouseEnter={this.handleAnchorMouseEnter}
                onMouseOut={this.handleAnchorMouseOut}
                onDragStart={this.handleAnchorDragStart}
                onDragEnd={this.handleAnchorDragEnd}
                onDragMove={this.handleAnchorDrag}
                onDblClick={
                    this.props.region.regionType === CARTA.RegionType.LINE || this.props.region.regionType === CARTA.RegionType.ANNLINE || this.props.region.regionType === CARTA.RegionType.ANNVECTOR
                        ? undefined
                        : this.handleAnchorDoubleClick
                }
                isLineRegion={this.props.region.regionType === CARTA.RegionType.LINE || this.props.region.regionType === CARTA.RegionType.ANNLINE || this.props.region.regionType === CARTA.RegionType.ANNVECTOR}
            />
        );
    }

    render() {
        const region = this.props.region;
        const frame = this.props.frame;
        const zoomLevel = frame.spatialReference?.zoomLevel || frame.zoomLevel;
        const rotation = frame.hasSquarePixels ? -region.rotation + 90.0 : (-Math.atan(Math.tan((region.rotation * Math.PI) / 180) * frame.aspectRatio) * 180) / Math.PI;

        let controlPoints = region.controlPoints;
        let centerPointCanvasSpace: Point2D;
        let anchors: React.ReactNode[] | null = null;
        let newAnchor: React.ReactNode | null = null;
        let pointArray: Array<number>;
        const imageRatio = AppStore.Instance.imageRatio;
        // trigger re-render when exporting images and changing devicePixelRatio (switching monitor)
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
        const pixelRatio = AppStore.Instance.pixelRatio;

        if (frame.spatialReference && frame.spatialTransformAST) {
            const centerReferenceImage = Average2D(controlPoints);
            const centerSecondaryImage = TransformPoint(frame.spatialTransformAST, centerReferenceImage, false);
            centerPointCanvasSpace = TransformedImageToCanvasPos(centerSecondaryImage, frame, this.props.layerWidth, this.props.layerHeight, this.props.stageRef.current);
            const pointsSecondaryImage = region.getRegionApproximation(frame.spatialTransformAST);
            const n = (pointsSecondaryImage as Point2D[]).length;
            pointArray = new Array<number>(n * 2);
            for (let i = 0; i < n; i++) {
                const approxPointPixelSpace = TransformedImageToCanvasPos(pointsSecondaryImage[i], frame, this.props.layerWidth, this.props.layerHeight, this.props.stageRef.current);
                pointArray[i * 2] = approxPointPixelSpace.x - centerPointCanvasSpace.x;
                pointArray[i * 2 + 1] = approxPointPixelSpace.y - centerPointCanvasSpace.y;
            }

            // Construct anchors if region is selected
            if (this.props.selected && this.props.listening && !region.isLocked && !AppStore.Instance.activeFrame?.regionSet.isLocked) {
                anchors = controlPoints.map((p, i) => {
                    const pSecondaryImage = TransformPoint(frame.spatialTransformAST!, p, false);
                    const pCanvasPos = TransformedImageToCanvasPos(pSecondaryImage, frame, this.props.layerWidth, this.props.layerHeight, this.props.stageRef.current);
                    return this.anchorNode(pCanvasPos.x, pCanvasPos.y, rotation, i);
                });

                if ((this.props.region.regionType === CARTA.RegionType.LINE || this.props.region.regionType === CARTA.RegionType.ANNLINE || this.props.region.regionType === CARTA.RegionType.ANNVECTOR) && frame.hasSquarePixels) {
                    // trigger rotation anchor re-render when zooming
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const zoomLevel = frame.spatialReference?.zoomLevel;
                    const inverseScale = 1 / this.props.stageRef.current.scaleX();
                    const rotatorOffset = ROTATOR_ANCHOR_HEIGHT * inverseScale;
                    const rotatorAngle = (rotation * Math.PI) / 180.0;
                    anchors.push(this.anchorNode(centerPointCanvasSpace.x + rotatorOffset * Math.sin(rotatorAngle), centerPointCanvasSpace.y - rotatorOffset * Math.cos(rotatorAngle), rotation, 2, true));
                }
            }

            if (this.hoverIntersection && !region.isLocked && !AppStore.Instance.activeFrame?.regionSet.isLocked) {
                const pSecondaryImage = TransformPoint(frame.spatialTransformAST!, this.hoverIntersection, false);
                const pCanvasPos = TransformedImageToCanvasPos(pSecondaryImage, frame, this.props.layerWidth, this.props.layerHeight, this.props.stageRef.current);
                newAnchor = <NonEditableAnchor x={pCanvasPos.x} y={pCanvasPos.y} rotation={rotation} />;
            }
        } else {
            controlPoints = controlPoints.map(p => {
                return TransformedImageToCanvasPos(p, frame, this.props.layerWidth, this.props.layerHeight, this.props.stageRef.current);
            });
            centerPointCanvasSpace = Average2D(controlPoints);
            // Construct anchors if region is selected
            if (this.props.selected && this.props.listening && !region.isLocked && !AppStore.Instance.activeFrame?.regionSet.isLocked) {
                anchors = new Array<React.ReactNode>(controlPoints.length);
                for (let i = 0; i < controlPoints.length; i++) {
                    anchors[i] = this.anchorNode(controlPoints[i].x, controlPoints[i].y, rotation, i);
                }

                if ((this.props.region.regionType === CARTA.RegionType.LINE || this.props.region.regionType === CARTA.RegionType.ANNLINE || this.props.region.regionType === CARTA.RegionType.ANNVECTOR) && frame.hasSquarePixels) {
                    // trigger rotation anchor re-render when zooming
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const zoomLevel = frame.zoomLevel;
                    const inverseScale = 1 / this.props.stageRef.current.scaleX();
                    const rotatorOffset = ROTATOR_ANCHOR_HEIGHT * inverseScale;
                    const rotatorAngle = (rotation * Math.PI) / 180.0;
                    anchors.push(this.anchorNode(centerPointCanvasSpace.x + rotatorOffset * Math.sin(rotatorAngle), centerPointCanvasSpace.y - rotatorOffset * Math.cos(rotatorAngle), rotation, 2, true));
                }
            }

            if (this.hoverIntersection && !region.isLocked && !AppStore.Instance.activeFrame?.regionSet.isLocked) {
                const anchorPositionPixelSpace = TransformedImageToCanvasPos(this.hoverIntersection, frame, this.props.layerWidth, this.props.layerHeight, this.props.stageRef.current);
                newAnchor = <NonEditableAnchor x={anchorPositionPixelSpace.x} y={anchorPositionPixelSpace.y} rotation={rotation} />;
            }

            pointArray = new Array<number>(controlPoints.length * 2);
            for (let i = 0; i < pointArray.length / 2; i++) {
                pointArray[i * 2] = controlPoints[i].x - centerPointCanvasSpace.x;
                pointArray[i * 2 + 1] = controlPoints[i].y - centerPointCanvasSpace.y;
            }
        }

        const commonProps = {
            x: centerPointCanvasSpace.x,
            y: centerPointCanvasSpace.y,
            stroke: region.isSimplePolygon ? region.color : INVALID_POLYGON_COLOR,
            strokeWidth: region.lineWidth,
            opacity: region.isTemporary ? 0.5 : region.isLocked ? 0.7 : 1,
            dash: [region.dashLength],
            listening: this.props.listening && !region.isLocked,
            onClick: this.handleClick,
            onDblClick: this.handleDoubleClick,
            onContextMenu: this.handleContextMenu,
            onDragStart: this.handleDragStart,
            onDragEnd: this.handleDragEnd,
            onDragMove: this.handleDrag,
            perfectDrawEnabled: false,
            strokeScaleEnabled: false,
            draggable: true,
            points: pointArray,
            hitStrokeWidth: NEW_ANCHOR_MAX_DISTANCE * 2
        };

        return (
            <Group>
                {region.regionType === CARTA.RegionType.ANNVECTOR ? (
                    <Arrow
                        {...commonProps}
                        fill={region.color}
                        pointerWidth={((region as VectorAnnotationStore).pointerWidth * imageRatio) / zoomLevel}
                        pointerLength={((region as VectorAnnotationStore).pointerLength * imageRatio) / zoomLevel}
                    />
                ) : (
                    <Line
                        {...commonProps}
                        closed={!region.isCreating && (region.regionType === CARTA.RegionType.POLYGON || region.regionType === CARTA.RegionType.ANNPOLYGON)}
                        onMouseEnter={this.props.region.regionType === CARTA.RegionType.LINE || this.props.region.regionType === CARTA.RegionType.ANNLINE ? undefined : this.handleStrokeMouseEnter}
                        onMouseLeave={this.props.region.regionType === CARTA.RegionType.LINE || this.props.region.regionType === CARTA.RegionType.ANNLINE ? undefined : this.handleStrokeMouseLeave}
                        onMouseMove={this.props.region.regionType === CARTA.RegionType.LINE || this.props.region.regionType === CARTA.RegionType.ANNLINE ? undefined : this.handleMouseMove}
                    />
                )}
                <Group>
                    {anchors}
                    {newAnchor}
                </Group>
            </Group>
        );
    }
}
