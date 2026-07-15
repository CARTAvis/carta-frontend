const MOCK_APP_STORE = {
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
});
