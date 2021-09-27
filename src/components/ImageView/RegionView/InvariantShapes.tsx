import {Group, Line, Shape} from "react-konva";

const POINT_WIDTH = 6;
const POINT_DRAG_WIDTH = 13;

const SQUARE_ANCHOR_WIDTH = 7;
const CIRCLE_ANCHOR_RADIUS = SQUARE_ANCHOR_WIDTH / Math.sqrt(2);
const ROTATOR_ANCHOR_HEIGHT = 15;

const CURSOR_CROSS_LENGTH = 20;
const CURSOR_CROSS_THICKNESS_WIDE = 3;
const CURSOR_CROSS_THICKNESS_NARROW = 1;
const CURSOR_CROSS_GAP = 7;

interface PointProps {
    x: number;
    y: number;
    rotation: number;
    color: string;
    opacity: number;
    listening: boolean;
    onDragStart: (ev) => void;
    onDragEnd: (ev) => void;
    onDragMove: (ev) => void;
    onClick: (ev) => void;
    onDblClick: (ev) => void;
}

export const Point = (props: PointProps) => {
    const handleSquareDraw = (ctx, shape, width) => {
        const reverseScale = 1 / shape.getStage().scaleX();
        const offset = -width * 0.5 * reverseScale;
        const squareSize = width * reverseScale;
        ctx.beginPath();
        ctx.rect(offset, offset, squareSize, squareSize);
        ctx.fillStrokeShape(shape);
    };

    const handlePointDraw = (ctx, shape) => {
        handleSquareDraw(ctx, shape, POINT_WIDTH);
    };

    const handlePointBoundDraw = (ctx, shape) => {
        handleSquareDraw(ctx, shape, POINT_DRAG_WIDTH);
    };

    return (
        <Group>
            <Shape x={props.x} y={props.y} rotation={props.rotation} fill={props.color} sceneFunc={handlePointDraw} />
            <Shape
                x={props.x}
                y={props.y}
                rotation={props.rotation}
                sceneFunc={handlePointBoundDraw}
                stroke={"white"}
                strokeWidth={1}
                strokeScaleEnabled={false}
                opacity={props.opacity}
                draggable={true}
                listening={props.listening}
                onDragStart={props.onDragStart}
                onDragEnd={props.onDragEnd}
                onDragMove={props.onDragMove}
                onClick={props.onClick}
                onDblClick={props.onDblClick}
            />
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
}

export const Anchor = (props: AnchorProps) => {
    const handleRectDraw = (ctx, shape) => {
        const reverseScale = 1 / shape.getStage().scaleX();
        const offset = -SQUARE_ANCHOR_WIDTH * 0.5 * reverseScale;
        const squareSize = SQUARE_ANCHOR_WIDTH * reverseScale;
        ctx.beginPath();
        ctx.rect(offset, offset, squareSize, squareSize);
        ctx.fillStrokeShape(shape);
    };

    const handleCircleDraw = (ctx, shape) => {
        const reverseScale = 1 / shape.getStage().scaleX();
        const radius = CIRCLE_ANCHOR_RADIUS * reverseScale;
        const offsetY = (-ROTATOR_ANCHOR_HEIGHT / shape.getStage().scaleX()) * devicePixelRatio;
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
            dragBoundFunc={() => ({x: props.x, y: props.y})}
            sceneFunc={props.isRotator ? handleCircleDraw : handleRectDraw}
        />
    );
};

interface CursorMarkerProps {
    x: number;
    y: number;
    rotation: number;
}

export const CursorMarker = (props: CursorMarkerProps) => {
    const CENTER_SQUARE_SIZE = CURSOR_CROSS_GAP - 1;
    const handleSquareDraw = (ctx, shape) => {
        const reverseScale = 1 / shape.getStage().scaleX();
        const offset = -CENTER_SQUARE_SIZE * 0.5 * reverseScale;
        const squareSize = CENTER_SQUARE_SIZE * reverseScale;
        ctx.beginPath();
        ctx.rect(offset, offset, squareSize, squareSize);
        ctx.fillStrokeShape(shape);
    };

    // TODO: fix line issue
    return (
        <Group x={Math.floor(props.x) + 0.5} y={Math.floor(props.y) + 0.5} rotation={-props.rotation}>
            <Line listening={false} strokeScaleEnabled={false} points={[-CURSOR_CROSS_LENGTH / 2 - CURSOR_CROSS_THICKNESS_WIDE / 2, 0, -CURSOR_CROSS_GAP / 2, 0]} strokeWidth={CURSOR_CROSS_THICKNESS_WIDE} stroke="black" />
            <Line listening={false} strokeScaleEnabled={false} points={[CURSOR_CROSS_GAP / 2, 0, CURSOR_CROSS_LENGTH / 2 + CURSOR_CROSS_THICKNESS_WIDE / 2, 0]} strokeWidth={CURSOR_CROSS_THICKNESS_WIDE} stroke="black" />
            <Line listening={false} strokeScaleEnabled={false} points={[0, -CURSOR_CROSS_LENGTH / 2 - CURSOR_CROSS_THICKNESS_WIDE / 2, 0, -CURSOR_CROSS_GAP / 2]} strokeWidth={CURSOR_CROSS_THICKNESS_WIDE} stroke="black" />
            <Line listening={false} strokeScaleEnabled={false} points={[0, CURSOR_CROSS_GAP / 2, 0, CURSOR_CROSS_LENGTH / 2 + CURSOR_CROSS_THICKNESS_WIDE / 2]} strokeWidth={CURSOR_CROSS_THICKNESS_WIDE} stroke="black" />
            <Shape listening={false} strokeScaleEnabled={false} strokeWidth={1} stroke={"black"}  sceneFunc={handleSquareDraw} />
            <Line listening={false} strokeScaleEnabled={false} points={[-CURSOR_CROSS_LENGTH / 2 - CURSOR_CROSS_THICKNESS_NARROW / 2, 0, -CURSOR_CROSS_GAP / 2, 0]} strokeWidth={CURSOR_CROSS_THICKNESS_NARROW} stroke="white" />
            <Line listening={false} strokeScaleEnabled={false} points={[CURSOR_CROSS_GAP / 2, 0, CURSOR_CROSS_LENGTH / 2 + CURSOR_CROSS_THICKNESS_NARROW / 2, 0]} strokeWidth={CURSOR_CROSS_THICKNESS_NARROW} stroke="white" />
            <Line listening={false} strokeScaleEnabled={false} points={[0, -CURSOR_CROSS_LENGTH / 2 - CURSOR_CROSS_THICKNESS_NARROW / 2, 0, -CURSOR_CROSS_GAP / 2]} strokeWidth={CURSOR_CROSS_THICKNESS_NARROW} stroke="white" />
            <Line listening={false} strokeScaleEnabled={false} points={[0, CURSOR_CROSS_GAP / 2, 0, CURSOR_CROSS_LENGTH / 2 + CURSOR_CROSS_THICKNESS_NARROW / 2]} strokeWidth={CURSOR_CROSS_THICKNESS_NARROW} stroke="white" />
        </Group>
    );
}