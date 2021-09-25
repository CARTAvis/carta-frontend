import {Shape} from "react-konva";

const SQUARE_ANCHOR_WIDTH = 7;
const CIRCLE_ANCHOR_RADIUS = SQUARE_ANCHOR_WIDTH / Math.sqrt(2);

interface AnchorProps {
    key: string;
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
