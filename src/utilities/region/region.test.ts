import {CARTA} from "carta-protobuf";

import {doSelectionRectAndRegionPointsIntersect, doSelectionRectAndRulerPathsIntersect, getInterpolatedPathAtDistance, getRegionSelectionPoints, getRegionSelectionSegments} from "./region";

const MakeRegion = (overrides: Partial<any>) =>
    ({
        center: {x: 0, y: 0},
        controlPoints: [],
        isLineLikeRegion: false,
        isPolygonalRegion: false,
        isSimpleShapeRegion: false,
        regionId: 1,
        regionType: CARTA.RegionType.RECTANGLE,
        rotation: 0,
        size: {x: 2, y: 4},
        ...overrides
    }) as any;

describe("region selection utilities", () => {
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
