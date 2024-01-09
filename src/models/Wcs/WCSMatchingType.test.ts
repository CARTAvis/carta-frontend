import {WCSMatching} from "./WCSMatchingType";

describe("WCSMatching", () => {
    test("WCSMatchingType enum elements are power of 2", () => {
        for (let i = 0; i < WCSMatching.MATCHING_NUMBER; i++) {
            expect(WCSMatching.MATCHING_TYPES[i]).toBe(2 ** i);
        }
    });

    test("the WCSMatching validation", () => {
        expect(WCSMatching.isTypeValid(2 ** WCSMatching.MATCHING_NUMBER + 1)).toBe(false);
    });

    test("String converts to lower case except the first letter", () => {
        expect(WCSMatching.getNameFromType(1)).toBe("Spatial");
        expect(WCSMatching.getNameFromType(2)).toBe("Spectral");
        expect(WCSMatching.getNameFromType(4)).toBe("Raster");
    });
});
