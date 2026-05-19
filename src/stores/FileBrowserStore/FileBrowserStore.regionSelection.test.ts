import {BrowserMode} from "enums";

const appStoreMock = {
    activeFrame: null as any,
    appendFileDisabled: false,
    backendService: {
        getFileList: jest.fn(() => Promise.resolve({directory: "$BASE", files: [], subdirectories: []})),
        getRegionList: jest.fn(() => Promise.resolve({directory: "$BASE", files: [], subdirectories: []}))
    },
    openFileDisabled: false,
    preferenceStore: {
        fileFilterMode: 0
    },
    restartTaskProgress: jest.fn()
};

jest.mock("stores", () => ({
    AppStore: {
        Instance: appStoreMock
    },
    DialogStore: {
        Instance: {
            showDialog: jest.fn()
        }
    },
    PreferenceStore: {
        Instance: {}
    }
}));

jest.mock("services", () => ({
    BackendService: {
        Instance: {
            getFileList: jest.fn(),
            getRegionList: jest.fn()
        }
    }
}));

import {FileBrowserStore} from "./FileBrowserStore";

describe("FileBrowserStore.showExportSelectedRegions", () => {
    let fileBrowserStore: FileBrowserStore;

    beforeEach(() => {
        jest.restoreAllMocks();
        appStoreMock.activeFrame = null;
        fileBrowserStore = new FileBrowserStore();
        fileBrowserStore.updateExportRegionIndexes([]);
        fileBrowserStore.browserMode = BrowserMode.File;
    });

    const setActiveRegionFrame = (regions: any[], selectedRegionsList: any[]) => {
        appStoreMock.activeFrame = {
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
