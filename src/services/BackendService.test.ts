import {CARTA} from "carta-protobuf";

import {AppStore} from "stores";

import {BackendService} from "./BackendService";

describe("BackendService guards for a nonlinear spectral axis", () => {
    const fileId = 5;

    const mockFrame = (isSpectralAxisNonlinear: boolean) => {
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({getFrame: (id: number) => (id === fileId ? {isSpectralAxisNonlinear} : undefined)} as unknown as AppStore);
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("rejects a moment request with a coordinate-dependent moment", async () => {
        mockFrame(true);
        await expect(BackendService.Instance.requestMoment({fileId, moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM, CARTA.Moment.MEDIAN_COORDINATE]})).rejects.toThrow("coordinate-dependent moments are not currently supported");
    });

    test("lets a moment request with pixel-value moments through to the connection check", async () => {
        mockFrame(true);
        await expect(BackendService.Instance.requestMoment({fileId, moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM]})).rejects.toThrow("Not connected");
    });

    test("rejects PV requests and lets them through for a linear axis", async () => {
        mockFrame(true);
        await expect(BackendService.Instance.requestPV({fileId, regionId: 1})).rejects.toThrow("PV generation is not currently supported");
        mockFrame(false);
        await expect(BackendService.Instance.requestPV({fileId, regionId: 1})).rejects.toThrow("Not connected");
    });

    test("rejects saving the image and lets it through for a linear axis", async () => {
        mockFrame(true);
        await expect(BackendService.Instance.saveFile(fileId, "/tmp", "out.fits", CARTA.FileType.FITS)).rejects.toThrow("Cube export is not currently supported");
        mockFrame(false);
        await expect(BackendService.Instance.saveFile(fileId, "/tmp", "out.fits", CARTA.FileType.FITS)).rejects.toThrow("Not connected");
    });
});
