import * as React from "react";
import {observer} from "mobx-react";
import {Group, Rect} from "react-konva";
import Konva from "konva";
import {FrameStore, RegionStore} from "stores";
import {canvasToTransformedImagePos, transformedImageToCanvasPos} from "./shared";
import {Point2D} from "models";
import {transformPoint} from "utilities";

interface PointRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    selected: boolean;
    stageOrigin: Point2D;
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
            let positionImageSpace = canvasToTransformedImagePos(node.position().x + this.props.stageOrigin.x, node.position().y + this.props.stageOrigin.y, frame, this.props.layerWidth, this.props.layerHeight);
            if (frame.spatialReference) {
                positionImageSpace = transformPoint(frame.spatialTransformAST, positionImageSpace, true);
            }
            region.setCenter(positionImageSpace);
        }
    };

    render() {
        const region = this.props.region;
        const frame = this.props.frame;

        let centerPixelSpace: Point2D;
        let rotation: number;

        if (frame.spatialReference) {
            const pointReferenceImage = region.center;
            const pointSecondaryImage = transformPoint(frame.spatialTransformAST, pointReferenceImage, false);
            centerPixelSpace = transformedImageToCanvasPos(pointSecondaryImage.x, pointSecondaryImage.y, frame, this.props.layerWidth, this.props.layerHeight);
            rotation = (-frame.spatialTransform.rotation * 180.0) / Math.PI;
        } else {
            centerPixelSpace = transformedImageToCanvasPos(region.center.x, region.center.y, frame, this.props.layerWidth, this.props.layerHeight);
            rotation = 0;
        }
        centerPixelSpace = {x: centerPixelSpace.x - this.props.stageOrigin.x, y: centerPixelSpace.y - this.props.stageOrigin.y};

        return (
            <Group>
                <Rect rotation={rotation} x={centerPixelSpace.x} y={centerPixelSpace.y} width={POINT_WIDTH} height={POINT_WIDTH} offsetX={POINT_WIDTH * 0.5} offsetY={POINT_WIDTH * 0.5} fill={region.color} />
                <Rect
                    rotation={rotation}
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
