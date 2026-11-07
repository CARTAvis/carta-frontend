import {observable, runInAction} from "mobx";

import {BrowserMode, DialogId} from "enums";

// The file browser is open while its entry is true, as in `DialogStore`.
const DIALOG_VISIBLE = observable.map<DialogId, boolean>();
const APP_STORE_MOCK = {
    activeFrame: null as any,
    // A restore is running, so the file browser cannot open files.
    isOpenFileDisabled: true,
    isAppendFileDisabled: true,
    backendService: {
        getFileList: jest.fn(() => Promise.resolve({directory: "$BASE", files: [], subdirectories: []})),
        getCatalogList: jest.fn(() => Promise.resolve({directory: "$BASE", files: [], subdirectories: []}))
    },
    preferenceStore: {fileFilterMode: 0},
    restartTaskProgress: jest.fn()
};

jest.mock("stores", () => ({
    AppStore: {Instance: APP_STORE_MOCK},
    DialogStore: {
        Instance: {
            dialogVisible: DIALOG_VISIBLE,
            showDialog: jest.fn((id: DialogId) => runInAction(() => DIALOG_VISIBLE.set(id, true))),
            hideDialog: jest.fn((id: DialogId) => runInAction(() => DIALOG_VISIBLE.set(id, false)))
        }
    },
    PreferenceStore: {Instance: {}}
}));

jest.mock("services", () => ({BackendService: {Instance: {getFileList: jest.fn(), getCatalogList: jest.fn()}}}));

import {FileBrowserStore} from "./FileBrowserStore";

describe("FileBrowserStore.pickFile", () => {
    let fileBrowserStore: FileBrowserStore;

    beforeEach(() => {
        runInAction(() => DIALOG_VISIBLE.clear());
        fileBrowserStore = new FileBrowserStore();
        jest.spyOn(fileBrowserStore, "saveStartingDirectory").mockImplementation(jest.fn());
    });

    test("opens the browser while a restore runs, and returns the chosen image without opening it", async () => {
        const picking = fileBrowserStore.pickFile("image");

        expect(DIALOG_VISIBLE.get(DialogId.FileBrowser)).toBe(true);
        expect(fileBrowserStore.browserMode).toBe(BrowserMode.File);
        runInAction(() => {
            fileBrowserStore.fileList = {directory: "/data/moved", files: [], subdirectories: []} as any;
            fileBrowserStore.selectedFile = {name: "cube.fits"} as any;
            fileBrowserStore.selectedHDU = "1";
        });
        fileBrowserStore.choosePickedFile();

        await expect(picking).resolves.toEqual({directory: "/data/moved", filename: "cube.fits", hdu: "1"});
        expect(DIALOG_VISIBLE.get(DialogId.FileBrowser)).toBe(false);
        expect(fileBrowserStore.filePick).toBeUndefined();
    });

    test("returns a catalog file from the catalog directory, without an HDU", async () => {
        const picking = fileBrowserStore.pickFile("catalog");
        runInAction(() => {
            fileBrowserStore.catalogFileList = {directory: "/data/catalogs", files: [], subdirectories: []} as any;
            fileBrowserStore.selectedFile = {name: "sources.vot"} as any;
            fileBrowserStore.selectedHDU = "0";
        });
        fileBrowserStore.choosePickedFile();

        await expect(picking).resolves.toEqual({directory: "/data/catalogs", filename: "sources.vot", hdu: undefined});
    });

    test("returns nothing when the browser closes without a choice, also when another dialog closes it", async () => {
        const closedByUser = fileBrowserStore.pickFile("image");
        fileBrowserStore.hideFileBrowser();
        await expect(closedByUser).resolves.toBeUndefined();

        const closedByDialog = fileBrowserStore.pickFile("image");
        runInAction(() => DIALOG_VISIBLE.set(DialogId.FileBrowser, false));
        await expect(closedByDialog).resolves.toBeUndefined();
        expect(fileBrowserStore.filePick).toBeUndefined();
    });
});
