import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogPlotType, WorkspaceItemKind} from "enums";
import {AppStore, CatalogStore, WidgetsStore, WorkspaceIdRegistry} from "stores";

describe("CatalogPlotBindingStore", () => {
    const catalogs = CatalogStore.Instance;
    const bindings = catalogs.plotBindings;
    const widgets = WidgetsStore.Instance;
    const plot = {xColumnName: "RA", yColumnName: "DEC", plotType: CatalogPlotType.D2Scatter};

    beforeEach(() => {
        bindings.componentIds().forEach(componentId => bindings.closeComponent(componentId));
        Array.from(widgets.catalogPlotWidgets.keys()).forEach(widgetId => bindings.deletePlot(widgetId));
        catalogs.catalogProfileStores.clear();
        catalogs.imageAssociatedCatalogId.clear();
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
        jest.restoreAllMocks();
    });

    test("keeps the saved Catalog ID when Restore leaves a plot showing a fallback", () => {
        const widgetId = widgets.addCatalogPlotWidget(plot, "catalog-plot-0", {catalogId: 7}) as string;
        bindings.register("catalog-plot-component-0", 5, widgetId);
        catalogs.catalogProfileStores.set(5, {catalogInfo: {fileInfo: {name: "fallback.vot"}}, catalogHeader: []} as any);

        const issues = bindings.restoreWorkspacePlots([{id: 7, source: {type: "file", filename: "missing.vot"}}], new Map());

        expect(bindings.displayedForComponent("catalog-plot-component-0")?.catalogFileId).toBe(5);
        expect(bindings.configForLayout(widgetId, true)?.catalogId).toBe(7);
        expect(issues).toContainEqual({
            kind: WorkspaceItemKind.CatalogPlot,
            subject: widgetId,
            message: "Could not restore catalog plot catalog-plot-0: the catalog missing.vot is unavailable; it is showing catalog file 5 instead"
        });
    });

    test("releases a saved Catalog ID when a Layout replaces the plot settings", () => {
        widgets.addCatalogPlotWidget(plot, "catalog-plot-0", {catalogId: 1});

        widgets.addCatalogPlotWidget(plot, "catalog-plot-0");

        expect(WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 55)).toBe(1);
    });

    test("rebinds to the restored Catalog and releases the plot it replaces", () => {
        const restored = widgets.addCatalogPlotWidget(plot, "catalog-plot-0", {catalogId: 20}) as string;
        const replaced = widgets.addCatalogPlotWidget(plot, "catalog-plot-1") as string;
        bindings.register("catalog-plot-component-0", 1, restored);
        bindings.register("catalog-plot-component-0", 5, replaced);
        catalogs.catalogProfileStores.set(5, {catalogHeader: [{name: "RA"}, {name: "DEC"}]} as any);

        const issues = bindings.restoreWorkspacePlots([{id: 20, source: {type: "file", filename: "sources.vot"}}], new Map([[20, 5]]));

        expect(issues).toEqual([]);
        expect(bindings.displayedForComponent("catalog-plot-component-0")).toEqual({catalogFileId: 5, widgetId: restored});
        expect(widgets.catalogPlotWidgets.has(replaced)).toBe(false);
        expect(bindings.configForLayout(restored, true)?.catalogId).toBe(20);
    });

    test("validates numeric columns when their Catalog arrives", () => {
        const addWarning = jest.spyOn(AppStore.Instance.logStore, "addWarning").mockImplementation(jest.fn());
        const widgetId = widgets.addCatalogPlotWidget({...plot, yColumnName: "Text"}, "catalog-plot-0") as string;
        bindings.register("catalog-plot-component-0", 5, widgetId);
        catalogs.catalogProfileStores.set(5, {
            catalogInfo: {fileInfo: {name: "sources.vot"}},
            getColumnHeader: (name: string) => ({dataType: name === "Text" ? CARTA.ColumnType.String : CARTA.ColumnType.Double})
        } as any);

        bindings.validateColumns(5);

        expect(widgets.catalogPlotWidgets.get(widgetId)?.xColumnName).toBe("RA");
        expect(widgets.catalogPlotWidgets.get(widgetId)?.yColumnName).toBe(CatalogOverlay.NONE);
        expect(addWarning).toHaveBeenCalledWith(expect.stringContaining('"Text" is not a valid numeric column'), ["catalog"]);
    });

    test("reports missing column names after a restored binding is resolved", () => {
        const widgetId = widgets.addCatalogPlotWidget({...plot, yColumnName: "Gone"}, "catalog-plot-0", {catalogId: 8}) as string;
        bindings.register("catalog-plot-component-0", 1, widgetId);
        catalogs.catalogProfileStores.set(5, {catalogHeader: [{name: "RA"}]} as any);

        const issues = bindings.restoreWorkspacePlots([{id: 8, source: {type: "file", filename: "sources.vot"}}], new Map([[8, 5]]));

        expect(issues).toContainEqual({
            kind: WorkspaceItemKind.CatalogPlot,
            subject: widgetId,
            message: "Could not fully restore catalog plot catalog-plot-0 for the catalog sources.vot: column Gone is unavailable"
        });
    });
});
