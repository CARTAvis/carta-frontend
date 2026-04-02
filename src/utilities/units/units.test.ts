import {PixelToFluxDensityUnit} from "./units";

jest.mock("models", () => ({}));

describe("PixelToFluxDensityUnit", () => {
    it("removes specific substrings from the pixel unit string", () => {
        expect(PixelToFluxDensityUnit("Jy/beam")).toBe("Jy");
        expect(PixelToFluxDensityUnit("Jy/arcsec^2")).toBe("Jy");
        expect(PixelToFluxDensityUnit("Jy/arcsec2")).toBe("Jy");
        expect(PixelToFluxDensityUnit("MJy/sr")).toBe("MJy");
        expect(PixelToFluxDensityUnit("Jy/pixel")).toBe("Jy");
    });

    it("converts pixel unit K to K*arcsec^2", () => {
        expect(PixelToFluxDensityUnit("K")).toBe("K*arcsec^2");
    });

    it("returns the original unit string for other units", () => {
        expect(PixelToFluxDensityUnit("Jy")).toBe("Jy");
    });
});
