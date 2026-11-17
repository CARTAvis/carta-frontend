jest.mock("stores", () => ({
    PreferenceStore: {Instance: {contourNumLevels: 5, scalingAlphaLog: 1000, scalingAlphaPower: 1, scalingAlphaSinh: 3, scalingAlphaAsinh: 0.1, scalingGamma: 1}}
}));

import {ContourGeneratorType, FrameScaling} from "enums";

import {ContourGeneratorPanelComponent, generateMinMaxLevels} from "./ContourGeneratorPanelComponent";

describe("generateMinMaxLevels", () => {
    test.each([
        {scaling: FrameScaling.LINEAR, alpha: 1, expected: [0, 0.25, 0.5, 0.75, 1]},
        {scaling: FrameScaling.SINH, alpha: 1 / 3, expected: [0, 0.0820849469, 0.2125480175, 0.4682797839, 1]},
        {scaling: FrameScaling.ASINH, alpha: 0.1, expected: [0, 0.5494024873, 0.7712696419, 0.9046909953, 1]}
    ])("generates distinct levels for scaling $scaling", ({scaling, alpha, expected}) => {
        const levels = generateMinMaxLevels(0, 1, 5, scaling, alpha, 1);
        levels.forEach((level, index) => expect(level).toBeCloseTo(expected[index], 9));
    });

    test("uses the selected alpha", () => {
        const weakSinh = generateMinMaxLevels(0, 1, 5, FrameScaling.SINH, 3, 1);
        const strongSinh = generateMinMaxLevels(0, 1, 5, FrameScaling.SINH, 0.1, 1);

        expect(weakSinh).not.toEqual(strongSinh);
    });

    test("uses the selected gamma", () => {
        expect(generateMinMaxLevels(0, 1, 3, FrameScaling.GAMMA, 1, 2)).toEqual([0, 0.25, 1]);
    });
});

describe("ContourGeneratorPanelComponent settings", () => {
    const createPanel = () => new ContourGeneratorPanelComponent({frame: {} as any, generatorType: ContourGeneratorType.StartStepMultiplier, onLevelsGenerated: jest.fn()});

    test("gives nothing when no value changed", () => {
        expect(createPanel().toSettings()).toBeUndefined();
    });

    test("gives only the values that changed", () => {
        const panel = createPanel();
        panel.applySettings({generator: ContourGeneratorType.MinMaxNScaling, numLevels: 8, minValue: 0.5, scaling: FrameScaling.LOG, scalingAlphas: {[FrameScaling.LOG]: 500}});

        expect(panel.toSettings()).toEqual({
            generator: ContourGeneratorType.MinMaxNScaling,
            numLevels: 8,
            minValue: 0.5,
            scaling: FrameScaling.LOG,
            scalingAlphas: {[FrameScaling.LOG]: 500, [FrameScaling.POWER]: 1, [FrameScaling.SINH]: 3, [FrameScaling.ASINH]: 0.1}
        });
    });

    test("leaves a value that is not valid as it is", () => {
        const panel = createPanel();
        panel.applySettings({generator: "unknown", numLevels: NaN, scaling: "LOG" as any, sigmaLevels: [1, "2" as any]});

        expect(panel.toSettings()).toBeUndefined();
    });
});
