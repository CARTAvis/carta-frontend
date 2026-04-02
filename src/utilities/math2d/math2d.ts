import {type Point2D} from "models";

type Point3D = {x: number; y: number; z?: number};

export function Dot2D(a: Point2D, b: Point2D): number {
    return a.x * b.x + a.y * b.y;
}

export function Cross2D(a: Point2D, b: Point2D): number {
    return a.x * b.y - a.y * b.x;
}

export function Add2D(a: Point2D, b: Point2D): Point2D {
    return {x: a.x + b.x, y: a.y + b.y};
}

export function Subtract2D(a: Point2D, b: Point2D): Point2D {
    return {x: a.x - b.x, y: a.y - b.y};
}

export function Midpoint2D(a: Point2D, b: Point2D): Point2D {
    return {x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5};
}

export function Scale2D(a: Point2D, s: number): Point2D {
    return {x: a.x * s, y: a.y * s};
}

export function Multiply2D(a: Point2D, b: Point2D): Point2D {
    return {x: a.x * b.x, y: a.y * b.y};
}

export function Divide2D(a: Point2D, b: Point2D): Point2D {
    return {x: a.x / b.x, y: a.y / b.y};
}

export function Normal2D(a: Point2D, b: Point2D): Point2D {
    const delta = Normalize2D(Subtract2D(a, b));
    return PerpVector2D(delta);
}

export function PerpVector2D(dir: Point2D): Point2D {
    return {x: -dir.y, y: dir.x};
}

export function Length2D(a: Point2D): number {
    return Math.sqrt(Dot2D(a, a));
}

export function Normalize2D(a: Point2D): Point2D {
    const size = Length2D(a);
    return {x: a.x / size, y: a.y / size};
}

export function MagDir2D(a: Point2D) {
    const size = Length2D(a);
    return {mag: size, dir: {x: a.x / size, y: a.y / size}};
}

export function Average2D(points: Point2D[]) {
    let sum: Point2D = {x: 0, y: 0};
    for (const point of points) {
        sum = Add2D(sum, point);
    }
    return Scale2D(sum, 1.0 / points.length);
}

export function Rotate2D(point: Point2D, theta: number) {
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    return {x: cosTheta * point.x - sinTheta * point.y, y: sinTheta * point.x + cosTheta * point.y};
}

export function RotateAboutPoint2D(point: Point2D, origin: Point2D, theta: number) {
    return Add2D(Rotate2D(Subtract2D(point, origin), theta), origin);
}

export function ScaleAboutPoint2D(point: Point2D, origin: Point2D, scale: number) {
    return Add2D(Scale2D(Subtract2D(point, origin), scale), origin);
}

export function ScaleAndRotateAboutPoint2D(point: Point2D, origin: Point2D, scale: number, theta: number) {
    return Add2D(Scale2D(Rotate2D(Subtract2D(point, origin), theta), scale), origin);
}

export function MinMax2D(points: Point2D[]): {maxPoint: Point2D; minPoint: Point2D} {
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

export function MinMaxPointArrayX(points: Point2D[]): {maxVal: number; minVal: number} {
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

export function MinMaxPointArrayY(points: Point2D[]): {maxVal: number; minVal: number} {
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

export function MinMaxPointArrayZ(points: Point3D[]): {maxVal: number; minVal: number} {
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
export function ClosestPointOnLine(p0: Point2D, p1: Point2D, p2: Point2D): {point: Point2D; bounded: boolean; distance: number} {
    const lineVector = Subtract2D(p2, p1);
    const lineDirection = Normalize2D(lineVector);
    const r = Subtract2D(p0, p1);
    const s = Dot2D(r, lineDirection);
    const point = Add2D(p1, Scale2D(lineDirection, s));
    return {
        point,
        bounded: s >= 0 && s <= Length2D(lineVector),
        distance: Length2D(Subtract2D(p0, point))
    };
}

function lineSegmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
    const lineCD = Subtract2D(d, c);
    const crossA = Cross2D(lineCD, Subtract2D(a, d));
    const crossB = Cross2D(lineCD, Subtract2D(b, d));

    if (crossA * crossB < 0) {
        const lineAB = Subtract2D(b, a);
        const crossC = Cross2D(lineAB, Subtract2D(c, b));
        const crossD = Cross2D(lineAB, Subtract2D(d, b));
        return crossC * crossD < 0;
    } else {
        return false;
    }
}

// Brute-force method of checking if a polygon is simple
// Method is O(N^2), so it should only be called if all line segments need to be tested
export function SimplePolygonTest(points: Point2D[]) {
    if (points.length < 4) {
        return true;
    }

    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        for (let j = i + 2; j < points.length; j++) {
            const c = points[j];
            const d = points[(j + 1) % points.length];
            const isIntersection = lineSegmentsIntersect(a, b, c, d);
            if (isIntersection) {
                return false;
            }
        }
    }

    return true;
}

// Brute-force method of checking if a polygon is simple, assuming that only one point has changed.
// Method is O(N), and should be called whenever a specific polygon control point is updated.
export function SimplePolygonPointTest(points: Point2D[], pointIndex: number) {
    if (points.length < 4) {
        return true;
    }

    const a = points[(pointIndex + points.length) % points.length];
    const b = points[(pointIndex + points.length + 1) % points.length];
    for (let j = 1; j < points.length; j++) {
        const c = points[(j + pointIndex) % points.length];
        const d = points[(j + pointIndex + 1) % points.length];
        const isIntersection = lineSegmentsIntersect(a, b, c, d);
        if (isIntersection) {
            return false;
        }
    }

    return true;
}

// get distance between two points
export function PointDistance(p1: Point2D, p2: Point2D) {
    const distance = Subtract2D(p1, p2);
    return Math.sqrt(distance.x * distance.x + distance.y * distance.y);
}

export function PointDistanceSquared(p1: Point2D, p2: Point2D) {
    const distance = Subtract2D(p1, p2);
    return distance.x * distance.x + distance.y * distance.y;
}

// Returns the closest point index from a points array to current cursor point.
export function ClosestPointIndexToCursor(cursor: Point2D, points: readonly Point2D[]) {
    let minDistanceSquared = Number.MAX_VALUE;
    let minIndex = 0;
    for (let index = 0; index < points.length; index++) {
        const point = points[index];
        const distance = PointDistanceSquared(cursor, point);
        if (distance < minDistanceSquared) {
            minDistanceSquared = distance;
            minIndex = index;
        }
    }
    return minIndex;
}

export function PolygonPerimeter(points: Point2D[], isClosed: boolean = true): number {
    let totalLength = 0;
    const n = points.length;
    for (let i = 1; i < n; i++) {
        totalLength += PointDistance(points[i], points[i - 1]);
    }
    if (isClosed) {
        totalLength += PointDistance(points[n - 1], points[0]);
    }
    return totalLength;
}

export function Angle2D(a: Point2D, b: Point2D) {
    a = Normalize2D(a);
    b = Normalize2D(b);
    return Math.asin(Cross2D(a, b));
}

export function Round2D(a: Point2D) {
    return {x: Math.round(a.x), y: Math.round(a.y)};
}

export function ClosestCatalogIndexToCursor(cursor: Point2D, xArray: Float32Array, yArray: Float32Array): {minIndex: number; minDistanceSquared: number} {
    let minDistanceSquared = Number.MAX_VALUE;
    let minIndex = 0;
    for (let index = 0; index < xArray.length; index++) {
        const distance = PointDistanceSquared(cursor, {x: xArray[index], y: yArray[index]});
        if (distance < minDistanceSquared) {
            minDistanceSquared = distance;
            minIndex = index;
        }
    }
    return {minIndex: minIndex, minDistanceSquared: minDistanceSquared};
}
