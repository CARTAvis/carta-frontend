import {IntensityUnitType} from "../../enums";

import {FindIntensityUnitType, IsFrequencyDensityUnit} from "./SpectralDefinition";

describe("spectral intensity units", () => {
    test.each(["Jy", "JY", "jy", "mJy", "MJY", "uJY"])("recognizes bare Jansky unit %s regardless of case", unit => {
        expect(IsFrequencyDensityUnit(unit)).toBe(true);
    });

    test("trims bare Jansky units before classifying them", () => {
        expect(IsFrequencyDensityUnit(" JY ")).toBe(true);
    });

    test("does not classify unrelated units as frequency density", () => {
        expect(FindIntensityUnitType("erg")).toBe(IntensityUnitType.Unsupported);
        expect(IsFrequencyDensityUnit("erg")).toBe(false);
    });
});
