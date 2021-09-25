import * as React from "react";
import {observer} from "mobx-react";
import Konva from "konva";
import {FrameStore, RegionStore} from "stores";
import {canvasToTransformedImagePos, transformedImageToCanvasPos} from "./shared";
import {Point2D} from "models";
import {transformPoint} from "utilities";
import {Point} from "./InvariantShapes";

interface PointRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    selected: boolean;
    stageRef: any;
    onSelect?: (region: RegionStore) => void;
    onDoubleClick?: (region: RegionStore) => void;
}

@observer
export class PointRegionComponent extends React.Component<PointRegionComponentProps> {
    private handleDoubleClick = () => {
        if (this.props.onDoubleClick) {
            this.props.onDoubleClick(this.props.region);
        }
    };

    private handleClick = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;

        if (mouseEvent.button === 0 && !(mouseEvent.ctrlKey || mouseEvent.metaKey)) {
            // Select click
            if (this.props.onSelect) {
                this.props.onSelect(this.props.region);
            }
        }
    };

    private handleDragStart = () => {
        if (this.props.onSelect) {
            this.props.onSelect(this.props.region);
        }
        this.props.region.beginEditing();
    };

    private handleDragEnd = () => {
        this.props.region.endEditing();
    };

    private handleDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            const frame = this.props.frame;
            const zoomLevel = this.props.stageRef.scaleX();
            const stageOrigin = this.props.stageRef.getPosition();
            const position = konvaEvent.target.position();
            const correctedPosition = {x: position.x * zoomLevel + stageOrigin.x, y: position.y * zoomLevel + stageOrigin.y};
            let positionImageSpace = canvasToTransformedImagePos(correctedPosition.x, correctedPosition.y, frame, this.props.layerWidth, this.props.layerHeight);
            if (frame.spatialReference) {
                positionImageSpace = transformPoint(frame.spatialTransformAST, positionImageSpace, true);
            }
            this.props.region.setCenter(positionImageSpace);
        }
    };

    public render() {
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

        // Correct canvas space cooridnate according to stage's scale & origin
        const zoomLevel = this.props.stageRef.scaleX();
        const stageOrigin = this.props.stageRef.getPosition();
        centerPixelSpace = {x: (centerPixelSpace.x - stageOrigin.x) / zoomLevel, y: (centerPixelSpace.y - stageOrigin.y) / zoomLevel};

        return (
            <Point
                x={centerPixelSpace.x}
                y={centerPixelSpace.y}
                rotation={rotation}
                color={region.color}
                opacity={this.props.selected ? 1 : 0}
                listening={!region.locked}
                onDragStart={this.handleDragStart}
                onDragEnd={this.handleDragEnd}
                onDragMove={this.handleDrag}
                onClick={this.handleClick}
                onDblClick={this.handleDoubleClick}
            />
        );
    }
}
