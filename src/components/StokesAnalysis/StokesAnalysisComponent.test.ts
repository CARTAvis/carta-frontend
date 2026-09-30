import "stores";

import {getSmoothedStokesExportName, getStokesExportNames} from "./StokesAnalysisComponent";

describe("Stokes Analysis TSV export names", () => {
    test("names the profiles and the scatter without fractional polarization", () => {
        expect(getStokesExportNames(false)).toEqual({
            q: {plotName: "Q-profile", exportTitle: "Q profile"},
            u: {plotName: "U-profile", exportTitle: "U profile"},
            pi: {plotName: "PI-profile", exportTitle: "PI profile"},
            pa: {plotName: "PA-profile", exportTitle: "PA profile"},
            qu: {plotName: "QU-scatter", exportTitle: "Q vs U scatter"}
        });
    });

    test("marks fractional polarization in the file names and the titles, except the PA title", () => {
        expect(getStokesExportNames(true)).toEqual({
            q: {plotName: "fractional-Q-profile", exportTitle: "Q/I profile"},
            u: {plotName: "fractional-U-profile", exportTitle: "U/I profile"},
            pi: {plotName: "fractional-PI-profile", exportTitle: "PI/I profile"},
            pa: {plotName: "fractional-PA-profile", exportTitle: "PA profile"},
            qu: {plotName: "fractional-QU-scatter", exportTitle: "Q/I vs U/I scatter"}
        });
    });

    test("names the smoothed profiles after their profile", () => {
        expect(getSmoothedStokesExportName(getStokesExportNames(true).q)).toEqual({plotName: "fractional-Q-profile-smoothed", exportTitle: "Q/I profile (smoothed)"});
    });
});
