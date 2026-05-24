import {CARTA} from "carta-protobuf";

import {type Point2D} from "models";
import {CURSOR_REGION_ID, type RegionStore} from "stores/Frame";

export const PASTE_OFFSET = 20;

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

export function getLinePositionAngle(points: Point2D[]): number {
    if (points.length < 2) {
        return 0;
    }

    let angle = (Math.atan((points[1].x - points[0].x) / (points[0].y - points[1].y)) * 180.0) / Math.PI;
    if (points[1].y > points[0].y) {
        angle += 180;
    }

    return (angle + 360) % 360;
}

export function getPasteShiftDelta(points: Point2D[], regionType: CARTA.RegionType): Point2D {
    switch (regionType) {
        case CARTA.RegionType.LINE:
        case CARTA.RegionType.ANNLINE:
        case CARTA.RegionType.ANNVECTOR: {
            const positionAngle = getLinePositionAngle(points);
            const shouldShiftYOnly = (positionAngle >= 45 && positionAngle <= 135) || (positionAngle >= 225 && positionAngle <= 315);
            return shouldShiftYOnly ? {x: 0, y: PASTE_OFFSET} : {x: PASTE_OFFSET, y: 0};
        }
        default:
            return {x: PASTE_OFFSET, y: PASTE_OFFSET};
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

export function offsetPointsToAvoidCollision(points: Point2D[], regionType: CARTA.RegionType, regions: RegionStore[], shouldApplyInitialOffset: boolean): Point2D[] {
    let shiftedPoints = points.map(point => ({x: point.x, y: point.y}));
    let attempts = 0;
    const shiftDelta = getPasteShiftDelta(points, regionType);

    const hasCollision = (center: Point2D) => {
        return regions.some(region => {
            if (region.regionId === CURSOR_REGION_ID || !region.isValid) {
                return false;
            }

            return Math.max(Math.abs(region.center.x - center.x), Math.abs(region.center.y - center.y)) < PASTE_OFFSET / 2;
        });
    };

    if (shouldApplyInitialOffset) {
        shiftedPoints = shiftRegionPoints(shiftedPoints, regionType, shiftDelta.x, shiftDelta.y);
    }

    while (attempts < 20 && hasCollision(getRegionCenter(shiftedPoints, regionType))) {
        shiftedPoints = shiftRegionPoints(shiftedPoints, regionType, shiftDelta.x, shiftDelta.y);
        attempts++;
    }

    return shiftedPoints;
}
