import {scaleValue, scaleValueInverse} from "./math";

jest.mock("stores/Frame", () => ({
    FrameScaling: {
        LOG: 1,
        SQRT: 2,
        SQUARE: 3,
        POWER: 4,
        GAMMA: 5,
        SINH: 8,
        ASINH: 9
    }
}));

const TEST_SAMPLES = Array.from({length: 101}, (_, index) => index / 100);
const SINH_SCALING = 8;
const ASINH_SCALING = 9;
const SCALING_TYPES = [SINH_SCALING, ASINH_SCALING];
const ANCHOR_SAMPLES = [
    {
        x: 0.25,
        sinh: 0.08208494694677107,
        asinh: 0.5494024872991484
    },
    {
        x: 0.5,
        sinh: 0.2125480174711402,
        asinh: 0.7712696419200371
    },
    {
        x: 0.75,
        sinh: 0.4682797838754033,
        asinh: 0.9046909953493529
    }
];

describe("sinh/asinh scaling", () => {
    test("scaleValue maps 0 and 1 to endpoints", () => {
        expect(scaleValue(0, SINH_SCALING as any)).toBeCloseTo(0, 12);
        expect(scaleValue(1, SINH_SCALING as any)).toBeCloseTo(1, 12);
        expect(scaleValue(0, ASINH_SCALING as any)).toBeCloseTo(0, 12);
        expect(scaleValue(1, ASINH_SCALING as any)).toBeCloseTo(1, 12);
    });

    test("scaleValue is monotonic", () => {
        let prevSinh = -Number.MAX_VALUE;
        let prevAsinh = -Number.MAX_VALUE;
        for (const x of TEST_SAMPLES) {
            const sinhVal = scaleValue(x, SINH_SCALING as any);
            const asinhVal = scaleValue(x, ASINH_SCALING as any);
            expect(sinhVal).toBeGreaterThanOrEqual(prevSinh);
            expect(asinhVal).toBeGreaterThanOrEqual(prevAsinh);
            prevSinh = sinhVal;
            prevAsinh = asinhVal;
        }
    });

    test("scaleValueInverse inverts scaleValue", () => {
        for (const x of TEST_SAMPLES) {
            const sinhScaled = scaleValue(x, SINH_SCALING as any);
            const asinhScaled = scaleValue(x, ASINH_SCALING as any);
            expect(scaleValueInverse(sinhScaled, SINH_SCALING as any)).toBeCloseTo(x, 6);
            expect(scaleValueInverse(asinhScaled, ASINH_SCALING as any)).toBeCloseTo(x, 6);
        }
    });

    test("scaleValue matches ds9 anchor values for sinh/asinh", () => {
        for (const sample of ANCHOR_SAMPLES) {
            expect(scaleValue(sample.x, SINH_SCALING as any)).toBeCloseTo(sample.sinh, 12);
            expect(scaleValue(sample.x, ASINH_SCALING as any)).toBeCloseTo(sample.asinh, 12);
        }
    });

    test("non-default bias/contrast changes sinh/asinh output in expected directions", () => {
        for (const scaling of SCALING_TYPES) {
            const baseMid = scaleValue(0.6, scaling as any);

            const withPositiveBias = scaleValue(0.6, scaling as any, 1000, 1.5, 0.2, 1, false);
            const withNegativeBias = scaleValue(0.6, scaling as any, 1000, 1.5, -0.2, 1, false);
            expect(withPositiveBias).toBeLessThan(baseMid);
            expect(withNegativeBias).toBeGreaterThan(baseMid);

            const baseNearMid = scaleValue(0.2, scaling as any, 1000, 1.5, 0, 1, false);
            const baseFarMid = scaleValue(0.9, scaling as any, 1000, 1.5, 0, 1, false);
            const highContrastNearMid = scaleValue(0.2, scaling as any, 1000, 1.5, 0, 1.5, false);
            const highContrastFarMid = scaleValue(0.9, scaling as any, 1000, 1.5, 0, 1.5, false);
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
                const scaled = scaleValue(x, scaling as any, 1000, 1.5, bias, contrast, true);
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
                    const scaled = scaleValue(x, scaling as any, 1000, 1.5, bias, contrast, true);
                    expect(Number.isFinite(scaled)).toBe(true);
                    expect(scaled).toBeGreaterThanOrEqual(-1.0e-12);
                    expect(scaled).toBeLessThanOrEqual(1 + 1.0e-12);
                }
            }
        }
    });

    test("out-of-range inputs clamp at boundaries when non-smoothed bias/contrast is used", () => {
        for (const scaling of SCALING_TYPES) {
            expect(scaleValue(-1, scaling as any, 1000, 1.5, 0, 1, false)).toBe(0);
            expect(scaleValue(-0.1, scaling as any, 1000, 1.5, 0, 1, false)).toBe(0);
            expect(scaleValue(1.1, scaling as any, 1000, 1.5, 0, 1, false)).toBe(1);
            expect(scaleValue(2, scaling as any, 1000, 1.5, 0, 1, false)).toBe(1);
        }
    });

    test("scaleValueInverse handles the smoothed contrast==0 edge case", () => {
        for (const scaling of SCALING_TYPES) {
            const restored = scaleValueInverse(0, scaling as any, 1000, 1.5, 1, 0, true);
            expect(Number.isFinite(restored)).toBe(true);
            expect(restored).toBeCloseTo(1, 12);
        }
    });

    test("scaleValueInverse clamps out-of-range inputs at boundaries", () => {
        for (const scaling of SCALING_TYPES) {
            expect(scaleValueInverse(-1, scaling as any, 1000, 1.5, 0, 1, false)).toBeCloseTo(0, 12);
            expect(scaleValueInverse(2, scaling as any, 1000, 1.5, 0, 1, false)).toBeCloseTo(1, 12);
            expect(scaleValueInverse(-1, scaling as any, 1000, 1.5, 0, 1, true)).toBeCloseTo(0, 12);
            expect(scaleValueInverse(2, scaling as any, 1000, 1.5, 0, 1, true)).toBeCloseTo(1, 12);
        }
    });
});
