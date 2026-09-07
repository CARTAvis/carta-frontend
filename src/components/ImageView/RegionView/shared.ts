import {type FrameView, type Point2D, type Transform2D} from "models";
import {type FrameStore, type ZoomAxis} from "stores/Frame";
import {getInterpolatedPathAtDistance, rotate2D, scale2D} from "utilities";

export function getEffectiveZoomLevel(frame: FrameStore): Point2D {
    return (frame.spatialReference ?? frame).effectiveZoomLevel;
}

function getStageScale(stage: any): Point2D {
    return {x: stage?.scaleX() ?? 1, y: stage?.scaleY() ?? 1};
}

export function getZoomInvariantCanvasTransform(stage: any, rotation: number = 0) {
    const stageScale = getStageScale(stage);
    const inverseScaleX = 1 / stageScale.x;
    const inverseScaleY = 1 / stageScale.y;
    const angle = (rotation * Math.PI) / 180.0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const scaleX = inverseScaleX * cos * cos + inverseScaleY * sin * sin;
    const scaleY = inverseScaleX * sin * sin + inverseScaleY * cos * cos;
    const skew = (inverseScaleY - inverseScaleX) * sin * cos;

    return {scaleX, scaleY, skew};
}

export function getZoomInvariantTransform(stage: any, rotation: number = 0) {
    const {scaleX, scaleY, skew} = getZoomInvariantCanvasTransform(stage, rotation);

    return {scaleX, scaleY, skewX: skew / scaleY || 0, skewY: skew / scaleX || 0};
}

export function getZoomInvariantCanvasOffset(offset: Point2D, stage: any, rotation: number = 0): Point2D {
    const stageScale = getStageScale(stage);
    const rotatedOffset = rotate2D(offset, (rotation * Math.PI) / 180.0);
    return {x: rotatedOffset.x / stageScale.x, y: rotatedOffset.y / stageScale.y};
}

export function getDirectionalStageScale(points: number[], stage: any): {along: number; across: number} {
    const stageScale = getStageScale(stage);
    if (points.length < 4) {
        return {along: Math.abs(stageScale.x), across: Math.abs(stageScale.y)};
    }

    const delta = {x: points[points.length - 2] - points[points.length - 4], y: points[points.length - 1] - points[points.length - 3]};
    const length = Math.hypot(delta.x, delta.y);
    if (!length) {
        return {along: Math.abs(stageScale.x), across: Math.abs(stageScale.y)};
    }

    const direction = {x: delta.x / length, y: delta.y / length};
    return {
        along: Math.hypot(stageScale.x * direction.x, stageScale.y * direction.y),
        across: Math.hypot(stageScale.x * direction.y, stageScale.y * direction.x)
    };
}

export function getScreenDistance(start: Point2D, end: Point2D, stage: any): number {
    const stageScale = getStageScale(stage);
    return Math.hypot((end.x - start.x) * stageScale.x, (end.y - start.y) * stageScale.y);
}

export function getCanvasPathAtScreenDistance(start: Point2D, points: Point2D[], distance: number, stage: any): Point2D[] {
    const stageScale = getStageScale(stage);
    const toScreen = (point: Point2D): Point2D => ({x: point.x * stageScale.x, y: point.y * stageScale.y});
    return getInterpolatedPathAtDistance(toScreen(start), points.map(toScreen), distance).map(point => ({x: point.x / stageScale.x, y: point.y / stageScale.y}));
}

export function getZoomAxisForWheel(frame: FrameStore, isShiftKeyPressed: boolean): ZoomAxis | undefined {
    if (!frame.isAxisZoomable) {
        return undefined;
    }
    return isShiftKeyPressed ? (frame.zoomAxis === "x" ? "y" : "x") : frame.zoomAxis;
}

export function getWheelDelta(event: Pick<WheelEvent, "deltaX" | "deltaY" | "shiftKey">): number {
    return event.shiftKey && event.deltaY === 0 ? event.deltaX : event.deltaY;
}

export function canvasToImagePos(canvasX: number, canvasY: number, frameView: FrameView, layerWidth: number, layerHeight: number, spatialTransform: Transform2D | undefined = undefined): Point2D {
    let offset = {x: 0.0, y: 0.0};
    if (spatialTransform) {
        offset = scale2D(rotate2D(offset, spatialTransform.rotation), spatialTransform.scale);
    }
    return {
        x: (canvasX / layerWidth) * (frameView.xMax - frameView.xMin) + frameView.xMin - offset.x,
        // y coordinate is flipped in image space
        y: (canvasY / layerHeight) * (frameView.yMin - frameView.yMax) + frameView.yMax - offset.y
    };
}

export function imageToCanvasPos(imageX: number, imageY: number, frameView: FrameView, layerWidth: number, layerHeight: number, spatialTransform: Transform2D | undefined = undefined): Point2D {
    const viewWidth = frameView.xMax - frameView.xMin;
    const viewHeight = frameView.yMax - frameView.yMin;
    return {
        x: ((imageX - frameView.xMin) / viewWidth) * layerWidth,
        y: layerHeight - ((imageY - frameView.yMin) / viewHeight) * layerHeight
    };
}

export function canvasToTransformedImagePos(canvasX: number, canvasY: number, frame: FrameStore, layerWidth: number, layerHeight: number) {
    const frameView = frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
    let imagePos = canvasToImagePos(canvasX, canvasY, frameView, layerWidth, layerHeight, frame.spatialTransform ?? undefined);

    if (frame.spatialReference && frame.spatialTransform) {
        imagePos = frame.spatialTransform.transformCoordinate(imagePos, false);
    }
    return imagePos;
}

export function transformedImageToCanvasPos(imagePos: Point2D, frame: FrameStore, layerWidth: number, layerHeight: number, stage: any): Point2D {
    const origin = stage?.getPosition();
    const zoom = {x: stage?.scaleX(), y: stage?.scaleY()};
    if (origin && isFinite(zoom.x) && isFinite(zoom.y)) {
        let canvasPos;
        if (frame.spatialReference && frame.spatialTransform) {
            const transformtedImagePos = frame.spatialTransform.transformCoordinate(imagePos, true);
            const frameView = origin.x === 0 && origin.y === 0 && zoom.x === 1 && zoom.y === 1 ? frame.spatialReference.unitFrameView : frame.spatialReference.requiredFrameViewForRegionRender;
            canvasPos = imageToCanvasPos(transformtedImagePos.x, transformtedImagePos.y, frameView, layerWidth, layerHeight);
        } else {
            const frameView = origin.x === 0 && origin.y === 0 && zoom.x === 1 && zoom.y === 1 ? frame.unitFrameView : frame.requiredFrameViewForRegionRender;
            canvasPos = imageToCanvasPos(imagePos.x, imagePos.y, frameView, layerWidth, layerHeight);
        }
        if (canvasPos) {
            return {x: (canvasPos.x - origin.x) / zoom.x, y: (canvasPos.y - origin.y) / zoom.y};
        }
    }
    return {x: 0, y: 0};
}

// Adjust the position in the stage of {origin: o', scale: z'} to the stage of {origin: (0, 0), scale: 1}.
// If (x, y) in stage {origin: (0, 0), scale: 1} and (x', y') in stage {origin: o', scale: z'} are the same point,
// the coordinate transformation between (x, y) and (x', y') would be x * 1 + 0 = x' * z' + o'
export function adjustPosToUnityStage(pos: Point2D, stage: any): Point2D {
    const origin = stage?.getPosition();
    const zoom = {x: stage?.scaleX(), y: stage?.scaleY()};
    if (pos && origin && isFinite(zoom.x) && isFinite(zoom.y)) {
        return {x: pos.x * zoom.x + origin.x, y: pos.y * zoom.y + origin.y};
    }
    return {x: 0, y: 0};
}

export function adjustPosToMutatedStage(pos: Point2D, stage: any): Point2D {
    const origin = stage?.getPosition();
    const zoom = {x: stage?.scaleX(), y: stage?.scaleY()};
    if (pos && origin && isFinite(zoom.x) && isFinite(zoom.y)) {
        return {x: (pos.x - origin.x) / zoom.x, y: (pos.y - origin.y) / zoom.y};
    }
    return {x: 0, y: 0};
}
