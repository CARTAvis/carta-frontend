import {CARTA} from "carta-protobuf";

import {PasteOffsetUnit, RegionOpacity} from "enums";

// Mock heavy barrels to avoid the production circular import chain
// (models -> services/stores/components -> back to models) that breaks
// module evaluation under Jest.
jest.mock("models", () => ({
    Transform2D: class {
        scale = 2;
        rotation = 0;
    }
}));
jest.mock("services", () => ({}));
jest.mock("stores", () => ({}));
jest.mock("stores/Frame", () => ({}));
jest.mock("utilities", () => ({
    isAstBadPoint: jest.fn(),
    scale2D: jest.fn(),
    toFixed: jest.fn(),
    transformPoint: jest.fn()
}));

import {
    doSelectionRectAndRegionPointsIntersect,
    doSelectionRectAndRulerPathsIntersect,
    getInterpolatedPathAtDistance,
    getNextRegionOpacity,
    getPasteRegionOffset,
    getPasteShiftDelta,
    getRegionSelectionPoints,
    getRegionSelectionSegments,
    getTransformedRegionProperties,
    offsetPointsToAvoidCollision,
    PASTE_OFFSET
} from "./region";

const MakeRegion = (overrides: Partial<any>) =>
    ({
        center: {x: 0, y: 0},
        controlPoints: [],
        isLineLikeRegion: false,
        isPolygonalRegion: false,
        isSimpleShapeRegion: false,
        isValid: true,
        regionId: 1,
        regionType: CARTA.RegionType.RECTANGLE,
        rotation: 0,
        size: {x: 2, y: 4},
        ...overrides
    }) as any;

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

describe("region transform utilities", () => {
    test("treats ANNCOMPASS as a center-plus-size region when transforming", () => {
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

describe("region selection utilities", () => {
    test("cycles region opacity states", () => {
        expect(getNextRegionOpacity(RegionOpacity.Visible)).toBe(RegionOpacity.SemiTransparent);
        expect(getNextRegionOpacity(RegionOpacity.SemiTransparent)).toBe(RegionOpacity.Invisible);
        expect(getNextRegionOpacity(RegionOpacity.Invisible)).toBe(RegionOpacity.Visible);
    });

    test("returns selection points for simple, polygonal, and line-like regions", () => {
        const rectangle = MakeRegion({center: {x: 5, y: 5}, size: {x: 4, y: 2}, isSimpleShapeRegion: true});
        expect(getRegionSelectionPoints(rectangle)).toEqual([
            {x: 3, y: 4},
            {x: 5, y: 4},
            {x: 7, y: 4},
            {x: 7, y: 5},
            {x: 7, y: 6},
            {x: 5, y: 6},
            {x: 3, y: 6},
            {x: 3, y: 5}
        ]);

        const points = [
            {x: 0, y: 0},
            {x: 1, y: 0},
            {x: 1, y: 1}
        ];
        expect(getRegionSelectionPoints(MakeRegion({controlPoints: points, isPolygonalRegion: true, regionType: CARTA.RegionType.POLYGON}))).toBe(points);
        expect(getRegionSelectionPoints(MakeRegion({controlPoints: points.slice(0, 2), isLineLikeRegion: true, regionType: CARTA.RegionType.LINE}))).toEqual(points.slice(0, 2));
    });

    test("returns expected region selection segments by region type", () => {
        const points = [
            {x: 0, y: 0},
            {x: 1, y: 0},
            {x: 1, y: 1}
        ];

        expect(getRegionSelectionSegments(MakeRegion({isLineLikeRegion: true, regionType: CARTA.RegionType.LINE}), points)).toHaveLength(2);
        expect(getRegionSelectionSegments(MakeRegion({isPolygonalRegion: true, regionType: CARTA.RegionType.POLYGON}), points)).toHaveLength(3);
        expect(getRegionSelectionSegments(MakeRegion({isPolygonalRegion: true, regionType: CARTA.RegionType.POLYLINE}), points)).toHaveLength(2);
        expect(getRegionSelectionSegments(MakeRegion({isSimpleShapeRegion: true}), points)).toHaveLength(3);
    });

    test("selects regions when the selection rect intersects points, segments, or bounding boxes", () => {
        const rect = {x: 4, y: 4, width: 2, height: 2};

        expect(doSelectionRectAndRegionPointsIntersect(rect, [{x: 5, y: 5}], [])).toBe(true);
        expect(
            doSelectionRectAndRegionPointsIntersect(
                rect,
                [
                    {x: 0, y: 5},
                    {x: 10, y: 5}
                ],
                [
                    [
                        {x: 0, y: 5},
                        {x: 10, y: 5}
                    ]
                ]
            )
        ).toBe(true);
        expect(
            doSelectionRectAndRegionPointsIntersect(
                rect,
                [
                    {x: 0, y: 0},
                    {x: 1, y: 1}
                ],
                []
            )
        ).toBe(false);
    });

    test("selects ruler auxiliary triangle only when auxiliary lines are visible", () => {
        const rect = {x: 2, y: 2, width: 1, height: 1};
        const paths = [[{x: 0, y: 0}], [{x: 0, y: 10}], [{x: 10, y: 0}]];

        expect(doSelectionRectAndRulerPathsIntersect(rect, paths, false)).toBe(false);
        expect(doSelectionRectAndRulerPathsIntersect(rect, paths, true)).toBe(true);
    });

    test("interpolates paths at the requested distance", () => {
        const path = getInterpolatedPathAtDistance({x: 0, y: 0}, [{x: 10, y: 0}], 4);
        expect(path).toEqual([
            {x: 0, y: 0},
            {x: 4, y: 0}
        ]);
    });
});

describe("region paste utilities", () => {
    test("converts paste offset preference to image pixels", () => {
        expect(getPasteRegionOffset(PasteOffsetUnit.ScreenPixel, 2)).toBe(PASTE_OFFSET / 2);
        expect(getPasteRegionOffset(PasteOffsetUnit.ImagePixel, 10)).toBe(PASTE_OFFSET);
        expect(getPasteRegionOffset(PasteOffsetUnit.Auto, 0.5)).toBe(PASTE_OFFSET / 0.5);
        expect(getPasteRegionOffset(PasteOffsetUnit.Auto, 10)).toBe(PASTE_OFFSET / 2);
        expect(getPasteRegionOffset(PasteOffsetUnit.Auto, 1000)).toBe(1);
    });

    test("uses perpendicular paste shift for line-like regions", () => {
        expect(
            getPasteShiftDelta(
                [
                    {x: 0, y: 0},
                    {x: 10, y: 0}
                ],
                CARTA.RegionType.LINE,
                5
            )
        ).toEqual({x: 0, y: -5});

        const verticalDelta = getPasteShiftDelta(
            [
                {x: 0, y: 0},
                {x: 0, y: 10}
            ],
            CARTA.RegionType.ANNVECTOR,
            5
        );
        expect(verticalDelta.x).toBe(5);
        expect(Math.abs(verticalDelta.y)).toBe(0);
    });

    test("offsets pasted center regions without changing size points", () => {
        const result = offsetPointsToAvoidCollision(
            [
                {x: 1, y: 1},
                {x: 3, y: 4}
            ],
            CARTA.RegionType.RECTANGLE,
            [],
            true,
            5
        );

        expect(result).toEqual([
            {x: 6, y: -4},
            {x: 3, y: 4}
        ]);
    });

    test("shifts until pasted region center avoids existing valid non-cursor regions", () => {
        const regions = [
            MakeRegion({regionId: 0, center: {x: 0, y: 0}}),
            MakeRegion({regionId: 1, center: {x: 0, y: 0}}),
            MakeRegion({regionId: 2, center: {x: 10, y: -10}}),
            MakeRegion({regionId: 3, center: {x: 20, y: -20}, isValid: false})
        ];

        const result = offsetPointsToAvoidCollision([{x: 0, y: 0}], CARTA.RegionType.POINT, regions, false, 10);

        expect(result).toEqual([{x: 20, y: -20}]);
    });
});
