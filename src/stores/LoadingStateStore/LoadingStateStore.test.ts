import {LoadingStateStore} from "./LoadingStateStore";

describe("LoadingStateStore", () => {
    const tileService = {isChannelMapLoading: false, remainingTiles: 0};
    const channelMapStore = {isChannelMapEnabled: false};
    const frame = {
        contourProgress: -1,
        vectorOverlayStore: {progress: -1}
    };
    const store = new LoadingStateStore(tileService as never, channelMapStore as never, () => frame as never);

    test("derives loading state from the active frame", () => {
        frame.contourProgress = 0.5;
        frame.vectorOverlayStore.progress = 0.25;

        expect(store.isLoadingContours).toBe(true);
        expect(store.isLoadingVectorOverlay).toBe(true);
        expect(store.isLoading).toBe(true);
    });

    test("uses channel-map rendering state for tile loading", () => {
        frame.contourProgress = -1;
        frame.vectorOverlayStore.progress = -1;
        channelMapStore.isChannelMapEnabled = true;
        tileService.isChannelMapLoading = true;

        expect(store.isLoadingTiles).toBe(true);
    });
});
