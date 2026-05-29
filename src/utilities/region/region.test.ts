import {CARTA} from "carta-protobuf";

import {PasteOffsetUnit} from "enums";

import {getPasteRegionOffset as getPasteRegionOffset, getPasteShiftDelta, getRegionCenter, getTransformedRegionProperties, offsetPointsToAvoidCollision, PASTE_OFFSET, shiftRegionPoints} from "./region";

jest.mock("stores/Frame", () => ({
    CURSOR_REGION_ID: 0
}));

jest.mock("models", () => ({
    Transform2D: class {
        scale = 2;
        rotation = 0;
    }
}));

jest.mock("utilities", () => ({
    isAstBadPoint: jest.fn(),
    scale2D: jest.fn(),
    toFixed: jest.fn(),
    transformPoint: jest.fn()
}));

// Minimal RegionStore mock
const MockRegion = (regionId: number, centerX: number, centerY: number, isValid = true) => ({regionId, center: {x: centerX, y: centerY}, isValid}) as any;

const MockedIsAstBadPoint = jest.requireMock("utilities").isAstBadPoint as jest.Mock;
const MockedScale2D = jest.requireMock("utilities").scale2D as jest.Mock;
const MockedTransformPoint = jest.requireMock("utilities").transformPoint as jest.Mock;

beforeEach(() => {
    MockedIsAstBadPoint.mockReset();
    MockedScale2D.mockReset();
    MockedTransformPoint.mockReset();
    MockedIsAstBadPoint.mockReturnValue(false);
    MockedScale2D.mockImplementation((point, factor) => ({x: point.x * factor, y: point.y * factor}));
    MockedTransformPoint.mockImplementation((_mapping, point) => ({x: point.x + 100, y: point.y + 100}));
});

describe("getTransformedRegionProperties", () => {
    it("treats ANNCOMPASS as a center-plus-size region when transforming", () => {
        const result = getTransformedRegionProperties(
            {
                regionType: CARTA.RegionType.ANNCOMPASS,
                center: {x: 1, y: 2},
                size: {x: 4, y: 6},
                controlPoints: [
                    {x: 1, y: 2},
                    {x: 4, y: 6}
                ],
                rotation: 15
            },
            {} as any
        );

        expect(result).toEqual({
            controlPoints: [
                {x: 101, y: 102},
                {x: 2, y: 3}
            ],
            rotation: 15
        });
        expect(MockedTransformPoint).toHaveBeenCalledTimes(1);
        expect(MockedScale2D).toHaveBeenCalledWith({x: 4, y: 6}, 0.5);
    });
});

describe("getPasteRegionOffset", () => {
    it("ScreenPixel: divides PASTE_OFFSET by zoomLevel", () => {
        expect(getPasteRegionOffset(PasteOffsetUnit.ScreenPixel, 2)).toBe(PASTE_OFFSET / 2);
        expect(getPasteRegionOffset(PasteOffsetUnit.ScreenPixel, 0.5)).toBe(PASTE_OFFSET / 0.5);
    });

    it("Auto with zoomLevel < 1: divides PASTE_OFFSET by zoomLevel", () => {
        expect(getPasteRegionOffset(PasteOffsetUnit.Auto, 0.5)).toBe(PASTE_OFFSET / 0.5);
    });

    it("Auto with zoomLevel >= 1: uses ceil(zoomLevel/5) divisor, minimum 1", () => {
        // zoomLevel = 1 → ceil(1/5) = 1 → PASTE_OFFSET / 1 = 20 > 1
        expect(getPasteRegionOffset(PasteOffsetUnit.Auto, 1)).toBe(PASTE_OFFSET / Math.ceil(1 / 5));
        // zoomLevel = 5 → ceil(5/5) = 1 → PASTE_OFFSET / 1 = 20
        expect(getPasteRegionOffset(PasteOffsetUnit.Auto, 5)).toBe(PASTE_OFFSET / Math.ceil(5 / 5));
        // zoomLevel = 100 → ceil(100/5) = 20 → PASTE_OFFSET / 20 = 1, not < 1 so returns 1
        expect(getPasteRegionOffset(PasteOffsetUnit.Auto, 100)).toBe(1);
    });

    it("ImagePixel: keeps a constant image-space offset regardless of zoom", () => {
        expect(getPasteRegionOffset(PasteOffsetUnit.ImagePixel, 1)).toBe(PASTE_OFFSET);
        expect(getPasteRegionOffset(PasteOffsetUnit.ImagePixel, 10)).toBe(PASTE_OFFSET);
    });

    it("never returns a value less than 1", () => {
        expect(getPasteRegionOffset(PasteOffsetUnit.Auto, 1000)).toBeGreaterThanOrEqual(1);
        expect(getPasteRegionOffset(PasteOffsetUnit.ImagePixel, 1000)).toBeGreaterThanOrEqual(1);
    });
});

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

describe("getPasteShiftDelta", () => {
    it("shifts Y-only for a horizontal LINE (perpendicular, dx > 0, dy = 0)", () => {
        const delta = getPasteShiftDelta(
            [
                {x: 0, y: 0},
                {x: 100, y: 0}
            ],
            CARTA.RegionType.LINE
        );
        expect(delta).toEqual({x: 0, y: -PASTE_OFFSET});
    });

    it("shifts X-only for a vertical LINE (perpendicular, dx = 0, dy > 0)", () => {
        const delta = getPasteShiftDelta(
            [
                {x: 0, y: 0},
                {x: 0, y: 100}
            ],
            CARTA.RegionType.LINE
        );
        expect(delta).toEqual({x: PASTE_OFFSET, y: -0});
    });

    it("shifts diagonally for a diagonal LINE (dx = dy)", () => {
        const delta = getPasteShiftDelta(
            [
                {x: 0, y: 0},
                {x: 100, y: 100}
            ],
            CARTA.RegionType.LINE
        );
        expect(delta).toEqual({x: PASTE_OFFSET, y: -PASTE_OFFSET});
    });

    it("shifts Y-only for a horizontal ANNLINE (perpendicular)", () => {
        const delta = getPasteShiftDelta(
            [
                {x: 0, y: 0},
                {x: 100, y: 0}
            ],
            CARTA.RegionType.ANNLINE
        );
        expect(delta).toEqual({x: 0, y: -PASTE_OFFSET});
    });

    it("shifts Y-only for a horizontal ANNVECTOR (perpendicular)", () => {
        const delta = getPasteShiftDelta(
            [
                {x: 0, y: 0},
                {x: 100, y: 0}
            ],
            CARTA.RegionType.ANNVECTOR
        );
        expect(delta).toEqual({x: 0, y: -PASTE_OFFSET});
    });

    it("shifts Y-only for a horizontal ANNRULER (perpendicular)", () => {
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

    it("returns start position when there is no collision at the initial position", () => {
        const points = [{x: 0, y: 0}];
        const regions = Array.from({length: 25}, (_, i) => MockRegion(i + 1, (i + 1) * PASTE_OFFSET, (i + 1) * PASTE_OFFSET));
        // shouldApplyInitialOffset = false: starts at (0,0), no collision there
        const result = offsetPointsToAvoidCollision(points, CARTA.RegionType.POINT, regions, false);
        expect(result).toEqual([{x: 0, y: 0}]);
    });

    it("finds a unique position beyond 20 pastes (no collision after 22+ pastes)", () => {
        // Simulate 22 already-pasted regions placed at PASTE_OFFSET, 2*PASTE_OFFSET, ..., 22*PASTE_OFFSET
        // (POINT gets diagonal delta {x: PASTE_OFFSET, y: -PASTE_OFFSET})
        // The source region is at (0, 0).
        const originalPoints = [{x: 0, y: 0}];
        const regions = [
            MockRegion(0, 0, 0), // source at P0
            ...Array.from({length: 22}, (_, i) => MockRegion(i + 1, (i + 1) * PASTE_OFFSET, -(i + 1) * PASTE_OFFSET))
        ];
        // The 23rd paste (shouldApplyInitialOffset=true) should land at P0+23*delta, not P0+22*delta
        const result = offsetPointsToAvoidCollision(originalPoints, CARTA.RegionType.POINT, regions, true);
        const expectedX = 23 * PASTE_OFFSET;
        const expectedY = -23 * PASTE_OFFSET;
        expect(result[0]).toEqual({x: expectedX, y: expectedY});
    });
});
