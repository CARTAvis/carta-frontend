import {CatalogPlotType} from "enums";
import {CatalogStore, WidgetsStore} from "stores";

import {CatalogPlotComponent} from "./CatalogPlotComponent";

describe("CatalogPlotComponent catalog selection", () => {
    afterEach(() => {
        WidgetsStore.Instance.catalogPanelWidgets.clear();
        jest.restoreAllMocks();
    });

    test("updates the panel selection when a plot selection is made", () => {
        const catalogStore = CatalogStore.Instance;
        const widgetsStore = WidgetsStore.Instance;
        const profileStore = {
            catalogInfo: {fileId: 7, fileInfo: {name: "test-catalog"}},
            getOriginIndices: jest.fn(() => [12]),
            setSelectedPointIndices: jest.fn()
        };
        const catalogDisplayStore = {
            setCatalogTableAutoScroll: jest.fn()
        };
        const widgetStore = {
            dragMode: "lasso",
            plotType: CatalogPlotType.D2Scatter
        };
        catalogStore.catalogProfileStores.set(7, profileStore as any);
        catalogStore.setCatalogPlots("catalog-plot-component-0", 7, "catalog-plot-0");
        widgetsStore.catalogPlotWidgets.set("catalog-plot-0", widgetStore as any);
        catalogStore.catalogDisplayStores.set(7, catalogDisplayStore as any);
        const panel = widgetsStore.getCatalogPanelStore("catalog-overlay-component-0", 1);
        const component = new CatalogPlotComponent({id: "catalog-plot-0", docked: false} as any);

        component["onLassoSelected"]({points: [{pointIndex: 3}]} as any);
        component.componentWillUnmount();

        expect(panel.selectedCatalogId).toBe(7);
        expect(profileStore.getOriginIndices).toHaveBeenCalledWith([3]);
        expect(profileStore.setSelectedPointIndices).toHaveBeenCalledWith([12], true);
        expect(catalogDisplayStore.setCatalogTableAutoScroll).toHaveBeenCalledWith(true);
    });
});
