import {getDiscreteSliderTicks} from "./slider";

describe("getDiscreteSliderTicks", () => {
    test("returns every index for a short slider", () => {
        expect(getDiscreteSliderTicks(5)).toEqual({values: [0, 1, 2, 3, 4], step: 1});
    });

    test("returns no values for an empty slider", () => {
        expect(getDiscreteSliderTicks(0)).toEqual({values: [], step: 1});
    });

    test("adds the last index when it is not close to the final regular tick", () => {
        expect(getDiscreteSliderTicks(11)).toEqual({values: [0, 2, 4, 6, 8, 10], step: 2});
    });

    test("replaces the final regular tick when the last index is nearby", () => {
        expect(getDiscreteSliderTicks(14)).toEqual({values: [0, 3, 6, 9, 13], step: 3});
    });

    test("includes and sorts a requested interior index", () => {
        expect(getDiscreteSliderTicks(12, 7)).toEqual({values: [0, 2, 4, 6, 7, 8, 11], step: 2});
    });
});
