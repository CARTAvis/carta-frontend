import {Group, Shape} from "react-konva";
import {CARTA} from "carta-protobuf";
import type Konva from "konva";

import {SelectionType} from "enums";
import {type Point2D} from "models";
import {AppStore} from "stores";

import {getZoomInvariantCanvasTransform} from "./shared";

const SQUARE_ANCHOR_WIDTH = 7;
const CIRCLE_ANCHOR_RADIUS = SQUARE_ANCHOR_WIDTH / Math.sqrt(2);
export const ROTATOR_ANCHOR_HEIGHT = 15;

const CURSOR_CROSS_LENGTH = 10;
const CURSOR_CROSS_THICKNESS_WIDE = 3;
const CURSOR_CROSS_CENTER_SQUARE = 6;
const DEFAULT_POINT_WIDTH = 6;
const POINT_HOVER_DIST = 7;

const ACTIVE_SELECTION_STROKE_COLOR = "#ffffff";
const SECONDARY_SELECTION_STROKE_COLOR = "#8a9ba8";
const SELECTED_ANCHOR_FILL_COLOR = "#007cbb";
const SELECTED_ANCHOR_STROKE_COLOR = "#ffffff";
const ACTIVE_ANCHOR_FILL_COLOR = "white";
const ACTIVE_ANCHOR_STROKE_COLOR = "black";
const SECONDARY_ANCHOR_FILL_COLOR = "#b5b5b5";
const SECONDARY_ANCHOR_STROKE_COLOR = "#8a9ba8";

const ApplyZoomInvariantTransform = (ctx: Konva.Context, shape: Konva.Shape, rotation: number) => {
    const stage = shape.getStage();
    if (!stage) {
        return;
    }

    const {scaleX, scaleY, skew} = getZoomInvariantCanvasTransform(stage, rotation);

    ctx.transform(scaleX, skew, skew, scaleY, 0, 0);
};

const HandlePointShapeDraw = (ctx: Konva.Context, shape: Konva.Shape, width: number, rotation: number, pointShape?: CARTA.PointAnnotationShape) => {
    const stage = shape.getStage();
    if (!stage) {
        return;
    }

    ctx.save();
    ApplyZoomInvariantTransform(ctx, shape, rotation);
    const offset = -width * 0.5;
    const squareSize = width;
    ctx.beginPath();
    switch (pointShape) {
        case CARTA.PointAnnotationShape.CIRCLE:
        case CARTA.PointAnnotationShape.CIRCLE_LINED:
            ctx.arc(0, 0, squareSize / 2, 0, 2 * Math.PI, true);
            ctx.closePath();
            break;
        case CARTA.PointAnnotationShape.DIAMOND:
        case CARTA.PointAnnotationShape.DIAMOND_LINED:
            ctx.moveTo(0, -squareSize / 2);
            ctx.lineTo(squareSize / 2, 0);
            ctx.lineTo(0, squareSize / 2);
            ctx.lineTo(-squareSize / 2, 0);
            ctx.closePath();
            break;
        case CARTA.PointAnnotationShape.CROSS:
            ctx.moveTo(0, -squareSize / 2);
            ctx.lineTo(0, squareSize / 2);
            ctx.moveTo(-squareSize / 2, 0);
            ctx.lineTo(squareSize / 2, 0);
            ctx.closePath();
            break;
        case CARTA.PointAnnotationShape.X:
            ctx.moveTo(-squareSize / 2, -squareSize / 2);
            ctx.lineTo(squareSize / 2, squareSize / 2);
            ctx.moveTo(squareSize / 2, -squareSize / 2);
            ctx.lineTo(-squareSize / 2, squareSize / 2);
            ctx.closePath();
            break;
        default:
            ctx.rect(offset, offset, squareSize, squareSize);
            ctx.closePath();
    }
    ctx.fillStrokeShape(shape);
    ctx.restore();
};

interface PointProps {
    x: number;
    y: number;
    rotation: number;
    color: string;
    opacity: number;
    selectionOpacity: number;
    selectionType: SelectionType;
    zoom: Point2D;
    listening: boolean;
    onDragStart: (ev) => void;
    onDragEnd: (ev) => void;
    onDragMove: (ev) => void;
    onClick: (ev) => void;
    onDblClick: (ev) => void;
    pointShape?: CARTA.PointAnnotationShape;
    pointWidth?: number;
}

export const Point = (props: PointProps) => {
    const pointWidth = props.pointWidth && props.pointWidth !== 0 ? props.pointWidth : DEFAULT_POINT_WIDTH;
    const handlePointDraw = (ctx: Konva.Context, shape: Konva.Shape) => {
        HandlePointShapeDraw(ctx, shape, pointWidth, props.rotation, props.pointShape);
    };

    const handlePointBoundDraw = (ctx: Konva.Context, shape: Konva.Shape) => {
        HandlePointShapeDraw(ctx, shape, POINT_HOVER_DIST + pointWidth, props.rotation);
    };

    const fill = props.pointShape === CARTA.PointAnnotationShape.BOX || props.pointShape === CARTA.PointAnnotationShape.CIRCLE_LINED || props.pointShape === CARTA.PointAnnotationShape.DIAMOND_LINED ? undefined : props.color;

    return (
        <Group>
            <Shape x={props.x} y={props.y} opacity={props.opacity} rotation={props.rotation} fill={fill} stroke={props.color} strokeScaleEnabled={false} sceneFunc={handlePointDraw} />
            {!AppStore.Instance.activeFrame?.regionSet.isLocked && (
                <Shape
                    x={props.x}
                    y={props.y}
                    rotation={props.rotation}
                    sceneFunc={handlePointBoundDraw}
                    stroke={props.selectionType === SelectionType.Secondary ? SECONDARY_SELECTION_STROKE_COLOR : ACTIVE_SELECTION_STROKE_COLOR}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    opacity={props.selectionOpacity}
                    draggable={true}
                    listening={props.listening}
                    onDragStart={props.onDragStart}
                    onDragEnd={props.onDragEnd}
                    onDragMove={props.onDragMove}
                    onClick={props.onClick}
                    onDblClick={props.onDblClick}
                />
            )}
        </Group>
    );
};

interface AnchorProps {
    anchor: string;
    x: number;
    y: number;
    rotation: number;
    isRotator: boolean;
    isSelected?: boolean;
    interactive: boolean;
    opacity: number;
    selectionType: SelectionType;
    zoom: Point2D;
    onMouseEnter: (ev) => void;
    onMouseOut: (ev) => void;
    onDragStart: (ev) => void;
    onDragEnd: (ev) => void;
    onDragMove: (ev) => void;
    onClick: (ev) => void;
    onDblClick?: (ev) => void;
    isLineRegion?: boolean;
}

export const Anchor = (props: AnchorProps) => {
    const handleRectDraw = (ctx, shape) => {
        HandlePointShapeDraw(ctx, shape, SQUARE_ANCHOR_WIDTH, props.rotation);
    };

    const handleCircleDraw = (ctx, shape) => {
        const stage = shape.getStage();
        if (!stage) {
            return;
        }

        ctx.save();
        ApplyZoomInvariantTransform(ctx, shape, props.rotation);
        const radius = CIRCLE_ANCHOR_RADIUS;
        const offsetY = props.isLineRegion ? 0 : -ROTATOR_ANCHOR_HEIGHT;
        ctx.beginPath();
        ctx.arc(0, offsetY, radius, 0, 2 * Math.PI, false);
        ctx.fillStrokeShape(shape);
        ctx.restore();
    };

    // Colors:
    // - Selected point: blue fill, white stroke
    // - Active region anchors: white fill, black stroke
    // - Secondary-selected anchors: gray fill/stroke
    const isSecondary = props.selectionType === SelectionType.Secondary;
    // Secondary anchors use a slightly darker gray fill for visibility
    const fillColor = props.isSelected ? SELECTED_ANCHOR_FILL_COLOR : isSecondary ? SECONDARY_ANCHOR_FILL_COLOR : ACTIVE_ANCHOR_FILL_COLOR;
    const strokeColor = props.isSelected ? SELECTED_ANCHOR_STROKE_COLOR : isSecondary ? SECONDARY_ANCHOR_STROKE_COLOR : ACTIVE_ANCHOR_STROKE_COLOR;
    const strokeWidth = props.isSelected ? 2 : 1;

    return (
        <Shape
            x={props.x}
            y={props.y}
            rotation={props.rotation}
            fill={fillColor}
            strokeWidth={strokeWidth}
            stroke={strokeColor}
            strokeScaleEnabled={false}
            opacity={props.opacity}
            draggable={props.interactive}
            listening={props.interactive}
            key={props.anchor}
            id={props.anchor}
            onMouseEnter={props.onMouseEnter}
            onMouseOut={props.onMouseOut}
            onDragStart={props.onDragStart}
            onDragEnd={props.onDragEnd}
            onDragMove={props.onDragMove}
            onClick={props.onClick}
            onDblClick={props.onDblClick}
            sceneFunc={props.isRotator ? handleCircleDraw : handleRectDraw}
        />
    );
};

interface NonEditableAnchorProps {
    x: number;
    y: number;
    rotation: number;
    zoom: Point2D;
}

export const NonEditableAnchor = (props: NonEditableAnchorProps) => {
    const handleRectDraw = (ctx, shape) => {
        HandlePointShapeDraw(ctx, shape, SQUARE_ANCHOR_WIDTH, props.rotation);
    };

    return <Shape x={props.x} y={props.y} rotation={props.rotation} fill={"white"} strokeWidth={1} stroke={"black"} strokeScaleEnabled={false} opacity={0.5} listening={false} sceneFunc={handleRectDraw} />;
};

interface CursorMarkerProps {
    x: number;
    y: number;
    rotation: number;
    color: string;
    zoom: Point2D;
}

export const CursorMarker = (props: CursorMarkerProps) => {
    const handleSquareDraw = (ctx, shape) => {
        HandlePointShapeDraw(ctx, shape, CURSOR_CROSS_CENTER_SQUARE, -props.rotation);
    };

    const handleCrossDraw = (ctx, shape) => {
        const stage = shape.getStage();
        if (!stage) {
            return;
        }

        ctx.save();
        ApplyZoomInvariantTransform(ctx, shape, -props.rotation);
        const offset = -CURSOR_CROSS_CENTER_SQUARE * 0.5;
        const crossWidth = CURSOR_CROSS_LENGTH;
        const crossHeight = CURSOR_CROSS_THICKNESS_WIDE;
        ctx.beginPath();
        ctx.rect(-offset, offset / 2, crossWidth, crossHeight);
        ctx.rect(offset - crossWidth, offset / 2, crossWidth, crossHeight);
        ctx.rect(offset / 2, -offset, crossHeight, crossWidth);
        ctx.rect(offset / 2, offset - crossWidth, crossHeight, crossWidth);
        ctx.fillStrokeShape(shape);
        ctx.restore();
    };

    return (
        <Group x={props.x} y={props.y} rotation={-props.rotation}>
            <Shape listening={false} strokeScaleEnabled={false} strokeWidth={1} stroke={"black"} sceneFunc={handleSquareDraw} />
            <Shape listening={false} strokeScaleEnabled={false} fill={props.color} strokeWidth={1} stroke={"black"} sceneFunc={handleCrossDraw} />
        </Group>
    );
};
