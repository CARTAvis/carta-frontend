import {FrameView, Point2D} from "models";

export function canvasToImagePos(canvasX: number, canvasY: number, frameView: FrameView, layerWidth: number, layerHeight: number): Point2D {
    return {
        x: (canvasX / layerWidth) * (frameView.xMax - frameView.xMin) + frameView.xMin - 1,
        // y coordinate is flipped in image space
        y: (canvasY / layerHeight) * (frameView.yMin - frameView.yMax) + frameView.yMax - 1
    };
}

export function imageToCanvasPos(imageX: number, imageY: number, frameView: FrameView, layerWidth: number, layerHeight: number, offset: Point2D = {x: 1.0, y: 1.0}): Point2D {
    const viewWidth = frameView.xMax - frameView.xMin;
    const viewHeight = frameView.yMax - frameView.yMin;
    return {
        x: ((imageX + offset.x - frameView.xMin) / viewWidth * layerWidth),
        y: layerHeight - ((imageY + offset.y - frameView.yMin) / viewHeight * layerHeight)
    };
}