import {type FrameView, type Point2D} from "models";
import {type FrameStore} from "stores/Frame";

export function getDestinationFrameView(frame: FrameStore): FrameView | null {
    return frame.spatialReference ? frame.spatialReference.requiredFrameView : frame.requiredFrameView;
}

export function createImageToCanvasMapper(frameView: FrameView, layerWidth: number, layerHeight: number): (imagePoint: Point2D) => Point2D {
    const scaleX = layerWidth / (frameView.xMax - frameView.xMin);
    const scaleY = layerHeight / (frameView.yMax - frameView.yMin);
    const canvasPoint = {x: 0, y: 0};
    // The returned point is borrowed and reused; callers must consume or copy its coordinates immediately.
    return imagePoint => {
        canvasPoint.x = (imagePoint.x - frameView.xMin) * scaleX;
        canvasPoint.y = layerHeight - (imagePoint.y - frameView.yMin) * scaleY;
        return canvasPoint;
    };
}

export function createOverlayPointTransform(sourceFrame: FrameStore, destinationFrame: FrameStore, isCatalog = false): (point: Point2D) => Point2D | null {
    const catalogMap = isCatalog && sourceFrame !== destinationFrame ? sourceFrame.getCatalogControlMap(destinationFrame) : null;
    catalogMap?.updateCatalogBoundary();
    const controlMap = sourceFrame !== destinationFrame ? (catalogMap ?? sourceFrame.getControlMap(destinationFrame)) : null;
    const mappedScratch = {x: 0, y: 0};
    return point => {
        const mapped = controlMap ? controlMap.transformPoint(point, mappedScratch) : point;
        return mapped && destinationFrame.spatialReference ? (destinationFrame.spatialTransform?.transformCoordinate(mapped, true) ?? null) : mapped;
    };
}
