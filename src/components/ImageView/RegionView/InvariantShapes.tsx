import {Group, Shape} from "react-konva";

const POINT_WIDTH = 6;
const POINT_DRAG_WIDTH = 13;
const SQUARE_ANCHOR_WIDTH = 7;
const CIRCLE_ANCHOR_RADIUS = SQUARE_ANCHOR_WIDTH / Math.sqrt(2);

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
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, 2 * Math.PI, false);
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
