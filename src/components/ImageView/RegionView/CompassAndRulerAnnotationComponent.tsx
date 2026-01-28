import React from "react";
import {Arrow, Group, Line, Text} from "react-konva";
import * as AST from "ast_wrapper";
import Konva from "konva";
import {observer} from "mobx-react";

import {Point2D} from "models";
import {AppStore} from "stores";
import {CompassAnnotationStore, FrameStore, RegionStore, RulerAnnotationStore} from "stores/Frame";
import {add2D, pointDistance, subtract2D, transformPoint} from "utilities";

import {Anchor} from "./InvariantShapes";
import {adjustPosToUnityStage, canvasToTransformedImagePos, transformedImageToCanvasPos} from "./shared";

interface CompassRulerAnnotationProps {
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

const NEW_ANCHOR_MAX_DISTANCE = 16;

export const CompassAnnotation = observer((props: CompassRulerAnnotationProps) => {
    const shapeRef = React.useRef();
    const northLabelRef = React.useRef<Konva.Text>();
    const eastLabelRef = React.useRef<Konva.Text>();
    const frame = props.frame;
    const region = props.region as CompassAnnotationStore;
    const mousePoint = React.useRef({x: 0, y: 0});

    const handleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        props.onSelect(region);
    };

    const handleDoubleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
        props.onDoubleClick(region);
    };

    const handleDragStart = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        if (konvaEvent.target) {
            props.onSelect?.(props.region);
            props.region.beginEditing();
            mousePoint.current = konvaEvent.currentTarget.position();
        }
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
            const newPoints = region.controlPoints.map((p, i) => (i === 0 ? add2D(p, deltaPosition) : p));
            region.setControlPoints(newPoints, false, false);
            mousePoint.current = konvaEvent.target.position();
        }
    };

    const handleAnchorMouseEnter = (konvaEvent: Konva.KonvaEventObject<MouseEvent>) => {
        const target = konvaEvent.target;
        const stage = target?.getStage();
        if (stage) {
            if (target.id().includes("origin")) {
                stage.container().style.cursor = "move";
            } else if (target.id().includes("eastTip")) {
                stage.container().style.cursor = "ew-resize";
            } else if (target.id().includes("northTip")) {
                stage.container().style.cursor = "ns-resize";
            }
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
            const controlPoint = frame.spatialReference ? transformPoint(frame.spatialTransformAST, region.controlPoints[0], false) : region.controlPoints[0];
            const originPoints = transformedImageToCanvasPos(controlPoint, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
            const distance = pointDistance(anchorPos, originPoints);

            if (frame.spatialReference) {
                positionImageSpace = transformPoint(frame.spatialTransformAST, positionImageSpace, true);
            }

            if (anchor.id() === "origin") {
                region.setControlPoint(0, positionImageSpace);
            } else if (anchor.id() === "northTip" || anchor.id() === "eastTip") {
                if (!frame.validWcs) {
                    region.setLength((distance * frame.zoomLevel) / imageRatio);
                } else {
                    region.setLength((distance * (frame.spatialReference?.zoomLevel || frame.zoomLevel)) / imageRatio);
                }
            }
        }
    };

    const handleAnchorDragEnd = () => {
        region.endEditing();
    };

    const imageRatio = AppStore.Instance.imageRatio;
    const zoomLevel = frame.spatialReference?.zoomLevel || frame.zoomLevel;
    const wcsInfo = frame?.validWcs ? frame.wcsInfoForTransformation : 0;
    const approxPoints = region.getCompassApproximation(wcsInfo, frame.spatialReference ? true : false, frame.spatialTransformAST);
    const northApproxPoints = approxPoints.northApproximatePoints;
    const eastApproxPoints = approxPoints.eastApproximatePoints;
    const northPointArray = [];
    const eastPointArray = [];
    const controlPoint = frame.spatialReference ? transformPoint(frame.spatialTransformAST, region.controlPoints[0], false) : region.controlPoints[0];
    const originPoints = transformedImageToCanvasPos(controlPoint, frame, props.layerWidth, props.layerHeight, props.stageRef.current);

    if (!frame.validWcs) {
        const originX = originPoints.x - mousePoint.current.x;
        const originY = originPoints.y - mousePoint.current.y;
        const compassStageLength = (region.length * imageRatio) / zoomLevel;

        northPointArray.push(originX, originY, originX, originY - compassStageLength);
        eastPointArray.push(originX, originY, originX - compassStageLength, originY);
    } else {
        for (let i = 0; i < northApproxPoints.length; i += 2) {
            const point = transformedImageToCanvasPos({x: northApproxPoints[i], y: northApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
            if (pointDistance(point, originPoints) >= (region.length * imageRatio) / zoomLevel) {
                break;
            }
            northPointArray[i] = point.x - mousePoint.current.x;
            northPointArray[i + 1] = point.y - mousePoint.current.y;
        }

        for (let i = 0; i < eastApproxPoints.length; i += 2) {
            const point = transformedImageToCanvasPos({x: eastApproxPoints[i], y: eastApproxPoints[i + 1]}, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
            if (pointDistance(point, originPoints) >= (region.length * imageRatio) / zoomLevel) {
                break;
            }
            eastPointArray[i] = point.x - mousePoint.current.x;
            eastPointArray[i + 1] = point.y - mousePoint.current.y;
        }
    }

    // Dummy variables for triggering re-render
    /* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
    const system = AppStore.Instance.overlaySettings.global.explicitSystem;
    const darktheme = AppStore.Instance.darkTheme;
    const title = frame.titleCustomText;
    const pixelRatio = AppStore.Instance.pixelRatio;
    /* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

    const updateOffset = () => {
        const northDiffX = northPointArray[northPointArray.length - 4] - northPointArray[northPointArray.length - 2];
        const northDiffY = northPointArray[northPointArray.length - 3] - northPointArray[northPointArray.length - 1];
        const eastDiffX = eastPointArray[eastPointArray.length - 4] - eastPointArray[eastPointArray.length - 2];
        const eastDiffY = eastPointArray[eastPointArray.length - 3] - eastPointArray[eastPointArray.length - 1];
        let northAngle = Math.atan(northDiffY / northDiffX);
        let eastAngle = Math.atan(eastDiffY / eastDiffX);

        let northXOffset = northLabelRef?.current?.textWidth / 2;
        let northYOffset = northLabelRef?.current?.textHeight / 2;
        let eastXOffset = eastLabelRef?.current?.textWidth / 2;
        let eastYOffset = eastLabelRef?.current?.textHeight / 2;

        const northTranslation = Math.min(northLabelRef?.current?.textWidth, northLabelRef?.current?.textHeight);
        const eastTranslation = Math.min(eastLabelRef?.current?.textWidth, eastLabelRef?.current?.textHeight);

        if (northDiffX < 0) {
            northAngle += Math.PI;
        }

        if (eastDiffX < 0) {
            eastAngle += Math.PI;
        }

        northXOffset += Math.cos(northAngle) * northTranslation;
        northYOffset += Math.sin(northAngle) * northTranslation;
        eastXOffset += Math.cos(eastAngle) * eastTranslation;
        eastYOffset += Math.sin(eastAngle) * eastTranslation;

        region.setNorthTextOffset((northXOffset * zoomLevel) / imageRatio, true, true);
        region.setNorthTextOffset((northYOffset * zoomLevel) / imageRatio, false, true);
        region.setEastTextOffset((eastXOffset * zoomLevel) / imageRatio, true, true);
        region.setEastTextOffset((eastYOffset * zoomLevel) / imageRatio, false, true);
    };

    React.useEffect(() => {
        updateOffset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const generateProps = (north: boolean) => {
        return {
            stroke: region.color,
            fill: region.color,
            strokeWidth: region.lineWidth,
            strokeScaleEnabled: false,
            opacity: region.isTemporary ? 0.5 : region.locked ? 0.7 : 1,
            dash: [region.dashLength],
            closed: false,
            perfectDrawEnabled: false,
            points: north ? northPointArray : eastPointArray,
            pointerWidth: (region.pointerWidth * imageRatio) / zoomLevel,
            pointerLength: (region.pointerLength * imageRatio) / zoomLevel,
            hitStrokeWidth: NEW_ANCHOR_MAX_DISTANCE * 2
        };
    };

    const textCommonProps = {
        stroke: region.color,
        fill: region.color,
        strokeWidth: (region.lineWidth * imageRatio) / zoomLevel,
        strokeScaleEnabled: false,
        opacity: region.isTemporary ? 0.5 : region.locked ? 0.7 : 1,
        fontSize: (region.fontSize * imageRatio) / zoomLevel,
        fontFamily: region.font,
        fontStyle: region.fontStyle
    };

    const anchorCommonProps = {
        rotation: 0,
        isRotator: false,
        onMouseEnter: handleAnchorMouseEnter,
        onMouseOut: handleAnchorMouseOut,
        onDragStart: handleAnchorDragStart,
        onDragEnd: handleAnchorDragEnd,
        onDragMove: handleAnchorDrag
    };

    return (
        <>
            <Group ref={shapeRef} listening={!region.locked} onClick={handleClick} onDblClick={handleDoubleClick} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragMove={handleDrag}>
                {region.eastArrowhead ? <Arrow {...generateProps(false)} /> : <Line {...generateProps(false)} />}
                {region.northArrowhead ? <Arrow {...generateProps(true)} /> : <Line {...generateProps(true)} />}
                <Text
                    ref={northLabelRef}
                    x={northPointArray[northPointArray.length - 2]}
                    y={northPointArray[northPointArray.length - 1]}
                    offsetX={(region.northTextOffset.x * imageRatio) / zoomLevel}
                    offsetY={(region.northTextOffset.y * imageRatio) / zoomLevel}
                    text={region.northLabel}
                    {...textCommonProps}
                />
                <Text
                    ref={eastLabelRef}
                    x={eastPointArray[eastPointArray.length - 2]}
                    y={eastPointArray[eastPointArray.length - 1]}
                    offsetX={(region.eastTextOffset.x * imageRatio) / zoomLevel}
                    offsetY={(region.eastTextOffset.y * imageRatio) / zoomLevel}
                    text={region.eastLabel}
                    {...textCommonProps}
                />
            </Group>
            <Group>
                {props.selected && (
                    <>
                        <Anchor anchor={"origin"} x={originPoints.x} y={originPoints.y} {...anchorCommonProps} />
                        <Anchor anchor={"northTip"} x={northPointArray[northPointArray.length - 2] + mousePoint.current.x} y={northPointArray[northPointArray.length - 1] + mousePoint.current.y} {...anchorCommonProps} />
                        <Anchor anchor={"eastTip"} x={eastPointArray[eastPointArray.length - 2] + mousePoint.current.x} y={eastPointArray[eastPointArray.length - 1] + mousePoint.current.y} {...anchorCommonProps} />
                    </>
                )}
            </Group>
        </>
    );
});

export const RulerAnnotation = observer((props: CompassRulerAnnotationProps) => {
    const shapeRef = React.useRef();
    const mousePoint = React.useRef({x: 0, y: 0});
    const distanceTextRef = React.useRef<Konva.Text>();
    const xTextRef = React.useRef<Konva.Text>();
    const yTextRef = React.useRef<Konva.Text>();

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
            const transformedOldImagePosition = frame.spatialReference ? frame.spatialTransform.transformCoordinate(oldImagePosition) : oldImagePosition;
            const position = adjustPosToUnityStage(konvaEvent.target.position(), props.stageRef.current);
            const imagePosition = canvasToTransformedImagePos(position.x, position.y, frame, props.layerWidth, props.layerHeight);
            const transformedImagePosition = frame.spatialReference ? frame.spatialTransform.transformCoordinate(imagePosition) : imagePosition;
            const deltaPosition = subtract2D(transformedImagePosition, transformedOldImagePosition);
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

    const getDistanceText = (wcsInfo: AST.FrameSet, start: Point2D, finish: Point2D) => {
        const distance = ((AST.geodesicDistance(wcsInfo, start.x, start.y, finish.x, finish.y) / 3600) * Math.PI) / 180.0;
        const unit = AST.getString(wcsInfo, "Unit(1)");
        let distString: string;
        if (unit.includes("degree") || unit.includes("hh:mm:s")) {
            if (distance < Math.PI / 180.0 / 60.0) {
                distString = (((distance * 180.0) / Math.PI) * 3600.0).toFixed(region.decimals).toString();
                distString += '"';
            } else if (distance < Math.PI / 180.0) {
                distString = (((distance * 180.0) / Math.PI) * 60.0).toFixed(region.decimals).toString();
                distString += "'";
            } else {
                distString = ((distance * 180.0) / Math.PI).toFixed(region.decimals).toString();
                distString += "\u00B0";
            }
        } else {
            distString = distance.toFixed(region.decimals).toString();
            if (unit[0] === "\0" || unit.trim() === "") {
                distString += "pix";
            }
        }
        return distString;
    };

    const imageRatio = AppStore.Instance.imageRatio;
    const zoomLevel = frame.spatialReference?.zoomLevel || frame.zoomLevel;
    const secondaryImagePointStart = frame.spatialReference ? transformPoint(frame.spatialTransformAST, region.controlPoints[0], false) : region.controlPoints[0];
    const secondaryImagePointFinish = frame.spatialReference ? transformPoint(frame.spatialTransformAST, region.controlPoints[1], false) : region.controlPoints[1];
    const canvasPosStart = transformedImageToCanvasPos(secondaryImagePointStart, frame, props.layerWidth, props.layerHeight, props.stageRef.current);
    const canvasPosFinish = transformedImageToCanvasPos(secondaryImagePointFinish, frame, props.layerWidth, props.layerHeight, props.stageRef.current);

    const wcsInfo = frame?.validWcs && AppStore.Instance.overlaySettings.isWcsCoordinates ? frame.wcsInfoForTransformation : frame.wcsInfo; // calculate pixel distance for no valid WCS data images
    const approxPoints = region.getCurveApproximation(wcsInfo, frame.spatialTransformAST);

    const xApproxPoints = approxPoints.xApproximatePoints;
    const yApproxPoints = approxPoints.yApproximatePoints;
    const hypotenuseApproxPoints = approxPoints.hypotenuseApproximatePoints;
    const cornerPoint = approxPoints.corner;
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

    let xCenterPoints, xDistanceText, yCenterPoints, yDistanceText;
    if (region.auxiliaryTextVisible) {
        const xCenterPointIndex = Math.floor(xPointArray.length / 2) % 2 === 0 ? Math.floor(xPointArray.length / 2) : Math.floor(xPointArray.length / 2) + 1;
        xCenterPoints = {x: xPointArray[xCenterPointIndex], y: xPointArray[xCenterPointIndex + 1]};
        xDistanceText = getDistanceText(frame.wcsInfo, secondaryImagePointStart, cornerPoint);

        const yCenterPointIndex = Math.floor(yPointArray.length / 2) % 2 === 0 ? Math.floor(yPointArray.length / 2) : Math.floor(yPointArray.length / 2) + 1;
        yCenterPoints = {x: yPointArray[yCenterPointIndex], y: yPointArray[yCenterPointIndex + 1]};
        yDistanceText = getDistanceText(frame.wcsInfo, cornerPoint, secondaryImagePointFinish);
    }

    const centerPointIndex = Math.floor(hypotenusePointArray.length / 2) % 2 === 0 ? Math.floor(hypotenusePointArray.length / 2) : Math.floor(hypotenusePointArray.length / 2) + 1;
    const centerPoints = {x: hypotenusePointArray[centerPointIndex], y: hypotenusePointArray[centerPointIndex + 1]};
    const distanceText = getDistanceText(frame.wcsInfo, secondaryImagePointStart, secondaryImagePointFinish);

    // Dummy variables for triggering re-render
    /* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
    const system = AppStore.Instance.overlaySettings.global.explicitSystem;
    const darktheme = AppStore.Instance.darkTheme;
    const title = frame.titleCustomText;
    const pixelRatio = AppStore.Instance.pixelRatio;
    /* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

    const [textOffsetX, setTextOffsetX] = React.useState(0);
    const [xTextOffsetX, setXTextOffsetX] = React.useState(0);
    const [yTextOffsetX, setYTextOffsetX] = React.useState(0);

    React.useEffect(() => {
        setTextOffsetX((region.textOffset.x * imageRatio) / zoomLevel + distanceTextRef?.current?.textWidth / 2);
        if (region.auxiliaryTextVisible) {
            setXTextOffsetX((region.xTextOffset.x * imageRatio) / zoomLevel + xTextRef?.current?.textWidth / 2);
            setYTextOffsetX((region.yTextOffset.x * imageRatio) / zoomLevel + yTextRef?.current?.textWidth / 2);
        }
    }, [imageRatio, zoomLevel, region.fontSize, region.decimals, region.textOffset.x, region.auxiliaryTextVisible, region.xTextOffset.x, region.yTextOffset.x]);

    return (
        <>
            <Group
                ref={shapeRef}
                listening={!region.locked}
                draggable
                onClick={handleClick}
                onDblClick={handleDoubleClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragMove={handleDrag}
                hitStrokeWidth={NEW_ANCHOR_MAX_DISTANCE * 2}
            >
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
                    hitStrokeWidth={NEW_ANCHOR_MAX_DISTANCE * 2}
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
                    hitStrokeWidth={NEW_ANCHOR_MAX_DISTANCE * 2}
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
                    hitStrokeWidth={NEW_ANCHOR_MAX_DISTANCE * 2}
                />
                <Text
                    ref={distanceTextRef}
                    x={centerPoints.x}
                    y={centerPoints.y}
                    offsetX={textOffsetX}
                    offsetY={(region.textOffset.y * imageRatio) / zoomLevel}
                    text={distanceText}
                    stroke={region.color}
                    fill={region.color}
                    strokeWidth={(0.5 * imageRatio) / zoomLevel}
                    strokeScaleEnabled={false}
                    opacity={region.isTemporary ? 0.5 : region.locked ? 0.7 : 1}
                    fontSize={(region.fontSize * imageRatio) / zoomLevel}
                    fontFamily={region.font}
                    fontStyle={region.fontStyle}
                />
                {region.auxiliaryTextVisible && (
                    <>
                        <Text
                            ref={xTextRef}
                            x={xCenterPoints.x}
                            y={xCenterPoints.y}
                            offsetX={xTextOffsetX}
                            offsetY={(region.xTextOffset.y * imageRatio) / zoomLevel}
                            text={xDistanceText}
                            stroke={region.color}
                            fill={region.color}
                            strokeWidth={(0.5 * imageRatio) / zoomLevel}
                            strokeScaleEnabled={false}
                            opacity={region.auxiliaryTextVisible ? (region.isTemporary ? 0.5 : region.locked ? 0.7 : 1) : 0}
                            fontSize={(region.fontSize * imageRatio) / zoomLevel}
                            fontFamily={region.font}
                            fontStyle={region.fontStyle}
                        />
                        <Text
                            ref={yTextRef}
                            x={yCenterPoints.x}
                            y={yCenterPoints.y}
                            offsetX={yTextOffsetX}
                            offsetY={(region.yTextOffset.y * imageRatio) / zoomLevel}
                            text={yDistanceText}
                            stroke={region.color}
                            fill={region.color}
                            strokeWidth={(0.5 * imageRatio) / zoomLevel}
                            strokeScaleEnabled={false}
                            opacity={region.auxiliaryTextVisible ? (region.isTemporary ? 0.5 : region.locked ? 0.7 : 1) : 0}
                            fontSize={(region.fontSize * imageRatio) / zoomLevel}
                            fontFamily={region.font}
                            fontStyle={region.fontStyle}
                        />
                    </>
                )}
                {/* This is an invisible shape in the empty area of the region to facilite clicking and dragging. */}
                {region.auxiliaryLineVisible && <Line closed points={[xPointArray[0], xPointArray[1], hypotenusePointArray[0], hypotenusePointArray[1], yPointArray[0], yPointArray[1]]} opacity={0} />}
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
