import type {Point2D} from "models";

export function getContourZoomParameters(effectiveZoomLevel: Point2D, frameAspectRatio: number, transformScale: number = 1) {
    return {
        pixelAspectRatio: frameAspectRatio * (effectiveZoomLevel.x / effectiveZoomLevel.y),
        zoomY: effectiveZoomLevel.y * transformScale
    };
}
