import {type Point2D} from "models";

import {BinarySearchByX} from "./array";

test("test BinarySearchByX with sorted array in incremental/decremental order", () => {
    const incremental: Point2D[] = [
        {x: -1, y: 0},
        {x: 134, y: 0},
        {x: 232, y: 0},
        {x: 234, y: 0},
        {x: 587, y: 0},
        {x: 623, y: 0},
        {x: 793, y: 0},
        {x: 882, y: 0},
        {x: 963, y: 0},
        {x: 1074, y: 0}
    ];
    const decremental: Point2D[] = [
        {x: 20, y: 0},
        {x: 17, y: 0},
        {x: 9, y: 0},
        {x: 7, y: 0},
        {x: 6.5, y: 0},
        {x: 4, y: 0},
        {x: 3, y: 0},
        {x: 2, y: 0},
        {x: 1, y: 0},
        {x: -15, y: 0}
    ];

    const empty: Point2D[] = [
        {x: NaN, y: NaN},
        {x: NaN, y: NaN},
        {x: NaN, y: NaN},
        {x: NaN, y: NaN}
    ];

    expect(BinarySearchByX([], 10)).toEqual(null);
    expect(BinarySearchByX(incremental, NaN)).toEqual(null);

    expect(BinarySearchByX(incremental, -99)).toEqual({point: {x: -1, y: 0}, index: 0});
    expect(BinarySearchByX(incremental, 0)).toEqual({point: {x: -1, y: 0}, index: 0});
    expect(BinarySearchByX(incremental, 453)).toEqual({point: {x: 587, y: 0}, index: 4});
    expect(BinarySearchByX(incremental, 2048)).toEqual({point: {x: 1074, y: 0}, index: 9});

    expect(BinarySearchByX(decremental, 999)).toEqual({point: {x: 20, y: 0}, index: 0});
    expect(BinarySearchByX(decremental, 5)).toEqual({point: {x: 4, y: 0}, index: 5});
    expect(BinarySearchByX(decremental, 0)).toEqual({point: {x: 1, y: 0}, index: 8});
    expect(BinarySearchByX(decremental, -33)).toEqual({point: {x: -15, y: 0}, index: 9});

    expect(BinarySearchByX(empty, 999)).toEqual(null);
    expect(BinarySearchByX(empty, -33)).toEqual(null);
    expect(BinarySearchByX(empty, 5)).toEqual(null);
    expect(BinarySearchByX(empty, 0)).toEqual(null);
});
