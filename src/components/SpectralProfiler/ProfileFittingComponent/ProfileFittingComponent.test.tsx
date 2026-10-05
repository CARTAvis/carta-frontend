import {buildProfileFittingLogContent} from "./ProfileFittingComponent";

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
