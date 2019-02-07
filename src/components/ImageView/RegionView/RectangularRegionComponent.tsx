import * as React from "react";
import * as Konva from "konva";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {Group, Rect, Transformer} from "react-konva";
import {FrameStore, RegionStore} from "../../../stores";

export interface RectangularRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    selected: boolean;
    onSelect?: (region: RegionStore) => void;
    onPanClick?: () => void;
}

@observer
export class RectangularRegionComponent extends React.Component<RectangularRegionComponentProps> {
    @observable selectedRegionRef;
    @observable centeredScaling;

    handleRef = (ref) => {
        if (ref && this.selectedRegionRef !== ref) {
            this.selectedRegionRef = ref;
        }
    };

    handleClick = (konvaEvent) => {
        const mouseEvent = konvaEvent.evt as MouseEvent;

        if (mouseEvent.button === 0) {
            // Select click
            console.log("select click");
            if (this.props.onSelect) {
                this.props.onSelect(this.props.region);
            }
        } else if (mouseEvent.button === 2) {
            // Context click
            console.log("context click!");
        }
    };

    handleTransformStart = (konvaEvent) => {
        this.centeredScaling = konvaEvent.evt.evt.ctrlKey;
        const node = konvaEvent.currentTarget.node() as Konva.Node;
        this.props.region.beginEditing();
    };

    handleTransformEnd = (konvaEvent) => {
        const node = konvaEvent.currentTarget.node() as Konva.Node;
        this.props.region.endEditing();
    };

    handleTransform = (konvaEvent) => {
        if (konvaEvent.currentTarget && konvaEvent.currentTarget.node) {
            const anchor = konvaEvent.currentTarget.movingResizer as string;
            const node = konvaEvent.currentTarget.node() as Konva.Node;
            const region = this.props.region;

            if (anchor.indexOf("rotater") >= 0) {
                // handle rotation
                const rotation = node.rotation();
                region.setRotation(rotation);
            } else {
                // handle scaling
                const nodeScale = node.scale();
                node.setAttr("scaleX", 1);
                node.setAttr("scaleY", 1);

                if (nodeScale.x <= 0 || nodeScale.y <= 0) {
                    return;
                }

                if (this.centeredScaling) {
                    const newWidth = region.controlPoints[1].x * nodeScale.x;
                    const newHeight = region.controlPoints[1].y * nodeScale.y;
                    region.setControlPoint(1, {x: newWidth, y: newHeight});
                } else {
                    const newWidth = region.controlPoints[1].x * nodeScale.x;
                    const newHeight = region.controlPoints[1].y * nodeScale.y;
                    const deltaWidth = newWidth - region.controlPoints[1].x;
                    const deltaHeight = newHeight - region.controlPoints[1].y;
                    let center = {x: region.controlPoints[0].x, y: region.controlPoints[0].y};
                    const cosX = Math.cos(region.rotation * Math.PI / 180.0);
                    const sinX = Math.sin(region.rotation * Math.PI / 180.0);
                    if (anchor.indexOf("left") >= 0) {
                        center.x -= cosX * deltaWidth / 2.0;
                        center.y += sinX * deltaWidth / 2.0;
                    } else if (anchor.indexOf("right") >= 0) {
                        center.x += cosX * deltaWidth / 2.0;
                        center.y -= sinX * deltaWidth / 2.0;
                    }

                    if (anchor.indexOf("top") >= 0) {
                        center.y += cosX * deltaHeight / 2.0;
                        center.x += sinX * deltaHeight / 2.0;
                    } else if (anchor.indexOf("bottom") >= 0) {
                        center.y -= cosX * deltaHeight / 2.0;
                        center.x -= sinX * deltaHeight / 2.0;
                    }

                    region.setControlPoints([center, {x: newWidth, y: newHeight}]);
                }
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
            const currentView = frame.requiredFrameView;
            const centerImageSpace = region.controlPoints[0];
            const viewWidth = currentView.xMax - currentView.xMin;
            const viewHeight = currentView.yMax - currentView.yMin;
            const currentCenterPixelSpace = {x: ((centerImageSpace.x - currentView.xMin) / viewWidth * this.props.layerWidth), y: this.props.layerHeight - ((centerImageSpace.y - currentView.yMin) / viewHeight * this.props.layerHeight)};
            const newCenterPixelSpace = node.position();
            const deltaPositionImageSpace = {x: (newCenterPixelSpace.x - currentCenterPixelSpace.x) / frame.zoomLevel, y: -(newCenterPixelSpace.y - currentCenterPixelSpace.y) / frame.zoomLevel};
            // region.setControlPoint(0, {x: centerImageSpace.x + deltaPositionImageSpace.x, y: centerImageSpace.y + deltaPositionImageSpace.y});
            const newPosition = {x: centerImageSpace.x + deltaPositionImageSpace.x, y: centerImageSpace.y + deltaPositionImageSpace.y};
            region.setControlPoint(0, newPosition);
        }
    };

    render() {
        const region = this.props.region;
        const frame = this.props.frame;
        const currentView = frame.requiredFrameView;
        const centerImageSpace = region.controlPoints[0];
        const viewWidth = currentView.xMax - currentView.xMin;
        const viewHeight = currentView.yMax - currentView.yMin;

        const centerPixelSpace = {x: ((centerImageSpace.x - currentView.xMin) / viewWidth * this.props.layerWidth), y: this.props.layerHeight - ((centerImageSpace.y - currentView.yMin) / viewHeight * this.props.layerHeight)};
        const width = (region.controlPoints[1].x * frame.zoomLevel);
        const height = (region.controlPoints[1].y * frame.zoomLevel);
        return (
            <Group>
                <Rect
                    rotation={region.rotation}
                    x={centerPixelSpace.x + 0.5}
                    y={centerPixelSpace.y + 0.5}
                    width={width}
                    height={height}
                    offsetX={width / 2.0}
                    offsetY={height / 2.0}
                    stroke={region.editing ? "green" : "orange"}
                    strokeWidth={1}
                    draggable={true}
                    onDragStart={this.handleDragStart}
                    onDragEnd={this.handleDragEnd}
                    onDragMove={this.handleDrag}
                    onClick={this.handleClick}
                    fillEnabled={true}
                    ref={this.handleRef}
                />
                {this.selectedRegionRef && this.props.selected &&
                <Transformer
                    node={this.selectedRegionRef}
                    rotateAnchorOffset={15}
                    anchorSize={8}
                    borderStroke={region.editing ? "green" : "orange"}
                    keepRatio={false}
                    centeredScaling={this.centeredScaling}
                    draggable={false}
                    borderEnabled={true}
                    onTransformStart={this.handleTransformStart}
                    onTransform={this.handleTransform}
                    onTransformEnd={this.handleTransformEnd}
                />
                }
            </Group>
        );
    }
}