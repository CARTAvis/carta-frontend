import {Point2D} from "../models";

export function binarySearchByX(array: Array<Point2D>, x: number): Point2D {
    if (array === undefined || array.length === 0 || x === undefined) {
        return null;
    }

    if (x < array[0].x) {
        return array[0];
    }

    if (x > array[array.length - 1].x) {
        return array[array.length - 1];
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
            return array[middle];
        }
    }
    return ((array[start].x - x) < (x - array[end].x)) ? array[start] : array[end];
}