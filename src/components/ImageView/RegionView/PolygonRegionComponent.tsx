import * as React from "react";
import {observer} from "mobx-react";
import {Group, Line, Rect} from "react-konva";
import Konva from "konva";
import {FrameStore, RegionStore} from "stores";
import {Point2D} from "models";

export interface PolygonRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    listening: boolean;
    selected: boolean;
    onSelect?: (region: RegionStore) => void;
    onDoubleClick?: (region: RegionStore) => void;
    onPanClick?: () => void;
}

const ANCHOR_WIDTH = 7;

@observer
export class PolygonRegionComponent extends React.Component<PolygonRegionComponentProps> {
    handleContextMenu = (konvaEvent) => {
        konvaEvent.evt.preventDefault();
        console.log("context click!");
    };

    handleDoubleClick = () => {
        if (this.props.onDoubleClick) {
            this.props.onDoubleClick(this.props.region);
        }
    };

    handleClick = (konvaEvent) => {
        const mouseEvent = konvaEvent.evt as MouseEvent;

        if (mouseEvent.button === 0 && !(mouseEvent.ctrlKey || mouseEvent.metaKey)) {
            // Select click
            if (this.props.onSelect) {
                this.props.onSelect(this.props.region);
            }
        }
    };

    handleDragStart = () => {
        if (this.props.onSelect) {
            this.props.onSelect(this.props.region);
        }
        this.props.region.beginEditing();
    };

    handleDragEnd = () => {
        this.props.region.endEditing();
    };

    handleDrag = (konvaEvent) => {
        if (konvaEvent.target) {
            const node = konvaEvent.target as Konva.Node;
            const region = this.props.region;
            const frame = this.props.frame;
            const index = node.index;
            if (index >= 0 && index < region.controlPoints.length) {
                const newPositionPixelSpace = node.position();
                const newPosition = this.getImagePos(newPositionPixelSpace.x, newPositionPixelSpace.y);
                region.setControlPoint(index, newPosition);
            }
        }
    };

    handleAnchorDoubleClick = (konvaEvent) => {
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

    private getImagePos(canvasX: number, canvasY: number): Point2D {
        const frameView = this.props.frame.requiredFrameView;
        return {
            x: (canvasX / this.props.layerWidth) * (frameView.xMax - frameView.xMin) + frameView.xMin - 1,
            // y coordinate is flipped in image space
            y: (canvasY / this.props.layerHeight) * (frameView.yMin - frameView.yMax) + frameView.yMax - 1
        };
    }

    private getCanvasPos(imageX: number, imageY: number) {
        const currentView = this.props.frame.requiredFrameView;
        const viewWidth = currentView.xMax - currentView.xMin;
        const viewHeight = currentView.yMax - currentView.yMin;
        return {
            x: ((imageX + 1 - currentView.xMin) / viewWidth * this.props.layerWidth),
            y: this.props.layerHeight - ((imageY + 1 - currentView.yMin) / viewHeight * this.props.layerHeight)
        };
    }

    private getCanvasPointArray(points: Point2D[]) {
        if (!points || !points.length) {
            return null;
        }

        const currentView = this.props.frame.requiredFrameView;
        const viewWidth = currentView.xMax - currentView.xMin;
        const viewHeight = currentView.yMax - currentView.yMin;

        const pointArray = new Array<number>(points.length * 2);
        for (let i = 0; i < points.length; i++) {
            const x = ((points[i].x + 1 - currentView.xMin) / viewWidth * this.props.layerWidth);
            const y = this.props.layerHeight - ((points[i].y + 1 - currentView.yMin) / viewHeight * this.props.layerHeight);
            pointArray[i * 2] = x;
            pointArray[i * 2 + 1] = y;
        }
        return pointArray;
    }

    render() {
        const region = this.props.region;
        const pointArray = this.getCanvasPointArray(region.controlPoints);

        // Construct anchors if region is selected
        let anchors = null;
        if (this.props.selected) {
            anchors = new Array<React.ReactNode>(pointArray.length / 2);
            for (let i = 0; i < pointArray.length / 2; i++) {
                anchors[i] = (
                    <Rect
                        key={i}
                        x={pointArray[i * 2] - ANCHOR_WIDTH / 2.0}
                        y={pointArray[i * 2 + 1] - ANCHOR_WIDTH / 2.0}
                        width={ANCHOR_WIDTH}
                        height={ANCHOR_WIDTH}
                        draggable={true}
                        onDragStart={this.handleDragStart}
                        onDragEnd={this.handleDragEnd}
                        onDragMove={this.handleDrag}
                        onDblClick={this.handleAnchorDoubleClick}
                        stroke={"white"}
                    />
                );
            }
        }

        return (
            <Group>
                <Line
                    stroke={region.color}
                    strokeWidth={region.lineWidth}
                    opacity={region.isTemporary ? 0.5 : 1.0}
                    dash={[region.dashLength]}
                    closed={!region.creating}
                    listening={this.props.listening}
                    onClick={this.handleClick}
                    onDblClick={this.handleDoubleClick}
                    onContextMenu={this.handleContextMenu}
                    perfectDrawEnabled={false}
                    lineJoin={"round"}
                    points={pointArray}
                />
                <Group>
                    {anchors}
                </Group>
            </Group>
        );
    }
}