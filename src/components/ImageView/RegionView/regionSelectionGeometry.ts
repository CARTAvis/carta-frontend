import {CARTA} from "carta-protobuf";

import {type Point2D} from "models";
import {AppStore} from "stores";
import {type CompassAnnotationStore, type FrameStore, type RegionStore, type RulerAnnotationStore} from "stores/Frame";
import {doSelectionRectAndRegionPointsIntersect, doSelectionRectAndRulerPathsIntersect, getInterpolatedPathAtDistance, getRegionSelectionPoints, getRegionSelectionSegments, getRotatedBoxPoints, type Rect2D, transformPoint} from "utilities";

import {transformedImageToCanvasPos} from "./shared";

interface RegionSelectionGeometryContext {
    frame: FrameStore;
    layerWidth: number;
    layerHeight: number;
    stage: any;
}

function imagePointToSelectionCanvas(point: Point2D, context: RegionSelectionGeometryContext): Point2D {
    const {frame, layerWidth, layerHeight, stage} = context;
    const transformedPoint = frame.spatialReference && frame.spatialTransformAST ? transformPoint(frame.spatialTransformAST, point, false) : point;
    return transformedImageToCanvasPos(transformedPoint, frame, layerWidth, layerHeight, stage);
}

function getTextSelectionCanvasPoints(region: RegionStore, context: RegionSelectionGeometryContext): Point2D[] {
    const {frame, layerWidth, layerHeight, stage} = context;
    const zoomLevel = frame.spatialReference?.zoomLevel || frame.zoomLevel;
    const transformScale = frame.spatialTransform?.scale ?? 1;
    const halfWidth = (region.size.x * AppStore.Instance.imageRatio) / zoomLevel / (2 * transformScale);
    const halfHeight = (region.size.y * AppStore.Instance.imageRatio) / zoomLevel / (2 * transformScale);
    const rotation = (region.rotation * Math.PI) / 180.0;
    const center = frame.spatialReference && frame.spatialTransformAST ? transformPoint(frame.spatialTransformAST, region.center, false) : region.center;
    return getRotatedBoxPoints(center, halfWidth, halfHeight, rotation).map(point => transformedImageToCanvasPos(point, frame, layerWidth, layerHeight, stage));
}

function getCompassSelectionCanvasPoints(region: CompassAnnotationStore, context: RegionSelectionGeometryContext): Point2D[] {
    const {frame, layerWidth, layerHeight, stage} = context;
    const controlPoint = frame.spatialReference && frame.spatialTransformAST ? transformPoint(frame.spatialTransformAST, region.controlPoints[0], false) : region.controlPoints[0];
    const originPoint = transformedImageToCanvasPos(controlPoint, frame, layerWidth, layerHeight, stage);
    const zoomLevel = frame.spatialReference?.zoomLevel || frame.zoomLevel;
    const targetStageLength = (region.length * AppStore.Instance.imageRatio) / zoomLevel;

    if (!frame.validWcs) {
        return [originPoint, {x: originPoint.x, y: originPoint.y - targetStageLength}, {x: originPoint.x - targetStageLength, y: originPoint.y}];
    }

    const getCompassEndpoint = (approxPoints: number[]): Point2D => {
        const canvasPoints: Point2D[] = [];

        for (let i = 0; i < approxPoints.length; i += 2) {
            canvasPoints.push(transformedImageToCanvasPos({x: approxPoints[i], y: approxPoints[i + 1]}, frame, layerWidth, layerHeight, stage));
        }

        const path = getInterpolatedPathAtDistance(originPoint, canvasPoints, targetStageLength);
        return path[path.length - 1];
    };

    const approxPoints = region.getCompassApproximation(frame.wcsInfoForTransformation, !!frame.spatialReference, frame.spatialTransformAST || undefined);
    return [originPoint, getCompassEndpoint(approxPoints.northApproximatePoints), getCompassEndpoint(approxPoints.eastApproximatePoints)];
}

function getRulerSelectionCanvasPaths(region: RulerAnnotationStore, context: RegionSelectionGeometryContext): Point2D[][] {
    const {frame, layerWidth, layerHeight, stage} = context;
    const wcsInfoSelected = frame.isOffsetCoord ? frame.wcsInfoOffset : frame.wcsInfoForTransformation;
    const wcsInfo = frame.validWcs && AppStore.Instance.overlaySettings.isWcsCoordinates ? wcsInfoSelected : frame.wcsInfo;
    const approxPoints = region.getCurveApproximation(wcsInfo, frame.spatialTransformAST || undefined);
    const toCanvasPath = (points: number[]): Point2D[] => {
        const canvasPoints: Point2D[] = [];
        for (let i = 0; i < points.length; i += 2) {
            canvasPoints.push(transformedImageToCanvasPos({x: points[i], y: points[i + 1]}, frame, layerWidth, layerHeight, stage));
        }
        return canvasPoints;
    };

    const paths = [toCanvasPath(approxPoints.hypotenuseApproximatePoints)];
    if (region.auxiliaryLineVisible) {
        paths.push(toCanvasPath(approxPoints.xApproximatePoints), toCanvasPath(approxPoints.yApproximatePoints));
    }
    return paths;
}

function getSelectionCanvasPoints(region: RegionStore, context: RegionSelectionGeometryContext): Point2D[] {
    if (region.regionType === CARTA.RegionType.ANNCOMPASS) {
        return getCompassSelectionCanvasPoints(region as CompassAnnotationStore, context);
    }

    if (region.regionType === CARTA.RegionType.ANNTEXT) {
        return getTextSelectionCanvasPoints(region, context);
    }

    return getRegionSelectionPoints(region).map(point => imagePointToSelectionCanvas(point, context));
}

export function isRegionInSelectionRect(region: RegionStore, selectionRect: Rect2D, context: RegionSelectionGeometryContext): boolean {
    if (region.regionType === CARTA.RegionType.ANNRULER) {
        const ruler = region as RulerAnnotationStore;
        const paths = getRulerSelectionCanvasPaths(ruler, context);
        return doSelectionRectAndRulerPathsIntersect(selectionRect, paths, ruler.auxiliaryLineVisible);
    }

    const points = getSelectionCanvasPoints(region, context);
    const segments = getRegionSelectionSegments(region, points);
    return doSelectionRectAndRegionPointsIntersect(selectionRect, points, segments);
}
