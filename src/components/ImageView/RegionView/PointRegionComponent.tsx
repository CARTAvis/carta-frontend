import * as React from "react";
import {observer} from "mobx-react";
import Konva from "konva";
import {FrameStore, RegionStore} from "stores";
import {adjustPosToMutatedStage, adjustPosToUnityStage, canvasToTransformedImagePos, transformedImageToCanvasPos} from "./shared";
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
        this.props.onDoubleClick?.(this.props.region);
    };

    private handleClick = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;
        if (mouseEvent.button === 0 && !(mouseEvent.ctrlKey || mouseEvent.metaKey)) {
            this.props.onSelect?.(this.props.region);
        }
    };

    private handleDragStart = () => {
        this.props.onSelect?.(this.props.region);
        this.props.region.beginEditing();
    };

    private handleDragEnd = () => {
        this.props.region.endEditing();
    };

    private handleDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            const frame = this.props.frame;
            const position = adjustPosToUnityStage(konvaEvent.target.position(), this.props.stageRef.current.getPosition(), this.props.stageRef.current.scaleX());
            let positionImageSpace = canvasToTransformedImagePos(position.x, position.y, frame, this.props.layerWidth, this.props.layerHeight);
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
        centerPixelSpace = adjustPosToMutatedStage(centerPixelSpace, this.props.stageRef.current.getPosition(), this.props.stageRef.current.scaleX());

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
