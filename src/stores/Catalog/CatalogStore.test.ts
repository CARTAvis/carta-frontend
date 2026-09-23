import {CARTA} from "carta-protobuf";
import {autorun} from "mobx";

import {CatalogOverlay, CatalogPlotType, CatalogSystemType, CatalogType, CatalogUpdateMode, WorkspaceItemKind} from "enums";
import {CatalogWebGLService} from "services";
import {AppStore, CatalogOnlineQueryProfileStore, CatalogProfileStore, CatalogStore, WidgetsStore, WorkspaceIdRegistry} from "stores";
import {type CatalogPlotWidgetConfig} from "stores/Widgets";
import {type ProcessedColumnData} from "utilities";

/** A catalog that has whatever column is asked of it, so that the plot-column validation
 * setCatalogPlots runs neither drops a column nor warns about one. */
const CreateEmptyProfileStore = () => ({getColumnHeader: () => ({dataType: CARTA.ColumnType.Double}), catalogInfo: {fileInfo: {name: "test-catalog"}}}) as any;

describe("CatalogStore.plotImageOverlay", () => {
    const catalogStore = CatalogStore.Instance;

    beforeEach(() => {
        // These tests spy on the store itself, which the next suite must not inherit.
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogGLData.clear();
        catalogStore.catalogCounts.clear();
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
        catalogStore.catalogDisplayStores.forEach(displayStore => displayStore.dispose());
        catalogStore.catalogDisplayStores.clear();
    });

    test("owns one display store for each catalog", () => {
        const displayStore = catalogStore.getOrCreateCatalogDisplayStore(1);

        expect(catalogStore.getCatalogDisplayStore(1)).toBe(displayStore);
        expect(catalogStore.getOrCreateCatalogDisplayStore(1)).toBe(displayStore);
    });

    test("does nothing for a catalog that is not loaded", () => {
        expect(catalogStore.plotImageOverlay(1)).toBe(false);
    });

    test("does nothing until the position columns have been chosen", () => {
        catalogStore.catalogProfileStores.set(1, {setUpdateMode: jest.fn()} as any);
        const widgetStore = catalogStore.getOrCreateCatalogDisplayStore(1);
        widgetStore?.setCatalogPlotType(CatalogPlotType.ImageOverlay);

        expect(widgetStore?.xAxis).toBe(CatalogOverlay.NONE);
        expect(catalogStore.plotImageOverlay(1)).toBe(false);
    });

    test("draws a restored overlay in the system it was drawn in, not the one the coordinate control names", () => {
        const names = ["RA", "DEC"];
        const catalogHeader = names.map((name, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: CARTA.ColumnType.Double, name, units: "deg"}));
        const catalogData = new Map<number, ProcessedColumnData>(names.map((name, index) => [index, {dataType: CARTA.ColumnType.Double, data: [index, index + 1]}]));
        const profileStore = new CatalogProfileStore({dataSize: 2, directory: "", fileId: 1, fileInfo: new CARTA.CatalogFileInfo({name: "test-catalog"})}, catalogHeader, catalogData, CatalogType.FILE);
        catalogStore.catalogProfileStores.set(1, profileStore);

        // The coordinate control was moved on after the overlay was drawn, which does not redraw it.
        profileStore.setCatalogCoordinateSystem(CatalogSystemType.Galactic);

        jest.spyOn(AppStore.Instance, "getFrame").mockReturnValue({isValidWcs: false, wcsInfo: 0} as any);
        jest.spyOn(AppStore.Instance, "sendCatalogFilter").mockImplementation(jest.fn());
        jest.spyOn(catalogStore, "getFrameIdByCatalogId").mockReturnValue(10);
        const convertSpy = jest.spyOn(catalogStore, "convertToImageCoordinate").mockImplementation(jest.fn());

        expect(catalogStore.plotImageOverlay(1, {xAxis: "RA", yAxis: "DEC", system: CatalogSystemType.ICRS})).toBe(true);

        expect(catalogStore.getCatalogDisplayStore(1)?.plottedImageOverlaySystem).toBe(CatalogSystemType.ICRS);
        expect(convertSpy).toHaveBeenCalledWith(1, [0, 1], [1, 2], 0, "deg", "deg", expect.objectContaining({system: CatalogSystemType.ICRS}), 0, 0, 2);
    });
});

describe("CatalogStore.convertToImageCoordinate", () => {
    const catalogStore = CatalogStore.Instance;

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogGLData.clear();
        catalogStore.catalogCounts.clear();
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
        jest.spyOn(CatalogWebGLService.Instance, "updatePositionArray").mockImplementation(jest.fn());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function plotRows(startIndex: number, count: number) {
        const xs = Array.from({length: count}, (_unused, index) => startIndex + index);
        catalogStore.convertToImageCoordinate(1, xs, xs, 0 as any, "", "", {system: CatalogSystemType.Pixel0} as any, startIndex + count, count);
    }

    test("counts the rows drawn rather than the batches delivered", () => {
        catalogStore.addCatalog(1, 10);

        plotRows(0, 4);
        plotRows(4, 3);

        expect(catalogStore.catalogCounts.get(1)).toBe(7);
    });

    test("does not inflate the count when a batch is drawn twice", () => {
        catalogStore.addCatalog(1, 10);

        plotRows(0, 4);
        plotRows(0, 4);

        // The GL layer is only ever given rows 0 to 3, so counting 8 would draw vertices that were
        // never written.
        expect(catalogStore.catalogCounts.get(1)).toBe(4);
    });

    test("stops at the row limit the overlay was drawn with", () => {
        catalogStore.addCatalog(1, 10);

        catalogStore.convertToImageCoordinate(1, [0, 1, 2, 3], [0, 1, 2, 3], 0 as any, "", "", {system: CatalogSystemType.Pixel0} as any, 4, 4, 2);

        expect(catalogStore.catalogCounts.get(1)).toBe(2);
    });
});

describe("CatalogStore workspace catalog IDs", () => {
    const widgetsStore = WidgetsStore.Instance;

    beforeEach(() => {
        // Torn down the way the app tears them down: a widget gives its hold on a catalog ID back
        // when it is deleted, and clearing the maps underneath it would leave the hold behind.
        Array.from(widgetsStore.catalogPlotWidgets.keys()).forEach(widgetId => widgetsStore.deleteCatalogPlotWidget(widgetId));
        Array.from(widgetsStore.catalogWidgets.keys()).forEach(componentId => widgetsStore.deleteCatalogWidget(componentId));
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
        CatalogStore.Instance.catalogPlots.clear();
    });

    test("reuses restored IDs and allocates the next unused ID for new catalogs", () => {
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 11, 4);

        expect(WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 11)).toBe(4);
        expect(WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 12)).toBe(1);
        expect(WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 13)).toBe(2);
    });

    test("does not hand a new catalog an ID a widget still holds for an unavailable catalog", () => {
        // A plot and a panel restored for catalogs the workspace could not load keep naming them.
        widgetsStore.addCatalogPlotWidget({xColumnName: "RA", yColumnName: "DEC", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-0", {catalogId: 1});
        widgetsStore.getCatalogWidgetStore("catalog-overlay-0", 1).setUnavailableWorkspaceCatalogId(2);

        expect(WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 11)).toBe(3);
        expect(WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 12)).toBe(4);
    });

    test("releases an unavailable catalog ID when its panel is removed", () => {
        widgetsStore.getCatalogWidgetStore("catalog-overlay-0", 1).setUnavailableWorkspaceCatalogId(1);

        widgetsStore.removeWidget("catalog-overlay-0", "catalog-overlay");

        expect(WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 11)).toBe(1);
    });

    test("releases a catalog ID when its plot is removed", () => {
        widgetsStore.addCatalogPlotWidget({xColumnName: "RA", yColumnName: "DEC", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-0", {catalogId: 1});
        CatalogStore.Instance.setCatalogPlots("catalog-plot-component-0", 5, "catalog-plot-0");

        widgetsStore.removeWidget("catalog-plot-0", "catalog-plot");

        expect(WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 11)).toBe(1);
    });
});

describe("Catalog plot workspace binding", () => {
    const catalogStore = CatalogStore.Instance;
    const widgetsStore = WidgetsStore.Instance;
    const scatterProps = {xColumnName: "RA", yColumnName: "DEC", plotType: CatalogPlotType.D2Scatter};

    /** An active image showing one catalog, which is what a plot can be bound to. */
    function showCatalog(catalogFileId: number) {
        const frame = {frameInfo: {fileId: 7}, spatialSiblings: []};
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame: frame, imageViewConfigStore: {visibleFrames: [frame]}} as any);
        catalogStore.imageAssociatedCatalogId.set(7, [catalogFileId]);
        catalogStore.catalogProfileStores.set(catalogFileId, CreateEmptyProfileStore());
    }

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogPlots.clear();
        catalogStore.catalogProfileStores.clear();
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
        catalogStore.imageAssociatedCatalogId.clear();
        widgetsStore.catalogPlotWidgets.clear();
    });

    test("saves the catalog a plot shows by its workspace ID, not by the session's catalog file ID", () => {
        showCatalog(5);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 5, 2);
        const widgetId = widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 5, widgetId as string);

        expect((widgetsStore.toWidgetSettingsConfig("catalog-plot", widgetId as string, true) as CatalogPlotWidgetConfig)?.catalogId).toBe(2);
    });

    test("leaves the session's catalogs out of a layout saved on its own", () => {
        showCatalog(5);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 5, 2);
        const widgetId = widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 5, widgetId as string);

        // A saved layout is reused against whatever is open, so an ID from this session would name
        // something unrelated there.
        const layoutConfig = widgetsStore.toWidgetSettingsConfig("catalog-plot", widgetId as string) as CatalogPlotWidgetConfig;
        expect(layoutConfig).toBeDefined();
        expect(layoutConfig.catalogId).toBeUndefined();
        expect(layoutConfig.xColumnName).toBe("RA");

        // The layout a workspace carries travels with those catalogs, so it may name them.
        expect((widgetsStore.toWidgetSettingsConfig("catalog-plot", widgetId as string, true) as CatalogPlotWidgetConfig)?.catalogId).toBe(2);
    });

    test("keeps an unavailable saved catalog ID instead of replacing it with the fallback catalog", () => {
        showCatalog(5);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 5, 2);
        const widgetId = widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0", {catalogId: 7});
        catalogStore.setCatalogPlots("catalog-plot-component-0", 5, widgetId as string);

        expect((widgetsStore.toWidgetSettingsConfig("catalog-plot", widgetId as string, true) as CatalogPlotWidgetConfig)?.catalogId).toBe(7);

        widgetsStore.catalogPlotWidgets.get(widgetId as string)?.setWorkspaceCatalogId(2);
        expect((widgetsStore.toWidgetSettingsConfig("catalog-plot", widgetId as string, true) as CatalogPlotWidgetConfig)?.catalogId).toBe(2);
    });

    test("restores a plot onto the catalog it was saved against rather than catalog file 1", () => {
        showCatalog(5);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 5, 2);

        widgetsStore.initWidgets(
            [
                {
                    id: "catalog-plot",
                    plotType: CatalogPlotType.D2Scatter,
                    props: {id: "catalog-plot-0"},
                    widgetSettings: {catalogId: 2, xColumnName: "RA", yColumnName: "DEC", plotType: CatalogPlotType.D2Scatter}
                }
            ],
            []
        );

        expect(catalogStore.getAssociatedIdByWidgetId("catalog-plot-0").catalogFileId).toBe(5);
        expect(widgetsStore.catalogPlotWidgets.get("catalog-plot-0")?.xColumnName).toBe("RA");
    });

    test("moves a plot onto its catalog, discarding the plot that catalog already held", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-1");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 1, "catalog-plot-0");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 5, "catalog-plot-1");

        expect(catalogStore.rebindCatalogPlot("catalog-plot-0", 5)).toBe(true);

        const plotWidgetIds = catalogStore.catalogPlots.get("catalog-plot-component-0")?.plotWidgetIds;
        expect(plotWidgetIds?.get(5)).toBe("catalog-plot-0");
        expect(plotWidgetIds?.has(1)).toBe(false);
        expect(widgetsStore.catalogPlotWidgets.has("catalog-plot-1")).toBe(false);
    });

    test("leaves a plot alone when it already shows the catalog it was saved against", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 5, "catalog-plot-0");

        expect(catalogStore.rebindCatalogPlot("catalog-plot-0", 5)).toBe(false);
        expect(catalogStore.getCatalogPlotWidgetId("catalog-plot-component-0", 5)).toBe("catalog-plot-0");
    });

    test("serializes the currently active plot store after switching from catalog A to catalog B and restores it correctly", () => {
        // Setup Catalog A (fileId 1, workspaceId 10) and Catalog B (fileId 2, workspaceId 20)
        const frame = {frameInfo: {fileId: 7}, spatialSiblings: []};
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame: frame, imageViewConfigStore: {visibleFrames: [frame]}} as any);
        catalogStore.imageAssociatedCatalogId.set(7, [1, 2]);
        catalogStore.catalogProfileStores.set(1, CreateEmptyProfileStore());
        catalogStore.catalogProfileStores.set(2, CreateEmptyProfileStore());
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 1, 10);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 2, 20);

        // Component catalog-plot-component-0 initially shows Catalog A with "catalog-plot-0"
        const plotStoreAId = widgetsStore.addCatalogPlotWidget({xColumnName: "RA_A", yColumnName: "DEC_A", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-0");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 1, plotStoreAId as string);

        // User switches component to Catalog B and configures a new plot store "catalog-plot-1"
        const plotStoreBId = widgetsStore.addCatalogPlotWidget({xColumnName: "FLUX_B", yColumnName: "MAG_B", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-1");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 2, plotStoreBId as string);
        catalogStore.selectCatalogPlotFile("catalog-plot-component-0", 2);

        // Verify that saving the layout widget (referenced by original tab instance id "catalog-plot-0")
        // serializes Catalog B's workspace ID and Catalog B's settings together
        const savedConfig = widgetsStore.toWidgetSettingsConfig("catalog-plot", "catalog-plot-0", true) as CatalogPlotWidgetConfig;
        expect(savedConfig).toBeDefined();
        expect(savedConfig.catalogId).toBe(20);
        expect(savedConfig.xColumnName).toBe("FLUX_B");
        expect(savedConfig.yColumnName).toBe("MAG_B");

        // Now verify restore: restoring the saved config applies Catalog B's ID and settings
        widgetsStore.catalogPlotWidgets.clear();
        catalogStore.catalogPlots.clear();

        widgetsStore.initWidgets(
            [
                {
                    id: "catalog-plot",
                    plotType: CatalogPlotType.D2Scatter,
                    props: {id: "catalog-plot-0"},
                    widgetSettings: savedConfig
                }
            ],
            []
        );

        // Restored plot is bound to Catalog B (fileId 2) with Catalog B's settings
        expect(catalogStore.getAssociatedIdByWidgetId("catalog-plot-0").catalogFileId).toBe(2);
        const restoredStore = widgetsStore.catalogPlotWidgets.get("catalog-plot-0");
        expect(restoredStore?.xColumnName).toBe("FLUX_B");
        expect(restoredStore?.yColumnName).toBe("MAG_B");
        expect(restoredStore?.workspaceCatalogId).toBe(20);
    });

    test("switching from A to B and back to A serializes catalog A's plot settings with catalog A's workspace ID", () => {
        showCatalog(1);
        catalogStore.catalogProfileStores.set(2, CreateEmptyProfileStore());
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 1, 10);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 2, 20);

        const plotStoreAId = widgetsStore.addCatalogPlotWidget({xColumnName: "RA_A", yColumnName: "DEC_A", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-0");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 1, plotStoreAId as string);

        const plotStoreBId = widgetsStore.addCatalogPlotWidget({xColumnName: "FLUX_B", yColumnName: "MAG_B", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-1");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 2, plotStoreBId as string);

        // Switch to B then back to A
        catalogStore.selectCatalogPlotFile("catalog-plot-component-0", 2);
        catalogStore.selectCatalogPlotFile("catalog-plot-component-0", 1);

        const savedConfig = widgetsStore.toWidgetSettingsConfig("catalog-plot", "catalog-plot-0", true) as CatalogPlotWidgetConfig;
        expect(savedConfig).toBeDefined();
        expect(savedConfig.catalogId).toBe(10);
        expect(savedConfig.xColumnName).toBe("RA_A");
        expect(savedConfig.yColumnName).toBe("DEC_A");
    });

    test("saves a plot against the catalog the user picked, not the unavailable one it fell back from", () => {
        // Catalog A (workspace ID 10) is not loaded, so a plot restored for it falls back to catalog B.
        showCatalog(2);
        catalogStore.catalogProfileStores.set(3, CreateEmptyProfileStore());
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 2, 20);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 3, 30);

        const plotStoreId = widgetsStore.addCatalogPlotWidget({xColumnName: "RA_A", yColumnName: "DEC_A", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-0", {catalogId: 10});
        catalogStore.setCatalogPlots("catalog-plot-component-0", 2, plotStoreId as string);

        // The fallback is automatic, so catalog A's ID is still the one that would be saved.
        expect((widgetsStore.toWidgetSettingsConfig("catalog-plot", "catalog-plot-0", true) as CatalogPlotWidgetConfig)?.catalogId).toBe(10);

        // The user picks catalog C, then picks catalog B back.
        const plotStoreCId = widgetsStore.addCatalogPlotWidget({xColumnName: "FLUX_C", yColumnName: "MAG_C", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-1");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 3, plotStoreCId as string);
        catalogStore.selectCatalogPlotFile("catalog-plot-component-0", 3);
        catalogStore.selectCatalogPlotFile("catalog-plot-component-0", 2);

        const savedConfig = widgetsStore.toWidgetSettingsConfig("catalog-plot", "catalog-plot-0", true) as CatalogPlotWidgetConfig;
        expect(savedConfig).toBeDefined();
        expect(savedConfig.catalogId).toBe(20);
        expect(savedConfig.xColumnName).toBe("RA_A");
        expect(savedConfig.yColumnName).toBe("DEC_A");

        // The plot the user visited on the way belongs to catalog C.
        expect(widgetsStore.catalogPlotWidgets.get("catalog-plot-1")?.workspaceCatalogId).toBe(30);
    });
});

describe("CatalogProfileStore streamed rows", () => {
    test("makes values computed from a column see the rows that arrive later", () => {
        const names = ["RA", "DEC"];
        const catalogHeader = names.map((name, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: CARTA.ColumnType.Double, name}));
        const catalogData = new Map<number, ProcessedColumnData>(names.map((name, index) => [index, {dataType: CARTA.ColumnType.Double, data: [index, index + 1]}]));
        const store = new CatalogProfileStore({dataSize: 4, directory: "", fileId: 1, fileInfo: new CARTA.CatalogFileInfo({name: "test-catalog"})}, catalogHeader, catalogData, CatalogType.FILE);

        // Observed, so that a value computed from the column is cached the way the overlay's mapped
        // arrays are: it only recomputes if the data it read is marked as changed.
        const observedLengths: number[] = [];
        const dispose = autorun(() => observedLengths.push(store.get1DPlotData("RA").wcsData?.length ?? 0));
        expect(observedLengths).toEqual([2]);

        store.updateCatalogData(
            new CARTA.CatalogFilterResponse({fileId: 1, subsetDataSize: 2, subsetEndIndex: 4, requestEndIndex: 4, filterDataSize: 4}),
            new Map<number, ProcessedColumnData>([
                [0, {dataType: CARTA.ColumnType.Double, data: [2, 3]}],
                [1, {dataType: CARTA.ColumnType.Double, data: [3, 4]}]
            ])
        );

        expect(observedLengths).toEqual([2, 4]);
        dispose();
    });
});

describe("WidgetsStore.setCatalogWidgetSelection", () => {
    const catalogStore = CatalogStore.Instance;
    const widgetsStore = WidgetsStore.Instance;

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogGLData.clear();
        catalogStore.catalogCounts.clear();
        catalogStore.catalogDisplayStores.forEach(displayStore => displayStore.dispose?.());
        catalogStore.catalogDisplayStores.clear();
        widgetsStore.catalogWidgets.clear();
    });

    test("changes only the requested component when selecting by runtime ID", () => {
        catalogStore.catalogProfileStores.set(1, CreateEmptyProfileStore());
        catalogStore.catalogProfileStores.set(2, CreateEmptyProfileStore());
        WidgetsStore.Instance.getCatalogWidgetStore("catalog-overlay-0", 1);
        WidgetsStore.Instance.getCatalogWidgetStore("catalog-overlay-1", 1);

        expect(widgetsStore.setCatalogWidgetSelection("catalog-overlay-0", 2)).toBe(true);
        expect(widgetsStore.catalogWidgets.get("catalog-overlay-0")?.selectedCatalogId).toBe(2);
        expect(widgetsStore.catalogWidgets.get("catalog-overlay-1")?.selectedCatalogId).toBe(1);
    });

    test("restores multiple panels that show the same catalog", () => {
        catalogStore.catalogProfileStores.set(1, CreateEmptyProfileStore());

        widgetsStore.initWidgets(
            [
                {id: "catalog-overlay", props: {id: "catalog-overlay-0"}, widgetSettings: {catalogFileId: 1}},
                {id: "catalog-overlay", props: {id: "catalog-overlay-1"}, widgetSettings: {catalogFileId: 1}}
            ],
            []
        );

        expect(Array.from(widgetsStore.catalogWidgets.keys())).toEqual(["catalog-overlay-0", "catalog-overlay-1"]);
        expect(Array.from(widgetsStore.catalogWidgets.values()).map(widgetStore => widgetStore.selectedCatalogId)).toEqual([1, 1]);
    });

    test("recreates workspace panels that are absent from the current layout", () => {
        const widgetStore = widgetsStore.getCatalogWidgetStore("catalog-overlay-0", 1);
        widgetStore.setWidgetId("catalog-panel-primary");
        const initialFloatingWidgetIds = new Set(widgetsStore.floatingWidgets.map(widget => widget.id));

        widgetsStore.restoreCatalogPanels(["catalog-panel-primary", "catalog-panel-secondary"]);

        expect(Array.from(widgetsStore.catalogWidgets.values()).map(store => store.widgetId)).toEqual(["catalog-panel-primary", "catalog-panel-secondary"]);
        const restoredWidget = widgetsStore.floatingWidgets.find(widget => !initialFloatingWidgetIds.has(widget.id));
        expect(restoredWidget?.type).toBe("catalog-overlay");
        if (restoredWidget) {
            widgetsStore.removeFloatingWidget(restoredWidget.id);
        }
    });

    test("restores a catalog by the panel's stable ID after its component ID changes", () => {
        catalogStore.catalogProfileStores.set(1, CreateEmptyProfileStore());
        catalogStore.catalogProfileStores.set(2, CreateEmptyProfileStore());
        const widgetStore = WidgetsStore.Instance.getCatalogWidgetStore("catalog-overlay-0", 1);
        widgetStore.setWidgetId("catalog-panel-primary");

        expect(widgetsStore.setCatalogWidgetSelectionByWidgetId("catalog-panel-primary", 2)).toBe(true);
        expect(widgetStore.selectedCatalogId).toBe(2);
    });

    test("does not confuse a stable panel ID with another panel's runtime component ID", () => {
        catalogStore.catalogProfileStores.set(1, CreateEmptyProfileStore());
        catalogStore.catalogProfileStores.set(2, CreateEmptyProfileStore());
        const stableWidget = widgetsStore.getCatalogWidgetStore("catalog-overlay-0", 1);
        const runtimeWidget = widgetsStore.getCatalogWidgetStore("catalog-overlay-1", 1);
        stableWidget.setWidgetId("catalog-overlay-1");
        runtimeWidget.setWidgetId("catalog-panel-secondary");

        expect(widgetsStore.setCatalogWidgetSelection("catalog-overlay-1", 2)).toBe(true);
        expect(stableWidget.selectedCatalogId).toBe(1);
        expect(runtimeWidget.selectedCatalogId).toBe(2);

        expect(widgetsStore.setCatalogWidgetSelectionByWidgetId("catalog-overlay-1", 2)).toBe(true);
        expect(stableWidget.selectedCatalogId).toBe(2);
    });

    test("replaces a removed catalog in every panel that was showing it", () => {
        widgetsStore.getCatalogWidgetStore("catalog-overlay-0", 1);
        widgetsStore.getCatalogWidgetStore("catalog-overlay-1", 1);

        widgetsStore.replaceCatalogWidgetSelection(1, 2);

        expect(widgetsStore.catalogWidgets.get("catalog-overlay-0")?.selectedCatalogId).toBe(2);
        expect(widgetsStore.catalogWidgets.get("catalog-overlay-1")?.selectedCatalogId).toBe(2);
    });

    test("keeps panel persistence IDs unique when a layout contains duplicates", () => {
        widgetsStore.initWidgets(
            [
                {id: "catalog-overlay", props: {id: "catalog-overlay-0"}, widgetSettings: {panelId: "catalog-panel-primary"}},
                {id: "catalog-overlay", props: {id: "catalog-overlay-1"}, widgetSettings: {panelId: "catalog-panel-primary"}}
            ],
            []
        );

        const widgetIds = Array.from(widgetsStore.catalogWidgets.values()).map(widgetStore => widgetStore.widgetId);
        expect(new Set(widgetIds).size).toBe(widgetIds.length);
    });
});

describe("Catalog panel selection lifecycle", () => {
    const catalogStore = CatalogStore.Instance;
    const widgetsStore = WidgetsStore.Instance;

    beforeEach(() => {
        catalogStore.imageAssociatedCatalogId.clear();
        widgetsStore.catalogWidgets.clear();
    });

    test("preserves a valid selection and falls back invalid panels to the active image", () => {
        widgetsStore.getCatalogWidgetStore("catalog-overlay-0", 2);
        widgetsStore.getCatalogWidgetStore("catalog-overlay-1", 99);
        catalogStore.imageAssociatedCatalogId.set(7, [2, 3]);

        catalogStore.resetActiveCatalogFile(7);

        expect(widgetsStore.catalogWidgets.get("catalog-overlay-0")?.selectedCatalogId).toBe(2);
        expect(widgetsStore.catalogWidgets.get("catalog-overlay-1")?.selectedCatalogId).toBe(2);
    });
});

describe("CatalogProfileStore.ensureColumnsRequested", () => {
    /** A catalog with more columns than it displays by default. */
    function createProfileStore(): CatalogProfileStore {
        const names = ["Name", "RA", "DEC", "Fmag", "Bmag", "Vmag", "PA", "Dist", "Note", "Ref", "Extra"];
        const catalogHeader = names.map((name, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: CARTA.ColumnType.Double, name}));
        const store = new CatalogProfileStore({dataSize: 200, directory: "", fileId: 1, fileInfo: new CARTA.CatalogFileInfo({name: "test-catalog"})}, catalogHeader, new Map(), CatalogType.FILE);
        names.forEach(name => store.setHeaderDisplay(name === "Name", name));
        store.setUserFilter(new CARTA.CatalogFilterRequest({columnIndices: store.columnIndices}));
        return store;
    }

    test("adds mapped columns that are not displayed to the request", () => {
        const store = createProfileStore();
        expect(store.catalogFilterRequest.columnIndices).toEqual([0]);

        expect(store.ensureColumnsRequested(["RA", "DEC"])).toBe(true);

        expect(store.catalogFilterRequest.columnIndices).toEqual([0, 1, 2]);
    });

    test("leaves the request alone when every column is already asked for", () => {
        const store = createProfileStore();
        store.ensureColumnsRequested(["RA", "DEC"]);

        expect(store.ensureColumnsRequested(["Name", "RA", "DEC"])).toBe(false);
        expect(store.catalogFilterRequest.columnIndices).toEqual([0, 1, 2]);
    });

    test("leaves a column the table hides hidden", () => {
        const store = createProfileStore();

        store.ensureColumnsRequested(["RA", "DEC"]);

        // Asked for, so the rows carry them; still hidden, because the overlay needing a column is
        // not a reason to put it back in the table the user arranged.
        expect(store.catalogFilterRequest.columnIndices).toEqual([0, 1, 2]);
        expect(store.displayedColumnHeaders.map(header => header.name)).toEqual(["Name"]);
        expect(store.toTableConfig().displayedColumns).toEqual(["Name"]);
    });
});

describe("CatalogStore.restoreCatalogFromWorkspace", () => {
    const catalogStore = CatalogStore.Instance;
    const names = ["RA", "DEC", "FLUX"];
    const catalogHeader = names.map((name, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: CARTA.ColumnType.Double, name, units: "deg"}));
    const overlay = {xAxis: "RA", yAxis: "DEC", system: CatalogSystemType.ICRS};
    let sendCatalogFilter: jest.SpyInstance;

    function catalogData(): Map<number, ProcessedColumnData> {
        return new Map<number, ProcessedColumnData>(names.map((name, index) => [index, {dataType: CARTA.ColumnType.Double, data: [index, index + 1]}]));
    }

    /** A file-based catalog as it is right after being opened: showing a preview of its first rows. */
    function openFileCatalog(dataSize: number): CatalogProfileStore {
        const profileStore = new CatalogProfileStore({dataSize, directory: "", fileId: 1, fileInfo: new CARTA.CatalogFileInfo({name: "test-catalog"})}, catalogHeader, catalogData(), CatalogType.FILE);
        catalogStore.catalogProfileStores.set(1, profileStore);
        return profileStore;
    }

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogGLData.clear();
        catalogStore.catalogCounts.clear();
        catalogStore.catalogDisplayStores.forEach(displayStore => displayStore.dispose());
        catalogStore.catalogDisplayStores.clear();
        jest.spyOn(AppStore.Instance, "getFrame").mockReturnValue({isValidWcs: false, wcsInfo: 0} as any);
        jest.spyOn(catalogStore, "getFrameIdByCatalogId").mockReturnValue(10);
        jest.spyOn(catalogStore, "convertToImageCoordinate").mockImplementation(jest.fn());
        sendCatalogFilter = jest.spyOn(AppStore.Instance, "sendCatalogFilter").mockImplementation(jest.fn());
    });

    test("does nothing for a catalog that is not loaded", () => {
        expect(catalogStore.restoreCatalogFromWorkspace(1, overlay)).toBe(false);
        expect(sendCatalogFilter).not.toHaveBeenCalled();
    });

    test("drops the preview rows and asks for the catalog again from its first row", () => {
        const profileStore = openFileCatalog(200);
        profileStore.setColumnFilter("> 1", "FLUX");
        profileStore.setSortingInfo("RA", CARTA.SortingType.Ascending);
        // The rows the catalog opened with were read before those were applied.
        expect(profileStore.subsetEndIndex).toBe(50);

        expect(catalogStore.restoreCatalogFromWorkspace(1, overlay)).toBe(true);

        expect(profileStore.numVisibleRows).toBe(0);
        expect(profileStore.subsetEndIndex).toBe(0);
        expect(profileStore.updateMode).toBe(CatalogUpdateMode.ViewUpdate);
        expect(sendCatalogFilter).toHaveBeenCalledTimes(1);
        const filter = sendCatalogFilter.mock.calls[0][0];
        expect(filter.subsetStartIndex).toBe(0);
        expect(filter.subsetDataSize).toBe(200);
        expect(filter.sortColumn).toBe("RA");
        expect(filter.filterConfigs).toHaveLength(1);
        expect(catalogStore.getCatalogDisplayStore(1)?.plottedImageOverlayXAxis).toBe("RA");
    });

    test("uses the saved overlay row limit independently of the table row limit", () => {
        openFileCatalog(200);
        const displayStore = catalogStore.getOrCreateCatalogDisplayStore(1);
        const convertSpy = jest.spyOn(catalogStore, "convertToImageCoordinate").mockImplementation(jest.fn());

        expect(catalogStore.restoreCatalogFromWorkspace(1, {...overlay, maxRows: 3})).toBe(true);

        expect(displayStore.plottedImageOverlayMaxRows).toBe(3);
        expect(convertSpy).not.toHaveBeenCalled();
        expect(sendCatalogFilter.mock.calls[0][0].subsetDataSize).toBe(200);
    });

    test("requests enough rows for a larger overlay while keeping the table limit", () => {
        const profileStore = openFileCatalog(200);
        profileStore.setMaxRows(100);

        expect(catalogStore.restoreCatalogFromWorkspace(1, {...overlay, maxRows: 200})).toBe(true);

        expect(profileStore.maxRows).toBe(100);
        expect(sendCatalogFilter.mock.calls[0][0].subsetDataSize).toBe(200);

        profileStore.updateCatalogData(new CARTA.CatalogFilterResponse({subsetDataSize: 200, subsetEndIndex: 200, requestEndIndex: 200, filterDataSize: 200}), new Map());
        expect(profileStore.numVisibleRows).toBe(100);
        expect(profileStore.subsetEndIndex).toBe(200);
    });

    test("limits every streamed overlay batch to the saved overlay row limit", () => {
        jest.spyOn(catalogStore, "convertToImageCoordinate").mockRestore();
        const updatePositionArray = jest.spyOn(CatalogWebGLService.Instance, "updatePositionArray").mockImplementation(jest.fn());
        catalogStore.addCatalog(1, 10);
        expect(catalogStore.catalogGLData.has(1)).toBe(true);

        catalogStore.convertToImageCoordinate(1, [10, 11, 12], [20, 21, 22], 0 as any, "", "", {system: CatalogSystemType.Pixel0, equinox: undefined, epoch: undefined}, 2, 3, 2);

        expect(Array.from(catalogStore.catalogGLData.get(1)?.x ?? [])).toEqual([10, 11, 0, 0, 0, 0, 0, 0, 0, 0]);
        expect(updatePositionArray).toHaveBeenCalledWith(1, expect.any(Float32Array), 0);
        expect(updatePositionArray.mock.calls[0][1]).toHaveLength(4);
    });

    test("resolves a workspace restore only after the final catalog response", async () => {
        openFileCatalog(200);
        sendCatalogFilter.mockReturnValue(1);

        expect(catalogStore.restoreCatalogFromWorkspace(1, undefined, true)).toBe(true);
        let isSettled = false;
        const completion = catalogStore.catalogRequests.wait(1).then(result => {
            isSettled = result.success;
            return result;
        });

        await Promise.resolve();
        expect(isSettled).toBe(false);

        catalogStore.catalogRequests.finish(1, true);
        await expect(completion).resolves.toEqual({success: true});
        expect(isSettled).toBe(true);
    });

    test("keeps refusing a closed catalog's responses once its file ID is opened again", () => {
        jest.spyOn(AppStore.Instance, "getFrame").mockReturnValue(undefined as any);
        jest.spyOn(CatalogWebGLService.Instance, "clearTexture").mockImplementation(jest.fn());
        openFileCatalog(200);
        expect(catalogStore.restoreCatalogFromWorkspace(1, undefined, true)).toBe(true);
        catalogStore.catalogRequests.attach(1, 4);

        catalogStore.removeCatalog(1);
        // The lowest free file ID is handed to the next catalog opened, which has not yet asked for
        // anything of its own.
        openFileCatalog(200);

        expect(catalogStore.catalogRequests.accepts(1, 4)).toBe(false);
        catalogStore.catalogRequests.failAll("test cleanup");
    });

    test("cleans loading state when a restore fails", async () => {
        const profileStore = openFileCatalog(200);
        sendCatalogFilter.mockReturnValue(1);

        expect(catalogStore.restoreCatalogFromWorkspace(1, undefined, true)).toBe(true);
        const completion = catalogStore.catalogRequests.wait(1);
        expect(profileStore.isLoadingData).toBe(true);
        expect(profileStore.isUpdatingDataStream).toBe(true);

        catalogStore.catalogRequests.finish(1, false, "catalog request failed");

        await expect(completion).resolves.toEqual({success: false, message: "catalog request failed"});
        expect(profileStore.isLoadingData).toBe(false);
        expect(profileStore.isUpdatingDataStream).toBe(false);
    });

    test("uses an idle timeout that is refreshed by catalog responses", async () => {
        jest.useFakeTimers();
        try {
            openFileCatalog(200);
            sendCatalogFilter.mockReturnValue(1);
            expect(catalogStore.restoreCatalogFromWorkspace(1, undefined, true)).toBe(true);
            const completion = catalogStore.catalogRequests.wait(1);

            jest.advanceTimersByTime(29_999);
            catalogStore.catalogRequests.noteProgress(1);
            jest.advanceTimersByTime(29_999);
            expect(jest.getTimerCount()).toBeGreaterThan(0);

            jest.advanceTimersByTime(1);
            await expect(completion).resolves.toEqual({success: false, message: "Timed out waiting for catalog data"});
        } finally {
            jest.useRealTimers();
        }
    });

    test("asks for a column the overlay is mapped from even when the saved table hides it", () => {
        openFileCatalog(200).setDisplayedColumns(["FLUX"]);

        expect(catalogStore.restoreCatalogFromWorkspace(1, overlay)).toBe(true);

        expect(sendCatalogFilter.mock.calls[0][0].columnIndices).toEqual([0, 1, 2]);
    });

    test("requests the selection identity columns and every row needed to find it", () => {
        const profileStore = openFileCatalog(200);
        profileStore.setDisplayedColumns(["RA"]);

        expect(catalogStore.restoreCatalogFromWorkspace(1, undefined, false, {columns: ["FLUX"], rowHashes: ["selected-row"], searchRows: 125})).toBe(true);

        expect(sendCatalogFilter.mock.calls[0][0].columnIndices).toEqual([0, 2]);
        expect(sendCatalogFilter.mock.calls[0][0].subsetStartIndex).toBe(0);
        expect(sendCatalogFilter.mock.calls[0][0].subsetDataSize).toBe(125);
        expect(profileStore.displayedColumnHeaders.map(header => header.name)).toEqual(["RA"]);
    });

    test("restores the table alone when no overlay was saved", () => {
        const profileStore = openFileCatalog(200);

        expect(catalogStore.restoreCatalogFromWorkspace(1)).toBe(true);

        expect(profileStore.updateMode).toBe(CatalogUpdateMode.TableUpdate);
        expect(sendCatalogFilter.mock.calls[0][0].subsetStartIndex).toBe(0);
    });

    test("draws an online catalog without asking for its rows again", () => {
        catalogStore.catalogProfileStores.set(1, new CatalogOnlineQueryProfileStore({dataSize: 2, directory: "", fileId: 1, fileInfo: new CARTA.CatalogFileInfo({name: "simbad"})}, catalogHeader, catalogData(), CatalogType.SIMBAD));

        expect(catalogStore.restoreCatalogFromWorkspace(1, overlay)).toBe(true);

        expect(sendCatalogFilter).not.toHaveBeenCalled();
        expect(catalogStore.getCatalogDisplayStore(1)?.plottedImageOverlayXAxis).toBe("RA");
    });
});

describe("Catalog plot component selection", () => {
    const catalogStore = CatalogStore.Instance;
    const widgetsStore = WidgetsStore.Instance;
    const scatterProps = {xColumnName: "RA", yColumnName: "DEC", plotType: CatalogPlotType.D2Scatter};

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogPlots.clear();
        catalogStore.catalogProfileStores.clear();
        catalogStore.imageAssociatedCatalogId.clear();
        widgetsStore.catalogPlotWidgets.clear();
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
    });

    test("shows the first catalog it was pointed at", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 5, "catalog-plot-0");

        expect(catalogStore.getActiveCatalogPlotFile("catalog-plot-component-0")).toBe(5);
        expect(catalogStore.getCatalogPlotWidgetId("catalog-plot-component-0", 5)).toBe("catalog-plot-0");
    });

    test("keeps showing the catalog it is on when another one is added", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-1");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 5, "catalog-plot-0");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 6, "catalog-plot-1");

        expect(catalogStore.getActiveCatalogPlotFile("catalog-plot-component-0")).toBe(5);
    });

    test("follows a plot moved onto the catalog a workspace saved it against", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 5, "catalog-plot-0");

        expect(catalogStore.rebindCatalogPlot("catalog-plot-0", 6)).toBe(true);

        // The component reads its selection from here, so a restore moves it without its help.
        expect(catalogStore.getActiveCatalogPlotFile("catalog-plot-component-0")).toBe(6);
        expect(catalogStore.getCatalogPlotWidgetId("catalog-plot-component-0", 6)).toBe("catalog-plot-0");
    });

    test("moves onto whatever is left when the catalog it was showing is closed", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-1");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 5, "catalog-plot-0");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 6, "catalog-plot-1");

        catalogStore.clearCatalogPlotsByFileId(5);

        expect(catalogStore.getActiveCatalogPlotFile("catalog-plot-component-0")).toBe(6);
    });

    test("moves onto another loaded catalog even when it does not have a plot store yet", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 5, "catalog-plot-0");
        catalogStore.imageAssociatedCatalogId.set(7, [5, 6]);
        catalogStore.catalogProfileStores.set(5, CreateEmptyProfileStore());
        catalogStore.catalogProfileStores.set(6, CreateEmptyProfileStore());

        catalogStore.clearCatalogPlotsByFileId(5);

        expect(catalogStore.getActiveCatalogPlotFile("catalog-plot-component-0")).toBe(6);
    });

    test("moves onto a catalog of the image now in front", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        catalogStore.setCatalogPlots("catalog-plot-component-0", 5, "catalog-plot-0");
        catalogStore.imageAssociatedCatalogId.set(7, [8, 9]);

        catalogStore.resetActiveCatalogFile(7);

        expect(catalogStore.getActiveCatalogPlotFile("catalog-plot-component-0")).toBe(8);
    });
});

describe("CatalogStore widget selection", () => {
    const catalogStore = CatalogStore.Instance;
    const widgetsStore = WidgetsStore.Instance;

    afterEach(() => {
        catalogStore.imageAssociatedCatalogId.clear();
        widgetsStore.catalogWidgets.clear();
    });

    test("resets an unavailable widget selection to the first active catalog", () => {
        catalogStore.updateImageAssociatedCatalogId(101, [7, 8]);
        const widget = widgetsStore.getCatalogWidgetStore("catalog-widget-0", 99);

        catalogStore.resetActiveCatalogFile(101);

        expect(widget.selectedCatalogId).toBe(7);
    });

    test("moves a widget onto a catalog the image still has when the one it showed is closed", () => {
        catalogStore.updateImageAssociatedCatalogId(103, [7, 8]);
        jest.spyOn(AppStore.Instance, "getFrame").mockReturnValue({frameInfo: {fileId: 103}} as any);
        jest.spyOn(catalogStore, "getFrameIdByCatalogId").mockReturnValue(103);
        jest.spyOn(CatalogWebGLService.Instance, "clearTexture").mockImplementation(jest.fn());
        const widget = widgetsStore.getCatalogWidgetStore("catalog-widget-0", 7);

        catalogStore.removeCatalog(7, "catalog-widget-0");

        expect(widget.selectedCatalogId).toBe(8);
    });

    test("preserves each widget selection when it remains active", () => {
        catalogStore.updateImageAssociatedCatalogId(102, [7, 8]);
        const firstWidget = widgetsStore.getCatalogWidgetStore("catalog-widget-0", 7);
        const secondWidget = widgetsStore.getCatalogWidgetStore("catalog-widget-1", 8);

        catalogStore.resetActiveCatalogFile(102);

        expect(firstWidget.selectedCatalogId).toBe(7);
        expect(secondWidget.selectedCatalogId).toBe(8);
    });
});
