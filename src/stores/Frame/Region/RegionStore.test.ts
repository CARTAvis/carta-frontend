import {CARTA} from "carta-protobuf";

import {RegionsOpacity} from "enums";

jest.mock("stores", () => ({
    AppStore: {
        Instance: {
            imageRatio: 1,
            resetCursorRegionSpectralProfileProgress: jest.fn(),
            resetRegionSpectralProfileProgress: jest.fn()
        }
    },
    PreferenceStore: {
        Instance: {
            lowBandwidthMode: false
        }
    },
    WidgetsStore: {
        Instance: {
            pvGeneratorWidgets: new Map()
        }
    }
}));

jest.mock("models", () => ({
    isValidWcsPoint: jest.fn(() => true)
}));

import {CompassAnnotationStore} from "../AnnotationStore";

import {CURSOR_REGION_ID, MIN_EDITED_REGION_DIMENSION, RegionStore, SIMPLE_SHAPE_RIGHT_POINT_INDEX} from "./RegionStore";

const backendService = {
    setCursor: jest.fn(),
    setRegion: jest.fn(() => Promise.resolve({regionId: 1}))
};

const makeFrame = (overrides: Partial<any> = {}) =>
    ({
        hasSquarePixels: true,
        renderHeight: 100,
        renderWidth: 100,
        setCenter: jest.fn(),
        setZoom: jest.fn(),
        validWcs: false,
        zoomLevel: 1,
        ...overrides
    }) as any;

const makeRegion = (regionType: CARTA.RegionType, controlPoints: Array<{x: number; y: number}>, overrides: Partial<any> = {}) => {
    const region = new RegionStore(backendService as any, 1, makeFrame(overrides.frame), controlPoints, regionType, overrides.regionId ?? 1, overrides.rotation ?? 0);
    region.beginEditing();
    return region;
};

describe("RegionStore selection and keyboard-edit helpers", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("rejects unsupported and out-of-range point selections", () => {
        const point = makeRegion(CARTA.RegionType.POINT, [{x: 1, y: 1}]);
        point.selectPoint(0);
        expect(point.selectedPointIndex).toBe(-1);

        const polygon = makeRegion(CARTA.RegionType.POLYGON, [
            {x: 0, y: 0},
            {x: 10, y: 0},
            {x: 0, y: 10}
        ]);
        polygon.selectPoint(3);
        expect(polygon.selectedPointIndex).toBe(-1);
        polygon.selectPoint(2);
        expect(polygon.selectedPointIndex).toBe(2);
    });

    test("cycles point selection with wrapping", () => {
        const line = makeRegion(CARTA.RegionType.LINE, [
            {x: 0, y: 0},
            {x: 10, y: 0}
        ]);

        line.selectNextPoint();
        expect(line.selectedPointIndex).toBe(0);
        line.selectPreviousPoint();
        expect(line.selectedPointIndex).toBe(2);
        line.selectNextPoint();
        expect(line.selectedPointIndex).toBe(0);
    });

    test("visibility changes do not mutate explicit lock state", () => {
        const region = makeRegion(CARTA.RegionType.RECTANGLE, [
            {x: 0, y: 0},
            {x: 10, y: 10}
        ]);

        region.setOpacity(RegionsOpacity.Invisible);
        expect(region.locked).toBe(false);

        region.setOpacity(RegionsOpacity.Visible);
        expect(region.locked).toBe(false);

        region.setLocked(true);
        region.setOpacity(RegionsOpacity.Invisible);
        region.setOpacity(RegionsOpacity.Visible);
        expect(region.locked).toBe(true);
    });

    test("does not apply visibility or lock changes to cursor region", () => {
        const cursor = makeRegion(CARTA.RegionType.POINT, [{x: 1, y: 1}], {regionId: CURSOR_REGION_ID});

        cursor.setLocked(true);
        cursor.setOpacity(RegionsOpacity.Invisible);

        expect(cursor.locked).toBe(false);
        expect(cursor.opacity).toBe(RegionsOpacity.Visible);
    });

    test("moves selected polygon point only", () => {
        const polygon = makeRegion(CARTA.RegionType.POLYGON, [
            {x: 0, y: 0},
            {x: 10, y: 0},
            {x: 0, y: 10}
        ]);

        polygon.selectPoint(1);
        polygon.moveSelectedPoint(2, 3);

        expect(polygon.controlPoints).toEqual([
            {x: 0, y: 0},
            {x: 12, y: 3},
            {x: 0, y: 10}
        ]);
    });

    test("simple shape side movement keeps dimensions positive", () => {
        const rectangle = makeRegion(CARTA.RegionType.RECTANGLE, [
            {x: 0, y: 0},
            {x: 10, y: 10}
        ]);

        rectangle.selectPoint(SIMPLE_SHAPE_RIGHT_POINT_INDEX);
        rectangle.moveSelectedPoint(-100, 0);

        expect(rectangle.size.x).toBeGreaterThan(0);
        expect(rectangle.size.y).toBe(10);
    });

    test("moves selected compass point by updating compass length", () => {
        const compass = new CompassAnnotationStore(
            backendService as any,
            1,
            makeFrame(),
            [
                {x: 0, y: 0},
                {x: 10, y: 10}
            ],
            CARTA.RegionType.ANNCOMPASS,
            1
        );

        compass.selectPoint(0);
        compass.moveSelectedPoint(5, 0);

        expect(compass.length).toBe(15);
        expect(compass.controlPoints[1]).toEqual({x: 15, y: 15});

        compass.moveSelectedPoint(-100, 0);
        expect(compass.length).toBe(MIN_EDITED_REGION_DIMENSION);
    });
});
