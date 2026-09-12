import {doesLineSegmentIntersectRect, getPathSegments, getRectFromPoints, getRotatedBoxPoints, isPointInPolygon, lineSegmentsIntersect, type Rect2D} from "./math2d";

describe("math2d selection geometry helpers", () => {
    describe("lineSegmentsIntersect", () => {
        test("detects crossing segments", () => {
            expect(lineSegmentsIntersect({x: 0, y: 0}, {x: 10, y: 10}, {x: 0, y: 10}, {x: 10, y: 0})).toBe(true);
        });

        test("detects endpoint and collinear overlap intersections", () => {
            expect(lineSegmentsIntersect({x: 0, y: 0}, {x: 10, y: 0}, {x: 10, y: 0}, {x: 10, y: 5})).toBe(true);
            expect(lineSegmentsIntersect({x: 0, y: 0}, {x: 10, y: 0}, {x: 5, y: 0}, {x: 15, y: 0})).toBe(true);
        });

        test("rejects separated parallel segments", () => {
            expect(lineSegmentsIntersect({x: 0, y: 0}, {x: 10, y: 0}, {x: 0, y: 1}, {x: 10, y: 1})).toBe(false);
        });
    });

    describe("rect helpers", () => {
        const rect: Rect2D = {x: 2, y: 2, width: 4, height: 4};

        test("builds a positive rect from arbitrary corners", () => {
            expect(getRectFromPoints({x: 6, y: 1}, {x: 2, y: 5})).toEqual({x: 2, y: 1, width: 4, height: 4});
        });

        test("detects line/rect intersections through either crossing or contained endpoints", () => {
            expect(doesLineSegmentIntersectRect({x: 0, y: 4}, {x: 8, y: 4}, rect)).toBe(true);
            expect(doesLineSegmentIntersectRect({x: 3, y: 3}, {x: 4, y: 4}, rect)).toBe(true);
            expect(doesLineSegmentIntersectRect({x: 0, y: 0}, {x: 1, y: 1}, rect)).toBe(false);
        });
    });

    test("detects points inside and outside polygons", () => {
        const polygon = [
            {x: 0, y: 0},
            {x: 10, y: 0},
            {x: 10, y: 10},
            {x: 0, y: 10}
        ];

        expect(isPointInPolygon({x: 5, y: 5}, polygon)).toBe(true);
        expect(isPointInPolygon({x: 11, y: 5}, polygon)).toBe(false);
    });

    test("returns path segments for open and closed paths", () => {
        const points = [
            {x: 0, y: 0},
            {x: 1, y: 0},
            {x: 1, y: 1}
        ];

        expect(getPathSegments(points)).toHaveLength(2);
        expect(getPathSegments(points, true)).toEqual([
            [points[0], points[1]],
            [points[1], points[2]],
            [points[2], points[0]]
        ]);
    });

    test("returns rotated box points around the supplied center", () => {
        expect(getRotatedBoxPoints({x: 10, y: 20}, 2, 1, 0)).toEqual([
            {x: 8, y: 19},
            {x: 10, y: 19},
            {x: 12, y: 19},
            {x: 12, y: 20},
            {x: 12, y: 21},
            {x: 10, y: 21},
            {x: 8, y: 21},
            {x: 8, y: 20}
        ]);

        const rotated = getRotatedBoxPoints({x: 0, y: 0}, 1, 2, Math.PI / 2);
        expect(rotated[0].x).toBeCloseTo(2);
        expect(rotated[0].y).toBeCloseTo(-1);
    });
});
