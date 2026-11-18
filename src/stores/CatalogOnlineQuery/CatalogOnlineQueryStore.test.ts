import {CatalogDatabase, CatalogSystemType, RadiusUnits} from "enums";
import {type WorkspaceCatalogQuerySource} from "models";
import {CatalogApiService} from "services";

import {CatalogOnlineQueryConfigStore} from "./CatalogOnlineQueryConfigStore";
import {CatalogOnlineQueryStore} from "./CatalogOnlineQueryStore";

jest.mock("services", () => ({CatalogApiService: {captureQuery: jest.fn(), Instance: {loadSimbadCatalog: jest.fn(), loadVizierCatalogs: jest.fn()}}}));
jest.mock("./CatalogOnlineQueryConfigStore", () => ({CatalogOnlineQueryConfigStore: {Instance: {catalogDB: "SIMBAD", selectedVizierSource: []}}}));

describe("CatalogOnlineQueryStore source-driven loading", () => {
    const source: WorkspaceCatalogQuerySource = {type: "simbad", center: {x: 12.5, y: -30.25}, system: CatalogSystemType.ICRS, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 500};

    beforeEach(() => {
        jest.clearAllMocks();
        CatalogOnlineQueryConfigStore.Instance.catalogDB = CatalogDatabase.SIMBAD;
        (CatalogOnlineQueryConfigStore.Instance as any).selectedVizierSource = [];
        jest.mocked(CatalogApiService.captureQuery).mockReturnValue(source);
    });

    test("shows the result of the captured SIMBAD source", async () => {
        jest.mocked(CatalogApiService.Instance.loadSimbadCatalog).mockResolvedValue({dataSize: 3, fileId: 7});
        const store = new CatalogOnlineQueryStore();

        await store.queryCatalogs();

        expect(CatalogApiService.Instance.loadSimbadCatalog).toHaveBeenCalledWith(source);
        expect(store.resultSize).toBe(3);
        expect(store.isQuerying).toBe(false);
    });

    test("keeps the selected VizieR tables fixed while their shared query is in flight", async () => {
        const vizierSource: WorkspaceCatalogQuerySource = {...source, type: "vizier", keywords: "gaia"};
        jest.mocked(CatalogApiService.captureQuery).mockReturnValue(vizierSource);
        (CatalogOnlineQueryConfigStore.Instance as any).selectedVizierSource = [{table: {name: "I/355/gaiadr3"}}, {table: {name: "II/246/out"}}];
        let finish!: (fileIds: number[]) => void;
        jest.mocked(CatalogApiService.Instance.loadVizierCatalogs).mockReturnValue(new Promise(resolve => (finish = resolve)));
        const store = new CatalogOnlineQueryStore();

        const loading = store.loadSelectedVizierCatalogs();
        (CatalogOnlineQueryConfigStore.Instance as any).selectedVizierSource = [{table: {name: "other"}}];
        expect(store.isQuerying).toBe(true);
        finish([7, 8]);
        await loading;

        expect(CatalogApiService.Instance.loadVizierCatalogs).toHaveBeenCalledTimes(1);
        expect(CatalogApiService.Instance.loadVizierCatalogs).toHaveBeenCalledWith(vizierSource, ["I/355/gaiadr3", "II/246/out"]);
        expect(store.isQuerying).toBe(false);
    });
});
