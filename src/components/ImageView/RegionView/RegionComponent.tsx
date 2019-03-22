import * as React from "react";
import * as Konva from "konva";
import {Colors} from "@blueprintjs/core";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {Ellipse, Group, Rect, Transformer} from "react-konva";
import {CARTA} from "carta-protobuf";
import {FrameStore, RegionStore} from "../../../stores";
import {Point2D} from "../../../models";

export interface RegionComponentProps {
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

@observer
export class RegionComponent extends React.Component<RegionComponentProps> {
    @observable selectedRegionRef;

    private editAnchor: string;
    private editOppositeAnchorPoint: Point2D;
    private editStartCenterPoint: Point2D;

    handleRef = (ref) => {
        if (ref && this.selectedRegionRef !== ref) {
            this.selectedRegionRef = ref;
        }
    };

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

    handleTransformStart = (konvaEvent) => {
        this.editAnchor = konvaEvent.currentTarget.movingResizer;
        const controlPoints = this.props.region.controlPoints;

        let w: number, h: number;
        if (this.props.region.regionType === CARTA.RegionType.RECTANGLE) {
            w = controlPoints[1].x;
            h = controlPoints[1].y;
        } else {
            w = controlPoints[1].y;
            h = controlPoints[1].x;
        }

        this.editStartCenterPoint = {x: controlPoints[0].x, y: controlPoints[0].y};
        this.editOppositeAnchorPoint = {x: controlPoints[0].x, y: controlPoints[0].y};

        const relativeOppositeAnchorPointUnrotated = {x: 0, y: 0};

        // Ellipse control points are radii, not diameter
        const sizeFactor = this.props.region.regionType === CARTA.RegionType.RECTANGLE ? 0.5 : 1.0;

        if (this.editAnchor.indexOf("left") >= 0) {
            relativeOppositeAnchorPointUnrotated.x = +w * sizeFactor;
        } else if (this.editAnchor.indexOf("right") >= 0) {
            relativeOppositeAnchorPointUnrotated.x = -w * sizeFactor;
        }

        if (this.editAnchor.indexOf("top") >= 0) {
            relativeOppositeAnchorPointUnrotated.y = -h * sizeFactor;
        } else if (this.editAnchor.indexOf("bottom") >= 0) {
            relativeOppositeAnchorPointUnrotated.y = +h * sizeFactor;
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

                if (konvaEvent.evt.ctrlKey || konvaEvent.evt.metaKey) {
                    this.applyCornerScaling(region, konvaEvent.evt.offsetX, konvaEvent.evt.offsetY, anchor);
                } else {
                    this.applyCenterScaling(region, konvaEvent.evt.offsetX, konvaEvent.evt.offsetY, anchor, konvaEvent.evt.shiftKey);
                }
            }
        }
    };

    applyCornerScaling = (region: RegionStore, canvasX: number, canvasY: number, anchor: string) => {
        const newAnchorPoint = this.getImagePos(canvasX, canvasY);

        let w: number, h: number;
        let sizeFactor: number;
        if (region.regionType === CARTA.RegionType.RECTANGLE) {
            sizeFactor = 1.0;
            w = region.controlPoints[1].x;
            h = region.controlPoints[1].y;
        } else {
            sizeFactor = 0.5;
            w = region.controlPoints[1].y;
            h = region.controlPoints[1].x;
        }

        // Rotation matrix elements
        const cosX = Math.cos(region.rotation * Math.PI / 180.0);
        const sinX = Math.sin(region.rotation * Math.PI / 180.0);

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

        if (region.regionType === CARTA.RegionType.RECTANGLE) {
            region.setControlPoints([newCenter, {x: Math.max(1e-3, w), y: Math.max(1e-3, h)}]);
        } else {
            region.setControlPoints([newCenter, {y: Math.max(1e-3, w), x: Math.max(1e-3, h)}]);
        }
    };

    applyCenterScaling = (region: RegionStore, canvasX: number, canvasY: number, anchor: string, keepAspect: boolean) => {
        const newAnchorPoint = this.getImagePos(canvasX, canvasY);
        const centerPoint = region.controlPoints[0];

        let w: number, h: number;
        let sizeFactor: number;
        if (region.regionType === CARTA.RegionType.RECTANGLE) {
            sizeFactor = 2.0;
            w = region.controlPoints[1].x;
            h = region.controlPoints[1].y;
        } else {
            sizeFactor = 1.0;
            w = region.controlPoints[1].y;
            h = region.controlPoints[1].x;
        }

        // Rotation matrix elements
        const cosX = Math.cos(region.rotation * Math.PI / 180.0);
        const sinX = Math.sin(region.rotation * Math.PI / 180.0);

        const deltaAnchorPoint = {x: newAnchorPoint.x - centerPoint.x, y: newAnchorPoint.y - centerPoint.y};
        // Apply inverse rotation to get difference between anchor and center without rotation
        const deltaAnchorPointUnrotated = {x: cosX * deltaAnchorPoint.x + sinX * deltaAnchorPoint.y, y: -sinX * deltaAnchorPoint.x + cosX * deltaAnchorPoint.y};

        if (anchor.indexOf("left") >= 0 || anchor.indexOf("right") >= 0) {
            w = Math.abs(deltaAnchorPointUnrotated.x) * sizeFactor;
        }
        if (anchor.indexOf("top") >= 0 || anchor.indexOf("bottom") >= 0) {
            h = Math.abs(deltaAnchorPointUnrotated.y) * sizeFactor;
        }

        if (keepAspect) {
            const maxSide = Math.max(w, h);
            w = maxSide;
            h = maxSide;
        }
        if (region.regionType === CARTA.RegionType.RECTANGLE) {
            region.setControlPoints([this.editStartCenterPoint, {x: Math.max(1e-3, w), y: Math.max(1e-3, h)}]);
        } else {
            region.setControlPoints([this.editStartCenterPoint, {y: Math.max(1e-3, w), x: Math.max(1e-3, h)}]);
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
        const width = (region.controlPoints[1].x * frame.zoomLevel) / devicePixelRatio;
        const height = (region.controlPoints[1].y * frame.zoomLevel) / devicePixelRatio;

        // Adjusts the dash length to force the total number of dashes around the bounding box perimeter to 50
        const borderDash = [(width + height) * 4 / 100.0];

        const commonProps = {
            rotation: -region.rotation,
            x: centerPixelSpace.x,
            y: centerPixelSpace.y,
            stroke: region.color,
            strokeWidth: region.lineWidth,
            opacity: region.isTemporary ? 0.5 : 1.0,
            dash: [region.dashLength],
            draggable: true,
            listening: this.props.listening,
            onDragStart: this.handleDragStart,
            onDragEnd: this.handleDragEnd,
            onDragMove: this.handleDrag,
            onClick: this.handleClick,
            onDblClick: this.handleDoubleClick,
            onContextMenu: this.handleContextMenu,
            perfectDrawEnabled: false,
            ref: this.handleRef
        };

        return (
            <Group>
                {region.regionType === CARTA.RegionType.RECTANGLE &&
                <Rect
                    {...commonProps}
                    width={width}
                    height={height}
                    offsetX={width / 2.0}
                    offsetY={height / 2.0}
                />
                }
                {region.regionType === CARTA.RegionType.ELLIPSE &&
                <Ellipse
                    {...commonProps}
                    radius={{y: width, x: height}}
                />
                }
                {this.selectedRegionRef && this.props.selected && this.props.listening &&
                <Transformer
                    node={this.selectedRegionRef}
                    rotateAnchorOffset={15}
                    anchorSize={6}
                    borderStroke={Colors.TURQUOISE5}
                    borderDash={region.regionType === CARTA.RegionType.ELLIPSE ? borderDash : null}
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