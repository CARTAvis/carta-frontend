import {describe, expect, test} from "@jest/globals";

import {describeViewShapeChange, getFieldOfViewScale, isValidImageViewSize} from "./WorkspaceFieldOfView";

describe("WorkspaceFieldOfView", () => {
    test("uses the smaller scale of the width and the height, so that the saved area fits", () => {
        expect(getFieldOfViewScale({width: 1600, height: 900, pixelRatio: 1}, {width: 1280, height: 800}, 1)).toBeCloseTo(0.8);
        expect(getFieldOfViewScale({width: 1000, height: 500, pixelRatio: 2}, {width: 1000, height: 500}, 1)).toBeCloseTo(0.5);
        expect(getFieldOfViewScale({width: 1000, height: 500, pixelRatio: NaN}, {width: 1000, height: 500}, 2)).toBeCloseTo(2);
    });

    test("names the sides where more of each image shows, and ignores a change of 2% or less", () => {
        expect(describeViewShapeChange({width: 1600, height: 900, pixelRatio: 1}, {width: 1280, height: 800})).toBe(
            "The image view has another shape than when the workspace was saved (1600×900, now 1280×800). More of each image shows at the top and bottom."
        );
        expect(describeViewShapeChange({width: 1000, height: 1000, pixelRatio: 1}, {width: 1500, height: 1000})).toContain("at the left and right");
        expect(describeViewShapeChange({width: 1000, height: 1000, pixelRatio: 1}, {width: 1015, height: 1000})).toBeUndefined();
    });

    test("accepts only a size with a positive width and height", () => {
        expect(isValidImageViewSize({width: 10, height: 20, pixelRatio: 1})).toBe(true);
        expect(isValidImageViewSize({width: 0, height: 20})).toBe(false);
        expect(isValidImageViewSize("640x400")).toBe(false);
        expect(isValidImageViewSize(undefined)).toBe(false);
    });
});
