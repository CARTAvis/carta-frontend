import {VelocityConvention} from "enums";

import {
    displayVelocityFromRedshift,
    isValidRedshift,
    isValidVelocity,
    observedFrequencyFactorFromRedshift,
    observedFrequencyFactorFromVelocity,
    redshiftFromRelativisticVelocity,
    redshiftFromVelocity,
    relativisticVelocityFromRedshift,
    restFrequencyFactorFromRedshift,
    SPEED_OF_LIGHT_KMS,
    velocityFromRedshift
} from "./cosmology";

describe("relativistic radial velocity and redshift conversion", () => {
    test.each([-300, 0, 300])("round trips %s km/s", velocityKms => {
        const redshift = redshiftFromRelativisticVelocity(velocityKms);

        expect(relativisticVelocityFromRedshift(redshift)).toBeCloseTo(velocityKms, 10);
    });

    test("rejects velocities at or beyond the speed of light", () => {
        expect(redshiftFromRelativisticVelocity(-SPEED_OF_LIGHT_KMS)).toBeNaN();
        expect(redshiftFromRelativisticVelocity(SPEED_OF_LIGHT_KMS)).toBeNaN();
    });

    test("rejects redshifts at or below -1", () => {
        expect(relativisticVelocityFromRedshift(-1)).toBeNaN();
        expect(relativisticVelocityFromRedshift(-2)).toBeNaN();
    });
});

describe("radial velocity convention conversions", () => {
    test.each([
        [VelocityConvention.RADIO, 300, 300 / (SPEED_OF_LIGHT_KMS - 300)],
        [VelocityConvention.OPTICAL, 300, 300 / SPEED_OF_LIGHT_KMS],
        [VelocityConvention.RELATIVISTIC, 300, redshiftFromRelativisticVelocity(300)]
    ])("round trips %s velocity", (convention, velocityKms, expectedRedshift) => {
        const redshift = redshiftFromVelocity(velocityKms, convention);

        expect(redshift).toBeCloseTo(expectedRedshift, 10);
        expect(velocityFromRedshift(redshift, convention)).toBeCloseTo(velocityKms, 10);
    });

    test("uses convention-specific boundaries", () => {
        expect(redshiftFromVelocity(SPEED_OF_LIGHT_KMS, VelocityConvention.RADIO)).toBeNaN();
        expect(redshiftFromVelocity(-SPEED_OF_LIGHT_KMS, VelocityConvention.RADIO)).toBeCloseTo(-0.5, 10);
        expect(redshiftFromVelocity(-2 * SPEED_OF_LIGHT_KMS, VelocityConvention.RADIO)).toBeCloseTo(-2 / 3, 10);
        expect(redshiftFromVelocity(-SPEED_OF_LIGHT_KMS, VelocityConvention.OPTICAL)).toBeNaN();
        expect(redshiftFromVelocity(SPEED_OF_LIGHT_KMS, VelocityConvention.OPTICAL)).toBe(1);
        expect(redshiftFromVelocity(SPEED_OF_LIGHT_KMS, VelocityConvention.RELATIVISTIC)).toBeNaN();
        expect(redshiftFromVelocity(-SPEED_OF_LIGHT_KMS, VelocityConvention.RELATIVISTIC)).toBeNaN();
    });
});

describe("frequency factors", () => {
    test("converts between rest and observed frequency factors", () => {
        expect(restFrequencyFactorFromRedshift(1)).toBe(2);
        expect(observedFrequencyFactorFromRedshift(1)).toBe(0.5);
        expect(observedFrequencyFactorFromVelocity(300, VelocityConvention.RADIO)).toBeCloseTo(1 - 300 / SPEED_OF_LIGHT_KMS, 12);
    });

    test("rejects invalid redshift values", () => {
        expect(restFrequencyFactorFromRedshift(-1)).toBeNaN();
        expect(observedFrequencyFactorFromRedshift(-1)).toBeNaN();
        expect(observedFrequencyFactorFromVelocity(SPEED_OF_LIGHT_KMS, VelocityConvention.RADIO)).toBeNaN();
    });
});

describe("velocity and redshift validity", () => {
    test.each([
        [VelocityConvention.RADIO, -Infinity, false],
        [VelocityConvention.RADIO, -SPEED_OF_LIGHT_KMS, true],
        [VelocityConvention.RADIO, SPEED_OF_LIGHT_KMS, false],
        [VelocityConvention.OPTICAL, -SPEED_OF_LIGHT_KMS, false],
        [VelocityConvention.OPTICAL, SPEED_OF_LIGHT_KMS, true],
        [VelocityConvention.RELATIVISTIC, -SPEED_OF_LIGHT_KMS, false],
        [VelocityConvention.RELATIVISTIC, SPEED_OF_LIGHT_KMS, false]
    ])("validates %s velocity %s as %s", (convention, velocityKms, isExpected) => {
        expect(isValidVelocity(velocityKms, convention)).toBe(isExpected);
    });

    test.each([
        [-1, false],
        [-0.5, true],
        [0, true],
        [Infinity, false]
    ])("validates redshift %s as %s", (redshift, isExpected) => {
        expect(isValidRedshift(redshift)).toBe(isExpected);
    });
});

describe("the radial velocity shown for a typed velocity", () => {
    // Velocities as a user types them: every magnitude from 1e-6 to 1e5 km/s, both signs, with 0 to 6 decimals.
    const typedVelocities = [0, -500, 299792.457, -299792.457];
    for (let magnitude = -6; magnitude <= 5; magnitude++) {
        for (let digits = 1; digits <= 999; digits += 37) {
            for (let decimals = 0; decimals <= 6; decimals++) {
                const velocityKms = Number((digits * 10 ** magnitude).toFixed(decimals));
                if (velocityKms !== 0 && Math.abs(velocityKms) < SPEED_OF_LIGHT_KMS) {
                    typedVelocities.push(velocityKms, -velocityKms);
                }
            }
        }
    }

    test.each([VelocityConvention.RADIO, VelocityConvention.OPTICAL, VelocityConvention.RELATIVISTIC])("is the typed velocity in the %s convention", convention => {
        const wrong = typedVelocities.filter(velocityKms => displayVelocityFromRedshift(redshiftFromVelocity(velocityKms, convention), convention) !== velocityKms);
        expect(wrong).toEqual([]);
    });

    test("keeps the precision of small relativistic velocities, which the square root form loses", () => {
        const redshift = redshiftFromRelativisticVelocity(0.00001);
        expect(relativisticVelocityFromRedshift(redshift) / 0.00001).toBeCloseTo(1, 12);
        const beta = 0.00001 / SPEED_OF_LIGHT_KMS;
        expect(redshift).toBeCloseTo(beta + beta ** 2 / 2, 20);
    });

    test("gives the same relativistic redshift as the square root form, to 1e-14", () => {
        for (let velocityKms = -299000; velocityKms <= 299000; velocityKms += 997) {
            const beta = velocityKms / SPEED_OF_LIGHT_KMS;
            expect(Math.abs(redshiftFromRelativisticVelocity(velocityKms) - (Math.sqrt((1 + beta) / (1 - beta)) - 1))).toBeLessThan(1e-14);
        }
    });

    test("is NaN for a redshift that has no velocity", () => {
        expect(displayVelocityFromRedshift(-2, VelocityConvention.RELATIVISTIC)).toBeNaN();
    });
});
