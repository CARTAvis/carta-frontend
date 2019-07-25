import {Point2D} from "../models";

export function dot2D(a: Point2D, b: Point2D): number {
    return a.x * b.x + a.y * b.y;
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