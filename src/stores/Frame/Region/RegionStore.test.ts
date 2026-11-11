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

    test("removes selected polygonal point when enough control points remain", () => {
        const polyline = MakeRegion(CARTA.RegionType.POLYLINE, [
            {x: 0, y: 0},
            {x: 10, y: 0},
            {x: 10, y: 10},
            {x: 0, y: 10}
        ]);

        polyline.selectPoint(2);

        expect(polyline.removeSelectedPoint()).toBe(true);
        expect(polyline.controlPoints).toEqual([
            {x: 0, y: 0},
            {x: 10, y: 0},
            {x: 0, y: 10}
        ]);
        expect(polyline.selectedPointIndex).toBe(-1);
    });

    test("does not remove selected polygonal point at minimum editable point count", () => {
        const polygon = MakeRegion(CARTA.RegionType.POLYGON, [
            {x: 0, y: 0},
            {x: 10, y: 0},
            {x: 0, y: 10}
        ]);

        polygon.selectPoint(1);

        expect(polygon.removeSelectedPoint()).toBe(false);
        expect(polygon.controlPoints).toEqual([
            {x: 0, y: 0},
            {x: 10, y: 0},
            {x: 0, y: 10}
        ]);
        expect(polygon.selectedPointIndex).toBe(1);
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

    test("focus preserves independent axis zoom ratio", () => {
        const setAxisZoom = jest.fn();
        const rectangle = MakeRegion(
            CARTA.RegionType.RECTANGLE,
            [
                {x: 0, y: 0},
                {x: 100, y: 50}
            ],
            {frame: {effectiveZoomLevel: {x: 2, y: 4}, isAxisZoomable: true, setAxisZoom}}
        );

        rectangle.focusCenter();

        expect(setAxisZoom).toHaveBeenCalled();
        const [zoomX, zoomY] = setAxisZoom.mock.calls[0];
        expect(zoomX / zoomY).toBeCloseTo(0.5);
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

describe("CompassAnnotationStore text offsets", () => {
    const makeCompass = () =>
        new CompassAnnotationStore(
            BACKEND_SERVICE as any,
            1,
            MakeFrame(),
            [
                {x: 0, y: 0},
                {x: 100, y: 100}
            ],
            CARTA.RegionType.ANNCOMPASS,
            1
        );

    test("asks for text offsets for a new compass, and not again after they are set", () => {
        const compass = makeCompass();
        expect(compass.shouldUpdateTextOffsets).toBe(true);

        compass.setTextOffsetsFromLabels({x: 7, y: 24}, {x: 20, y: 10});

        expect(compass.northTextOffset).toEqual({x: 7, y: 24});
        expect(compass.eastTextOffset).toEqual({x: 20, y: 10});
        expect(compass.shouldUpdateTextOffsets).toBe(false);
    });

    test("asks for text offsets again when a label or the font changes", () => {
        const changes: Array<(compass: CompassAnnotationStore) => void> = [
            compass => compass.setLabel("North-Up", true),
            compass => compass.setLabel("Left", false),
            compass => compass.setFontSize(30),
            compass => compass.setFontStyle("bold")
        ];
        for (const change of changes) {
            const compass = makeCompass();
            compass.setTextOffsetsFromLabels({x: 7, y: 24}, {x: 20, y: 10});
            change(compass);
            expect(compass.shouldUpdateTextOffsets).toBe(true);
        }
    });

    test("keeps text offsets that the user set", () => {
        const compass = makeCompass();
        compass.setTextOffsetsFromLabels({x: 7, y: 24}, {x: 20, y: 10});

        compass.setNorthTextOffset(-40, true);
        compass.setNorthTextOffset(-20, false);

        expect(compass.northTextOffset).toEqual({x: -40, y: -20});
        expect(compass.shouldUpdateTextOffsets).toBe(false);
    });

    test("keeps the restored text offsets, with the restored labels and font", () => {
        const compass = makeCompass();

        compass.initializeStyles({...compass.getAnnotationStyles(), textLabel0: "North-Up", fontSize: 30, northTextOffset: {x: -40, y: -20}, eastTextOffset: {x: 30, y: 15}});

        expect(compass.northTextOffset).toEqual({x: -40, y: -20});
        expect(compass.eastTextOffset).toEqual({x: 30, y: 15});
        expect(compass.shouldUpdateTextOffsets).toBe(false);
    });

    test("asks for text offsets when the restored styles have none", () => {
        const compass = makeCompass();
        const styles: any = {...compass.getAnnotationStyles(), textLabel0: "North-Up"};
        delete styles.northTextOffset;
        delete styles.eastTextOffset;

        compass.initializeStyles(styles);

        expect(compass.shouldUpdateTextOffsets).toBe(true);
    });
});
