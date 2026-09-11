import {CARTA} from "carta-protobuf";

import {type Point2D} from "models";

import {add2D, divide2D, multiply2D, rotate2D, scale2D, subtract2D} from "../math2d/math2d";

export const SIMPLE_SHAPE_TOP_POINT_INDEX = 0;
export const SIMPLE_SHAPE_RIGHT_POINT_INDEX = 1;
export const SIMPLE_SHAPE_BOTTOM_POINT_INDEX = 2;
export const SIMPLE_SHAPE_LEFT_POINT_INDEX = 3;
export const SIMPLE_SHAPE_TOP_LEFT_POINT_INDEX = 4;
export const SIMPLE_SHAPE_BOTTOM_LEFT_POINT_INDEX = 5;
export const SIMPLE_SHAPE_TOP_RIGHT_POINT_INDEX = 6;
export const SIMPLE_SHAPE_BOTTOM_RIGHT_POINT_INDEX = 7;
export const SIMPLE_SHAPE_ROTATION_POINT_INDEX = 8;
export const MIN_EDITED_REGION_DIMENSION = 1e-3;

export type SimpleShapeAnchor = "top" | "right" | "bottom" | "left" | "rotator" | "top-left" | "bottom-left" | "top-right" | "bottom-right";

const SIMPLE_SHAPE_ANCHOR_POINT_ENTRIES: Array<[SimpleShapeAnchor, number]> = [
    ["top", SIMPLE_SHAPE_TOP_POINT_INDEX],
    ["right", SIMPLE_SHAPE_RIGHT_POINT_INDEX],
    ["bottom", SIMPLE_SHAPE_BOTTOM_POINT_INDEX],
    ["left", SIMPLE_SHAPE_LEFT_POINT_INDEX],
    ["top-left", SIMPLE_SHAPE_TOP_LEFT_POINT_INDEX],
    ["bottom-left", SIMPLE_SHAPE_BOTTOM_LEFT_POINT_INDEX],
    ["top-right", SIMPLE_SHAPE_TOP_RIGHT_POINT_INDEX],
    ["bottom-right", SIMPLE_SHAPE_BOTTOM_RIGHT_POINT_INDEX],
    ["rotator", SIMPLE_SHAPE_ROTATION_POINT_INDEX]
];

const SIMPLE_SHAPE_POINT_ANCHOR_NAMES = new Map<number, SimpleShapeAnchor>(SIMPLE_SHAPE_ANCHOR_POINT_ENTRIES.map(([anchor, pointIndex]): [number, SimpleShapeAnchor] => [pointIndex, anchor]));
const SIMPLE_SHAPE_ANCHOR_POINT_INDEXES = new Map<SimpleShapeAnchor, number>(SIMPLE_SHAPE_ANCHOR_POINT_ENTRIES);

const SIMPLE_SHAPE_POINT_SELECTION_ORDER = [
    SIMPLE_SHAPE_TOP_LEFT_POINT_INDEX,
    SIMPLE_SHAPE_TOP_POINT_INDEX,
    SIMPLE_SHAPE_TOP_RIGHT_POINT_INDEX,
    SIMPLE_SHAPE_RIGHT_POINT_INDEX,
    SIMPLE_SHAPE_BOTTOM_RIGHT_POINT_INDEX,
    SIMPLE_SHAPE_BOTTOM_POINT_INDEX,
    SIMPLE_SHAPE_BOTTOM_LEFT_POINT_INDEX,
    SIMPLE_SHAPE_LEFT_POINT_INDEX
];

type SimpleShapeBounds = {left: number; right: number; bottom: number; top: number};

interface SimpleShapePointEditInput {
    regionType: CARTA.RegionType;
    center: Point2D;
    size: Point2D;
    rotation: number;
    selectedPointIndex: number;
    delta: Point2D;
    textScale: Point2D;
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
    textScale: Point2D;
}

interface SimpleShapeCenterResizeInput {
    regionType: CARTA.RegionType;
    center: Point2D;
    size: Point2D;
    rotation: number;
    anchor: string;
    keepAspect: boolean;
    newAnchorPoint: Point2D;
    textScale: Point2D;
}

/**
 * Computes updated simple-shape geometry after dragging an edge or corner handle.
 *
 * The drag delta is transformed into the shape's local coordinate system, then
 * applied to the selected side or corner before the updated center is rotated
 * back into image coordinates.
 *
 * @param input - Current shape geometry, selected handle, drag delta, and text scale.
 * @returns Updated center and size, or null when the selected point is not resizable.
 */
export function getMovedSimpleShapeSide(input: SimpleShapePointEditInput): SimpleShapePointEditResult | null {
    const rotation = (input.rotation * Math.PI) / 180.0;
    const isText = isTextRegionType(input.regionType);
    const localDelta = rotate2D(isText ? divide2D(input.delta, input.textScale) : input.delta, -rotation);
    const bounds = moveSimpleShapeBounds(getSimpleShapeBounds(input.regionType, input.size), localDelta, input.selectedPointIndex);

    if (!bounds) {
        return null;
    }

    let centerOffset = rotate2D({x: (bounds.left + bounds.right) / 2, y: (bounds.bottom + bounds.top) / 2}, rotation);
    if (isText) {
        centerOffset = multiply2D(centerOffset, input.textScale);
    }
    return {
        center: {x: input.center.x + centerOffset.x, y: input.center.y + centerOffset.y},
        size: getSimpleShapeSize(input.regionType, bounds)
    };
}

/**
 * Looks up the anchor name for a simple-shape edit point index.
 *
 * @param selectedPointIndex - Edit point index.
 * @returns Anchor name, or an empty string when the point index is not recognized.
 */
export function getSimpleShapeAnchorName(selectedPointIndex: number): string {
    return SIMPLE_SHAPE_POINT_ANCHOR_NAMES.get(selectedPointIndex) ?? "";
}

/**
 * Looks up the edit point index for a simple-shape anchor.
 *
 * @param anchor - Anchor name such as `top`, `bottom-right`, or `rotator`.
 * @returns Edit point index, or -1 when the anchor is not recognized.
 */
export function getSimpleShapeAnchorPointIndex(anchor: string): number {
    return SIMPLE_SHAPE_ANCHOR_POINT_INDEXES.get(anchor as SimpleShapeAnchor) ?? -1;
}

/**
 * Returns the keyboard traversal order for simple-shape edit points.
 *
 * @param shouldIncludeRotator - Whether to append the rotation handle index.
 * @returns Edit point indexes in selection order.
 */
export function getSimpleShapePointSelectionOrder(shouldIncludeRotator: boolean): number[] {
    return shouldIncludeRotator ? [...SIMPLE_SHAPE_POINT_SELECTION_ORDER, SIMPLE_SHAPE_ROTATION_POINT_INDEX] : [...SIMPLE_SHAPE_POINT_SELECTION_ORDER];
}

/**
 * Returns the size scale used to place handles for a simple-shape region type.
 *
 * Rectangle and text annotations store box dimensions, while ellipse-like shapes
 * use radius-style dimensions.
 *
 * @param regionType - Region type being edited.
 * @returns Multiplier used when deriving handle positions from stored size.
 */
export function getSimpleShapeAnchorSizeScale(regionType: CARTA.RegionType): number {
    if (usesSimpleShapeBoxSize(regionType)) {
        return 0.5;
    }
    return 1;
}

/**
 * Computes simple-shape geometry after resizing from a corner handle.
 *
 * The opposite corner remains fixed while the dragged anchor defines the new box
 * extent in the shape's local coordinate system.
 *
 * @param input - Resize inputs including region type, anchors, rotation, and text scale.
 * @returns Updated center and size for the resized shape.
 */
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

    const isText = isTextRegionType(input.regionType);
    let deltaAnchors = subtract2D(input.newAnchorPoint, input.oppositeAnchorPoint);
    const deltaAnchorsUnrotated = rotate2D(isText ? divide2D(deltaAnchors, input.textScale) : deltaAnchors, (-input.rotation * Math.PI) / 180.0);

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
    if (isText) {
        deltaAnchors = multiply2D(deltaAnchors, input.textScale);
    }
    return {
        center: add2D(input.oppositeAnchorPoint, scale2D(deltaAnchors, 0.5)),
        size: getSimpleShapeSizeFromDimensions(input.regionType, w, h)
    };
}

/**
 * Computes simple-shape size after resizing outward from the center.
 *
 * @param input - Resize inputs including center, anchor, aspect-lock state, and text scale.
 * @returns Updated shape size.
 */
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
    const deltaAnchorPointUnrotated = rotate2D(isTextRegionType(input.regionType) ? divide2D(deltaAnchorPoint, input.textScale) : deltaAnchorPoint, (-input.rotation * Math.PI) / 180.0);

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

    return getSimpleShapeSizeFromDimensions(input.regionType, w, h);
}

/**
 * Checks whether a simple-shape region stores size as full box dimensions.
 *
 * @param regionType - Region type to inspect.
 * @returns True for rectangle and text annotation region types.
 */
export function usesSimpleShapeBoxSize(regionType: CARTA.RegionType): boolean {
    return isRectangleRegionType(regionType) || isTextRegionType(regionType);
}

/**
 * Checks whether a region type is a rectangle or rectangle annotation.
 *
 * @param regionType - Region type to inspect.
 * @returns True for rectangle region types.
 */
export function isRectangleRegionType(regionType: CARTA.RegionType): boolean {
    return regionType === CARTA.RegionType.RECTANGLE || regionType === CARTA.RegionType.ANNRECTANGLE;
}

/**
 * Checks whether a region type is a text annotation.
 *
 * @param regionType - Region type to inspect.
 * @returns True for text annotation regions.
 */
export function isTextRegionType(regionType: CARTA.RegionType): boolean {
    return regionType === CARTA.RegionType.ANNTEXT;
}

function getSimpleShapeBounds(regionType: CARTA.RegionType, size: Point2D): SimpleShapeBounds {
    let halfWidth: number;
    let halfHeight: number;

    if (isRectangleRegionType(regionType)) {
        halfWidth = size.x / 2;
        halfHeight = size.y / 2;
    } else if (isTextRegionType(regionType)) {
        halfWidth = size.x / 2;
        halfHeight = size.y / 2;
    } else {
        halfWidth = size.y;
        halfHeight = size.x;
    }

    return {left: -halfWidth, right: halfWidth, bottom: -halfHeight, top: halfHeight};
}

function moveSimpleShapeBounds(bounds: SimpleShapeBounds, delta: Point2D, selectedPointIndex: number): SimpleShapeBounds | null {
    const anchor = getSimpleShapeAnchorName(selectedPointIndex);
    if (!anchor || anchor === "rotator") {
        return null;
    }

    const nextBounds = {...bounds};

    if (anchor.includes("top")) {
        nextBounds.top = Math.max(nextBounds.top + delta.y, nextBounds.bottom + MIN_EDITED_REGION_DIMENSION);
    }
    if (anchor.includes("bottom")) {
        nextBounds.bottom = Math.min(nextBounds.bottom + delta.y, nextBounds.top - MIN_EDITED_REGION_DIMENSION);
    }
    if (anchor.includes("left")) {
        nextBounds.left = Math.min(nextBounds.left + delta.x, nextBounds.right - MIN_EDITED_REGION_DIMENSION);
    }
    if (anchor.includes("right")) {
        nextBounds.right = Math.max(nextBounds.right + delta.x, nextBounds.left + MIN_EDITED_REGION_DIMENSION);
    }

    return nextBounds;
}

function getSimpleShapeSize(regionType: CARTA.RegionType, bounds: SimpleShapeBounds): Point2D {
    const width = bounds.right - bounds.left;
    const height = bounds.top - bounds.bottom;

    if (isRectangleRegionType(regionType)) {
        return {x: width, y: height};
    }
    if (isTextRegionType(regionType)) {
        return {x: width, y: height};
    }
    return {x: height / 2, y: width / 2};
}

function getSimpleShapeSizeFromDimensions(regionType: CARTA.RegionType, width: number, height: number): Point2D {
    if (usesSimpleShapeBoxSize(regionType)) {
        return {x: Math.max(MIN_EDITED_REGION_DIMENSION, width), y: Math.max(MIN_EDITED_REGION_DIMENSION, height)};
    }

    return {y: Math.max(MIN_EDITED_REGION_DIMENSION, width), x: Math.max(MIN_EDITED_REGION_DIMENSION, height)};
}
