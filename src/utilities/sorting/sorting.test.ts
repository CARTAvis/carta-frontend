import {getInitIndexMap} from "./sorting";

describe("table functions", () => {
    test("initialize sorted index map", () => {
        const rowNumber: number = 4;
        expect(getInitIndexMap(rowNumber)).toEqual([0, 1, 2, 3]);
    });
});
