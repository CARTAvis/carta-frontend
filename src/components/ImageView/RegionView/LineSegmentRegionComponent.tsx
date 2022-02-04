import * as React from "react";
import {action, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {Group, Line} from "react-konva";
import Konva from "konva";
import {CARTA} from "carta-protobuf";
import {Colors} from "@blueprintjs/core";
import {AppStore, FrameStore, RegionStore} from "stores";
import {Point2D} from "models";
import {add2D, average2D, closestPointOnLine, transformPoint, rotate2D, subtract2D, angle2D} from "utilities";
import {adjustPosToUnityStage, canvasToTransformedImagePos, transformedImageToCanvasPos} from "./shared";
import {Anchor, NonEditableAnchor} from "./InvariantShapes";

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
    @observable hoverIndex: number;
    @observable hoverIntersection: Point2D;

    private previousCursorStyle: string;
    private addControlPointTimer;

    constructor(props: any) {
        super(props);
        makeObservable(this);
    }

    componentDidUpdate() {
        AppStore.Instance.resetImageRatio();
    }

    private handleContextMenu = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        konvaEvent.evt.preventDefault();
    };

    private handleDoubleClick = () => {
        clearTimeout(this.addControlPointTimer);
        this.props.onDoubleClick?.(this.props.region);
    };

    @action private handleClick = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;

        if (mouseEvent.button === 0 && !(mouseEvent.ctrlKey || mouseEvent.metaKey)) {
            const region = this.props.region;
            this.props.onSelect?.(region);

            // Add a new control point to the region between two existing control points
            if (region.regionType !== CARTA.RegionType.LINE && this.hoverIntersection && this.hoverIndex >= 0 && this.hoverIndex < region.controlPoints.length) {
                const currentControlPoints = region.controlPoints.slice(0);
                currentControlPoints.splice(this.hoverIndex + 1, 0, this.hoverIntersection);
                // Skip SET_REGION update, since the new control point lies on the line between two existing points
                clearTimeout(this.addControlPointTimer);
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
            const offsetPoint = adjustPosToUnityStage(node.position(), this.props.stageRef.current);
            if (anchor.includes("rotator")) {
                // Calculate rotation from anchor position
                let newAnchorPoint = canvasToTransformedImagePos(offsetPoint.x, offsetPoint.y, frame, this.props.layerWidth, this.props.layerHeight);
                if (frame.spatialReference) {
                    newAnchorPoint = transformPoint(frame.spatialTransformAST, newAnchorPoint, true);
                }
                const delta = subtract2D(newAnchorPoint, region.center);
                const topAnchorPosition = rotate2D({x: 1, y: 0}, (region.rotation * Math.PI) / 180.0);
                const angle = (180.0 / Math.PI) * angle2D(topAnchorPosition, delta);
                region.setRotation(region.rotation + angle);
            } else if (index >= 0 && index < region.controlPoints.length) {
                let positionImageSpace = canvasToTransformedImagePos(offsetPoint.x, offsetPoint.y, frame, this.props.layerWidth, this.props.layerHeight);
                if (frame.spatialReference) {
                    positionImageSpace = transformPoint(frame.spatialTransformAST, positionImageSpace, true);
                }
                const isCtrlPressed = evt.ctrlKey || evt.metaKey;
                if (region.regionType !== CARTA.RegionType.LINE || (this.props.isRegionCornerMode && !isCtrlPressed) || (!this.props.isRegionCornerMode && isCtrlPressed)) {
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
        if (konvaEvent.target?.getStage()) {
            this.previousCursorStyle = konvaEvent.target.getStage().container().style.cursor;
        }
        this.handleMouseMove(konvaEvent);
    };

    @action private handleStrokeMouseLeave = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        this.hoverIntersection = null;
        if (konvaEvent.target?.getStage()) {
            konvaEvent.target.getStage().container().style.cursor = this.previousCursorStyle;
        }
    };

    @action private handleMouseMove = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;
        const region = this.props.region;
        const frame = this.props.frame;

        if (this.props.selected && region.controlPoints.length >= 2) {
            let positionImageSpace = canvasToTransformedImagePos(mouseEvent.offsetX, mouseEvent.offsetY, frame, this.props.layerWidth, this.props.layerHeight);
            if (frame.spatialReference) {
                positionImageSpace = transformPoint(frame.spatialTransformAST, positionImageSpace, true);
            }
            let minDistance = Number.MAX_VALUE;
            let closestIndex = -1;
            let closestPoint: Point2D = null;
            // Find closest point on each line segment, select the closest overall that actually lies on the line segment
            for (let i = 0; i < (region.regionType === CARTA.RegionType.POLYLINE ? region.controlPoints.length - 1 : region.controlPoints.length); i++) {
                const pointCheck = closestPointOnLine(positionImageSpace, region.controlPoints[i], region.controlPoints[(i + 1) % region.controlPoints.length]);
                if (pointCheck.bounded && pointCheck.distance < minDistance) {
                    minDistance = pointCheck.distance;
                    closestPoint = pointCheck.point;
                    closestIndex = i;
                }
            }

            if (closestIndex >= 0 && minDistance <= NEW_ANCHOR_MAX_DISTANCE) {
                this.hoverIntersection = closestPoint;
                this.hoverIndex = closestIndex;
                if (konvaEvent.target?.getStage()) {
                    konvaEvent.target.getStage().container().style.cursor = "crosshair";
                }
            } else {
                this.hoverIntersection = null;
                if (konvaEvent.target?.getStage()) {
                    konvaEvent.target.getStage().container().style.cursor = this.previousCursorStyle;
                }
            }
        }
    };

    private handleAnchorMouseEnter = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target?.getStage()) {
            this.previousCursorStyle = konvaEvent.target.getStage().container().style.cursor;
            konvaEvent.target.getStage().container().style.cursor = "move";
        }
    };

    private handleAnchorMouseOut = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target?.getStage()) {
            konvaEvent.target.getStage().container().style.cursor = this.previousCursorStyle;
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
            const centerImageSpace = average2D(region.controlPoints);
            const position = adjustPosToUnityStage(konvaEvent.target.position(), this.props.stageRef.current);
            let newPosition = canvasToTransformedImagePos(position.x, position.y, frame, this.props.layerWidth, this.props.layerHeight);
            if (frame.spatialReference) {
                newPosition = transformPoint(frame.spatialTransformAST, newPosition, true);
            }
            const deltaPosition = subtract2D(newPosition, centerImageSpace);
            const newPoints = region.controlPoints.map(p => add2D(p, deltaPosition));
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
                onDblClick={this.props.region.regionType === CARTA.RegionType.LINE ? null : this.handleAnchorDoubleClick}
            />
        );
    }

    render() {
        const region = this.props.region;
        const frame = this.props.frame;
        let rotation = -region.rotation + 90.0;

        let controlPoints = region.controlPoints;
        let centerPointCanvasSpace: Point2D;
        let anchors = null;
        let newAnchor = null;
        let pointArray: Array<number>;

        // trigger re-render when exporting images
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const imageRatio = AppStore.Instance.imageRatio;

        if (frame.spatialReference) {
            const centerReferenceImage = average2D(controlPoints);
            const centerSecondaryImage = transformPoint(frame.spatialTransformAST, centerReferenceImage, false);
            centerPointCanvasSpace = transformedImageToCanvasPos(centerSecondaryImage, frame, this.props.layerWidth, this.props.layerHeight, this.props.stageRef.current);
            const pointsSecondaryImage = region.getRegionApproximation(frame.spatialTransformAST);
            const N = pointsSecondaryImage.length;
            pointArray = new Array<number>(N * 2);
            for (let i = 0; i < N; i++) {
                const approxPointPixelSpace = transformedImageToCanvasPos(pointsSecondaryImage[i], frame, this.props.layerWidth, this.props.layerHeight, this.props.stageRef.current);
                pointArray[i * 2] = approxPointPixelSpace.x - centerPointCanvasSpace.x;
                pointArray[i * 2 + 1] = approxPointPixelSpace.y - centerPointCanvasSpace.y;
            }

            // Construct anchors if region is selected
            if (this.props.selected && this.props.listening && !region.locked) {
                anchors = controlPoints.map((p, i) => {
                    const pSecondaryImage = transformPoint(frame.spatialTransformAST, p, false);
                    const pCanvasPos = transformedImageToCanvasPos(pSecondaryImage, frame, this.props.layerWidth, this.props.layerHeight, this.props.stageRef.current);
                    return this.anchorNode(pCanvasPos.x, pCanvasPos.y, rotation, i);
                });

                if (region.regionType === CARTA.RegionType.LINE && frame.hasSquarePixels) {
                    const rotatorOffset = 1;
                    const rotatorAngle = (rotation * Math.PI) / 180.0;
                    anchors.push(this.anchorNode(centerPointCanvasSpace.x + rotatorOffset * Math.sin(rotatorAngle), centerPointCanvasSpace.y - rotatorOffset * Math.cos(rotatorAngle), rotation, 2, true));
                }
            }

            if (this.hoverIntersection && !region.locked) {
                const pSecondaryImage = transformPoint(frame.spatialTransformAST, this.hoverIntersection, false);
                const pCanvasPos = transformedImageToCanvasPos(pSecondaryImage, frame, this.props.layerWidth, this.props.layerHeight, this.props.stageRef.current);
                newAnchor = <NonEditableAnchor x={pCanvasPos.x} y={pCanvasPos.y} rotation={rotation} />;
            }

            rotation = (-frame.spatialTransform.rotation * 180.0) / Math.PI;
        } else {
            controlPoints = controlPoints.map(p => {
                return transformedImageToCanvasPos(p, frame, this.props.layerWidth, this.props.layerHeight, this.props.stageRef.current);
            });
            centerPointCanvasSpace = average2D(controlPoints);
            // Construct anchors if region is selected
            if (this.props.selected && this.props.listening && !region.locked) {
                anchors = new Array<React.ReactNode>(controlPoints.length);
                for (let i = 0; i < controlPoints.length; i++) {
                    anchors[i] = this.anchorNode(controlPoints[i].x, controlPoints[i].y, rotation, i);
                }

                if (region.regionType === CARTA.RegionType.LINE && frame.hasSquarePixels) {
                    const rotatorOffset = 1;
                    const rotatorAngle = (rotation * Math.PI) / 180.0;
                    anchors.push(this.anchorNode(centerPointCanvasSpace.x + rotatorOffset * Math.sin(rotatorAngle), centerPointCanvasSpace.y - rotatorOffset * Math.cos(rotatorAngle), rotation, 2, true));
                }
            }

            if (this.hoverIntersection && !region.locked) {
                const anchorPositionPixelSpace = transformedImageToCanvasPos(this.hoverIntersection, frame, this.props.layerWidth, this.props.layerHeight, this.props.stageRef.current);
                newAnchor = <NonEditableAnchor x={anchorPositionPixelSpace.x} y={anchorPositionPixelSpace.y} rotation={rotation} />;
            }

            pointArray = new Array<number>(controlPoints.length * 2);
            for (let i = 0; i < pointArray.length / 2; i++) {
                pointArray[i * 2] = controlPoints[i].x - centerPointCanvasSpace.x;
                pointArray[i * 2 + 1] = controlPoints[i].y - centerPointCanvasSpace.y;
            }
        }

        return (
            <Group>
                <Line
                    x={centerPointCanvasSpace.x}
                    y={centerPointCanvasSpace.y}
                    stroke={region.isSimplePolygon ? region.color : INVALID_POLYGON_COLOR}
                    strokeWidth={region.lineWidth}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
                    dash={[region.dashLength]}
                    closed={!region.creating && region.regionType === CARTA.RegionType.POLYGON}
                    listening={this.props.listening && !region.locked}
                    onClick={this.handleClick}
                    onDblClick={this.handleDoubleClick}
                    onContextMenu={this.handleContextMenu}
                    onMouseEnter={region.regionType === CARTA.RegionType.LINE ? null : this.handleStrokeMouseEnter}
                    onMouseLeave={region.regionType === CARTA.RegionType.LINE ? null : this.handleStrokeMouseLeave}
                    onMouseMove={region.regionType === CARTA.RegionType.LINE ? null : this.handleMouseMove}
                    onDragStart={this.handleDragStart}
                    onDragEnd={this.handleDragEnd}
                    onDragMove={this.handleDrag}
                    perfectDrawEnabled={false}
                    strokeScaleEnabled={false}
                    lineJoin={"round"}
                    draggable={true}
                    points={pointArray}
                    hitStrokeWidth={NEW_ANCHOR_MAX_DISTANCE * 2}
                />
                <Group>
                    {anchors}
                    {newAnchor}
                </Group>
            </Group>
        );
    }
}
