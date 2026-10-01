import {RadiusUnits} from "enums";

import {CatalogOnlineQueryConfigStore, type VizierItem} from "./CatalogOnlineQueryConfigStore";

jest.mock("ast_wrapper", () => ({}));
jest.mock("stores", () => ({
    AppStore: {
        Instance: {
            activeFrame: null,
            isCursorFrozen: false
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
