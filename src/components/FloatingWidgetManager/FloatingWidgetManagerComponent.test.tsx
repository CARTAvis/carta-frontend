import {CatalogOverlayComponent} from "components/CatalogOverlay/CatalogOverlayComponent";
import {CatalogStore, WidgetsStore} from "stores";

import {FloatingWidgetManagerComponent} from "./FloatingWidgetManagerComponent";

describe("FloatingWidgetManagerComponent catalog widgets", () => {
    afterEach(() => {
        WidgetsStore.Instance.catalogWidgets.clear();
        WidgetsStore.Instance.floatingWidgets = [];
        jest.restoreAllMocks();
    });

    test("removes the widget store when a floating catalog overlay closes", () => {
        const widgetsStore = WidgetsStore.Instance;
        const componentId = "catalog-overlay-component-0";
        widgetsStore.getCatalogWidgetStore(componentId, 7);
        widgetsStore.floatingWidgets.push({componentId, id: componentId, type: CatalogOverlayComponent.WidgetConfig.type} as any);

        new FloatingWidgetManagerComponent({}).onFloatingWidgetClosed({componentId, id: componentId, type: CatalogOverlayComponent.WidgetConfig.type} as any);

        expect(widgetsStore.catalogWidgets.has(componentId)).toBe(false);
        expect(widgetsStore.floatingWidgets).toHaveLength(0);
        // The catalog it showed goes with it.
        expect(CatalogStore.Instance.widgetBindings.catalogOf(componentId)).toBeUndefined();
    });
});
