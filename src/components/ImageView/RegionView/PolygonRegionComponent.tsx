import * as React from "react";
import {action, observable} from "mobx";
import {observer} from "mobx-react";
import {Group, Line, Rect} from "react-konva";
import Konva from "konva";
import {Colors} from "@blueprintjs/core";
import {FrameStore, RegionStore} from "stores";
import {Point2D} from "models";
import {add2D, average2D, closestPointOnLine, rotate2D, scale2D, subtract2D} from "utilities";
import {canvasToTransformedImagePos, getUpdatedPosition, imageToCanvasPos, transformedImageToCanvasPos} from "./shared";

export interface PolygonRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    listening: boolean;
    selected: boolean;
    onSelect?: (region: RegionStore) => void;
    onDoubleClick?: (region: RegionStore) => void;
}

const ANCHOR_WIDTH = 7;
const NEW_ANCHOR_MAX_DISTANCE = 16;
const INVALID_POLYGON_COLOR = Colors.ROSE4;

@observer
export class PolygonRegionComponent extends React.Component<PolygonRegionComponentProps> {
    @observable hoverIndex: number;
    @observable hoverIntersection: Point2D;
    private previousCursorStyle: string;

    private handleContextMenu = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        konvaEvent.evt.preventDefault();
        console.log("context click!");
    };

    private handleDoubleClick = () => {
        if (this.props.onDoubleClick) {
            this.props.onDoubleClick(this.props.region);
        }
    };

    private handleClick = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;

        if (mouseEvent.button === 0 && !(mouseEvent.ctrlKey || mouseEvent.metaKey)) {
            const region = this.props.region;

            // Select click
            if (this.props.onSelect) {
                this.props.onSelect(region);
            }

            // Add a new control point to the region between two existing control points
            if (this.hoverIntersection && this.hoverIndex >= 0 && this.hoverIndex < region.controlPoints.length) {
                const currentControlPoints = region.controlPoints.slice(0);
                currentControlPoints.splice(this.hoverIndex + 1, 0, this.hoverIntersection);
                // Skip SET_REGION update, since the new control point lies on the line between two existing points
                region.setControlPoints(currentControlPoints, true, false);
                this.hoverIntersection = null;
            }
        }
    };

    private handleAnchorDragStart = () => {
        if (this.props.onSelect) {
            this.props.onSelect(this.props.region);
        }
        this.props.region.beginEditing();
    };

    private handleAnchorDragEnd = () => {
        this.props.region.endEditing();
    };

    @action private handleAnchorDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            const node = konvaEvent.target;
            const region = this.props.region;
            const frame = this.props.frame;
            const index = node.index;
            if (index >= 0 && index < region.controlPoints.length) {
                const positionImageSpace = canvasToTransformedImagePos(node.position().x, node.position().y, frame, this.props.layerWidth, this.props.layerHeight);
                region.setControlPoint(index, positionImageSpace);
                this.hoverIntersection = null;
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
        this.handleMouseMove(konvaEvent);
    };

    @action private handleStrokeMouseLeave = () => {
        this.hoverIntersection = null;
    };

    @action private handleMouseMove = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;
        const region = this.props.region;
        const frame = this.props.frame;

        if (this.props.selected && region.controlPoints.length >= 2) {
            const positionImageSpace = canvasToTransformedImagePos(mouseEvent.offsetX, mouseEvent.offsetY, frame, this.props.layerWidth, this.props.layerHeight);
            let minDistance = Number.MAX_VALUE;
            let closestIndex = -1;
            let closestPoint: Point2D = null;
            // Find closest point on each line segment, select the closest overall that actually lies on the line segment
            for (let i = 0; i < region.controlPoints.length; i++) {
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
            } else {
                this.hoverIntersection = null;
            }
        }
    };

    private handleAnchorMouseEnter = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target && konvaEvent.target.getStage()) {
            this.previousCursorStyle = konvaEvent.target.getStage().container().style.cursor;
            konvaEvent.target.getStage().container().style.cursor = "move";
        }
    };

    private handleAnchorMouseOut = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target && konvaEvent.target.getStage()) {
            konvaEvent.target.getStage().container().style.cursor = this.previousCursorStyle;
        }
    };

    @action handleDragStart = () => {
        if (this.props.onSelect) {
            this.props.onSelect(this.props.region);
        }
        this.props.region.beginEditing();
        this.hoverIntersection = null;
    };

    @action handleDragEnd = () => {
        this.props.region.endEditing();
    };

    @action handleDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            const node = konvaEvent.target;
            const region = this.props.region;
            const frame = this.props.frame;
            const centerImageSpace = average2D(region.controlPoints);
            const zoomLevel = frame.spatialReference ? frame.spatialReference.zoomLevel : frame.zoomLevel;
            const newPosition = getUpdatedPosition(centerImageSpace, node.position(), zoomLevel, frame, this.props.layerWidth, this.props.layerHeight);
            const deltaPosition = subtract2D(newPosition, centerImageSpace);
            const newPoints = region.controlPoints.map(p => add2D(p, deltaPosition));
            region.setControlPoints(newPoints, false, false);
        }
    };

    private getCanvasPointArray(points: Point2D[]) {
        if (!points || !points.length) {
            return null;
        }

        const frame = this.props.frame;

        const currentView = frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
        const viewWidth = currentView.xMax - currentView.xMin;
        const viewHeight = currentView.yMax - currentView.yMin;
        let offset = {x: 1.0, y: 1.0};

        if (frame.spatialReference) {
            offset = scale2D(rotate2D(offset, frame.spatialTransform.rotation), frame.spatialTransform.scale);
        }

        const pointArray = new Array<number>(points.length * 2);
        for (let i = 0; i < points.length; i++) {
            const x = ((points[i].x + offset.x - currentView.xMin) / viewWidth * this.props.layerWidth);
            const y = this.props.layerHeight - ((points[i].y + offset.y - currentView.yMin) / viewHeight * this.props.layerHeight);
            pointArray[i * 2] = x;
            pointArray[i * 2 + 1] = y;
        }
        return pointArray;
    }

    private anchorNode(x: number, y: number, rotation: number = 0, key: number = undefined, editableAnchor: boolean = false) {
        let anchorProps: any = {
            x: x,
            y: y,
            offsetX: ANCHOR_WIDTH / 2.0,
            offsetY: ANCHOR_WIDTH / 2.0,
            width: ANCHOR_WIDTH,
            height: ANCHOR_WIDTH,
            fill: "white",
            strokeWidth: 1,
            stroke: "black",
            rotation: rotation
        };
        if (editableAnchor) {
            anchorProps = {
                ...anchorProps,
                draggable: true,
                key: key,
                onMouseEnter: this.handleAnchorMouseEnter,
                onMouseOut: this.handleAnchorMouseOut,
                onDragStart: this.handleAnchorDragStart,
                onDragEnd: this.handleAnchorDragEnd,
                onDragMove: this.handleAnchorDrag,
                onDblClick: this.handleAnchorDoubleClick,
            };
        } else {
            anchorProps.opacity = 0.5;
            anchorProps.listening = false;
        }
        return <Rect {...anchorProps}/>;
    }

    render() {
        const region = this.props.region;
        const frame = this.props.frame;
        const frameView = frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
        let rotation = 0.0;

        let controlPoints = region.controlPoints;
        if (frame.spatialReference) {
            controlPoints = controlPoints.map(p => frame.spatialTransform.transformCoordinate(p, true));
            rotation = -frame.spatialTransform.rotation * 180.0 / Math.PI;
        }

        const centerPoint = average2D(controlPoints);
        const centerPointCanvasSpace = imageToCanvasPos(centerPoint.x, centerPoint.y, frameView, this.props.layerWidth, this.props.layerHeight, frame.spatialTransform);
        const pointArray = this.getCanvasPointArray(controlPoints);

        for (let i = 0; i < pointArray.length / 2; i++) {
            pointArray[i * 2] -= centerPointCanvasSpace.x;
            pointArray[i * 2 + 1] -= centerPointCanvasSpace.y;
        }

        // Construct anchors if region is selected
        let anchors = null;
        if (this.props.selected && !region.locked) {
            anchors = new Array<React.ReactNode>(pointArray.length / 2);
            for (let i = 0; i < pointArray.length / 2; i++) {
                anchors[i] = this.anchorNode(centerPointCanvasSpace.x + pointArray[i * 2], centerPointCanvasSpace.y + pointArray[i * 2 + 1], rotation, i, true);
            }
        }

        let newAnchor = null;
        if (this.hoverIntersection && !region.locked) {
            const anchorPositionPixelSpace = transformedImageToCanvasPos(this.hoverIntersection.x, this.hoverIntersection.y, frame, this.props.layerWidth, this.props.layerHeight);
            newAnchor = this.anchorNode(anchorPositionPixelSpace.x, anchorPositionPixelSpace.y, rotation);
        }

        return (
            <Group>
                <Line
                    x={centerPointCanvasSpace.x}
                    y={centerPointCanvasSpace.y}
                    stroke={region.isSimplePolygon ? region.color : INVALID_POLYGON_COLOR}
                    strokeWidth={region.lineWidth}
                    opacity={region.isTemporary ? 0.5 : (region.locked ? 0.70 : 1)}
                    dash={[region.dashLength]}
                    closed={!region.creating}
                    listening={this.props.listening && !region.locked}
                    onClick={this.handleClick}
                    onDblClick={this.handleDoubleClick}
                    onContextMenu={this.handleContextMenu}
                    onMouseEnter={this.handleStrokeMouseEnter}
                    onMouseLeave={this.handleStrokeMouseLeave}
                    onMouseMove={this.handleMouseMove}
                    onDragStart={this.handleDragStart}
                    onDragEnd={this.handleDragEnd}
                    onDragMove={this.handleDrag}
                    perfectDrawEnabled={false}
                    lineJoin={"round"}
                    draggable={true}
                    points={pointArray}
                    strokeHitEnabled={true}
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