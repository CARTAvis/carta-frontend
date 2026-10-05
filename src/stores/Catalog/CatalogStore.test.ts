import {CatalogStore, WidgetsStore} from "stores";

describe("CatalogStore widget selection", () => {
    const catalogStore = CatalogStore.Instance;
    const widgetsStore = WidgetsStore.Instance;

    afterEach(() => {
        catalogStore.imageAssociatedCatalogId.clear();
        widgetsStore.catalogWidgets.clear();
    });

    test("resets an unavailable widget selection to the first active catalog", () => {
        catalogStore.updateImageAssociatedCatalogId(101, [7, 8]);
        const widget = widgetsStore.getCatalogWidgetStore("catalog-widget-0", 99);

        catalogStore.resetActiveCatalogFile(101);

        expect(widget.selectedCatalogId).toBe(7);
    });

    test("preserves each widget selection when it remains active", () => {
        catalogStore.updateImageAssociatedCatalogId(102, [7, 8]);
        const firstWidget = widgetsStore.getCatalogWidgetStore("catalog-widget-0", 7);
        const secondWidget = widgetsStore.getCatalogWidgetStore("catalog-widget-1", 8);

        catalogStore.resetActiveCatalogFile(102);

        expect(firstWidget.selectedCatalogId).toBe(7);
        expect(secondWidget.selectedCatalogId).toBe(8);
    });
});
