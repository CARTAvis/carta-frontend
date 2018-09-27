export function smoothStepOffset(x: number, edge0: number, edge1: number, level0: number, level1: number) {
    const stepVal = smoothStep(x, edge0, edge1);
    return level0 + (level1 - level0) * stepVal;
}

export function smoothStep(x: number, edge0: number, edge1: number) {
    // Scale, bias and saturate x to 0..1 range
    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    // Evaluate polynomial
    return x * x * (3 - 2 * x);
}

export function clamp(val: number, minVal: number, maxVal: number) {
    return Math.min(maxVal, Math.max(minVal, val));
}