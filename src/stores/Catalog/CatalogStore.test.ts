import {CatalogStore, WidgetsStore} from "stores";

describe("CatalogStore widget selection compatibility", () => {
    const catalogStore = CatalogStore.Instance;
    const widgetsStore = WidgetsStore.Instance;

    afterEach(() => {
        catalogStore.imageAssociatedCatalogId.clear();
        catalogStore.catalogProfiles.clear();
        widgetsStore.catalogWidgets.clear();
    });

    test("resets widget selections even when the legacy map is empty", () => {
        catalogStore.updateImageAssociatedCatalogId(101, [7, 8]);
        const widget = widgetsStore.getCatalogWidgetStore("catalog-widget-0", 99);

        catalogStore.resetActiveCatalogFile(101);

        expect(widget.selectedCatalogId).toBe(7);
        expect(catalogStore.catalogProfiles.get("catalog-widget-0")).toBe(7);
    });

    test("removes stale legacy entries and mirrors every live widget", () => {
        catalogStore.updateImageAssociatedCatalogId(102, [7, 8]);
        const firstWidget = widgetsStore.getCatalogWidgetStore("catalog-widget-0", 7);
        const secondWidget = widgetsStore.getCatalogWidgetStore("catalog-widget-1", 8);
        catalogStore.catalogProfiles.set("catalog-widget-0", 99);
        catalogStore.catalogProfiles.set("closed-widget", 8);

        catalogStore.resetActiveCatalogFile(102);

        expect(firstWidget.selectedCatalogId).toBe(7);
        expect(secondWidget.selectedCatalogId).toBe(8);
        expect(Array.from(catalogStore.catalogProfiles.entries())).toEqual([
            ["catalog-widget-0", 7],
            ["catalog-widget-1", 8]
        ]);
    });
});
