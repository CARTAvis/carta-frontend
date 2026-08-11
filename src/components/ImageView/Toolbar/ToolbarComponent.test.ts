import {ToolbarComponent} from "./ToolbarComponent";

describe("ToolbarComponent PV zoom", () => {
    const makeComponent = () => {
        const frame = {
            spatialReference: undefined,
            isPVImage: true,
            isPreview: false,
            pvZoomAxis: "both",
            effectiveZoomLevel: {x: 2, y: 1},
            zoomLevel: 2,
            setPvZoom: jest.fn(),
            setZoom: jest.fn()
        };
        const onRegionViewZoom = jest.fn();
        const component = new ToolbarComponent({frame, onRegionViewZoom} as any);
        return {component, frame, onRegionViewZoom};
    };

    test("zooms both PV axes in without changing their ratio", () => {
        const {component, frame, onRegionViewZoom} = makeComponent();

        component.handleZoomInClicked();

        expect(frame.setPvZoom).toHaveBeenCalledWith(4, 2);
        expect(frame.setZoom).not.toHaveBeenCalled();
        expect(onRegionViewZoom).toHaveBeenCalledWith({x: 4, y: 2});
    });

    test("zooms both PV axes out without changing their ratio", () => {
        const {component, frame, onRegionViewZoom} = makeComponent();

        component.handleZoomOutClicked();

        expect(frame.setPvZoom).toHaveBeenCalledWith(1, 0.5);
        expect(frame.setZoom).not.toHaveBeenCalled();
        expect(onRegionViewZoom).toHaveBeenCalledWith({x: 1, y: 0.5});
    });
});
