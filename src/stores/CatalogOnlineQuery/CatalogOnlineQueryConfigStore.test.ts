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
