import {GetFluxDensityFromSum, ShouldUseSumForFluxDensity} from "./SpectralDefinition";

const PIXEL_SIZES_ARCSEC = {x: 2, y: 3};
const ARCSEC_TO_RAD = Math.PI / 648000;

const GetConfig = (nativeIntensityUnit: string) => ({
    nativeIntensityUnit,
    bmaj: [2],
    bmin: [3],
    cdelta1: PIXEL_SIZES_ARCSEC.x * ARCSEC_TO_RAD,
    cdelta2: PIXEL_SIZES_ARCSEC.y * ARCSEC_TO_RAD,
    freqGHz: [100]
});

describe("GetFluxDensityFromSum", () => {
    it.each([
        ["Jy/arcsec^2", 6],
        ["K", 6],
        ["MJy/sr", 6 * 2.350443e-11],
        ["Jy/pixel", 1],
        ["Jy/beam", (4 * Math.LN2) / Math.PI]
    ])("integrates %s values with the correct pixel factor", (unitTo, expected) => {
        const result = GetFluxDensityFromSum(new Float64Array([1]), GetConfig(unitTo), PIXEL_SIZES_ARCSEC, unitTo);
        expect(result[0] / expected).toBeCloseTo(1, 7);
    });

    it.each([
        ["Jy/pixel", 6],
        ["MJy/sr", 6e-6]
    ])("converts Jy/arcsec^2 sums to integrated %s values", (unitTo, expected) => {
        const result = GetFluxDensityFromSum(new Float64Array([1]), GetConfig("Jy/arcsec^2"), PIXEL_SIZES_ARCSEC, unitTo);
        expect(result[0] / expected).toBeCloseTo(1, 7);
    });

    it("converts K sums to integrated Jy/beam values", () => {
        const result = GetFluxDensityFromSum(new Float64Array([1]), GetConfig("K"), PIXEL_SIZES_ARCSEC, "Jy/beam");
        const expected = ((100 * 100 * 2 * 3) / 1.222e6) * ((4 * Math.LN2) / Math.PI);
        expect(result[0] / expected).toBeCloseTo(1, 7);
    });
});

describe("ShouldUseSumForFluxDensity", () => {
    it("uses backend flux density for equivalent unit types", () => {
        expect(ShouldUseSumForFluxDensity(GetConfig("Jy/beam"), "mJy/beam")).toBe(false);
    });

    it("uses sum values for different supported unit types", () => {
        expect(ShouldUseSumForFluxDensity(GetConfig("Jy/beam"), "K")).toBe(true);
    });

    it("does not derive flux density for unsupported units", () => {
        expect(ShouldUseSumForFluxDensity(GetConfig("Jy/beam"), "counts")).toBe(false);
    });
});
