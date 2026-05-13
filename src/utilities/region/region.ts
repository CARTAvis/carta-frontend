import {CARTA} from "carta-protobuf";

import {type Point2D} from "models";
import {type RegionStore} from "stores/Frame";

import {doesLineSegmentIntersectRect, doRectsIntersect, getPathSegments, getRectCorners, getRotatedBoxPoints, isPointInPolygon, isPointInRect, type LineSegment2D, type Rect2D} from "../math2d/math2d";

export function getRegionSelectionPoints(region: RegionStore): Point2D[] {
    if (region.regionType === CARTA.RegionType.POINT || region.regionType === CARTA.RegionType.ANNPOINT) {
        return [region.center];
    }

    if (region.isPolygonalRegion || region.isLineLikeRegion) {
        return region.controlPoints;
    }

    const rotation = (region.rotation * Math.PI) / 180.0;
    if (region.regionType === CARTA.RegionType.ELLIPSE || region.regionType === CARTA.RegionType.ANNELLIPSE) {
        return getRotatedBoxPoints(region.center, region.size.y, region.size.x, rotation);
    }

    const halfWidth = region.size.x / 2;
    const halfHeight = region.size.y / 2;
    return getRotatedBoxPoints(region.center, halfWidth, halfHeight, rotation);
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

export function doSelectionRectAndRulerPathsIntersect(selectionRect: Rect2D, paths: Point2D[][], auxiliaryLineVisible: boolean): boolean {
    const segments = paths.flatMap(path => getPathSegments(path));
    if (paths.some(path => path.some(point => isPointInRect(point, selectionRect))) || segments.some(([start, end]) => doesLineSegmentIntersectRect(start, end, selectionRect))) {
        return true;
    }

    if (!auxiliaryLineVisible || paths.length < 3) {
        return false;
    }

    const triangle = [paths[1][0], paths[0][0], paths[2][0]].filter(Boolean);
    return triangle.length === 3 && getRectCorners(selectionRect).some(point => isPointInPolygon(point, triangle));
}

function getBoundingRect(points: Point2D[]): Rect2D {
    const minX = Math.min(...points.map(point => point.x));
    const maxX = Math.max(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y));
    const maxY = Math.max(...points.map(point => point.y));
    return {x: minX, y: minY, width: maxX - minX, height: maxY - minY};
}
