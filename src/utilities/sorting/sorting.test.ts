import {initSortedIndexMapFunc} from "./sorting";

describe("table functions", () => {
    test("initialize sorted index map", () => {
        const rowNumber: number = 4;
        const list: number[] = [];
        for (let i = 0; i < rowNumber; i++) {
            list.push(i);
        }
        expect(initSortedIndexMapFunc(rowNumber)).toEqual(list);
    });
});
