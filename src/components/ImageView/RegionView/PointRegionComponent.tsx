import * as React from "react";
import {observer} from "mobx-react";
import {Group, Rect} from "react-konva";
import Konva from "konva";
import {FrameStore, RegionStore} from "stores";
import {getUpdatedPosition, transformedImageToCanvasPos} from "./shared";

export interface PointRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    selected: boolean;
    onSelect?: (region: RegionStore) => void;
    onDoubleClick?: (region: RegionStore) => void;
}

const POINT_DRAG_WIDTH = 13;
const POINT_WIDTH = 6;

@observer
export class PointRegionComponent extends React.Component<PointRegionComponentProps> {
    handleDoubleClick = () => {
        if (this.props.onDoubleClick) {
            this.props.onDoubleClick(this.props.region);
        }
    };

    handleClick = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;

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

    handleDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            const node = konvaEvent.target;
            const region = this.props.region;
            const frame = this.props.frame;
            const zoomLevel = frame.spatialReference ? frame.spatialReference.zoomLevel : frame.zoomLevel;
            const newPosition = getUpdatedPosition (region.controlPoints[0], node.position(), zoomLevel, frame, this.props.layerWidth, this.props.layerHeight);
            region.setControlPoint(0, newPosition);
        }
    };

    render() {
        const region = this.props.region;
        const frame = this.props.frame;

        const centerPixelSpace = transformedImageToCanvasPos(region.controlPoints[0].x, region.controlPoints[0].y, frame, this.props.layerWidth, this.props.layerHeight);
        const rotation = frame.spatialReference ? frame.spatialTransform.rotation * 180.0 / Math.PI : 0.0;

        return (
            <Group>
                <Rect
                    rotation={-rotation}
                    x={centerPixelSpace.x}
                    y={centerPixelSpace.y}
                    width={POINT_WIDTH}
                    height={POINT_WIDTH}
                    offsetX={POINT_WIDTH * 0.5}
                    offsetY={POINT_WIDTH * 0.5}
                    fill={region.color}
                />
                <Rect
                    rotation={-rotation}
                    x={centerPixelSpace.x}
                    y={centerPixelSpace.y}
                    width={POINT_DRAG_WIDTH}
                    stroke={"white"}
                    strokeWidth={1}
                    height={POINT_DRAG_WIDTH}
                    offsetX={POINT_DRAG_WIDTH * 0.5}
                    offsetY={POINT_DRAG_WIDTH * 0.5}
                    opacity={this.props.selected ? 1 : 0}
                    draggable={true}
                    listening={!region.locked}
                    onDragStart={this.handleDragStart}
                    onDragEnd={this.handleDragEnd}
                    onDragMove={this.handleDrag}
                    onClick={this.handleClick}
                    onDblClick={this.handleDoubleClick}
                />
            </Group>
        );
    }
}