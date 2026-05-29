import type * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";

import {PasteOffsetUnit} from "enums";
import {type Point2D, Transform2D} from "models";
import {CURSOR_REGION_ID, type RegionStore} from "stores/Frame";
import {isAstBadPoint, scale2D, toFixed, transformPoint} from "utilities";

const CENTER_POINT_INDEX = 0;
const SIZE_POINT_INDEX = 1;
export const PASTE_OFFSET = 20;

export interface RegionTransformSource {
    regionType: CARTA.RegionType;
    center: Point2D;
    size: Point2D;
    controlPoints: Point2D[];
    rotation: number;
}

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
