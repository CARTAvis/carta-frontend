import {getInitIndexMap} from "./sorting";

describe("getInitIndexMap", () => {
    test("returns the correct indexes", () => {
        const rowNumber: number = 4;
        expect(getInitIndexMap(rowNumber)).toEqual([0, 1, 2, 3]);
    });
});
