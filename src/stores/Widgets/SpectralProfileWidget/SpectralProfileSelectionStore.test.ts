import {describe, expect, test} from "@rstest/core";
import {CARTA} from "carta-protobuf";

// Load the stores in dependency order before importing one of them directly
import "stores";

import {getProfilesPlotName} from "./SpectralProfileSelectionStore";

describe("getProfilesPlotName", () => {
    test("names a single profile like its per-profile TSV export", () => {
        expect(getProfilesPlotName([{imageName: "HH211_IQU.fits", regionName: "Cursor", statsType: CARTA.StatsType.Sum, coordinate: "z"}])).toEqual({
            image: "HH211_IQU.fits",
            plot: "Z-profile-Cursor-Statistic_Sum-Coordinate_Current"
        });
    });

    test("uses the region name and replaces spaces with underscores", () => {
        expect(getProfilesPlotName([{imageName: "cube.fits", regionName: "my core", statsType: CARTA.StatsType.Mean, coordinate: "Iz"}]).plot).toBe("Z-profile-my_core-Statistic_Mean-Coordinate_Stokes_I");
    });

    test("lists each varying value once, separated by commas", () => {
        const profiles = [
            {imageName: "cube.fits", regionName: "Region 1", statsType: CARTA.StatsType.Mean, coordinate: "Qz"},
            {imageName: "cube.fits", regionName: "Region 1", statsType: CARTA.StatsType.Mean, coordinate: "Uz"}
        ];
        expect(getProfilesPlotName(profiles)).toEqual({image: "cube.fits", plot: "Z-profile-Region_1-Statistic_Mean-Coordinate_Stokes_Q,Stokes_U"});
    });

    test("has no stray characters", () => {
        expect(getProfilesPlotName([{imageName: "cube.fits", regionName: "Cursor", statsType: CARTA.StatsType.Sum, coordinate: "z"}]).plot).not.toMatch(/[{}]/);
    });
});
