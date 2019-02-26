import * as React from "react";
import * as Konva from "konva";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {Ellipse, Group, Rect, Transformer} from "react-konva";
import {FrameStore, RegionStore, RegionType} from "../../../stores";
import {Colors} from "@blueprintjs/core";
import {Point2D} from "../../../models";

export interface RectangularRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    listening: boolean;
    selected: boolean;
    onSelect?: (region: RegionStore) => void;
    onPanClick?: () => void;
}

@observer
export class RectangularRegionComponent extends React.Component<RectangularRegionComponentProps> {
    @observable selectedRegionRef;

    private editAnchor: string;
    private editStartAnchorPoint: Point2D;
    private editOppositeAnchorPoint: Point2D;
    private editStartCenterPoint: Point2D;

    handleRef = (ref) => {
        if (ref && this.selectedRegionRef !== ref) {
            this.selectedRegionRef = ref;
        }
    };

    handleClick = (konvaEvent) => {
        const mouseEvent = konvaEvent.evt as MouseEvent;

        if (mouseEvent.button === 0) {
            // Select click
            if (this.props.onSelect) {
                this.props.onSelect(this.props.region);
            }
        } else if (mouseEvent.button === 2) {
            // Context click
            console.log("context click!");
        }
    };

    handleTransformStart = (konvaEvent) => {
        this.editAnchor = konvaEvent.currentTarget.movingResizer;
        const controlPoints = this.props.region.controlPoints;

        this.editStartCenterPoint = {x: controlPoints[0].x, y: controlPoints[0].y};
        this.editStartAnchorPoint = {x: controlPoints[0].x, y: controlPoints[0].y};
        this.editOppositeAnchorPoint = {x: controlPoints[0].x, y: controlPoints[0].y};

        const sizeFactor = this.props.region.regionType === RegionType.RECTANGLE ? 0.5 : 1.0;

        if (this.editAnchor.indexOf("left") >= 0) {
            this.editStartAnchorPoint.x = controlPoints[0].x - controlPoints[1].x * sizeFactor;
        } else if (this.editAnchor.indexOf("right") >= 0) {
            this.editStartAnchorPoint.x = controlPoints[0].x + controlPoints[1].x * sizeFactor;
        }

        if (this.editAnchor.indexOf("top") >= 0) {
            this.editStartAnchorPoint.y = controlPoints[0].y + controlPoints[1].y * sizeFactor;
        } else if (this.editAnchor.indexOf("bottom") >= 0) {
            this.editStartAnchorPoint.y = controlPoints[0].y - controlPoints[1].y * sizeFactor;
        }

        this.editOppositeAnchorPoint = {
            x: 2 * this.editStartCenterPoint.x - this.editStartAnchorPoint.x,
            y: 2 * this.editStartCenterPoint.y - this.editStartAnchorPoint.y,
        };

        this.props.region.beginEditing();
    };

    handleTransformEnd = () => {
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
                let nodeScale = node.scale();
                const centerCanvasPos = this.getCanvasPos(region.controlPoints[0].x, region.controlPoints[0].y);
                node.x(centerCanvasPos.x);
                node.y(centerCanvasPos.y);
                node.scaleX(1);
                node.scaleY(1);

                // alternative anchor handling:
                const newAnchorPoint = this.getImagePos(konvaEvent.evt.offsetX, konvaEvent.evt.offsetY);
                const centerPoint = region.controlPoints[0];

                const deltaAnchorPoint = {x: newAnchorPoint.x - centerPoint.x, y: newAnchorPoint.y - centerPoint.y};
                const cosX = Math.cos(region.rotation * Math.PI / 180.0);
                const sinX = Math.sin(region.rotation * Math.PI / 180.0);

                const deltaAnchorPointRotated = {x: cosX * deltaAnchorPoint.x - sinX * deltaAnchorPoint.y, y: sinX * deltaAnchorPoint.x + cosX * deltaAnchorPoint.y};
                const anchorPointRotated = {x: centerPoint.x + deltaAnchorPointRotated.x, y: centerPoint.y + deltaAnchorPointRotated.y};


                const cornerScaling = konvaEvent.evt.ctrlKey;

                if (cornerScaling) {
                    let w = region.controlPoints[1].x;
                    let h = region.controlPoints[1].y;
                    const sizeFactor = region.regionType === RegionType.RECTANGLE ? 1.0 : 0.5;

                    let newCenter = {x: region.controlPoints[0].x, y: region.controlPoints[0].y};

                    if (anchor.indexOf("left") >= 0 || anchor.indexOf("right") >= 0) {
                        w = Math.abs(this.editOppositeAnchorPoint.x - anchorPointRotated.x) * sizeFactor;
                        newCenter.x = (anchorPointRotated.x + this.editOppositeAnchorPoint.x) / 2.0;
                    }
                    if (anchor.indexOf("top") >= 0 || anchor.indexOf("bottom") >= 0) {
                        h = Math.abs(this.editOppositeAnchorPoint.y - anchorPointRotated.y) * sizeFactor;
                        newCenter.y = cosX * (anchorPointRotated.y + this.editOppositeAnchorPoint.y) / 2.0;
                        newCenter.y = cosX * (anchorPointRotated.y + this.editOppositeAnchorPoint.y) / 2.0;
                    }
                    region.setControlPoints([newCenter, {x: Math.max(1e-3, w), y: Math.max(1e-3, h)}]);
                } else {
                    let w = region.controlPoints[1].x;
                    let h = region.controlPoints[1].y;
                    const sizeFactor = region.regionType === RegionType.RECTANGLE ? 2.0 : 1.0;

                    if (anchor.indexOf("left") >= 0 || anchor.indexOf("right") >= 0) {
                        w = Math.abs(this.editStartCenterPoint.x - anchorPointRotated.x) * sizeFactor;
                    }
                    if (anchor.indexOf("top") >= 0 || anchor.indexOf("bottom") >= 0) {
                        h = Math.abs(this.editStartCenterPoint.y - anchorPointRotated.y) * sizeFactor;
                    }

                    if (konvaEvent.evt.shiftKey) {
                        const maxSide = Math.max(w, h);
                        w = maxSide;
                        h = maxSide;
                    }

                    region.setControlPoints([this.editStartCenterPoint, {x: Math.max(1e-3, w), y: Math.max(1e-3, h)}]);
                }

                // const newWidth = region.controlPoints[1].x * Math.abs(nodeScale.x);
                // const newHeight = region.controlPoints[1].y * Math.abs(nodeScale.y);
                // if (this.centeredScaling) {
                //     region.setControlPoint(1, {x: newWidth, y: newHeight});
                // } else {
                //     const deltaWidth = (newWidth - region.controlPoints[1].x) * (region.regionType === RegionType.ELLIPSE ? 2 : 1);
                //     const deltaHeight = (newHeight - region.controlPoints[1].y) * (region.regionType === RegionType.ELLIPSE ? 2 : 1);
                //     let center = {x: region.controlPoints[0].x, y: region.controlPoints[0].y};
                //     const cosX = Math.cos(region.rotation * Math.PI / 180.0);
                //     const sinX = Math.sin(region.rotation * Math.PI / 180.0);
                //     if (anchor.indexOf("left") >= 0) {
                //         center.x -= cosX * deltaWidth / 2.0;
                //         center.y += sinX * deltaWidth / 2.0;
                //     } else if (anchor.indexOf("right") >= 0) {
                //         center.x += cosX * deltaWidth / 2.0;
                //         center.y -= sinX * deltaWidth / 2.0;
                //     }
                //
                //     if (anchor.indexOf("top") >= 0) {
                //         center.y += cosX * deltaHeight / 2.0;
                //         center.x += sinX * deltaHeight / 2.0;
                //     } else if (anchor.indexOf("bottom") >= 0) {
                //         center.y -= cosX * deltaHeight / 2.0;
                //         center.x -= sinX * deltaHeight / 2.0;
                //     }
                //
                //     region.setControlPoints([center, {x: newWidth, y: newHeight}]);
                // }
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
        const width = (region.controlPoints[1].x * frame.zoomLevel);
        const height = (region.controlPoints[1].y * frame.zoomLevel);

        // Adjusts the dash length to force the total number of dashes around the bounding box perimeter to 50
        const borderDash = [(width + height) * 4 / 100.0];

        return (
            <Group>
                {region.regionType === RegionType.RECTANGLE &&
                <Rect
                    rotation={region.rotation}
                    x={centerPixelSpace.x}
                    y={centerPixelSpace.y}
                    width={width}
                    height={height}
                    offsetX={width / 2.0}
                    offsetY={height / 2.0}
                    stroke={Colors.TURQUOISE5}
                    strokeWidth={3}
                    dash={region.creating ? borderDash : null}
                    draggable={true}
                    listening={this.props.listening}
                    onDragStart={this.handleDragStart}
                    onDragEnd={this.handleDragEnd}
                    onDragMove={this.handleDrag}
                    onClick={this.handleClick}
                    perfectDrawEnabled={false}
                    ref={this.handleRef}
                />
                }
                {region.regionType === RegionType.ELLIPSE &&
                <Ellipse
                    rotation={region.rotation}
                    x={centerPixelSpace.x}
                    y={centerPixelSpace.y}
                    radius={{x: width, y: height}}
                    stroke={Colors.TURQUOISE5}
                    strokeWidth={3}
                    dash={region.creating ? borderDash : null}
                    draggable={true}
                    listening={this.props.listening}
                    onDragStart={this.handleDragStart}
                    onDragEnd={this.handleDragEnd}
                    onDragMove={this.handleDrag}
                    onClick={this.handleClick}
                    fillEnabled={true}
                    ref={this.handleRef}
                />
                }
                {this.selectedRegionRef && this.props.selected && this.props.listening &&
                <Transformer
                    node={this.selectedRegionRef}
                    rotateAnchorOffset={15}
                    anchorSize={6}
                    borderStroke={Colors.TURQUOISE5}
                    borderDash={region.regionType === RegionType.ELLIPSE ? borderDash : null}
                    keepRatio={false}
                    centeredScaling={true}
                    draggable={false}
                    borderEnabled={false}
                    onTransformStart={this.handleTransformStart}
                    onTransform={this.handleTransform}
                    onTransformEnd={this.handleTransformEnd}
                />
                }
            </Group>
        );
    }
}