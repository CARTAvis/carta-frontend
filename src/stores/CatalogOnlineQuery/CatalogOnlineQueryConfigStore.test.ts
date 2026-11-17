import {CatalogDatabase, CatalogSystemType, NumberFormatType, RadiusUnits} from "enums";

import {CatalogOnlineQueryConfigStore, type VizierItem} from "./CatalogOnlineQueryConfigStore";

jest.mock("ast_wrapper", () => ({}));
const MockResetResultSize = jest.fn();
jest.mock("stores", () => ({
    AppStore: {
        Instance: {
            activeFrame: null,
            isCursorFrozen: false
        }
    },
    CatalogOnlineQueryStore: {
        Instance: {
            resetResultSize: () => MockResetResultSize()
        }
    }
}));
jest.mock("utilities", () => ({
    ...jest.requireActual("utilities/catalog/radius"),
    ASTSettingsString: jest.fn(),
    clamp: jest.fn(),
    getPixelValueFromWCS: jest.fn(),
    setAstSystem: jest.fn(),
    transformPoint: jest.fn()
}));

describe("CatalogOnlineQueryConfigStore VizieR selection", () => {
    const createStore = () => new CatalogOnlineQueryConfigStore();
    const table: VizierItem = {name: "I/355/gaiadr3", description: "Gaia DR3"};

    test("adds an item on the first click and removes it on the second click", () => {
        const store = createStore();

        store.toggleVizierSelectedTable(table);
        expect(store.vizierSelectedTableName).toEqual([table]);

        store.toggleVizierSelectedTable({...table});
        expect(store.vizierSelectedTableName).toEqual([]);
    });

    test("does not add the same catalog more than once", () => {
        const store = createStore();

        store.updateVizierSelectedTable(table);
        store.updateVizierSelectedTable({...table});

        expect(store.vizierSelectedTableName).toEqual([table]);
    });
});

describe("CatalogOnlineQueryConfigStore search radius", () => {
    test.each([
        [RadiusUnits.DEGREES, 90],
        [RadiusUnits.ARCMINUTES, 5400],
        [RadiusUnits.ARCSECONDS, 324000]
    ])("limits a radius in %s to 90 degrees", (units, maxRadius) => {
        const store = new CatalogOnlineQueryConfigStore();
        store.setRadiusUnits(units);

        expect(store.maxRadius).toBe(maxRadius);
    });

    test("resets the radius to its default in the units shown", () => {
        const store = new CatalogOnlineQueryConfigStore();
        const radiusInDegree = store.searchRadiusInDegree;
        store.setRadiusUnits(RadiusUnits.ARCMINUTES);

        store.resetSearchRadius();

        expect(store.searchRadius).toBe(radiusInDegree * 60);
    });
});

describe("CatalogOnlineQueryConfigStore in a workspace", () => {
    test("saves the fields of the dialog and applies them again", () => {
        const store = new CatalogOnlineQueryConfigStore();
        store.setCatalogDB(CatalogDatabase.VIZIER);
        store.setCoordsType(CatalogSystemType.Galactic);
        store.setCoordsFormat(NumberFormatType.HMS);
        store.setRadiusUnits(RadiusUnits.ARCMINUTES);
        store.setSearchRadius(12);
        store.updateCenterPixelCoord({x: 10.5, y: 20});
        store.setMaxObjects(50);
        store.setObjectName("M17");
        store.setVizierKeyWords("gaia");

        const config = store.toWorkspaceConfig();
        const restored = new CatalogOnlineQueryConfigStore();
        restored.applyWorkspaceConfig(JSON.parse(JSON.stringify(config)));

        expect(restored.toWorkspaceConfig()).toEqual(config);
        expect(config).toEqual({
            database: CatalogDatabase.VIZIER,
            center: {x: "10.5", y: "20"},
            coordinateSystem: CatalogSystemType.Galactic,
            coordinateFormat: NumberFormatType.HMS,
            radius: 12,
            radiusUnits: RadiusUnits.ARCMINUTES,
            maxObjects: 50,
            objectName: "M17",
            vizierKeywords: "gaia"
        });
    });

    test("saves the listed VizieR tables and the selected ones, shows them again without a query, and clears the list for a workspace without one", () => {
        const store = new CatalogOnlineQueryConfigStore();
        const resourceOf = (name: string, description: string) => ({id: null, name: null, description, coosys: {system: "FK5", equinox: "J2000"}, table: {name, description: null, tableElement: document.createElement("TABLE")}});
        store.setCatalogDB(CatalogDatabase.VIZIER);
        store.setVizierQueryResult(
            new Map([
                ["I/355/gaiadr3", resourceOf("I/355/gaiadr3", "Gaia DR3")],
                ["II/246/out", resourceOf("II/246/out", "2MASS")]
            ])
        );
        store.updateVizierSelectedTable({name: "II/246/out", description: "2MASS"});

        const config = store.toWorkspaceConfig();
        expect(config.vizierTables).toEqual([
            {name: "I/355/gaiadr3", description: "Gaia DR3"},
            {name: "II/246/out", description: "2MASS"}
        ]);
        expect(config.vizierSelectedTables).toEqual(["II/246/out"]);

        const restored = new CatalogOnlineQueryConfigStore();
        restored.applyWorkspaceConfig(JSON.parse(JSON.stringify(config)));
        expect(restored.vizierTable).toEqual([
            {name: "I/355/gaiadr3", description: "Gaia DR3"},
            {name: "II/246/out", description: "2MASS"}
        ]);
        expect(restored.selectedVizierSource.map(source => source?.table.name)).toEqual(["II/246/out"]);
        expect(restored.canLoadVizier).toBe(true);

        const {vizierTables, vizierSelectedTables, ...withoutList} = config;
        restored.applyWorkspaceConfig(withoutList);
        expect([restored.vizierTable, restored.vizierSelectedTableName, vizierTables?.length, vizierSelectedTables?.length]).toEqual([[], [], 2, 1]);
    });

    test("clears the count of the last query of the session, which a workspace does not keep", () => {
        MockResetResultSize.mockClear();
        new CatalogOnlineQueryConfigStore().applyWorkspaceConfig({database: CatalogDatabase.VIZIER} as any);
        expect(MockResetResultSize).toHaveBeenCalledTimes(1);
    });

    test("keeps the value of the session for each saved value that is not valid", () => {
        const store = new CatalogOnlineQueryConfigStore();
        const before = store.toWorkspaceConfig();

        store.applyWorkspaceConfig({database: "NED", center: {x: "a", y: "1"}, coordinateSystem: "B1950", radius: -1, radiusUnits: "miles", maxObjects: 0.5} as never);

        expect(store.toWorkspaceConfig()).toEqual(before);
    });
});
