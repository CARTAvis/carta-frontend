import {getContourZoomParameters} from "./shared";

describe("contour zoom parameters", () => {
    test("preserves screen-space thickness for independent axis zoom", () => {
        expect(getContourZoomParameters({x: 2, y: 4}, 1.5)).toEqual({pixelAspectRatio: 0.75, zoomY: 4});
    });

    test("includes the spatial transform scale in the screen-space zoom", () => {
        expect(getContourZoomParameters({x: 2, y: 4}, 1.5, 0.5)).toEqual({pixelAspectRatio: 0.75, zoomY: 2});
    });
});
