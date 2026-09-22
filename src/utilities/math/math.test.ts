import {minMaxArray} from "./math";

describe("minMaxArray", () => {
    test("ignores NaN and infinities while retaining finite values", () => {
        expect(minMaxArray([NaN, Infinity, -Infinity, 4, -2])).toEqual({minVal: -2, maxVal: 4});
    });

    test("returns NaN bounds when every value is non-finite", () => {
        expect(minMaxArray([NaN, Infinity, -Infinity])).toEqual({minVal: NaN, maxVal: NaN});
    });

    test("returns NaN bounds for empty input", () => {
        expect(minMaxArray([])).toEqual({minVal: NaN, maxVal: NaN});
    });

    test("handles a single finite value among invalid values", () => {
        expect(minMaxArray([Infinity, 7, NaN])).toEqual({minVal: 7, maxVal: 7});
    });
});
