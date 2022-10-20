import React from "react";
import {observer} from "mobx-react";
import {Group, Arrow, Text, Line} from "react-konva";
import Konva from "konva";
import * as AST from "ast_wrapper";
import {Anchor} from "./InvariantShapes";
import {AppStore} from "stores";
import {CompassAnnotationStore, FrameStore, RegionStore, RulerAnnotationStore} from "stores/Frame";
import {adjustPosToUnityStage, canvasToTransformedImagePos, transformedImageToCanvasPos} from "./shared";
import {add2D, midpoint2D, pointDistance, subtract2D, transformPoint} from "utilities";

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

export const CompassAnnotation = observer((props: CompassAnnotationProps) => {
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
            props.region.beginEditing();
            mousePoint.current = konvaEvent.currentTarget.position();
            console.log(mousePoint.current);
        }
    };

    const handleDragEnd = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        props.region.endEditing();
    };

    const handleDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            const oldPosition = adjustPosToUnityStage(mousePoint.current, props.stageRef.current);
            const oldImagePosition = canvasToTransformedImagePos(oldPosition.x, oldPosition.y, frame, props.layerWidth, props.layerHeight);
            const position = adjustPosToUnityStage(konvaEvent.currentTarget.position(), props.stageRef.current);
            const imagePosition = canvasToTransformedImagePos(position.x, position.y, frame, props.layerWidth, props.layerHeight);
            const deltaPosition = subtract2D(imagePosition, oldImagePosition);
            const newPoints = region.controlPoints.map(p => add2D(p, deltaPosition));
            region.setControlPoints(newPoints, false, false);
            console.log(newPoints[0]);
            mousePoint.current = konvaEvent.target.position();
        }
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
            const offsetPoint = adjustPosToUnityStage(anchorPos, props.stageRef.current);
            let positionImageSpace = canvasToTransformedImagePos(offsetPoint.x, offsetPoint.y, frame, props.layerWidth, props.layerHeight);

            if (frame.spatialReference) {
                positionImageSpace = transformPoint(frame.spatialTransformAST, positionImageSpace, true);
            }

            if (anchor.id() === "origin") {
                region.setControlPoint(0, positionImageSpace);
            } else if (anchor.id() === "northTip") {
                console.log(region.length, Math.abs(positionImageSpace.y - region.controlPoints[0].y));
                region.setLength(Math.abs(positionImageSpace.y - region.controlPoints[0].y) / region.lengthScale);
            } else if (anchor.id() === "eastTip") {
                console.log(region.length, Math.abs(positionImageSpace.x - region.controlPoints[0].x));
                region.setLength(Math.abs(positionImageSpace.x - region.controlPoints[0].x) / region.lengthScale);
            }
        }
    };

    const handleAnchorDragEnd = () => {
        region.endEditing();
    };

    const approxPoints = region.getRegionApproximation(frame.spatialTransformAST || frame.wcsInfo);
    const northApproxPoints = approxPoints.northApproximatePoints;
    const eastApproxPoints = approxPoints.eastApproximatePoints;
    const northPointArray = [];
    const eastPointArray = [];
    // const northPointArray = new Array<number>(northApproxPoints.length);
    // const eastPointArray = new Array<number>(eastApproxPoints.length);

    const northLength = pointDistance({x: northApproxPoints[northApproxPoints.length - 2], y: northApproxPoints[northApproxPoints.length - 1]}, {x: northApproxPoints[0], y: northApproxPoints[1]});
    const eastLength = pointDistance({x: eastApproxPoints[eastApproxPoints.length - 2], y: eastApproxPoints[eastApproxPoints.length - 1]}, {x: eastApproxPoints[0], y: eastApproxPoints[1]});

    console.log(northApproxPoints, eastApproxPoints);

    for (let i = 0; i < northApproxPoints.length; i += 2) {
        if (
            pointDistance({x: northApproxPoints[i], y: northApproxPoints[i + 1]}, {x: northApproxPoints[0], y: northApproxPoints[1]}) >= region.length * region.lengthScale ||
            pointDistance({x: northApproxPoints[i], y: northApproxPoints[i + 1]}, {x: northApproxPoints[0], y: northApproxPoints[1]}) >= eastLength
        ) {
            //if the north distance is larger than the size of east distance
            break;
        }
        const point = transformedImageToCanvasPos({x: northApproxPoints[i], y: northApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
        northPointArray[i] = point.x - mousePoint.current.x;
        northPointArray[i + 1] = point.y - mousePoint.current.y;
    }

    for (let i = 0; i < eastApproxPoints.length; i += 2) {
        if (
            pointDistance({x: eastApproxPoints[i], y: eastApproxPoints[i + 1]}, {x: eastApproxPoints[0], y: eastApproxPoints[1]}) >= region.length * region.lengthScale ||
            pointDistance({x: eastApproxPoints[i], y: eastApproxPoints[i + 1]}, {x: eastApproxPoints[0], y: eastApproxPoints[1]}) >= northLength
        ) {
            //if the east distance is larger than the size of north distance
            break;
        }
        const point = transformedImageToCanvasPos({x: eastApproxPoints[i], y: eastApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
        eastPointArray[i] = point.x - mousePoint.current.x;
        eastPointArray[i + 1] = point.y - mousePoint.current.y;
    }

    const controlPoint = frame.spatialReference ? transformPoint(frame.spatialTransformAST, region.controlPoints[0], false) : region.controlPoints[0];
    const originPoints = transformedImageToCanvasPos(controlPoint, frame, props.layerWidth, props.layerHeight, props.stageRef.current);

    // Dummy variables for triggering re-render
    /* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
    const imageRatio = AppStore.Instance.imageRatio;
    const system = AppStore.Instance.overlayStore.global.explicitSystem;
    const darktheme = AppStore.Instance.darkTheme;
    const title = frame.titleCustomText;
    // const scale = props.stageRef.current.scaleX();
    /* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

    const scale = React.useRef(frame.zoomLevel); //store the initial frame zoomLevel

    React.useEffect(() => {
        region.setLengthScale((imageRatio * scale.current) / frame.zoomLevel);
    }, [frame.zoomLevel]);

    console.log(region.lengthScale);

    return (
        <>
            <Group ref={shapeRef} listening={!region.locked} draggable onClick={handleClick} onDblClick={handleDoubleClick} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragMove={handleDrag}>
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
                    pointerWidth={region.pointerWidth * region.lengthScale}
                    pointerLength={region.pointerLength * region.lengthScale}
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
                    pointerWidth={region.pointerWidth * region.lengthScale}
                    pointerLength={region.pointerLength * region.lengthScale}
                />
                <Text
                    x={northPointArray[northPointArray.length - 2]}
                    y={northPointArray[northPointArray.length - 1]}
                    offsetX={region.northTextOffset.x}
                    offsetY={region.northTextOffset.y}
                    text={region.northLabel}
                    stroke={region.color}
                    fill={region.color}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
                    fontSize={(region.fontSize * imageRatio) / frame.zoomLevel}
                />
                <Text
                    x={eastPointArray[eastPointArray.length - 2]}
                    y={eastPointArray[eastPointArray.length - 1]}
                    offsetX={region.eastTextOffset.x}
                    offsetY={region.eastTextOffset.y}
                    text={region.eastLabel}
                    stroke={region.color}
                    fill={region.color}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
                    fontSize={(region.fontSize * imageRatio) / frame.zoomLevel}
                />
            </Group>
            <Group>
                {props.selected && (
                    <>
                        <Anchor
                            anchor={"origin"}
                            x={originPoints.x}
                            y={originPoints.y}
                            rotation={0}
                            isRotator={false}
                            onMouseEnter={handleAnchorMouseEnter}
                            onMouseOut={handleAnchorMouseOut}
                            onDragStart={handleAnchorDragStart}
                            onDragEnd={handleAnchorDragEnd}
                            onDragMove={handleAnchorDrag}
                        />
                        <Anchor
                            anchor={"northTip"}
                            x={northPointArray[northPointArray.length - 2] + mousePoint.current.x}
                            y={northPointArray[northPointArray.length - 1] + mousePoint.current.y}
                            rotation={0}
                            isRotator={false}
                            onMouseEnter={handleAnchorMouseEnter}
                            onMouseOut={handleAnchorMouseOut}
                            onDragStart={handleAnchorDragStart}
                            onDragEnd={handleAnchorDragEnd}
                            onDragMove={handleAnchorDrag}
                        />
                        <Anchor
                            anchor={"eastTip"}
                            x={eastPointArray[eastPointArray.length - 2] + mousePoint.current.x}
                            y={eastPointArray[eastPointArray.length - 1] + mousePoint.current.y}
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
        </>
    );
});

export const RulerAnnotation = observer((props: CompassAnnotationProps) => {
    const shapeRef = React.useRef();
    const mousePoint = React.useRef({x: 0, y: 0});

    const frame = props.frame;
    const region = props.region as RulerAnnotationStore;

    const handleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        props.onSelect(region);
    };
    const handleDoubleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        props.onDoubleClick(region);
    };

    const handleDragStart = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        props.onSelect?.(props.region);
        props.region.beginEditing();
        mousePoint.current = konvaEvent.target.position();
    };

    const handleDragEnd = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        props.region.endEditing();
    };

    const handleDrag = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            const oldPosition = adjustPosToUnityStage(mousePoint.current, props.stageRef.current);
            const oldImagePosition = canvasToTransformedImagePos(oldPosition.x, oldPosition.y, frame, props.layerWidth, props.layerHeight);
            const position = adjustPosToUnityStage(konvaEvent.target.position(), props.stageRef.current);
            const imagePosition = canvasToTransformedImagePos(position.x, position.y, frame, props.layerWidth, props.layerHeight);
            const deltaPosition = subtract2D(imagePosition, oldImagePosition);
            const newPoints = region.controlPoints.map(p => add2D(p, deltaPosition));
            region.setControlPoints(newPoints, false, false);
            mousePoint.current = konvaEvent.target.position();
        }
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

    const approxPoints = region.getRegionApproximation(frame.spatialTransformAST || frame.wcsInfo, frame.spatialReference ? true : false);

    const xApproxPoints = approxPoints.xApproximatePoints;
    const yApproxPoints = approxPoints.yApproximatePoints;
    const hypotenuseApproxPoints = approxPoints.hypotenuseApproximatePoints;
    const xPointArray = Array<number>(xApproxPoints.length);
    const yPointArray = Array<number>(yApproxPoints.length);
    const hypotenusePointArray = Array<number>(hypotenuseApproxPoints.length);

    for (let i = 0; i < xPointArray.length; i += 2) {
        const point = transformedImageToCanvasPos({x: xApproxPoints[i], y: xApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
        xPointArray[i] = point.x - mousePoint.current.x;
        xPointArray[i + 1] = point.y - mousePoint.current.y;
    }

    for (let i = 0; i < yPointArray.length; i += 2) {
        const point = transformedImageToCanvasPos({x: yApproxPoints[i], y: yApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
        yPointArray[i] = point.x - mousePoint.current.x;
        yPointArray[i + 1] = point.y - mousePoint.current.y;
    }

    for (let i = 0; i < hypotenusePointArray.length; i += 2) {
        const point = transformedImageToCanvasPos({x: hypotenuseApproxPoints[i], y: hypotenuseApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
        hypotenusePointArray[i] = point.x - mousePoint.current.x;
        hypotenusePointArray[i + 1] = point.y - mousePoint.current.y;
    }

    const centerPoints = midpoint2D({x: hypotenusePointArray[0], y: hypotenusePointArray[1]}, {x: hypotenusePointArray[hypotenusePointArray.length - 2], y: hypotenusePointArray[hypotenusePointArray.length - 1]});
    const distance = AST.geodesicDistance(frame.wcsInfo, secondaryImagePointStart.x, secondaryImagePointStart.y, secondaryImagePointFinish.x, secondaryImagePointFinish.y);
    const distanceText: string = distance.toString() + "\u00B0";

    // Dummy variables for triggering re-render
    /* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
    const imageRatio = AppStore.Instance.imageRatio;
    const system = AppStore.Instance.overlayStore.global.explicitSystem;
    const darktheme = AppStore.Instance.darkTheme;
    const title = frame.titleCustomText;
    /* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

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
                    points={[...hypotenusePointArray, yPointArray[0], yPointArray[1]]} //Connect the lines together
                />
                <Line
                    stroke={region.color}
                    fill={region.color}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.auxiliaryLineVisible ? (region.isTemporary ? 0.5 : region.locked ? 0.7 : 1) : 0}
                    dash={[region.auxiliaryLineDashLength]}
                    closed={false}
                    perfectDrawEnabled={false}
                    lineJoin={"round"}
                    points={[...xPointArray, hypotenusePointArray[0], hypotenusePointArray[1]]} //Connect the lines together
                />
                <Line
                    stroke={region.color}
                    fill={region.color}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.auxiliaryLineVisible ? (region.isTemporary ? 0.5 : region.locked ? 0.7 : 1) : 0}
                    dash={[region.auxiliaryLineDashLength]}
                    closed={false}
                    perfectDrawEnabled={false}
                    lineJoin={"round"}
                    points={[...yPointArray, xPointArray[0], xPointArray[1]]} //Connect the lines together
                />
                <Text
                    x={centerPoints.x}
                    y={centerPoints.y}
                    offsetX={region.textOffset.x}
                    offsetY={region.textOffset.y}
                    text={distanceText}
                    stroke={region.color}
                    fill={region.color}
                    strokeWidth={region.lineWidth}
                    strokeScaleEnabled={false}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
                    fontSize={(region.fontSize * imageRatio) / frame.zoomLevel}
                />
            </Group>
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
        </>
    );
});
