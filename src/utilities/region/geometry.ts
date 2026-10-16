import {type FrameView, type Point2D} from "models";

export function imageToCanvasPos(imageX: number, imageY: number, frameView: FrameView, layerWidth: number, layerHeight: number): Point2D {
    return {x: ((imageX - frameView.xMin) / (frameView.xMax - frameView.xMin)) * layerWidth, y: layerHeight - ((imageY - frameView.yMin) / (frameView.yMax - frameView.yMin)) * layerHeight};
}

export function imageSizeToCanvas(sizeX: number, sizeY: number, frameView: FrameView, layerWidth: number, layerHeight: number): Point2D {
    return {x: (sizeX / (frameView.xMax - frameView.xMin)) * layerWidth, y: (sizeY / (frameView.yMax - frameView.yMin)) * layerHeight};
}
