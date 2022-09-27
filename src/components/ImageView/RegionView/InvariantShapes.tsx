import React from "react";
import {Group, Shape, Arrow, Transformer, Text, Line} from "react-konva";
import {KonvaEventObject} from "konva/lib/Node";
// import * as AST from "ast_wrapper";
import { AppStore } from "stores";
import {CompassAnnotationStore, FrameStore, RegionStore} from "stores/Frame";
import {transformedImageToCanvasPos} from "./shared";
// import {transformPoint} from "utilities";

const POINT_WIDTH = 6;
const POINT_DRAG_WIDTH = 13;

const SQUARE_ANCHOR_WIDTH = 7;
const CIRCLE_ANCHOR_RADIUS = SQUARE_ANCHOR_WIDTH / Math.sqrt(2);
export const ROTATOR_ANCHOR_HEIGHT = 15;

const CURSOR_CROSS_LENGTH = 10;
const CURSOR_CROSS_THICKNESS_WIDE = 3;
const CURSOR_CROSS_CENTER_SQUARE = 6;

const HandleSquareDraw = (ctx, shape, width) => {
    const inverseScale = 1 / shape.getStage().scaleX();
    const offset = -width * 0.5 * inverseScale;
    const squareSize = width * inverseScale;
    ctx.beginPath();
    ctx.rect(offset, offset, squareSize, squareSize);
    ctx.fillStrokeShape(shape);
};

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
    const handlePointDraw = (ctx, shape) => {
        HandleSquareDraw(ctx, shape, POINT_WIDTH);
    };

    const handlePointBoundDraw = (ctx, shape) => {
        HandleSquareDraw(ctx, shape, POINT_DRAG_WIDTH);
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
    onDblClick?: (ev) => void;
    isLineRegion?: boolean;
}

export const Anchor = (props: AnchorProps) => {
    const handleRectDraw = (ctx, shape) => {
        HandleSquareDraw(ctx, shape, SQUARE_ANCHOR_WIDTH);
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
        HandleSquareDraw(ctx, shape, SQUARE_ANCHOR_WIDTH);
    };

    return <Shape x={props.x} y={props.y} rotation={props.rotation} fill={"white"} strokeWidth={1} stroke={"black"} strokeScaleEnabled={false} opacity={0.5} listening={false} sceneFunc={handleRectDraw} />;
};

interface CursorMarkerProps {
    x: number;
    y: number;
    rotation: number;
}

export const CursorMarker = (props: CursorMarkerProps) => {
    const handleSquareDraw = (ctx, shape) => {
        HandleSquareDraw(ctx, shape, CURSOR_CROSS_CENTER_SQUARE);
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
            <Shape listening={false} strokeScaleEnabled={false} fill={"white"} strokeWidth={1} stroke={"black"} sceneFunc={handleCrossDraw} />
        </Group>
    );
};

interface CompassAnnotationProps {
    key: number;
    frame: FrameStore;
    region: RegionStore;
    layerWidth: number;
    layerHeight: number;
    selected: boolean;
    stageRef: any;
    onSelect?: (region: RegionStore) => void;
    onDoubleClick?: (region: RegionStore) => void;
}

export const CompassAnnotation = (props: CompassAnnotationProps) => {
    const shapeRef = React.useRef();
    const trRef = React.useRef(null);

    React.useEffect(() => {
        if (props.selected) {
            // we need to attach transformer manually
            trRef?.current?.nodes([shapeRef.current]);
            trRef?.current?.getLayer().batchDraw();
        }
    }, [props.selected]);

    const frame = props.frame;
    const region = props.region as CompassAnnotationStore;

    const handleClick = (event: KonvaEventObject<MouseEvent>) => {
        console.log("selecting");
        props.onSelect(region);
    };
    const handleDoubleClick = (event: KonvaEventObject<MouseEvent>) => {
        console.log("double clicking");
        props.onDoubleClick(region);
    };

    // const copySrc = AST.copy(frame.wcsInfoForTransformation);
    // AST.invert(copySrc);
    // const spatialTransformAST = frame.wcsInfo;
    const approxPoints = region.getRegionApproximation(frame.spatialTransformAST);
    const northApproxPoints = approxPoints.northApproximatePoints;
    const eastApproxPoints = approxPoints.eastApproximatePoints;
    const northPointArray = new Array<number>(northApproxPoints.length * 2);
    const eastPointArray = new Array<number>(eastApproxPoints.length * 2);
    for (let i = 0; i < northApproxPoints.length; i++) {
        const point = transformedImageToCanvasPos(northApproxPoints[i], frame, props.layerWidth, props.layerHeight, props.stageRef.current);
        northPointArray[i * 2] = point.x;
        northPointArray[i * 2 + 1] = point.y;
    }
    for (let i = 0; i < eastApproxPoints.length; i++) {
        const point = transformedImageToCanvasPos(eastApproxPoints[i], frame, props.layerWidth, props.layerHeight, props.stageRef.current);
        eastPointArray[i * 2] = point.x;
        eastPointArray[i * 2 + 1] = point.y;
    }

    // trigger re-render when exporting images
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const imageRatio = AppStore.Instance.imageRatio;

    console.log(northPointArray[0], northPointArray[1], eastPointArray[0], eastPointArray[1], northPointArray[northPointArray.length - 2], northPointArray[northPointArray.length - 1], eastPointArray[eastPointArray.length-2], eastPointArray[eastPointArray.length-1])

    return (
        <>
            <Group
                ref={shapeRef}
                listening={!region.locked}
                draggable
                onClick={handleClick}
                onDblClick={handleDoubleClick}
            >
                {/* <Line points={pointArray} stroke={'yellow'} strokeWidth={10} opacity={1}/> */}
                <Line closed points={[eastPointArray[eastPointArray.length - 2], northPointArray[northPointArray.length - 1], eastPointArray[eastPointArray.length - 2], eastPointArray[eastPointArray.length - 1], northPointArray[northPointArray.length - 2], northPointArray[northPointArray.length - 1]]} opacity={0.5} fill={"green"} />
                <Line closed points={[eastPointArray[0], eastPointArray[1], eastPointArray[eastPointArray.length - 2], eastPointArray[eastPointArray.length - 1], northPointArray[northPointArray.length - 2], northPointArray[northPointArray.length - 1]]} opacity={0.5} fill={"green"} />
                {/* <Rect x={eastPointArray[0]} y={eastPointArray[1]} width={eastPointArray[eastPointArray.length - 2] - eastPointArray[0]} height={northPointArray[northPointArray.length - 1] - northPointArray[1]} opacity={0.5} fill={"green"} /> */}
                <Arrow
                    stroke={"red"}
                    fill={"red"}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
                    dash={[region.dashLength]}
                    closed={false}
                    perfectDrawEnabled={false}
                    lineJoin={"round"}
                    points={eastPointArray}
                    // points={[startPoint.x, startPoint.y, endPoint.x, startPoint.y]}
                />
                <Arrow
                    stroke={region.color}
                    fill={region.color}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
                    dash={[region.dashLength]}
                    closed={false}
                    perfectDrawEnabled={false}
                    lineJoin={"round"}
                    points={northPointArray}
                    // points={[startPoint.x, startPoint.y, startPoint.x, endPoint.y]}
                />
                <Text x={northPointArray[northPointArray.length - 2]} y={northPointArray[northPointArray.length - 1]} text={region.northLabel} fill={'yellow'}/>
                <Text x={eastPointArray[eastPointArray.length - 2]} y={eastPointArray[eastPointArray.length - 1]} text={region.eastLabel} fill={'red'}/>
            </Group>
            {props.selected && <Transformer ref={trRef} draggable />}
        </>
    );
};
