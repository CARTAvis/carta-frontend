import {CatalogOverlayComponent} from "components/CatalogOverlay/CatalogOverlayComponent";
import {CatalogStore, WidgetsStore} from "stores";

import {FloatingWidgetManagerComponent} from "./FloatingWidgetManagerComponent";

describe("FloatingWidgetManagerComponent catalog panels", () => {
    afterEach(() => {
        WidgetsStore.Instance.catalogPanelWidgets.clear();
        WidgetsStore.Instance.floatingWidgets = [];
        CatalogStore.Instance.catalogProfiles.clear();
        jest.restoreAllMocks();
    });

    test("removes the panel store when a floating catalog overlay closes", () => {
        const widgetsStore = WidgetsStore.Instance;
        const catalogStore = CatalogStore.Instance;
        const componentId = "catalog-overlay-component-0";
        const panelStore = widgetsStore.getCatalogPanelStore(componentId, 7);
        catalogStore.catalogProfiles.set(componentId, 7);
        widgetsStore.floatingWidgets.push({componentId, id: componentId, type: CatalogOverlayComponent.WidgetConfig.type} as any);

        new FloatingWidgetManagerComponent({}).onFloatingWidgetClosed({componentId, id: componentId, type: CatalogOverlayComponent.WidgetConfig.type} as any);

        expect(widgetsStore.catalogPanelWidgets.has(componentId)).toBe(false);
        expect(catalogStore.catalogProfiles.has(componentId)).toBe(false);
        expect(widgetsStore.floatingWidgets).toHaveLength(0);
        expect(panelStore.selectedCatalogId).toBe(7);
    });
});
