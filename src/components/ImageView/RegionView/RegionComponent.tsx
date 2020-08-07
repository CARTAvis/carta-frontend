import * as React from "react";
import {Colors} from "@blueprintjs/core";
import {action, observable} from "mobx";
import {observer} from "mobx-react";
import {Ellipse, Group, Line, Rect, Transformer} from "react-konva";
import Konva from "konva";
import {CARTA} from "carta-protobuf";
import {FrameStore, RegionStore} from "stores";
import {Point2D} from "models";
import {canvasToTransformedImagePos, transformedImageToCanvasPos} from "./shared";
import {add2D, rotate2D, scale2D, subtract2D, transformPoint} from "utilities";

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

const ANCHOR_WIDTH = 7;

@observer
export class RegionComponent extends React.Component<RegionComponentProps> {
    @observable selectedRegionRef;

    private editAnchor: string;
    private editOppositeAnchorPoint: Point2D;
    private editStartCenterPoint: Point2D;

    private previousCursorStyle: string;

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

    handleTransformStart = (konvaEvent: Konva.KonvaEventObject<Event>) => {
        this.startEditing((konvaEvent.currentTarget as Konva.Transformer).getActiveAnchor());
    };

    startEditing = (anchor: string) => {
        console.log(anchor);
        this.editAnchor = anchor;
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

        const relativeOppositeAnchorPoint = rotate2D(relativeOppositeAnchorPointUnrotated, this.props.region.rotation * Math.PI / 180.0);
        this.editOppositeAnchorPoint = add2D(this.editStartCenterPoint, relativeOppositeAnchorPoint);
        this.props.region.beginEditing();
    };

    handleTransformEnd = () => {
        this.props.region.endEditing();
    };

    handleTransform = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.currentTarget) {
            const transformer = konvaEvent.currentTarget as Konva.Transformer;
            const anchor = transformer.getActiveAnchor();
            const node = transformer.getNode();
            const frame = this.props.frame;
            const region = this.props.region;
            if (anchor.includes("rotater")) {
                const rotation = node.rotation();
                region.setRotation(-rotation);
            } else {
                // revert node scaling and position before adjusting region control points
                let centerImageSpace = region.controlPoints[0];
                const centerCanvasPos = transformedImageToCanvasPos(centerImageSpace.x, centerImageSpace.y, frame, this.props.layerWidth, this.props.layerHeight);
                node.x(centerCanvasPos.x);
                node.y(centerCanvasPos.y);
                node.scaleX(1);
                node.scaleY(1);

                const evt = konvaEvent.evt;
                const isCtrlPressed = evt.ctrlKey || evt.metaKey;
                if ((this.props.isRegionCornerMode && !isCtrlPressed) || (!this.props.isRegionCornerMode && isCtrlPressed)) {
                    this.applyCornerScaling(region, evt.offsetX, evt.offsetY, anchor);
                } else {
                    this.applyCenterScaling(region, evt.offsetX, evt.offsetY, anchor, evt.shiftKey);
                }
            }
        }
    };

    applyCornerScaling = (region: RegionStore, canvasX: number, canvasY: number, anchor: string, siblingRegion: boolean = false) => {
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

        let deltaAnchors = subtract2D(newAnchorPoint, this.editOppositeAnchorPoint);
        // Apply inverse rotation to get difference between anchors without rotation
        const deltaAnchorsUnrotated = rotate2D(deltaAnchors, -region.rotation * Math.PI / 180.0);

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
        deltaAnchors = rotate2D(deltaAnchorsUnrotated, region.rotation * Math.PI / 180.0);
        const newCenter = add2D(this.editOppositeAnchorPoint, scale2D(deltaAnchors, 0.5));

        if (region.regionType === CARTA.RegionType.RECTANGLE) {
            region.setControlPoints([newCenter, {x: Math.max(1e-3, w), y: Math.max(1e-3, h)}]);
        } else {
            region.setControlPoints([newCenter, {y: Math.max(1e-3, w), x: Math.max(1e-3, h)}]);
        }
    };

    applyCenterScaling = (region: RegionStore, canvasX: number, canvasY: number, anchor: string, keepAspect: boolean, siblingRegion: boolean = false) => {
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

        let deltaAnchorPoint = subtract2D(newAnchorPoint, centerPoint);
        // Apply inverse rotation to get difference between anchor and center without rotation
        const deltaAnchorPointUnrotated = rotate2D(deltaAnchorPoint, -region.rotation * Math.PI / 180.0);

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
            let newPosition = canvasToTransformedImagePos(node.position().x, node.position().y, frame, this.props.layerWidth, this.props.layerHeight);
            if (frame.spatialReference) {
                newPosition = transformPoint(frame.spatialTransformAST, newPosition, true);
            }
            region.setControlPoint(0, newPosition);
        }
    };

    private handleAnchorMouseEnter = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const target = konvaEvent.target;
        const stage = target?.getStage();
        if (stage) {
            const anchor = target.id();
            let anchorAngle: number;

            switch (anchor) {
                case "top":
                case "bottom":
                    anchorAngle = 0;
                    break;
                case "left":
                case "right":
                    anchorAngle = 90;
                    break;
                case "top-left":
                case "bottom-right":
                    anchorAngle = 45;
                    break;
                default:
                    anchorAngle = 135;
            }

            // Add region rotation and round to nearest 45 degrees
            anchorAngle += this.props.region.rotation;
            anchorAngle = Math.round(anchorAngle / 45.0) * 45.0;

            // Clamp between 0 and 135
            while (anchorAngle < 0) {
                anchorAngle += 180;
            }
            while (anchorAngle >= 180) {
                anchorAngle -= 180;
            }

            let cursorStyle: string;

            switch (anchorAngle) {
                case 45:
                    cursorStyle = "nwse-resize";
                    break;
                case 90:
                    cursorStyle = "ew-resize";
                    break;
                case 135:
                    cursorStyle = "nesw-resize";
                    break;
                default:
                    cursorStyle = "ns-resize";
            }

            this.previousCursorStyle = stage.container().style.cursor;
            stage.container().style.cursor = cursorStyle;
        }
    };

    private handleAnchorMouseOut = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target && konvaEvent.target.getStage()) {
            konvaEvent.target.getStage().container().style.cursor = this.previousCursorStyle;
        }
    };

    private handleAnchorDragStart = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            const node = konvaEvent.target;
            const anchor = node.id();
            this.startEditing(anchor);
        }
    };

    @action private handleAnchorDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.currentTarget) {
            const node = konvaEvent.target;
            const anchor = node.id();
            const frame = this.props.frame;
            const region = this.props.region;
            if (anchor.includes("rotater")) {
                const rotation = node.rotation();
                region.setRotation(-rotation);
            } else {
                const evt = konvaEvent.evt;
                const isCtrlPressed = evt.ctrlKey || evt.metaKey;
                if ((this.props.isRegionCornerMode && !isCtrlPressed) || (!this.props.isRegionCornerMode && isCtrlPressed)) {
                    this.applyCornerScaling(region, evt.offsetX, evt.offsetY, anchor, true);
                } else {
                    this.applyCenterScaling(region, evt.offsetX, evt.offsetY, anchor, evt.shiftKey, true);
                }
            }
        }
    };

    private anchorNode(x: number, y: number, anchor: string, rotation: number = 0) {
        return (
            <Rect
                x={x}
                y={y}
                offsetX={ANCHOR_WIDTH / 2.0}
                offsetY={ANCHOR_WIDTH / 2.0}
                width={ANCHOR_WIDTH}
                height={ANCHOR_WIDTH}
                fill="white"
                strokeWidth={1}
                stroke="black"
                rotation={rotation}
                draggable={true}
                key={anchor}
                id={anchor}
                onMouseEnter={this.handleAnchorMouseEnter}
                onMouseOut={this.handleAnchorMouseOut}
                onDragStart={this.handleAnchorDragStart}
                onDragEnd={this.handleTransformEnd}
                onDragMove={this.handleAnchorDrag}
            />
        );
    }

    render() {
        const region = this.props.region;
        const frame = this.props.frame;

        if (frame.spatialReference) {
            const centerReferenceImage = region.controlPoints[0];
            const centerSecondaryImage = transformPoint(frame.spatialTransformAST, centerReferenceImage, false);
            const centerPixelSpace = transformedImageToCanvasPos(centerSecondaryImage.x, centerSecondaryImage.y, frame, this.props.layerWidth, this.props.layerHeight);
            // Ellipse axes swapped
            const pointsSecondaryImage = region.getRegionApproximation(frame.spatialTransformAST);
            const N = pointsSecondaryImage.length;
            const pointArray = new Array<number>(N * 2);
            for (let i = 0; i < N; i++) {
                const approxPointPixelSpace = transformedImageToCanvasPos(pointsSecondaryImage[i].x, pointsSecondaryImage[i].y, frame, this.props.layerWidth, this.props.layerHeight);
                pointArray[i * 2] = approxPointPixelSpace.x - centerPixelSpace.x;
                pointArray[i * 2 + 1] = approxPointPixelSpace.y - centerPixelSpace.y;
            }

            let anchors: React.ReactNode[];

            if (this.props.selected && this.props.listening) {
                const width = region.controlPoints[1].x;
                const height = region.controlPoints[1].y;

                const anchorConfigs = [
                    {anchor: "top", offset: {x: 0, y: height / 2}},
                    {anchor: "bottom", offset: {x: 0, y: -height / 2}},
                    {anchor: "left", offset: {x: -width / 2, y: 0}},
                    {anchor: "right", offset: {x: width / 2, y: 0}},
                    {anchor: "top-left", offset: {x: -width / 2, y: height / 2}},
                    {anchor: "bottom-left", offset: {x: -width / 2, y: -height / 2}},
                    {anchor: "top-right", offset: {x: width / 2, y: height / 2}},
                    {anchor: "bottom-right", offset: {x: width / 2, y: -height / 2}}
                ];

                anchors = anchorConfigs.map((config) => {
                    const posSecondaryImage = transformPoint(frame.spatialTransformAST, add2D(centerReferenceImage, rotate2D(config.offset, region.rotation * Math.PI / 180)), false);
                    const posCanvas = transformedImageToCanvasPos(posSecondaryImage.x, posSecondaryImage.y, frame, this.props.layerWidth, this.props.layerHeight);
                    return this.anchorNode(posCanvas.x, posCanvas.y, config.anchor, -region.rotation);
                });
            }

            return (
                <Group>
                    <Line
                        x={centerPixelSpace.x}
                        y={centerPixelSpace.y}
                        stroke={region.color}
                        strokeWidth={region.lineWidth}
                        opacity={region.isTemporary ? 0.5 : (region.locked ? 0.70 : 1)}
                        dash={[region.dashLength]}
                        closed={true}
                        listening={this.props.listening && !region.locked}
                        onClick={this.handleClick}
                        onDblClick={this.handleDoubleClick}
                        onContextMenu={this.handleContextMenu}
                        onDragStart={this.handleDragStart}
                        onDragEnd={this.handleDragEnd}
                        onDragMove={this.handleDrag}
                        perfectDrawEnabled={false}
                        lineJoin={"round"}
                        draggable={true}
                        points={pointArray}
                    />
                    {anchors}
                </Group>
            );
        } else {
            const rotation = region.rotation;
            const zoomLevel = frame.zoomLevel;

            const centerPixelSpace = transformedImageToCanvasPos(region.controlPoints[0].x, region.controlPoints[0].y, frame.spatialReference || frame, this.props.layerWidth, this.props.layerHeight);
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
                        nodes={[this.selectedRegionRef]}
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
}