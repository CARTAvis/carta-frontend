import {LoadingStateStore} from "./LoadingStateStore";

describe("LoadingStateStore", () => {
    const tileService = {isChannelMapLoading: false, remainingTiles: 0};
    const channelMapStore = {isChannelMapEnabled: false};
    const activeFrame = {
        contourProgress: -1,
        vectorOverlayStore: {progress: -1}
    };
    const otherFrame = {
        contourProgress: -1,
        vectorOverlayStore: {progress: -1}
    };
    const store = new LoadingStateStore(
        tileService as never,
        channelMapStore as never,
        () => activeFrame as never,
        () => [activeFrame, otherFrame] as never
    );

    beforeEach(() => {
        tileService.isChannelMapLoading = false;
        tileService.remainingTiles = 0;
        channelMapStore.isChannelMapEnabled = false;
        activeFrame.contourProgress = -1;
        activeFrame.vectorOverlayStore.progress = -1;
        otherFrame.contourProgress = -1;
        otherFrame.vectorOverlayStore.progress = -1;
    });

    test("derives loading state from the active frame", () => {
        activeFrame.contourProgress = 0.5;
        activeFrame.vectorOverlayStore.progress = 0.25;

        expect(store.isLoadingContours).toBe(true);
        expect(store.isLoadingVectorOverlay).toBe(true);
        expect(store.isLoading).toBe(true);
    });

    test("includes non-active visible frames in aggregate loading state", () => {
        otherFrame.contourProgress = 0.5;

        expect(store.isLoadingContours).toBe(false);
        expect(store.isLoading).toBe(true);
    });

    test("uses channel-map rendering state for tile loading", () => {
        channelMapStore.isChannelMapEnabled = true;
        tileService.isChannelMapLoading = true;

        expect(store.isLoadingTiles).toBe(true);
    });
});
