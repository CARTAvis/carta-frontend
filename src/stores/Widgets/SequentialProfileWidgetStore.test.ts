import {PlotType} from "enums";

jest.mock("utilities", () => ({SELECTABLE_COLORS: ["blue"]}));

import {SequentialProfileWidgetStore} from "./SequentialProfileWidgetStore";

describe("SequentialProfileWidgetStore", () => {
    const preferenceAccessors = {
        getVisibleXAxisFormats: () => undefined,
        setVisibleXAxisFormats: () => undefined
    };

    test("defaults to points and restores the points-and-lines style", () => {
        const store = new SequentialProfileWidgetStore(preferenceAccessors);
        expect(store.plotType).toBe(PlotType.POINTS);

        store.applyConfig({plotType: PlotType.POINTS_AND_LINES});
        expect(store.plotType).toBe(PlotType.POINTS_AND_LINES);
    });
});
