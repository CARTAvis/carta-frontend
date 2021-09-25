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

// Adjust the position in the stage of {origin: stageOrigin, scale stageZoom} to the stage of {origin: (0, 0), scale: 1},
// Coordinate transformation between {origin: (0, 0), scale: 1} & {origin: o', scale: z'}:
// x * 1 + 0 = x' * z' + o'
export function adjustPosToUnityStage(pos: Point2D, stageOrigin: Point2D, stageZoom: number): Point2D {
    return {x: pos.x * stageZoom + stageOrigin.x, y: pos.y * stageZoom + stageOrigin.y};;
}

export function adjustPosToMutatedStage(pos: Point2D, stageOrigin: Point2D, stageZoom: number): Point2D {
    return {x: (pos.x - stageOrigin.x) / stageZoom, y: (pos.y - stageOrigin.y) / stageZoom};
}
