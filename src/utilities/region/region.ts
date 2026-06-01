import type * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";

import {RegionOpacity} from "enums";
import {type Point2D, Transform2D} from "models";
import {type RegionStore} from "stores/Frame";
import {isAstBadPoint, scale2D, toFixed, transformPoint} from "utilities";

import {doesLineSegmentIntersectRect, doRectsIntersect, getPathSegments, getRectCorners, getRotatedBoxPoints, isPointInPolygon, isPointInRect, length2D, type LineSegment2D, type Rect2D, subtract2D} from "../math2d/math2d";

const CENTER_POINT_INDEX = 0;
const SIZE_POINT_INDEX = 1;

export function getNextRegionOpacity(current: RegionOpacity): RegionOpacity {
    switch (current) {
        case RegionOpacity.Visible:
            return RegionOpacity.SemiTransparent;
        case RegionOpacity.SemiTransparent:
            return RegionOpacity.Invisible;
        default:
            return RegionOpacity.Visible;
    }
}

export interface RegionTransformSource {
    regionType: CARTA.RegionType;
    center: Point2D;
    size: Point2D;
    controlPoints: Point2D[];
    rotation: number;
}

export function getRegionPixelProperties(regionType: CARTA.RegionType, controlPoints: Point2D[], rotation: number): string {
    const point = controlPoints[CENTER_POINT_INDEX];
    const center = isFinite(point.x) && isFinite(point.y) ? `${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix` : "Invalid";

    switch (regionType) {
        case CARTA.RegionType.POINT:
            return `Point (pixel) [${center}]`;
        case CARTA.RegionType.LINE:
            let lineProperties = "Line (pixel) [";
            controlPoints.forEach((point, index) => {
                lineProperties += getPointPixelString(point);
                lineProperties += index !== controlPoints.length - 1 ? ", " : "]";
            });
            return lineProperties;
        case CARTA.RegionType.RECTANGLE: {
            const size = getSizePixelString(controlPoints[SIZE_POINT_INDEX]);
            return `rotbox[[${center}], [${size}], ${toFixed(rotation, 6)}deg]`;
        }
        case CARTA.RegionType.ELLIPSE: {
            const size = getSizePixelString(controlPoints[SIZE_POINT_INDEX]);
            return `ellipse[[${center}], [${size}], ${toFixed(rotation, 6)}deg]`;
        }
        case CARTA.RegionType.POLYGON:
            let polygonProperties = "poly[";
            controlPoints.forEach((point, index) => {
                polygonProperties += getPointPixelString(point);
                polygonProperties += index !== controlPoints.length - 1 ? ", " : "]";
            });
            return polygonProperties;
        case CARTA.RegionType.POLYLINE:
            let polylineProperties = "Polyline (pixel) [";
            controlPoints.forEach((point, index) => {
                polylineProperties += getPointPixelString(point);
                polylineProperties += index !== controlPoints.length - 1 ? ", " : "]";
            });
            return polylineProperties;
        default:
            return "Not Implemented";
    }
}

export function getTransformedRegionProperties(region: RegionTransformSource, spatialTransformAST: AST.Mapping): {controlPoints: Point2D[]; rotation: number} {
    switch (region.regionType) {
        case CARTA.RegionType.RECTANGLE:
        case CARTA.RegionType.ELLIPSE:
        case CARTA.RegionType.ANNRECTANGLE:
        case CARTA.RegionType.ANNELLIPSE:
        case CARTA.RegionType.ANNTEXT: {
            const center = transformPoint(spatialTransformAST, region.center, false);
            if (isAstBadPoint(center)) {
                return {controlPoints: [center, region.size], rotation: region.rotation};
            }

            const transform = new Transform2D(spatialTransformAST, center);
            return {
                controlPoints: [center, scale2D(region.size, 1.0 / transform.scale)],
                rotation: region.rotation - (transform.rotation * 180) / Math.PI
            };
        }
        default:
            return {
                controlPoints: region.controlPoints.map(point => transformPoint(spatialTransformAST, point, false)),
                rotation: region.rotation
            };
    }
}

function getPointPixelString(point: Point2D): string {
    return isFinite(point.x) && isFinite(point.y) ? `[${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix]` : "[Invalid]";
}

function getSizePixelString(point: Point2D): string {
    return `${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix`;
}

export function getRegionSelectionPoints(region: RegionStore): Point2D[] {
    if (region.regionType === CARTA.RegionType.POINT || region.regionType === CARTA.RegionType.ANNPOINT) {
        return [region.center];
    }

    if (region.isPolygonalRegion || region.isLineLikeRegion) {
        return region.controlPoints;
    }

    const rotation = (region.rotation * Math.PI) / 180.0;
    if (region.regionType === CARTA.RegionType.ELLIPSE || region.regionType === CARTA.RegionType.ANNELLIPSE) {
        // Ellipse size stores semi-major in y and semi-minor in x.
        return getRotatedBoxPoints(region.center, region.size.y, region.size.x, rotation);
    }

    const halfWidth = region.size.x / 2;
    const halfHeight = region.size.y / 2;
    return getRotatedBoxPoints(region.center, halfWidth, halfHeight, rotation);
}

export function getInterpolatedPathAtDistance(origin: Point2D, points: Point2D[], targetDistance: number): Point2D[] {
    const path = [origin];
    let previousPoint = origin;
    let previousDistance = 0;

    for (const point of points) {
        const distance = length2D(subtract2D(point, origin));

        if (distance >= targetDistance) {
            const segmentLength = distance - previousDistance;
            const ratio = segmentLength > 0 ? (targetDistance - previousDistance) / segmentLength : 0;
            path.push({
                x: previousPoint.x + (point.x - previousPoint.x) * ratio,
                y: previousPoint.y + (point.y - previousPoint.y) * ratio
            });
            return path;
        }

        path.push(point);
        previousPoint = point;
        previousDistance = distance;
    }

    return path;
}

export function getRegionSelectionSegments(region: RegionStore, points: Point2D[]): LineSegment2D[] {
    if (region.regionType === CARTA.RegionType.ANNCOMPASS && points.length >= 3) {
        return [
            [points[0], points[1]],
            [points[0], points[2]]
        ];
    }

    if (region.isLineLikeRegion) {
        return getPathSegments(points);
    }

    if (region.isPolygonalRegion) {
        const isClosed = region.regionType === CARTA.RegionType.POLYGON || region.regionType === CARTA.RegionType.ANNPOLYGON;
        return getPathSegments(points, isClosed);
    }

    if (region.isSimpleShapeRegion) {
        return getPathSegments(points, true);
    }

    return [];
}

export function doSelectionRectAndRegionPointsIntersect(selectionRect: Rect2D, points: Point2D[], segments: LineSegment2D[]): boolean {
    if (points.some(point => isPointInRect(point, selectionRect))) {
        return true;
    }

    if (segments.length) {
        return segments.some(([start, end]) => doesLineSegmentIntersectRect(start, end, selectionRect));
    }

    return doRectsIntersect(selectionRect, getBoundingRect(points));
}

export function doSelectionRectAndRulerPathsIntersect(selectionRect: Rect2D, paths: Point2D[][], isAuxiliaryLineVisible: boolean): boolean {
    const segments = paths.flatMap(path => getPathSegments(path));
    if (paths.some(path => path.some(point => isPointInRect(point, selectionRect))) || segments.some(([start, end]) => doesLineSegmentIntersectRect(start, end, selectionRect))) {
        return true;
    }

    if (!isAuxiliaryLineVisible || paths.length < 3) {
        return false;
    }

    const triangle = [paths[1][0], paths[0][0], paths[2][0]].filter(Boolean);
    return triangle.length === 3 && getRectCorners(selectionRect).some(point => isPointInPolygon(point, triangle));
}

function getBoundingRect(points: Point2D[]): Rect2D {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of points) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }
    return {x: minX, y: minY, width: maxX - minX, height: maxY - minY};
}
