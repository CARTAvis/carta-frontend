import {FrameScaling} from "enums";

import {scaleValue, scaleValueInverse} from "./math";

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
});
