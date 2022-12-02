import {Point2D} from "../../models";

// Supports sorted array in incremental or decremental order
export function binarySearchByX(sortedArray: readonly Point2D[], x: number): {point: Point2D; index: number} {
    if (!sortedArray || sortedArray.length === 0 || x === null || x === undefined || !isFinite(x)) {
        return null;
    }

    const length = sortedArray.length;
    const incremental = sortedArray[0].x <= sortedArray[length - 1].x;
    if (incremental) {
        if (x <= sortedArray[0].x) {
            return {point: sortedArray[0], index: 0};
        } else if (x >= sortedArray[length - 1].x) {
            return {point: sortedArray[length - 1], index: length - 1};
        }
    } else {
        if (x >= sortedArray[0].x) {
            return {point: sortedArray[0], index: 0};
        } else if (x <= sortedArray[length - 1].x) {
            return {point: sortedArray[length - 1], index: length - 1};
        }
    }

    // binary search for the nearest point by x
    let start = 0;
    let end = length - 1;
    while (start <= end) {
        let middle = Math.floor((start + end) / 2);
        if (x === sortedArray[middle].x) {
            return {point: sortedArray[middle], index: middle};
        }
        if (incremental) {
            if (x < sortedArray[middle].x) {
                end = middle - 1;
            } else {
                start = middle + 1;
            }
        } else {
            if (x > sortedArray[middle].x) {
                end = middle - 1;
            } else {
                start = middle + 1;
            }
        }
    }
    if (start >= sortedArray.length || start < 0 || end >= sortedArray.length || end < 0) {
        return null;
    }
    const closer = Math.abs(sortedArray[start].x - x) < Math.abs(x - sortedArray[end].x) ? start : end;
    return {point: sortedArray[closer], index: closer};
}

export const distinct = (value: any, index: number, self: Array<any>) => {
    return self.indexOf(value) === index;
};
