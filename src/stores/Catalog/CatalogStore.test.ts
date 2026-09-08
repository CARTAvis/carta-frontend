import {CatalogStore, WidgetsStore} from "stores";

describe("CatalogStore panel selection compatibility", () => {
    const catalogStore = CatalogStore.Instance;
    const widgetsStore = WidgetsStore.Instance;

    afterEach(() => {
        catalogStore.imageAssociatedCatalogId.clear();
        catalogStore.catalogProfiles.clear();
        widgetsStore.catalogPanelWidgets.clear();
    });

    test("resets panel selections even when the legacy map is empty", () => {
        catalogStore.updateImageAssociatedCatalogId(101, [7, 8]);
        const panel = widgetsStore.getCatalogPanelStore("catalog-panel-0", 99);

        catalogStore.resetActiveCatalogFile(101);

        expect(panel.selectedCatalogId).toBe(7);
        expect(catalogStore.catalogProfiles.get("catalog-panel-0")).toBe(7);
    });

    test("removes stale legacy entries and mirrors every live panel", () => {
        catalogStore.updateImageAssociatedCatalogId(102, [7, 8]);
        const firstPanel = widgetsStore.getCatalogPanelStore("catalog-panel-0", 7);
        const secondPanel = widgetsStore.getCatalogPanelStore("catalog-panel-1", 8);
        catalogStore.catalogProfiles.set("catalog-panel-0", 99);
        catalogStore.catalogProfiles.set("closed-panel", 8);

        catalogStore.resetActiveCatalogFile(102);

        expect(firstPanel.selectedCatalogId).toBe(7);
        expect(secondPanel.selectedCatalogId).toBe(8);
        expect(Array.from(catalogStore.catalogProfiles.entries())).toEqual([
            ["catalog-panel-0", 7],
            ["catalog-panel-1", 8]
        ]);
    });
});
