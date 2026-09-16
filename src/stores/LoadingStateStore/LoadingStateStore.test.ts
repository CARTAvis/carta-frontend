import {LoadingStateStore} from "./LoadingStateStore";

describe("LoadingStateStore", () => {
    const tileService = {channelMapRemainingTiles: 0, normalViewRemainingTiles: 0};
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
        tileService.channelMapRemainingTiles = 0;
        tileService.normalViewRemainingTiles = 0;
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
        tileService.channelMapRemainingTiles = 40;

        expect(store.remainingTiles).toBe(40);
        expect(store.isLoading).toBe(true);
    });

    test("includes pending L2 decompressions in normal-view tile loading", () => {
        tileService.normalViewRemainingTiles = 1;

        expect(store.remainingTiles).toBe(1);
        expect(store.isLoading).toBe(true);
    });
});
