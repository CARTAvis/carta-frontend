import {CARTA} from "carta-protobuf";
import {autorun, runInAction} from "mobx";

import {CatalogOverlay, CatalogPlotType, CatalogSystemType, CatalogType, CatalogUpdateMode, ImageType, PreferenceKeys, WorkspaceItemKind} from "enums";
import {CatalogWebGLService} from "services";
import {AppStore, CatalogOnlineQueryProfileStore, CatalogProfileStore, CatalogStore, PreferenceStore, WidgetsStore, WorkspaceIdRegistry} from "stores";
import {type ProcessedColumnData} from "utilities";

// These tests open, draw and bind catalogs rather than choose their overlay axes, and their catalogs carry nothing that
// choosing reads. Choosing is covered by CatalogDisplayStoreAxes.test.ts.
let shouldAutoSelectOriginally: boolean;
beforeAll(() => {
    shouldAutoSelectOriginally = PreferenceStore.Instance.shouldAutoSelectImageOverlayCoordinateColumns;
    PreferenceStore.Instance.setPreference(PreferenceKeys.CATALOG_AUTO_SELECT_IMAGE_OVERLAY_COLUMNS, false);
});
afterAll(() => {
    PreferenceStore.Instance.setPreference(PreferenceKeys.CATALOG_AUTO_SELECT_IMAGE_OVERLAY_COLUMNS, shouldAutoSelectOriginally);
});

/** A catalog that has whatever column is asked of it, so that the plot-column validation
 * register runs neither drops a column nor warns about one. */
const CreateEmptyProfileStore = () => ({getColumnHeader: () => ({dataType: CARTA.ColumnType.Double}), catalogInfo: {fileInfo: {name: "test-catalog"}}}) as any;

/** Restore what a Workspace saved for one plot, by the plot's stable ID. */
function restorePlotBinding(widgetId: string, workspaceCatalogId: number, catalogFileId: number) {
    return CatalogStore.Instance.widgetBindings.restore(
        {[widgetId]: {type: "catalog-plot", catalogId: workspaceCatalogId}},
        [{id: workspaceCatalogId, source: {type: "file", filename: "test-catalog"}}],
        new Map([[workspaceCatalogId, catalogFileId]])
    );
}

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
        jest.spyOn(catalogStore, "imageIdOf").mockReturnValue(10);
        const convertSpy = jest.spyOn(catalogStore, "convertToImageCoordinate").mockImplementation(jest.fn());

        expect(catalogStore.plotImageOverlay(1, {xAxis: "RA", yAxis: "DEC", system: CatalogSystemType.ICRS})).toBe(true);

        expect(catalogStore.getCatalogDisplayStore(1)?.plottedImageOverlaySystem).toBe(CatalogSystemType.ICRS);
        expect(convertSpy).toHaveBeenCalledWith(1, [0, 1], [1, 2], 0, "deg", "deg", expect.objectContaining({system: CatalogSystemType.ICRS}), 0, 0, 2);
    });

    test("reports an overlay whose columns a re-run query no longer returns as not drawn", () => {
        // An online catalog holds every row it is ever going to, so columns that are not there now
        // are not coming. The saved overlay named RA and DEC; this query came back with neither.
        const names = ["main_id", "dist"];
        const catalogHeader = names.map((name, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: CARTA.ColumnType.Double, name, units: "deg"}));
        const catalogData = new Map<number, ProcessedColumnData>(names.map((name, index) => [index, {dataType: CARTA.ColumnType.Double, data: [index, index + 1]}]));
        catalogStore.catalogProfileStores.set(1, new CatalogOnlineQueryProfileStore({dataSize: 2, directory: "", fileId: 1, fileInfo: new CARTA.CatalogFileInfo({name: "simbad"})}, catalogHeader, catalogData, CatalogType.SIMBAD));

        jest.spyOn(AppStore.Instance, "getFrame").mockReturnValue({isValidWcs: false, wcsInfo: 0} as any);
        jest.spyOn(catalogStore, "imageIdOf").mockReturnValue(10);
        const convertSpy = jest.spyOn(catalogStore, "convertToImageCoordinate").mockImplementation(jest.fn());

        expect(catalogStore.plotImageOverlay(1, {xAxis: "RA", yAxis: "DEC", system: CatalogSystemType.ICRS})).toBe(false);

        expect(convertSpy).not.toHaveBeenCalled();
        // And the catalog is not left claiming an overlay that has no points in it.
        expect(catalogStore.getCatalogDisplayStore(1)?.hasPlottedImageOverlay).toBe(false);
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

describe("CatalogStore.open", () => {
    const catalogStore = CatalogStore.Instance;
    const frame = {frameInfo: {fileId: 7}} as any;
    const opened: number[] = [];
    let initialFloatingWidgetIds = new Set<string>();

    /** A catalog's rows, as a source would build them for the ID it was given. */
    const rowsFor = (fileId: number) => ({...CreateEmptyProfileStore(), catalogInfo: {fileId, dataSize: 3, fileInfo: {name: "test-catalog"}}, isFileBasedCatalog: true}) as any;

    async function open(load: (fileId: number) => Promise<any>): Promise<number | undefined> {
        const fileId = await catalogStore.open(frame, load);
        if (fileId !== undefined) {
            opened.push(fileId);
        }
        return fileId;
    }

    beforeEach(() => {
        jest.spyOn(AppStore.Instance, "getFrame").mockImplementation(fileId => (fileId === 7 ? frame : undefined));
        catalogStore.catalogProfileStores.clear();
        WidgetsStore.Instance.catalogWidgets.clear();
        initialFloatingWidgetIds = new Set(WidgetsStore.Instance.floatingWidgets.map(widget => widget.id));
    });

    afterEach(() => {
        opened.splice(0).forEach(fileId => {
            catalogStore.removeCatalogDisplayStore(fileId);
            catalogStore.catalogGLData.delete(fileId);
            WorkspaceIdRegistry.Instance.release(WorkspaceItemKind.Catalog, fileId);
        });
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogImageIds.clear();
        WidgetsStore.Instance.catalogWidgets.clear();
        WidgetsStore.Instance.floatingWidgets.filter(widget => !initialFloatingWidgetIds.has(widget.id)).forEach(widget => WidgetsStore.Instance.removeFloatingWidget(widget.id));
        jest.restoreAllMocks();
    });

    test("sets up a loaded catalog on the image it was given, not the active one", async () => {
        WidgetsStore.Instance.getCatalogWidgetStore("catalog-overlay-0", 99);
        expect(AppStore.Instance.activeFrame).toBeFalsy();

        const fileId = await open(async id => rowsFor(id));

        expect(fileId).toBe(1);
        expect(catalogStore.frameOf(1)).toBe(frame);
        expect(catalogStore.catalogProfileStores.has(1)).toBe(true);
        expect(catalogStore.getCatalogDisplayStore(1)).toBeDefined();
        expect(catalogStore.catalogGLData.get(1)?.x).toHaveLength(3);
        expect(WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, 1)).toBeDefined();
        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-0")).toBe(1);
    });

    test("shows a catalog in the widget already showing its image's catalogs", async () => {
        WidgetsStore.Instance.getCatalogWidgetStore("catalog-overlay-0", 1);
        catalogStore.catalogProfileStores.set(1, rowsFor(1));
        catalogStore.catalogImageIds.set(1, 7);

        await expect(open(async id => rowsFor(id))).resolves.toBe(2);

        expect(WidgetsStore.Instance.catalogWidgets.size).toBe(1);
        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-0")).toBe(2);
    });

    test("gives the first catalog a widget of its own when there is none", async () => {
        await open(async id => rowsFor(id));

        const componentIds = Array.from(WidgetsStore.Instance.catalogWidgets.keys());
        expect(componentIds.map(id => catalogStore.widgetBindings.catalogOf(id))).toEqual([1]);
    });

    test("points every widget at the first catalog on an image", async () => {
        WidgetsStore.Instance.getCatalogWidgetStore("catalog-overlay-0", 5);
        WidgetsStore.Instance.getCatalogWidgetStore("catalog-overlay-1", 5);

        await open(async id => rowsFor(id));

        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-0")).toBe(1);
        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-1")).toBe(1);
    });

    test("does not give a catalog the ID of one still loading", async () => {
        let finishFirst!: () => void;
        const first = open(id => new Promise(resolve => (finishFirst = () => resolve(rowsFor(id)))));

        await expect(open(async id => rowsFor(id))).resolves.toBe(2);
        finishFirst();
        await expect(first).resolves.toBe(1);
    });

    test("skips the IDs of catalogs that are open", async () => {
        catalogStore.catalogProfileStores.set(1, rowsFor(1));

        await expect(open(async id => rowsFor(id))).resolves.toBe(2);
    });

    test("gives the ID back when there is no catalog to open", async () => {
        await expect(open(async () => undefined)).resolves.toBeUndefined();

        await expect(open(async id => rowsFor(id))).resolves.toBe(1);
    });

    test("gives the ID back and passes on an error from loading", async () => {
        await expect(
            open(async () => {
                throw new Error("unreadable catalog");
            })
        ).rejects.toThrow("unreadable catalog");

        await expect(open(async id => rowsFor(id))).resolves.toBe(1);
    });

    test("drops a catalog whose image was closed while it loaded", async () => {
        const closeCatalogFile = jest.spyOn(AppStore.Instance.backendService, "closeCatalogFile").mockReturnValue(true);
        jest.mocked(AppStore.Instance.getFrame).mockReturnValue(undefined);

        await expect(open(async id => rowsFor(id))).resolves.toBeUndefined();

        expect(catalogStore.catalogProfileStores.size).toBe(0);
        expect(catalogStore.catalogImageIds.size).toBe(0);
        // The backend was asked to load the file, so it is told the catalog will not be used.
        expect(closeCatalogFile).toHaveBeenCalledWith(1);
    });
});

describe("CatalogStore workspace catalog IDs", () => {
    const widgetsStore = WidgetsStore.Instance;

    beforeEach(() => {
        Array.from(widgetsStore.catalogPlotWidgets.keys()).forEach(widgetId => CatalogStore.Instance.widgetBindings.deletePlot(widgetId));
        Array.from(widgetsStore.catalogWidgets.keys()).forEach(componentId => widgetsStore.deleteCatalogWidget(componentId));
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
        CatalogStore.Instance.widgetBindings.componentIds().forEach(id => CatalogStore.Instance.widgetBindings.closeComponent(id));
    });

    test("reuses restored IDs and allocates the next unused ID for new catalogs", () => {
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 11, 4);

        expect(WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 11)).toBe(4);
        expect(WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 12)).toBe(1);
        expect(WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, 13)).toBe(2);
    });

    test("does not hold back an ID that a restored plot names but no loaded catalog has", () => {
        // A Workspace describes only what was loaded, so an unavailable catalog's ID is free again.
        widgetsStore.addCatalogPlotWidget({xColumnName: "RA", yColumnName: "DEC", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-0", {catalogId: 1});

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
        [catalogFileId].forEach(catalogFileId => catalogStore.catalogImageIds.set(catalogFileId, 7));
        catalogStore.catalogProfileStores.set(catalogFileId, CreateEmptyProfileStore());
    }

    /** What a Workspace saving every loaded catalog would keep for a plot. */
    const saved = (widgetId: string) => {
        const catalogIds = Array.from(catalogStore.catalogProfileStores.keys(), fileId => WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, fileId));
        return catalogStore.widgetBindings.savedCatalogWidgets(new Set(catalogIds.filter((id): id is number => id !== undefined)))[widgetId];
    };

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.widgetBindings.componentIds().forEach(id => catalogStore.widgetBindings.closeComponent(id));
        catalogStore.catalogProfileStores.clear();
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
        catalogStore.catalogImageIds.clear();
        widgetsStore.catalogPlotWidgets.clear();
    });

    test("saves the catalog a plot shows by its workspace ID, not by the session's catalog file ID", () => {
        showCatalog(5);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 5, 2);
        const widgetId = widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0") as string;
        catalogStore.widgetBindings.register("catalog-plot-component-0", 5, widgetId);

        expect(saved("catalog-plot-0")).toMatchObject({type: "catalog-plot", catalogId: 2, xColumnName: "RA", yColumnName: "DEC"});
    });

    test("keeps a plot's identity in its layout settings, and nothing that names its catalog", () => {
        showCatalog(5);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 5, 2);
        const widgetId = widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0") as string;
        catalogStore.widgetBindings.register("catalog-plot-component-0", 5, widgetId);

        const layoutSettings = widgetsStore.toWidgetSettingsConfig("catalog-plot", widgetId);

        expect(layoutSettings).toEqual({widgetId: "catalog-plot-0", ...widgetsStore.catalogPlotWidgets.get(widgetId)!.toLayoutSettings()});
        expect(layoutSettings).not.toHaveProperty("catalogId");
        expect(layoutSettings).not.toHaveProperty("xColumnName");
    });

    test("ignores what an older layout kept about the columns a plot is drawn from", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0", {widgetId: "plot-a", xColumnName: "LEGACY", dragMode: "pan"});

        const plotStore = widgetsStore.catalogPlotWidgets.get("catalog-plot-0");
        expect(plotStore?.xColumnName).toBe("RA");
        expect(plotStore?.dragMode).toBe("pan");
    });

    test("saves the fallback a plot shows, without what it was drawn from, when its catalog is unavailable", () => {
        showCatalog(5);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 5, 2);
        const widgetId = widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0") as string;
        catalogStore.widgetBindings.register("catalog-plot-component-0", 5, widgetId);

        catalogStore.widgetBindings.restore({"catalog-plot-0": {type: "catalog-plot", catalogId: 7, xColumnName: "FLUX"}}, [{id: 7, source: {type: "file", filename: "missing.vot"}}], new Map());

        expect(saved("catalog-plot-0")).toMatchObject({catalogId: 2, xColumnName: "RA"});
    });

    test("restores a plot onto the catalog it was saved against by its stable ID", () => {
        showCatalog(5);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 5, 2);

        widgetsStore.initWidgets([{id: "catalog-plot", plotType: CatalogPlotType.D2Scatter, props: {id: "catalog-plot-3"}, widgetSettings: {widgetId: "plot-a", plotType: CatalogPlotType.D2Scatter}}], []);
        const issues = catalogStore.widgetBindings.restore({"plot-a": {type: "catalog-plot", catalogId: 2, xColumnName: "RA", yColumnName: "DEC"}}, [{id: 2, source: {type: "file", filename: "sources.vot"}}], new Map([[2, 5]]));

        expect(issues).toEqual([]);
        expect(catalogStore.widgetBindings.displayedForWidget("catalog-plot-3").catalogFileId).toBe(5);
        expect(widgetsStore.catalogPlotWidgets.get("catalog-plot-3")?.xColumnName).toBe("RA");
        expect(saved("plot-a")?.catalogId).toBe(2);
    });

    test("moves a plot onto its catalog, discarding the plot that catalog already held", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-1");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 1, "catalog-plot-0");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 5, "catalog-plot-1");
        catalogStore.widgetBindings.show("catalog-plot-component-0", 1);

        restorePlotBinding("catalog-plot-0", 7, 5);

        expect(catalogStore.widgetBindings.displayedForComponent("catalog-plot-component-0")?.widgetId).toBe("catalog-plot-0");
        expect(catalogStore.widgetBindings.displayedForWidget("catalog-plot-0").catalogFileId).toBe(5);
        expect(widgetsStore.catalogPlotWidgets.has("catalog-plot-1")).toBe(false);
    });

    test("leaves a plot alone when it already shows the catalog it was saved against", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 5, "catalog-plot-0");

        restorePlotBinding("catalog-plot-0", 7, 5);
        expect(catalogStore.widgetBindings.displayedForComponent("catalog-plot-component-0")?.widgetId).toBe("catalog-plot-0");
    });

    test("saves and restores the plot store the tab shows after switching from catalog A to catalog B", () => {
        // Catalog A (fileId 1, workspaceId 10) and Catalog B (fileId 2, workspaceId 20)
        const frame = {frameInfo: {fileId: 7}, spatialSiblings: []};
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame: frame, imageViewConfigStore: {visibleFrames: [frame]}} as any);
        [1, 2].forEach(catalogFileId => catalogStore.catalogImageIds.set(catalogFileId, 7));
        catalogStore.catalogProfileStores.set(1, CreateEmptyProfileStore());
        catalogStore.catalogProfileStores.set(2, CreateEmptyProfileStore());
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 1, 10);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 2, 20);

        const plotStoreAId = widgetsStore.addCatalogPlotWidget({xColumnName: "RA_A", yColumnName: "DEC_A", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-0");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 1, plotStoreAId as string);
        const plotStoreBId = widgetsStore.addCatalogPlotWidget({xColumnName: "FLUX_B", yColumnName: "MAG_B", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-1");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 2, plotStoreBId as string);
        catalogStore.widgetBindings.show("catalog-plot-component-0", 2);

        // The tab is known by its first plot's ID, and saves catalog B with catalog B's settings.
        const layoutSettings = widgetsStore.toWidgetSettingsConfig("catalog-plot", "catalog-plot-0");
        const savedConfig = saved("catalog-plot-0");
        expect(savedConfig).toMatchObject({catalogId: 20, xColumnName: "FLUX_B", yColumnName: "MAG_B"});

        widgetsStore.catalogPlotWidgets.clear();
        catalogStore.widgetBindings.componentIds().forEach(id => catalogStore.widgetBindings.closeComponent(id));
        widgetsStore.initWidgets([{id: "catalog-plot", plotType: CatalogPlotType.D2Scatter, props: {id: "catalog-plot-0"}, widgetSettings: layoutSettings}], []);
        catalogStore.widgetBindings.restore({"catalog-plot-0": savedConfig}, [], new Map([[20, 2]]));

        expect(catalogStore.widgetBindings.displayedForWidget("catalog-plot-0").catalogFileId).toBe(2);
        expect(widgetsStore.catalogPlotWidgets.get("catalog-plot-0")?.xColumnName).toBe("FLUX_B");
        expect(saved("catalog-plot-0")?.catalogId).toBe(20);
    });

    test("switching from A to B and back to A saves catalog A's plot settings with catalog A's workspace ID", () => {
        showCatalog(1);
        catalogStore.catalogProfileStores.set(2, CreateEmptyProfileStore());
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 1, 10);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 2, 20);

        const plotStoreAId = widgetsStore.addCatalogPlotWidget({xColumnName: "RA_A", yColumnName: "DEC_A", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-0");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 1, plotStoreAId as string);
        const plotStoreBId = widgetsStore.addCatalogPlotWidget({xColumnName: "FLUX_B", yColumnName: "MAG_B", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-1");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 2, plotStoreBId as string);

        catalogStore.widgetBindings.show("catalog-plot-component-0", 2);
        catalogStore.widgetBindings.show("catalog-plot-component-0", 1);

        expect(saved("catalog-plot-0")).toMatchObject({catalogId: 10, xColumnName: "RA_A", yColumnName: "DEC_A"});
    });

    test("saves a plot against the catalog it shows as the user moves between catalogs", () => {
        showCatalog(2);
        catalogStore.catalogProfileStores.set(3, CreateEmptyProfileStore());
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 2, 20);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 3, 30);

        const plotStoreId = widgetsStore.addCatalogPlotWidget({xColumnName: "RA_A", yColumnName: "DEC_A", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-0");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 2, plotStoreId as string);
        expect(saved("catalog-plot-0")?.catalogId).toBe(20);

        // The user picks catalog C, then picks catalog B back.
        const plotStoreCId = widgetsStore.addCatalogPlotWidget({xColumnName: "FLUX_C", yColumnName: "MAG_C", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-1");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 3, plotStoreCId as string);
        catalogStore.widgetBindings.show("catalog-plot-component-0", 3);
        catalogStore.widgetBindings.show("catalog-plot-component-0", 2);

        expect(saved("catalog-plot-0")).toMatchObject({catalogId: 20, xColumnName: "RA_A", yColumnName: "DEC_A"});

        // The plot the user visited on the way belongs to catalog C.
        catalogStore.widgetBindings.show("catalog-plot-component-0", 3);
        expect(saved("catalog-plot-0")).toMatchObject({catalogId: 30, xColumnName: "FLUX_C"});
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

describe("Catalog table widget selection", () => {
    const catalogStore = CatalogStore.Instance;
    const widgetsStore = WidgetsStore.Instance;

    function restoreTables(selectedCatalogIds: Record<string, number>, catalogIds: Map<number, number>) {
        const catalogWidgets = Object.fromEntries(Object.entries(selectedCatalogIds).map(([widgetId, catalogId]) => [widgetId, {type: "catalog-overlay" as const, catalogId}]));
        return catalogStore.widgetBindings.restore(catalogWidgets, [{id: 20, source: {type: "file", filename: "sources.vot"}}], catalogIds);
    }

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogGLData.clear();
        catalogStore.catalogCounts.clear();
        catalogStore.catalogDisplayStores.forEach(displayStore => displayStore.dispose?.());
        catalogStore.catalogDisplayStores.clear();
        widgetsStore.catalogWidgets.clear();
        catalogStore.widgetBindings.componentIds().forEach(id => catalogStore.widgetBindings.closeComponent(id));
        Array.from(widgetsStore.catalogPlotWidgets.keys()).forEach(id => catalogStore.widgetBindings.deletePlot(id));
    });

    test("changes only the requested component when selecting by runtime ID", () => {
        catalogStore.catalogProfileStores.set(1, CreateEmptyProfileStore());
        catalogStore.catalogProfileStores.set(2, CreateEmptyProfileStore());
        WidgetsStore.Instance.getCatalogWidgetStore("catalog-overlay-0", 1);
        WidgetsStore.Instance.getCatalogWidgetStore("catalog-overlay-1", 1);

        expect(catalogStore.widgetBindings.show("catalog-overlay-0", 2)).toBe(true);
        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-0")).toBe(2);
        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-1")).toBe(1);
    });

    test("restores multiple widgets that show the same catalog", () => {
        catalogStore.catalogProfileStores.set(1, CreateEmptyProfileStore());
        // Catalog 1 is on the active image, which is what a widget can show.
        const frame = {frameInfo: {fileId: 7}, spatialSiblings: []};
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame: frame, imageViewConfigStore: {visibleFrames: [frame]}} as any);
        catalogStore.catalogImageIds.set(1, 7);
        catalogStore.catalogGLData.set(1, {x: new Float32Array(0), y: new Float32Array(0)});

        widgetsStore.initWidgets(
            [
                {id: "catalog-overlay", props: {id: "catalog-overlay-0"}, widgetSettings: {catalogFileId: 1}},
                {id: "catalog-overlay", props: {id: "catalog-overlay-1"}, widgetSettings: {catalogFileId: 1}}
            ],
            []
        );

        expect(Array.from(widgetsStore.catalogWidgets.keys())).toEqual(["catalog-overlay-0", "catalog-overlay-1"]);
        expect(Array.from(widgetsStore.catalogWidgets.keys()).map(id => catalogStore.widgetBindings.catalogOf(id))).toEqual([1, 1]);
        catalogStore.catalogImageIds.clear();
    });

    test("recreates workspace widgets that are absent from the current layout", () => {
        const widgetStore = widgetsStore.getCatalogWidgetStore("catalog-overlay-0", 1);
        widgetStore.setWidgetId("catalog-widget-primary");
        const initialFloatingWidgetIds = new Set(widgetsStore.floatingWidgets.map(widget => widget.id));

        widgetsStore.restoreCatalogWidgets(["catalog-widget-primary", "catalog-widget-secondary"]);

        expect(Array.from(widgetsStore.catalogWidgets.values()).map(store => store.widgetId)).toEqual(["catalog-widget-primary", "catalog-widget-secondary"]);
        const restoredWidget = widgetsStore.floatingWidgets.find(widget => !initialFloatingWidgetIds.has(widget.id));
        expect(restoredWidget?.type).toBe("catalog-overlay");
        if (restoredWidget) {
            widgetsStore.removeFloatingWidget(restoredWidget.id);
        }
    });

    test("restores a catalog by the widget's stable ID after its component ID changes", () => {
        catalogStore.catalogProfileStores.set(1, CreateEmptyProfileStore());
        catalogStore.catalogProfileStores.set(2, CreateEmptyProfileStore());
        const widgetStore = WidgetsStore.Instance.getCatalogWidgetStore("catalog-overlay-0", 1);
        widgetStore.setWidgetId("catalog-widget-primary");

        expect(restoreTables({"catalog-widget-primary": 20}, new Map([[20, 2]]))).toEqual([]);
        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-0")).toBe(2);
    });

    test("does not confuse a stable widget ID with another widget's runtime component ID", () => {
        catalogStore.catalogProfileStores.set(1, CreateEmptyProfileStore());
        catalogStore.catalogProfileStores.set(2, CreateEmptyProfileStore());
        const stableWidget = widgetsStore.getCatalogWidgetStore("catalog-overlay-0", 1);
        const runtimeWidget = widgetsStore.getCatalogWidgetStore("catalog-overlay-1", 1);
        stableWidget.setWidgetId("catalog-overlay-1");
        runtimeWidget.setWidgetId("catalog-widget-secondary");

        expect(catalogStore.widgetBindings.show("catalog-overlay-1", 2)).toBe(true);
        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-0")).toBe(1);
        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-1")).toBe(2);

        expect(restoreTables({"catalog-overlay-1": 20}, new Map([[20, 2]]))).toEqual([]);
        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-0")).toBe(2);
    });

    test("replaces a closed catalog in every widget that was showing it", () => {
        [1, 2].forEach(catalogFileId => {
            catalogStore.catalogProfileStores.set(catalogFileId, CreateEmptyProfileStore());
            catalogStore.catalogImageIds.set(catalogFileId, 7);
        });
        widgetsStore.getCatalogWidgetStore("catalog-overlay-0", 1);
        widgetsStore.getCatalogWidgetStore("catalog-overlay-1", 1);

        catalogStore.widgetBindings.catalogClosed(1);

        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-0")).toBe(2);
        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-1")).toBe(2);
        catalogStore.catalogImageIds.clear();
    });

    test("keeps widget persistence IDs unique when a layout contains duplicates", () => {
        widgetsStore.initWidgets(
            [
                {id: "catalog-overlay", props: {id: "catalog-overlay-0"}, widgetSettings: {widgetId: "catalog-widget-primary"}},
                {id: "catalog-overlay", props: {id: "catalog-overlay-1"}, widgetSettings: {widgetId: "catalog-widget-primary"}}
            ],
            []
        );

        const widgetIds = Array.from(widgetsStore.catalogWidgets.values()).map(widgetStore => widgetStore.widgetId);
        expect(new Set(widgetIds).size).toBe(widgetIds.length);
    });
});

describe("Catalog widget selection lifecycle", () => {
    const catalogStore = CatalogStore.Instance;
    const widgetsStore = WidgetsStore.Instance;

    beforeEach(() => {
        catalogStore.catalogImageIds.clear();
        widgetsStore.catalogWidgets.clear();
    });

    test("preserves a valid selection and falls back invalid widgets to the active image", () => {
        widgetsStore.getCatalogWidgetStore("catalog-overlay-0", 2);
        widgetsStore.getCatalogWidgetStore("catalog-overlay-1", 99);
        [2, 3].forEach(catalogFileId => catalogStore.catalogImageIds.set(catalogFileId, 7));

        catalogStore.resetActiveCatalogFile(7);

        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-0")).toBe(2);
        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-1")).toBe(2);
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
        catalogStore.resetRequests("test setup");
        jest.spyOn(AppStore.Instance, "getFrame").mockReturnValue({isValidWcs: false, wcsInfo: 0} as any);
        AppStore.Instance.setActiveImage({type: ImageType.FRAME, store: {frameInfo: {fileId: 10, fileInfo: {}}, restFreqStore: {customRestFreq: {}}}} as any);
        jest.spyOn(catalogStore, "imageIdOf").mockReturnValue(10);
        jest.spyOn(catalogStore, "convertToImageCoordinate").mockImplementation(jest.fn());
        sendCatalogFilter = jest.spyOn(AppStore.Instance.backendService, "setCatalogFilterRequest").mockReturnValue(1);
        // Restore runs while a workspace is loading, which keeps axis auto-selection out of its requests.
        runInAction(() => (AppStore.Instance.isLoadingWorkspace = true));
    });

    afterEach(() => {
        catalogStore.resetRequests("test cleanup");
        AppStore.Instance.setActiveImage(null);
        runInAction(() => (AppStore.Instance.isLoadingWorkspace = false));
    });

    test("does nothing for a catalog that is not loaded", async () => {
        await expect(catalogStore.restoreCatalogFromWorkspace(1, {overlay})).resolves.toEqual({success: false, didStart: false, message: "The catalog is not loaded"});
        expect(sendCatalogFilter).not.toHaveBeenCalled();
    });

    test("returns a failed completion when the backend cannot start the row request", async () => {
        const profileStore = openFileCatalog(200);
        sendCatalogFilter.mockReturnValue(false);

        await expect(catalogStore.restoreCatalogFromWorkspace(1)).resolves.toEqual({success: false, didStart: false, message: "The catalog request could not be sent"});

        expect(profileStore.isLoadingData).toBe(false);
        expect(profileStore.isUpdatingDataStream).toBe(false);
    });

    test("returns a failed completion when sending the row request throws", async () => {
        const profileStore = openFileCatalog(200);
        sendCatalogFilter.mockImplementation(() => {
            throw new Error("connection lost");
        });
        jest.spyOn(console, "error").mockImplementation(jest.fn());

        await expect(catalogStore.restoreCatalogFromWorkspace(1)).resolves.toEqual({success: false, didStart: false, message: "The catalog request could not be sent"});

        expect(profileStore.isLoadingData).toBe(false);
        expect(profileStore.isUpdatingDataStream).toBe(false);
    });

    test("drops the preview rows and asks for the catalog again from its first row", () => {
        const profileStore = openFileCatalog(200);
        profileStore.setColumnFilter("> 1", "FLUX");
        profileStore.setSortingInfo("RA", CARTA.SortingType.Ascending);
        // The rows the catalog opened with were read before those were applied.
        expect(profileStore.subsetEndIndex).toBe(50);

        catalogStore.restoreCatalogFromWorkspace(1, {overlay});

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

        catalogStore.restoreCatalogFromWorkspace(1, {overlay: {...overlay, maxRows: 3}});

        expect(displayStore.plottedImageOverlayMaxRows).toBe(3);
        expect(convertSpy).not.toHaveBeenCalled();
        expect(sendCatalogFilter.mock.calls[0][0].subsetDataSize).toBe(200);
    });

    test("requests enough rows for a larger overlay while keeping the table limit", () => {
        const profileStore = openFileCatalog(200);
        profileStore.setMaxRows(100);

        catalogStore.restoreCatalogFromWorkspace(1, {overlay: {...overlay, maxRows: 200}});

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

        let isSettled = false;
        const completion = catalogStore.restoreCatalogFromWorkspace(1).then(result => {
            isSettled = result.success;
            return result;
        });

        await Promise.resolve();
        expect(isSettled).toBe(false);

        catalogStore.handleFilterStream({requestId: 1, message: new CARTA.CatalogFilterResponse({fileId: 1, progress: 1, subsetDataSize: 0, subsetEndIndex: 0})});
        await expect(completion).resolves.toEqual({success: true, didStart: true});
        expect(isSettled).toBe(true);
    });

    test("returns the superseded outcome to the first Restore when a later request takes over", async () => {
        openFileCatalog(200);
        sendCatalogFilter.mockReturnValueOnce(1).mockReturnValueOnce(2);

        const first = catalogStore.restoreCatalogFromWorkspace(1);
        const second = catalogStore.restoreCatalogFromWorkspace(1);

        await expect(first).resolves.toEqual({success: false, didStart: true, message: "The catalog restore was superseded"});
        catalogStore.handleFilterStream({requestId: 2, message: new CARTA.CatalogFilterResponse({fileId: 1, progress: 1, subsetDataSize: 0, subsetEndIndex: 0})});
        await expect(second).resolves.toEqual({success: true, didStart: true});
    });

    test("keeps refusing a closed catalog's responses once its file ID is opened again", () => {
        jest.spyOn(AppStore.Instance, "getFrame").mockReturnValue(undefined as any);
        jest.spyOn(CatalogWebGLService.Instance, "clearTexture").mockImplementation(jest.fn());
        openFileCatalog(200);
        sendCatalogFilter.mockReturnValue(4);
        catalogStore.restoreCatalogFromWorkspace(1);

        jest.spyOn(AppStore.Instance.backendService, "closeCatalogFile").mockReturnValue(true);
        catalogStore.close(1);
        // The lowest free file ID is handed to the next catalog opened, which has not yet asked for
        // anything of its own.
        openFileCatalog(200);

        expect(catalogStore.catalogRequests.accepts(1, 4)).toBe(false);
        catalogStore.catalogRequests.failAll("test cleanup");
    });

    test("cleans loading state when a restore fails", async () => {
        const profileStore = openFileCatalog(200);
        sendCatalogFilter.mockReturnValue(1);

        const completion = catalogStore.restoreCatalogFromWorkspace(1);
        expect(profileStore.isLoadingData).toBe(true);
        expect(profileStore.isUpdatingDataStream).toBe(true);

        catalogStore.failRequest(1, "catalog request failed");

        await expect(completion).resolves.toEqual({success: false, didStart: true, message: "catalog request failed"});
        expect(profileStore.isLoadingData).toBe(false);
        expect(profileStore.isUpdatingDataStream).toBe(false);
    });

    test("uses an idle timeout that is refreshed by catalog responses", async () => {
        jest.useFakeTimers();
        try {
            openFileCatalog(200);
            sendCatalogFilter.mockReturnValue(1);
            const completion = catalogStore.restoreCatalogFromWorkspace(1);

            jest.advanceTimersByTime(29_999);
            catalogStore.handleFilterStream({requestId: 1, message: new CARTA.CatalogFilterResponse({fileId: 1, progress: 0.5, subsetDataSize: 0, subsetEndIndex: 0})});
            jest.advanceTimersByTime(29_999);
            expect(jest.getTimerCount()).toBeGreaterThan(0);

            jest.advanceTimersByTime(1);
            await expect(completion).resolves.toEqual({success: false, didStart: true, message: "Timed out waiting for catalog data"});
        } finally {
            jest.useRealTimers();
        }
    });

    test("asks for a column the overlay is mapped from even when the saved table hides it", () => {
        openFileCatalog(200).setDisplayedColumns(["FLUX"]);

        catalogStore.restoreCatalogFromWorkspace(1, {overlay});

        expect(sendCatalogFilter.mock.calls[0][0].columnIndices).toEqual([0, 1, 2]);
    });

    test("requests the selection identity columns and every row needed to find it", () => {
        const profileStore = openFileCatalog(200);
        profileStore.setDisplayedColumns(["RA"]);

        catalogStore.restoreCatalogFromWorkspace(1, {selection: {columns: ["FLUX"], rowHashes: ["selected-row"], searchRows: 125}});

        expect(sendCatalogFilter.mock.calls[0][0].columnIndices).toEqual([0, 2]);
        expect(sendCatalogFilter.mock.calls[0][0].subsetStartIndex).toBe(0);
        expect(sendCatalogFilter.mock.calls[0][0].subsetDataSize).toBe(125);
        expect(profileStore.displayedColumnHeaders.map(header => header.name)).toEqual(["RA"]);
    });

    test("restores the table alone when no overlay was saved", () => {
        const profileStore = openFileCatalog(200);

        catalogStore.restoreCatalogFromWorkspace(1);

        expect(profileStore.updateMode).toBe(CatalogUpdateMode.TableUpdate);
        expect(sendCatalogFilter.mock.calls[0][0].subsetStartIndex).toBe(0);
    });

    test("draws an online catalog without asking for its rows again", async () => {
        catalogStore.catalogProfileStores.set(1, new CatalogOnlineQueryProfileStore({dataSize: 2, directory: "", fileId: 1, fileInfo: new CARTA.CatalogFileInfo({name: "simbad"})}, catalogHeader, catalogData(), CatalogType.SIMBAD));

        await expect(catalogStore.restoreCatalogFromWorkspace(1, {overlay})).resolves.toEqual({success: true, didStart: true});

        expect(sendCatalogFilter).not.toHaveBeenCalled();
        expect(catalogStore.getCatalogDisplayStore(1)?.plottedImageOverlayXAxis).toBe("RA");
    });
});

describe("CatalogStore request lifecycle", () => {
    const catalogStore = CatalogStore.Instance;
    const catalogFileId = 30_001;
    const names = ["RA", "DEC", "FLUX"];
    const catalogHeader = names.map((name, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: CARTA.ColumnType.Double, name, units: "deg"}));
    let sendFilter: jest.SpyInstance;

    function openCatalog(): CatalogProfileStore {
        const data = new Map<number, ProcessedColumnData>(names.map((name, index) => [index, {dataType: CARTA.ColumnType.Double, data: [index, index + 1]}]));
        const profileStore = new CatalogProfileStore({dataSize: 100, directory: "", fileId: catalogFileId, fileInfo: new CARTA.CatalogFileInfo({name: "sources.vot"})}, catalogHeader, data, CatalogType.FILE);
        catalogStore.catalogProfileStores.set(catalogFileId, profileStore);
        catalogStore.getOrCreateCatalogDisplayStore(catalogFileId);
        return profileStore;
    }

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.resetRequests("test setup");
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogDisplayStores.forEach(displayStore => displayStore.dispose());
        catalogStore.catalogDisplayStores.clear();
        AppStore.Instance.setActiveImage({type: ImageType.FRAME, store: {frameInfo: {fileId: 10, fileInfo: {}}, restFreqStore: {customRestFreq: {}}}} as any);
        sendFilter = jest.spyOn(AppStore.Instance.backendService, "setCatalogFilterRequest").mockReturnValue(11);
    });

    afterEach(() => {
        AppStore.Instance.setActiveImage(null);
        catalogStore.resetRequests("test cleanup");
    });

    test("filters with hidden overlay columns while clearing the old selection", () => {
        const profileStore = openCatalog();
        const displayStore = catalogStore.getCatalogDisplayStore(catalogFileId)!;
        profileStore.setDisplayedColumns(["FLUX"]);
        profileStore.ensureColumnsRequested(["RA", "DEC"]);
        profileStore.setColumnFilter("> 1", "FLUX");
        profileStore.setSelectedPointIndices([0], false);
        displayStore.setShowSelectedData(true);

        catalogStore.requestFilteredRows(catalogFileId);

        expect(sendFilter).toHaveBeenCalledTimes(1);
        expect(sendFilter.mock.calls[0][0].columnIndices).toEqual([0, 1, 2]);
        expect(sendFilter.mock.calls[0][0].filterConfigs).toHaveLength(1);
        expect(profileStore.selectedPointIndices).toEqual([]);
        expect(displayStore.isShowingSelectedData).toBe(false);
    });

    test("preserves a drawn overlay during a column-only refresh", () => {
        const profileStore = openCatalog();
        const displayStore = catalogStore.getCatalogDisplayStore(catalogFileId)!;
        profileStore.setIsUpdateColumn(true);
        displayStore.setPlottedImageOverlayState("RA", "DEC", CatalogSystemType.ICRS);
        const clearPositions = jest.spyOn(catalogStore, "clearImageCoordsData");

        catalogStore.requestFilteredRows(catalogFileId);

        expect(sendFilter).toHaveBeenCalledTimes(1);
        expect(clearPositions).not.toHaveBeenCalled();
        expect(displayStore.hasPlottedImageOverlay).toBe(true);
    });

    test("clears positions when column controls name axes but no overlay is drawn", () => {
        const profileStore = openCatalog();
        const displayStore = catalogStore.getCatalogDisplayStore(catalogFileId)!;
        profileStore.setIsUpdateColumn(true);
        displayStore.setxAxis("RA");
        displayStore.setyAxis("DEC");
        const clearPositions = jest.spyOn(catalogStore, "clearImageCoordsData");

        catalogStore.requestFilteredRows(catalogFileId);

        expect(clearPositions).toHaveBeenCalledWith(catalogFileId);
        expect(displayStore.hasPlottedImageOverlay).toBe(false);
    });

    test("requests hidden mapped columns on scroll and clears loading if send fails", () => {
        const profileStore = openCatalog();
        profileStore.setDisplayedColumns(["FLUX"]);
        profileStore.ensureColumnsRequested(["RA", "DEC"]);
        profileStore.setSubsetEndIndex(2);
        profileStore.setLoadingDataStatus(false);
        sendFilter.mockReturnValue(false);

        catalogStore.requestMoreRows(catalogFileId);

        expect(sendFilter).toHaveBeenCalledTimes(1);
        expect(sendFilter.mock.calls[0][0].columnIndices).toEqual([0, 1, 2]);
        expect(sendFilter.mock.calls[0][0].subsetStartIndex).toBe(2);
        expect(profileStore.isLoadingData).toBe(false);
    });

    test("does not ask for more rows while a restore's wait is still open, even when the catalog no longer reads as loading", () => {
        const profileStore = openCatalog();
        profileStore.setSubsetEndIndex(2);
        // A restore marks the catalog as loading; this state is built by hand, since the guard is
        // there for a wait that outlives that flag rather than for one the flag already covers.
        profileStore.setLoadingDataStatus(false);
        const completion = catalogStore.catalogRequests.start(catalogFileId);

        catalogStore.requestMoreRows(catalogFileId);

        expect(sendFilter).not.toHaveBeenCalled();
        expect(catalogStore.catalogRequests.isPending(catalogFileId)).toBe(true);
        catalogStore.catalogRequests.finish(catalogFileId, true);
        return completion;
    });

    test("keeps sort and plot update modes distinct", () => {
        const profileStore = openCatalog();
        sendFilter.mockReturnValueOnce(11).mockReturnValueOnce(12);

        catalogStore.requestSortedRows(catalogFileId, "FLUX", CARTA.SortingType.Descending);
        expect(sendFilter.mock.calls[0][0].sortColumn).toBe("FLUX");
        expect(sendFilter.mock.calls[0][0].sortingType).toBe(CARTA.SortingType.Descending);

        catalogStore.requestPlotRows(catalogFileId);
        expect(sendFilter).toHaveBeenCalledTimes(2);
        expect(profileStore.updateMode).toBe(CatalogUpdateMode.PlotsUpdate);
    });

    test("clears loading for filter and plot requests rejected by the transport", () => {
        const profileStore = openCatalog();
        profileStore.setColumnFilter("> 1", "FLUX");
        sendFilter.mockReturnValue(false);

        catalogStore.requestFilteredRows(catalogFileId);
        expect(profileStore.isLoadingData).toBe(false);

        catalogStore.requestPlotRows(catalogFileId);
        expect(profileStore.isUpdatingDataStream).toBe(false);
        expect(sendFilter).toHaveBeenCalledTimes(2);
    });

    test("clears loading when the transport throws before a request is sent", () => {
        const profileStore = openCatalog();
        sendFilter.mockImplementation(() => {
            throw new Error("transport unavailable");
        });

        expect(() => catalogStore.requestPlotRows(catalogFileId)).toThrow("transport unavailable");
        expect(profileStore.isUpdatingDataStream).toBe(false);
    });

    test("keeps online catalog filtering and sorting local", () => {
        const data = new Map<number, ProcessedColumnData>(names.map((name, index) => [index, {dataType: CARTA.ColumnType.Double, data: [index, index + 1]}]));
        const profileStore = new CatalogOnlineQueryProfileStore({dataSize: 2, directory: "", fileId: catalogFileId, fileInfo: new CARTA.CatalogFileInfo({name: "simbad"})}, catalogHeader, data, CatalogType.SIMBAD);
        catalogStore.catalogProfileStores.set(catalogFileId, profileStore);
        catalogStore.getOrCreateCatalogDisplayStore(catalogFileId);
        profileStore.setColumnFilter("> 1", "FLUX");

        catalogStore.requestFilteredRows(catalogFileId);
        catalogStore.requestSortedRows(catalogFileId, "FLUX", CARTA.SortingType.Descending);
        catalogStore.requestPlotRows(catalogFileId);

        expect(sendFilter).not.toHaveBeenCalled();
        expect(profileStore.sortingInfo).toEqual({columnName: "FLUX", sortingType: CARTA.SortingType.Descending});
    });

    test("ignores a superseded stream and accepts the latest response", () => {
        const profileStore = openCatalog();
        sendFilter.mockReturnValueOnce(11).mockReturnValueOnce(12);
        const updateData = jest.spyOn(profileStore, "updateCatalogData");
        catalogStore.requestSortedRows(catalogFileId, "RA", CARTA.SortingType.Ascending);
        catalogStore.requestSortedRows(catalogFileId, "FLUX", CARTA.SortingType.Descending);
        const response = new CARTA.CatalogFilterResponse({fileId: catalogFileId, progress: 1, subsetDataSize: 0, subsetEndIndex: 0});

        catalogStore.handleFilterStream({requestId: 11, message: response});
        expect(updateData).not.toHaveBeenCalled();

        catalogStore.handleFilterStream({requestId: 12, message: response});
        expect(updateData).toHaveBeenCalledTimes(1);
        expect(profileStore.isLoadingData).toBe(false);
    });
});

describe("Catalog plot component selection", () => {
    const catalogStore = CatalogStore.Instance;
    const widgetsStore = WidgetsStore.Instance;
    const scatterProps = {xColumnName: "RA", yColumnName: "DEC", plotType: CatalogPlotType.D2Scatter};

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.widgetBindings.componentIds().forEach(id => catalogStore.widgetBindings.closeComponent(id));
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogImageIds.clear();
        widgetsStore.catalogPlotWidgets.clear();
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
    });

    test("shows the first catalog it was pointed at", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 5, "catalog-plot-0");

        expect(catalogStore.widgetBindings.displayedForComponent("catalog-plot-component-0")?.catalogFileId).toBe(5);
        expect(catalogStore.widgetBindings.displayedForComponent("catalog-plot-component-0")?.widgetId).toBe("catalog-plot-0");
    });

    test("keeps showing the catalog it is on when another one is added", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-1");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 5, "catalog-plot-0");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 6, "catalog-plot-1");

        expect(catalogStore.widgetBindings.displayedForComponent("catalog-plot-component-0")?.catalogFileId).toBe(5);
    });

    test("follows a plot moved onto the catalog a workspace saved it against", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 5, "catalog-plot-0");

        restorePlotBinding("catalog-plot-0", 7, 6);

        // The component reads its selection from here, so a restore moves it without its help.
        expect(catalogStore.widgetBindings.displayedForComponent("catalog-plot-component-0")?.catalogFileId).toBe(6);
        expect(catalogStore.widgetBindings.displayedForComponent("catalog-plot-component-0")?.widgetId).toBe("catalog-plot-0");
    });

    test("shows no catalog when neither its image nor the active image has one left", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-1");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 5, "catalog-plot-0");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 6, "catalog-plot-1");

        // Catalog 6 is on no image this plot could show, so it is not fallen back to.
        catalogStore.widgetBindings.catalogClosed(5);

        expect(catalogStore.widgetBindings.displayedForComponent("catalog-plot-component-0")?.catalogFileId).toBeUndefined();
    });

    test("moves onto another loaded catalog even when it does not have a plot store yet", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 5, "catalog-plot-0");
        [5, 6].forEach(catalogFileId => catalogStore.catalogImageIds.set(catalogFileId, 7));
        catalogStore.catalogProfileStores.set(5, CreateEmptyProfileStore());
        catalogStore.catalogProfileStores.set(6, CreateEmptyProfileStore());

        catalogStore.widgetBindings.catalogClosed(5);

        expect(catalogStore.widgetBindings.displayedForComponent("catalog-plot-component-0")?.catalogFileId).toBe(6);
    });

    test("moves onto a catalog of the image now in front", () => {
        widgetsStore.addCatalogPlotWidget(scatterProps, "catalog-plot-0");
        catalogStore.widgetBindings.register("catalog-plot-component-0", 5, "catalog-plot-0");
        [8, 9].forEach(catalogFileId => catalogStore.catalogImageIds.set(catalogFileId, 7));

        catalogStore.resetActiveCatalogFile(7);

        expect(catalogStore.widgetBindings.displayedForComponent("catalog-plot-component-0")?.catalogFileId).toBe(8);
    });
});

describe("CatalogStore widget selection", () => {
    const catalogStore = CatalogStore.Instance;
    const widgetsStore = WidgetsStore.Instance;

    beforeEach(() => {
        widgetsStore.catalogWidgets.clear();
    });

    afterEach(() => {
        catalogStore.catalogImageIds.clear();
        widgetsStore.catalogWidgets.clear();
    });

    test("moves a widget left on a Restore fallback to the catalog a user selects a source in", () => {
        widgetsStore.getCatalogWidgetStore("catalog-widget-0", 7);

        expect(catalogStore.widgetBindings.showInTable(9)).toBe("catalog-widget-0");
        expect(catalogStore.widgetBindings.catalogOf("catalog-widget-0")).toBe(9);
    });

    test("resets an unavailable widget selection to the first active catalog", () => {
        [7, 8].forEach(catalogFileId => catalogStore.catalogImageIds.set(catalogFileId, 101));
        widgetsStore.getCatalogWidgetStore("catalog-widget-0", 99);

        catalogStore.resetActiveCatalogFile(101);

        expect(catalogStore.widgetBindings.catalogOf("catalog-widget-0")).toBe(7);
    });

    test("moves a widget onto a catalog the image still has when the one it showed is closed", () => {
        [7, 8].forEach(catalogFileId => catalogStore.catalogImageIds.set(catalogFileId, 103));
        jest.spyOn(AppStore.Instance, "getFrame").mockReturnValue({frameInfo: {fileId: 103}} as any);
        jest.spyOn(catalogStore, "imageIdOf").mockReturnValue(103);
        jest.spyOn(CatalogWebGLService.Instance, "clearTexture").mockImplementation(jest.fn());
        jest.spyOn(AppStore.Instance.backendService, "closeCatalogFile").mockReturnValue(true);
        catalogStore.catalogProfileStores.set(8, CreateEmptyProfileStore());
        widgetsStore.getCatalogWidgetStore("catalog-widget-0", 7);

        // Whether it is closed from this widget, another one, or by a Restore.
        catalogStore.close(7);

        expect(catalogStore.widgetBindings.catalogOf("catalog-widget-0")).toBe(8);
        catalogStore.catalogProfileStores.delete(8);
    });

    test("closes nothing when the backend cannot be told", () => {
        catalogStore.catalogImageIds.set(7, 103);
        catalogStore.catalogProfileStores.set(7, CreateEmptyProfileStore());
        jest.spyOn(AppStore.Instance.backendService, "closeCatalogFile").mockReturnValue(false);

        expect(catalogStore.close(7)).toBe(false);

        expect(catalogStore.catalogProfileStores.has(7)).toBe(true);
        expect(catalogStore.imageIdOf(7)).toBe(103);
        catalogStore.catalogProfileStores.delete(7);
    });

    test("forgets the catalogs of a closed image that the backend could not close", () => {
        [7, 8].forEach(catalogFileId => catalogStore.catalogImageIds.set(catalogFileId, 103));
        jest.spyOn(AppStore.Instance.backendService, "closeCatalogFile").mockReturnValue(false);

        catalogStore.closeCatalogsOn(103);

        // The next image given file ID 103 does not inherit them.
        expect(catalogStore.catalogsOn(103)).toEqual([]);
    });

    test("preserves each widget selection when it remains active", () => {
        [7, 8].forEach(catalogFileId => catalogStore.catalogImageIds.set(catalogFileId, 102));
        widgetsStore.getCatalogWidgetStore("catalog-widget-0", 7);
        widgetsStore.getCatalogWidgetStore("catalog-widget-1", 8);

        catalogStore.resetActiveCatalogFile(102);

        expect(catalogStore.widgetBindings.catalogOf("catalog-widget-0")).toBe(7);
        expect(catalogStore.widgetBindings.catalogOf("catalog-widget-1")).toBe(8);
    });
});
