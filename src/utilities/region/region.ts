import type * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";

import {PasteOffsetUnit, RegionId, RegionOpacity} from "enums";
import {type Point2D, Transform2D} from "models";
import {type RegionStore} from "stores/Frame";
import {isAstBadPoint, scale2D, toFixed, transformPoint} from "utilities";

import {
    add2D,
    doesLineSegmentIntersectRect,
    doRectsIntersect,
    getPathSegments,
    getRectCorners,
    getRotatedBoxPoints,
    isPointInPolygon,
    isPointInRect,
    length2D,
    type LineSegment2D,
    midpoint2D,
    minMax2D,
    type Rect2D,
    subtract2D
} from "../math2d/math2d";

const CENTER_POINT_INDEX = 0;
const SIZE_POINT_INDEX = 1;
export const PASTE_OFFSET = 20;

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

/** Properties needed to transform a region into a different coordinate frame. */
export interface RegionTransformSource {
    regionType: CARTA.RegionType;
    center: Point2D;
    size: Point2D;
    controlPoints: Point2D[];
    rotation: number;
}

/** Serialisable region data stored on the clipboard for copy-paste operations. */
export interface RegionClipboardData {
    sourceFileId: number;
    regionType: CARTA.RegionType;
    controlPoints: Point2D[];
    rotation: number;
    name: string;
    color: string;
    lineWidth: number;
    dashLength: number;
    annotationStyles?: any;
}

/**
 * Returns a human-readable pixel-coordinate description of a region, formatted
 * for display in the region list or status bar.
 *
 * @param regionType - The type of the region.
 * @param controlPoints - Control points in image pixel coordinates.
 * @param rotation - Rotation angle in degrees.
 * @returns A formatted string describing the region in pixel coordinates.
 */
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

/**
 * Transforms a region's control points and rotation from one coordinate frame to
 * another using the supplied AST spatial mapping.
 *
 * For box-like regions (rectangle, ellipse, compass, and their annotation
 * equivalents) the center is reprojected and the size is rescaled by the local
 * Jacobian; for all other region types every control point is reprojected
 * individually.
 *
 * @param region - Source region geometry expressed in the origin frame.
 * @param spatialTransformAST - AST mapping from the origin frame to the target frame.
 * @returns Transformed control points and rotation angle in the target frame.
 */
export function getTransformedRegionProperties(region: RegionTransformSource, spatialTransformAST: AST.Mapping): {controlPoints: Point2D[]; rotation: number} {
    switch (region.regionType) {
        case CARTA.RegionType.RECTANGLE:
        case CARTA.RegionType.ELLIPSE:
        case CARTA.RegionType.ANNRECTANGLE:
        case CARTA.RegionType.ANNELLIPSE:
        case CARTA.RegionType.ANNCOMPASS:
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

/**
 * Computes the translation delta used to offset a pasted region away from its
 * source position.
 *
 * For line-like regions (LINE, ANNLINE, ANNVECTOR, ANNRULER) the shift is
 * perpendicular to the line direction: the direction vector is rotated 90
 * degrees clockwise and scaled so its dominant component equals `pasteOffset`.
 * For all other region types the shift is the fixed diagonal
 * `{x: pasteOffset, y: -pasteOffset}`.
 *
 * @param points - Control points of the region in image pixel coordinates.
 * @param regionType - The type of the region.
 * @param pasteOffset - Desired offset magnitude in image pixels. Defaults to {@link PASTE_OFFSET}.
 * @returns Translation delta `{x, y}` to apply to the region's control points.
 */
export function getPasteShiftDelta(points: Point2D[], regionType: CARTA.RegionType, pasteOffset: number = PASTE_OFFSET): Point2D {
    switch (regionType) {
        case CARTA.RegionType.LINE:
        case CARTA.RegionType.ANNLINE:
        case CARTA.RegionType.ANNVECTOR:
        case CARTA.RegionType.ANNRULER: {
            if (points.length < 2) {
                return {x: pasteOffset, y: -pasteOffset};
            }

            const delta = subtract2D(points[1], points[0]);
            const maxComponent = Math.max(Math.abs(delta.x), Math.abs(delta.y));
            if (maxComponent === 0) {
                return {x: pasteOffset, y: -pasteOffset};
            }

            const scale = pasteOffset / maxComponent;
            return {x: delta.y * scale, y: -delta.x * scale};
        }
        default:
            return {x: pasteOffset, y: -pasteOffset};
    }
}

/**
 * Converts the abstract {@link PASTE_OFFSET} constant into an image-pixel offset
 * appropriate for the current zoom level and user preference.
 *
 * - **ScreenPixel**: returns `PASTE_OFFSET / zoomLevel` so the on-screen distance
 *   is always the same regardless of zoom.
 * - **ImagePixel**: returns `PASTE_OFFSET` so the image-space offset stays fixed.
 * - **Auto** with `zoomLevel < 1`: same as ScreenPixel (zoomed out, keep visible gap).
 * - **Auto** with `zoomLevel >= 1`: divides by `ceil(zoomLevel / 5)` so the
 *   offset shrinks in steps as the user zooms in; minimum returned value is 1.
 *
 * @param pasteOffsetUnit - The unit mode chosen in user preferences.
 * @param zoomLevel - The current image zoom level.
 * @returns The paste offset in image pixels.
 */
export function getPasteRegionOffset(pasteOffsetUnit: PasteOffsetUnit, zoomLevel: number): number {
    if (pasteOffsetUnit === PasteOffsetUnit.ScreenPixel || (pasteOffsetUnit === PasteOffsetUnit.Auto && zoomLevel < 1)) {
        return PASTE_OFFSET / zoomLevel;
    }

    if (pasteOffsetUnit === PasteOffsetUnit.ImagePixel) {
        return PASTE_OFFSET;
    }

    return Math.max(PASTE_OFFSET / Math.ceil(zoomLevel / 5), 1);
}

/**
 * Shifts a region's control points until its center no longer overlaps any
 * existing region, using repeated applications of {@link getPasteShiftDelta}.
 *
 * An initial shift is applied when `shouldApplyInitialOffset` is `true`, i.e.
 * the region is being pasted onto the same file it was copied from. After that,
 * the loop continues shifting until the center is collision-free or the number
 * of attempts exceeds the count of existing regions.
 *
 * Collision is defined as a Chebyshev distance smaller than `pasteOffset / 2`
 * from any valid, non-cursor region center.
 *
 * @param points - Original control points of the region to be pasted.
 * @param regionType - The type of the region.
 * @param regions - All regions currently present on the target frame.
 * @param shouldApplyInitialOffset - Whether to apply one shift before collision checking.
 * @param pasteOffset - Collision radius and shift magnitude in image pixels. Defaults to {@link PASTE_OFFSET}.
 * @returns A new set of control points that does not collide with any existing region, or the best position found within the attempt limit.
 */
export function offsetPointsToAvoidCollision(points: Point2D[], regionType: CARTA.RegionType, regions: RegionStore[], shouldApplyInitialOffset: boolean, pasteOffset: number = PASTE_OFFSET): Point2D[] {
    let shiftedPoints = points.map(point => ({...point}));
    let attempts = 0;
    const shiftDelta = getPasteShiftDelta(points, regionType, pasteOffset);

    if (shouldApplyInitialOffset) {
        shiftedPoints = translateRegionPoints(shiftedPoints, regionType, shiftDelta);
    }

    while (attempts <= regions.length && hasRegionCenterCollision(getRegionCenterFromPoints(shiftedPoints, regionType), regions, pasteOffset)) {
        shiftedPoints = translateRegionPoints(shiftedPoints, regionType, shiftDelta);
        attempts++;
    }

    return shiftedPoints;
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

function hasRegionCenterCollision(center: Point2D, regions: RegionStore[], pasteOffset: number): boolean {
    return regions.some(region => {
        if (region.regionId === RegionId.CURSOR || !region.isValid) {
            return false;
        }

        return Math.max(Math.abs(region.center.x - center.x), Math.abs(region.center.y - center.y)) < pasteOffset / 2;
    });
}

/**
 * Returns translated control points for a region without mutating the input.
 *
 * Center-based regions move only their center control point and preserve size or
 * offset control points. Line-like and polygonal regions move every control
 * point by the supplied delta.
 *
 * @param points - Region control points in image pixel coordinates.
 * @param regionType - Type of the region represented by the control points.
 * @param delta - Image-pixel translation to apply.
 * @returns A new control point array translated according to the region type.
 */
export function translateRegionPoints(points: Point2D[], regionType: CARTA.RegionType, delta: Point2D): Point2D[] {
    switch (regionType) {
        case CARTA.RegionType.POINT:
        case CARTA.RegionType.ANNPOINT:
        case CARTA.RegionType.RECTANGLE:
        case CARTA.RegionType.ANNRECTANGLE:
        case CARTA.RegionType.ELLIPSE:
        case CARTA.RegionType.ANNELLIPSE:
        case CARTA.RegionType.ANNTEXT:
        case CARTA.RegionType.ANNCOMPASS:
            return points.map((point, index) => (index === CENTER_POINT_INDEX ? add2D(point, delta) : {...point}));
        default:
            return points.map(point => add2D(point, delta));
    }
}

/**
 * Computes a region center from raw control points.
 *
 * Line-like regions use the midpoint between their two endpoints. Polygonal
 * regions use the center of their control-point bounding box. Center-based
 * regions use their first control point. Invalid or incomplete inputs fall back
 * to the first control point when available, otherwise `{x: 0, y: 0}`.
 *
 * @param points - Region control points in image pixel coordinates.
 * @param regionType - Type of the region represented by the control points.
 * @returns The computed center point in image pixel coordinates.
 */
export function getRegionCenterFromPoints(points: Point2D[], regionType: CARTA.RegionType): Point2D {
    switch (regionType) {
        case CARTA.RegionType.LINE:
        case CARTA.RegionType.ANNLINE:
        case CARTA.RegionType.ANNVECTOR:
        case CARTA.RegionType.ANNRULER:
            return points.length >= 2 ? midpoint2D(points[CENTER_POINT_INDEX], points[1]) : (points[CENTER_POINT_INDEX] ?? {x: 0, y: 0});
        case CARTA.RegionType.POLYGON:
        case CARTA.RegionType.ANNPOLYGON:
        case CARTA.RegionType.POLYLINE:
        case CARTA.RegionType.ANNPOLYLINE:
            if (!points.length) {
                return {x: 0, y: 0};
            }
            const bounds = minMax2D(points);
            return midpoint2D(bounds.minPoint, bounds.maxPoint);
        default:
            return points[CENTER_POINT_INDEX] ?? {x: 0, y: 0};
    }
}
