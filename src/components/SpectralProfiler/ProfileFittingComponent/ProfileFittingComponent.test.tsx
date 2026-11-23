import {CARTA} from "carta-protobuf";

import {RegionId} from "enums";

import {buildProfileFittingLogContent, buildProfileFittingStatisticHeader} from "./ProfileFittingComponent";

describe("buildProfileFittingLogContent", () => {
    test("includes rest-frame and Jacobian metadata in the downloaded fitting log", () => {
        const content = buildProfileFittingLogContent(
            "# image: test.fits\n",
            ["x-axis spectral coordinate: rest frame", "y-axis flux-density transformation: F_nu,rest = F_nu,observed / (1 + z)", "redshift (z): 1"],
            "Amplitude = 2 (Jy/beam (rest frame))"
        );

        expect(content).toBe("# image: test.fits\n# x-axis spectral coordinate: rest frame\n# y-axis flux-density transformation: F_nu,rest = F_nu,observed / (1 + z)\n# redshift (z): 1\n\nAmplitude = 2 (Jy/beam (rest frame))");
    });
});

describe("buildProfileFittingStatisticHeader", () => {
    test("names the statistic of a region profile", () => {
        expect(buildProfileFittingStatisticHeader(1, CARTA.StatsType.Mean)).toBe("# statistic: Mean\n");
        expect(buildProfileFittingStatisticHeader(RegionId.IMAGE, CARTA.StatsType.FluxDensity)).toBe("# statistic: FluxDensity\n");
        expect(buildProfileFittingStatisticHeader(2, CARTA.StatsType.Sigma)).toBe("# statistic: StdDev\n");
    });

    test("omits the statistic for the cursor profile or when none is selected", () => {
        expect(buildProfileFittingStatisticHeader(RegionId.CURSOR, CARTA.StatsType.Mean)).toBe("");
        expect(buildProfileFittingStatisticHeader(1, undefined)).toBe("");
    });
});
