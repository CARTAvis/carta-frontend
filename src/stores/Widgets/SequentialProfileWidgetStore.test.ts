import {CARTA} from "carta-protobuf";

import {PlotType} from "enums";

jest.mock("utilities", () => ({SELECTABLE_COLORS: ["blue"]}));

import {SequentialProfileWidgetStore} from "./SequentialProfileWidgetStore";

describe("SequentialProfileWidgetStore", () => {
    const preferenceAccessors = {
        getVisibleXAxisFormats: () => undefined,
        setVisibleXAxisFormats: () => undefined
    };

    test("defaults to points and flux density and supports line-style/statistic updates", () => {
        const store = new SequentialProfileWidgetStore(preferenceAccessors);
        expect(store.plotType).toBe(PlotType.POINTS);
        expect(store.statistic).toBe(CARTA.StatsType.FluxDensity);

        store.applyConfig({plotType: PlotType.POINTS_AND_LINES});
        expect(store.plotType).toBe(PlotType.POINTS_AND_LINES);
        store.setStatistic(CARTA.StatsType.Max);
        expect(store.statistic).toBe(CARTA.StatsType.Max);
    });
});
