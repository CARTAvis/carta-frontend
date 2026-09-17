import {DragMode, InteractionMode, ZoomMode} from "enums";

import {ScatterPlotComponent} from "./ScatterPlotComponent";

const CreateMouseEvent = (modifiers: Partial<Pick<MouseEvent, "altKey" | "ctrlKey" | "shiftKey">> = {}) => ({
    evt: {
        offsetX: 10,
        offsetY: 20,
        ...modifiers
    }
});

describe("ScatterPlotComponent interactions", () => {
    test.each([
        ["Ctrl", {ctrlKey: true}],
        ["Alt", {altKey: true}]
    ])("supports %s-drag panning for legacy consumers", (_modifier, modifiers) => {
        const component = new ScatterPlotComponent({});
        const startPanning = jest.spyOn(component, "startPanning");

        component.onStageMouseDown(CreateMouseEvent(modifiers) as any);

        expect(startPanning).toHaveBeenCalledWith(10, 20);
        expect(component.interactionMode).toBe(InteractionMode.PANNING);
    });

    test("does not start an interaction when drag mode is disabled", () => {
        const component = new ScatterPlotComponent({dragAction: false});
        const startSelection = jest.spyOn(component, "startSelection");
        const startPanning = jest.spyOn(component, "startPanning");

        component.onStageMouseDown(CreateMouseEvent({shiftKey: true}) as any);

        expect(startSelection).not.toHaveBeenCalled();
        expect(startPanning).not.toHaveBeenCalled();
        expect(component.interactionMode).toBe(InteractionMode.NONE);
    });

    test("uses XY zoom for thin catalog zoom drags", () => {
        const component = new ScatterPlotComponent({dragAction: DragMode.Zoom, graphZoomedXY: jest.fn()});
        component.selectionBoxStart = {x: 0, y: 0};
        component.selectionBoxEnd = {x: 5, y: 25};

        expect(component.zoomMode).toBe(ZoomMode.XY);
    });

    test("appends lasso points without replacing the path", () => {
        const component = new ScatterPlotComponent({});
        component.startLassoSelection(1, 2);
        const points = component.lassoPoints;

        component.updateLassoSelection(3, 4);

        expect(component.lassoPoints).toEqual([1, 2, 3, 4]);
        expect(component.lassoPoints).toBe(points);
    });
});
