import {FrameView, Point2D, Transform2D} from "models";
import {FrameStore} from "stores";
import {rotate2D, scale2D} from "utilities";

export function canvasToImagePos(canvasX: number, canvasY: number, frameView: FrameView, layerWidth: number, layerHeight: number, spatialTransform: Transform2D = null): Point2D {
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

export function imageToCanvasPos(imageX: number, imageY: number, frameView: FrameView, layerWidth: number, layerHeight: number, spatialTransform: Transform2D = null): Point2D {
    const viewWidth = frameView.xMax - frameView.xMin;
    const viewHeight = frameView.yMax - frameView.yMin;
    return {
        x: ((imageX - frameView.xMin) / viewWidth) * layerWidth,
        y: layerHeight - ((imageY - frameView.yMin) / viewHeight) * layerHeight
    };
}

export function canvasToTransformedImagePos(canvasX: number, canvasY: number, frame: FrameStore, layerWidth: number, layerHeight: number) {
    const frameView = frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
    let imagePos = canvasToImagePos(canvasX, canvasY, frameView, layerWidth, layerHeight, frame.spatialTransform);

    if (frame.spatialReference) {
        imagePos = frame.spatialTransform.transformCoordinate(imagePos, false);
    }
    return imagePos;
}

export function transformedImageToCanvasPos(imageX: number, imageY: number, frame: FrameStore, layerWidth: number, layerHeight: number) {
    let imagePos = {x: imageX, y: imageY};
    if (frame.spatialReference) {
        imagePos = frame.spatialTransform.transformCoordinate(imagePos, true);
        return imageToCanvasPos(imagePos.x, imagePos.y, frame.spatialReference.requiredFrameViewForRegionRender, layerWidth, layerHeight, frame.spatialTransform);
    }

    return imageToCanvasPos(imagePos.x, imagePos.y, frame.requiredFrameViewForRegionRender, layerWidth, layerHeight, frame.spatialTransform);
}

// Adjust the position in the stage of {origin: o', scale: z'} to the stage of {origin: (0, 0), scale: 1}.
// If (x, y) in stage {origin: (0, 0), scale: 1} and (x', y') in stage {origin: o', scale: z'} are the same point,
// the coordinate transformation between (x, y) and (x', y') would be x * 1 + 0 = x' * z' + o'
export function adjustPosToUnityStage(pos: Point2D, stage: any): Point2D {
    const origin = stage?.getPosition();
    const zoom = stage?.scaleX();
    if (pos && isFinite(pos.x) && isFinite(pos.y) && origin && isFinite(origin.x) && isFinite(origin.y) && isFinite(zoom)) {
        return {x: pos.x * zoom + origin.x, y: pos.y * zoom + origin.y};
    }
    return undefined;
}

export function adjustPosToMutatedStage(pos: Point2D, stage: any): Point2D {
    const origin = stage?.getPosition();
    const zoom = stage?.scaleX();
    if (pos && isFinite(pos.x) && isFinite(pos.y) && origin && isFinite(origin.x) && isFinite(origin.y) && isFinite(zoom)) {
        return {x: (pos.x - origin.x) / zoom, y: (pos.y - origin.y) / zoom};
    }
    return undefined;
}
