import {PlayMode} from "enums";

import {getNextPlaybackState} from "./animationPlayback";

describe("getNextPlaybackState", () => {
    test("moves forward and backward by the configured step with wrapping", () => {
        expect(getNextPlaybackState(3, 5, 2, PlayMode.FORWARD, 1).index).toBe(0);
        expect(getNextPlaybackState(1, 5, 2, PlayMode.BACKWARD, 1).index).toBe(4);
    });

    test("selects the appropriate endpoint when the active index is outside the sequence", () => {
        expect(getNextPlaybackState(-1, 5, 1, PlayMode.FORWARD, 1).index).toBe(0);
        expect(getNextPlaybackState(-1, 5, 1, PlayMode.BACKWARD, 1).index).toBe(4);
    });

    test("reflects at both endpoints in bouncing mode", () => {
        expect(getNextPlaybackState(3, 5, 2, PlayMode.BOUNCING, 1)).toEqual({index: 3, direction: -1});
        expect(getNextPlaybackState(1, 5, 2, PlayMode.BOUNCING, -1)).toEqual({index: 1, direction: 1});
        expect(getNextPlaybackState(0, 2, 50, PlayMode.BOUNCING, 1)).toEqual({index: 0, direction: 1});
    });

    test("alternates between the endpoints in blink mode", () => {
        expect(getNextPlaybackState(0, 5, 3, PlayMode.BLINK, 1).index).toBe(4);
        expect(getNextPlaybackState(4, 5, 3, PlayMode.BLINK, 1).index).toBe(0);
        expect(getNextPlaybackState(2, 5, 3, PlayMode.BLINK, 1).index).toBe(0);
    });
});
