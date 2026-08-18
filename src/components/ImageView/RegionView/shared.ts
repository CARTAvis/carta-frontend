import {type FrameView, type Point2D, type Transform2D} from "models";
import {type FrameStore, type ZoomAxis} from "stores/Frame";
import {rotate2D, scale2D} from "utilities";

export function getZoomAxisForWheel(frame: FrameStore, isShiftKeyPressed: boolean, isAltKeyPressed: boolean): Exclude<ZoomAxis, "both"> | undefined {
    if (!frame.isAxisZoomable) {
        return undefined;
    }
    if (isShiftKeyPressed || isAltKeyPressed) {
        return isShiftKeyPressed !== isAltKeyPressed ? (isShiftKeyPressed ? "y" : "x") : undefined;
    }
    return frame.zoomAxis === "both" ? undefined : frame.zoomAxis;
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
