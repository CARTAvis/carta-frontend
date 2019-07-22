import {func} from "prop-types";

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
export function pi(q: number, u: number) {
    return Math.sqrt(Math.pow(q, 2) + Math.pow(u, 2));
}

// 0.5 * arctan(u/q)
export function pa(q: number, u: number) {
    return 0.5 * (Math.atan(u / q));
}

// normalising a by b
export function normalising(a: number, b: number) {
    return (a / b) * 100;
}

export function getMinY(data: Array<{x: number, y: number}>): number {
    return data.reduce((min, p) => p.y < min ? p.y : min, data[0].y);
}

export function getMaxY(data: Array<{x: number, y: number}>): number {
    return data.reduce((max, p) => p.y > max ? p.y : max, data[0].y);
}