import {WCSMatching} from "./WCSMatchingType";

describe("Expected behavior of WCSMatching", () => {
    test("WCSMatchingType and WCSMatching", () => {
        for (let i = 0; i < WCSMatching.MATCHING_NUMBER; i++) {
            expect(WCSMatching.MATCHING_TYPES[i]).toBe(2 ** i);
        }

        expect(WCSMatching.isTypeValid(2 ** WCSMatching.MATCHING_NUMBER + 1)).toBe(false);

        expect(WCSMatching.capitalizeFirstLetter("TESTINPUT")).toBe("Testinput");
    });
});
