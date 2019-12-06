import {Point2D} from "../models";

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

export function average2D(points: Point2D[]) {
    let sum: Point2D = {x: 0, y: 0};
    for (const point of points) {
        sum = add2D(sum, point);
    }
    return scale2D(sum, 1.0 / points.length);
}

export function minMax2D(points: Point2D[]): { maxPoint: Point2D, minPoint: Point2D } {
    let maxPoint = {x: -Number.MAX_VALUE, y: -Number.MAX_VALUE};
    let minPoint = {x: Number.MAX_VALUE, y: Number.MAX_VALUE};

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

export function minMaxPointArrayX(points: Point2D[]): { maxVal: number, minVal: number } {
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

export function minMaxPointArrayY(points: Point2D[]): { maxVal: number, minVal: number } {
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

export function minMaxPointArrayZ(points: Point3D[]): { maxVal: number, minVal: number } {
    let maxVal = -Number.MAX_VALUE;
    let minVal = Number.MAX_VALUE;

    for (const point of points) {
        if (!point || isNaN(point.z)) {
            continue;
        }
        maxVal = Math.max(maxVal, point.z);
        minVal = Math.min(minVal, point.z);
    }
    return {maxVal, minVal};
}

// Returns the closest point from a point to a line segment, as well as the distance to the line segment, and whether the point lies within the line segment
export function closestPointOnLine(p0: Point2D, p1: Point2D, p2: Point2D): { point: Point2D, bounded: boolean, distance: number } {
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

function lineSegmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
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
            const intersection = lineSegmentsIntersect(a, b, c, d);
            if (intersection) {
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

    let a = points[(pointIndex + points.length) % points.length];
    let b = points[(pointIndex + points.length + 1) % points.length];
    for (let j = 1; j < points.length; j++) {
        const c = points[(j + pointIndex) % points.length];
        const d = points[(j + pointIndex + 1) % points.length];
        const intersection = lineSegmentsIntersect(a, b, c, d);
        if (intersection) {
            return false;
        }
    }

    return true;
}

type Point3D = { x: number, y: number, z?: number };

// get distance between two points
export function pointDistanceSquared(p1: Point3D, p2: Point3D) {
    const distance = subtract2D(p1, p2);
    return distance.x * distance.x + distance.y * distance.y;
}

// Returns the closest point index from a points array to current cursor point. 
export function closestPointIndexToCursor(cursor: Point3D, points: readonly Point3D[]) {
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