import {CatalogOverlay, CatalogPlotType} from "enums";
import {CatalogPlotWidgetStore} from "stores";

describe("CatalogPlotWidgetStore config", () => {
    test("round-trips user plot settings", () => {
        const store = new CatalogPlotWidgetStore({xColumnName: "Fmag", yColumnName: "Bmag", plotType: CatalogPlotType.D2Scatter});
        store.setStatisticColumn("Vmag");
        store.setLogScaleY(false);
        store.setNumBinsX(25);
        store.setDragMode("zoom");
        store.setScatterborder({xMin: 1, xMax: 10, yMin: 2, yMax: 11});
        store.setFitting({intercept: 1, slope: 2, cov00: 3, cov01: 4, cov11: 5, rss: 6});
        store.setMinMaxX({minVal: 2, maxVal: 8});

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

describe("CatalogPlotWidgetStore restored columns", () => {
    test("drops columns the catalog no longer has and keeps the rest", () => {
        const store = new CatalogPlotWidgetStore({xColumnName: "Fmag", yColumnName: "Bmag", plotType: CatalogPlotType.D2Scatter});
        store.setStatisticColumn("Vmag");

        const columns = new Set(["Fmag"]);
        const dropped = store.resetUnknownColumns(column => columns.has(column));

        expect(dropped.sort()).toEqual(["Bmag", "Vmag"]);
        expect(store.xColumnName).toBe("Fmag");
        expect(store.yColumnName).toBe(CatalogOverlay.NONE);
        expect(store.statisticColumnName).toBe(CatalogOverlay.NONE);
    });

    test("leaves a plot whose columns the catalog still has untouched", () => {
        const store = new CatalogPlotWidgetStore({xColumnName: "Fmag", yColumnName: "Bmag", plotType: CatalogPlotType.D2Scatter});

        expect(store.resetUnknownColumns(() => true)).toEqual([]);
        expect(store.xColumnName).toBe("Fmag");
        expect(store.yColumnName).toBe("Bmag");
        expect(store.statisticColumnName).toBe(CatalogOverlay.NONE);
    });
});
