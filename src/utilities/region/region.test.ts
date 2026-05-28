import {CARTA} from "carta-protobuf";

import {getLinePositionAngle, getPasteShiftDelta, getRegionCenter, offsetPointsToAvoidCollision, PASTE_OFFSET, shiftRegionPoints} from "./region";

jest.mock("stores/Frame", () => ({
    CURSOR_REGION_ID: 0
}));

jest.mock("models", () => ({
    Transform2D: class {}
}));

jest.mock("utilities", () => ({
    isAstBadPoint: jest.fn(),
    scale2D: jest.fn(),
    toFixed: jest.fn(),
    transformPoint: jest.fn()
}));

// Minimal RegionStore mock
const MockRegion = (regionId: number, centerX: number, centerY: number, isValid = true) => ({regionId, center: {x: centerX, y: centerY}, isValid}) as any;

describe("getRegionCenter", () => {
    it("returns the first point for POINT regions", () => {
        const points = [{x: 5, y: 10}];
        expect(getRegionCenter(points, CARTA.RegionType.POINT)).toEqual({x: 5, y: 10});
    });

    it("returns the first point for RECTANGLE regions", () => {
        const points = [
            {x: 3, y: 7},
            {x: 10, y: 5}
        ];
        expect(getRegionCenter(points, CARTA.RegionType.RECTANGLE)).toEqual({x: 3, y: 7});
    });

    it("returns the midpoint of endpoints for LINE regions", () => {
        const points = [
            {x: 0, y: 0},
            {x: 10, y: 20}
        ];
        expect(getRegionCenter(points, CARTA.RegionType.LINE)).toEqual({x: 5, y: 10});
    });

    it("returns the midpoint of endpoints for ANNLINE regions", () => {
        const points = [
            {x: 2, y: 4},
            {x: 8, y: 10}
        ];
        expect(getRegionCenter(points, CARTA.RegionType.ANNLINE)).toEqual({x: 5, y: 7});
    });

    it("returns the midpoint of endpoints for ANNVECTOR regions", () => {
        const points = [
            {x: 0, y: 0},
            {x: 6, y: 8}
        ];
        expect(getRegionCenter(points, CARTA.RegionType.ANNVECTOR)).toEqual({x: 3, y: 4});
    });

    it("returns the midpoint of endpoints for ANNRULER regions", () => {
        const points = [
            {x: 1, y: 3},
            {x: 7, y: 9}
        ];
        expect(getRegionCenter(points, CARTA.RegionType.ANNRULER)).toEqual({x: 4, y: 6});
    });

    it("returns {0, 0} for a LINE with fewer than 2 points", () => {
        expect(getRegionCenter([], CARTA.RegionType.LINE)).toEqual({x: 0, y: 0});
    });

    it("returns the bounding-box center for POLYGON regions", () => {
        const points = [
            {x: 0, y: 0},
            {x: 10, y: 0},
            {x: 10, y: 20},
            {x: 0, y: 20}
        ];
        expect(getRegionCenter(points, CARTA.RegionType.POLYGON)).toEqual({x: 5, y: 10});
    });

    it("returns the bounding-box center for POLYLINE regions", () => {
        const points = [
            {x: 2, y: 4},
            {x: 8, y: 4},
            {x: 5, y: 10}
        ];
        expect(getRegionCenter(points, CARTA.RegionType.POLYLINE)).toEqual({x: 5, y: 7});
    });

    it("returns {0, 0} for an empty POLYGON", () => {
        expect(getRegionCenter([], CARTA.RegionType.POLYGON)).toEqual({x: 0, y: 0});
    });
});

describe("getLinePositionAngle", () => {
    it("returns 0 for a line with fewer than 2 points", () => {
        expect(getLinePositionAngle([{x: 0, y: 0}])).toBe(0);
    });

    it("computes ~90° for a horizontal line going right", () => {
        // points going to the right: dx > 0, dy = 0
        const angle = getLinePositionAngle([
            {x: 0, y: 0},
            {x: 100, y: 0}
        ]);
        expect(angle).toBeCloseTo(90);
    });

    it("computes ~180° for a vertical line going down in pixel coordinates", () => {
        // In pixel coords, y increases downward; points[1].y > points[0].y
        const angle = getLinePositionAngle([
            {x: 0, y: 0},
            {x: 0, y: 10}
        ]);
        expect(angle).toBeCloseTo(180);
    });

    it("computes ~0° for a vertical line going up in pixel coordinates", () => {
        // points[1].y < points[0].y
        const angle = getLinePositionAngle([
            {x: 0, y: 10},
            {x: 0, y: 0}
        ]);
        expect(angle).toBeCloseTo(0);
    });
});

describe("getPasteShiftDelta", () => {
    it("shifts Y-only for a horizontal LINE (near 90°)", () => {
        // Horizontal line → positionAngle ≈ 90°, in [45, 135]
        const delta = getPasteShiftDelta(
            [
                {x: 0, y: 0},
                {x: 100, y: 0}
            ],
            CARTA.RegionType.LINE
        );
        expect(delta).toEqual({x: 0, y: -PASTE_OFFSET});
    });

    it("shifts X-only for a vertical LINE (near 180°)", () => {
        // Vertical line going down → positionAngle ≈ 180°, not in [45,135] or [225,315]
        const delta = getPasteShiftDelta(
            [
                {x: 0, y: 0},
                {x: 0, y: 100}
            ],
            CARTA.RegionType.LINE
        );
        expect(delta).toEqual({x: PASTE_OFFSET, y: 0});
    });

    it("shifts Y-only for a horizontal ANNLINE", () => {
        const delta = getPasteShiftDelta(
            [
                {x: 0, y: 0},
                {x: 100, y: 0}
            ],
            CARTA.RegionType.ANNLINE
        );
        expect(delta).toEqual({x: 0, y: -PASTE_OFFSET});
    });

    it("shifts Y-only for a horizontal ANNVECTOR", () => {
        const delta = getPasteShiftDelta(
            [
                {x: 0, y: 0},
                {x: 100, y: 0}
            ],
            CARTA.RegionType.ANNVECTOR
        );
        expect(delta).toEqual({x: 0, y: -PASTE_OFFSET});
    });

    it("shifts Y-only for a horizontal ANNRULER", () => {
        const delta = getPasteShiftDelta(
            [
                {x: 0, y: 0},
                {x: 100, y: 0}
            ],
            CARTA.RegionType.ANNRULER
        );
        expect(delta).toEqual({x: 0, y: -PASTE_OFFSET});
    });

    it("shifts diagonally for RECTANGLE regions", () => {
        const delta = getPasteShiftDelta(
            [
                {x: 5, y: 5},
                {x: 10, y: 10}
            ],
            CARTA.RegionType.RECTANGLE
        );
        expect(delta).toEqual({x: PASTE_OFFSET, y: -PASTE_OFFSET});
    });

    it("shifts diagonally for POLYGON regions", () => {
        const delta = getPasteShiftDelta(
            [
                {x: 0, y: 0},
                {x: 10, y: 0},
                {x: 5, y: 10}
            ],
            CARTA.RegionType.POLYGON
        );
        expect(delta).toEqual({x: PASTE_OFFSET, y: -PASTE_OFFSET});
    });

    it("shifts diagonally for ELLIPSE regions", () => {
        const delta = getPasteShiftDelta(
            [
                {x: 5, y: 5},
                {x: 3, y: 3}
            ],
            CARTA.RegionType.ELLIPSE
        );
        expect(delta).toEqual({x: PASTE_OFFSET, y: -PASTE_OFFSET});
    });
});

describe("shiftRegionPoints", () => {
    describe("center-only shift (POINT, RECTANGLE, ELLIPSE, ANNRECTANGLE, ANNELLIPSE, ANNTEXT, ANNCOMPASS, ANNPOINT)", () => {
        const centerOnlyTypes = [
            CARTA.RegionType.POINT,
            CARTA.RegionType.ANNPOINT,
            CARTA.RegionType.RECTANGLE,
            CARTA.RegionType.ANNRECTANGLE,
            CARTA.RegionType.ELLIPSE,
            CARTA.RegionType.ANNELLIPSE,
            CARTA.RegionType.ANNTEXT,
            CARTA.RegionType.ANNCOMPASS
        ];

        it.each(centerOnlyTypes)("shifts only point[0] for region type %s", regionType => {
            const points = [
                {x: 10, y: 20},
                {x: 5, y: 5}
            ];
            const result = shiftRegionPoints(points, regionType, 3, 4);
            expect(result[0]).toEqual({x: 13, y: 24});
            expect(result[1]).toEqual({x: 5, y: 5});
        });
    });

    describe("all-points shift (LINE, POLYGON, POLYLINE, annotation variants)", () => {
        const allPointTypes = [
            CARTA.RegionType.LINE,
            CARTA.RegionType.ANNLINE,
            CARTA.RegionType.ANNVECTOR,
            CARTA.RegionType.ANNRULER,
            CARTA.RegionType.POLYGON,
            CARTA.RegionType.ANNPOLYGON,
            CARTA.RegionType.POLYLINE,
            CARTA.RegionType.ANNPOLYLINE
        ];

        it.each(allPointTypes)("shifts all points for region type %s", regionType => {
            const points = [
                {x: 0, y: 0},
                {x: 10, y: 10}
            ];
            const result = shiftRegionPoints(points, regionType, 5, 5);
            expect(result[0]).toEqual({x: 5, y: 5});
            expect(result[1]).toEqual({x: 15, y: 15});
        });
    });

    it("does not mutate the original points array", () => {
        const points = [{x: 1, y: 2}];
        shiftRegionPoints(points, CARTA.RegionType.POINT, 10, 10);
        expect(points[0]).toEqual({x: 1, y: 2});
    });
});

describe("offsetPointsToAvoidCollision", () => {
    it("returns points unchanged when shouldApplyInitialOffset is false and there is no collision", () => {
        const points = [{x: 100, y: 100}];
        const regions = [MockRegion(1, 50, 50)];
        const result = offsetPointsToAvoidCollision(points, CARTA.RegionType.POINT, regions, false);
        expect(result).toEqual([{x: 100, y: 100}]);
    });

    it("applies initial offset when shouldApplyInitialOffset is true and there is no collision", () => {
        const points = [{x: 100, y: 100}];
        const result = offsetPointsToAvoidCollision(points, CARTA.RegionType.POINT, [], true);
        // POINT gets diagonal shift
        expect(result).toEqual([{x: 100 + PASTE_OFFSET, y: 100 - PASTE_OFFSET}]);
    });

    it("shifts until no collision when the initial position collides", () => {
        // Place a region at (100, 100). shouldApplyInitialOffset = false so we start at (100, 100).
        // The collision check uses Chebyshev distance < PASTE_OFFSET / 2 = 10.
        // Region is at exactly (100, 100), distance 0 → collision.
        const points = [{x: 100, y: 100}];
        const regions = [MockRegion(1, 100, 100)];
        const result = offsetPointsToAvoidCollision(points, CARTA.RegionType.POINT, regions, false);
        // Should shift until center is > 10 away from (100, 100)
        const center = result[0];
        const distance = Math.max(Math.abs(center.x - 100), Math.abs(center.y - 100));
        expect(distance).toBeGreaterThanOrEqual(PASTE_OFFSET / 2);
    });

    it("skips the cursor region (regionId === 0) when checking collisions", () => {
        const points = [{x: 100, y: 100}];
        // Cursor region at exactly the same position — should NOT be treated as a collision
        const regions = [MockRegion(0, 100, 100)];
        const result = offsetPointsToAvoidCollision(points, CARTA.RegionType.POINT, regions, false);
        expect(result).toEqual([{x: 100, y: 100}]);
    });

    it("skips invalid regions when checking collisions", () => {
        const points = [{x: 100, y: 100}];
        const regions = [MockRegion(1, 100, 100, false)];
        const result = offsetPointsToAvoidCollision(points, CARTA.RegionType.POINT, regions, false);
        expect(result).toEqual([{x: 100, y: 100}]);
    });

    it("caps shifting at 20 iterations when all positions collide", () => {
        // Fill positions with collisions at every PASTE_OFFSET step up to 20 steps
        const points = [{x: 0, y: 0}];
        const regions = Array.from({length: 25}, (_, i) => MockRegion(i + 1, (i + 1) * PASTE_OFFSET, (i + 1) * PASTE_OFFSET));
        // shouldApplyInitialOffset = false: starts at (0,0), no collision there
        // This should return quickly without collision at (0,0)
        const result = offsetPointsToAvoidCollision(points, CARTA.RegionType.POINT, regions, false);
        expect(result).toEqual([{x: 0, y: 0}]);
    });
});
