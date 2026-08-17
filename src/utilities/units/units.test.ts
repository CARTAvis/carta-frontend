import {getValueFromArcsecString, pixelToFluxDensityUnit, redshiftFromRelativisticVelocity, relativisticVelocityFromRedshift} from "./units";

jest.mock("models", () => ({}));

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

describe("relativistic radial velocity and redshift conversion", () => {
    test.each([-300, 0, 300])("round trips %s km/s", velocityKms => {
        const redshift = redshiftFromRelativisticVelocity(velocityKms);

        expect(relativisticVelocityFromRedshift(redshift)).toBeCloseTo(velocityKms, 10);
    });

    test("rejects velocities at or beyond the speed of light", () => {
        expect(redshiftFromRelativisticVelocity(-299792.458)).toBeNaN();
        expect(redshiftFromRelativisticVelocity(299792.458)).toBeNaN();
    });

    test("rejects redshifts at or below -1", () => {
        expect(relativisticVelocityFromRedshift(-1)).toBeNaN();
        expect(relativisticVelocityFromRedshift(-2)).toBeNaN();
    });
});
