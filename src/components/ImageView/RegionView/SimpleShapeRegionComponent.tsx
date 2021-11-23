import * as React from "react";
import {action} from "mobx";
import {observer} from "mobx-react";
import {Ellipse, Group, Line, Rect} from "react-konva";
import Konva from "konva";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore, RegionStore} from "stores";
import {Point2D} from "models";
import {adjustPosToMutatedStage, adjustPosToUnityStage, canvasToTransformedImagePos, transformedImageToCanvasPos} from "./shared";
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
    private centerCanvasPos: Point2D;
    private editOppositeAnchorPoint: Point2D;
    private editOppositeAnchorCanvasPos: Point2D;
    private editStartCenterPoint: Point2D;
    private previousCursorStyle: string;

    componentDidUpdate() {
        AppStore.Instance.resetImageRatio();
    }

    private handleContextMenu = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        konvaEvent.evt.preventDefault();
    };

    private handleDoubleClick = () => {
        this.props.onDoubleClick?.(this.props.region);
    };

    private handleClick = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const mouseEvent = konvaEvent.evt;
        if (mouseEvent.button === 0 && !(mouseEvent.ctrlKey || mouseEvent.metaKey)) {
            this.props.onSelect?.(this.props.region);
        }
    };

    private startEditing = (anchor: string) => {
        this.editAnchor = anchor;

        const region = this.props.region;
        const frame = this.props.frame;

        // Find center's canvas space position
        let centerImagePos = region.center;
        if (frame.spatialReference) {
            centerImagePos = transformPoint(frame.spatialTransformAST, centerImagePos, false);
        }
        let centerCanvasPos = transformedImageToCanvasPos(centerImagePos.x, centerImagePos.y, frame, this.props.layerWidth, this.props.layerHeight);
        centerCanvasPos = adjustPosToMutatedStage(centerCanvasPos, this.props.stageRef.current);
        this.centerCanvasPos = centerCanvasPos;

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

        // Find opposite anchor's canvas space position for corner mode
        let editOppositeAnchorImagePos = this.editOppositeAnchorPoint;
        if (frame.spatialReference) {
            editOppositeAnchorImagePos = transformPoint(frame.spatialTransformAST, editOppositeAnchorImagePos, false);
        }
        let editOppositeAnchorCanvasPos = transformedImageToCanvasPos(editOppositeAnchorImagePos.x, editOppositeAnchorImagePos.y, frame, this.props.layerWidth, this.props.layerHeight);
        editOppositeAnchorCanvasPos = adjustPosToMutatedStage(editOppositeAnchorCanvasPos, this.props.stageRef.current);
        this.editOppositeAnchorCanvasPos = editOppositeAnchorCanvasPos;

        this.props.region.beginEditing();
    };

    private applyCornerScaling = (region: RegionStore, canvasX: number, canvasY: number, anchor: string) => {
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
        const newSize = region.regionType === CARTA.RegionType.RECTANGLE ? {x: Math.max(1e-3, w), y: Math.max(1e-3, h)} : {y: Math.max(1e-3, w), x: Math.max(1e-3, h)};
        region.setControlPoints([newCenter, newSize]);
    };

    private applyCenterScaling = (region: RegionStore, canvasX: number, canvasY: number, anchor: string, keepAspect: boolean) => {
        const frame = this.props.frame;
        let newAnchorPoint = canvasToTransformedImagePos(canvasX, canvasY, frame, this.props.layerWidth, this.props.layerHeight);

        if (frame.spatialReference) {
            newAnchorPoint = transformPoint(frame.spatialTransformAST, newAnchorPoint, true);
        }

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

        const deltaAnchorPoint = subtract2D(newAnchorPoint, region.center);
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

        const newSize = region.regionType === CARTA.RegionType.RECTANGLE ? {x: Math.max(1e-3, w), y: Math.max(1e-3, h)} : {y: Math.max(1e-3, w), x: Math.max(1e-3, h)};
        region.setSize(newSize);
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
            const position = adjustPosToUnityStage(konvaEvent.target.position(), this.props.stageRef.current);
            let positionImageSpace = canvasToTransformedImagePos(position.x, position.y, frame, this.props.layerWidth, this.props.layerHeight);
            if (frame.spatialReference) {
                positionImageSpace = transformPoint(frame.spatialTransformAST, positionImageSpace, true);
            }
            this.props.region.setCenter(positionImageSpace);
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

    private handleAnchorDragEnd = () => {
        this.props.region.endEditing();
    };

    private getDragBoundedAnchorPos = (region: RegionStore, anchorName: string, isCornerMode: boolean): Point2D => {
        // Handle drag bound of left/right/top/bottom anchors
        if (anchorName === "left" || anchorName === "right" || anchorName === "top" || anchorName === "bottom") {
            const width = region.size.x / devicePixelRatio;
            const height = region.size.y / devicePixelRatio;
            const size = region.regionType === CARTA.RegionType.RECTANGLE ? {x: width, y: height} : {x: height, y: width};
            let delta: Point2D;
            if (anchorName === "left") {
                delta = {x: -size.x, y: 0};
            } else if (anchorName === "right") {
                delta = {x: size.x, y: 0};
            } else if (anchorName === "top") {
                delta = {x: 0, y: -size.y};
            } else {
                delta = {x: 0, y: size.y};
            }
            const offset = rotate2D(scale2D(delta, region.regionType === CARTA.RegionType.RECTANGLE ? 0.5 : 1), (-region.rotation * Math.PI) / 180.0);
            return isCornerMode ? add2D(this.editOppositeAnchorCanvasPos, scale2D(offset, 2)) : add2D(this.centerCanvasPos, offset);
        }
        return undefined;
    };

    private getDragBoundedDiagonalAnchorPos = (region: RegionStore, anchorName: string): Point2D => {
        // Handle keep-aspect drag bound of diagonal anchors
        if (anchorName === "top-left" || anchorName === "bottom-left" || anchorName === "top-right" || anchorName === "bottom-right") {
            const offset = rotate2D(scale2D(region.size, region.regionType === CARTA.RegionType.RECTANGLE ? 0.5 : 1), (region.rotation * Math.PI) / 180.0);
            if (anchorName === "top-left") {
                return add2D(this.centerCanvasPos, {x: -offset.y, y: -offset.x});
            } else if (anchorName === "bottom-left") {
                return add2D(this.centerCanvasPos, {x: -offset.x, y: offset.y});
            } else if (anchorName === "top-right") {
                return add2D(this.centerCanvasPos, {x: offset.x, y: -offset.y});
            } else {
                return add2D(this.centerCanvasPos, {x: offset.y, y: offset.x});
            }
        }
        return undefined;
    };

    @action private handleAnchorDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.currentTarget) {
            const frame = this.props.frame;
            const region = this.props.region;
            const evt = konvaEvent.evt;
            const anchor = konvaEvent.target;
            const anchorName = anchor.id();
            const anchorPos = anchor.position();
            const offsetPoint = adjustPosToUnityStage(anchorPos, this.props.stageRef.current);
            if (anchorName.includes("rotator")) {
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
                const isKeepAspectMode = evt.shiftKey;
                const isCtrlPressed = evt.ctrlKey || evt.metaKey;
                const isRegionCornerMode = (this.props.isRegionCornerMode && !isCtrlPressed) || (!this.props.isRegionCornerMode && isCtrlPressed);
                if (isRegionCornerMode) {
                    this.applyCornerScaling(region, offsetPoint.x, offsetPoint.y, anchorName);
                } else {
                    this.applyCenterScaling(region, offsetPoint.x, offsetPoint.y, anchorName, isKeepAspectMode);
                }

                if (anchorName === "left" || anchorName === "right" || anchorName === "top" || anchorName === "bottom") {
                    const dragBoundedPos = this.getDragBoundedAnchorPos(region, anchorName, isRegionCornerMode);
                    anchor.position(dragBoundedPos);
                }

                if (isKeepAspectMode && (anchorName === "top-left" || anchorName === "bottom-left" || anchorName === "top-right" || anchorName === "bottom-right")) {
                    const dragBoundedPos = this.getDragBoundedDiagonalAnchorPos(region, anchorName);
                    anchor.position(dragBoundedPos);
                }
            }
        }
    };

    private genAnchors = (): React.ReactNode[] => {
        const region = this.props.region;
        const frame = this.props.frame;

        // Ellipse has swapped axes
        const offset = region.regionType === CARTA.RegionType.RECTANGLE ? {x: region.size.x / 2, y: region.size.y / 2} : {x: region.size.y, y: region.size.x};
        let anchorConfigs = [
            {anchor: "top", offset: {x: 0, y: offset.y}},
            {anchor: "bottom", offset: {x: 0, y: -offset.y}},
            {anchor: "left", offset: {x: -offset.x, y: 0}},
            {anchor: "right", offset: {x: offset.x, y: 0}},
            {anchor: "top-left", offset: {x: -offset.x, y: offset.y}},
            {anchor: "bottom-left", offset: {x: -offset.x, y: -offset.y}},
            {anchor: "top-right", offset: {x: offset.x, y: offset.y}},
            {anchor: "bottom-right", offset: {x: offset.x, y: -offset.y}}
        ];

        if (frame.hasSquarePixels) {
            anchorConfigs.push({anchor: "rotator", offset: {x: 0, y: offset.y}});
        }

        return anchorConfigs.map(config => {
            const centerReferenceImage = region.center;

            let posImage = add2D(centerReferenceImage, rotate2D(config.offset, (region.rotation * Math.PI) / 180));
            if (frame.spatialReference) {
                posImage = transformPoint(frame.spatialTransformAST, posImage, false);
            }

            let posCanvas = transformedImageToCanvasPos(posImage.x, posImage.y, frame, this.props.layerWidth, this.props.layerHeight);
            posCanvas = adjustPosToMutatedStage(posCanvas, this.props.stageRef.current);
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

    public render() {
        const region = this.props.region;
        const frame = this.props.frame;

        let shapeNode: React.ReactNode;
        const centerReferenceImage = region.center;

        // trigger re-render when exporting images
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const imageRatio = AppStore.Instance.imageRatio;

        if (frame.spatialReference) {
            const centerSecondaryImage = transformPoint(frame.spatialTransformAST, centerReferenceImage, false);
            let centerPixelSpace = transformedImageToCanvasPos(centerSecondaryImage.x, centerSecondaryImage.y, frame, this.props.layerWidth, this.props.layerHeight);
            centerPixelSpace = adjustPosToMutatedStage(centerPixelSpace, this.props.stageRef.current);
            const pointsSecondaryImage = region.getRegionApproximation(frame.spatialTransformAST);
            const N = pointsSecondaryImage.length;
            const pointArray = new Array<number>(N * 2);
            for (let i = 0; i < N; i++) {
                let approxPointPixelSpace = transformedImageToCanvasPos(pointsSecondaryImage[i].x, pointsSecondaryImage[i].y, frame, this.props.layerWidth, this.props.layerHeight);
                approxPointPixelSpace = adjustPosToMutatedStage(approxPointPixelSpace, this.props.stageRef.current);
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
            const width = region.size.x / devicePixelRatio;
            const height = region.size.y / devicePixelRatio;
            const rotation = region.rotation;

            let centerPixelSpace = transformedImageToCanvasPos(centerReferenceImage.x, centerReferenceImage.y, frame, this.props.layerWidth, this.props.layerHeight);
            centerPixelSpace = adjustPosToMutatedStage(centerPixelSpace, this.props.stageRef.current);

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
                {this.props.selected && this.props.listening && !region.locked ? this.genAnchors() : null}
            </Group>
        );
    }
}
