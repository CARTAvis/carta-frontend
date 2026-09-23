import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {ImageType} from "enums";
import {AppStore} from "stores";
import {type FrameStore} from "stores/Frame";

describe("AppStore flows for a nonlinear spectral axis", () => {
    const appStore = AppStore.Instance;
    const nonlinearFrame = {isSpectralAxisNonlinear: true, frameInfo: {fileId: 5}} as unknown as FrameStore;

    afterEach(() => {
        runInAction(() => {
            appStore.activeImage = null;
        });
        jest.restoreAllMocks();
    });

    test("requestMoment rejects a coordinate-dependent moment without contacting the backend", async () => {
        const requestMoment = jest.spyOn(appStore.backendService, "requestMoment").mockResolvedValue({} as CARTA.MomentResponse.$Properties);
        await expect(appStore.requestMoment({fileId: 5, moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]}, nonlinearFrame)).rejects.toThrow("coordinate-dependent moments are not currently supported");
        expect(requestMoment).not.toHaveBeenCalled();
    });

    test("requestPV and requestPreviewPV reject without contacting the backend", async () => {
        const requestPV = jest.spyOn(appStore.backendService, "requestPV").mockResolvedValue({} as CARTA.PvResponse.$Properties);
        await expect(appStore.requestPV({fileId: 5, regionId: 1}, nonlinearFrame, false)).rejects.toThrow("PV generation is not currently supported");
        await expect(appStore.requestPreviewPV({fileId: 5, regionId: 1}, nonlinearFrame, "pv-generator-0-1")).rejects.toThrow("PV generation is not currently supported");
        expect(requestPV).not.toHaveBeenCalled();
    });

    test("saveFile rejects without contacting the backend", async () => {
        runInAction(() => {
            appStore.activeImage = {type: ImageType.FRAME, store: nonlinearFrame};
        });
        const saveFile = jest.spyOn(appStore.backendService, "saveFile").mockResolvedValue({} as CARTA.SaveFileAck.$Properties);
        await expect(appStore.saveFile("/tmp", "out.fits", CARTA.FileType.FITS)).rejects.toThrow("Cube export is not currently supported");
        expect(saveFile).not.toHaveBeenCalled();
    });
});
