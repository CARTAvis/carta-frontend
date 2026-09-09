import {afterEach, describe, expect, jest, test} from "@jest/globals";

jest.mock("services/CatalogWebGLService", () => ({
    CatalogWebGLService: {
        Instance: {
            updateDataTexture: jest.fn()
        }
    }
}));

import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {AngularSizeUnit, CatalogDisplayMode, CatalogOverlay, CatalogOverlayShape, CatalogPlotType, CatalogSettingsTabs, CatalogSystemType, CatalogType, ColorMap, FrameScaling, WorkspaceItemKind} from "enums";
import {type WorkspaceCatalogConfig} from "models/Workspace";
import {CatalogDisplayStore, CatalogPanelStore, CatalogProfileStore, CatalogStore, WorkspaceIdRegistry} from "stores";
import {type ProcessedColumnData} from "utilities";

/** Column data every catalog in these tests carries, so that mapped columns resolve to a range. */
const COLUMNS: ReadonlyArray<{name: string; values: number[]}> = [
    {name: "RA", values: [10.1, 10.2, 10.3, 10.4]},
    {name: "DEC", values: [-20.1, -20.2, -20.3, -20.4]},
    {name: "Fmag", values: [1, 4, 7, 10]},
    {name: "Bmag", values: [2, 5, 8, 11]},
    {name: "Vmag", values: [3, 6, 9, 12]},
    {name: "PA", values: [0, 45, 90, 135]}
];

let nextCatalogFileId = 0;
const CREATED_DISPLAY_STORES: CatalogDisplayStore[] = [];

function createProfileStore(catalogFileId: number, extraValues: number[] = []): CatalogProfileStore {
    const catalogHeader = COLUMNS.map((column, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: CARTA.ColumnType.Double, name: column.name}));
    const catalogData = new Map<number, ProcessedColumnData>(COLUMNS.map((column, index) => [index, {dataType: CARTA.ColumnType.Double, data: Float64Array.from([...column.values, ...extraValues])}]));

    return new CatalogProfileStore({dataSize: COLUMNS[0].values.length + extraValues.length, directory: "", fileId: catalogFileId, fileInfo: new CARTA.CatalogFileInfo({name: "test-catalog"})}, catalogHeader, catalogData, CatalogType.FILE);
}

/** What a later batch of rows looks like: the same columns, over a wider range. */
function deliverMoreRows(store: CatalogDisplayStore, extraValues: number[] = [0, 20]): void {
    runInAction(() => CatalogStore.Instance.catalogProfileStores.set(store.catalogFileId, createProfileStore(store.catalogFileId, extraValues)));
}

/** A store whose catalog data is loaded, as {@link CatalogDisplayStore.applyConfig} requires. */
function createStore(): CatalogDisplayStore {
    nextCatalogFileId += 1;
    const catalogFileId = nextCatalogFileId;
    runInAction(() => CatalogStore.Instance.catalogProfileStores.set(catalogFileId, createProfileStore(catalogFileId)));

    const store = new CatalogDisplayStore(catalogFileId);
    CREATED_DISPLAY_STORES.push(store);
    return store;
}

/** A store with something set in every group of the display config. */
function createConfiguredStore(): CatalogDisplayStore {
    const store = createStore();

    store.setCatalogColor("#112233");
    store.setHighlightColor("#445566");
    store.setCatalogShape(CatalogOverlayShape.BOX_LINED);
    store.setCatalogSize(12);
    store.setThickness(4);
    store.setCatalogPlotType(CatalogPlotType.D2Scatter);
    store.setWorldSizeUnit(AngularSizeUnit.ARCMIN);
    store.setxAxis("RA");
    store.setyAxis("DEC");

    store.setSizeMap("Fmag");
    store.setSizeArea(true);
    store.setSizeScalingType(FrameScaling.LOG);
    store.setSizeScalingParameter(500);
    store.setSizeColumnMin(2, "clipd");
    store.setSizeColumnMax(8, "clipd");

    store.setSizeMinorMap("Bmag");
    store.setSizeMinorScalingType(FrameScaling.POWER);
    store.setSizeMinorColumnMin(3, "clipd");
    store.setSizeMinorColumnMax(9, "clipd");

    store.setColorMapColumn("Vmag");
    store.setColorMap(ColorMap.Inferno);
    store.setColorMapDirection(true);
    store.setColorScalingType(FrameScaling.SQRT);
    store.setColorColumnMin(4, "clipd");
    store.setColorColumnMax(10, "clipd");

    store.setOrientationMapColumn("PA");
    store.setOrientationScalingType(FrameScaling.GAMMA);
    store.setOrientationMin(5, "clipd");
    store.setOrientationMax(11, "clipd");
    store.setAngleMin(30);
    store.setAngleMax(300);

    return store;
}

afterEach(() => {
    CREATED_DISPLAY_STORES.forEach(store => store.dispose());
    CREATED_DISPLAY_STORES.length = 0;
    runInAction(() => CatalogStore.Instance.catalogProfileStores.clear());
});

describe("CatalogDisplayStore display config", () => {
    test("round-trips a configured store through another store", () => {
        const store = createConfiguredStore();
        store.setHeaderTableColumnWidths([160, 80, 70, 110, 240]);
        const config = store.toConfig();

        const restored = createStore();
        expect(restored.applyConfig(config)).toEqual({success: true, errors: []});

        expect(restored.toConfig()).toEqual(config);
    });

    test("leaves which rows and columns the catalog holds to its profile store", () => {
        const store = createConfiguredStore();
        const profileStore = CatalogStore.Instance.catalogProfileStores.get(store.catalogFileId) as CatalogProfileStore;
        profileStore.setHeaderDisplay(false, "Bmag");
        profileStore.setMaxRows(3);
        profileStore.setColumnFilter("> 2", "Fmag");
        profileStore.setTableColumnWidth(180, "Fmag");
        profileStore.setSortingInfo("Fmag", CARTA.SortingType.Descending);

        const displayConfig = store.toConfig() as Record<string, unknown>;
        expect(displayConfig.displayedColumns).toBeUndefined();
        expect(displayConfig.maxRows).toBeUndefined();
        expect(displayConfig.columnSettings).toBeUndefined();
        expect(displayConfig.sorting).toBeUndefined();

        const tableConfig = profileStore.toTableConfig();
        expect(tableConfig).toEqual({
            displayedColumns: ["RA", "DEC", "Fmag", "Vmag", "PA"],
            maxRows: 3,
            columnSettings: {Fmag: {filter: "> 2", width: 180}},
            sorting: {columnName: "Fmag", sortingType: CARTA.SortingType.Descending}
        });

        const restoredProfile = createProfileStore(nextCatalogFileId + 100);
        restoredProfile.applyTableConfig(tableConfig);

        expect(restoredProfile.toTableConfig()).toEqual(tableConfig);
        expect(restoredProfile.catalogFilterRequest.sortColumn).toBe("Fmag");
        expect(restoredProfile.catalogFilterRequest.filterConfigs).toHaveLength(1);
    });

    test("returns fields the config leaves out to their defaults", () => {
        const store = createConfiguredStore();

        store.applyConfig({color: "#123456"});

        expect(store.catalogColor).toBe("#123456");
        expect(store.catalogShape).toBe(CatalogOverlayShape.CIRCLE_LINED);
        expect(store.thickness).toBe(2);
        expect(store.showedCatalogSize).toBe(10);
        expect(store.catalogPlotType).toBe(CatalogPlotType.ImageOverlay);
        expect(store.xAxis).toBe(CatalogOverlay.NONE);
        expect(store.sizeMapColumn).toBe(CatalogOverlay.NONE);
        // Nothing is mapped, so the bounds are back under the data's control and carry no clip.
        expect(store.sizeColumnMin.isExplicit).toBe(false);
        expect(store.toConfig().sizeAxis?.columnMinClip).toBeUndefined();
        expect(store.isSizeAreaMode).toBe(false);
        expect(store.sizeScalingType).toBe(FrameScaling.LINEAR);
        expect(store.sizeMinorMapColumn).toBe(CatalogOverlay.NONE);
        expect(store.colorMapColumn).toBe(CatalogOverlay.NONE);
        expect(store.colorMap).toBe(ColorMap.Viridis);
        expect(store.isInvertedColorMap).toBe(false);
        expect(store.orientationMapColumn).toBe(CatalogOverlay.NONE);
        expect(store.angleMin).toBe(CatalogDisplayStore.MIN_ANGLE);
        expect(store.angleMax).toBe(CatalogDisplayStore.MAX_ANGLE);
    });

    test("keeps numeric defaults when world mode has no mapped data", () => {
        const store = createStore();

        store.setCatalogDisplayMode(CatalogDisplayMode.WORLD);

        expect(store.toConfig()).toMatchObject({
            sizeAxis: {min: {area: 100, diameter: 5}, max: {area: 200, diameter: 20}},
            sizeMinorAxis: {min: {area: 100, diameter: 5}, max: {area: 200, diameter: 20}},
            orientationAxis: {angleMin: CatalogDisplayStore.MIN_ANGLE, angleMax: CatalogDisplayStore.MAX_ANGLE}
        });
    });

    test("keeps the clipped bounds a config carries when the mapped column changes", () => {
        const store = createStore();

        // Changing a mapped column makes the data-derived defaults recompute, which on its own
        // resets the clip to the full data range.
        store.applyConfig({
            sizeAxis: {mapColumn: "Fmag", columnMinClip: 2, columnMaxClip: 8},
            colorAxis: {mapColumn: "Vmag", columnMinClip: 4, columnMaxClip: 10},
            orientationAxis: {mapColumn: "PA", columnMinClip: 5, columnMaxClip: 11}
        });

        expect(store.sizeColumnMin.clipd).toBe(2);
        expect(store.sizeColumnMax.clipd).toBe(8);
        expect(store.colorColumnMin.clipd).toBe(4);
        expect(store.colorColumnMax.clipd).toBe(10);
        expect(store.orientationMin.clipd).toBe(5);
        expect(store.orientationMax.clipd).toBe(11);
    });

    test("clips a mapped column with no stated bounds to the full data range, however often it is applied", () => {
        const store = createStore();
        const config: WorkspaceCatalogConfig = {colorAxis: {mapColumn: "Vmag"}, sizeAxis: {mapColumn: "Fmag"}};

        store.applyConfig(config);

        expect(store.colorColumnMin.clipd).toBe(3);
        expect(store.colorColumnMax.clipd).toBe(12);
        expect(store.sizeColumnMin.clipd).toBe(1);
        expect(store.sizeColumnMax.clipd).toBe(10);

        // The mapped columns no longer change, so nothing recomputes the bounds on our behalf.
        store.applyConfig(config);

        expect(store.colorColumnMin.clipd).toBe(3);
        expect(store.colorColumnMax.clipd).toBe(12);
        expect(store.sizeColumnMin.clipd).toBe(1);
        expect(store.sizeColumnMax.clipd).toBe(10);
    });

    test("restores both size axes when the major axis is locked", () => {
        const store = createStore();
        const config: WorkspaceCatalogConfig = {
            sizeAxis: {mapColumn: "Fmag", columnMinClip: 2, columnMaxClip: 8, columnMinLocked: true, columnMaxLocked: true},
            sizeMinorAxis: {mapColumn: "Bmag", columnMinClip: 2, columnMaxClip: 8}
        };

        store.applyConfig(config);

        expect(store.isSizeColumnMinLocked).toBe(true);
        expect(store.isSizeColumnMaxLocked).toBe(true);
        expect(store.sizeColumnMin.clipd).toBe(2);
        expect(store.sizeColumnMax.clipd).toBe(8);
        expect(store.sizeMinorColumnMin.clipd).toBe(2);
        expect(store.sizeMinorColumnMax.clipd).toBe(8);
    });

    test("accepts a valid mapping before the catalog rows have arrived", () => {
        nextCatalogFileId += 1;
        const profileStore = createProfileStore(nextCatalogFileId);
        runInAction(() => {
            profileStore.clearData();
            profileStore.setLoadingDataStatus(true);
            CatalogStore.Instance.catalogProfileStores.set(nextCatalogFileId, profileStore);
        });
        const store = new CatalogDisplayStore(nextCatalogFileId);
        CREATED_DISPLAY_STORES.push(store);

        const result = store.applyConfig({color: "#123456", sizeAxis: {mapColumn: "Fmag", columnMinClip: 2, columnMaxClip: 8}});

        expect(result).toEqual({success: true, errors: []});
        expect(store.catalogColor).toBe("#123456");
        expect(store.sizeMapColumn).toBe("Fmag");
    });

    test("rejects a config mapped to a column the catalog does not have, without changing anything", () => {
        const store = createStore();
        const before = store.toConfig();

        const result = store.applyConfig({color: "#123456", colorAxis: {mapColumn: "Missing"}});

        expect(result.success).toBe(false);
        expect(result.errors).toEqual(['The color axis is mapped to "Missing", which this catalog does not have']);
        expect(store.toConfig()).toEqual(before);
    });

    test("accepts a config while the catalog data is reloading", () => {
        const store = createStore();

        // A filter change clears the rows and puts the catalog back into loading; the headers stay,
        // so the columns a config names still look resolvable.
        CatalogStore.Instance.catalogProfileStores.get(store.catalogFileId)?.resetFilterRequest();

        const result = store.applyConfig({color: "#123456", sizeAxis: {mapColumn: "Fmag", columnMinClip: 2, columnMaxClip: 8}});

        expect(result).toEqual({success: true, errors: []});
        expect(store.catalogColor).toBe("#123456");
    });

    test("records the overlay that is drawn, not the plot controls it has been left on", () => {
        const store = createStore();
        store.setxAxis("RA");
        store.setyAxis("DEC");
        store.setPlottedImageOverlayState("RA", "DEC", CatalogSystemType.ICRS, 4);

        // The panel is then moved on to a histogram of another column, which does not take the
        // overlay down.
        store.setCatalogPlotType(CatalogPlotType.Histogram);
        store.setxAxis("Fmag");

        const config = store.toConfig();

        expect(config.imageOverlay).toEqual({xAxis: "RA", yAxis: "DEC", system: CatalogSystemType.ICRS, maxRows: 4});
        expect(config.plotType).toBe(CatalogPlotType.Histogram);
        expect(config.xAxis).toBe("Fmag");
    });

    test("records the system the overlay was drawn in, not the one the coordinate control has been left on", () => {
        const store = createStore();
        store.setxAxis("RA");
        store.setyAxis("DEC");
        store.setPlottedImageOverlayState("RA", "DEC", CatalogSystemType.ICRS, 4);

        // Changing the coordinate control does not redraw the overlay, so the overlay is still the
        // one that was drawn in ICRS.
        CatalogStore.Instance.catalogProfileStores.get(store.catalogFileId)?.setCatalogCoordinateSystem(CatalogSystemType.Galactic);

        expect(store.toConfig().imageOverlay?.system).toBe(CatalogSystemType.ICRS);
    });

    test("records no overlay for a catalog that has none drawn", () => {
        const store = createStore();
        store.setxAxis("RA");
        store.setyAxis("DEC");

        expect(store.toConfig().imageOverlay).toBeUndefined();
    });

    test("rejects a config whose position column the catalog no longer has", () => {
        const store = createStore();
        const before = store.toConfig();

        const result = store.applyConfig({xAxis: "RA", yAxis: "Declination"});

        expect(result.success).toBe(false);
        expect(result.errors).toEqual(['The y axis is mapped to "Declination", which this catalog does not have']);
        expect(store.toConfig()).toEqual(before);
    });

    test("rejects a config mapped to a non-numeric column", () => {
        const store = createStore();
        const before = store.toConfig();

        const profileStore = CatalogStore.Instance.catalogProfileStores.get(store.catalogFileId);
        runInAction(() => {
            profileStore?.catalogHeader.push(new CARTA.CatalogHeader({columnIndex: 6, dataType: CARTA.ColumnType.String, name: "Name"}));
            profileStore?.catalogControlHeader.set("Name", {columnIndex: 6, dataIndex: 6, display: true, filter: "", columnWidth: null});
        });

        const result = store.applyConfig({color: "#123456", sizeAxis: {mapColumn: "Name"}});

        expect(result.success).toBe(false);
        expect(result.errors).toEqual(['The size axis is mapped to "Name", which is not numeric']);
        expect(store.toConfig()).toEqual(before);
    });

    test("keeps a deliberately clipped bound when more rows arrive", () => {
        const store = createStore();
        store.applyConfig({sizeAxis: {mapColumn: "Fmag", columnMinClip: 2, columnMaxClip: 8}});

        deliverMoreRows(store);

        expect(store.sizeColumnMin.clipd).toBe(2);
        expect(store.sizeColumnMax.clipd).toBe(8);
        // The bounds the data implies still follow it, so the user can reset back to them.
        expect(store.sizeColumnMin.default).toBe(0);
        expect(store.sizeColumnMax.default).toBe(20);
    });

    test.each([
        ["sizeAxis", "setSizeColumnMin", "setSizeColumnMax", "resetSizeColumnValue", "sizeColumnMin", "sizeColumnMax"],
        ["sizeMinorAxis", "setSizeMinorColumnMin", "setSizeMinorColumnMax", "resetSizeMinorColumnValue", "sizeMinorColumnMin", "sizeMinorColumnMax"],
        ["colorAxis", "setColorColumnMin", "setColorColumnMax", "resetColorColumnValue", "colorColumnMin", "colorColumnMax"],
        ["orientationAxis", "setOrientationMin", "setOrientationMax", "resetOrientationValue", "orientationMin", "orientationMax"]
    ] as const)("resets %s bounds to follow streamed data", (axis, setMin, setMax, reset, min, max) => {
        const store = createStore();
        store.applyConfig({[axis]: {mapColumn: "Fmag"}});
        store[setMin](2, "clipd");
        store[setMax](8, "clipd");

        deliverMoreRows(store);

        expect(store[min]).toEqual({default: 0, clipd: 2, isExplicit: true});
        expect(store[max]).toEqual({default: 20, clipd: 8, isExplicit: true});

        store[reset]("min");

        expect(store[min]).toEqual({default: 0, clipd: 0, isExplicit: false});
        expect(store[max]).toEqual({default: 20, clipd: 8, isExplicit: true});
        expect(store.toConfig()[axis]?.columnMinClip).toBeUndefined();
        expect(store.toConfig()[axis]?.columnMaxClip).toBe(8);

        store[reset]("max");
        deliverMoreRows(store, [-5, 30]);

        expect(store[min]).toEqual({default: -5, clipd: -5, isExplicit: false});
        expect(store[max]).toEqual({default: 30, clipd: 30, isExplicit: false});
        expect(store.toConfig()[axis]?.columnMinClip).toBeUndefined();
        expect(store.toConfig()[axis]?.columnMaxClip).toBeUndefined();
    });

    test("keeps a chosen bound that happens to equal the bound the previous column implied", () => {
        const store = createStore();
        // Fmag spans 1 to 10, so its lower bound settles on 1.
        store.applyConfig({sizeAxis: {mapColumn: "Fmag"}});
        expect(store.sizeColumnMin.clipd).toBe(1);

        // Bmag spans 2 to 11. The chosen lower bound of 1 is not the one Fmag implied by accident;
        // it was asked for, and switching columns must not take it as an automatic bound.
        const config: WorkspaceCatalogConfig = {sizeAxis: {mapColumn: "Bmag", columnMinClip: 1, columnMaxClip: 8}};
        store.applyConfig(config);

        expect(store.sizeColumnMin.clipd).toBe(1);
        expect(store.sizeColumnMax.clipd).toBe(8);
        expect(store.sizeColumnMin.default).toBe(2);
        expect(store.sizeColumnMax.default).toBe(11);

        // And the same config applied again lands in the same place.
        store.applyConfig(config);

        expect(store.sizeColumnMin.clipd).toBe(1);
        expect(store.sizeColumnMax.clipd).toBe(8);
    });

    test("carries the chosen state of a bound across a lock, so it survives being saved", () => {
        const store = createStore();
        // Fmag spans 1 to 10 and Bmag spans 2 to 11, both taken from the data.
        store.applyConfig({sizeAxis: {mapColumn: "Fmag"}, sizeMinorAxis: {mapColumn: "Bmag"}});
        expect(store.sizeColumnMin.isExplicit).toBe(false);
        expect(store.sizeMinorColumnMin.isExplicit).toBe(false);

        store.toggleSizeColumnMinLock();
        store.setSizeColumnMin(2, "clipd");
        store.toggleSizeColumnMinLock();

        expect(store.sizeMinorColumnMin.clipd).toBe(2);
        expect(store.sizeMinorColumnMin.isExplicit).toBe(true);

        // Which is what makes the minor bound survive a round trip rather than falling back to the
        // bound its own column implies.
        const config = store.toConfig();
        expect(config.sizeMinorAxis?.columnMinClip).toBe(2);

        const restored = createStore();
        restored.applyConfig(config);
        expect(restored.sizeMinorColumnMin.clipd).toBe(2);
    });

    test("lets a bound that was tracking the data follow it when more rows arrive", () => {
        const store = createStore();
        store.applyConfig({sizeAxis: {mapColumn: "Fmag"}});
        expect(store.sizeColumnMin.clipd).toBe(1);
        expect(store.sizeColumnMax.clipd).toBe(10);

        deliverMoreRows(store);

        expect(store.sizeColumnMin.clipd).toBe(0);
        expect(store.sizeColumnMax.clipd).toBe(20);
    });

    test("round-trips panel selection and presentation state through layout config", () => {
        const panel = new CatalogPanelStore(7, "catalog-panel-primary");
        panel.setTableSeparatorPosition("40%");
        panel.setSettingsTabId(CatalogSettingsTabs.COLOR);

        expect(panel.toLayoutSettings()).toEqual({
            panelId: "catalog-panel-primary",
            catalogFileId: 7,
            tableSeparatorPosition: "40%",
            settingsTabIdByCatalog: {"7": CatalogSettingsTabs.COLOR}
        });

        const restored = new CatalogPanelStore();
        restored.applyLayoutSettings(panel.toLayoutSettings());
        expect(restored.selectedCatalogId).toBe(7);
        expect(restored.settingsTabId).toBe(CatalogSettingsTabs.COLOR);
        expect(restored.toLayoutSettings()).toEqual(panel.toLayoutSettings());
    });

    test("remembers the settings section of each catalog the panel has shown", () => {
        const panel = new CatalogPanelStore(1, "catalog-panel-primary");
        panel.setSettingsTabId(CatalogSettingsTabs.ORIENTATION);

        panel.setSelectedCatalogId(2);
        expect(panel.settingsTabId).toBe(CatalogSettingsTabs.SIZE);
        panel.setSettingsTabId(CatalogSettingsTabs.COLOR);

        panel.setSelectedCatalogId(1);
        expect(panel.settingsTabId).toBe(CatalogSettingsTabs.ORIENTATION);
        panel.setSelectedCatalogId(2);
        expect(panel.settingsTabId).toBe(CatalogSettingsTabs.COLOR);
    });

    test("keeps the settings section of each panel separate", () => {
        const first = new CatalogPanelStore(7, "catalog-panel-primary");
        const second = new CatalogPanelStore(7, "catalog-panel-secondary");

        first.setSettingsTabId(CatalogSettingsTabs.COLOR);

        expect(second.settingsTabId).toBe(CatalogSettingsTabs.SIZE);
    });

    test("names the catalog of each remembered settings section by the workspace's own ID", () => {
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 7, 3);
        const panel = new CatalogPanelStore(7, "catalog-panel-primary");
        panel.setSettingsTabId(CatalogSettingsTabs.COLOR);

        const workspaceSettings = panel.toLayoutSettings(true);

        expect(workspaceSettings.settingsTabIdByWorkspaceCatalog).toEqual({"3": CatalogSettingsTabs.COLOR});
        expect(workspaceSettings.settingsTabIdByCatalog).toBeUndefined();

        // The workspace opens the catalog again under whichever file ID is free, which is the one
        // the panel has to remember the section against.
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, 9, 3);
        const restored = new CatalogPanelStore(9, "catalog-panel-primary");
        restored.applyLayoutSettings(workspaceSettings);
        // The panel is put back on the catalog the workspace says it was showing, the way the
        // restorer does once the layout has been applied.
        restored.setSelectedCatalogId(9);

        expect(restored.settingsTabId).toBe(CatalogSettingsTabs.COLOR);
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
    });

    test("restores the settings section from a layout written before it was kept per catalog", () => {
        const restored = new CatalogPanelStore();
        restored.applyLayoutSettings({catalogFileId: 3, settingsTabId: CatalogSettingsTabs.ORIENTATION});

        expect(restored.settingsTabId).toBe(CatalogSettingsTabs.ORIENTATION);
        expect(restored.toLayoutSettings().settingsTabIdByCatalog).toEqual({"3": CatalogSettingsTabs.ORIENTATION});
    });
});
