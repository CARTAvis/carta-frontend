import React from "react";
import {Group, Shape, Arrow, Transformer, Text, Line} from "react-konva";
import {KonvaEventObject} from "konva/lib/Node";
import * as AST from "ast_wrapper";
import {AppStore} from "stores";
import {CompassAnnotationStore, FrameStore, RegionStore, RulerAnnotationStore} from "stores/Frame";
import {transformedImageToCanvasPos} from "./shared";
import {midpoint2D} from "utilities";

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

    const topMostY = Math.min(northPointArray[northPointArray.length - 1], northPointArray[1], eastPointArray[eastPointArray.length - 1]);
    const bottomMostY = Math.max(northPointArray[northPointArray.length - 1], northPointArray[1], eastPointArray[eastPointArray.length - 1]);
    const leftMostX = Math.min(eastPointArray[0], eastPointArray[eastPointArray.length - 2], northPointArray[northPointArray.length - 2]);
    const rightMostX = Math.max(eastPointArray[0], eastPointArray[eastPointArray.length - 2], northPointArray[northPointArray.length - 2]);

    const topLeftPoint = [leftMostX, topMostY];
    const topRightPoint = [rightMostX, topMostY];
    const bottomLeftPoint = [leftMostX, bottomMostY];
    const bottomRightPoint = [rightMostX, bottomMostY];

    return (
        <>
            <Group ref={shapeRef} listening={!region.locked} draggable onClick={handleClick} onDblClick={handleDoubleClick}>
                {/* <Line points={pointArray} stroke={'yellow'} strokeWidth={10} opacity={1}/> */}
                {/* <Line closed points={[eastPointArray[eastPointArray.length - 2], northPointArray[northPointArray.length - 1], eastPointArray[eastPointArray.length - 2], eastPointArray[eastPointArray.length - 1], northPointArray[northPointArray.length - 2], northPointArray[northPointArray.length - 1]]} opacity={0.5} fill={"green"} />
                <Line closed points={[eastPointArray[0], eastPointArray[1], eastPointArray[eastPointArray.length - 2], eastPointArray[eastPointArray.length - 1], northPointArray[northPointArray.length - 2], northPointArray[northPointArray.length - 1]]} opacity={0.5} fill={"green"} /> */}
                {/* <Rect x={eastPointArray[0]} y={eastPointArray[1]} width={eastPointArray[eastPointArray.length - 2] - eastPointArray[0]} height={northPointArray[northPointArray.length - 1] - northPointArray[1]} opacity={0.5} fill={"green"} /> */}
                <Line closed points={[...topLeftPoint, ...topRightPoint, ...bottomLeftPoint, ...bottomRightPoint]} opacity={0} />
                <Line closed points={[...bottomRightPoint, ...topRightPoint, ...bottomLeftPoint, ...topLeftPoint]} opacity={0} />

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
                <Text x={northPointArray[northPointArray.length - 2]} y={northPointArray[northPointArray.length - 1]} text={region.northLabel} fill={"yellow"} />
                <Text x={eastPointArray[eastPointArray.length - 2]} y={eastPointArray[eastPointArray.length - 1]} text={region.eastLabel} fill={"red"} />
            </Group>
            {props.selected && <Transformer ref={trRef} shouldOverdrawWholeArea onClick={handleClick} onDblClick={handleDoubleClick} />}
        </>
    );
};
export const RulerAnnotation = (props: CompassAnnotationProps) => {
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
    const region = props.region as RulerAnnotationStore;

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
    const tempWcsInfo = AST.copy(frame.wcsInfo);
    const approxPoints = region.getRegionApproximation(tempWcsInfo);

    const xApproxPoints = approxPoints.xApproximatePoints.slice(0, 200);
    const yApproxPoints = approxPoints.yApproximatePoints.slice(0, 200);
    const hypotenuseApproxPoints = approxPoints.hypotenuseApproximatePoints.slice(0, 200);
    const xPointArray = Array<number>(xApproxPoints.length);
    const yPointArray = Array<number>(yApproxPoints.length);
    const hypotenusePointArray = Array<number>(hypotenuseApproxPoints.length);
    // const xApproxPoints = approxPoints.xApproximatePoints;
    // const yApproxPoints = approxPoints.yApproximatePoints;
    // const hypotenuseApproxPoints = approxPoints.hypotenuseApproximatePoints;
    // const xPointArray = new Array<number>(xApproxPoints.length * 2);
    // const yPointArray = new Array<number>(yApproxPoints.length * 2);
    // const hypotenusePointArray = new Array<number>(hypotenuseApproxPoints.length * 2);
    for (let i = 0; i < xPointArray.length; i++) {
        if (i % 2 === 0) {
            // console.log({x: xApproxPoints[i], y: xApproxPoints[i + 1]})
            const point = transformedImageToCanvasPos({x: xApproxPoints[i], y: xApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
            // console.log(point)
            xPointArray[i] = point.x;
            xPointArray[i + 1] = point.y;
        }
    }
    for (let i = 0; i < yPointArray.length; i++) {
        if (i % 2 === 0) {
            const point = transformedImageToCanvasPos({x: yApproxPoints[i], y: yApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
            // console.log(point)
            yPointArray[i] = point.x;
            yPointArray[i + 1] = point.y;
        }
    }
    for (let i = 0; i < hypotenusePointArray.length; i++) {
        if (i % 2 === 0) {
            const point = transformedImageToCanvasPos({x: hypotenuseApproxPoints[i], y: hypotenuseApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
            // console.log(point)
            hypotenusePointArray[i] = point.x;
            hypotenusePointArray[i + 1] = point.y;
        }
    }

    // for (let i = 0; i < xApproxPoints.length; i++) {
    //     const point = transformedImageToCanvasPos(xApproxPoints[i], frame, props.layerWidth, props.layerHeight, props.stageRef.current);
    //     xPointArray[i * 2] = point.x;
    //     xPointArray[i * 2 + 1] = point.y;
    // }
    // for (let i = 0; i < yApproxPoints.length; i++) {
    //     const point = transformedImageToCanvasPos(yApproxPoints[i], frame, props.layerWidth, props.layerHeight, props.stageRef.current);
    //     yPointArray[i * 2] = point.x;
    //     yPointArray[i * 2 + 1] = point.y;
    // }
    // for (let i = 0; i < hypotenuseApproxPoints.length; i++) {
    //     const point = transformedImageToCanvasPos(hypotenuseApproxPoints[i], frame, props.layerWidth, props.layerHeight, props.stageRef.current);
    //     hypotenusePointArray[i * 2] = point.x;
    //     hypotenusePointArray[i * 2 + 1] = point.y;
    // }

    const centerPoints = midpoint2D({x: xPointArray[xPointArray.length - 2], y: xPointArray[xPointArray.length - 1]}, {x: yPointArray[yPointArray.length - 2], y: yPointArray[yPointArray.length - 1]});
    const distance = AST.geodesicDistance(tempWcsInfo, xPointArray[xPointArray.length - 2], xPointArray[xPointArray.length - 1], yPointArray[yPointArray.length - 2], yPointArray[yPointArray.length - 1]);
    const distanceText: string = ((distance * 180.0) / Math.PI).toString() + "\u00B0";
    // const xEndPoint = {x: region.controlPoints[0].x, y: region.controlPoints[0].y};
    // const yEndPoint = {x: region.controlPoints[1].x, y: region.controlPoints[1].y};
    // const transformedXEndPoint = frame?.spatialTransform?.transformCoordinate(xEndPoint);
    // const transformedYEndPoint = frame?.spatialTransform?.transformCoordinate(yEndPoint);
    // const distance = AST.geodesicDistance(tempWcsInfo, transformedXEndPoint?.x, transformedXEndPoint?.y, transformedYEndPoint?.x, transformedYEndPoint?.y);

    // trigger re-render when exporting images
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const imageRatio = AppStore.Instance.imageRatio;

    // const topMostY = Math.min(yPointArray[yPointArray.length - 1], yPointArray[1], xPointArray[xPointArray.length - 1]);
    // const bottomMostY = Math.max(yPointArray[yPointArray.length - 1], yPointArray[1], xPointArray[xPointArray.length - 1]);
    // const leftMostX = Math.min(xPointArray[0], xPointArray[xPointArray.length - 2], yPointArray[yPointArray.length - 2]);
    // const rightMostX = Math.max(xPointArray[0], xPointArray[xPointArray.length - 2], yPointArray[yPointArray.length - 2]);

    // const topLeftPoint = [leftMostX, topMostY];
    // const topRightPoint = [rightMostX, topMostY];
    // const bottomLeftPoint = [leftMostX, bottomMostY];
    // const bottomRightPoint = [rightMostX, bottomMostY];
    const handlePointDraw = (ctx, shape) => {
        HandleSquareDraw(ctx, shape, POINT_WIDTH);
    };

    return (
        <>
            {xPointArray.map((point, index) => {
                if (index % 2 === 0 && index < xPointArray.length - 1) {
                    return <Shape key={index} x={point} y={xPointArray[index + 1]} fill={"yellow"} sceneFunc={handlePointDraw} />;
                }
                return <Shape key={index} x={0} y={0} fill={"yellow"} sceneFunc={handlePointDraw} />;
            })}
            {yPointArray.map((point, index) => {
                return index % 2 === 0 && index < yPointArray.length - 1 ? (
                    <Shape key={index} x={point} y={yPointArray[index + 1]} fill={"yellow"} sceneFunc={handlePointDraw} />
                ) : (
                    <Shape key={index} x={0} y={0} fill={"yellow"} sceneFunc={handlePointDraw} />
                );
            })}
            {hypotenusePointArray.map((point, index) => {
                return index % 2 === 0 && index < hypotenusePointArray.length - 1 ? (
                    <Shape key={index} x={point} y={hypotenusePointArray[index + 1]} fill={"yellow"} sceneFunc={handlePointDraw} />
                ) : (
                    <Shape key={index} x={0} y={0} fill={"yellow"} sceneFunc={handlePointDraw} />
                );
            })}
            <Group ref={shapeRef} listening={!region.locked} draggable onClick={handleClick} onDblClick={handleDoubleClick}>
                {/* <Line closed points={[...topLeftPoint, ...topRightPoint, ...bottomLeftPoint, ...bottomRightPoint]} opacity={0.5} fill={'red'} />
                <Line closed points={[...bottomRightPoint, ...topRightPoint, ...bottomLeftPoint, ...topLeftPoint]} opacity={0.5} fill={'green'} /> */}

                {/* <Line points={[xPointArray[xPointArray.length - 2], xPointArray[xPointArray.length - 1], yPointArray[yPointArray.length - 2], yPointArray[yPointArray.length - 1]]} stroke={"green"} strokeWidth={10} /> */}
                {/* <Line points={hypotenusePointArray} stroke={"green"} strokeWidth={10} />
                <Line
                    stroke={"red"}
                    fill={"red"}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
                    dash={[region.dashLength]}
                    closed={false}
                    perfectDrawEnabled={false}
                    lineJoin={"round"}
                    points={xPointArray}
                    // points={[startPoint.x, startPoint.y, endPoint.x, startPoint.y]}
                />
                <Line
                    stroke={region.color}
                    fill={region.color}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
                    dash={[region.dashLength]}
                    closed={false}
                    perfectDrawEnabled={false}
                    lineJoin={"round"}
                    points={yPointArray}
                    // points={[startPoint.x, startPoint.y, startPoint.x, endPoint.y]}
                /> */}
                <Text x={centerPoints.x} y={centerPoints.y} text={distanceText} stroke={"yellow"} strokeWidth={region.lineWidth} />
            </Group>
            {props.selected && <Transformer ref={trRef} shouldOverdrawWholeArea onClick={handleClick} onDblClick={handleDoubleClick} />}
        </>
    );
};
