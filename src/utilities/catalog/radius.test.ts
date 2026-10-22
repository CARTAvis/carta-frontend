import {RadiusUnits} from "enums";

import {convertRadius} from "./radius";

describe("convertRadius", () => {
    test.each([
        [1, RadiusUnits.DEGREES, RadiusUnits.ARCMINUTES, 60],
        [1, RadiusUnits.DEGREES, RadiusUnits.ARCSECONDS, 3600],
        [90, RadiusUnits.ARCMINUTES, RadiusUnits.DEGREES, 1.5],
        [90, RadiusUnits.ARCSECONDS, RadiusUnits.ARCMINUTES, 1.5],
        [2, RadiusUnits.ARCMINUTES, RadiusUnits.ARCSECONDS, 120],
        [5400, RadiusUnits.ARCSECONDS, RadiusUnits.DEGREES, 1.5]
    ])("converts %p %s to %s", (radius, from, to, expected) => {
        expect(convertRadius(radius, from, to)).toBe(expected);
    });

    test("keeps six significant figures", () => {
        expect(convertRadius(1, RadiusUnits.ARCMINUTES, RadiusUnits.DEGREES)).toBe(0.0166667);
        expect(convertRadius(1.23456789, RadiusUnits.DEGREES, RadiusUnits.DEGREES)).toBe(1.23457);
    });

    test("divides rather than multiplying by a rounded reciprocal on the way to a larger unit", () => {
        // 363.069 * (1/3600) rounds to 0.100852, one short of the quotient.
        expect(convertRadius(363.069, RadiusUnits.ARCSECONDS, RadiusUnits.DEGREES)).toBe(0.100853);
    });
});
