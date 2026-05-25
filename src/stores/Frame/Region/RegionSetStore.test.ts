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
    FileBrowserStore: {
        Instance: {
            exportRegionIndexes: [],
            updateExportRegionIndexes: jest.fn()
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

jest.mock("stores/Frame", () => {
    class PointAnnotationStore {
        initializeStyles = jest.fn();
    }

    return {
        CURSOR_REGION_ID: 0,
        CompassAnnotationStore: jest.fn(),
        FrameStore: jest.fn(),
        PointAnnotationStore,
        RulerAnnotationStore: jest.fn(),
        TextAnnotationStore: jest.fn(),
        VectorAnnotationStore: jest.fn()
    };
});

jest.mock("models", () => ({
    Transform2D: jest.fn(),
    isValidWcsPoint: jest.fn(() => true)
}));

import {RegionSetStore} from "./RegionSetStore";
import {CURSOR_REGION_ID} from "./RegionStore";

const BACKEND_SERVICE = {
    removeRegion: jest.fn(),
    setCursor: jest.fn(),
    setRegion: jest.fn(() => Promise.resolve({regionId: 100}))
};

const PREFERENCE = {
    annotationColor: "#f00",
    annotationDashLength: 0,
    annotationLineWidth: 1,
    pointAnnotationShape: CARTA.PointAnnotationShape.SQUARE,
    pointAnnotationWidth: 4,
    regionColor: "#0f0",
    regionDashLength: 0,
    regionLineWidth: 1,
    regionType: CARTA.RegionType.RECTANGLE,
    textAnnotationLineWidth: 1
};

const MakeFrame = () =>
    ({
        center: {x: 0, y: 0},
        frameInfo: {fileId: 1},
        hasSquarePixels: true,
        validWcs: false,
        zoomLevel: 1
    }) as any;

const MakeRegionSet = () => {
    const regionSet = new RegionSetStore(MakeFrame(), PREFERENCE as any, BACKEND_SERVICE as any);
    const first = regionSet.addRectangularRegion({x: 10, y: 10}, 4, 4, true);
    first.setRegionId(1);
    const second = regionSet.addRectangularRegion({x: 20, y: 20}, 4, 4, true);
    second.setRegionId(2);
    const third = regionSet.addPolylineRegion(
        [
            {x: 30, y: 30},
            {x: 40, y: 40}
        ],
        true
    );
    third.setRegionId(3);
    return {regionSet, first, second, third};
};

describe("RegionSetStore multi-selection behavior", () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation(jest.fn());
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    test("selectSingleRegion replaces the selected id set and focus", () => {
        const {regionSet, first, second} = MakeRegionSet();

        regionSet.setSelectionByIds([first.regionId, second.regionId], first.regionId);
        regionSet.selectSingleRegion(second);

        expect(Array.from(regionSet.selectedRegionIds)).toEqual([second.regionId]);
        expect(regionSet.focusedRegion).toBe(second);
    });

    test("setSelectionByIds filters cursor and missing ids", () => {
        const {regionSet, first} = MakeRegionSet();

        regionSet.setSelectionByIds([CURSOR_REGION_ID, first.regionId, 999], 999);

        expect(Array.from(regionSet.selectedRegionIds)).toEqual([first.regionId]);
        expect(regionSet.focusedRegion).toBe(first);
    });

    test("toggleRegionSelection adds and removes ids while keeping a valid focus", () => {
        const {regionSet, first, second} = MakeRegionSet();

        regionSet.selectSingleRegion(first);
        regionSet.toggleRegionSelection(second);
        expect(new Set(regionSet.selectedRegionIds)).toEqual(new Set([first.regionId, second.regionId]));
        expect(regionSet.focusedRegion).toBe(second);

        regionSet.toggleRegionSelection(second);
        expect(Array.from(regionSet.selectedRegionIds)).toEqual([first.regionId]);
        expect(regionSet.focusedRegion).toBe(first);
    });

    test("setFocusedRegion keeps non-cursor focus in the selected id set", () => {
        const {regionSet, first, second} = MakeRegionSet();

        regionSet.selectSingleRegion(first);
        regionSet.setFocusedRegion(second);

        expect(new Set(regionSet.selectedRegionIds)).toEqual(new Set([first.regionId, second.regionId]));
        expect(regionSet.focusedRegion).toBe(second);
    });

    test("selectRegionFromList centralizes toggle, range, and focus selection", () => {
        const {regionSet, first, second, third} = MakeRegionSet();
        const regions = [first, second, third];

        regionSet.selectRegionFromList(first, regions);
        regionSet.selectRegionFromList(third, regions, {range: true});
        expect(new Set(regionSet.selectedRegionIds)).toEqual(new Set([first.regionId, second.regionId, third.regionId]));
        expect(regionSet.focusedRegion).toBe(third);

        regionSet.selectRegionFromList(second, regions, {toggle: true});
        expect(new Set(regionSet.selectedRegionIds)).toEqual(new Set([first.regionId, third.regionId]));
        expect(regionSet.focusedRegion).toBe(third);

        regionSet.selectRegionFromList(third, regions);
        expect(new Set(regionSet.selectedRegionIds)).toEqual(new Set([first.regionId, third.regionId]));
        expect(regionSet.focusedRegion).toBe(third);
    });

    test("selectAdjacentRegionFromList handles single and range keyboard navigation", () => {
        const {regionSet, first, second, third} = MakeRegionSet();
        const regions = [first, second, third];

        regionSet.selectAdjacentRegionFromList(regions, 1, {wrap: true});
        expect(Array.from(regionSet.selectedRegionIds)).toEqual([first.regionId]);
        expect(regionSet.focusedRegion).toBe(first);

        regionSet.selectAdjacentRegionFromList(regions, 1, {range: true});
        expect(new Set(regionSet.selectedRegionIds)).toEqual(new Set([first.regionId, second.regionId]));
        expect(regionSet.focusedRegion).toBe(second);

        regionSet.selectAdjacentRegionFromList(regions, 1, {range: true});
        expect(new Set(regionSet.selectedRegionIds)).toEqual(new Set([first.regionId, second.regionId, third.regionId]));
        expect(regionSet.focusedRegion).toBe(third);

        regionSet.selectAdjacentRegionFromList(regions, -1, {range: true});
        expect(new Set(regionSet.selectedRegionIds)).toEqual(new Set([first.regionId, second.regionId]));
        expect(regionSet.focusedRegion).toBe(second);
    });

    test("region hotkeys preserve multi-selection while cycling focus", () => {
        const {regionSet, first, second, third} = MakeRegionSet();

        regionSet.setSelectionByIds([first.regionId, third.regionId], first.regionId);
        regionSet.selectNextRegion();

        expect(new Set(regionSet.selectedRegionIds)).toEqual(new Set([first.regionId, third.regionId]));
        expect(regionSet.focusedRegion).toBe(third);

        regionSet.selectNextRegion();
        expect(new Set(regionSet.selectedRegionIds)).toEqual(new Set([first.regionId, third.regionId]));
        expect(regionSet.focusedRegion).toBe(first);

        regionSet.selectSingleRegion(second);
        regionSet.selectNextRegion();
        expect(Array.from(regionSet.selectedRegionIds)).toEqual([third.regionId]);
        expect(regionSet.focusedRegion).toBe(third);
    });

    test("clearSelection focuses the cursor region", () => {
        const {regionSet, first} = MakeRegionSet();

        regionSet.selectSingleRegion(first);
        regionSet.clearSelection();

        expect(regionSet.selectedRegionIds.size).toBe(0);
        expect(regionSet.focusedRegion?.regionId).toBe(CURSOR_REGION_ID);
    });

    test("deleteRegion focuses the next remaining region when deleting the focused region", () => {
        const {regionSet, first, second, third} = MakeRegionSet();

        regionSet.setSelectionByIds([first.regionId, second.regionId, third.regionId], second.regionId);
        regionSet.deleteRegion(second);

        expect(Array.from(regionSet.selectedRegionIds)).toEqual([third.regionId]);
        expect(regionSet.focusedRegion).toBe(third);
    });

    test("deleteRegion advances focus across consecutive selected deletions", () => {
        const {regionSet, first, second, third} = MakeRegionSet();

        regionSet.setSelectionByIds([first.regionId, second.regionId], first.regionId);
        regionSet.deleteRegion(first);
        regionSet.deleteRegion(second);

        expect(Array.from(regionSet.selectedRegionIds)).toEqual([third.regionId]);
        expect(regionSet.focusedRegion).toBe(third);
    });

    test("deleteRegion uses editable region indexes when cursor exists", () => {
        const {regionSet, second, third} = MakeRegionSet();

        regionSet.selectSingleRegion(second);
        regionSet.deleteRegion(second);

        expect(Array.from(regionSet.selectedRegionIds)).toEqual([third.regionId]);
        expect(regionSet.focusedRegion).toBe(third);
    });

    test("translateRegionDrag moves selected unlocked regions only", () => {
        const {regionSet, first, second, third} = MakeRegionSet();
        second.setLocked(true);
        regionSet.setSelectionByIds([first.regionId, second.regionId, third.regionId], third.regionId);

        regionSet.translateRegionDrag(first, {x: 5, y: -2});

        expect(first.center).toEqual({x: 15, y: 8});
        expect(second.center).toEqual({x: 20, y: 20});
        expect(third.controlPoints).toEqual([
            {x: 35, y: 28},
            {x: 45, y: 38}
        ]);
    });

    test("bulk lock and visibility operations apply to selected regions", () => {
        const {regionSet, first, second, third} = MakeRegionSet();
        regionSet.setSelectionByIds([first.regionId, second.regionId], first.regionId);

        regionSet.toggleSelectedRegionsLocked();
        expect(first.isLocked).toBe(true);
        expect(second.isLocked).toBe(true);
        expect(third.isLocked).toBe(false);

        regionSet.toggleSelectedRegionsLocked();
        expect(first.isLocked).toBe(false);
        expect(second.isLocked).toBe(false);

        regionSet.toggleSelectedRegionsVisibility();
        expect(first.opacity).toBe(RegionOpacity.SemiTransparent);
        expect(second.opacity).toBe(RegionOpacity.SemiTransparent);
        expect(third.opacity).toBe(RegionOpacity.Visible);
    });

    test("visibility changes do not mutate lock state", () => {
        const {regionSet, first, second} = MakeRegionSet();
        second.setLocked(true);
        regionSet.setEditableRegionsOpacity(RegionOpacity.Invisible);

        expect(first.isLocked).toBe(false);
        expect(second.isLocked).toBe(true);

        regionSet.setEditableRegionsOpacity(RegionOpacity.Visible);
        expect(first.isLocked).toBe(false);
        expect(second.isLocked).toBe(true);
    });

    test("bulk locking skips hidden regions", () => {
        const {regionSet, first, second} = MakeRegionSet();
        second.setOpacity(RegionOpacity.Invisible);
        regionSet.setSelectionByIds([first.regionId, second.regionId], first.regionId);

        regionSet.toggleSelectedRegionsLocked();

        expect(first.isLocked).toBe(true);
        expect(second.isLocked).toBe(false);
    });
});
