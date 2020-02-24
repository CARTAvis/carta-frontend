import {Point2D} from "../models";

// TODO: upgrade binary search to bi-directional for supporting both incremental & decremental data
export function binarySearchByX(array: readonly Point2D[], x: number): {point: Point2D, index: number} {
    if (array === undefined || array.length === 0 || x === undefined) {
        return null;
    }

    if (x < array[0].x) {
        return {point: array[0], index: 0};
    }

    if (x > array[array.length - 1].x) {
        return {point: array[array.length - 1], index: array.length - 1};
    }

    // binary search for the nearest point by x
    let start = 0;
    let end = array.length - 1;

    while (start <= end) {
        let middle = Math.floor((start + end) / 2);
        if (x < array[middle].x) {
            end = middle - 1;
        } else if (x > array[middle].x) {
            start = middle + 1;
        } else {
            return {point: array[middle], index: middle};
        }
    }

    const closer = ((array[start].x - x) < (x - array[end].x)) ? start : end;
    return {point: array[closer], index: closer};
}