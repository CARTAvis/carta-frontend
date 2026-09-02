import {ToolbarComponent} from "./ToolbarComponent";

describe("ToolbarComponent axis zoom", () => {
    const makeComponent = (zoomAxis: "x" | "y") => {
        const frame = {
            spatialReference: undefined,
            isPVImage: true,
            isPreview: false,
            isAxisZoomable: true,
            zoomAxis,
            effectiveZoomLevel: {x: 2, y: 1},
            zoomLevel: 2,
            setAxisZoom: jest.fn(),
            setZoom: jest.fn()
        };
        const onRegionViewZoom = jest.fn();
        const component = new ToolbarComponent({frame, onRegionViewZoom} as any);
        return {component, frame, onRegionViewZoom};
    };

    test("zooms only the selected X axis in", () => {
        const {component, frame, onRegionViewZoom} = makeComponent("x");

        component.handleZoomInClicked();

        expect(frame.setAxisZoom).toHaveBeenCalledWith(4, 1);
        expect(frame.setZoom).not.toHaveBeenCalled();
        expect(onRegionViewZoom).toHaveBeenCalledWith({x: 4, y: 1});
    });

    test("zooms only the selected Y axis out", () => {
        const {component, frame, onRegionViewZoom} = makeComponent("y");

        component.handleZoomOutClicked();

        expect(frame.setAxisZoom).toHaveBeenCalledWith(2, 0.5);
        expect(frame.setZoom).not.toHaveBeenCalled();
        expect(onRegionViewZoom).toHaveBeenCalledWith({x: 2, y: 0.5});
    });

    test("uses X as the default zoom axis", () => {
        const {component, frame, onRegionViewZoom} = makeComponent("x");

        component.handleZoomInClicked();

        expect(frame.setAxisZoom).toHaveBeenCalledWith(4, 1);
        expect(frame.setZoom).not.toHaveBeenCalled();
        expect(onRegionViewZoom).toHaveBeenCalledWith({x: 4, y: 1});
    });
});
