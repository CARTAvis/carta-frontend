import {getValueFromArcsecString, pixelToFluxDensityUnit, toFixed} from "./units";

jest.mock("models", () => ({}));

describe("toFixed", () => {
    it("rounds to the requested number of decimals", () => {
        expect(toFixed(0.284)).toBe("0");
        expect(toFixed(-0.5)).toBe("-1");
        expect(toFixed(-1.2345, 3)).toBe("-1.234");
        expect(toFixed(1.5, 1)).toBe("1.5");
    });

    it("does not display negative zero", () => {
        expect(toFixed(-0.284)).toBe("0");
        expect(toFixed(-0)).toBe("0");
        expect(toFixed(-0.0001, 3)).toBe("0.000");
        expect(toFixed(-0.284, 0)).toBe("0");
    });

    it("keeps the sign of values that do not round to zero", () => {
        expect(toFixed(-0.284, 3)).toBe("-0.284");
        expect(toFixed(-0.06, 1)).toBe("-0.1");
    });

    it("leaves non-finite values as is", () => {
        expect(toFixed(NaN)).toBe("NaN");
        expect(toFixed(Infinity)).toBe("Infinity");
        expect(toFixed(-Infinity)).toBe("-Infinity");
        expect(toFixed(1.234, -1)).toBe("1.234");
    });
});

describe("pixelToFluxDensityUnit", () => {
    it("removes specific substrings from the pixel unit string", () => {
        expect(pixelToFluxDensityUnit("Jy/beam")).toBe("Jy");
        expect(pixelToFluxDensityUnit("Jy/arcsec^2")).toBe("Jy");
        expect(pixelToFluxDensityUnit("Jy/arcsec2")).toBe("Jy");
        expect(pixelToFluxDensityUnit("MJy/sr")).toBe("MJy");
        expect(pixelToFluxDensityUnit("Jy/pixel")).toBe("Jy");
    });

    it("converts pixel unit K to K*arcsec^2", () => {
        expect(pixelToFluxDensityUnit("K")).toBe("K*arcsec^2");
    });

    it("converts pixel unit mK to mK*arcsec^2", () => {
        expect(pixelToFluxDensityUnit("mK")).toBe("mK*arcsec^2");
    });

    it("returns the original unit string for other units", () => {
        expect(pixelToFluxDensityUnit("Jy")).toBe("Jy");
    });
});

describe("getValueFromArcsecString", () => {
    it("parses arcsec values", () => {
        expect(getValueFromArcsecString("12")).toBe(12);
        expect(getValueFromArcsecString('12.5"')).toBe(12.5);
        expect(getValueFromArcsecString(' 12.5" ')).toBe(12.5);
    });

    it("converts arcmin values to arcsec", () => {
        expect(getValueFromArcsecString("2'")).toBe(120);
        expect(getValueFromArcsecString("2.5'")).toBe(150);
    });

    it("converts degree values to arcsec", () => {
        expect(getValueFromArcsecString("1 deg")).toBe(3600);
        expect(getValueFromArcsecString("1.5 degree")).toBe(5400);
        expect(getValueFromArcsecString("1.5 DEG")).toBe(5400);
    });

    it("returns null for empty or unsupported values", () => {
        expect(getValueFromArcsecString("")).toBeNull();
        expect(getValueFromArcsecString("abc")).toBeNull();
        expect(getValueFromArcsecString("1 arcsec")).toBeNull();
    });
});
