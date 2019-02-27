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
        this.editOppositeAnchorPoint = {x: controlPoints[0].x, y: controlPoints[0].y};

        const relativeOppositeAnchorPointUnrotated = {x: 0, y: 0};

        // Ellipse control points are radii, not diameter
        const sizeFactor = this.props.region.regionType === RegionType.RECTANGLE ? 0.5 : 1.0;

        if (this.editAnchor.indexOf("left") >= 0) {
            relativeOppositeAnchorPointUnrotated.x = +controlPoints[1].x * sizeFactor;
        } else if (this.editAnchor.indexOf("right") >= 0) {
            relativeOppositeAnchorPointUnrotated.x = -controlPoints[1].x * sizeFactor;
        }

        if (this.editAnchor.indexOf("top") >= 0) {
            relativeOppositeAnchorPointUnrotated.y = -controlPoints[1].y * sizeFactor;
        } else if (this.editAnchor.indexOf("bottom") >= 0) {
            relativeOppositeAnchorPointUnrotated.y = +controlPoints[1].y * sizeFactor;
        }

        const cosX = Math.cos(this.props.region.rotation * Math.PI / 180.0);
        const sinX = Math.sin(this.props.region.rotation * Math.PI / 180.0);

        const relativeOppositeAnchorPoint = {
            x: cosX * relativeOppositeAnchorPointUnrotated.x - sinX * relativeOppositeAnchorPointUnrotated.y,
            y: sinX * relativeOppositeAnchorPointUnrotated.x + cosX * relativeOppositeAnchorPointUnrotated.y
        };

        this.editOppositeAnchorPoint = {
            x: this.editStartCenterPoint.x + relativeOppositeAnchorPoint.x,
            y: this.editStartCenterPoint.y + relativeOppositeAnchorPoint.y,
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
                // handle rotation (canvas rotation is clockwise, CASA rotation is anti-clockwise
                const rotation = node.rotation();
                region.setRotation(-rotation);
            } else {
                // revert node scaling and position before adjusting region control points
                const centerCanvasPos = this.getCanvasPos(region.controlPoints[0].x, region.controlPoints[0].y);
                node.x(centerCanvasPos.x);
                node.y(centerCanvasPos.y);
                node.scaleX(1);
                node.scaleY(1);

                const newAnchorPoint = this.getImagePos(konvaEvent.evt.offsetX, konvaEvent.evt.offsetY);
                const centerPoint = region.controlPoints[0];

                // Rotation matrix elements
                const cosX = Math.cos(region.rotation * Math.PI / 180.0);
                const sinX = Math.sin(region.rotation * Math.PI / 180.0);

                const cornerScaling = konvaEvent.evt.ctrlKey;

                if (cornerScaling) {
                    let w = region.controlPoints[1].x;
                    let h = region.controlPoints[1].y;
                    const sizeFactor = region.regionType === RegionType.RECTANGLE ? 1.0 : 0.5;

                    const deltaAnchors = {x: newAnchorPoint.x - this.editOppositeAnchorPoint.x, y: newAnchorPoint.y - this.editOppositeAnchorPoint.y};
                    // Apply inverse rotation to get difference between anchors without rotation
                    const deltaAnchorsUnrotated = {x: cosX * deltaAnchors.x + sinX * deltaAnchors.y, y: -sinX * deltaAnchors.x + cosX * deltaAnchors.y};

                    if (anchor.indexOf("left") >= 0 || anchor.indexOf("right") >= 0) {
                        w = Math.abs(deltaAnchorsUnrotated.x) * sizeFactor;
                    } else {
                        // anchors without "left" or "right" are purely vertical, so they are clamped in x
                        deltaAnchorsUnrotated.x = 0;
                    }
                    if (anchor.indexOf("top") >= 0 || anchor.indexOf("bottom") >= 0) {
                        // anchors without "top" or "bottom" are purely horizontal, so they are clamped in y
                        h = Math.abs(deltaAnchorsUnrotated.y) * sizeFactor;
                    } else {
                        deltaAnchorsUnrotated.y = 0;
                    }

                    // re-rotate after clamping the anchor bounds to get the correct position of the anchor point
                    deltaAnchors.x = cosX * deltaAnchorsUnrotated.x - sinX * deltaAnchorsUnrotated.y;
                    deltaAnchors.y = sinX * deltaAnchorsUnrotated.x + cosX * deltaAnchorsUnrotated.y;
                    let newCenter = {x: this.editOppositeAnchorPoint.x + deltaAnchors.x / 2.0, y: this.editOppositeAnchorPoint.y + deltaAnchors.y / 2.0};

                    region.setControlPoints([newCenter, {x: Math.max(1e-3, w), y: Math.max(1e-3, h)}]);
                } else {
                    let w = region.controlPoints[1].x;
                    let h = region.controlPoints[1].y;

                    const deltaAnchorPoint = {x: newAnchorPoint.x - centerPoint.x, y: newAnchorPoint.y - centerPoint.y};
                    // Apply inverse rotation to get difference between anchor and center without rotation
                    const deltaAnchorPointUnrotated = {x: cosX * deltaAnchorPoint.x + sinX * deltaAnchorPoint.y, y: -sinX * deltaAnchorPoint.x + cosX * deltaAnchorPoint.y};
                    const sizeFactor = region.regionType === RegionType.RECTANGLE ? 2.0 : 1.0;

                    if (anchor.indexOf("left") >= 0 || anchor.indexOf("right") >= 0) {
                        w = Math.abs(deltaAnchorPointUnrotated.x) * sizeFactor;
                    }
                    if (anchor.indexOf("top") >= 0 || anchor.indexOf("bottom") >= 0) {
                        h = Math.abs(deltaAnchorPointUnrotated.y) * sizeFactor;
                    }

                    if (konvaEvent.evt.shiftKey) {
                        const maxSide = Math.max(w, h);
                        w = maxSide;
                        h = maxSide;
                    }

                    region.setControlPoints([this.editStartCenterPoint, {x: Math.max(1e-3, w), y: Math.max(1e-3, h)}]);
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
                    rotation={-region.rotation}
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
                    rotation={-region.rotation}
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