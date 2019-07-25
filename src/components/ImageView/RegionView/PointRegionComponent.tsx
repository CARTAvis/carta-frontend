import * as React from "react";
import {Colors} from "@blueprintjs/core";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {Group, Rect, Transformer} from "react-konva";
import Konva from "konva";
import {FrameStore, RegionStore} from "stores";
import {Point2D} from "models";

export interface PointRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    selected: boolean;
    onSelect?: (region: RegionStore) => void;
    onDoubleClick?: (region: RegionStore) => void;
    onPanClick?: () => void;
}

@observer
export class PointRegionComponent extends React.Component<PointRegionComponentProps> {
    @observable selectedRegionRef;

    handleRef = (ref) => {
        if (ref && this.selectedRegionRef !== ref) {
            this.selectedRegionRef = ref;
        }
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
            const centerImageSpace = region.controlPoints[0];

            const currentCenterPixelSpace = this.getCanvasPos(centerImageSpace.x, centerImageSpace.y);
            const newCenterPixelSpace = node.position();
            const deltaPositionImageSpace = {x: (newCenterPixelSpace.x - currentCenterPixelSpace.x) / frame.zoomLevel, y: -(newCenterPixelSpace.y - currentCenterPixelSpace.y) / frame.zoomLevel};
            const newPosition = {x: centerImageSpace.x + deltaPositionImageSpace.x, y: centerImageSpace.y + deltaPositionImageSpace.y};
            region.setControlPoint(0, newPosition);
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

    render() {
        const region = this.props.region;
        const frame = this.props.frame;
        const centerImageSpace = region.controlPoints[0];

        const centerPixelSpace = this.getCanvasPos(centerImageSpace.x, centerImageSpace.y);
        const pointBoardWidth = 13;

        const commonProps = {
            x: centerPixelSpace.x,
            y: centerPixelSpace.y,
            stroke: region.color,
            strokeWidth: region.lineWidth,
            draggable: true,
            onDragStart: this.handleDragStart,
            onDragEnd: this.handleDragEnd,
            onDragMove: this.handleDrag,
            onClick: this.handleClick,
            onDblClick: this.handleDoubleClick,
            perfectDrawEnabled: false,
            ref: this.handleRef
        };

        return (
            <Group>
                <Rect
                    {...commonProps}
                    width={4}
                    height={4}
                    offsetX={2}
                    offsetY={2}
                    fill={region.color}
                    hitStrokeWidth={16}
                />
                {this.selectedRegionRef && this.props.selected &&
                <Rect
                    {...commonProps}
                    width={pointBoardWidth}
                    height={pointBoardWidth}
                    offsetX={pointBoardWidth * .5}
                    offsetY={pointBoardWidth * .5}
                    opacity={0}
                />
                }
                {this.selectedRegionRef && this.props.selected &&
                <Transformer
                    node={this.selectedRegionRef}
                    rotateAnchorOffset={15}
                    anchorSize={6}
                    borderStroke={Colors.TURQUOISE5}
                    borderStrokeWidth={3}
                    borderDash={[3]}
                    keepRatio={false}
                    centeredScaling={true}
                    draggable={false}
                    borderEnabled={true}
                    resizeEnabled={false}
                    rotateEnabled={false}
                />
                }
            </Group>
        );
    }
}