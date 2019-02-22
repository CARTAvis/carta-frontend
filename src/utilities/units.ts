import {Point2D} from "models";

export function velocityFromFrequency(freq: number, refFreq: number): number {
    const c = 299792458;
    return c * (1.0 - freq / refFreq);
}

export function velocityStringFromFrequency(freq: number, refFreq: number): string {
    if (isFinite(refFreq)) {
        const velocityVal = velocityFromFrequency(freq, refFreq);
        return `Velocity:\u00a0${(velocityVal * 1e-3).toFixed(4)}\u00a0km/s`;
    }
    return null;
}

export function frequencyFromVelocity(velocity: number, refFreq: number): number {
    const c = 299792458;
    return refFreq * (1.0 - velocity / c);
}

export function frequencyStringFromVelocity(velocity: number, refFreq: number): string {
    if (isFinite(refFreq)) {
        const frequencyVal = frequencyFromVelocity(velocity, refFreq);
        return `Frequency:\u00a0${(frequencyVal * 1e-9).toFixed(4)}\u00a0GHz`;
    }
    return null;
}

export function formattedNotation(value: number): string {
    if (value === undefined) {
        return null;
    }
    return value < 1e-2 ? value.toExponential(2) : value.toFixed(2);
}

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