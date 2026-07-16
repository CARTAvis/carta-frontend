const MOCK_APP_STORE = {
    activeImageIndex: 3,
    imageViewConfigStore: {imageNum: 5},
    setActiveImageByIndex: jest.fn()
};

jest.mock("stores", () => ({
    AppStore: {Instance: MOCK_APP_STORE},
    PreferenceStore: {Instance: {}}
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
