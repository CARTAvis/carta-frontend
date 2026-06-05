import {FrameScaling} from "enums";

export const RENDER_CONFIG_SCALING_TYPES = new Map<FrameScaling, string>([
    [FrameScaling.LINEAR, "Linear"],
    [FrameScaling.LOG, "Log"],
    [FrameScaling.SQRT, "Square root"],
    [FrameScaling.SQUARE, "Squared"],
    [FrameScaling.GAMMA, "Gamma"],
    [FrameScaling.POWER, "Power"],
    [FrameScaling.SINH, "Sinh"],
    [FrameScaling.ASINH, "Asinh"]
]);

export const RENDER_CONFIG_GAMMA_MIN = 0.1;
export const RENDER_CONFIG_GAMMA_MAX = 2;
export const RENDER_CONFIG_ALPHA_MIN = 0.000001;
export const RENDER_CONFIG_ALPHA_MAX = 1000000;
export const RENDER_CONFIG_BIAS_MIN = -1;
export const RENDER_CONFIG_BIAS_MAX = 1;
export const RENDER_CONFIG_CONTRAST_MIN = 0;
export const RENDER_CONFIG_CONTRAST_MAX = 2;
