import {CARTA} from "carta-protobuf";
import {configure} from "mobx";

import {AppToaster} from "components/Shared";
import {AppStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {ImageRequestCancelledError} from "stores/ImageGeneration/ImageGenerationRequests";

configure({safeDescriptors: false});

describe("AppStore requests that make moment and PV images", () => {
    const appStore = AppStore.Instance;
    const frame = {
        isSpectralAxisNonlinear: false,
        frameInfo: {fileId: 5},
        momentImages: [],
        pvImages: [],
        removeMomentImage: jest.fn(),
        removePvImage: jest.fn(),
        resetMomentRequestState: jest.fn(),
        resetPvRequestState: jest.fn(),
        setIsRequestPVCancelling: jest.fn()
    } as unknown as FrameStore;
    const momentMessage = {fileId: 5, moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM], keep: true};
    const pvMessage = {fileId: 5, regionId: 1};

    beforeEach(() => {
        jest.spyOn(AppToaster, "show").mockImplementation(() => Promise.resolve());
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("return no images for an error of the backend, unless they are asked to throw it", async () => {
        jest.spyOn(appStore.backendService, "requestMoment").mockRejectedValue("Moment generation failed");
        jest.spyOn(appStore.backendService, "requestPV").mockRejectedValue("PV generation failed");

        await expect(appStore.requestMoment(momentMessage, frame)).resolves.toEqual([]);
        await expect(appStore.requestMoment(momentMessage, frame, {shouldThrow: true})).rejects.toBe("Moment generation failed");

        await expect(appStore.requestPV(pvMessage, frame, true)).resolves.toBeUndefined();
        expect(AppToaster.show).toHaveBeenCalledTimes(1);
        await expect(appStore.requestPV(pvMessage, frame, true, {shouldThrow: true})).rejects.toBe("PV generation failed");
        // A thrown error shows no toast.
        expect(AppToaster.show).toHaveBeenCalledTimes(1);
    });

    test("throw an ImageRequestCancelledError for a cancelled request, only when they are asked to throw", async () => {
        jest.spyOn(appStore.backendService, "requestMoment").mockResolvedValue({success: true, cancel: true} as CARTA.MomentResponse.$Properties);
        jest.spyOn(appStore.backendService, "requestPV").mockResolvedValue({success: true, cancel: true} as CARTA.PvResponse.$Properties);

        await expect(appStore.requestMoment(momentMessage, frame)).resolves.toEqual([]);
        await expect(appStore.requestMoment(momentMessage, frame, {shouldThrow: true})).rejects.toBeInstanceOf(ImageRequestCancelledError);

        await expect(appStore.requestPV(pvMessage, frame, true)).resolves.toBeUndefined();
        await expect(appStore.requestPV(pvMessage, frame, true, {shouldThrow: true})).rejects.toBeInstanceOf(ImageRequestCancelledError);
        expect(AppToaster.show).not.toHaveBeenCalled();
        expect(frame.resetPvRequestState).toHaveBeenCalled();
    });

    test("throw an ImageRequestCancelledError when the user cancels a PV request that is asked to throw", async () => {
        // The backend answers a cancelled PV request with success false, so the request is rejected with the message.
        const cancellingFrame = frame as unknown as {isRequestPVCancelling: boolean};
        jest.spyOn(appStore.backendService, "requestPV").mockImplementation(() => {
            cancellingFrame.isRequestPVCancelling = true;
            return Promise.reject("PV image generator cancelled.");
        });
        await expect(appStore.requestPV(pvMessage, frame, true, {shouldThrow: true})).rejects.toBeInstanceOf(ImageRequestCancelledError);

        cancellingFrame.isRequestPVCancelling = false;
        jest.spyOn(appStore.backendService, "requestPV").mockRejectedValue("PV generation failed");
        await expect(appStore.requestPV(pvMessage, frame, true, {shouldThrow: true})).rejects.toBe("PV generation failed");
    });
});
