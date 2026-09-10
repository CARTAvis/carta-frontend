import {IntensityUnitType} from "../../enums";

import {FindIntensityUnitType, GetSpectralTypeCode, IsFrequencyDensityUnit} from "./SpectralDefinition";

describe("spectral type codes", () => {
    test.each([
        ["WAVE-LOG", "WAVE"],
        [" wave-log ", "WAVE"],
        ["FREQ-F2W", "FREQ"],
        ["AWAV-GRA", "AWAV"],
        ["FREQ", "FREQ"],
        ["VELO-LSR", "VELO-LSR"],
        ["WAVE-TAB", "WAVE-TAB"],
        ["RA---TAN", "RA---TAN"]
    ])("resolves the coordinate type code of CTYPE %j as %s", (ctype, code) => {
        expect(GetSpectralTypeCode(ctype)).toBe(code);
    });

    test("returns an empty code for a missing CTYPE", () => {
        expect(GetSpectralTypeCode(undefined)).toBe("");
    });
});

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
