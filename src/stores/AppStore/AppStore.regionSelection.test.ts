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

const mockMakeStore = (overrides = {}) => ({...overrides});

jest.mock("stores", () => ({
    AlertStore: {Instance: mockMakeStore()},
    AnimatorStore: {Instance: mockMakeStore()},
    CatalogStore: {Instance: mockMakeStore()},
    ChannelMapStore: {Instance: mockMakeStore()},
    DialogStore: {Instance: mockMakeStore()},
    DynamicLayoutStore: {Instance: mockMakeStore()},
    FileBrowserStore: {Instance: mockMakeStore()},
    HelpStore: {Instance: mockMakeStore()},
    HipsQueryStore: {Instance: mockMakeStore()},
    ImageFittingStore: {Instance: mockMakeStore()},
    ImageViewConfigStore: {Instance: mockMakeStore({frames: [], visibleFrames: []})},
    LayoutStore: {Instance: mockMakeStore()},
    LogStore: {Instance: mockMakeStore({addDebug: jest.fn(), addInfo: jest.fn()})},
    OverlaySettings: {Instance: mockMakeStore()},
    PreferenceStore: {Instance: mockMakeStore({autoLaunch: false})},
    SnippetStore: {Instance: mockMakeStore()},
    SpatialProfileStore: jest.fn(),
    SpectralProfileStore: jest.fn(),
    WidgetsStore: {Instance: mockMakeStore({removeRegionFromRegionWidgets: jest.fn(), updateRenderConfigSettingsVisibility: jest.fn()})}
}));

import {ImageType} from "enums";
import {CURSOR_REGION_ID} from "stores/Frame";

import {AppStore} from "./AppStore";

const makeRegion = (regionId: number, locked = false) => ({fileId: 1, regionId, locked}) as any;

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

    test("deletes selected unlocked regions and clears selection", () => {
        const cursor = makeRegion(CURSOR_REGION_ID);
        const first = makeRegion(1);
        const locked = makeRegion(2, true);
        const second = makeRegion(3);
        const clearSelection = jest.fn();

        const regionSet = {
            clearSelection,
            focusedRegion: first,
            locked: false,
            deleteRegion: jest.fn(),
            regions: [cursor, first, locked, second],
            selectedRegionIds: new Set([first.regionId, locked.regionId, second.regionId])
        };
        const {result} = callDeleteSelectedRegions(regionSet);

        expect(result).toBe(true);
        expect(regionSet.deleteRegion).toHaveBeenCalledTimes(2);
        expect(regionSet.deleteRegion).toHaveBeenCalledWith(first);
        expect(regionSet.deleteRegion).toHaveBeenCalledWith(second);
        expect(clearSelection).toHaveBeenCalled();
    });

    test("does not delete when the region set is locked", () => {
        const regionSet = {
            deleteRegion: jest.fn(),
            focusedRegion: makeRegion(1),
            locked: true,
            regions: [makeRegion(1)],
            selectedRegionIds: new Set([1])
        };
        const {result} = callDeleteSelectedRegions(regionSet);

        expect(result).toBe(false);
        expect(regionSet.deleteRegion).not.toHaveBeenCalled();
    });

    test("deletes focused region when there is no explicit selection", () => {
        const focusedRegion = makeRegion(7);
        const regionSet = {
            deleteRegion: jest.fn(),
            focusedRegion,
            locked: false,
            regions: [focusedRegion],
            selectedRegionIds: new Set()
        };
        const {result} = callDeleteSelectedRegions(regionSet);

        expect(result).toBe(true);
        expect(regionSet.deleteRegion).toHaveBeenCalledWith(focusedRegion);
    });

    test("does not delete locked focused region", () => {
        const focusedRegion = makeRegion(7, true);
        const regionSet = {
            deleteRegion: jest.fn(),
            focusedRegion,
            locked: false,
            regions: [focusedRegion],
            selectedRegionIds: new Set()
        };
        const {result} = callDeleteSelectedRegions(regionSet);

        expect(result).toBe(false);
        expect(regionSet.deleteRegion).not.toHaveBeenCalled();
    });
});
