import {CatalogPlotType} from "enums";
import {CatalogPlotWidgetStore} from "stores";

describe("CatalogPlotWidgetStore config", () => {
    test("round-trips user plot settings", () => {
        const store = new CatalogPlotWidgetStore({xColumnName: "Fmag", yColumnName: "Bmag", plotType: CatalogPlotType.D2Scatter});
        store.setStatisticColumn("Vmag");
        store.setLogScaleY(false);
        store.setNumBinsX(25);
        store.setDragMode("zoom");
        store.setScatterborder({xMin: 1, xMax: 10, yMin: 2, yMax: 11});

        const restored = new CatalogPlotWidgetStore({xColumnName: "None", yColumnName: "None", plotType: CatalogPlotType.D2Scatter});
        restored.applyConfig(store.toConfig());

        expect(restored.toConfig()).toEqual(store.toConfig());
    });

    test("ignores invalid optional values", () => {
        const store = new CatalogPlotWidgetStore({xColumnName: "Fmag", yColumnName: "Bmag", plotType: CatalogPlotType.D2Scatter});

        store.applyConfig({nBinX: 0, isLogScaleY: false});

        expect(store.nBinX).toBeUndefined();
        expect(store.isLogScaleY).toBe(false);
    });
});
