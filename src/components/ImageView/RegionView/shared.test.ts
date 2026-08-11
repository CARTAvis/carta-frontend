jest.mock("utilities", () => ({
    rotate2D: jest.fn(),
    scale2D: jest.fn()
}));

import {adjustPosToMutatedStage, adjustPosToUnityStage, getPvZoomAxisForWheel, transformedImageToCanvasPos} from "./shared";

describe("region view stage coordinate helpers", () => {
    const stage = {
        getPosition: () => ({x: 10, y: 20}),
        scaleX: () => 2,
        scaleY: () => 4
    };

    test("uses independent stage scales for coordinate conversion", () => {
        const unityPos = adjustPosToUnityStage({x: 5, y: 6}, stage);

        expect(unityPos).toEqual({x: 20, y: 44});
        expect(adjustPosToMutatedStage(unityPos, stage)).toEqual({x: 5, y: 6});

        const frame = {
            spatialReference: undefined,
            spatialTransform: undefined,
            requiredFrameViewForRegionRender: {xMin: 0, xMax: 100, yMin: 0, yMax: 100}
        };
        expect(transformedImageToCanvasPos({x: 50, y: 25}, frame as any, 200, 100, stage)).toEqual({x: 45, y: 13.75});
    });

    test("requires both stage scales to be one before using the unit frame view", () => {
        const nonUniformStage = {
            getPosition: () => ({x: 0, y: 0}),
            scaleX: () => 1,
            scaleY: () => 2
        };
        const frame = {
            spatialReference: undefined,
            spatialTransform: undefined,
            unitFrameView: {xMin: 0, xMax: 1, yMin: 0, yMax: 1},
            requiredFrameViewForRegionRender: {xMin: 0, xMax: 100, yMin: 0, yMax: 100}
        };

        expect(transformedImageToCanvasPos({x: 50, y: 25}, frame as any, 200, 100, nonUniformStage)).toEqual({x: 100, y: 37.5});
    });

    test("uses the toolbar PV axis for wheel zoom unless a modifier overrides it", () => {
        const frame = {isPVImage: true, isPreview: false, pvZoomAxis: "x"} as any;

        expect(getPvZoomAxisForWheel(frame, false, false)).toBe("x");
        expect(getPvZoomAxisForWheel(frame, true, false)).toBe("y");
        expect(getPvZoomAxisForWheel(frame, false, true)).toBe("x");
        expect(getPvZoomAxisForWheel(frame, true, true)).toBeUndefined();

        frame.pvZoomAxis = "both";
        expect(getPvZoomAxisForWheel(frame, false, false)).toBeUndefined();

        frame.isPVImage = false;
        frame.isPreview = true;
        frame.pvZoomAxis = "y";
        expect(getPvZoomAxisForWheel(frame, false, false)).toBe("y");
    });
});
