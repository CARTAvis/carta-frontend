import {CARTA} from "carta-protobuf";
import {observable, runInAction} from "mobx";

import {DialogId} from "enums";
import {AppStore} from "stores";

import {StokesDialogComponent} from "./StokesDialogComponent";

describe("StokesDialogComponent", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test.each(["", "images"])("loads polarization file metadata from directory '%s'", async directory => {
        const stokes = {directory, file: "image.fits", hdu: "0", polarizationType: CARTA.PolarizationType.I};
        const getStokesFile = jest.fn().mockResolvedValue(stokes);
        const dialogVisible = observable.map<DialogId, boolean>();
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({
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
