import {buildProfileFittingLogContent} from "./ProfileFittingComponent";

describe("buildProfileFittingLogContent", () => {
    test("includes rest-frame and Jacobian metadata in the downloaded fitting log", () => {
        const content = buildProfileFittingLogContent(
            "# image: test.fits\n",
            ["spectral reference frame: rest", "redshift: 1", "spectral-density Jacobian: F_nu,rest = F_nu,observed / (1 + z)"],
            "Amplitude = 2 (Jy/beam, rest-frame density)"
        );

        expect(content).toBe("# image: test.fits\n# spectral reference frame: rest\n# redshift: 1\n# spectral-density Jacobian: F_nu,rest = F_nu,observed / (1 + z)\n\nAmplitude = 2 (Jy/beam, rest-frame density)");
    });
});
