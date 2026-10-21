jest.mock("components/Shared", () => ({
    AppToaster: {show: jest.fn()}
}));

import {FrameScaling} from "enums";
import {type PreferenceStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {undeclaredFields} from "utilities/schema/pendingSchemaFields";

import {RenderConfigStore} from "./RenderConfigStore";

const WORKSPACE_SCHEMA = require("carta-schemas/workspace_schema_2.json");

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

        expect(renderConfig.alphaLog).toBe(1_000_000);
        expect(renderConfig.alphaPower).toBe(0.000001);
        expect(renderConfig.alphaSinh).toBeCloseTo(1 / 3);
        expect(renderConfig.alphaAsinh).toBe(0.1);
        expect(renderConfig.gamma).toBe(0.3);
    });

    test("clamps finite setter values and rejects non-finite values", () => {
        const renderConfig = createRenderConfig();
        renderConfig.setScaling(FrameScaling.LOG);

        renderConfig.setAlpha(1e300);
        expect(renderConfig.alphaLog).toBe(1_000_000);

        renderConfig.setAlpha(Number.NaN);
        expect(renderConfig.alphaLog).toBe(1_000_000);

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

        renderConfig.applyConfig({alphaLog: 1e300, alphaPower: 1e300, alphaSinh: 1e-300, alphaAsinh: Number.POSITIVE_INFINITY, gamma: 1e300});

        expect(renderConfig.alphaLog).toBe(1_000_000);
        expect(renderConfig.alphaPower).toBe(1_000_000);
        expect(renderConfig.alphaSinh).toBe(0.05);
        expect(renderConfig.alphaAsinh).toBe(0.1);
        expect(renderConfig.gamma).toBe(10);
    });

    test("ignores unsupported workspace scaling values", () => {
        const renderConfig = createRenderConfig();
        renderConfig.setScaling(FrameScaling.LOG);

        renderConfig.applyConfig({scaling: FrameScaling.EXP});
        expect(renderConfig.scaling).toBe(FrameScaling.LOG);

        renderConfig.applyConfig({scaling: FrameScaling.ASINH});
        expect(renderConfig.scaling).toBe(FrameScaling.ASINH);
    });
});

describe("RenderConfigStore workspace round trip", () => {
    test("writes only fields the workspace schema declares", () => {
        const renderConfig = createRenderConfig();

        expect(undeclaredFields("workspace/render-config", WORKSPACE_SCHEMA.definitions["render-config"].properties, renderConfig.toConfig())).toEqual([]);
    });

    test("returns the applied config", () => {
        const renderConfig = createRenderConfig();
        const config = {
            scaling: FrameScaling.LOG,
            colorMap: "viridis",
            bias: 0.1,
            contrast: 1.2,
            gamma: 2,
            alphaLog: 500,
            alphaPower: 500,
            alphaSinh: 0.2,
            alphaAsinh: 0.2,
            inverted: true,
            selectedPercentile: [90],
            scaleMin: [0],
            scaleMax: [1],
            visible: false
        };

        renderConfig.applyConfig(config);

        expect(renderConfig.toConfig()).toEqual({...config, customColormapHexStart: "#000000", customColormapHexEnd: "#FFFFFF", useCubeHistogram: false, useCubeHistogramContours: false});
    });
});

/** A histogram of four bins of one, spanning 0 to 5 as the store reads its edges. */
const HISTOGRAM = {numBins: 4, binWidth: 1, firstBinCenter: 0.5, bins: [1, 1, 1, 1], mean: 2, stdDev: 1};

describe("RenderConfigStore workspace restore", () => {
    test("saves the colors of a custom colormap", () => {
        const renderConfig = createRenderConfig();
        renderConfig.setColorMap(RenderConfigStore.COLOR_MAPS_CUSTOM);
        renderConfig.setCustomHexStart("#112233");
        renderConfig.setCustomHexEnd("#445566");

        expect(renderConfig.toConfig()).toEqual(expect.objectContaining({colorMap: RenderConfigStore.COLOR_MAPS_CUSTOM, customColormapHexStart: "#112233", customColormapHexEnd: "#445566"}));
    });

    test("restores both colors of a custom colormap", () => {
        const renderConfig = createRenderConfig();

        renderConfig.applyConfig({colorMap: RenderConfigStore.COLOR_MAPS_CUSTOM, customColormapHexStart: "#112233", customColormapHexEnd: "#445566"});

        expect(renderConfig.colorMap).toBe(RenderConfigStore.COLOR_MAPS_CUSTOM);
        expect(renderConfig.customColormapHexStart).toBe("#112233");
        expect(renderConfig.customColormapHexEnd).toBe("#445566");
    });

    test("keeps its own custom colormap colors when a workspace saved none", () => {
        const renderConfig = createRenderConfig();

        renderConfig.applyConfig({colorMap: RenderConfigStore.COLOR_MAPS_CUSTOM});

        expect(renderConfig.customColormapHexStart).toBe("#000000");
        expect(renderConfig.customColormapHexEnd).toBe("#FFFFFF");
    });

    test("restores a cube histogram percentile as saved, without taking it from the channel histogram", () => {
        const renderConfig = createRenderConfig();

        renderConfig.applyConfig({useCubeHistogram: true, useCubeHistogramContours: true, selectedPercentile: [100], scaleMin: [-1], scaleMax: [9]});
        renderConfig.updateChannelHistogram(HISTOGRAM);

        expect(renderConfig.isUsingCubeHistogram).toBe(true);
        expect(renderConfig.isUsingCubeHistogramContours).toBe(true);
        expect([renderConfig.scaleMinVal, renderConfig.scaleMaxVal]).toEqual([-1, 9]);
    });

    test("keeps a restored range while the cube histogram streams, and takes the percentile from the complete one", () => {
        const renderConfig = createRenderConfig();
        renderConfig.applyConfig({useCubeHistogram: true, selectedPercentile: [100], scaleMin: [-1], scaleMax: [9]});

        renderConfig.awaitCompleteCubeHistogram();
        renderConfig.updateCubeHistogram(HISTOGRAM, 0.75);
        expect([renderConfig.scaleMinVal, renderConfig.scaleMaxVal]).toEqual([-1, 9]);

        renderConfig.updateCubeHistogram(HISTOGRAM, 1);
        expect([renderConfig.scaleMinVal, renderConfig.scaleMaxVal]).toEqual([0, 5]);
    });

    test("follows a streaming cube histogram when no restore is waiting for it", () => {
        const renderConfig = createRenderConfig();
        renderConfig.applyConfig({useCubeHistogram: true, selectedPercentile: [100], scaleMin: [-1], scaleMax: [9]});

        renderConfig.updateCubeHistogram(HISTOGRAM, 0.75);

        expect([renderConfig.scaleMinVal, renderConfig.scaleMaxVal]).toEqual([0, 5]);
    });

    test("keeps a restored range as a custom one when its cube histogram does not come", () => {
        const renderConfig = createRenderConfig();
        renderConfig.applyConfig({useCubeHistogram: true, selectedPercentile: [100], scaleMin: [-1], scaleMax: [9]});
        renderConfig.awaitCompleteCubeHistogram();

        renderConfig.keepRangeWithoutCubeHistogram();
        renderConfig.updateChannelHistogram(HISTOGRAM);

        expect(renderConfig.isUsingCubeHistogram).toBe(false);
        expect(renderConfig.selectedPercentileVal).toBe(-1);
        expect([renderConfig.scaleMinVal, renderConfig.scaleMaxVal]).toEqual([-1, 9]);
    });

    test("keeps the range of the polarization it is told to, as a custom one", () => {
        const renderConfig = createRenderConfig();
        renderConfig.applyConfig({useCubeHistogram: true, selectedPercentile: [99.5, 100], scaleMin: [-1, -2], scaleMax: [9, 8]});

        renderConfig.keepRangeWithoutCubeHistogram(1);

        expect(renderConfig.selectedPercentile).toEqual([99.5, -1]);
        expect(renderConfig.scaleMax).toEqual([9, 8]);
    });

    test("forgets that the cube histogram was asked for once it is cleared", () => {
        const renderConfig = createRenderConfig();

        renderConfig.markCubeHistogramRequested();
        renderConfig.updateCubeHistogram(HISTOGRAM, 0.75);
        expect(renderConfig.isCubeHistogramRequested).toBe(true);

        renderConfig.updateCubeHistogram(null, 0);
        expect(renderConfig.isCubeHistogramRequested).toBe(false);
    });

    test("keeps a restored custom range when a histogram arrives", () => {
        const renderConfig = createRenderConfig();

        renderConfig.applyConfig({selectedPercentile: [-1], scaleMin: [2], scaleMax: [3]});
        renderConfig.updateChannelHistogram(HISTOGRAM);

        expect(renderConfig.selectedPercentileVal).toBe(-1);
        expect([renderConfig.scaleMinVal, renderConfig.scaleMaxVal]).toEqual([2, 3]);
    });
});
