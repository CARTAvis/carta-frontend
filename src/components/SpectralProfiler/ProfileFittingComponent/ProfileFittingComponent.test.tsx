import {buildProfileFittingLogContent} from "./ProfileFittingComponent";

describe("buildProfileFittingLogContent", () => {
    test("includes rest-frame and Jacobian metadata in the downloaded fitting log", () => {
        const content = buildProfileFittingLogContent(
            "# image: test.fits\n",
            ["x-axis spectral reference frame: rest", "redshift: 1", "y-axis spectral-density Jacobian: F_nu,rest = F_nu,observed / (1 + z)"],
            "Amplitude = 2 (Jy/beam (rest frame))"
        );

        expect(content).toBe("# image: test.fits\n# x-axis spectral reference frame: rest\n# redshift: 1\n# y-axis spectral-density Jacobian: F_nu,rest = F_nu,observed / (1 + z)\n\nAmplitude = 2 (Jy/beam (rest frame))");
    });
});
