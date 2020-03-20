import {Point2D} from "../models";

// Supports sorted array in incremental or decremental order 
export function binarySearchByX(sortedArray: readonly Point2D[], x: number): {point: Point2D, index: number} {
    if (!sortedArray || sortedArray.length === 0 || x === null || x === undefined) {
        return null;
    }
    const incremental = sortedArray[0] <= sortedArray[sortedArray.length-1];

    if (x < sortedArray[0].x) {
        return {point: sortedArray[0], index: 0};
    }
    if (x > sortedArray[sortedArray.length - 1].x) {
        return {point: sortedArray[sortedArray.length - 1], index: sortedArray.length - 1};
    }
    // binary search for the nearest point by x
    let start = 0;
    let end = sortedArray.length - 1;

    while (start <= end) {
        let middle = Math.floor((start + end) / 2);
        if (x < sortedArray[middle].x) {
            end = middle - 1;
        } else if (x > sortedArray[middle].x) {
            start = middle + 1;
        } else {
            return {point: sortedArray[middle], index: middle};
        }
    }

    const closer = ((sortedArray[start].x - x) < (x - sortedArray[end].x)) ? start : end;
    return {point: sortedArray[closer], index: closer};
}

export const distinct = (value: any, index: number, self: Array<any>) => {
    return self.indexOf(value) === index;
};