import React from "react";
import {Group, Shape, Arrow, Text, Line} from "react-konva";
import Konva from "konva";
import * as AST from "ast_wrapper";
import {AppStore} from "stores";
import {CompassAnnotationStore, FrameStore, RegionStore, RulerAnnotationStore} from "stores/Frame";
import {adjustPosToUnityStage, canvasToTransformedImagePos, transformedImageToCanvasPos} from "./shared";
import {add2D, midpoint2D, subtract2D, transformPoint} from "utilities";

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
    selectionOpacity: number;
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
            <Shape x={props.x} y={props.y} opacity={props.opacity} rotation={props.rotation} fill={props.color} sceneFunc={handlePointDraw} />
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
    color: string;
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
            <Shape listening={false} strokeScaleEnabled={false} fill={props.color} strokeWidth={1} stroke={"black"} sceneFunc={handleCrossDraw} />
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

    const frame = props.frame;
    const region = props.region as CompassAnnotationStore;
    const mousePoint = React.useRef({x: 0, y: 0});

    const handleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        console.log("selecting");
        props.onSelect(region);
    };
    const handleDoubleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        console.log("double clicking");
        props.onDoubleClick(region);
    };

    const handleDragStart = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            props.onSelect?.(props.region);
            mousePoint.current = {x: konvaEvent.evt.offsetX, y: konvaEvent.evt.offsetY};
            props.region.beginEditing();
        }
    };

    const getCursorPosImageSpace = (offsetX: number, offsetY: number) => {
        const frame = props.frame;
        let cursorPosImageSpace = canvasToTransformedImagePos(offsetX, offsetY, frame, props.layerWidth, props.layerHeight);
        if (frame.spatialReference) {
            cursorPosImageSpace = transformPoint(frame.spatialTransformAST, cursorPosImageSpace, true);
        }
        return cursorPosImageSpace;
    };

    const handleDragEnd = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target && konvaEvent.target.nodeType !== "Shape") {
            // const oldPosition = adjustPosToUnityStage(mousePoint.current, props.stageRef.current);;
            // const oldImagePosition = canvasToTransformedImagePos(oldPosition.x, oldPosition.y, frame, props.layerWidth, props.layerHeight);
            // const position = adjustPosToUnityStage(konvaEvent.target.position(), props.stageRef.current);
            // const imagePosition = canvasToTransformedImagePos(position.x, position.y, frame, props.layerWidth, props.layerHeight);
            const deltaPosition = subtract2D({x: konvaEvent.evt.offsetX, y: konvaEvent.evt.offsetY}, mousePoint.current);
            deltaPosition.y *= -1;
            const changePosition = getCursorPosImageSpace(deltaPosition.x, deltaPosition.y);
            console.log(deltaPosition, changePosition);
            const newPoints = region.controlPoints.map(p => add2D(p, deltaPosition));
            region.setControlPoints(newPoints, false, false);
        }
        props.region.endEditing();

        console.log(region.controlPoints[0].x, region.controlPoints[0].y, region.controlPoints[1].x, region.controlPoints[1].y, konvaEvent.currentTarget);
    };

    const handleAnchorMouseEnter = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const target = konvaEvent.target;
        const stage = target?.getStage();
        if (stage) {
            stage.container().style.cursor = "move";
        }
    };

    const handleAnchorMouseOut = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target && konvaEvent.target.getStage()) {
            konvaEvent.target.getStage().container().style.cursor = "default";
        }
    };

    const handleAnchorDragStart = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            props.onSelect?.(props.region);
            props.region.beginEditing();
        }
    };

    const handleAnchorDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            const anchor = konvaEvent.target;
            const anchorPos = anchor.position();
            // const anchorName = anchor.id();
            const offsetPoint = adjustPosToUnityStage(anchorPos, props.stageRef.current);
            let positionImageSpace = canvasToTransformedImagePos(offsetPoint.x, offsetPoint.y, frame, props.layerWidth, props.layerHeight);
            if (frame.spatialReference) {
                positionImageSpace = transformPoint(frame.spatialTransformAST, positionImageSpace, true);
            }

            region.setLength(2 * Math.abs(positionImageSpace.y - region.controlPoints[0].y));
            region.setControlPoint(1, {x: region.controlPoints[0].x + region.length / 2, y: region.controlPoints[0].y - region.length / 2});
        }
    };

    const handleAnchorDragEnd = () => {
        region.endEditing();
    };

    const approxPoints = region.getRegionApproximation(frame.wcsInfo);
    const northApproxPoints = approxPoints.northApproximatePoints;
    const eastApproxPoints = approxPoints.eastApproximatePoints;
    const northPointArray = new Array<number>(northApproxPoints.length);
    const eastPointArray = new Array<number>(eastApproxPoints.length);

    for (let i = 0; i < northApproxPoints.length; i += 2) {
        const point = transformedImageToCanvasPos({x: northApproxPoints[i], y: northApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
        northPointArray[i] = point.x;
        northPointArray[i + 1] = point.y;
    }

    for (let i = 0; i < eastApproxPoints.length; i += 2) {
        const point = transformedImageToCanvasPos({x: eastApproxPoints[i], y: eastApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
        eastPointArray[i] = point.x;
        eastPointArray[i + 1] = point.y;
    }

    // trigger re-render when exporting images
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const imageRatio = AppStore.Instance.imageRatio;

    // const topMostY = Math.min(northPointArray[northPointArray.length - 1], northPointArray[1], eastPointArray[eastPointArray.length - 1]);
    // const bottomMostY = Math.max(northPointArray[northPointArray.length - 1], northPointArray[1], eastPointArray[eastPointArray.length - 1]);
    // const leftMostX = Math.min(eastPointArray[0], eastPointArray[eastPointArray.length - 2], northPointArray[northPointArray.length - 2]);
    // const rightMostX = Math.max(eastPointArray[0], eastPointArray[eastPointArray.length - 2], northPointArray[northPointArray.length - 2]);

    // const topLeftPoint = [leftMostX, topMostY];
    // const topRightPoint = [rightMostX, topMostY];
    // const bottomLeftPoint = [leftMostX, bottomMostY];
    // const bottomRightPoint = [rightMostX, bottomMostY];

    // const secondaryImagePointNorth = frame.spatialReference ? transformPoint(frame.spatialTransformAST, {x: northPointArray[northPointArray.length - 2], y: northPointArray[northPointArray.length - 1]}, false) : {x: northPointArray[northPointArray.length - 2], y: northPointArray[northPointArray.length - 1]};
    // const secondaryImagePointEast = frame.spatialReference ? transformPoint(frame.spatialTransformAST, {x: eastPointArray[eastPointArray.length - 2], y: eastPointArray[eastPointArray.length - 1]}, false) : {x: eastPointArray[eastPointArray.length - 2], y: eastPointArray[eastPointArray.length - 1]};
    // const canvasPosNorth = transformedImageToCanvasPos(secondaryImagePointNorth, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
    // const canvasPosEast = transformedImageToCanvasPos(secondaryImagePointEast, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
    const anchorPosition = transformedImageToCanvasPos({x: region.controlPoints[1].x, y: region.controlPoints[1].y}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
    // anchorPosition.x = anchorPosition.x + region.length / 2;
    // anchorPosition.y = anchorPosition.y + region.length / 2;

    return (
        <>
            <Group ref={shapeRef} listening={!region.locked} draggable onClick={handleClick} onDblClick={handleDoubleClick} onMouseDown={handleDragStart} onDragEnd={handleDragEnd}>
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
                    points={eastPointArray}
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
                />
                <Text
                    x={northPointArray[northPointArray.length - 2]}
                    y={northPointArray[northPointArray.length - 1]}
                    text={region.northLabel}
                    stroke={region.color}
                    fill={region.color}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
                    fontSize={region.fontSize}
                />
                <Text
                    x={eastPointArray[eastPointArray.length - 2]}
                    y={eastPointArray[eastPointArray.length - 1]}
                    text={region.eastLabel}
                    stroke={region.color}
                    fill={region.color}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
                    fontSize={region.fontSize}
                />
                <Group>
                    {props.selected && (
                        <>
                            <Anchor
                                anchor={"origin"}
                                x={anchorPosition.x}
                                y={anchorPosition.y}
                                rotation={0}
                                isRotator={false}
                                onMouseEnter={handleAnchorMouseEnter}
                                onMouseOut={handleAnchorMouseOut}
                                onDragStart={handleAnchorDragStart}
                                onDragEnd={handleAnchorDragEnd}
                                onDragMove={handleAnchorDrag}
                            />
                            {/* <Anchor
                                anchor={"east"}
                                x={eastPointArray[eastPointArray.length - 2]}
                                y={eastPointArray[eastPointArray.length - 1]}
                                rotation={0}
                                isRotator={false}
                                onMouseEnter={handleAnchorMouseEnter}
                                onMouseOut={handleAnchorMouseOut}
                                onDragStart={handleAnchorDragStart}
                                onDragEnd={handleAnchorDragEnd}
                                onDragMove={handleAnchorDrag}
                            /> */}
                        </>
                    )}
                </Group>
            </Group>
        </>
    );
};
export const RulerAnnotation = (props: CompassAnnotationProps) => {
    const shapeRef = React.useRef();
    const mousePoint = React.useRef({x: 0, y: 0});

    const frame = props.frame;
    const region = props.region as RulerAnnotationStore;

    const handleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        console.log("selecting", event);
        props.onSelect(region);
    };
    const handleDoubleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        console.log("double clicking");
        props.onDoubleClick(region);
    };

    const handleDragStart = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        props.onSelect?.(props.region);
        props.region.beginEditing();
        mousePoint.current = konvaEvent.target.position();
    };

    const handleDragEnd = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target && konvaEvent.target.nodeType !== "Shape") {
            // const oldPosition = adjustPosToUnityStage(mousePoint.current, props.stageRef.current);;
            // const oldImagePosition = canvasToTransformedImagePos(oldPosition.x, oldPosition.y, frame, props.layerWidth, props.layerHeight);
            // const position = adjustPosToUnityStage(konvaEvent.target.position(), props.stageRef.current);
            // const imagePosition = canvasToTransformedImagePos(position.x, position.y, frame, props.layerWidth, props.layerHeight);
            // const deltaPosition = subtract2D(imagePosition, oldImagePosition);
            // console.log(deltaPosition)
            // const newPoints = region.controlPoints.map(p => add2D(p, {x: deltaPosition.x / 2, y: deltaPosition.y / 2}));
            // region.setControlPoints(newPoints, false, false);
        }
        props.region.endEditing();

        console.log(region.controlPoints[0].x, region.controlPoints[0].y, region.controlPoints[1].x, region.controlPoints[1].y, konvaEvent.target);
    };

    const handleDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        console.log(konvaEvent);
    };

    const handleAnchorMouseEnter = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const target = konvaEvent.target;
        const stage = target?.getStage();
        if (stage) {
            stage.container().style.cursor = "move";
        }
    };

    const handleAnchorMouseOut = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target && konvaEvent.target.getStage()) {
            konvaEvent.target.getStage().container().style.cursor = "default";
        }
    };

    const handleAnchorDragStart = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            region.beginEditing();
        }
    };

    const handleAnchorDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            const anchor = konvaEvent.target;
            const anchorPos = anchor.position();
            const anchorName = anchor.id();
            const offsetPoint = adjustPosToUnityStage(anchorPos, props.stageRef.current);
            let positionImageSpace = canvasToTransformedImagePos(offsetPoint.x, offsetPoint.y, frame, props.layerWidth, props.layerHeight);
            if (frame.spatialReference) {
                positionImageSpace = transformPoint(frame.spatialTransformAST, positionImageSpace, true);
            }

            if (anchorName === "start") {
                region.setControlPoint(0, positionImageSpace);
            } else {
                region.setControlPoint(1, positionImageSpace);
            }
        }
    };

    const handleAnchorDragEnd = () => {
        region.endEditing();
    };

    const secondaryImagePointStart = frame.spatialReference ? transformPoint(frame.spatialTransformAST, region.controlPoints[0], false) : region.controlPoints[0];
    const secondaryImagePointFinish = frame.spatialReference ? transformPoint(frame.spatialTransformAST, region.controlPoints[1], false) : region.controlPoints[1];
    const canvasPosStart = transformedImageToCanvasPos(secondaryImagePointStart, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
    const canvasPosFinish = transformedImageToCanvasPos(secondaryImagePointFinish, frame, props.layerWidth, props.layerHeight, props.stageRef.current);

    const approxPoints = region.getRegionApproximation(frame.wcsInfo);

    const xApproxPoints = approxPoints.xApproximatePoints;
    const yApproxPoints = approxPoints.yApproximatePoints;
    const hypotenuseApproxPoints = approxPoints.hypotenuseApproximatePoints;
    const xPointArray = Array<number>(xApproxPoints.length);
    const yPointArray = Array<number>(yApproxPoints.length);
    const hypotenusePointArray = Array<number>(hypotenuseApproxPoints.length);

    for (let i = 0; i < xPointArray.length; i += 2) {
        const point = transformedImageToCanvasPos({x: xApproxPoints[i], y: xApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
        xPointArray[i] = point.x;
        xPointArray[i + 1] = point.y;
    }

    for (let i = 0; i < yPointArray.length; i += 2) {
        const point = transformedImageToCanvasPos({x: yApproxPoints[i], y: yApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
        yPointArray[i] = point.x;
        yPointArray[i + 1] = point.y;
    }

    for (let i = 0; i < hypotenusePointArray.length; i += 2) {
        const point = transformedImageToCanvasPos({x: hypotenuseApproxPoints[i], y: hypotenuseApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
        hypotenusePointArray[i] = point.x;
        hypotenusePointArray[i + 1] = point.y;
    }

    const centerPoints = midpoint2D({x: xPointArray[xPointArray.length - 2], y: xPointArray[xPointArray.length - 1]}, {x: yPointArray[yPointArray.length - 2], y: yPointArray[yPointArray.length - 1]});
    const distance = AST.geodesicDistance(frame.wcsInfo, xPointArray[xPointArray.length - 2], xPointArray[xPointArray.length - 1], yPointArray[yPointArray.length - 2], yPointArray[yPointArray.length - 1]);
    const distanceText: string = ((distance * 180.0) / Math.PI).toString() + "\u00B0";

    // trigger re-render when exporting images
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const imageRatio = AppStore.Instance.imageRatio;

    return (
        <>
            <Group ref={shapeRef} listening={!region.locked} draggable onClick={handleClick} onDblClick={handleDoubleClick} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragMove={handleDrag}>
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
                    points={hypotenusePointArray}
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
                    points={xPointArray}
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
                />
                <Text
                    x={centerPoints.x}
                    y={centerPoints.y}
                    text={distanceText}
                    stroke={region.color}
                    fill={region.color}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
                    fontSize={region.fontSize}
                />
                <Group>
                    {props.selected && (
                        <>
                            <Anchor
                                anchor={"start"}
                                x={canvasPosStart.x}
                                y={canvasPosStart.y}
                                rotation={0}
                                isRotator={false}
                                onMouseEnter={handleAnchorMouseEnter}
                                onMouseOut={handleAnchorMouseOut}
                                onDragStart={handleAnchorDragStart}
                                onDragEnd={handleAnchorDragEnd}
                                onDragMove={handleAnchorDrag}
                            />
                            <Anchor
                                anchor={"finish"}
                                x={canvasPosFinish.x}
                                y={canvasPosFinish.y}
                                rotation={0}
                                isRotator={false}
                                onMouseEnter={handleAnchorMouseEnter}
                                onMouseOut={handleAnchorMouseOut}
                                onDragStart={handleAnchorDragStart}
                                onDragEnd={handleAnchorDragEnd}
                                onDragMove={handleAnchorDrag}
                            />
                        </>
                    )}
                </Group>
            </Group>
        </>
    );
};
