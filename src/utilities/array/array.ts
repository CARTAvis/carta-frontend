import {type Point2D} from "models";

import {type TypedArray} from "../Processed/Processed";

export function computeHistogramBins(data: ArrayLike<number> | TypedArray, numBins: number): {bins: Point2D[]; binSize: number; start: number; binIndices: number[][]} {
    if (!data?.length || numBins <= 0) {
        return {bins: [], binSize: 0, start: 0, binIndices: []};
    }

    let minVal = Number.MAX_VALUE;
    let maxVal = -Number.MAX_VALUE;
    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (!isNaN(val)) {
            if (val < minVal) {
                minVal = val;
            }
            if (val > maxVal) {
                maxVal = val;
            }
        }
    }

    if (!isFinite(minVal) || !isFinite(maxVal)) {
        return {bins: [], binSize: 0, start: 0, binIndices: []};
    }

    const fraction = 1.001;
    const start = minVal;
    const end = start + (maxVal - minVal) * fraction;
    const binSize = (end - start) / numBins;

    if (binSize <= 0) {
        return {bins: [{x: minVal, y: data.length}], binSize: 0, start: minVal, binIndices: [Array.from({length: data.length}, (_, i) => i)]};
    }

    const counts = new Array<number>(numBins).fill(0);
    const binIndices: number[][] = Array.from({length: numBins}, () => []);
    for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (isNaN(val)) {
            continue;
        }
        let binIndex = Math.floor((val - start) / binSize);
        if (binIndex < 0) {
            continue;
        }
        if (binIndex >= numBins) {
            binIndex = numBins - 1;
        }
        counts[binIndex]++;
        binIndices[binIndex].push(i);
    }

    const bins: Point2D[] = new Array(numBins);
    for (let i = 0; i < numBins; i++) {
        bins[i] = {x: start + (i + 0.5) * binSize, y: counts[i]};
    }
    return {bins, binSize, start, binIndices};
}

// Supports sorted array in incremental or decremental order
export function binarySearchByX(sortedArray: readonly Point2D[], x: number): {point: Point2D; index: number} | null {
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
        const middle = Math.floor((start + end) / 2);
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
