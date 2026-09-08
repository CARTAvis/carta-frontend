import {CatalogStore} from "stores";

describe("CatalogStore request tracking", () => {
    const catalogStore = CatalogStore.Instance;
    const catalogFileId = 901;

    afterEach(() => {
        catalogStore.completeCatalogRequest(catalogFileId);
    });

    test("accepts the current request and rejects a superseded response", () => {
        catalogStore.registerCatalogRequest(catalogFileId, 11);
        expect(catalogStore.acceptsCatalogResponse(catalogFileId, 11)).toBe(true);

        catalogStore.registerCatalogRequest(catalogFileId, 12);

        expect(catalogStore.acceptsCatalogResponse(catalogFileId, 11)).toBe(false);
        expect(catalogStore.acceptsCatalogResponse(catalogFileId, 12)).toBe(true);
    });

    test("rejects a response that was not registered for the catalog", () => {
        expect(catalogStore.acceptsCatalogResponse(catalogFileId, 10)).toBe(false);

        catalogStore.registerCatalogRequest(catalogFileId, 11);

        expect(catalogStore.acceptsCatalogResponse(catalogFileId, 10)).toBe(false);
    });

    test("rejects responses after the current request is complete", () => {
        catalogStore.registerCatalogRequest(catalogFileId, 21);
        catalogStore.completeCatalogRequest(catalogFileId, 21);

        expect(catalogStore.acceptsCatalogResponse(catalogFileId, 21)).toBe(false);
        expect(catalogStore.acceptsCatalogResponse(catalogFileId)).toBe(true);
    });
});
