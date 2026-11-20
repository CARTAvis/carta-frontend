import {type FrameStore} from "stores/Frame";

import {restoreWorkspaceZoom} from "./AppStore";

function createAxisZoomableFrame() {
    return {spatialReference: null, isAxisZoomable: true, setAxisZoom: jest.fn(), setZoomAxis: jest.fn(), zoomLevel: 1};
}

describe("restoreWorkspaceZoom", () => {
    test("applies the zoom of each axis", () => {
        const frame = createAxisZoomableFrame();
        restoreWorkspaceZoom(frame as unknown as FrameStore, {axisZoomLevel: {x: 2, y: 0.5}, zoomLevel: 3, zoomAxis: "x"});
        expect(frame.setAxisZoom).toHaveBeenCalledWith(2, 0.5);
        expect(frame.setZoomAxis).toHaveBeenCalledWith("x");
    });

    test("uses the zoom level of the viewport for both axes when the zoom of an axis is not above 0", () => {
        const frame = createAxisZoomableFrame();
        restoreWorkspaceZoom(frame as unknown as FrameStore, {axisZoomLevel: {x: -1, y: 0}, zoomLevel: 3});
        expect(frame.setAxisZoom.mock.calls).toEqual([[3, 3]]);
    });
});
