import {FrameScaling} from "enums";

import {scalingParameterToSliderValue, sliderValueToScalingParameter} from "./ScalingParameterControlComponent";

describe("ScalingParameterControlComponent", () => {
    test.each([
        [FrameScaling.LOG, 0.1, 0.1, 10_000],
        [FrameScaling.SINH, 3, 0.1, 3],
        [FrameScaling.ASINH, 3, 0.01, 3]
    ])("places the linear end of scaling %s at the left", (scaling, alpha, min, max) => {
        expect(scalingParameterToSliderValue(scaling, alpha, min, max)).toBeCloseTo(0);
    });

    test.each([
        [FrameScaling.LOG, 10_000, 0.1, 10_000],
        [FrameScaling.POWER, 1_000, 0.001, 1_000],
        [FrameScaling.SINH, 0.1, 0.1, 3],
        [FrameScaling.ASINH, 0.01, 0.01, 3]
    ])("places the strongest end of scaling %s at the right", (scaling, alpha, min, max) => {
        expect(scalingParameterToSliderValue(scaling, alpha, min, max)).toBeCloseTo(100);
    });

    test("places power scaling linear in the middle", () => {
        expect(sliderValueToScalingParameter(FrameScaling.POWER, 0, 0.001, 1_000)).toBeCloseTo(0.001);
        expect(sliderValueToScalingParameter(FrameScaling.POWER, 50, 0.001, 1_000)).toBeCloseTo(1);
        expect(sliderValueToScalingParameter(FrameScaling.POWER, 100, 0.001, 1_000)).toBeCloseTo(1_000);
    });

    test.each([
        [FrameScaling.LOG, 32, 0.1, 10_000],
        [FrameScaling.POWER, 20, 0.001, 1_000],
        [FrameScaling.POWER, 0.2, 0.001, 1_000],
        [FrameScaling.SINH, 0.4, 0.1, 3],
        [FrameScaling.ASINH, 0.08, 0.01, 3]
    ])("round-trips alpha for scaling %s", (scaling, alpha, min, max) => {
        const sliderValue = scalingParameterToSliderValue(scaling, alpha, min, max);
        expect(sliderValueToScalingParameter(scaling, sliderValue, min, max)).toBeCloseTo(alpha);
    });

    test("places the Gamma linear value at the midpoint", () => {
        expect(scalingParameterToSliderValue(FrameScaling.GAMMA, 0.1, 0.1, 2)).toBeCloseTo(0);
        expect(scalingParameterToSliderValue(FrameScaling.GAMMA, 1, 0.1, 2)).toBeCloseTo(50);
        expect(scalingParameterToSliderValue(FrameScaling.GAMMA, 2, 0.1, 2)).toBeCloseTo(100);
    });

    test.each([0.1, 0.4, 1, 1.5, 2])("round-trips Gamma value %s", gamma => {
        const sliderValue = scalingParameterToSliderValue(FrameScaling.GAMMA, gamma, 0.1, 2);
        expect(sliderValueToScalingParameter(FrameScaling.GAMMA, sliderValue, 0.1, 2)).toBeCloseTo(gamma);
    });
});
