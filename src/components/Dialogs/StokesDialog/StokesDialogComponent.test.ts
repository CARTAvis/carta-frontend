import {rs} from "@rstest/core";
import {CARTA} from "carta-protobuf";
import {observable, runInAction} from "mobx";

import {BrowserMode, DialogId} from "enums";
import {AppStore, PreferenceStore} from "stores";

import {StokesDialogComponent} from "./StokesDialogComponent";

describe("StokesDialogComponent", () => {
    afterEach(() => {
        rs.restoreAllMocks();
    });

    test.each([false, true])("submits polarization files from an empty directory (append: %s)", async isAppendingFrame => {
        const stokes = {directory: "", file: "image.fits", hdu: "0", polarizationType: CARTA.PolarizationType.I};
        const openConcatFile = rs.fn().mockResolvedValue(undefined);
        const appendConcatFile = rs.fn().mockResolvedValue(undefined);
        const setStokesFiles = rs.fn();
        const saveStartingDirectory = rs.fn();
        rs.spyOn(AppStore, "Instance", "get").mockReturnValue({
            dialogStore: {dialogVisible: observable.map<DialogId, boolean>()},
            activeFrame: {setStokesFiles},
            frames: [{}],
            openConcatFile,
            appendConcatFile,
            fileBrowserStore: {
                browserMode: BrowserMode.File,
                fileList: {directory: ""},
                isAppendingFrame,
                saveStartingDirectory
            }
        } as unknown as AppStore);
        rs.spyOn(PreferenceStore, "Instance", "get").mockReturnValue({isDynamicLayoutEnabled: false} as PreferenceStore);

        const component = new StokesDialogComponent({});
        try {
            component.setStokes(stokes.file, stokes);
            await component["loadSelectedFiles"]();

            expect(isAppendingFrame ? appendConcatFile : openConcatFile).toHaveBeenCalledWith([stokes], "", "0");
            expect(isAppendingFrame ? openConcatFile : appendConcatFile).not.toHaveBeenCalled();
            expect(setStokesFiles).toHaveBeenCalledWith([stokes]);
            expect(saveStartingDirectory).toHaveBeenCalled();
        } finally {
            component.componentWillUnmount();
        }
    });

    test.each(["", "images"])("loads polarization file metadata from directory '%s'", async directory => {
        const stokes = {directory, file: "image.fits", hdu: "0", polarizationType: CARTA.PolarizationType.I};
        const getStokesFile = rs.fn().mockResolvedValue(stokes);
        const dialogVisible = observable.map<DialogId, boolean>();
        rs.spyOn(AppStore, "Instance", "get").mockReturnValue({
            dialogStore: {dialogVisible},
            fileBrowserStore: {
                fileList: {directory},
                selectedFiles: [{fileInfo: {name: "image.fits"}, hdu: "0"}],
                getStokesFile
            }
        } as unknown as AppStore);

        const component = new StokesDialogComponent({});
        try {
            runInAction(() => dialogVisible.set(DialogId.Stokes, true));
            await Promise.resolve();

            expect(getStokesFile).toHaveBeenCalledWith(directory, "image.fits", "0");
            expect(component.stokes.get("image.fits")).toEqual(stokes);
        } finally {
            component.componentWillUnmount();
        }
    });
});
