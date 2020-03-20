import {Point2D} from "../models";
import {binarySearchByX} from "../utilities";

const incremental: Point2D[] = [{x: -1, y: 0}, {x: 134, y: 0}, {x: 232, y: 0}, {x: 234, y: 0}, {x: 587, y: 0}, {x: 623, y: 0}, {x: 793, y: 0}, {x: 963, y: 0}, {x: 1074, y: 0}];
const decremental: Point2D[] = [{x: 20, y: 0}, {x: 17, y: 0}, {x: 9, y: 0}, {x: 7, y: 0}, {x: 6, y: 0}, {x: 4, y: 0}, {x: 3, y: 0}, {x: 2, y: 0}, {x: 1, y: 0}, {x: -15, y: 0}];

test("test binarySearchByX with sorted array in incremental/decremental order", () => {
    expect(binarySearchByX(null, null)).toEqual(null);
    expect(binarySearchByX(null, 10)).toEqual(null);
    expect(binarySearchByX(incremental, null)).toEqual(null);
    expect(binarySearchByX([], 10)).toEqual(null);

    expect(binarySearchByX(incremental, -99)).toEqual({point: {x: -1, y: 0}, index: 0});
    expect(binarySearchByX(incremental, 0)).toEqual({point: {x: -1, y: 0}, index: 0});
    expect(binarySearchByX(incremental, 453)).toEqual({point: {x: -1, y: 0}, index: 0});
    expect(binarySearchByX(incremental, 2048)).toEqual({point: {x: -1, y: 0}, index: 0});

    expect(binarySearchByX(decremental, 999)).toEqual({point: {x: -1, y: 0}, index: 0});
    expect(binarySearchByX(decremental, 5)).toEqual({point: {x: -1, y: 0}, index: 0});
    expect(binarySearchByX(decremental, 0)).toEqual({point: {x: -1, y: 0}, index: 0});
    expect(binarySearchByX(decremental, -33)).toEqual({point: {x: -1, y: 0}, index: 0});
});
