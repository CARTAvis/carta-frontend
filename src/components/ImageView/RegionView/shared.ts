import {FrameView, Point2D, Transform2D} from "models";
import {FrameStore} from "stores";
import {transformPoint, rotate2D, scale2D} from "utilities";

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
        x: ((imageX - frameView.xMin) / viewWidth * layerWidth),
        y: layerHeight - ((imageY - frameView.yMin) / viewHeight * layerHeight)
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
    }

    const frameView = frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
    return imageToCanvasPos(imagePos.x, imagePos.y, frameView, layerWidth, layerHeight, frame.spatialTransform);
}

export function getUpdatedPosition(currentPositionImageSpace: Point2D, newPositionPixelSpace: Point2D, zoomLevel: number, frame: FrameStore, layerWidth: number, layerHeight: number) {
    if (frame.spatialReference) {
        // Current position: ref space -> secondary space -> transformed space -> pixel space
        currentPositionImageSpace = transformPoint(frame.spatialTransformAST, currentPositionImageSpace, false);
        const transformedPosition = frame.spatialTransform.transformCoordinate(currentPositionImageSpace, true);
        const currentPositionPixelSpace = imageToCanvasPos(transformedPosition.x, transformedPosition.y, frame.spatialReference.requiredFrameView, layerWidth, layerHeight, frame.spatialTransform);

        // Update position in transformed space
        const deltaPositionImageSpace = {x: (newPositionPixelSpace.x - currentPositionPixelSpace.x) / zoomLevel, y: -(newPositionPixelSpace.y - currentPositionPixelSpace.y) / zoomLevel};
        let newPosition = {x: transformedPosition.x + deltaPositionImageSpace.x, y: transformedPosition.y + deltaPositionImageSpace.y};

        // New position: transformed space -> secondary space -> ref space
        newPosition = frame.spatialTransform.transformCoordinate(newPosition, false);
        return transformPoint(frame.spatialTransformAST, newPosition, true);
    } else {
        // As above, but go straight from ref space -> pixel space
        const currentPositionPixelSpace = imageToCanvasPos(currentPositionImageSpace.x, currentPositionImageSpace.y, frame.requiredFrameView, layerWidth, layerHeight, frame.spatialTransform);
        const deltaPositionImageSpace = {x: (newPositionPixelSpace.x - currentPositionPixelSpace.x) / zoomLevel, y: -(newPositionPixelSpace.y - currentPositionPixelSpace.y) / zoomLevel};
        return {x: currentPositionImageSpace.x + deltaPositionImageSpace.x, y: currentPositionImageSpace.y + deltaPositionImageSpace.y};
    }
}