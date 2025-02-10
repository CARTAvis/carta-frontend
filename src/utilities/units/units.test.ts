import {pixelToFluxDensityUnit} from "./units";

jest.mock("models", () => ({}));

describe("pixelToFluxDensityUnit", () => {
    it("removes specific substrings from the pixel unit string", () => {
        expect(pixelToFluxDensityUnit("Jy/beam")).toBe("Jy");
        expect(pixelToFluxDensityUnit("Jy/arcsec^2")).toBe("Jy");
    });

    it("returns the original string if '/beam' is not present", () => {
        expect(pixelToFluxDensityUnit("Jy")).toBe("Jy");
    });
});
