import {isUniformlySpaced} from "./math";

describe("isUniformlySpaced", () => {
    test.each([
        ["uniform increasing", [1, 2, 3, 4], true],
        ["uniform decreasing", [8, 6, 4, 2], true],
        ["two values", [1, 5], true],
        ["one value", [1], true],
        ["empty", [], true],
        ["constant", [3, 3, 3], true],
        ["logarithmic", [1, 2, 4, 8], false],
        ["one irregular step", [1, 2, 3, 5], false],
        ["NaN value", [1, NaN, 3], false]
    ])("%s", (_, values, isUniform) => {
        expect(isUniformlySpaced(values)).toBe(isUniform);
    });

    test("tolerates floating point noise relative to the step", () => {
        const values = Array.from({length: 100}, (_, i) => 3.44e11 + i * 3.9e6);
        expect(isUniformlySpaced(values)).toBe(true);
        const fineValues = Array.from({length: 100}, (_, i) => 3.44e11 + i);
        expect(isUniformlySpaced(fineValues)).toBe(true);
        expect(isUniformlySpaced([0, 1, 2.000001, 3], 1e-5)).toBe(true);
        expect(isUniformlySpaced([0, 1, 2.000001, 3], 1e-8)).toBe(false);
    });
});
