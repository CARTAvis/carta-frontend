import {type Point2D} from "models";

// Supports sorted array in incremental or decremental order
export function binarySearchByX(sortedArray: readonly Point2D[], x: number): {point: Point2D; index: number} | null {
    if (!sortedArray || sortedArray.length === 0 || x === null || x === undefined || !isFinite(x)) {
        return null;
    }

    const length = sortedArray.length;
    const first = sortedArray[0];
    const last = sortedArray[length - 1];
    if (!first || !last) {
        return null;
    }
    const incremental = first.x <= last.x;
    if (incremental) {
        if (x <= first.x) {
            return {point: first, index: 0};
        } else if (x >= last.x) {
            return {point: last, index: length - 1};
        }
    } else {
        if (x >= first.x) {
            return {point: first, index: 0};
        } else if (x <= last.x) {
            return {point: last, index: length - 1};
        }
    }

    // binary search for the nearest point by x
    let start = 0;
    let end = length - 1;
    while (start <= end) {
        const middle = Math.floor((start + end) / 2);
        const midPoint = sortedArray[middle];
        if (!midPoint) {
            return null;
        }
        if (x === midPoint.x) {
            return {point: midPoint, index: middle};
        }
        if (incremental) {
            if (x < midPoint.x) {
                end = middle - 1;
            } else {
                start = middle + 1;
            }
        } else {
            if (x > midPoint.x) {
                end = middle - 1;
            } else {
                start = middle + 1;
            }
        }
    }
    if (start >= sortedArray.length || start < 0 || end >= sortedArray.length || end < 0) {
        return null;
    }
    const startPoint = sortedArray[start];
    const endPoint = sortedArray[end];
    if (!startPoint || !endPoint) {
        return null;
    }
    const closer = Math.abs(startPoint.x - x) < Math.abs(x - endPoint.x) ? start : end;
    return {point: sortedArray[closer]!, index: closer};
}

export const distinct = (value: any, index: number, self: Array<any>) => {
    return self.indexOf(value) === index;
};
