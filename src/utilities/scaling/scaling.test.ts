import {FrameScaling, PreferenceKeys} from "enums";

import {getScalingForParameterPreference, getScalingParameterConfig, isSupportedFrameScaling, POWER_ALPHA_EPSILON, sanitizeScalingParameter, scaleValue, scaleValueInverse, SUPPORTED_SCALING_TYPES} from "./scaling";

const TEST_SAMPLES = Array.from({length: 101}, (_, index) => index / 100);
const POWER_SCALING = FrameScaling.POWER;
const SINH_SCALING = FrameScaling.SINH;
const ASINH_SCALING = FrameScaling.ASINH;
const SCALING_TYPES = [SINH_SCALING, ASINH_SCALING];
const ANCHOR_SAMPLES = [
    {
        x: 0.25,
        sinh: 0.24999996093750443,
        asinh: 0.25000003906248786
    },
    {
        x: 0.5,
        sinh: 0.49999993750000654,
        asinh: 0.5000000624999753
    },
    {
        x: 0.75,
        sinh: 0.7499999453125048,
        asinh: 0.7500000546874708
    }
];

describe("sinh/asinh scaling", () => {
    test("scaleValue maps 0 and 1 to endpoints", () => {
        expect(scaleValue(0, SINH_SCALING)).toBeCloseTo(0, 12);
        expect(scaleValue(1, SINH_SCALING)).toBeCloseTo(1, 12);
        expect(scaleValue(0, ASINH_SCALING)).toBeCloseTo(0, 12);
        expect(scaleValue(1, ASINH_SCALING)).toBeCloseTo(1, 12);
    });

    test("scaleValue is monotonic", () => {
        let prevSinh = -Number.MAX_VALUE;
        let prevAsinh = -Number.MAX_VALUE;
        for (const x of TEST_SAMPLES) {
            const sinhVal = scaleValue(x, SINH_SCALING);
            const asinhVal = scaleValue(x, ASINH_SCALING);
            expect(sinhVal).toBeGreaterThanOrEqual(prevSinh);
            expect(asinhVal).toBeGreaterThanOrEqual(prevAsinh);
            prevSinh = sinhVal;
            prevAsinh = asinhVal;
        }
    });

    test("scaleValueInverse inverts scaleValue", () => {
        for (const x of TEST_SAMPLES) {
            const sinhScaled = scaleValue(x, SINH_SCALING);
            const asinhScaled = scaleValue(x, ASINH_SCALING);
            expect(scaleValueInverse(sinhScaled, SINH_SCALING)).toBeCloseTo(x, 6);
            expect(scaleValueInverse(asinhScaled, ASINH_SCALING)).toBeCloseTo(x, 6);
        }
    });

    test("scaleValue matches anchor values for sinh/asinh with default alpha", () => {
        for (const sample of ANCHOR_SAMPLES) {
            expect(scaleValue(sample.x, SINH_SCALING)).toBeCloseTo(sample.sinh, 12);
            expect(scaleValue(sample.x, ASINH_SCALING)).toBeCloseTo(sample.asinh, 12);
        }
    });

    test("non-default bias/contrast changes sinh/asinh output in expected directions", () => {
        for (const scaling of SCALING_TYPES) {
            const baseMid = scaleValue(0.6, scaling);

            const withPositiveBias = scaleValue(0.6, scaling, 1000, 1.5, 0.2, 1, false);
            const withNegativeBias = scaleValue(0.6, scaling, 1000, 1.5, -0.2, 1, false);
            expect(withPositiveBias).toBeLessThan(baseMid);
            expect(withNegativeBias).toBeGreaterThan(baseMid);

            const baseNearMid = scaleValue(0.2, scaling, 1000, 1.5, 0, 1, false);
            const baseFarMid = scaleValue(0.9, scaling, 1000, 1.5, 0, 1, false);
            const highContrastNearMid = scaleValue(0.2, scaling, 1000, 1.5, 0, 1.5, false);
            const highContrastFarMid = scaleValue(0.9, scaling, 1000, 1.5, 0, 1.5, false);
            expect(Math.abs(highContrastNearMid - 0.5)).toBeGreaterThan(Math.abs(baseNearMid - 0.5));
            expect(Math.abs(highContrastFarMid - 0.5)).toBeGreaterThan(Math.abs(baseFarMid - 0.5));
        }
    });

    test("smoothed high-contrast bias/contrast remains monotonic for sinh/asinh", () => {
        const bias = -0.3;
        const contrast = 1.6;
        for (const scaling of SCALING_TYPES) {
            let prev = -Number.MAX_VALUE;
            for (const x of TEST_SAMPLES) {
                const scaled = scaleValue(x, scaling, 1000, 1.5, bias, contrast, true);
                expect(Number.isFinite(scaled)).toBe(true);
                expect(scaled).toBeGreaterThanOrEqual(prev);
                prev = scaled;
            }
        }
    });

    test("scaleValue with smoothed bias/contrast stays finite and within [0, 1]", () => {
        const configs = [
            {bias: -0.5, contrast: 0.6},
            {bias: 0, contrast: 1},
            {bias: 0.4, contrast: 1.7}
        ];
        for (const scaling of SCALING_TYPES) {
            for (const {bias, contrast} of configs) {
                for (const x of TEST_SAMPLES) {
                    const scaled = scaleValue(x, scaling, 1000, 1.5, bias, contrast, true);
                    expect(Number.isFinite(scaled)).toBe(true);
                    expect(scaled).toBeGreaterThanOrEqual(-1.0e-12);
                    expect(scaled).toBeLessThanOrEqual(1 + 1.0e-12);
                }
            }
        }
    });

    test("out-of-range inputs clamp at boundaries when non-smoothed bias/contrast is used", () => {
        for (const scaling of SCALING_TYPES) {
            expect(scaleValue(-1, scaling, 1000, 1.5, 0, 1, false)).toBe(0);
            expect(scaleValue(-0.1, scaling, 1000, 1.5, 0, 1, false)).toBe(0);
            expect(scaleValue(1.1, scaling, 1000, 1.5, 0, 1, false)).toBe(1);
            expect(scaleValue(2, scaling, 1000, 1.5, 0, 1, false)).toBe(1);
        }
    });

    test("scaleValueInverse handles the smoothed contrast==0 edge case", () => {
        for (const scaling of SCALING_TYPES) {
            const restored = scaleValueInverse(0, scaling, 1000, 1.5, 1, 0, true);
            expect(Number.isFinite(restored)).toBe(true);
            expect(restored).toBeCloseTo(1, 12);
        }
    });

    test("scaleValueInverse clamps out-of-range inputs at boundaries", () => {
        for (const scaling of SCALING_TYPES) {
            expect(scaleValueInverse(-1, scaling, 1000, 1.5, 0, 1, false)).toBeCloseTo(0, 12);
            expect(scaleValueInverse(2, scaling, 1000, 1.5, 0, 1, false)).toBeCloseTo(1, 12);
            expect(scaleValueInverse(-1, scaling, 1000, 1.5, 0, 1, true)).toBeCloseTo(0, 12);
            expect(scaleValueInverse(2, scaling, 1000, 1.5, 0, 1, true)).toBeCloseTo(1, 12);
        }
    });

    test("scaleValue with alpha=0.1 matches expected values", () => {
        const alpha = 0.1;
        const expected = [
            {x: 0.25, sinh: 0.0005493577181080656, asinh: 0.5494024872991484},
            {x: 0.5, sinh: 0.006737641110652278, asinh: 0.7712696419200371},
            {x: 0.75, sinh: 0.08208497368309699, asinh: 0.9046909953493529}
        ];
        for (const sample of expected) {
            expect(scaleValue(sample.x, SINH_SCALING, alpha)).toBeCloseTo(sample.sinh, 12);
            expect(scaleValue(sample.x, ASINH_SCALING, alpha)).toBeCloseTo(sample.asinh, 12);
        }
    });

    test("scaleValue with alpha=1/3 matches expected values", () => {
        const alpha = 1 / 3;
        const expected = [
            {x: 0.25, sinh: 0.08208494694677107, asinh: 0.38117546823603626},
            {x: 0.5, sinh: 0.2125480174711402, asinh: 0.6570241379510618},
            {x: 0.75, sinh: 0.4682797838754033, asinh: 0.8524627981203784}
        ];
        for (const sample of expected) {
            expect(scaleValue(sample.x, SINH_SCALING, alpha)).toBeCloseTo(sample.sinh, 12);
            expect(scaleValue(sample.x, ASINH_SCALING, alpha)).toBeCloseTo(sample.asinh, 12);
        }
    });

    test("scaleValue endpoints hold for various alpha values", () => {
        for (const alpha of [1e-6, 0.1, 0.5, 1, 10, 1000]) {
            for (const scaling of SCALING_TYPES) {
                expect(scaleValue(0, scaling, alpha)).toBeCloseTo(0, 12);
                expect(scaleValue(1, scaling, alpha)).toBeCloseTo(1, 12);
            }
        }
    });

    test("scaleValue is monotonic for various alpha values", () => {
        for (const alpha of [0.1, 1, 100]) {
            for (const scaling of SCALING_TYPES) {
                let prev = -Number.MAX_VALUE;
                for (const x of TEST_SAMPLES) {
                    const val = scaleValue(x, scaling, alpha);
                    expect(val).toBeGreaterThanOrEqual(prev);
                    prev = val;
                }
            }
        }
    });

    test("scaleValueInverse inverts scaleValue for various alpha values", () => {
        for (const alpha of [0.1, 1, 100]) {
            for (const x of TEST_SAMPLES) {
                const sinhScaled = scaleValue(x, SINH_SCALING, alpha);
                const asinhScaled = scaleValue(x, ASINH_SCALING, alpha);
                expect(scaleValueInverse(sinhScaled, SINH_SCALING, alpha)).toBeCloseTo(x, 6);
                expect(scaleValueInverse(asinhScaled, ASINH_SCALING, alpha)).toBeCloseTo(x, 6);
            }
        }
    });

    test("sinh scaling stays finite at the minimum alpha", () => {
        const alpha = 1e-6;
        for (const x of TEST_SAMPLES) {
            const scaled = scaleValue(x, SINH_SCALING, alpha);
            expect(Number.isFinite(scaled)).toBe(true);
            expect(scaled).toBeGreaterThanOrEqual(0);
            expect(scaled).toBeLessThanOrEqual(1);
        }

        for (const x of [0, 0.25, 0.5, 0.75, 1]) {
            const restored = scaleValueInverse(x, SINH_SCALING, alpha);
            expect(Number.isFinite(restored)).toBe(true);
            expect(restored).toBeGreaterThanOrEqual(0);
            expect(restored).toBeLessThanOrEqual(1);
        }
    });
});

describe("power scaling", () => {
    test("alpha=1 uses the linear limit", () => {
        for (const x of TEST_SAMPLES) {
            expect(scaleValue(x, POWER_SCALING, 1)).toBeCloseTo(x, 12);
            expect(scaleValueInverse(x, POWER_SCALING, 1)).toBeCloseTo(x, 12);
        }
    });

    test("uses the linear limit within the alpha epsilon", () => {
        for (const alpha of [1 - POWER_ALPHA_EPSILON / 2, 1, 1 + POWER_ALPHA_EPSILON / 2]) {
            for (const x of TEST_SAMPLES) {
                expect(scaleValue(x, POWER_SCALING, alpha, 1.5, 0, 1, false)).toBeCloseTo(x, 12);
                expect(scaleValueInverse(x, POWER_SCALING, alpha, 1.5, 0, 1, false)).toBeCloseTo(x, 12);
            }
        }
    });
});

describe("scaling parameter configuration", () => {
    test("accepts only scaling functions supported by the frontend", () => {
        for (const scaling of SUPPORTED_SCALING_TYPES.keys()) {
            expect(isSupportedFrameScaling(scaling)).toBe(true);
        }
        for (const scaling of [FrameScaling.EXP, FrameScaling.CUSTOM, -1, 10, 1.5, "1", null]) {
            expect(isSupportedFrameScaling(scaling)).toBe(false);
        }
    });

    test.each([
        {scaling: FrameScaling.LOG, min: 0.1, max: 100_000, defaultValue: 1_000, preferenceKey: PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_LOG},
        {scaling: FrameScaling.GAMMA, min: 0.05, max: 10, defaultValue: 0.3, preferenceKey: PreferenceKeys.RENDER_CONFIG_SCALING_GAMMA},
        {scaling: FrameScaling.POWER, min: 0.0001, max: 10_000, defaultValue: 0.01, preferenceKey: PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_POWER},
        {scaling: FrameScaling.SINH, min: 0.05, max: 3, defaultValue: 1 / 3, preferenceKey: PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_SINH},
        {scaling: FrameScaling.ASINH, min: 0.000001, max: 3, defaultValue: 0.1, preferenceKey: PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_ASINH}
    ])("defines supported bounds for scaling $scaling", ({scaling, min, max, defaultValue, preferenceKey}) => {
        expect(getScalingParameterConfig(scaling)).toEqual({min, max, defaultValue, preferenceKey});
        expect(getScalingForParameterPreference(preferenceKey)).toBe(scaling);
    });

    test("clamps finite values and replaces non-finite values", () => {
        expect(sanitizeScalingParameter(FrameScaling.LOG, 1e-300)).toBe(0.1);
        expect(sanitizeScalingParameter(FrameScaling.LOG, 1e300)).toBe(100_000);
        expect(sanitizeScalingParameter(FrameScaling.SINH, Number.POSITIVE_INFINITY)).toBeCloseTo(1 / 3);
        expect(sanitizeScalingParameter(FrameScaling.ASINH, Number.NaN, 0.2)).toBe(0.2);
        expect(sanitizeScalingParameter(FrameScaling.GAMMA, 1e-300)).toBe(0.05);
        expect(sanitizeScalingParameter(FrameScaling.GAMMA, 1e300)).toBe(10);
        expect(sanitizeScalingParameter(FrameScaling.GAMMA, Number.POSITIVE_INFINITY)).toBe(0.3);
        expect(sanitizeScalingParameter(FrameScaling.GAMMA, Number.NaN, 1.5)).toBe(1.5);
    });

    test("normalizes Power alpha values within epsilon of the linear limit", () => {
        expect(sanitizeScalingParameter(FrameScaling.POWER, 1 - POWER_ALPHA_EPSILON / 2)).toBe(1);
        expect(sanitizeScalingParameter(FrameScaling.POWER, 1)).toBe(1);
        expect(sanitizeScalingParameter(FrameScaling.POWER, 1 + POWER_ALPHA_EPSILON / 2)).toBe(1);
        expect(sanitizeScalingParameter(FrameScaling.POWER, 1 + POWER_ALPHA_EPSILON * 2)).not.toBe(1);
    });

    test.each([
        {scaling: FrameScaling.LOG, alpha: 0.1},
        {scaling: FrameScaling.LOG, alpha: 100_000},
        {scaling: FrameScaling.SINH, alpha: 0.05},
        {scaling: FrameScaling.SINH, alpha: 3},
        {scaling: FrameScaling.ASINH, alpha: 0.000001},
        {scaling: FrameScaling.ASINH, alpha: 3}
    ])("keeps the shader-equivalent float32 transform accurate at the supported bound for scaling $scaling", ({scaling, alpha}) => {
        let previous = -Infinity;
        for (const x of TEST_SAMPLES) {
            const shaderValue = shaderScaleValue(x, scaling, alpha);
            const expected = scaleValue(x, scaling, alpha);
            expect(Number.isFinite(shaderValue)).toBe(true);
            expect(shaderValue).toBeGreaterThanOrEqual(previous);
            expect(shaderValue).toBeCloseTo(expected, 5);
            previous = shaderValue;
        }
    });

    test.each([0.05, 10])("keeps the shader-equivalent float32 Gamma transform accurate at gamma %s", gamma => {
        for (const x of TEST_SAMPLES) {
            expect(shaderScaleValue(x, FrameScaling.GAMMA, gamma)).toBeCloseTo(scaleValue(x, FrameScaling.GAMMA, 1, gamma), 6);
        }
    });

    test.each([0.0001, 1.1, 10, 10_000])("keeps the shader-equivalent float32 Power transform accurate at alpha %s", alpha => {
        for (const x of TEST_SAMPLES) {
            expect(shaderScaleValue(x, POWER_SCALING, alpha)).toBeCloseTo(scaleValue(x, POWER_SCALING, alpha), 5);
        }
    });
});

function shaderScaleValue(value: number, scaling: FrameScaling, alpha: number): number {
    const f32 = Math.fround;
    const add = (a: number, b: number) => f32(a + b);
    const subtract = (a: number, b: number) => f32(a - b);
    const multiply = (a: number, b: number) => f32(a * b);
    const divide = (a: number, b: number) => f32(a / b);
    const log = (x: number) => f32(Math.log(x));
    const exp = (x: number) => f32(Math.exp(x));
    const pow = (base: number, exponent: number) => f32(Math.pow(base, exponent));
    const sqrt = (x: number) => f32(Math.sqrt(x));
    const asinh = (x: number) => log(add(x, sqrt(add(multiply(x, x), 1))));
    const sinh = (x: number) => divide(subtract(exp(x), exp(-x)), 2);
    const shaderValue = f32(value);
    const shaderAlpha = f32(alpha);

    switch (scaling) {
        case FrameScaling.LOG:
            return divide(log(add(multiply(shaderAlpha, shaderValue), 1)), log(add(shaderAlpha, 1)));
        case FrameScaling.POWER:
            if (Math.abs(shaderAlpha - 1) < POWER_ALPHA_EPSILON) {
                return shaderValue;
            }
            return divide(subtract(pow(shaderAlpha, shaderValue), 1), subtract(shaderAlpha, 1));
        case FrameScaling.SINH:
            return divide(sinh(divide(shaderValue, shaderAlpha)), sinh(divide(1, shaderAlpha)));
        case FrameScaling.ASINH:
            return divide(asinh(divide(shaderValue, shaderAlpha)), asinh(divide(1, shaderAlpha)));
        case FrameScaling.GAMMA:
            return f32(Math.pow(shaderValue, shaderAlpha));
        default:
            return shaderValue;
    }
}
