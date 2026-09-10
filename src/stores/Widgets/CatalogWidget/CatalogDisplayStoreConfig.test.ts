jest.mock("services/CatalogWebGLService", () => ({
    CatalogWebGLService: {
        Instance: {
            updateDataTexture: jest.fn()
        }
    }
}));

import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {AngularSizeUnit, CatalogOverlay, CatalogOverlayShape, CatalogPlotType, CatalogSettingsTabs, CatalogType, ColorMap, FrameScaling} from "enums";
import {type WorkspaceCatalogConfig} from "models/Workspace";
import {CatalogDisplayStore, CatalogProfileStore, CatalogStore, CatalogWidgetStore} from "stores";
import {type ProcessedColumnData} from "utilities";

/** Column data every catalog in these tests carries, so that mapped columns resolve to a range. */
const COLUMNS: ReadonlyArray<{name: string; values: number[]}> = [
    {name: "Fmag", values: [1, 4, 7, 10]},
    {name: "Bmag", values: [2, 5, 8, 11]},
    {name: "Vmag", values: [3, 6, 9, 12]},
    {name: "PA", values: [0, 45, 90, 135]},
    {name: "RA", values: [10, 20, 30, 40]},
    {name: "DEC", values: [-10, -5, 0, 5]}
];

/** A column no axis can be plotted against, for configs that name the wrong kind of column. */
const STRING_COLUMN = "Name";

let nextCatalogFileId = 0;
const CREATED_STORES: CatalogDisplayStore[] = [];

function createProfileStore(catalogFileId: number, scale: number = 1): CatalogProfileStore {
    const catalogHeader = COLUMNS.map((column, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: CARTA.ColumnType.Double, name: column.name}));
    const catalogData = new Map<number, ProcessedColumnData>(COLUMNS.map((column, index) => [index, {dataType: CARTA.ColumnType.Double, data: Float64Array.from(column.values.map(value => value * scale))}]));

    catalogHeader.push(new CARTA.CatalogHeader({columnIndex: COLUMNS.length, dataType: CARTA.ColumnType.String, name: STRING_COLUMN}));
    catalogData.set(COLUMNS.length, {dataType: CARTA.ColumnType.String, data: ["a", "b", "c", "d"]});

    return new CatalogProfileStore({dataSize: COLUMNS[0].values.length, directory: "", fileId: catalogFileId, fileInfo: new CARTA.CatalogFileInfo({name: "test-catalog"})}, catalogHeader, catalogData, CatalogType.FILE);
}

/**
 * A store whose catalog data is loaded, as {@link CatalogDisplayStore.applyConfig} requires. The
 * scale multiplies every column, for a catalog holding the same columns over a different range.
 */
function createStore(scale: number = 1): CatalogDisplayStore {
    nextCatalogFileId += 1;
    const catalogFileId = nextCatalogFileId;
    runInAction(() => CatalogStore.Instance.catalogProfileStores.set(catalogFileId, createProfileStore(catalogFileId, scale)));

    const store = new CatalogDisplayStore(catalogFileId);
    CREATED_STORES.push(store);
    return store;
}

/** A store with no catalog data behind it. */
function createStoreWithoutData(): CatalogDisplayStore {
    nextCatalogFileId += 1;
    const store = new CatalogDisplayStore(nextCatalogFileId);
    CREATED_STORES.push(store);
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
    CREATED_STORES.forEach(store => store.dispose());
    CREATED_STORES.length = 0;
    runInAction(() => CatalogStore.Instance.catalogProfileStores.clear());
});

describe("CatalogDisplayStore display config", () => {
    test("round-trips a configured store through another store", () => {
        const config = createConfiguredStore().toConfig();

        const restored = createStore();
        expect(restored.applyConfig(config)).toEqual({success: true, errors: []});

        expect(restored.toConfig()).toEqual(config);
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
        expect(store.sizeColumnMin.clipd).toBeUndefined();
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

    test("leaves out the clipped bounds of a column the user has not clipped", () => {
        const store = createStore();

        store.applyConfig({sizeAxis: {mapColumn: "Fmag"}, colorAxis: {mapColumn: "Vmag"}});

        // The bounds hold the full data range, which the store recomputes from the data itself.
        expect(store.sizeColumnMin.clipd).toBe(1);
        expect(store.toConfig().sizeAxis?.columnMinClip).toBeUndefined();
        expect(store.toConfig().sizeAxis?.columnMaxClip).toBeUndefined();
        expect(store.toConfig().colorAxis?.columnMinClip).toBeUndefined();
        expect(store.toConfig().colorAxis?.columnMaxClip).toBeUndefined();

        store.setSizeColumnMin(2, "clipd");

        expect(store.toConfig().sizeAxis?.columnMinClip).toBe(2);
        expect(store.toConfig().sizeAxis?.columnMaxClip).toBeUndefined();
    });

    test("clips to the data of the catalog a config is restored onto, rather than the data it was written from", () => {
        const source = createStore();
        source.applyConfig({sizeAxis: {mapColumn: "Fmag"}});

        // The same columns, over ten times the range.
        const target = createStore(10);
        expect(target.applyConfig(source.toConfig())).toEqual({success: true, errors: []});

        expect(target.sizeColumnMin.clipd).toBe(10);
        expect(target.sizeColumnMax.clipd).toBe(100);
    });

    test("keeps a clip the user authored when the data behind it differs", () => {
        const source = createStore();
        source.applyConfig({sizeAxis: {mapColumn: "Fmag"}});
        source.setSizeColumnMin(2, "clipd");
        source.setSizeColumnMax(8, "clipd");

        const target = createStore(10);
        target.applyConfig(source.toConfig());

        expect(target.sizeColumnMin.clipd).toBe(2);
        expect(target.sizeColumnMax.clipd).toBe(8);
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

    test("rejects a config when the catalog data is not loaded, without changing anything", () => {
        const store = createStoreWithoutData();
        const before = store.toConfig();

        const result = store.applyConfig({color: "#123456", sizeAxis: {mapColumn: "Fmag", columnMinClip: 2, columnMaxClip: 8}});

        expect(result.success).toBe(false);
        expect(result.errors).toEqual(["The catalog data has not been loaded"]);
        expect(store.toConfig()).toEqual(before);
    });

    test("retries deferred layout config when catalog data becomes available", () => {
        const store = createStoreWithoutData();
        const catalogFileId = store.catalogFileId;

        expect(store.applyConfigWhenReady({color: "#123456"})).toEqual({success: false, errors: ["The catalog data has not been loaded"]});
        expect(store.catalogColor).not.toBe("#123456");

        runInAction(() => CatalogStore.Instance.catalogProfileStores.set(catalogFileId, createProfileStore(catalogFileId)));

        expect(store.catalogColor).toBe("#123456");
    });

    test("rejects a config mapped to a column the catalog does not have, without changing anything", () => {
        const store = createStore();
        const before = store.toConfig();

        const result = store.applyConfig({color: "#123456", colorAxis: {mapColumn: "Missing"}});

        expect(result.success).toBe(false);
        expect(result.errors).toEqual(['The color axis is mapped to "Missing", which this catalog does not have']);
        expect(store.toConfig()).toEqual(before);
    });

    test("rejects a config whose image overlay axis the catalog does not have, without changing anything", () => {
        const store = createStore();
        const before = store.toConfig();

        const result = store.applyConfig({color: "#123456", xAxis: "RA", yAxis: "Missing"});

        expect(result.success).toBe(false);
        expect(result.errors).toEqual(['The y axis is set to "Missing", which this catalog does not have']);
        expect(store.toConfig()).toEqual(before);
    });

    test("rejects a config whose image overlay axis cannot hold a coordinate, without changing anything", () => {
        const store = createStore();
        const before = store.toConfig();

        const result = store.applyConfig({color: "#123456", xAxis: STRING_COLUMN, yAxis: "DEC"});

        expect(result.success).toBe(false);
        expect(result.errors).toEqual([`The x axis is set to "${STRING_COLUMN}", which is not a numeric column`]);
        expect(store.toConfig()).toEqual(before);
    });

    test("restores image overlay axes the catalog has", () => {
        const store = createStore();

        expect(store.applyConfig({xAxis: "RA", yAxis: "DEC"})).toEqual({success: true, errors: []});

        expect(store.xAxis).toBe("RA");
        expect(store.yAxis).toBe("DEC");
    });

    test("rejects a config while the catalog data is reloading, without changing anything", () => {
        const store = createStore();
        const before = store.toConfig();

        // A filter change clears the rows and puts the catalog back into loading; the headers stay,
        // so the columns a config names still look resolvable.
        CatalogStore.Instance.catalogProfileStores.get(store.catalogFileId)?.resetFilterRequest();

        const result = store.applyConfig({color: "#123456", sizeAxis: {mapColumn: "Fmag", columnMinClip: 2, columnMaxClip: 8}});

        expect(result.success).toBe(false);
        expect(result.errors).toEqual(["The catalog data is still loading"]);
        expect(store.toConfig()).toEqual(before);
    });

    test("rejects a config mapped to a column with no data, without changing anything", () => {
        const store = createStore();
        const before = store.toConfig();

        const profileStore = CatalogStore.Instance.catalogProfileStores.get(store.catalogFileId);
        runInAction(() => {
            profileStore?.clearData();
            profileStore?.setLoadingDataStatus(false);
        });

        const result = store.applyConfig({color: "#123456", sizeAxis: {mapColumn: "Fmag"}});

        expect(result.success).toBe(false);
        expect(result.errors).toEqual(['The size axis is mapped to "Fmag", which has no data to map']);
        expect(store.toConfig()).toEqual(before);
    });

    test("round-trips panel selection and presentation state through layout config", () => {
        const panel = new CatalogWidgetStore(7, "catalog-panel-primary");
        panel.setTableSeparatorPosition("40%");
        panel.setSettingsTabId(CatalogSettingsTabs.COLOR);

        expect(panel.toLayoutSettings()).toEqual({
            widgetId: "catalog-panel-primary",
            catalogFileId: 7,
            tableSeparatorPosition: "40%",
            settingsTabIdByCatalog: {"7": CatalogSettingsTabs.COLOR}
        });

        const restored = new CatalogWidgetStore();
        restored.applyLayoutSettings(panel.toLayoutSettings());
        expect(restored.selectedCatalogId).toBe(7);
        expect(restored.settingsTabId).toBe(CatalogSettingsTabs.COLOR);
        expect(restored.toLayoutSettings()).toEqual(panel.toLayoutSettings());
    });

    test("remembers the settings section of each catalog the panel has shown", () => {
        const panel = new CatalogWidgetStore(1, "catalog-panel-primary");
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
        const first = new CatalogWidgetStore(7, "catalog-panel-primary");
        const second = new CatalogWidgetStore(7, "catalog-panel-secondary");

        first.setSettingsTabId(CatalogSettingsTabs.COLOR);

        expect(second.settingsTabId).toBe(CatalogSettingsTabs.SIZE);
    });

    test("restores the settings section from a layout written before it was kept per catalog", () => {
        const restored = new CatalogWidgetStore();
        restored.applyLayoutSettings({catalogFileId: 3, settingsTabId: CatalogSettingsTabs.ORIENTATION});

        expect(restored.settingsTabId).toBe(CatalogSettingsTabs.ORIENTATION);
        expect(restored.toLayoutSettings().settingsTabIdByCatalog).toEqual({"3": CatalogSettingsTabs.ORIENTATION});
    });
});
