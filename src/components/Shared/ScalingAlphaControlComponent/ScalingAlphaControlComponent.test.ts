import {FrameScaling} from "enums";

import {alphaToSliderValue, sliderValueToAlpha} from "./ScalingAlphaControlComponent";

describe("ScalingAlphaControlComponent", () => {
    test.each([
        [FrameScaling.LOG, 0.1, 0.1, 10_000],
        [FrameScaling.SINH, 3, 0.1, 3],
        [FrameScaling.ASINH, 3, 0.01, 3]
    ])("places the linear end of scaling %s at the left", (scaling, alpha, min, max) => {
        expect(alphaToSliderValue(scaling, alpha, min, max)).toBeCloseTo(0);
    });

    test.each([
        [FrameScaling.LOG, 10_000, 0.1, 10_000],
        [FrameScaling.POWER, 1_000, 0.001, 1_000],
        [FrameScaling.SINH, 0.1, 0.1, 3],
        [FrameScaling.ASINH, 0.01, 0.01, 3]
    ])("places the strongest end of scaling %s at the right", (scaling, alpha, min, max) => {
        expect(alphaToSliderValue(scaling, alpha, min, max)).toBeCloseTo(100);
    });

    test("places power scaling linear in the middle", () => {
        expect(sliderValueToAlpha(FrameScaling.POWER, 0, 0.001, 1_000)).toBeCloseTo(0.001);
        expect(sliderValueToAlpha(FrameScaling.POWER, 50, 0.001, 1_000)).toBeCloseTo(1);
        expect(sliderValueToAlpha(FrameScaling.POWER, 100, 0.001, 1_000)).toBeCloseTo(1_000);
    });

    test.each([
        [FrameScaling.LOG, 32, 0.1, 10_000],
        [FrameScaling.POWER, 20, 0.001, 1_000],
        [FrameScaling.POWER, 0.2, 0.001, 1_000],
        [FrameScaling.SINH, 0.4, 0.1, 3],
        [FrameScaling.ASINH, 0.08, 0.01, 3]
    ])("round-trips alpha for scaling %s", (scaling, alpha, min, max) => {
        const sliderValue = alphaToSliderValue(scaling, alpha, min, max);
        expect(sliderValueToAlpha(scaling, sliderValue, min, max)).toBeCloseTo(alpha);
    });
});
