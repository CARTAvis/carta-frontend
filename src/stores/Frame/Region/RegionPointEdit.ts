import {CARTA} from "carta-protobuf";

import {type Point2D} from "models";
import {add2D, rotate2D, scale2D, subtract2D} from "utilities";

export const SIMPLE_SHAPE_TOP_POINT_INDEX = 0;
export const SIMPLE_SHAPE_RIGHT_POINT_INDEX = 1;
export const SIMPLE_SHAPE_BOTTOM_POINT_INDEX = 2;
export const SIMPLE_SHAPE_LEFT_POINT_INDEX = 3;
export const SIMPLE_SHAPE_ROTATION_POINT_INDEX = 4;
export const MIN_EDITED_REGION_DIMENSION = 1e-3;

export type SimpleShapeAnchor = "top" | "right" | "bottom" | "left" | "rotator" | "top-left" | "bottom-left" | "top-right" | "bottom-right";

type SimpleShapeBounds = {left: number; right: number; bottom: number; top: number};

interface SimpleShapePointEditInput {
    regionType: CARTA.RegionType;
    center: Point2D;
    size: Point2D;
    rotation: number;
    selectedPointIndex: number;
    delta: Point2D;
    textScale: number;
}

interface SimpleShapePointEditResult {
    center: Point2D;
    size: Point2D;
}

interface SimpleShapeCornerResizeInput {
    regionType: CARTA.RegionType;
    size: Point2D;
    rotation: number;
    anchor: string;
    oppositeAnchorPoint: Point2D;
    newAnchorPoint: Point2D;
    textScale: number;
}

interface SimpleShapeCenterResizeInput {
    regionType: CARTA.RegionType;
    center: Point2D;
    size: Point2D;
    rotation: number;
    anchor: string;
    keepAspect: boolean;
    newAnchorPoint: Point2D;
    textScale: number;
}

export function getMovedSimpleShapeSide(input: SimpleShapePointEditInput): SimpleShapePointEditResult | null {
    const rotation = (input.rotation * Math.PI) / 180.0;
    const localDelta = rotate2D(input.delta, -rotation);
    const bounds = moveSimpleShapeBounds(getSimpleShapeBounds(input.regionType, input.size, input.textScale), localDelta, input.selectedPointIndex);

    if (!bounds) {
        return null;
    }

    const centerOffset = rotate2D({x: (bounds.left + bounds.right) / 2, y: (bounds.bottom + bounds.top) / 2}, rotation);
    return {
        center: {x: input.center.x + centerOffset.x, y: input.center.y + centerOffset.y},
        size: getSimpleShapeSize(input.regionType, bounds, input.textScale)
    };
}

export function getSimpleShapeAnchorName(selectedPointIndex: number): string {
    switch (selectedPointIndex) {
        case SIMPLE_SHAPE_TOP_POINT_INDEX:
            return "top";
        case SIMPLE_SHAPE_RIGHT_POINT_INDEX:
            return "right";
        case SIMPLE_SHAPE_BOTTOM_POINT_INDEX:
            return "bottom";
        case SIMPLE_SHAPE_LEFT_POINT_INDEX:
            return "left";
        case SIMPLE_SHAPE_ROTATION_POINT_INDEX:
            return "rotator";
        default:
            return "";
    }
}

export function getSimpleShapeAnchorPointIndex(anchor: string): number {
    switch (anchor) {
        case "top":
            return SIMPLE_SHAPE_TOP_POINT_INDEX;
        case "right":
            return SIMPLE_SHAPE_RIGHT_POINT_INDEX;
        case "bottom":
            return SIMPLE_SHAPE_BOTTOM_POINT_INDEX;
        case "left":
            return SIMPLE_SHAPE_LEFT_POINT_INDEX;
        case "rotator":
            return SIMPLE_SHAPE_ROTATION_POINT_INDEX;
        default:
            return -1;
    }
}

export function getSimpleShapeAnchorSizeScale(regionType: CARTA.RegionType, textScale: number): number {
    if (isRectangleRegionType(regionType)) {
        return 0.5;
    }

    if (isTextRegionType(regionType)) {
        return 0.5 * textScale;
    }

    return 1;
}

export function getResizedSimpleShapeFromCorner(input: SimpleShapeCornerResizeInput): SimpleShapePointEditResult {
    let w: number;
    let h: number;
    let sizeFactor: number;
    if (usesSimpleShapeBoxSize(input.regionType)) {
        sizeFactor = 1.0;
        w = input.size.x;
        h = input.size.y;
    } else {
        sizeFactor = 0.5;
        w = input.size.y;
        h = input.size.x;
    }

    let deltaAnchors = subtract2D(input.newAnchorPoint, input.oppositeAnchorPoint);
    const deltaAnchorsUnrotated = rotate2D(deltaAnchors, (-input.rotation * Math.PI) / 180.0);

    if (input.anchor.includes("left") || input.anchor.includes("right")) {
        w = Math.abs(deltaAnchorsUnrotated.x) * sizeFactor;
    } else {
        deltaAnchorsUnrotated.x = 0;
    }
    if (input.anchor.includes("top") || input.anchor.includes("bottom")) {
        h = Math.abs(deltaAnchorsUnrotated.y) * sizeFactor;
    } else {
        deltaAnchorsUnrotated.y = 0;
    }

    deltaAnchors = rotate2D(deltaAnchorsUnrotated, (input.rotation * Math.PI) / 180.0);
    return {
        center: add2D(input.oppositeAnchorPoint, scale2D(deltaAnchors, 0.5)),
        size: getSimpleShapeSizeFromDimensions(input.regionType, w, h, input.textScale, input.anchor, false)
    };
}

export function getResizedSimpleShapeFromCenter(input: SimpleShapeCenterResizeInput): Point2D {
    let w: number;
    let h: number;
    let sizeFactor: number;
    if (usesSimpleShapeBoxSize(input.regionType)) {
        sizeFactor = 2.0;
        w = input.size.x;
        h = input.size.y;
    } else {
        sizeFactor = 1.0;
        w = input.size.y;
        h = input.size.x;
    }

    const deltaAnchorPoint = subtract2D(input.newAnchorPoint, input.center);
    const deltaAnchorPointUnrotated = rotate2D(deltaAnchorPoint, (-input.rotation * Math.PI) / 180.0);

    if (input.anchor.includes("left") || input.anchor.includes("right")) {
        w = Math.abs(deltaAnchorPointUnrotated.x) * sizeFactor;
        if (input.keepAspect) {
            h = w;
        }
    }
    if (input.anchor.includes("top") || input.anchor.includes("bottom")) {
        h = Math.abs(deltaAnchorPointUnrotated.y) * sizeFactor;
        if (input.keepAspect) {
            w = h;
        }
    }

    return getSimpleShapeSizeFromDimensions(input.regionType, w, h, input.textScale, input.anchor, input.keepAspect);
}

export function usesSimpleShapeBoxSize(regionType: CARTA.RegionType): boolean {
    return isRectangleRegionType(regionType) || isTextRegionType(regionType);
}

export function isRectangleRegionType(regionType: CARTA.RegionType): boolean {
    return regionType === CARTA.RegionType.RECTANGLE || regionType === CARTA.RegionType.ANNRECTANGLE;
}

export function isTextRegionType(regionType: CARTA.RegionType): boolean {
    return regionType === CARTA.RegionType.ANNTEXT;
}

function getSimpleShapeBounds(regionType: CARTA.RegionType, size: Point2D, textScale: number): SimpleShapeBounds {
    let halfWidth: number;
    let halfHeight: number;

    if (isRectangleRegionType(regionType)) {
        halfWidth = size.x / 2;
        halfHeight = size.y / 2;
    } else if (isTextRegionType(regionType)) {
        halfWidth = (size.x * textScale) / 2;
        halfHeight = (size.y * textScale) / 2;
    } else {
        halfWidth = size.y;
        halfHeight = size.x;
    }

    return {left: -halfWidth, right: halfWidth, bottom: -halfHeight, top: halfHeight};
}

function moveSimpleShapeBounds(bounds: SimpleShapeBounds, delta: Point2D, selectedPointIndex: number): SimpleShapeBounds | null {
    const nextBounds = {...bounds};
    switch (selectedPointIndex) {
        case SIMPLE_SHAPE_TOP_POINT_INDEX:
            nextBounds.top = Math.max(nextBounds.top + delta.y, nextBounds.bottom + MIN_EDITED_REGION_DIMENSION);
            return nextBounds;
        case SIMPLE_SHAPE_RIGHT_POINT_INDEX:
            nextBounds.right = Math.max(nextBounds.right + delta.x, nextBounds.left + MIN_EDITED_REGION_DIMENSION);
            return nextBounds;
        case SIMPLE_SHAPE_BOTTOM_POINT_INDEX:
            nextBounds.bottom = Math.min(nextBounds.bottom + delta.y, nextBounds.top - MIN_EDITED_REGION_DIMENSION);
            return nextBounds;
        case SIMPLE_SHAPE_LEFT_POINT_INDEX:
            nextBounds.left = Math.min(nextBounds.left + delta.x, nextBounds.right - MIN_EDITED_REGION_DIMENSION);
            return nextBounds;
        default:
            return null;
    }
}

function getSimpleShapeSize(regionType: CARTA.RegionType, bounds: SimpleShapeBounds, textScale: number): Point2D {
    const width = bounds.right - bounds.left;
    const height = bounds.top - bounds.bottom;

    if (isRectangleRegionType(regionType)) {
        return {x: width, y: height};
    }
    if (isTextRegionType(regionType)) {
        return {x: width / textScale, y: height / textScale};
    }
    return {x: height / 2, y: width / 2};
}

function getSimpleShapeSizeFromDimensions(regionType: CARTA.RegionType, width: number, height: number, textScale: number, anchor: string, keepAspect: boolean): Point2D {
    if (isRectangleRegionType(regionType)) {
        return {x: Math.max(MIN_EDITED_REGION_DIMENSION, width), y: Math.max(MIN_EDITED_REGION_DIMENSION, height)};
    }

    if (isTextRegionType(regionType)) {
        const isAnchorX = anchor === "left" || anchor === "right";
        const isAnchorY = anchor === "top" || anchor === "bottom";
        return {
            x: Math.max(MIN_EDITED_REGION_DIMENSION, !keepAspect && isAnchorY ? width : width / textScale),
            y: Math.max(MIN_EDITED_REGION_DIMENSION, !keepAspect && isAnchorX ? height : height / textScale)
        };
    }

    return {y: Math.max(MIN_EDITED_REGION_DIMENSION, width), x: Math.max(MIN_EDITED_REGION_DIMENSION, height)};
}
