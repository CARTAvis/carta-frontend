jest.mock("utilities", () => ({
    getInterpolatedPathAtDistance: jest.fn((start, points) => [start, ...points]),
    rotate2D: (point, angle) => ({x: point.x * Math.cos(angle) - point.y * Math.sin(angle), y: point.x * Math.sin(angle) + point.y * Math.cos(angle)}),
    scale2D: jest.fn()
}));

import {getInterpolatedPathAtDistance} from "utilities";

import {
    adjustPosToMutatedStage,
    adjustPosToUnityStage,
    getCanvasPathAtScreenDistance,
    getDirectionalStageScale,
    getZoomAxisForWheel,
    getZoomInvariantCanvasOffset,
    getZoomInvariantCanvasTransform,
    getZoomInvariantTransform,
    transformedImageToCanvasPos
} from "./shared";

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

    test("uses the toolbar axis for wheel zoom unless a modifier overrides it", () => {
        const frame = {isAxisZoomable: true, zoomAxis: "x"} as any;

        expect(getZoomAxisForWheel(frame, false, false)).toBe("x");
        expect(getZoomAxisForWheel(frame, true, false)).toBe("y");
        expect(getZoomAxisForWheel(frame, false, true)).toBe("x");
        expect(getZoomAxisForWheel(frame, true, true)).toBeUndefined();

        frame.zoomAxis = "both";
        expect(getZoomAxisForWheel(frame, false, false)).toBeUndefined();

        frame.isAxisZoomable = true;
        frame.zoomAxis = "y";
        expect(getZoomAxisForWheel(frame, false, false)).toBe("y");

        frame.isAxisZoomable = false;
        expect(getZoomAxisForWheel(frame, false, false)).toBeUndefined();
    });

    test("compensates annotation transforms for independent stage scales", () => {
        const horizontal = getZoomInvariantTransform(stage);
        const vertical = getZoomInvariantTransform(stage, 90);

        expect(horizontal.scaleX).toBeCloseTo(0.5);
        expect(horizontal.scaleY).toBeCloseTo(0.25);
        expect(horizontal.skewX).toBeCloseTo(0);
        expect(horizontal.skewY).toBeCloseTo(0);
        expect(vertical.scaleX).toBeCloseTo(0.25);
        expect(vertical.scaleY).toBeCloseTo(0.5);
        expect(vertical.skewX).toBeCloseTo(0);
        expect(vertical.skewY).toBeCloseTo(0);
    });

    test("builds the canvas matrix for a rotated invariant shape", () => {
        const transform = getZoomInvariantCanvasTransform(stage, 45);

        expect(transform.scaleX).toBeCloseTo(0.375);
        expect(transform.scaleY).toBeCloseTo(0.375);
        expect(transform.skew).toBeCloseTo(-0.125);
    });

    test("maps a rotated invariant offset back through independent stage scales", () => {
        const offset = getZoomInvariantCanvasOffset({x: 10, y: 0}, stage, 45);

        expect(offset.x * stage.scaleX()).toBeCloseTo(Math.sqrt(50));
        expect(offset.y * stage.scaleY()).toBeCloseTo(Math.sqrt(50));
    });

    test("uses the final path segment for directional scaling", () => {
        expect(getDirectionalStageScale([0, 0, 10, 0, 10, 10], stage)).toEqual({along: 4, across: 2});
    });

    test("measures interpolated paths in screen space", () => {
        const path = getCanvasPathAtScreenDistance({x: 1, y: 2}, [{x: 3, y: 4}], 10, stage);

        expect(getInterpolatedPathAtDistance).toHaveBeenLastCalledWith({x: 2, y: 8}, [{x: 6, y: 16}], 10);
        expect(path).toEqual([
            {x: 1, y: 2},
            {x: 3, y: 4}
        ]);
    });
});
