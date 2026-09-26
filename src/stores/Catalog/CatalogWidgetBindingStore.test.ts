import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogPlotType, WorkspaceItemKind} from "enums";
import {AppStore, CatalogStore, WidgetsStore, WorkspaceIdRegistry} from "stores";

describe("CatalogWidgetBindingStore", () => {
    const catalogs = CatalogStore.Instance;
    const bindings = catalogs.widgetBindings;
    const widgets = WidgetsStore.Instance;
    const plot = {xColumnName: "RA", yColumnName: "DEC", plotType: CatalogPlotType.D2Scatter};

    beforeEach(() => {
        bindings.componentIds().forEach(componentId => bindings.closeComponent(componentId));
        Array.from(widgets.catalogPlotWidgets.keys()).forEach(widgetId => bindings.deletePlot(widgetId));
        catalogs.catalogProfileStores.clear();
        catalogs.catalogImageIds.clear();
        widgets.catalogWidgets.clear();
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
        jest.restoreAllMocks();
    });

    test("takes the fallback as the plot's catalog when Restore cannot bring back the saved one", () => {
        const widgetId = widgets.addCatalogPlotWidget(plot, "catalog-plot-0") as string;
        bindings.register("catalog-plot-component-0", 5, widgetId);
        catalogs.catalogProfileStores.set(5, {catalogInfo: {fileInfo: {name: "fallback.vot"}}, catalogHeader: []} as any);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 5, 2);

        const issues = bindings.restore({"catalog-plot-0": {type: "catalog-plot", catalogId: 1}}, [{id: 1, source: {type: "file", filename: "missing.vot"}}], new Map());

        expect(bindings.displayedForComponent("catalog-plot-component-0")?.catalogFileId).toBe(5);
        expect(bindings.savedCatalogWidgets()["catalog-plot-0"]?.catalogId).toBe(2);
        expect(issues).toContainEqual({
            kind: WorkspaceItemKind.CatalogPlot,
            subject: widgetId,
            message: "Could not restore catalog plot catalog-plot-0: the catalog missing.vot is unavailable; it is showing catalog file 5 instead"
        });
        // The unavailable catalog's ID is not held back from the next catalog opened.
        expect(WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 55)).toBe(1);
    });

    test("gives each new plot tab a stable ID no other catalog widget has", () => {
        // A table widget already has the ID the first plot would take.
        widgets.getCatalogWidgetStore("catalog-overlay-0").setWidgetId("catalog-plot-0");
        ["catalog-plot-0", "catalog-plot-1", "catalog-plot-2"].forEach(id => widgets.addCatalogPlotWidget(plot, id));

        bindings.register("catalog-plot-component-0", undefined, "catalog-plot-0");
        // A layout names the ID a plot was saved with, twice when it was edited by hand.
        bindings.registerRestored("catalog-plot-component-1", "catalog-plot-1", "plot-b");
        bindings.registerRestored("catalog-plot-component-2", "catalog-plot-2", "plot-b");

        expect(bindings.layoutSettingsFor("catalog-plot-0")?.widgetId).toBe("catalog-plot-0-1");
        expect(bindings.layoutSettingsFor("catalog-plot-1")?.widgetId).toBe("plot-b");
        expect(bindings.layoutSettingsFor("catalog-plot-2")?.widgetId).toBe("plot-b-1");
    });

    test("rebinds to the restored Catalog and releases the plot it replaces", () => {
        const restored = widgets.addCatalogPlotWidget(plot, "catalog-plot-0") as string;
        const replaced = widgets.addCatalogPlotWidget(plot, "catalog-plot-1") as string;
        bindings.register("catalog-plot-component-0", 1, restored);
        bindings.register("catalog-plot-component-0", 5, replaced);
        catalogs.catalogProfileStores.set(5, {getColumnHeader: () => ({dataType: CARTA.ColumnType.Double})} as any);

        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 5, 20);

        const issues = bindings.restore({"catalog-plot-0": {type: "catalog-plot", catalogId: 20}}, [{id: 20, source: {type: "file", filename: "sources.vot"}}], new Map([[20, 5]]));

        expect(issues).toEqual([]);
        expect(bindings.displayedForComponent("catalog-plot-component-0")).toEqual({catalogFileId: 5, widgetId: restored});
        expect(widgets.catalogPlotWidgets.has(replaced)).toBe(false);
        expect(bindings.savedCatalogWidgets()["catalog-plot-0"]?.catalogId).toBe(20);
    });

    test("opens a floating plot tab on the catalog, drawn from the given columns", () => {
        catalogs.catalogProfileStores.set(5, {getColumnHeader: () => ({dataType: CARTA.ColumnType.Double})} as any);

        bindings.openPlot(5, {xColumnName: "RA", yColumnName: "DEC", plotType: CatalogPlotType.D2Scatter});

        const componentId = bindings.componentIds()[0];
        const shown = bindings.displayedForComponent(componentId);
        expect(shown?.catalogFileId).toBe(5);
        expect(widgets.catalogPlotWidgets.get(shown?.widgetId ?? "")).toMatchObject({xColumnName: "RA", yColumnName: "DEC", plotType: CatalogPlotType.D2Scatter});
        widgets.removeFloatingWidgets();
    });

    test("gives a plot tab a plot of its own type for a catalog it has not shown before", () => {
        const widgetId = widgets.addCatalogPlotWidget({xColumnName: "RA", plotType: CatalogPlotType.Histogram}, "catalog-plot-0") as string;
        bindings.register("catalog-plot-component-0", 5, widgetId);
        catalogs.catalogProfileStores.set(6, {getColumnHeader: () => undefined} as any);

        bindings.show("catalog-plot-component-0", 6);

        const shown = bindings.displayedForComponent("catalog-plot-component-0");
        expect(shown?.catalogFileId).toBe(6);
        expect(shown?.widgetId).not.toBe(widgetId);
        expect(widgets.catalogPlotWidgets.get(shown?.widgetId ?? "")).toMatchObject({xColumnName: CatalogOverlay.NONE, plotType: CatalogPlotType.Histogram});
        // The plot kept for the catalog it showed before is still there to go back to.
        expect(widgets.catalogPlotWidgets.get(widgetId)?.xColumnName).toBe("RA");
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
        const widgetId = widgets.addCatalogPlotWidget(plot, "catalog-plot-0") as string;
        bindings.register("catalog-plot-component-0", 1, widgetId);
        catalogs.catalogProfileStores.set(5, {getColumnHeader: (name: string) => (name === "RA" ? {dataType: CARTA.ColumnType.Double} : undefined)} as any);

        const issues = bindings.restore({"catalog-plot-0": {type: "catalog-plot", catalogId: 8, xColumnName: "RA", yColumnName: "Gone"}}, [{id: 8, source: {type: "file", filename: "sources.vot"}}], new Map([[8, 5]]));

        expect(issues).toContainEqual({
            kind: WorkspaceItemKind.CatalogPlot,
            subject: widgetId,
            message: "Could not fully restore catalog plot catalog-plot-0 for the catalog sources.vot: column Gone is unavailable"
        });
    });

    describe("falling back when a widget's catalog is gone", () => {
        const loaded = {catalogInfo: {fileInfo: {name: "loaded.vot"}}, catalogHeader: [], getColumnHeader: () => ({dataType: CARTA.ColumnType.Double})} as any;

        /** Catalogs by image, all loaded, with image 7 in front. */
        function openCatalogs(catalogsByImage: Record<number, number[]>, activeImageFileId?: number) {
            Object.entries(catalogsByImage).forEach(([imageFileId, catalogFileIds]) =>
                catalogFileIds.forEach(catalogFileId => {
                    catalogs.catalogProfileStores.set(catalogFileId, loaded);
                    catalogs.catalogImageIds.set(catalogFileId, Number(imageFileId));
                })
            );
            const frame = activeImageFileId === undefined ? null : {frameInfo: {fileId: activeImageFileId}, spatialSiblings: []};
            jest.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame: frame, imageViewConfigStore: {visibleFrames: frame ? [frame] : []}, zIndexManager: {assignIndex: jest.fn()}} as any);
        }

        afterEach(() => {
            widgets.catalogWidgets.clear();
        });

        test("moves a plot onto a catalog on the same image it already has settings for", () => {
            openCatalogs({7: [1, 2, 3]}, 7);
            ["catalog-plot-0", "catalog-plot-1"].forEach(id => widgets.addCatalogPlotWidget(plot, id));
            bindings.register("catalog-plot-component-0", 1, "catalog-plot-0");
            bindings.register("catalog-plot-component-0", 3, "catalog-plot-1");
            bindings.show("catalog-plot-component-0", 1);

            bindings.catalogClosed(1);

            expect(bindings.catalogOf("catalog-plot-component-0")).toBe(3);
        });

        test("moves a table onto the first catalog left on the same image", () => {
            openCatalogs({7: [1, 2, 3], 8: [4]}, 8);
            widgets.getCatalogWidgetStore("catalog-overlay-0", 1);

            bindings.catalogClosed(1);

            expect(bindings.catalogOf("catalog-overlay-0")).toBe(2);
        });

        test("moves a table and a plot onto the active image when their own image has nothing left", () => {
            openCatalogs({7: [1], 8: [4, 5]}, 8);
            widgets.getCatalogWidgetStore("catalog-overlay-0", 1);
            widgets.addCatalogPlotWidget(plot, "catalog-plot-0");
            bindings.register("catalog-plot-component-0", 1, "catalog-plot-0");

            bindings.catalogClosed(1);

            expect(bindings.catalogOf("catalog-overlay-0")).toBe(4);
            expect(bindings.catalogOf("catalog-plot-component-0")).toBe(4);
        });

        test("leaves a table and a plot showing no catalog rather than one on an image not in front", () => {
            openCatalogs({7: [1], 8: [4]});
            widgets.getCatalogWidgetStore("catalog-overlay-0", 1);
            widgets.addCatalogPlotWidget(plot, "catalog-plot-0");
            bindings.register("catalog-plot-component-0", 1, "catalog-plot-0");

            bindings.catalogClosed(1);

            expect(bindings.catalogOf("catalog-overlay-0")).toBeUndefined();
            expect(bindings.catalogOf("catalog-plot-component-0")).toBeUndefined();
        });

        test("restores a table whose catalog is unavailable onto the active image, not onto any loaded catalog", () => {
            openCatalogs({8: [4], 7: [6]}, 7);
            widgets.getCatalogWidgetStore("catalog-overlay-0", 99).setWidgetId("widget-a");
            catalogs.catalogImageIds.set(6, 7);

            const issues = bindings.restore({"widget-a": {type: "catalog-overlay", catalogId: 20}}, [{id: 30, source: {type: "file", filename: "shown.vot"}}], new Map([[30, 6]]));

            expect(bindings.catalogOf("catalog-overlay-0")).toBe(6);
            expect(issues).toContainEqual({
                kind: WorkspaceItemKind.CatalogWidget,
                subject: "widget-a",
                message: "Could not restore catalog widget widget-a: workspace catalog 20 is unavailable; it is showing the catalog shown.vot instead"
            });
        });

        test("restores a table whose catalog is unavailable onto no catalog when none can be shown", () => {
            openCatalogs({8: [4]});
            widgets.getCatalogWidgetStore("catalog-overlay-0", 99).setWidgetId("widget-a");

            const issues = bindings.restore({"widget-a": {type: "catalog-overlay", catalogId: 20}}, [], new Map());

            expect(bindings.catalogOf("catalog-overlay-0")).toBeUndefined();
            expect(issues.map(issue => issue.message)).toEqual(["Could not restore catalog widget widget-a: workspace catalog 20 is unavailable"]);
        });
    });
});
