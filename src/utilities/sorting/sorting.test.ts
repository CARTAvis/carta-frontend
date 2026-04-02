import {GetInitIndexMap} from "./sorting";

describe("GetInitIndexMap", () => {
    test("returns the correct indexes", () => {
        const rowNumber: number = 4;
        expect(GetInitIndexMap(rowNumber)).toEqual([0, 1, 2, 3]);
    });
});
