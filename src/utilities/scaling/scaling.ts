import {FrameScaling} from "enums";

import {clamp} from "../math/math";

export interface ScalingParameterConfig {
    readonly min: number;
    readonly max: number;
    readonly defaultValue: number;
}

const SCALING_PARAMETER_CONFIGS = new Map<FrameScaling, ScalingParameterConfig>([
    [FrameScaling.LOG, {min: 0.1, max: 10_000, defaultValue: 1_000}],
    [FrameScaling.GAMMA, {min: 0.1, max: 2, defaultValue: 1}],
    [FrameScaling.POWER, {min: 0.001, max: 1_000, defaultValue: 1_000}],
    [FrameScaling.SINH, {min: 0.1, max: 3, defaultValue: 1 / 3}],
    [FrameScaling.ASINH, {min: 0.01, max: 3, defaultValue: 0.1}]
]);

export function getScalingParameterConfig(scaling: FrameScaling): ScalingParameterConfig | undefined {
    return SCALING_PARAMETER_CONFIGS.get(scaling);
}

export function getDefaultScalingParameter(scaling: FrameScaling): number {
    return getScalingParameterConfig(scaling)?.defaultValue ?? 1;
}

export function sanitizeScalingParameter(scaling: FrameScaling, value: number, fallback: number = getDefaultScalingParameter(scaling)): number {
    const config = getScalingParameterConfig(scaling);
    if (!config) {
        return Number.isFinite(value) ? value : fallback;
    }

    let sanitizedValue = value;
    if (!Number.isFinite(sanitizedValue)) {
        sanitizedValue = Number.isFinite(fallback) ? fallback : config.defaultValue;
    }
    return clamp(sanitizedValue, config.min, config.max);
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
    return {bias: smoothedBias, contrast: smoothedContrast, offset: offset, denominator: denominator};
}

function normalizedSinhScale(x: number, alpha: number): number {
    const invAlpha = 1.0 / alpha;
    if (invAlpha > 20) {
        return (Math.exp((x - 1.0) * invAlpha) * (1.0 - Math.exp(-2.0 * x * invAlpha))) / (1.0 - Math.exp(-2.0 * invAlpha));
    }
    return Math.sinh(x * invAlpha) / Math.sinh(invAlpha);
}

function normalizedSinhScaleInverse(x: number, alpha: number): number {
    if (x <= 0) {
        return 0;
    }
    if (x >= 1) {
        return 1;
    }
    const invAlpha = 1.0 / alpha;
    if (invAlpha > 20) {
        return clamp(1.0 + alpha * Math.log(x), 0, 1);
    }
    return clamp(alpha * Math.asinh(x * Math.sinh(invAlpha)), 0, 1);
}

export function scaleValue(x: number, scaling: FrameScaling, alpha: number = 1000, gamma: number = 1.5, bias: number = 0, contrast: number = 1, shouldUseSmoothedBiasContrast: boolean = true) {
    let scaleValue;
    switch (scaling) {
        case FrameScaling.SQUARE:
            scaleValue = x * x;
            break;
        case FrameScaling.SQRT:
            scaleValue = Math.sqrt(x);
            break;
        case FrameScaling.LOG:
            scaleValue = Math.log(alpha * x + 1.0) / Math.log(alpha + 1.0);
            break;
        case FrameScaling.POWER:
            scaleValue = Math.abs(alpha - 1.0) < 1e-12 ? x : (Math.pow(alpha, x) - 1.0) / (alpha - 1.0);
            break;
        case FrameScaling.GAMMA:
            scaleValue = Math.pow(x, gamma);
            break;
        case FrameScaling.SINH:
            scaleValue = normalizedSinhScale(x, alpha);
            break;
        case FrameScaling.ASINH:
            scaleValue = Math.asinh(x / alpha) / Math.asinh(1.0 / alpha);
            break;
        default:
            scaleValue = x;
    }

    if (shouldUseSmoothedBiasContrast) {
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

export function scaleValueInverse(x: number, scaling: FrameScaling, alpha: number = 1000, gamma: number = 1.5, bias: number = 0, contrast: number = 1, shouldUseSmoothedBiasContrast: boolean = true) {
    let scaleValue;
    if (shouldUseSmoothedBiasContrast) {
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
            return Math.abs(alpha - 1.0) < 1e-12 ? scaleValue : Math.log((alpha - 1.0) * scaleValue + 1.0) / Math.log(alpha);
        case FrameScaling.GAMMA:
            return Math.pow(scaleValue, 1.0 / gamma);
        case FrameScaling.SINH:
            return normalizedSinhScaleInverse(scaleValue, alpha);
        case FrameScaling.ASINH:
            return clamp(alpha * Math.sinh(scaleValue * Math.asinh(1.0 / alpha)), 0, 1);
        default:
            return scaleValue;
    }
}
