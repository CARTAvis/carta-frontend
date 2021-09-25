import * as React from "react";
import {action} from "mobx";
import {observer} from "mobx-react";
import {Ellipse, Group, Line, Rect} from "react-konva";
import Konva from "konva";
import {CARTA} from "carta-protobuf";
import {FrameStore, RegionStore} from "stores";
import {Point2D} from "models";
import {canvasToTransformedImagePos, transformedImageToCanvasPos} from "./shared";
import {add2D, angle2D, rotate2D, scale2D, subtract2D, transformPoint} from "utilities";
import {Anchor} from "./InvariantShapes";

interface SimpleShapeRegionComponentProps {
    region: RegionStore;
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    listening: boolean;
    selected: boolean;
    isRegionCornerMode: boolean;
    stageRef: any;
    onSelect?: (region: RegionStore) => void;
    onDoubleClick?: (region: RegionStore) => void;
}

@observer
export class SimpleShapeRegionComponent extends React.Component<SimpleShapeRegionComponentProps> {
    private editAnchor: string;
    private editOppositeAnchorPoint: Point2D;
    private editStartCenterPoint: Point2D;
    private previousCursorStyle: string;
    private static readonly AnchorWidth = 7;

    handleContextMenu = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        konvaEvent.evt.preventDefault();
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

    startEditing = (anchor: string) => {
        this.editAnchor = anchor;
        const region = this.props.region;

        let w: number, h: number;
        if (this.props.region.regionType === CARTA.RegionType.RECTANGLE) {
            w = region.size.x;
            h = region.size.y;
        } else {
            w = region.size.y;
            h = region.size.x;
        }

        this.editStartCenterPoint = {x: region.center.x, y: region.center.y};

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

        const relativeOppositeAnchorPoint = rotate2D(relativeOppositeAnchorPointUnrotated, (this.props.region.rotation * Math.PI) / 180.0);
        this.editOppositeAnchorPoint = add2D(this.editStartCenterPoint, relativeOppositeAnchorPoint);
        this.props.region.beginEditing();
    };

    handleAnchorDragEnd = () => {
        this.props.region.endEditing();
    };

    applyCornerScaling = (region: RegionStore, canvasX: number, canvasY: number, anchor: string) => {
        const frame = this.props.frame;
        let newAnchorPoint = canvasToTransformedImagePos(canvasX, canvasY, frame, this.props.layerWidth, this.props.layerHeight);

        if (frame.spatialReference) {
            newAnchorPoint = transformPoint(frame.spatialTransformAST, newAnchorPoint, true);
        }

        let w: number, h: number;
        let sizeFactor: number;
        if (region.regionType === CARTA.RegionType.RECTANGLE) {
            sizeFactor = 1.0;
            w = region.size.x;
            h = region.size.y;
        } else {
            sizeFactor = 0.5;
            w = region.size.y;
            h = region.size.x;
        }

        let deltaAnchors = subtract2D(newAnchorPoint, this.editOppositeAnchorPoint);
        // Apply inverse rotation to get difference between anchors without rotation
        const deltaAnchorsUnrotated = rotate2D(deltaAnchors, (-region.rotation * Math.PI) / 180.0);

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
        deltaAnchors = rotate2D(deltaAnchorsUnrotated, (region.rotation * Math.PI) / 180.0);
        const newCenter = add2D(this.editOppositeAnchorPoint, scale2D(deltaAnchors, 0.5));

        if (region.regionType === CARTA.RegionType.RECTANGLE) {
            region.setControlPoints([newCenter, {x: Math.max(1e-3, w), y: Math.max(1e-3, h)}]);
        } else {
            region.setControlPoints([newCenter, {y: Math.max(1e-3, w), x: Math.max(1e-3, h)}]);
        }
    };

    applyCenterScaling = (region: RegionStore, canvasX: number, canvasY: number, anchor: string, keepAspect: boolean) => {
        const frame = this.props.frame;
        let newAnchorPoint = canvasToTransformedImagePos(canvasX, canvasY, frame, this.props.layerWidth, this.props.layerHeight);

        if (frame.spatialReference) {
            newAnchorPoint = transformPoint(frame.spatialTransformAST, newAnchorPoint, true);
        }

        const centerPoint = region.center;

        let w: number, h: number;
        let sizeFactor: number;
        if (region.regionType === CARTA.RegionType.RECTANGLE) {
            sizeFactor = 2.0;
            w = region.size.x;
            h = region.size.y;
        } else {
            sizeFactor = 1.0;
            w = region.size.y;
            h = region.size.x;
        }

        let deltaAnchorPoint = subtract2D(newAnchorPoint, centerPoint);
        // Apply inverse rotation to get difference between anchor and center without rotation
        const deltaAnchorPointUnrotated = rotate2D(deltaAnchorPoint, (-region.rotation * Math.PI) / 180.0);

        if (anchor.includes("left") || anchor.includes("right")) {
            w = Math.abs(deltaAnchorPointUnrotated.x) * sizeFactor;
            if (keepAspect) {
                h = w;
            }
        }
        if (anchor.includes("top") || anchor.includes("bottom")) {
            h = Math.abs(deltaAnchorPointUnrotated.y) * sizeFactor;
            if (keepAspect) {
                w = h;
            }
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
            region.setCenter(newPosition);
        }
    };

    private static GetCursor(anchor: string, rotation: number) {
        let anchorAngle: number;

        switch (anchor) {
            case "rotator":
                return "all-scroll";
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
        anchorAngle += rotation;
        anchorAngle = Math.round(anchorAngle / 45.0) * 45.0;

        // Clamp between 0 and 135
        while (anchorAngle < 0) {
            anchorAngle += 180;
        }
        while (anchorAngle >= 180) {
            anchorAngle -= 180;
        }

        switch (anchorAngle) {
            case 45:
                return "nwse-resize";
            case 90:
                return "ew-resize";
            case 135:
                return "nesw-resize";
            default:
                return "ns-resize";
        }
    }

    private handleAnchorMouseEnter = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const target = konvaEvent.target;
        const stage = target?.getStage();
        if (stage) {
            this.previousCursorStyle = stage.container().style.cursor;
            stage.container().style.cursor = SimpleShapeRegionComponent.GetCursor(target.id(), this.props.region.rotation);
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
            const region = this.props.region;
            const frame = this.props.frame;
            const evt = konvaEvent.evt;
            const offsetPoint = {x: evt.offsetX, y: evt.offsetY};
            if (anchor.includes("rotator")) {
                // Calculate rotation from anchor position
                let newAnchorPoint = canvasToTransformedImagePos(offsetPoint.x, offsetPoint.y, frame, this.props.layerWidth, this.props.layerHeight);
                if (frame.spatialReference) {
                    newAnchorPoint = transformPoint(frame.spatialTransformAST, newAnchorPoint, true);
                }
                const delta = subtract2D(newAnchorPoint, region.center);
                const topAnchorPosition = rotate2D({x: 0, y: 1}, (region.rotation * Math.PI) / 180.0);
                const angle = (180.0 / Math.PI) * angle2D(topAnchorPosition, delta);
                region.setRotation(region.rotation + angle);
            } else {
                const isCtrlPressed = evt.ctrlKey || evt.metaKey;
                if ((this.props.isRegionCornerMode && !isCtrlPressed) || (!this.props.isRegionCornerMode && isCtrlPressed)) {
                    this.applyCornerScaling(region, evt.offsetX, evt.offsetY, anchor);
                } else {
                    this.applyCenterScaling(region, evt.offsetX, evt.offsetY, anchor, evt.shiftKey);
                }
            }
        }
    };

    private genAnchors = (): React.ReactNode[] => {
        const region = this.props.region;
        const frame = this.props.frame;

        // Ellipse has swapped axes
        const offset = region.regionType === CARTA.RegionType.RECTANGLE ? {x: region.size.x / 2, y: region.size.y / 2} : {x: region.size.y, y: region.size.x}
        let anchorConfigs = [
            {anchor: "top", offset: {x: 0, y: offset.y}},
            {anchor: "bottom", offset: {x: 0, y: -offset.y}},
            {anchor: "left", offset: {x: -offset.x, y: 0}},
            {anchor: "right", offset: {x: offset.x, y: 0}},
            {anchor: "top-left", offset: {x: -offset.x, y: offset.y}},
            {anchor: "bottom-left", offset: {x: -offset.x, y: -offset.y}},
            {anchor: "top-right", offset: {x: offset.x, y: offset.y}},
            {anchor: "bottom-right", offset: {x: offset.x, y: -offset.y}}
        ]
        if (frame.hasSquarePixels) {
            const zoomLevel = (frame.spatialReference ?? frame).zoomLevel;
            const rotatorOffset = (15 / zoomLevel) * devicePixelRatio;
            anchorConfigs.push({anchor: "rotator", offset: {x: 0, y: offset.y + rotatorOffset}});
        }

        return anchorConfigs.map(config => {
            const centerReferenceImage = region.center;

            let posImage = add2D(centerReferenceImage, rotate2D(config.offset, (region.rotation * Math.PI) / 180));
            if (frame.spatialReference) {
                posImage = transformPoint(frame.spatialTransformAST, posImage, false);
            }

            const posCanvas = transformedImageToCanvasPos(posImage.x, posImage.y, frame, this.props.layerWidth, this.props.layerHeight);
            return (
                <Anchor
                    key={config.anchor}
                    anchor={config.anchor}
                    x={posCanvas.x}
                    y={posCanvas.y}
                    rotation={-region.rotation}
                    isRotator={config.anchor === "rotator"}
                    onMouseEnter={this.handleAnchorMouseEnter}
                    onMouseOut={this.handleAnchorMouseOut}
                    onDragStart={this.handleAnchorDragStart}
                    onDragEnd={this.handleAnchorDragEnd}
                    onDragMove={this.handleAnchorDrag}
                />
            );
        });
    };

    render() {
        const region = this.props.region;
        const frame = this.props.frame;

        let shapeNode: React.ReactNode;
        const centerReferenceImage = region.center;

        if (frame.spatialReference) {
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

            shapeNode = (
                <Line
                    x={centerPixelSpace.x}
                    y={centerPixelSpace.y}
                    stroke={region.color}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
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
            );
        } else {
            const rotation = region.rotation;
            const zoomLevel = frame.zoomLevel;

            const centerPixelSpace = transformedImageToCanvasPos(centerReferenceImage.x, centerReferenceImage.y, frame, this.props.layerWidth, this.props.layerHeight);
            const width = (region.size.x * zoomLevel) / devicePixelRatio;
            const height = (region.size.y * zoomLevel) / devicePixelRatio;

            // Adjusts the dash length to force the total number of dashes around the bounding box perimeter to 50
            // TODO: Is this needed anywhere?
            // const borderDash = [(width + height) * 4 / 100.0];

            const commonProps = {
                rotation: -rotation,
                x: centerPixelSpace.x,
                y: centerPixelSpace.y,
                stroke: region.color,
                strokeWidth: region.lineWidth,
                opacity: region.isTemporary ? 0.5 : region.locked ? 0.7 : 1,
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
                strokeScaleEnabled: false
            };

            if (region.regionType === CARTA.RegionType.RECTANGLE) {
                shapeNode = <Rect {...commonProps} width={width * frame.aspectRatio} height={height} offsetX={(width * frame.aspectRatio) / 2.0} offsetY={height / 2.0} />;
            } else {
                shapeNode = <Ellipse {...commonProps} radiusY={width} radiusX={height * frame.aspectRatio} />;
            }
        }

        return (
            <Group>
                {shapeNode}
                {this.props.selected && this.props.listening && !region.locked ? this.genAnchors(): null}
            </Group>
        );
    }
}
