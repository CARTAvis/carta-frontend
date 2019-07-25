import * as React from "react";
import {observer} from "mobx-react";
import {Group, Rect} from "react-konva";
import Konva from "konva";
import {FrameStore, RegionStore} from "stores";
import {imageToCanvasPos} from "./shared";

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
const POINT_WIDTH = 4;

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
            const centerImageSpace = region.controlPoints[0];

            const currentCenterPixelSpace = imageToCanvasPos(centerImageSpace.x, centerImageSpace.y, frame.requiredFrameView, this.props.layerWidth, this.props.layerHeight);
            const newCenterPixelSpace = node.position();
            const deltaPositionImageSpace = {x: (newCenterPixelSpace.x - currentCenterPixelSpace.x) / frame.zoomLevel, y: -(newCenterPixelSpace.y - currentCenterPixelSpace.y) / frame.zoomLevel};
            const newPosition = {x: centerImageSpace.x + deltaPositionImageSpace.x, y: centerImageSpace.y + deltaPositionImageSpace.y};
            region.setControlPoint(0, newPosition);
        }
    };

    render() {
        const region = this.props.region;
        const frame = this.props.frame;
        const centerImageSpace = region.controlPoints[0];

        const centerPixelSpace = imageToCanvasPos(centerImageSpace.x, centerImageSpace.y, frame.requiredFrameView, this.props.layerWidth, this.props.layerHeight);

        return (
            <Group>
                <Rect
                    x={centerPixelSpace.x}
                    y={centerPixelSpace.y}
                    width={POINT_WIDTH}
                    height={POINT_WIDTH}
                    offsetX={POINT_WIDTH * 0.5}
                    offsetY={POINT_WIDTH * 0.5}
                    fill={region.color}
                />
                <Rect
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