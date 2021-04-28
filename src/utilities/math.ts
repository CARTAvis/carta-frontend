import {CARTA} from "carta-protobuf";
import {FrameScaling} from "stores";

export function smoothStepOffset(val: number, edge0: number, edge1: number, level0: number, level1: number) {
    const stepVal = smoothStep(val, edge0, edge1);
    return level0 + (level1 - level0) * stepVal;
}

// Based on AMD OpenCL reference implementation
export function smoothStep(val: number, edge0: number, edge1: number) {
    // Scale, bias and saturate val to 0..1 range
    val = clamp((val - edge0) / (edge1 - edge0), 0.0, 1.0);
    // Evaluate polynomial
    return val * val * (3 - 2 * val);
}

export function clamp(val: number, minVal: number, maxVal: number) {
    return Math.min(maxVal, Math.max(minVal, val));
}

export function closeTo(a: number, b: number, limit: number = 1.0e-6) {
    return Math.abs(a - b) < limit;
}

// sqrt(q^2 + u^2)
export function polarizedIntensity(q: number, u: number) {
    return Math.sqrt(Math.pow(q, 2) + Math.pow(u, 2));
}

// 0.5 * Math.atan2(U, Q) * 180 / Math.pi
export function polarizationAngle(q: number, u: number) {
    return 0.5 * Math.atan2(u, q) * 180 / Math.PI;
}

// normalising a by b
export function normalising(a: number, b: number) {
    return (a / b) * 100;
}

export function getPercentiles(histogram: CARTA.IHistogram, ranks: number[]): number[] {
    if (!ranks || !ranks.length || !histogram || !histogram.bins.length) {
        return [];
    }

    const minVal = histogram.firstBinCenter - histogram.binWidth / 2.0;
    const dx = histogram.binWidth;
    const vals = histogram.bins;
    let remainingRanks = ranks.slice();
    let cumulativeSum = 0;

    let totalSum = 0;
    for (let i = 0; i < vals.length; i++) {
        totalSum += vals[i];
    }

    if (totalSum === 0) {
        return [];
    }

    let calculatedPercentiles = [];

    for (let i = 0; i < vals.length && remainingRanks.length; i++) {
        const currentFraction = cumulativeSum / totalSum;
        const nextFraction = (cumulativeSum + vals[i]) / totalSum;
        let nextRank = remainingRanks[0] / 100.0;
        while (nextFraction >= nextRank && remainingRanks.length) {
            // Assumes a locally uniform distribution between bins
            const portion = (nextRank - currentFraction) / (nextFraction - currentFraction);
            calculatedPercentiles.push(minVal + dx * (i + portion));
            // Move to next rank
            remainingRanks.shift();
            nextRank = remainingRanks[0] / 100.0;
        }
        cumulativeSum += vals[i];
    }
    return calculatedPercentiles;
}

function errorFunction(x: number, c: number, x0: number) {
    const y = Math.exp(c * (x - x0));
    return y / (y + 1);
}

function errorFunctionInverse(x: number, c: number, x0: number) {
    return Math.log(x / (1 - x)) / c + x0;
}

function getSmoothedValue(bias: number, contrast: number) {
    const smoothedBias = bias / 2 + 0.5; // [-1, 1] map to [0, 1]
    let smoothedContrast = contrast < 1 ? 0 : contrast - 1; // [1, 2] map to [0, 1]

    smoothedContrast = smoothedContrast === 0 ? 0.001 : smoothedContrast * 12;
    const offset = errorFunction(0, smoothedContrast, smoothedBias);
    let denominator = errorFunction(1, smoothedContrast, smoothedBias) - offset;
    if (denominator <= 0) {
        denominator = 0.1;
    }
    return ({bias: smoothedBias, contrast: smoothedContrast, offset: offset, denominator: denominator})
}

export function scaleValue(x: number, scaling: FrameScaling, alpha: number = 1000, gamma: number = 1.5, bias: number = 0, contrast: number = 1, useSmoothedBiasContrast: boolean = true) {
    let scaleValue;
    switch (scaling) {
        case FrameScaling.SQUARE:
            scaleValue =  x * x;
            break;
        case FrameScaling.SQRT:
            scaleValue =  Math.sqrt(x);
            break;
        case FrameScaling.LOG:
            scaleValue = Math.log(alpha * x + 1.0) / Math.log(alpha + 1.0);
            break;
        case FrameScaling.POWER:
            scaleValue = (Math.pow(alpha, x) - 1.0) / (alpha - 1.0);
            break;
        case FrameScaling.GAMMA:
            scaleValue = Math.pow(x, gamma);
            break;
        default:
            scaleValue = x;
    }

    if (useSmoothedBiasContrast) {
        if (contrast <= 1) {
            const smoothedBias = 0.5 - bias / 2; // [-1, 1] map to [1, 0]
            scaleValue = clamp((scaleValue - smoothedBias) * contrast + smoothedBias, 0, 1);
        } else {
            const smoothedValue = getSmoothedValue(bias, contrast);
            scaleValue = (errorFunction(scaleValue, smoothedValue.contrast, smoothedValue.bias) - smoothedValue.offset) / smoothedValue.denominator;
        }
    } else {
        scaleValue = clamp(scaleValue - bias, 0, 1);
        scaleValue = clamp((scaleValue - 0.5) * contrast + 0.5, 0, 1);
    }
    return scaleValue;
}

export function scaleValueInverse(x: number, scaling: FrameScaling, alpha: number = 1000, gamma: number = 1.5, bias: number = 0, contrast: number = 1, useSmoothedBiasContrast: boolean = true) {
    let scaleValue;
    if (useSmoothedBiasContrast) {
        if (contrast <= 1) {
            const smoothedBias = 0.5 - bias / 2; // [-1, 1] map to [1, 0]
            if (x === 0 && smoothedBias === 0 && contrast === 0) {
                scaleValue = 1;
            } else {
                scaleValue = clamp((x - smoothedBias) / contrast + smoothedBias, 0, 1);
            }
        } else {
            const smoothedValue = getSmoothedValue(bias, contrast);
            scaleValue = clamp(errorFunctionInverse(x * smoothedValue.denominator + smoothedValue.offset, smoothedValue.contrast, smoothedValue.bias), 0, 1);
        }
    } else {
        scaleValue = (x - 0.5) / contrast + 0.5;
        scaleValue = clamp(scaleValue + bias, 0, 1);
    }

    switch (scaling) {
        case FrameScaling.SQUARE:
            return Math.sqrt(scaleValue);
        case FrameScaling.SQRT:
            return scaleValue * scaleValue;
        case FrameScaling.LOG:
            return (Math.pow(alpha + 1, scaleValue) - 1.0) / alpha;
        case FrameScaling.POWER:
            return alpha === 1 ? 0 : Math.log((alpha - 1.0) * scaleValue + 1.0) / Math.log(alpha);
        case FrameScaling.GAMMA:
            return Math.pow(scaleValue, 1.0 / gamma);
        default:
            return scaleValue;
    }
}

export function roundToPower(val: number, power: number) {
    return Math.pow(power, Math.round(Math.log(val) / Math.log(power)));
}

export function ceilToPower(val: number, power: number) {
    return Math.pow(power, Math.ceil(Math.log(val) / Math.log(power)));
}

export function floorToPower(val: number, power: number) {
    return Math.pow(power, Math.floor(Math.log(val) / Math.log(power)));
}

export function minMaxArray(data: Array<number>): {minVal: number, maxVal: number} {
    if (data && data.length) {
        let maxVal = -Number.MAX_VALUE;
        let minVal = Number.MAX_VALUE;

        for (let i = data.length - 1; i >= 0; i--) {
            const val = data[i];
            if (isNaN(val)) {
                continue;
            }
            if (val > maxVal) {
                maxVal = val;
            }
            if (val < minVal) {
                minVal = val;
            }
        }

        if (maxVal !== -Number.MAX_VALUE && minVal !== Number.MAX_VALUE) {
            return {maxVal, minVal};
        }
    }
    return {minVal: NaN, maxVal: NaN};
}