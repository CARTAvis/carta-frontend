jest.mock("axios", () => ({
    get: jest.fn(() => Promise.resolve({data: []})),
    post: jest.fn(() => Promise.resolve({data: {}}))
}));

jest.mock("mobx", () => {
    const actual = jest.requireActual("mobx");
    return {
        ...actual,
        autorun: jest.fn(() => jest.fn()),
        reaction: jest.fn(() => jest.fn())
    };
});

jest.mock("stores/Frame", () => ({
    CURSOR_REGION_ID: 0,
    FrameStore: jest.fn()
}));

jest.mock("components", () => ({
    PvGeneratorComponent: jest.fn(),
    getImageViewCanvas: jest.fn()
}));

jest.mock("components/Shared", () => ({
    AppToaster: {show: jest.fn()},
    ErrorToast: jest.fn(),
    SuccessToast: jest.fn(),
    WarningToast: jest.fn()
}));

jest.mock("models", () => ({
    CARTA_INFO: {},
    COMPUTED_POLARIZATIONS: [],
    FloatingObjzIndexManager: jest.fn().mockImplementation(() => ({})),
    PresetLayout: {},
    Theme: {DARK: "dark", LIGHT: "light"},
    ToFileListFilterMode: jest.fn(),
    distinct: jest.fn((values: unknown[]) => Array.from(new Set(values))),
    getColorForTheme: jest.fn(() => "#000"),
    getTimestamp: jest.fn(() => "")
}));

jest.mock("services", () => ({
    ApiService: {
        Instance: {
            authenticated: false,
            setToken: jest.fn()
        }
    },
    BackendService: {
        Instance: {
            catalogStream: {subscribe: jest.fn()},
            connectionStatus: 0,
            contourStream: {subscribe: jest.fn()},
            errorStream: {subscribe: jest.fn()},
            fittingProgressStream: {subscribe: jest.fn()},
            histogramStream: {subscribe: jest.fn()},
            listProgressStream: {subscribe: jest.fn()},
            momentProgressStream: {subscribe: jest.fn()},
            pvPreviewStream: {subscribe: jest.fn()},
            pvProgressStream: {subscribe: jest.fn()},
            scriptingStream: {subscribe: jest.fn()},
            spatialProfileStream: {subscribe: jest.fn()},
            spectralProfileStream: {subscribe: jest.fn()},
            statsStream: {subscribe: jest.fn()},
            vectorTileStream: {subscribe: jest.fn()}
        }
    },
    ScriptingService: {
        Instance: {}
    },
    TelemetryService: {
        Instance: {}
    },
    TileService: {
        Instance: {
            tileStream: {subscribe: jest.fn()},
            zfpReady: false
        }
    }
}));

const MockMakeStore = (overrides = {}) => ({...overrides});

jest.mock("stores", () => ({
    AlertStore: {Instance: MockMakeStore()},
    AnimatorStore: {Instance: MockMakeStore()},
    CatalogStore: {Instance: MockMakeStore()},
    ChannelMapStore: {Instance: MockMakeStore()},
    DialogStore: {Instance: MockMakeStore()},
    DynamicLayoutStore: {Instance: MockMakeStore()},
    FileBrowserStore: {Instance: MockMakeStore()},
    HelpStore: {Instance: MockMakeStore()},
    HipsQueryStore: {Instance: MockMakeStore()},
    ImageFittingStore: {Instance: MockMakeStore()},
    ImageViewConfigStore: {Instance: MockMakeStore({frames: [], visibleFrames: []})},
    LayoutStore: {Instance: MockMakeStore()},
    LogStore: {Instance: MockMakeStore({addDebug: jest.fn(), addInfo: jest.fn()})},
    OverlaySettings: {Instance: MockMakeStore()},
    PreferenceStore: {Instance: MockMakeStore({autoLaunch: false})},
    SnippetStore: {Instance: MockMakeStore()},
    SpatialProfileStore: jest.fn(),
    SpectralProfileStore: jest.fn(),
    WidgetsStore: {Instance: MockMakeStore({removeRegionFromRegionWidgets: jest.fn(), updateRenderConfigSettingsVisibility: jest.fn()})}
}));

import {CARTA} from "carta-protobuf";

import {ImageType} from "enums";
import {CURSOR_REGION_ID} from "stores/Frame";

import {AppStore} from "./AppStore";

const MakeRegion = (regionId: number, isLocked = false, overrides: Partial<any> = {}) =>
    ({
        color: "#f00",
        controlPoints: [{x: regionId * 10, y: regionId * 10}],
        dashLength: 0,
        fileId: 1,
        isLocked,
        lineWidth: 1,
        name: `region-${regionId}`,
        regionId,
        regionType: CARTA.RegionType.POINT,
        rotation: 0,
        ...overrides
    }) as any;

describe("AppStore.deleteSelectedRegions", () => {
    const appStore = AppStore.Instance;

    beforeEach(() => {
        appStore.setActiveImage(null);
    });

    const callDeleteSelectedRegions = (regionSet: any) => {
        const frame = {
            frameInfo: {fileId: 1},
            regionSet,
            secondarySpatialImages: []
        };
        Object.defineProperty(appStore, "imageViewConfigStore", {
            configurable: true,
            value: {
                frames: [frame],
                visibleFrames: []
            }
        });
        Object.defineProperty(appStore, "widgetsStore", {
            configurable: true,
            value: {
                removeRegionFromRegionWidgets: jest.fn(),
                updateRenderConfigSettingsVisibility: jest.fn()
            }
        });
        appStore.setActiveImage({type: ImageType.FRAME, store: frame} as any);

        return {frame, result: appStore.deleteSelectedRegions()};
    };

    test("deletes selected unlocked regions", () => {
        const cursor = MakeRegion(CURSOR_REGION_ID);
        const first = MakeRegion(1);
        const locked = MakeRegion(2, true);
        const second = MakeRegion(3);

        const regionSet = {
            focusedRegion: first,
            isLocked: false,
            deleteRegion: jest.fn(),
            regions: [cursor, first, locked, second],
            selectedRegionIds: new Set([first.regionId, locked.regionId, second.regionId])
        };
        const {result: isResult} = callDeleteSelectedRegions(regionSet);

        expect(isResult).toBe(true);
        expect(regionSet.deleteRegion).toHaveBeenCalledTimes(2);
        expect(regionSet.deleteRegion).toHaveBeenCalledWith(first);
        expect(regionSet.deleteRegion).toHaveBeenCalledWith(second);
    });

    test("does not delete when the region set is locked", () => {
        const regionSet = {
            deleteRegion: jest.fn(),
            focusedRegion: MakeRegion(1),
            isLocked: true,
            regions: [MakeRegion(1)],
            selectedRegionIds: new Set([1])
        };
        const {result: isResult} = callDeleteSelectedRegions(regionSet);

        expect(isResult).toBe(false);
        expect(regionSet.deleteRegion).not.toHaveBeenCalled();
    });

    test("deletes focused region when there is no explicit selection", () => {
        const focusedRegion = MakeRegion(7);
        const regionSet = {
            deleteRegion: jest.fn(),
            focusedRegion,
            isLocked: false,
            regions: [focusedRegion],
            selectedRegionIds: new Set()
        };
        const {result: isResult} = callDeleteSelectedRegions(regionSet);

        expect(isResult).toBe(true);
        expect(regionSet.deleteRegion).toHaveBeenCalledWith(focusedRegion);
    });

    test("does not delete locked focused region", () => {
        const focusedRegion = MakeRegion(7, true);
        const regionSet = {
            deleteRegion: jest.fn(),
            focusedRegion,
            isLocked: false,
            regions: [focusedRegion],
            selectedRegionIds: new Set()
        };
        const {result: isResult} = callDeleteSelectedRegions(regionSet);

        expect(isResult).toBe(false);
        expect(regionSet.deleteRegion).not.toHaveBeenCalled();
    });
});

describe("AppStore region copy-paste", () => {
    const appStore = AppStore.Instance;

    beforeEach(() => {
        appStore.setActiveImage(null);
        appStore.regionClipboard = null;
    });

    const setActiveFrame = (regionSet: any, frameOverrides: Partial<any> = {}) => {
        const frame = {
            frameInfo: {fileId: 1},
            regionSet,
            secondarySpatialImages: [],
            spatialReference: null,
            zoomLevel: 1,
            ...frameOverrides
        };
        Object.defineProperty(appStore, "imageViewConfigStore", {
            configurable: true,
            value: {
                frames: [frame],
                visibleFrames: []
            }
        });
        appStore.setActiveImage({type: ImageType.FRAME, store: frame} as any);
        return frame;
    };

    test("copies all selected regions in selection order", () => {
        const cursor = MakeRegion(CURSOR_REGION_ID);
        const first = MakeRegion(1, false, {name: "first"});
        const second = MakeRegion(2, false, {name: "second"});
        const regionSet = {
            focusedRegion: second,
            regions: [cursor, first, second],
            selectedRegionIds: new Set([second.regionId, first.regionId]),
            selectedRegionsList: [second, first]
        };
        setActiveFrame(regionSet);

        expect(appStore.copySelectedRegion()).toBe(true);

        expect(appStore.regionClipboard?.sourceFileId).toBe(1);
        expect(appStore.regionClipboard?.focusedRegionIndex).toBe(0);
        expect(appStore.regionClipboard?.regions.map(region => region.name)).toEqual(["second", "first"]);
    });

    test("copies single selected region", () => {
        const focusedRegion = MakeRegion(7);
        const regionSet = {
            focusedRegion,
            regions: [focusedRegion],
            selectedRegionIds: new Set([focusedRegion.regionId]),
            selectedRegionsList: [focusedRegion]
        };
        setActiveFrame(regionSet);

        expect(appStore.copySelectedRegion()).toBe(true);

        expect(appStore.regionClipboard?.focusedRegionIndex).toBe(0);
        expect(appStore.regionClipboard?.regions).toHaveLength(1);
        expect(appStore.regionClipboard?.regions[0].name).toBe("region-7");
    });

    test("pastes copied regions with each region's own offset and selects the pasted group", () => {
        const existingRegion = MakeRegion(1, false, {center: {x: 10, y: 10}});
        const pastedRegions: any[] = [];
        let nextRegionId = -1;
        const regionSet = {
            addExistingRegion: jest.fn((points, rotation, regionType, regionId, name, color, lineWidth, dashes, isTemporary, annotationStyles) => {
                const region = MakeRegion(regionId, false, {
                    annotationStyles,
                    color,
                    controlPoints: points,
                    dashLength: dashes[0] ?? 0,
                    lineWidth,
                    name,
                    regionType,
                    rotation,
                    setLocked: jest.fn()
                });
                pastedRegions.push(region);
                return region;
            }),
            getTempRegionId: jest.fn(() => nextRegionId--),
            regions: [existingRegion],
            selectedRegionIds: new Set(),
            setSelectionByIds: jest.fn()
        };
        setActiveFrame(regionSet);
        appStore.regionClipboard = {
            focusedRegionIndex: 0,
            sourceFileId: 1,
            regions: [
                {
                    annotationStyles: undefined,
                    color: "#f00",
                    controlPoints: [{x: 10, y: 10}],
                    dashLength: 0,
                    lineWidth: 1,
                    name: "anchor",
                    regionType: CARTA.RegionType.POINT,
                    rotation: 0
                },
                {
                    annotationStyles: undefined,
                    color: "#0f0",
                    controlPoints: [{x: 30, y: 10}],
                    dashLength: 0,
                    lineWidth: 2,
                    name: "offset",
                    regionType: CARTA.RegionType.POINT,
                    rotation: 0
                }
            ]
        };

        expect(appStore.pasteRegion()).toBe(true);

        expect(regionSet.addExistingRegion).toHaveBeenCalledTimes(2);
        expect(pastedRegions[0].controlPoints).toEqual([{x: 30, y: -10}]);
        expect(pastedRegions[1].controlPoints).toEqual([{x: 50, y: -10}]);
        expect(regionSet.setSelectionByIds).toHaveBeenCalledWith([-1, -2], -1);
        expect(pastedRegions[0].setLocked).toHaveBeenCalledWith(false);
        expect(pastedRegions[1].setLocked).toHaveBeenCalledWith(false);
    });

    test("pastes mixed line and point regions using their single-region paste directions", () => {
        const pastedRegions: any[] = [];
        let nextRegionId = -1;
        const regionSet = {
            addExistingRegion: jest.fn((points, rotation, regionType, regionId, name, color, lineWidth, dashes, isTemporary, annotationStyles) => {
                const region = MakeRegion(regionId, false, {
                    annotationStyles,
                    color,
                    controlPoints: points,
                    dashLength: dashes[0] ?? 0,
                    lineWidth,
                    name,
                    regionType,
                    rotation,
                    setLocked: jest.fn()
                });
                pastedRegions.push(region);
                return region;
            }),
            getTempRegionId: jest.fn(() => nextRegionId--),
            regions: [],
            selectedRegionIds: new Set(),
            setSelectionByIds: jest.fn()
        };
        setActiveFrame(regionSet);
        appStore.regionClipboard = {
            focusedRegionIndex: 0,
            sourceFileId: 1,
            regions: [
                {
                    annotationStyles: undefined,
                    color: "#f00",
                    controlPoints: [
                        {x: 0, y: 0},
                        {x: 20, y: 0}
                    ],
                    dashLength: 0,
                    lineWidth: 1,
                    name: "line",
                    regionType: CARTA.RegionType.LINE,
                    rotation: 0
                },
                {
                    annotationStyles: undefined,
                    color: "#0f0",
                    controlPoints: [{x: 50, y: 50}],
                    dashLength: 0,
                    lineWidth: 2,
                    name: "point",
                    regionType: CARTA.RegionType.POINT,
                    rotation: 0
                }
            ]
        };

        expect(appStore.pasteRegion()).toBe(true);

        expect(pastedRegions[0].controlPoints).toEqual([
            {x: 0, y: -20},
            {x: 20, y: -20}
        ]);
        expect(pastedRegions[1].controlPoints).toEqual([{x: 70, y: 30}]);
        expect(regionSet.setSelectionByIds).toHaveBeenCalledWith([-1, -2], -1);
    });
});
