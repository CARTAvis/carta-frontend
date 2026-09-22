import {DragMode, InteractionMode, ZoomMode} from "enums";

import {ScatterPlotComponent} from "./ScatterPlotComponent";

const CreateMouseEvent = (modifiers: Partial<Pick<MouseEvent, "altKey" | "ctrlKey" | "shiftKey" | "button">> = {}) => ({
    evt: {
        offsetX: 10,
        offsetY: 20,
        button: 0,
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

    test("ends an interaction when the pointer is released outside the stage", () => {
        const onBoxSelected = jest.fn();
        const component = new ScatterPlotComponent({dragAction: DragMode.Select, onBoxSelected, xMin: 0, xMax: 100, yMin: 0, yMax: 100});
        component.chartArea = {left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100};

        component.onStageMouseDown(CreateMouseEvent() as any);
        component.updateSelection(40, 50);
        expect(component.interactionMode).toBe(InteractionMode.SELECTING);

        window.dispatchEvent(new MouseEvent("mouseup", {clientX: 40, clientY: 50}));

        expect(component.interactionMode).toBe(InteractionMode.NONE);
        expect(onBoxSelected).toHaveBeenCalledTimes(1);
    });

    test("ignores non-primary mouse buttons", () => {
        const component = new ScatterPlotComponent({});
        const startSelection = jest.spyOn(component, "startSelection");

        component.onStageMouseDown(CreateMouseEvent({button: 2}) as any);

        expect(startSelection).not.toHaveBeenCalled();
        expect(component.interactionMode).toBe(InteractionMode.NONE);
    });

    test("ignores interaction starts outside the chart area", () => {
        const component = new ScatterPlotComponent({});
        component.chartArea = {left: 20, right: 80, top: 10, bottom: 70, width: 60, height: 60};

        component.onStageMouseDown({evt: {offsetX: 10, offsetY: 20}} as any);

        expect(component.interactionMode).toBe(InteractionMode.NONE);
    });

    test("does not zoom for thin XY drags", () => {
        const component = new ScatterPlotComponent({dragAction: DragMode.Zoom, graphZoomedXY: jest.fn()});
        component.selectionBoxStart = {x: 0, y: 0};
        component.selectionBoxEnd = {x: 5, y: 25};

        expect(component.zoomMode).toBe(ZoomMode.NONE);
    });

    test("uses XY zoom for meaningful XY drags", () => {
        const component = new ScatterPlotComponent({dragAction: DragMode.Zoom, graphZoomedXY: jest.fn()});
        component.selectionBoxStart = {x: 0, y: 0};
        component.selectionBoxEnd = {x: 25, y: 25};

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
