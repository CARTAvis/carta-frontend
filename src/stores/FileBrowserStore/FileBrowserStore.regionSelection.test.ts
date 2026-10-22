import {rs} from "@rstest/core";

import {BrowserMode} from "enums";

const APP_STORE_MOCK = rs.hoisted(() => ({
    activeFrame: null as any,
    appendFileDisabled: false,
    backendService: {
        getFileList: rs.fn(() => Promise.resolve({directory: "$BASE", files: [], subdirectories: []})),
        getRegionList: rs.fn(() => Promise.resolve({directory: "$BASE", files: [], subdirectories: []}))
    },
    openFileDisabled: false,
    preferenceStore: {
        fileFilterMode: 0
    },
    restartTaskProgress: rs.fn()
}));

rs.mock("stores", () => ({
    AppStore: {
        Instance: APP_STORE_MOCK
    },
    DialogStore: {
        Instance: {
            showDialog: rs.fn()
        }
    },
    PreferenceStore: {
        Instance: {}
    }
}));

rs.mock("services", () => ({
    BackendService: {
        Instance: {
            getFileList: rs.fn(),
            getRegionList: rs.fn()
        }
    }
}));

import {FileBrowserStore} from "./FileBrowserStore";

describe("FileBrowserStore.showExportSelectedRegions", () => {
    let fileBrowserStore: FileBrowserStore;

    beforeEach(() => {
        rs.restoreAllMocks();
        APP_STORE_MOCK.activeFrame = null;
        fileBrowserStore = new FileBrowserStore();
        fileBrowserStore.updateExportRegionIndexes([]);
        fileBrowserStore.browserMode = BrowserMode.File;
    });

    const setActiveRegionFrame = (regions: any[], selectedRegionsList: any[]) => {
        APP_STORE_MOCK.activeFrame = {
            frameInfo: {fileId: 1},
            regionSet: {
                regions,
                selectedRegionsList
            }
        };
    };

    test("opens region export with only selected region indexes preselected", () => {
        const cursor = {regionId: 0};
        const first = {regionId: 1};
        const second = {regionId: 2};
        const third = {regionId: 3};
        setActiveRegionFrame([cursor, first, second, third], [second, third]);
        fileBrowserStore.showExportSelectedRegions();

        expect(fileBrowserStore.browserMode).toBe(BrowserMode.RegionExport);
        expect(fileBrowserStore.exportRegionIndexes).toEqual([2, 3]);
    });

    test("keeps export selection empty when no selected regions exist", () => {
        setActiveRegionFrame([{regionId: 0}, {regionId: 1}], []);

        fileBrowserStore.showExportSelectedRegions();

        expect(fileBrowserStore.browserMode).toBe(BrowserMode.RegionExport);
        expect(fileBrowserStore.exportRegionIndexes).toEqual([]);
    });
});
