import {LoadingStateStore} from "./LoadingStateStore";

describe("LoadingStateStore", () => {
    const pendingTiles = new Map<number, number>();
    const tileService = {channelMapRemainingTiles: 0, getNormalViewRemainingTiles: (fileId: number) => pendingTiles.get(fileId) ?? 0};
    const channelMapStore = {isChannelMapEnabled: false};
    const activeFrame = {
        frameInfo: {fileId: 1},
        contourProgress: -1,
        vectorOverlayStore: {progress: -1}
    };
    const otherFrame = {
        frameInfo: {fileId: 2},
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
        pendingTiles.clear();
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
        pendingTiles.set(2, 1);

        expect(store.remainingTiles).toBe(1);
        expect(store.isLoading).toBe(true);
    });

    test("ignores tiles pending for frames outside the current page", () => {
        pendingTiles.set(3, 2);

        expect(store.remainingTiles).toBe(0);
        expect(store.isLoading).toBe(false);
    });
});
