import {pixelToFluxDensityUnit} from "./units";

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
