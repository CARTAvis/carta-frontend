import {type Point2D} from "models";

type Point3D = {x: number; y: number; z?: number};
export type LineSegment2D = [Point2D, Point2D];
export type Rect2D = {x: number; y: number; width: number; height: number};

export function dot2D(a: Point2D, b: Point2D): number {
    return a.x * b.x + a.y * b.y;
}

export function cross2D(a: Point2D, b: Point2D): number {
    return a.x * b.y - a.y * b.x;
}

export function add2D(a: Point2D, b: Point2D): Point2D {
    return {x: a.x + b.x, y: a.y + b.y};
}

export function subtract2D(a: Point2D, b: Point2D): Point2D {
    return {x: a.x - b.x, y: a.y - b.y};
}

export function midpoint2D(a: Point2D, b: Point2D): Point2D {
    return {x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5};
}

export function scale2D(a: Point2D, s: number): Point2D {
    return {x: a.x * s, y: a.y * s};
}

export function multiply2D(a: Point2D, b: Point2D): Point2D {
    return {x: a.x * b.x, y: a.y * b.y};
}

export function divide2D(a: Point2D, b: Point2D): Point2D {
    return {x: a.x / b.x, y: a.y / b.y};
}

export function normal2D(a: Point2D, b: Point2D): Point2D {
    const delta = normalize2D(subtract2D(a, b));
    return perpVector2D(delta);
}

export function perpVector2D(dir: Point2D): Point2D {
    return {x: -dir.y, y: dir.x};
}

export function length2D(a: Point2D): number {
    return Math.sqrt(dot2D(a, a));
}

export function normalize2D(a: Point2D): Point2D {
    const size = length2D(a);
    return {x: a.x / size, y: a.y / size};
}

export function magDir2D(a: Point2D) {
    const size = length2D(a);
    return {mag: size, dir: {x: a.x / size, y: a.y / size}};
}

export function average2D(points: Point2D[]) {
    let sum: Point2D = {x: 0, y: 0};
    for (const point of points) {
        sum = add2D(sum, point);
    }
    return scale2D(sum, 1.0 / points.length);
}

export function rotate2D(point: Point2D, theta: number) {
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    return {x: cosTheta * point.x - sinTheta * point.y, y: sinTheta * point.x + cosTheta * point.y};
}

export function rotateAboutPoint2D(point: Point2D, origin: Point2D, theta: number) {
    return add2D(rotate2D(subtract2D(point, origin), theta), origin);
}

export function scaleAboutPoint2D(point: Point2D, origin: Point2D, scale: number) {
    return add2D(scale2D(subtract2D(point, origin), scale), origin);
}

export function scaleAndRotateAboutPoint2D(point: Point2D, origin: Point2D, scale: number, theta: number) {
    return add2D(scale2D(rotate2D(subtract2D(point, origin), theta), scale), origin);
}

export function minMax2D(points: Point2D[]): {maxPoint: Point2D; minPoint: Point2D} {
    const maxPoint = {x: -Number.MAX_VALUE, y: -Number.MAX_VALUE};
    const minPoint = {x: Number.MAX_VALUE, y: Number.MAX_VALUE};

    for (const point of points) {
        if (!point || isNaN(point.x) || isNaN(point.y)) {
            continue;
        }
        maxPoint.x = Math.max(maxPoint.x, point.x);
        maxPoint.y = Math.max(maxPoint.y, point.y);
        minPoint.x = Math.min(minPoint.x, point.x);
        minPoint.y = Math.min(minPoint.y, point.y);
    }
    return {maxPoint, minPoint};
}

export function minMaxPointArrayX(points: Point2D[]): {maxVal: number; minVal: number} {
    let maxVal = -Number.MAX_VALUE;
    let minVal = Number.MAX_VALUE;

    for (const point of points) {
        if (!point || isNaN(point.x)) {
            continue;
        }
        maxVal = Math.max(maxVal, point.x);
        minVal = Math.min(minVal, point.x);
    }
    return {maxVal, minVal};
}

export function minMaxPointArrayY(points: Point2D[]): {maxVal: number; minVal: number} {
    let maxVal = -Number.MAX_VALUE;
    let minVal = Number.MAX_VALUE;

    for (const point of points) {
        if (!point || isNaN(point.y)) {
            continue;
        }
        maxVal = Math.max(maxVal, point.y);
        minVal = Math.min(minVal, point.y);
    }
    return {maxVal, minVal};
}

export function minMaxPointArrayZ(points: Point3D[]): {maxVal: number; minVal: number} {
    let maxVal = -Number.MAX_VALUE;
    let minVal = Number.MAX_VALUE;

    for (const point of points) {
        if (!point || isNaN(point.z ?? NaN)) {
            continue;
        }
        maxVal = Math.max(maxVal, point.z ?? NaN);
        minVal = Math.min(minVal, point.z ?? NaN);
    }
    return {maxVal, minVal};
}

// Returns the closest point from a point to a line segment, as well as the distance to the line segment, and whether the point lies within the line segment
export function closestPointOnLine(p0: Point2D, p1: Point2D, p2: Point2D): {point: Point2D; bounded: boolean; distance: number} {
    const lineVector = subtract2D(p2, p1);
    const lineDirection = normalize2D(lineVector);
    const r = subtract2D(p0, p1);
    const s = dot2D(r, lineDirection);
    const point = add2D(p1, scale2D(lineDirection, s));
    return {
        point,
        bounded: s >= 0 && s <= length2D(lineVector),
        distance: length2D(subtract2D(p0, point))
    };
}

function lineSegmentsProperlyIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
    const lineCD = subtract2D(d, c);
    const crossA = cross2D(lineCD, subtract2D(a, d));
    const crossB = cross2D(lineCD, subtract2D(b, d));

    if (crossA * crossB < 0) {
        const lineAB = subtract2D(b, a);
        const crossC = cross2D(lineAB, subtract2D(c, b));
        const crossD = cross2D(lineAB, subtract2D(d, b));
        return crossC * crossD < 0;
    } else {
        return false;
    }
}

function lineOrientation(a: Point2D, b: Point2D, c: Point2D): number {
    const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
    if (Math.abs(value) < 1e-9) {
        return 0;
    }
    return value > 0 ? 1 : 2;
}

function isPointOnLineSegment(point: Point2D, start: Point2D, end: Point2D): boolean {
    return point.x <= Math.max(start.x, end.x) && point.x >= Math.min(start.x, end.x) && point.y <= Math.max(start.y, end.y) && point.y >= Math.min(start.y, end.y);
}

/**
 * Tests whether two line segments intersect, including endpoint touches and
 * collinear overlaps.
 *
 * @param a - First endpoint of the first segment.
 * @param b - Second endpoint of the first segment.
 * @param c - First endpoint of the second segment.
 * @param d - Second endpoint of the second segment.
 * @returns True when the two finite segments intersect.
 */
export function lineSegmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
    const orientationA = lineOrientation(a, b, c);
    const orientationB = lineOrientation(a, b, d);
    const orientationC = lineOrientation(c, d, a);
    const orientationD = lineOrientation(c, d, b);

    if (orientationA !== orientationB && orientationC !== orientationD) {
        return true;
    }

    return (orientationA === 0 && isPointOnLineSegment(c, a, b)) || (orientationB === 0 && isPointOnLineSegment(d, a, b)) || (orientationC === 0 && isPointOnLineSegment(a, c, d)) || (orientationD === 0 && isPointOnLineSegment(b, c, d));
}

/**
 * Tests whether a point lies inside or on the boundary of an axis-aligned rect.
 *
 * @param point - Point to test.
 * @param rect - Axis-aligned rectangle.
 * @returns True when the point is inside the rectangle bounds.
 */
export function isPointInRect(point: Point2D, rect: Rect2D): boolean {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

/**
 * Tests whether two axis-aligned rectangles overlap or touch.
 *
 * @param a - First rectangle.
 * @param b - Second rectangle.
 * @returns True when the rectangles have any shared area or boundary.
 */
export function doRectsIntersect(a: Rect2D, b: Rect2D): boolean {
    return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

/**
 * Builds a positive-size axis-aligned rectangle from any two opposite corners.
 *
 * @param start - First corner point.
 * @param end - Opposite corner point.
 * @returns Rectangle with non-negative width and height.
 */
export function getRectFromPoints(start: Point2D, end: Point2D): Rect2D {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    return {x, y, width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y)};
}

/**
 * Returns the four corners of an axis-aligned rectangle in clockwise order.
 *
 * @param rect - Rectangle to convert.
 * @returns Top-left, top-right, bottom-right, and bottom-left points.
 */
export function getRectCorners(rect: Rect2D): Point2D[] {
    return [
        {x: rect.x, y: rect.y},
        {x: rect.x + rect.width, y: rect.y},
        {x: rect.x + rect.width, y: rect.y + rect.height},
        {x: rect.x, y: rect.y + rect.height}
    ];
}

/**
 * Tests whether a line segment intersects an axis-aligned rectangle.
 *
 * Segments fully contained in the rectangle are treated as intersections.
 *
 * @param start - Segment start point.
 * @param end - Segment end point.
 * @param rect - Rectangle to test against.
 * @returns True when the segment crosses, touches, or lies inside the rectangle.
 */
export function doesLineSegmentIntersectRect(start: Point2D, end: Point2D, rect: Rect2D): boolean {
    if (isPointInRect(start, rect) || isPointInRect(end, rect)) {
        return true;
    }

    const corners = getRectCorners(rect);
    return corners.some((corner, index) => lineSegmentsIntersect(start, end, corner, corners[(index + 1) % corners.length]));
}

/**
 * Converts a point path into adjacent line segments.
 *
 * @param points - Ordered path points.
 * @param isClosed - Whether to connect the last point back to the first.
 * @returns Adjacent segment pairs, or an empty array for fewer than two points.
 */
export function getPathSegments(points: Point2D[], isClosed: boolean = false): LineSegment2D[] {
    if (points.length < 2) {
        return [];
    }

    const segmentCount = isClosed ? points.length : points.length - 1;
    return Array.from({length: segmentCount}, (_, index) => [points[index], points[(index + 1) % points.length]]);
}

/**
 * Tests whether a point is inside a polygon using an even-odd ray cast.
 *
 * @param point - Point to test.
 * @param polygon - Polygon vertices in path order.
 * @returns True when the point is inside the polygon.
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i];
        const b = polygon[j];
        const isIntersecting = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
        if (isIntersecting) {
            isInside = !isInside;
        }
    }
    return isInside;
}

/**
 * Returns eight sampled points around a rotated box.
 *
 * The returned points include the four corners and four edge midpoints, rotated
 * about the supplied center.
 *
 * @param center - Box center point.
 * @param halfWidth - Half of the unrotated box width.
 * @param halfHeight - Half of the unrotated box height.
 * @param rotation - Rotation angle in radians.
 * @returns Rotated corner and edge-midpoint coordinates.
 */
export function getRotatedBoxPoints(center: Point2D, halfWidth: number, halfHeight: number, rotation: number): Point2D[] {
    return [
        {x: -halfWidth, y: -halfHeight},
        {x: 0, y: -halfHeight},
        {x: halfWidth, y: -halfHeight},
        {x: halfWidth, y: 0},
        {x: halfWidth, y: halfHeight},
        {x: 0, y: halfHeight},
        {x: -halfWidth, y: halfHeight},
        {x: -halfWidth, y: 0}
    ].map(offset => add2D(center, rotate2D(offset, rotation)));
}

// Brute-force method of checking if a polygon is simple
// Method is O(N^2), so it should only be called if all line segments need to be tested
export function simplePolygonTest(points: Point2D[]) {
    if (points.length < 4) {
        return true;
    }

    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        for (let j = i + 2; j < points.length; j++) {
            const c = points[j];
            const d = points[(j + 1) % points.length];
            const hasIntersection = lineSegmentsProperlyIntersect(a, b, c, d);
            if (hasIntersection) {
                return false;
            }
        }
    }

    return true;
}

// Brute-force method of checking if a polygon is simple, assuming that only one point has changed.
// Method is O(N), and should be called whenever a specific polygon control point is updated.
export function simplePolygonPointTest(points: Point2D[], pointIndex: number) {
    if (points.length < 4) {
        return true;
    }

    const a = points[(pointIndex + points.length) % points.length];
    const b = points[(pointIndex + points.length + 1) % points.length];
    for (let j = 1; j < points.length; j++) {
        const c = points[(j + pointIndex) % points.length];
        const d = points[(j + pointIndex + 1) % points.length];
        const hasIntersection = lineSegmentsProperlyIntersect(a, b, c, d);
        if (hasIntersection) {
            return false;
        }
    }

    return true;
}

// get distance between two points
export function pointDistance(p1: Point2D, p2: Point2D) {
    const distance = subtract2D(p1, p2);
    return Math.sqrt(distance.x * distance.x + distance.y * distance.y);
}

export function pointDistanceSquared(p1: Point2D, p2: Point2D) {
    const distance = subtract2D(p1, p2);
    return distance.x * distance.x + distance.y * distance.y;
}

// Returns the closest point index from a points array to current cursor point.
export function closestPointIndexToCursor(cursor: Point2D, points: readonly Point2D[]) {
    let minDistanceSquared = Number.MAX_VALUE;
    let minIndex = 0;
    for (let index = 0; index < points.length; index++) {
        const point = points[index];
        const distance = pointDistanceSquared(cursor, point);
        if (distance < minDistanceSquared) {
            minDistanceSquared = distance;
            minIndex = index;
        }
    }
    return minIndex;
}

export function polygonPerimeter(points: Point2D[], isClosed: boolean = true): number {
    let totalLength = 0;
    const N = points.length;
    for (let i = 1; i < N; i++) {
        totalLength += pointDistance(points[i], points[i - 1]);
    }
    if (isClosed) {
        totalLength += pointDistance(points[N - 1], points[0]);
    }
    return totalLength;
}

export function angle2D(a: Point2D, b: Point2D) {
    a = normalize2D(a);
    b = normalize2D(b);
    return Math.asin(cross2D(a, b));
}

// Ray-casting algorithm for point-in-polygon test
export function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
    let isInside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
            isInside = !isInside;
        }
    }
    return isInside;
}

export function round2D(a: Point2D) {
    return {x: Math.round(a.x), y: Math.round(a.y)};
}

export function closestCatalogIndexToCursor(cursor: Point2D, xArray: Float32Array, yArray: Float32Array): {minIndex: number; minDistanceSquared: number} {
    let minDistanceSquared = Number.MAX_VALUE;
    let minIndex = 0;
    for (let index = 0; index < xArray.length; index++) {
        const distance = pointDistanceSquared(cursor, {x: xArray[index], y: yArray[index]});
        if (distance < minDistanceSquared) {
            minDistanceSquared = distance;
            minIndex = index;
        }
    }
    return {minIndex: minIndex, minDistanceSquared: minDistanceSquared};
}
