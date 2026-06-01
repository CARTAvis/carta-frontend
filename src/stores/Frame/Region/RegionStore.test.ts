import {CARTA} from "carta-protobuf";

import {RegionOpacity} from "enums";

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

import {MIN_EDITED_REGION_DIMENSION, SIMPLE_SHAPE_RIGHT_POINT_INDEX, SIMPLE_SHAPE_ROTATION_POINT_INDEX, SIMPLE_SHAPE_TOP_LEFT_POINT_INDEX, SIMPLE_SHAPE_TOP_POINT_INDEX, SIMPLE_SHAPE_TOP_RIGHT_POINT_INDEX} from "utilities";

import {CompassAnnotationStore} from "../AnnotationStore";

import {CURSOR_REGION_ID, RegionStore} from "./RegionStore";

const BACKEND_SERVICE = {
    setCursor: jest.fn(),
    setRegion: jest.fn(() => Promise.resolve({regionId: 1}))
};

const MakeFrame = (overrides: Partial<any> = {}) =>
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

const MakeRegion = (regionType: CARTA.RegionType, controlPoints: Array<{x: number; y: number}>, overrides: Partial<any> = {}) => {
    const region = new RegionStore(BACKEND_SERVICE as any, 1, MakeFrame(overrides.frame), controlPoints, regionType, overrides.regionId ?? 1, overrides.rotation ?? 0);
    region.beginEditing();
    return region;
};

describe("RegionStore selection and keyboard-edit helpers", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("rejects unsupported and out-of-range point selections", () => {
        const point = MakeRegion(CARTA.RegionType.POINT, [{x: 1, y: 1}]);
        point.selectPoint(0);
        expect(point.selectedPointIndex).toBe(-1);

        const polygon = MakeRegion(CARTA.RegionType.POLYGON, [
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
        const line = MakeRegion(CARTA.RegionType.LINE, [
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

    test("cycles simple shape point selection around the bounding box", () => {
        const rectangle = MakeRegion(CARTA.RegionType.RECTANGLE, [
            {x: 0, y: 0},
            {x: 10, y: 10}
        ]);

        rectangle.selectNextPoint();
        expect(rectangle.selectedPointIndex).toBe(SIMPLE_SHAPE_TOP_LEFT_POINT_INDEX);
        rectangle.selectNextPoint();
        expect(rectangle.selectedPointIndex).toBe(SIMPLE_SHAPE_TOP_POINT_INDEX);
        rectangle.selectPreviousPoint();
        expect(rectangle.selectedPointIndex).toBe(SIMPLE_SHAPE_TOP_LEFT_POINT_INDEX);
        rectangle.selectPreviousPoint();
        expect(rectangle.selectedPointIndex).toBe(SIMPLE_SHAPE_ROTATION_POINT_INDEX);
        rectangle.selectNextPoint();
        expect(rectangle.selectedPointIndex).toBe(SIMPLE_SHAPE_TOP_LEFT_POINT_INDEX);
        rectangle.selectPoint(SIMPLE_SHAPE_TOP_RIGHT_POINT_INDEX);
        rectangle.selectNextPoint();
        expect(rectangle.selectedPointIndex).toBe(SIMPLE_SHAPE_RIGHT_POINT_INDEX);
    });

    test("visibility changes do not mutate explicit lock state", () => {
        const region = MakeRegion(CARTA.RegionType.RECTANGLE, [
            {x: 0, y: 0},
            {x: 10, y: 10}
        ]);

        region.setOpacity(RegionOpacity.Invisible);
        expect(region.isLocked).toBe(false);

        region.setOpacity(RegionOpacity.Visible);
        expect(region.isLocked).toBe(false);

        region.setLocked(true);
        region.setOpacity(RegionOpacity.Invisible);
        region.setOpacity(RegionOpacity.Visible);
        expect(region.isLocked).toBe(true);
    });

    test("does not apply visibility or lock changes to cursor region", () => {
        const cursor = MakeRegion(CARTA.RegionType.POINT, [{x: 1, y: 1}], {regionId: CURSOR_REGION_ID});

        cursor.setLocked(true);
        cursor.setOpacity(RegionOpacity.Invisible);

        expect(cursor.isLocked).toBe(false);
        expect(cursor.opacity).toBe(RegionOpacity.Visible);
    });

    test("moves selected polygon point only", () => {
        const polygon = MakeRegion(CARTA.RegionType.POLYGON, [
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

    test("deselects point after removing a polygon control point", () => {
        const polygon = MakeRegion(CARTA.RegionType.POLYGON, [
            {x: 0, y: 0},
            {x: 10, y: 0},
            {x: 10, y: 10},
            {x: 0, y: 10}
        ]);

        polygon.selectPoint(1);
        polygon.removeControlPoint(1);

        expect(polygon.controlPoints).toEqual([
            {x: 0, y: 0},
            {x: 10, y: 10},
            {x: 0, y: 10}
        ]);
        expect(polygon.selectedPointIndex).toBe(-1);
    });

    test("simple shape side movement keeps dimensions positive", () => {
        const rectangle = MakeRegion(CARTA.RegionType.RECTANGLE, [
            {x: 0, y: 0},
            {x: 10, y: 10}
        ]);

        rectangle.selectPoint(SIMPLE_SHAPE_RIGHT_POINT_INDEX);
        rectangle.moveSelectedPoint(-100, 0);

        expect(rectangle.size.x).toBeGreaterThan(0);
        expect(rectangle.size.y).toBe(10);
    });

    test("simple shape corner movement resizes rectangle with keyboard control", () => {
        const rectangle = MakeRegion(CARTA.RegionType.RECTANGLE, [
            {x: 0, y: 0},
            {x: 10, y: 10}
        ]);

        rectangle.selectPoint(SIMPLE_SHAPE_TOP_RIGHT_POINT_INDEX);
        rectangle.moveSelectedPoint(2, 3);

        expect(rectangle.center).toEqual({x: 1, y: 1.5});
        expect(rectangle.size).toEqual({x: 12, y: 13});
    });

    test("simple shape corner movement resizes ellipse with keyboard control", () => {
        const ellipse = MakeRegion(CARTA.RegionType.ELLIPSE, [
            {x: 0, y: 0},
            {x: 5, y: 10}
        ]);

        ellipse.selectPoint(SIMPLE_SHAPE_TOP_LEFT_POINT_INDEX);
        ellipse.moveSelectedPoint(-4, 2);

        expect(ellipse.center).toEqual({x: -2, y: 1});
        expect(ellipse.size).toEqual({x: 6, y: 12});
    });

    test("moves selected compass point by updating compass length", () => {
        const compass = new CompassAnnotationStore(
            BACKEND_SERVICE as any,
            1,
            MakeFrame(),
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
