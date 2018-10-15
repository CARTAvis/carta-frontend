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