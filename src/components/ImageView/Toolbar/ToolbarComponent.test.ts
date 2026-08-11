import {ToolbarComponent} from "./ToolbarComponent";

describe("ToolbarComponent PV zoom", () => {
    const makeComponent = (pvZoomAxis: "x" | "y") => {
        const frame = {
            spatialReference: undefined,
            isPVImage: true,
            isPreview: false,
            pvZoomAxis,
            effectiveZoomLevel: {x: 2, y: 1},
            zoomLevel: 2,
            setPvZoom: jest.fn(),
            setZoom: jest.fn()
        };
        const onRegionViewZoom = jest.fn();
        const component = new ToolbarComponent({frame, onRegionViewZoom} as any);
        return {component, frame, onRegionViewZoom};
    };

    test("zooms only the selected X axis in", () => {
        const {component, frame, onRegionViewZoom} = makeComponent("x");

        component.handleZoomInClicked();

        expect(frame.setPvZoom).toHaveBeenCalledWith(4, 1);
        expect(frame.setZoom).not.toHaveBeenCalled();
        expect(onRegionViewZoom).toHaveBeenCalledWith({x: 4, y: 1});
    });

    test("zooms only the selected Y axis out", () => {
        const {component, frame, onRegionViewZoom} = makeComponent("y");

        component.handleZoomOutClicked();

        expect(frame.setPvZoom).toHaveBeenCalledWith(2, 0.5);
        expect(frame.setZoom).not.toHaveBeenCalled();
        expect(onRegionViewZoom).toHaveBeenCalledWith({x: 2, y: 0.5});
    });
});
