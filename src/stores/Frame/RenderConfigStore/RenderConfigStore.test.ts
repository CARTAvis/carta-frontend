jest.mock("components/Shared", () => ({
    AppToaster: {show: jest.fn()}
}));

import {FrameScaling} from "enums";
import {type PreferenceStore} from "stores";
import {type FrameStore} from "stores/Frame";

import {RenderConfigStore} from "./RenderConfigStore";

interface RenderConfigPreferenceOverrides {
    scalingAlphaLog: number;
    scalingAlphaPower: number;
    scalingAlphaSinh: number;
    scalingAlphaAsinh: number;
    scalingGamma: number;
}

function createRenderConfig(overrides: Partial<RenderConfigPreferenceOverrides> = {}): RenderConfigStore {
    const preference = {
        percentile: 99.9,
        scalingAlphaLog: 1_000,
        scalingAlphaPower: 1_000,
        scalingAlphaSinh: 1 / 3,
        scalingAlphaAsinh: 0.1,
        scalingGamma: 1,
        scaling: FrameScaling.LINEAR,
        colormap: "inferno",
        colormapHex: "#FFFFFF",
        colormapHexStart: "#000000",
        ...overrides
    } as PreferenceStore;
    const frame = {polarizations: []} as unknown as FrameStore;
    return new RenderConfigStore(preference, frame);
}

describe("RenderConfigStore alpha validation", () => {
    test("sanitizes alpha values loaded from preferences", () => {
        const renderConfig = createRenderConfig({
            scalingAlphaLog: 1e300,
            scalingAlphaPower: 1e-300,
            scalingAlphaSinh: Number.POSITIVE_INFINITY,
            scalingAlphaAsinh: Number.NaN,
            scalingGamma: Number.POSITIVE_INFINITY
        });

        expect(renderConfig.alphaLog).toBe(100_000);
        expect(renderConfig.alphaPower).toBe(0.0001);
        expect(renderConfig.alphaSinh).toBeCloseTo(1 / 3);
        expect(renderConfig.alphaAsinh).toBe(0.1);
        expect(renderConfig.gamma).toBe(0.3);
    });

    test("clamps finite setter values and rejects non-finite values", () => {
        const renderConfig = createRenderConfig();
        renderConfig.setScaling(FrameScaling.LOG);

        renderConfig.setAlpha(1e300);
        expect(renderConfig.alphaLog).toBe(100_000);

        renderConfig.setAlpha(Number.NaN);
        expect(renderConfig.alphaLog).toBe(100_000);

        renderConfig.setGamma(1e300);
        expect(renderConfig.gamma).toBe(10);

        renderConfig.setGamma(Number.NaN);
        expect(renderConfig.gamma).toBe(10);
    });

    test("updates Log without changing Gamma while Gamma preview is active", () => {
        const renderConfig = createRenderConfig({scalingAlphaLog: 5});
        renderConfig.setGamma(1.5);
        renderConfig.setScaling(FrameScaling.GAMMA);

        renderConfig.setScalingParameter(FrameScaling.LOG, 1_000);

        expect(renderConfig.alphaLog).toBe(1_000);
        expect(renderConfig.gamma).toBe(1.5);
    });

    test.each([
        [FrameScaling.LOG, "alphaLog", 25],
        [FrameScaling.POWER, "alphaPower", 0.5],
        [FrameScaling.SINH, "alphaSinh", 0.6],
        [FrameScaling.ASINH, "alphaAsinh", 0.2],
        [FrameScaling.GAMMA, "gamma", 1.5]
    ] as const)("updates only the parameter for scaling %s", (scaling, property, value) => {
        const renderConfig = createRenderConfig();
        const originalValues = {
            alphaLog: renderConfig.alphaLog,
            alphaPower: renderConfig.alphaPower,
            alphaSinh: renderConfig.alphaSinh,
            alphaAsinh: renderConfig.alphaAsinh,
            gamma: renderConfig.gamma
        };

        renderConfig.setScalingParameter(scaling, value);

        expect(renderConfig[property]).toBe(value);
        for (const [otherProperty, originalValue] of Object.entries(originalValues)) {
            if (otherProperty !== property) {
                expect(renderConfig[otherProperty]).toBe(originalValue);
            }
        }
    });

    test("sanitizes current workspace alpha values", () => {
        const renderConfig = createRenderConfig();

        renderConfig.updateFromWorkspace({alphaLog: 1e300, alphaPower: 1e300, alphaSinh: 1e-300, alphaAsinh: Number.POSITIVE_INFINITY, gamma: 1e300});

        expect(renderConfig.alphaLog).toBe(100_000);
        expect(renderConfig.alphaPower).toBe(10_000);
        expect(renderConfig.alphaSinh).toBe(0.05);
        expect(renderConfig.alphaAsinh).toBe(0.1);
        expect(renderConfig.gamma).toBe(10);
    });

    test("ignores unsupported workspace scaling values", () => {
        const renderConfig = createRenderConfig();
        renderConfig.setScaling(FrameScaling.LOG);

        renderConfig.updateFromWorkspace({scaling: FrameScaling.EXP});
        expect(renderConfig.scaling).toBe(FrameScaling.LOG);

        renderConfig.updateFromWorkspace({scaling: FrameScaling.ASINH});
        expect(renderConfig.scaling).toBe(FrameScaling.ASINH);
    });
});
