import {pixelToFluxDensityUnit} from "./units";

jest.mock("models", () => ({}));

describe("pixelToFluxDensityUnit", () => {
    it("removes '/beam' from the pixel unit string", () => {
        expect(pixelToFluxDensityUnit("Jy/beam")).toBe("Jy");
    });

    it("returns the original string if '/beam' is not present", () => {
        expect(pixelToFluxDensityUnit("Jy")).toBe("Jy");
    });
});
