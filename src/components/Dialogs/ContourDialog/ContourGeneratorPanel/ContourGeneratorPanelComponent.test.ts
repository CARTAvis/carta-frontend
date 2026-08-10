import {FrameScaling} from "enums";

import {generateMinMaxLevels} from "./ContourGeneratorPanelComponent";

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
