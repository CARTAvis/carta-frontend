import {AppStore, HookStore} from "stores";

describe("AppStore curated file hooks", () => {
    beforeEach(() => {
        HookStore.Instance.clear();
        jest.restoreAllMocks();
    });

    test("removeAllFrames fires allFilesClosed when the backend close succeeds", () => {
        const handler = jest.fn();
        HookStore.Instance.set("h", "allFilesClosed", handler);
        // The hook only fires inside the closeFile(-1) success branch; force success so the
        // assertion verifies the hook actually fires (not merely that nothing throws).
        jest.spyOn(AppStore.Instance.backendService, "closeFile").mockReturnValue(true);
        AppStore.Instance.removeAllFrames();
        expect(handler).toHaveBeenCalledWith({});
    });

    test("setActiveImage fires activeImageChanged", () => {
        const handler = jest.fn();
        HookStore.Instance.set("h", "activeImageChanged", handler);
        AppStore.Instance.setActiveImage(null);
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({frame: null}));
    });

    test("handleSpectralProfileStream fires spectralProfileUpdated at entry", () => {
        const handler = jest.fn();
        HookStore.Instance.clear();
        HookStore.Instance.set("h", "spectralProfileUpdated", handler);
        try {
            // The hook fires as the first statement; downstream processing may throw on stub data — that's fine.
            AppStore.Instance.handleSpectralProfileStream({fileId: 3, regionId: 1} as any);
        } catch {
            /* downstream processing on stub data is not under test */
        }
        expect(handler).toHaveBeenCalledWith(expect.objectContaining({fileId: 3, regionId: 1}));
    });
});
