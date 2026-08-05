import {FrameScaling} from "enums";

import {scalingParameterToSliderValue, sliderValueToScalingParameter} from "./ScalingParameterControlComponent";

describe("ScalingParameterControlComponent", () => {
    test.each([
        [FrameScaling.LOG, 0.1, 0.1, 1_000_000],
        [FrameScaling.SINH, 3, 0.05, 3],
        [FrameScaling.ASINH, 3, 0.000001, 3]
    ])("places the linear end of scaling %s at the left", (scaling, alpha, min, max) => {
        expect(scalingParameterToSliderValue(scaling, alpha, min, max)).toBeCloseTo(0);
    });

    test.each([
        [FrameScaling.LOG, 1_000_000, 0.1, 1_000_000],
        [FrameScaling.POWER, 1_000_000, 0.000001, 1_000_000],
        [FrameScaling.SINH, 0.05, 0.05, 3],
        [FrameScaling.ASINH, 0.000001, 0.000001, 3]
    ])("places the strongest end of scaling %s at the right", (scaling, alpha, min, max) => {
        expect(scalingParameterToSliderValue(scaling, alpha, min, max)).toBeCloseTo(100);
    });

    test("places power scaling linear in the middle", () => {
        expect(sliderValueToScalingParameter(FrameScaling.POWER, 0, 0.000001, 1_000_000)).toBeCloseTo(0.000001);
        expect(sliderValueToScalingParameter(FrameScaling.POWER, 50, 0.000001, 1_000_000)).toBeCloseTo(1);
        expect(sliderValueToScalingParameter(FrameScaling.POWER, 100, 0.000001, 1_000_000)).toBeCloseTo(1_000_000);
    });

    test.each([
        [FrameScaling.LOG, 32, 0.1, 1_000_000],
        [FrameScaling.POWER, 20, 0.000001, 1_000_000],
        [FrameScaling.POWER, 0.2, 0.000001, 1_000_000],
        [FrameScaling.SINH, 0.4, 0.05, 3],
        [FrameScaling.ASINH, 0.08, 0.000001, 3]
    ])("round-trips alpha for scaling %s", (scaling, alpha, min, max) => {
        const sliderValue = scalingParameterToSliderValue(scaling, alpha, min, max);
        expect(sliderValueToScalingParameter(scaling, sliderValue, min, max)).toBeCloseTo(alpha);
    });

    test("places the Gamma default value at the midpoint", () => {
        expect(scalingParameterToSliderValue(FrameScaling.GAMMA, 0.01, 0.01, 10)).toBeCloseTo(0);
        expect(scalingParameterToSliderValue(FrameScaling.GAMMA, 0.3, 0.01, 10)).toBeCloseTo(50);
        expect(scalingParameterToSliderValue(FrameScaling.GAMMA, 10, 0.01, 10)).toBeCloseTo(100);
    });

    test.each([0.01, 0.05, 0.1, 0.3, 0.4, 1, 2, 4, 10])("round-trips Gamma value %s", gamma => {
        const sliderValue = scalingParameterToSliderValue(FrameScaling.GAMMA, gamma, 0.01, 10);
        expect(sliderValueToScalingParameter(FrameScaling.GAMMA, sliderValue, 0.01, 10)).toBeCloseTo(gamma);
    });
});
