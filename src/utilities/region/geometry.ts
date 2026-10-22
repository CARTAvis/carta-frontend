import {type FrameView, type Point2D} from "models";

export function imageToCanvasPos(imageX: number, imageY: number, frameView: FrameView, layerWidth: number, layerHeight: number): Point2D {
    return {x: ((imageX - frameView.xMin) / (frameView.xMax - frameView.xMin)) * layerWidth, y: layerHeight - ((imageY - frameView.yMin) / (frameView.yMax - frameView.yMin)) * layerHeight};
}

export function imageSizeToCanvas(sizeX: number, sizeY: number, frameView: FrameView, layerWidth: number, layerHeight: number): Point2D {
    return {x: (sizeX / (frameView.xMax - frameView.xMin)) * layerWidth, y: (sizeY / (frameView.yMax - frameView.yMin)) * layerHeight};
}

/** Principal axes after rotating an ellipse and then scaling its screen axes. */
export function getScaledEllipseAxes(rx: number, ry: number, rotationDegrees: number, scale: Point2D) {
    const theta = (rotationDegrees * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const xx = scale.x ** 2 * ((rx * cos) ** 2 + (ry * sin) ** 2);
    const yy = scale.y ** 2 * ((rx * sin) ** 2 + (ry * cos) ** 2);
    const xy = scale.x * scale.y * (rx ** 2 - ry ** 2) * cos * sin;
    const difference = Math.hypot(xx - yy, 2 * xy);
    return {
        rx: Math.sqrt((xx + yy + difference) / 2),
        ry: Math.sqrt(Math.max(0, (xx + yy - difference) / 2)),
        rotation: (Math.atan2(2 * xy, xx - yy) * 90) / Math.PI
    };
}
