import {GetFluxDensityFromSum} from "./SpectralDefinition";

describe("GetFluxDensityFromSum", () => {
    it("scales sum values by the pixel area", () => {
        expect(GetFluxDensityFromSum(new Float64Array([1, 2]), {x: 2, y: 3}, "Jy/arcsec^2")).toEqual(new Float64Array([6, 12]));
    });

    it("converts steradians to square arcseconds", () => {
        expect(GetFluxDensityFromSum(new Float64Array([1, 2]), {x: 2, y: 3}, "MJy/sr")).toEqual(new Float64Array([6 * 2.350443e-11, 12 * 2.350443e-11]));
    });
});
