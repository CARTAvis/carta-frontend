const BACKEND_MOCK = {
    getFileInfo: jest.fn()
};

jest.mock("stores", () => ({
    AppStore: {
        Instance: {preferenceStore: {fileFilterMode: 0}}
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
        Instance: BACKEND_MOCK
    }
}));

import {CARTA} from "carta-protobuf";

import {FileBrowserStore, orderedHDUs} from "./FileBrowserStore";

describe("orderedHDUs", () => {
    test("follows the HDU list instead of the order of the map", () => {
        const map = {SKY_ERROR: {}, SKY_COVERAGE: {}, SKY: {}};
        expect(orderedHDUs(map, ["SKY", "SKY_ERROR", "SKY_COVERAGE"])).toEqual(["SKY", "SKY_ERROR", "SKY_COVERAGE"]);
    });

    test("leaves out listed HDUs that the map does not have, and keeps unlisted keys at the end", () => {
        const map = {B: {}, C: {}, A: {}};
        expect(orderedHDUs(map, ["A", "MISSING", "B"])).toEqual(["A", "B", "C"]);
    });

    test("keeps the order of the map without an HDU list", () => {
        expect(orderedHDUs({"1": {}, "0": {}}, undefined)).toEqual(["0", "1"]);
        expect(orderedHDUs(null, ["SKY"])).toEqual([]);
    });
});

describe("FileBrowserStore.getFileInfo", () => {
    test("selects the first image of the HDU list, whatever order the map arrives in", async () => {
        const fileBrowserStore = new FileBrowserStore();
        fileBrowserStore.selectedFile = {name: "spire500_ext.zarr"};
        BACKEND_MOCK.getFileInfo.mockResolvedValue({
            fileInfo: {name: "spire500_ext.zarr", HDUList: ["SKY", "SKY_ERROR", "SKY_COVERAGE"]},
            fileInfoExtended: {SKY_COVERAGE: {}, SKY_ERROR: {}, SKY: {}}
        });

        await fileBrowserStore.getFileInfo("$BASE", "spire500_ext.zarr", "");

        expect(fileBrowserStore.selectedHDU).toBe("SKY");
        expect(fileBrowserStore.HDUList?.map(option => option.value)).toEqual(["SKY", "SKY_ERROR", "SKY_COVERAGE"]);
    });
});

describe("FileBrowserStore.getStokesFile", () => {
    const stokesHeader = (stokes: string) => ({
        headerEntries: [
            {name: "CTYPE4", value: "STOKES"},
            {name: "CRPIX4", value: "1"},
            {name: "CRVAL4", value: stokes},
            {name: "CDELT4", value: "1"}
        ]
    });

    test("reads the Stokes type of the first image of the HDU list", async () => {
        BACKEND_MOCK.getFileInfo.mockResolvedValue({
            fileInfo: {name: "cube.zarr", HDUList: ["SKY", "SKY_ERROR"]},
            fileInfoExtended: {SKY_ERROR: stokesHeader("1"), SKY: stokesHeader("2")}
        });

        const stokes = await new FileBrowserStore().getStokesFile("$BASE", "cube.zarr", "");

        expect(stokes?.polarizationType).toBe(CARTA.PolarizationType.Q);
    });
});

describe("FileBrowserStore.selectFile", () => {
    test("forgets the HDU of the previous file when the new row names none", () => {
        const fileBrowserStore = new FileBrowserStore();
        BACKEND_MOCK.getFileInfo.mockReturnValue(new Promise(() => {}));
        fileBrowserStore.selectedHDU = "SKY_ERROR";

        fileBrowserStore.selectFile({fileInfo: {name: "other.zarr"}, hdu: ""});

        expect(fileBrowserStore.selectedHDU).toBeNull();
    });
});
