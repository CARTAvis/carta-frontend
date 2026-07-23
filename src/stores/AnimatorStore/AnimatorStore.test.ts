const MOCK_APP_STORE = {
    activeFrame: null as {frameInfo: {fileInfoExtended: {depth: number; stokes: number}}} | null,
    activeImageIndex: 3,
    imageViewConfigStore: {imageNum: 5},
    setActiveImageByIndex: jest.fn()
};

const MOCK_TIME_SERIES_STORE = {
    elements: [] as unknown[],
    ensureActiveElement: jest.fn()
};

jest.mock("stores", () => ({
    AppStore: {Instance: MOCK_APP_STORE},
    PreferenceStore: {Instance: {}},
    TimeSeriesStore: {Instance: MOCK_TIME_SERIES_STORE}
}));

import {AnimationMode, PlayMode} from "enums";

import {AnimatorStore} from "./AnimatorStore";

describe("AnimatorStore image playback", () => {
    test("advances images according to the selected playback mode and step", () => {
        const store = new AnimatorStore();
        store.animationMode = AnimationMode.FRAME;
        store.playMode = PlayMode.BACKWARD;
        store.step = 2;
        store.isAnimationActive = true;

        store.animate();

        expect(MOCK_APP_STORE.setActiveImageByIndex).toHaveBeenCalledWith(1);
    });
});

describe("AnimatorStore animation mode", () => {
    let store: AnimatorStore;

    beforeEach(() => {
        store = new AnimatorStore();
        MOCK_APP_STORE.activeFrame = null;
        MOCK_APP_STORE.activeImageIndex = 3;
        MOCK_APP_STORE.imageViewConfigStore.imageNum = 5;
        MOCK_TIME_SERIES_STORE.elements = [];
        MOCK_TIME_SERIES_STORE.ensureActiveElement.mockClear();
    });

    test("does not select Time mode when fewer than 2 time-series elements are available", () => {
        MOCK_TIME_SERIES_STORE.elements = [{}];

        store.setAnimationMode(AnimationMode.TIME);

        expect(store.animationMode).toBe(AnimationMode.CHANNEL);
        expect(MOCK_TIME_SERIES_STORE.ensureActiveElement).not.toHaveBeenCalled();
    });

    test("selects a valid time-series element before entering Time mode", () => {
        MOCK_TIME_SERIES_STORE.elements = [{}, {}];

        store.setAnimationMode(AnimationMode.TIME);

        expect(MOCK_TIME_SERIES_STORE.ensureActiveElement).toHaveBeenCalledTimes(1);
        expect(store.animationMode).toBe(AnimationMode.TIME);
    });

    test("does not change modes during playback", () => {
        MOCK_TIME_SERIES_STORE.elements = [{}, {}];
        store.isAnimationActive = true;

        store.setAnimationMode(AnimationMode.TIME);

        expect(store.animationMode).toBe(AnimationMode.CHANNEL);
        expect(MOCK_TIME_SERIES_STORE.ensureActiveElement).not.toHaveBeenCalled();
    });

    test("selects the first available non-excluded mode", () => {
        store.animationMode = AnimationMode.TIME;
        MOCK_TIME_SERIES_STORE.elements = [{}, {}];

        expect(store.selectFirstAvailableAnimationMode([AnimationMode.TIME])).toBe(true);
        expect(store.animationMode).toBe(AnimationMode.FRAME);
    });

    test("falls back to channel mode when the image control is unavailable", () => {
        store.animationMode = AnimationMode.TIME;
        MOCK_APP_STORE.imageViewConfigStore.imageNum = 1;
        MOCK_APP_STORE.activeFrame = {frameInfo: {fileInfoExtended: {depth: 4, stokes: 1}}};

        expect(store.selectFirstAvailableAnimationMode([AnimationMode.TIME])).toBe(true);
        expect(store.animationMode).toBe(AnimationMode.CHANNEL);
    });

    test("skips available modes that are excluded by widget settings", () => {
        store.animationMode = AnimationMode.TIME;
        MOCK_APP_STORE.activeFrame = {frameInfo: {fileInfoExtended: {depth: 4, stokes: 2}}};

        expect(store.selectFirstAvailableAnimationMode([AnimationMode.TIME, AnimationMode.FRAME])).toBe(true);
        expect(store.animationMode).toBe(AnimationMode.CHANNEL);
    });

    test("clears the current mode when no fallback control is available", () => {
        store.animationMode = AnimationMode.TIME;
        MOCK_APP_STORE.imageViewConfigStore.imageNum = 1;
        MOCK_APP_STORE.activeFrame = {frameInfo: {fileInfoExtended: {depth: 1, stokes: 1}}};

        expect(store.selectFirstAvailableAnimationMode([AnimationMode.TIME])).toBe(false);
        expect(store.animationMode).toBe(AnimationMode.NONE);
        expect(store.shouldStartAnimationDisable).toBe(true);
    });

    test("does not select a fallback mode during playback", () => {
        store.animationMode = AnimationMode.TIME;
        store.isAnimationActive = true;

        expect(store.selectFirstAvailableAnimationMode([AnimationMode.TIME])).toBe(false);
        expect(store.animationMode).toBe(AnimationMode.TIME);
    });
});
