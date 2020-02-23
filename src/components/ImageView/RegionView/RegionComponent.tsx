import * as React from "react";
import {Colors} from "@blueprintjs/core";
import {observable} from "mobx";
import {observer} from "mobx-react";
import {Ellipse, Group, Rect, Transformer} from "react-konva";
import Konva from "konva";
import {CARTA} from "carta-protobuf";
import {FrameStore, RegionStore} from "stores";
import {Point2D} from "models";
import {canvasToTransformedImagePos, getUpdatedPosition, transformedImageToCanvasPos} from "./shared";

export interface RegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    listening: boolean;
    selected: boolean;
    isRegionCornerMode: boolean;
    onSelect?: (region: RegionStore) => void;
    onDoubleClick?: (region: RegionStore) => void;
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

    handleContextMenu = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        konvaEvent.evt.preventDefault();
        console.log("context click!");
    };

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

        if (this.editAnchor.includes("left")) {
            relativeOppositeAnchorPointUnrotated.x = +w * sizeFactor;
        } else if (this.editAnchor.includes("right")) {
            relativeOppositeAnchorPointUnrotated.x = -w * sizeFactor;
        }

        if (this.editAnchor.includes("top")) {
            relativeOppositeAnchorPointUnrotated.y = -h * sizeFactor;
        } else if (this.editAnchor.includes("bottom")) {
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
            const frame = this.props.frame;
            const region = this.props.region;
            if (anchor.includes("rotater")) {
                // handle rotation (canvas rotation is clockwise, CASA rotation is anti-clockwise)
                const rotation = frame.spatialReference ? frame.spatialTransform.rotation * 180.0 / Math.PI + node.rotation() : node.rotation();
                region.setRotation(-rotation);
            } else {
                // revert node scaling and position before adjusting region control points
                let centerImageSpace = region.controlPoints[0];
                const centerCanvasPos = transformedImageToCanvasPos(centerImageSpace.x, centerImageSpace.y, frame, this.props.layerWidth, this.props.layerHeight);
                node.x(centerCanvasPos.x);
                node.y(centerCanvasPos.y);
                node.scaleX(1);
                node.scaleY(1);

                const isCtrlPressed = konvaEvent.evt.ctrlKey || konvaEvent.evt.metaKey;
                if ((this.props.isRegionCornerMode && !isCtrlPressed) || (!this.props.isRegionCornerMode && isCtrlPressed)) {
                    this.applyCornerScaling(region, konvaEvent.evt.offsetX, konvaEvent.evt.offsetY, anchor);
                } else {
                    this.applyCenterScaling(region, konvaEvent.evt.offsetX, konvaEvent.evt.offsetY, anchor, konvaEvent.evt.shiftKey);
                }
            }
        }
    };

    applyCornerScaling = (region: RegionStore, canvasX: number, canvasY: number, anchor: string) => {
        const frame = this.props.frame;
        let newAnchorPoint = canvasToTransformedImagePos(canvasX, canvasY, frame, this.props.layerWidth, this.props.layerHeight);

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

        if (anchor.includes("left") || anchor.includes("right")) {
            w = Math.abs(deltaAnchorsUnrotated.x) * sizeFactor;
        } else {
            // anchors without "left" or "right" are purely vertical, so they are clamped in x
            deltaAnchorsUnrotated.x = 0;
        }
        if (anchor.includes("top") || anchor.includes("bottom")) {
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
        const frame = this.props.frame;
        let newAnchorPoint = canvasToTransformedImagePos(canvasX, canvasY, frame, this.props.layerWidth, this.props.layerHeight);

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

        if (anchor.includes("left") || anchor.includes("right")) {
            w = Math.abs(deltaAnchorPointUnrotated.x) * sizeFactor;
        }
        if (anchor.includes("top") || anchor.includes("bottom")) {
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

    handleDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            const node = konvaEvent.target;
            const region = this.props.region;
            const frame = this.props.frame;
            const zoomLevel = frame.spatialReference ? frame.spatialReference.zoomLevel : frame.zoomLevel;
            const newPosition = getUpdatedPosition(region.controlPoints[0], node.position(), zoomLevel, frame, this.props.layerWidth, this.props.layerHeight);
            region.setControlPoint(0, newPosition);
        }
    };

    render() {
        const region = this.props.region;
        const frame = this.props.frame;

        const zoomLevel = frame.spatialReference ? frame.spatialReference.zoomLevel * frame.spatialTransform.scale : frame.zoomLevel;
        const rotation = frame.spatialReference ? frame.spatialTransform.rotation * 180.0 / Math.PI + region.rotation : region.rotation;

        const centerPixelSpace = transformedImageToCanvasPos(region.controlPoints[0].x, region.controlPoints[0].y, frame, this.props.layerWidth, this.props.layerHeight);
        let width = (region.controlPoints[1].x * zoomLevel) / devicePixelRatio;
        let height = (region.controlPoints[1].y * zoomLevel) / devicePixelRatio;

        // Adjusts the dash length to force the total number of dashes around the bounding box perimeter to 50
        const borderDash = [(width + height) * 4 / 100.0];

        const commonProps = {
            rotation: -rotation,
            x: centerPixelSpace.x,
            y: centerPixelSpace.y,
            stroke: region.color,
            strokeWidth: region.lineWidth,
            opacity: region.isTemporary ? 0.5 : (region.locked ? 0.70 : 1),
            dash: [region.dashLength],
            draggable: true,
            listening: this.props.listening && !region.locked,
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
                    radiusY={width}
                    radiusX={height}
                />
                }
                {this.selectedRegionRef && this.props.selected && this.props.listening &&
                <Transformer
                    node={this.selectedRegionRef}
                    rotateAnchorOffset={15}
                    anchorSize={7}
                    anchorStroke={"black"}
                    borderStroke={Colors.TURQUOISE5}
                    borderStrokeWidth={3}
                    borderDash={borderDash}
                    keepRatio={false}
                    centeredScaling={true}
                    draggable={false}
                    borderEnabled={false}
                    resizeEnabled={!region.locked}
                    rotateEnabled={!region.locked}
                    onTransformStart={this.handleTransformStart}
                    onTransform={this.handleTransform}
                    onTransformEnd={this.handleTransformEnd}
                />
                }
            </Group>
        );
    }
}