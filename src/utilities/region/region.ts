import type * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";

import {PasteOffsetUnit} from "enums";
import {type Point2D, Transform2D} from "models";
import {CURSOR_REGION_ID, type RegionStore} from "stores/Frame";
import {isAstBadPoint, scale2D, toFixed, transformPoint} from "utilities";

const CENTER_POINT_INDEX = 0;
const SIZE_POINT_INDEX = 1;
export const PASTE_OFFSET = 20;

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
 * For box-like regions (rectangle, ellipse, and their annotation equivalents) the
 * center is reprojected and the size is rescaled by the local Jacobian; for all
 * other region types every control point is reprojected individually.
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
 * Returns the logical center of a region given its control points.
 *
 * - **Line / vector / ruler** types: midpoint of the two endpoints.
 * - **Polygon / polyline** types: center of the axis-aligned bounding box.
 * - All other types: the first control point (which is the stored center).
 *
 * @param points - Control points of the region in image pixel coordinates.
 * @param regionType - The type of the region.
 * @returns The center point of the region.
 */
export function getRegionCenter(points: Point2D[], regionType: CARTA.RegionType): Point2D {
    switch (regionType) {
        case CARTA.RegionType.LINE:
        case CARTA.RegionType.ANNLINE:
        case CARTA.RegionType.ANNVECTOR:
        case CARTA.RegionType.ANNRULER:
            if (points.length >= 2) {
                return {
                    x: (points[0].x + points[1].x) / 2,
                    y: (points[0].y + points[1].y) / 2
                };
            }
            return points[0] ?? {x: 0, y: 0};
        case CARTA.RegionType.POLYGON:
        case CARTA.RegionType.ANNPOLYGON:
        case CARTA.RegionType.POLYLINE:
        case CARTA.RegionType.ANNPOLYLINE:
            if (!points.length) {
                return {x: 0, y: 0};
            }

            let minX = points[0].x;
            let maxX = points[0].x;
            let minY = points[0].y;
            let maxY = points[0].y;
            for (const point of points) {
                minX = Math.min(minX, point.x);
                maxX = Math.max(maxX, point.x);
                minY = Math.min(minY, point.y);
                maxY = Math.max(maxY, point.y);
            }

            return {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2
            };
        default:
            return points[0] ?? {x: 0, y: 0};
    }
}

/**
 * Computes the translation delta used to offset a pasted region away from its
 * source position.
 *
 * For line-like regions (LINE, ANNLINE, ANNVECTOR, ANNRULER) the shift is
 * perpendicular to the line direction: the direction vector is rotated 90°
 * clockwise and scaled so its dominant component equals `pasteOffset`.
 * For all other region types the shift is the fixed diagonal `{x: pasteOffset, y: -pasteOffset}`.
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
            // Shift perpendicular to the line: rotate direction vector 90° clockwise → (ry, -rx),
            // then scale so the dominant component equals pasteOffset.
            const rx = points[1].x - points[0].x;
            const ry = points[1].y - points[0].y;
            const maxComponent = Math.max(Math.abs(rx), Math.abs(ry));
            if (maxComponent === 0) {
                return {x: pasteOffset, y: -pasteOffset};
            }
            const scale = pasteOffset / maxComponent;
            return {x: ry * scale, y: -rx * scale};
        }
        default:
            return {x: pasteOffset, y: -pasteOffset};
    }
}

/**
 * Translates a region's control points by the given offset.
 *
 * For center-based region types (POINT, RECTANGLE, ELLIPSE, and their annotation
 * equivalents) only the first control point (the center) is shifted; size and
 * shape points remain unchanged. For all other types every control point is shifted.
 *
 * @param points - Control points of the region in image pixel coordinates.
 * @param regionType - The type of the region.
 * @param offsetX - Horizontal translation in image pixels.
 * @param offsetY - Vertical translation in image pixels.
 * @returns A new array of shifted control points (original array is not mutated).
 */
export function shiftRegionPoints(points: Point2D[], regionType: CARTA.RegionType, offsetX: number, offsetY: number): Point2D[] {
    switch (regionType) {
        case CARTA.RegionType.POINT:
        case CARTA.RegionType.ANNPOINT:
        case CARTA.RegionType.RECTANGLE:
        case CARTA.RegionType.ANNRECTANGLE:
        case CARTA.RegionType.ELLIPSE:
        case CARTA.RegionType.ANNELLIPSE:
        case CARTA.RegionType.ANNTEXT:
        case CARTA.RegionType.ANNCOMPASS:
            return points.map((point, index) => {
                if (index === 0) {
                    return {x: point.x + offsetX, y: point.y + offsetY};
                }
                return {x: point.x, y: point.y};
            });
        default:
            return points.map(point => ({x: point.x + offsetX, y: point.y + offsetY}));
    }
}

/**
 * Converts the abstract {@link PASTE_OFFSET} constant into an image-pixel offset
 * appropriate for the current zoom level and user preference.
 *
 * - **ScreenPixel**: returns `PASTE_OFFSET / zoomLevel` so the on-screen distance
 *   is always the same regardless of zoom.
 * - **Auto** with `zoomLevel < 1`: same as ScreenPixel (zoomed out, keep visible gap).
 * - **Auto / ImagePixel** with `zoomLevel >= 1`: divides by `ceil(zoomLevel / 5)` so
 *   the offset shrinks in steps as the user zooms in; minimum returned value is 1.
 *
 * @param pasteOffsetUnit - The unit mode chosen in user preferences.
 * @param zoomLevel - The current image zoom level (image pixels per screen pixel).
 * @returns The paste offset in image pixels.
 */
export function getPasteRegionOffset(pasteOffsetUnit: PasteOffsetUnit, zoomLevel: number): number {
    if (pasteOffsetUnit === PasteOffsetUnit.ScreenPixel) {
        return PASTE_OFFSET / zoomLevel;
    } else if (pasteOffsetUnit === PasteOffsetUnit.Auto && zoomLevel < 1) {
        return PASTE_OFFSET / zoomLevel;
    } else {
        const offset = PASTE_OFFSET / Math.ceil(zoomLevel / 5);
        return offset > 1 ? offset : 1;
    }
}

/**
 * Shifts a region's control points until its center no longer overlaps any
 * existing region, using repeated applications of {@link getPasteShiftDelta}.
 *
 * An initial shift is applied when `shouldApplyInitialOffset` is `true` (i.e.
 * the region is being pasted onto the same file it was copied from). After that,
 * the loop continues shifting until the center is collision-free or the number of
 * attempts exceeds the count of existing regions.
 *
 * Collision is defined as a Chebyshev distance smaller than `pasteOffset / 2`
 * from any valid, non-cursor region center.
 *
 * @param points - Original control points of the region to be pasted.
 * @param regionType - The type of the region.
 * @param regions - All regions currently present on the target frame.
 * @param shouldApplyInitialOffset - Whether to apply one shift before collision checking.
 * @param pasteOffset - Collision radius and shift magnitude in image pixels. Defaults to {@link PASTE_OFFSET}.
 * @returns A new set of control points that does not collide with any existing region (or the best position found within the attempt limit).
 */
export function offsetPointsToAvoidCollision(points: Point2D[], regionType: CARTA.RegionType, regions: RegionStore[], shouldApplyInitialOffset: boolean, pasteOffset: number = PASTE_OFFSET): Point2D[] {
    let shiftedPoints = points.map(point => ({x: point.x, y: point.y}));
    let attempts = 0;
    const shiftDelta = getPasteShiftDelta(points, regionType, pasteOffset);

    const hasCollision = (center: Point2D) => {
        return regions.some(region => {
            if (region.regionId === CURSOR_REGION_ID || !region.isValid) {
                return false;
            }

            return Math.max(Math.abs(region.center.x - center.x), Math.abs(region.center.y - center.y)) < pasteOffset / 2;
        });
    };

    if (shouldApplyInitialOffset) {
        shiftedPoints = shiftRegionPoints(shiftedPoints, regionType, shiftDelta.x, shiftDelta.y);
    }

    while (attempts <= regions.length && hasCollision(getRegionCenter(shiftedPoints, regionType))) {
        shiftedPoints = shiftRegionPoints(shiftedPoints, regionType, shiftDelta.x, shiftDelta.y);
        attempts++;
    }

    return shiftedPoints;
}
