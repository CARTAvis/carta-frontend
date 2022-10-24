import Konva from "konva";
import {Group, Shape} from "react-konva";
import {AppStore} from "stores";
import {POINTSHAPE} from "stores/Frame";

const POINT_WIDTH = 6;
const POINT_DRAG_WIDTH = 13;

const SQUARE_ANCHOR_WIDTH = 7;
const CIRCLE_ANCHOR_RADIUS = SQUARE_ANCHOR_WIDTH / Math.sqrt(2);
export const ROTATOR_ANCHOR_HEIGHT = 15;

const CURSOR_CROSS_LENGTH = 10;
const CURSOR_CROSS_THICKNESS_WIDE = 3;
const CURSOR_CROSS_CENTER_SQUARE = 6;

const HandlePointShapeDraw = (ctx: Konva.Context, shape: Konva.Shape, width: number, pointShape?: POINTSHAPE) => {
    const inverseScale = 1 / shape.getStage().scaleX();
    const offset = -width * 0.5 * inverseScale;
    const squareSize = width * inverseScale;
    ctx.beginPath();
    switch (pointShape) {
        case POINTSHAPE.CIRCLE:
            ctx.arc(0, 0, squareSize, 0, 2 * Math.PI, true);
            ctx.closePath();
            break;
        case POINTSHAPE.BOX:
            ctx.moveTo(-squareSize, -squareSize);
            ctx.lineTo(squareSize, -squareSize);
            ctx.moveTo(squareSize, -squareSize);
            ctx.lineTo(squareSize, squareSize);
            ctx.moveTo(squareSize, squareSize);
            ctx.lineTo(-squareSize, squareSize);
            ctx.moveTo(-squareSize, squareSize);
            ctx.lineTo(-squareSize, -squareSize);
            break;
        case POINTSHAPE.DIAMOND:
            ctx.moveTo(0, -squareSize);
            ctx.lineTo(squareSize, 0);
            ctx.lineTo(0, squareSize);
            ctx.lineTo(-squareSize, 0);
            ctx.closePath();
            break;
        case POINTSHAPE.CROSS:
            ctx.moveTo(0, -squareSize);
            ctx.lineTo(0, squareSize);
            ctx.moveTo(-squareSize, 0);
            ctx.lineTo(squareSize, 0);
            ctx.closePath();
            break;
        case POINTSHAPE.X:
            ctx.moveTo(-squareSize, -squareSize);
            ctx.lineTo(squareSize, squareSize);
            ctx.moveTo(squareSize, -squareSize);
            ctx.lineTo(-squareSize, squareSize);
            ctx.closePath();
            break;
        default:
            ctx.rect(offset, offset, squareSize, squareSize);
            ctx.closePath();
    }
    ctx.fillStrokeShape(shape);
};

interface PointProps {
    x: number;
    y: number;
    rotation: number;
    color: string;
    opacity: number;
    selectionOpacity: number;
    listening: boolean;
    onDragStart: (ev) => void;
    onDragEnd: (ev) => void;
    onDragMove: (ev) => void;
    onClick: (ev) => void;
    onDblClick: (ev) => void;
    pointShape?: POINTSHAPE;
}

export const Point = (props: PointProps) => {
    const handlePointDraw = (ctx: Konva.Context, shape: Konva.Shape) => {
        HandlePointShapeDraw(ctx, shape, POINT_WIDTH, props.pointShape);
    };

    const handlePointBoundDraw = (ctx: Konva.Context, shape: Konva.Shape) => {
        HandlePointShapeDraw(ctx, shape, POINT_DRAG_WIDTH);
    };

    return (
        <Group>
            <Shape x={props.x} y={props.y} opacity={props.opacity} rotation={props.rotation} fill={props.color} stroke={props.color} strokeScaleEnabled={false} sceneFunc={handlePointDraw} />
            {!AppStore.Instance.activeFrame?.regionSet.locked && (
                <Shape
                    x={props.x}
                    y={props.y}
                    rotation={props.rotation}
                    sceneFunc={handlePointBoundDraw}
                    stroke={"white"}
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
    onMouseEnter: (ev) => void;
    onMouseOut: (ev) => void;
    onDragStart: (ev) => void;
    onDragEnd: (ev) => void;
    onDragMove: (ev) => void;
    onDblClick?: (ev) => void;
    isLineRegion?: boolean;
}

export const Anchor = (props: AnchorProps) => {
    const handleRectDraw = (ctx, shape) => {
        HandlePointShapeDraw(ctx, shape, SQUARE_ANCHOR_WIDTH);
    };

    const handleCircleDraw = (ctx, shape) => {
        const inverseScale = 1 / shape.getStage().scaleX();
        const radius = CIRCLE_ANCHOR_RADIUS * inverseScale;
        const offsetY = props.isLineRegion ? 0 : -ROTATOR_ANCHOR_HEIGHT * inverseScale;
        ctx.beginPath();
        ctx.arc(0, offsetY, radius, 0, 2 * Math.PI, false);
        ctx.fillStrokeShape(shape);
    };

    return (
        <Shape
            x={props.x}
            y={props.y}
            rotation={props.rotation}
            fill={"white"}
            strokeWidth={1}
            stroke={"black"}
            strokeScaleEnabled={false}
            draggable={true}
            key={props.anchor}
            id={props.anchor}
            onMouseEnter={props.onMouseEnter}
            onMouseOut={props.onMouseOut}
            onDragStart={props.onDragStart}
            onDragEnd={props.onDragEnd}
            onDragMove={props.onDragMove}
            onDblClick={props.onDblClick}
            sceneFunc={props.isRotator ? handleCircleDraw : handleRectDraw}
        />
    );
};

interface NonEditableAnchorProps {
    x: number;
    y: number;
    rotation: number;
}

export const NonEditableAnchor = (props: NonEditableAnchorProps) => {
    const handleRectDraw = (ctx, shape) => {
        HandlePointShapeDraw(ctx, shape, SQUARE_ANCHOR_WIDTH);
    };

    return <Shape x={props.x} y={props.y} rotation={props.rotation} fill={"white"} strokeWidth={1} stroke={"black"} strokeScaleEnabled={false} opacity={0.5} listening={false} sceneFunc={handleRectDraw} />;
};

interface CursorMarkerProps {
    x: number;
    y: number;
    rotation: number;
    color: string;
}

export const CursorMarker = (props: CursorMarkerProps) => {
    const handleSquareDraw = (ctx, shape) => {
        HandlePointShapeDraw(ctx, shape, CURSOR_CROSS_CENTER_SQUARE);
    };

    const handleCrossDraw = (ctx, shape) => {
        const inverseScale = 1 / shape.getStage().scaleX();
        const offset = -CURSOR_CROSS_CENTER_SQUARE * 0.5 * inverseScale;
        const crossWidth = CURSOR_CROSS_LENGTH * inverseScale;
        const crossHeight = CURSOR_CROSS_THICKNESS_WIDE * inverseScale;
        ctx.beginPath();
        ctx.rect(-offset, offset / 2, crossWidth, crossHeight);
        ctx.rect(offset - crossWidth, offset / 2, crossWidth, crossHeight);
        ctx.rect(offset / 2, -offset, crossHeight, crossWidth);
        ctx.rect(offset / 2, offset - crossWidth, crossHeight, crossWidth);
        ctx.fillStrokeShape(shape);
    };

    return (
        <Group x={props.x} y={props.y} rotation={-props.rotation}>
            <Shape listening={false} strokeScaleEnabled={false} strokeWidth={1} stroke={"black"} sceneFunc={handleSquareDraw} />
            <Shape listening={false} strokeScaleEnabled={false} fill={props.color} strokeWidth={1} stroke={"black"} sceneFunc={handleCrossDraw} />
        </Group>
    );
};
