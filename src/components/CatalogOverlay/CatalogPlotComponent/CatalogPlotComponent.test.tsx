import {CatalogPlotType} from "enums";
import {AppStore, CatalogStore, WidgetsStore} from "stores";

import {CatalogPlotComponent} from "./CatalogPlotComponent";

/** A catalog loaded in this session, as a restored plot's association is matched against. */
function loadCatalog(fileId: number, filename: string) {
    CatalogStore.Instance.catalogProfileStores.set(fileId, {catalogInfo: {fileId, directory: "/catalogs", fileInfo: {name: filename}}} as any);
    CatalogStore.Instance.bindPendingCatalogPlots(fileId, {directory: "/catalogs", fileInfo: {name: filename}} as any);
}

describe("CatalogPlotComponent catalog selection", () => {
    afterEach(() => {
        WidgetsStore.Instance.catalogWidgets.clear();
        jest.restoreAllMocks();
    });

    test("updates the widget selection when a plot selection is made", () => {
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
        const widget = widgetsStore.getCatalogWidgetStore("catalog-overlay-component-0", 1);
        const component = new CatalogPlotComponent({id: "catalog-plot-0", docked: false} as any);

        component["onLassoSelected"]({points: [{pointIndex: 3}]} as any);
        component.componentWillUnmount();

        expect(widget.selectedCatalogId).toBe(7);
        expect(profileStore.getOriginIndices).toHaveBeenCalledWith([3]);
        expect(profileStore.setSelectedPointIndices).toHaveBeenCalledWith([12], true);
        expect(catalogDisplayStore.setCatalogTableAutoScroll).toHaveBeenCalledWith(true);
    });
});

describe("CatalogPlotComponent restored plots", () => {
    // The component resolves its stores through AppStore, so the assertions read the same instance.
    const widgetsStore = AppStore.Instance.widgetsStore;
    const catalogStore = CatalogStore.Instance;
    const componentId = "catalog-plot-component-0";
    const plotProps = {xColumnName: "None", yColumnName: "None", plotType: CatalogPlotType.D2Scatter};

    /** A plot restored from a workspace that named "first.xml", with no catalog loaded yet. */
    function restorePlot(): {component: CatalogPlotComponent; plotId: string} {
        const plotId = (widgetsStore as any).initializeCatalogPlotWidget(plotProps, "catalog-plot-0", {
            ...plotProps,
            xColumnName: "Fmag",
            yColumnName: "Bmag",
            catalogDirectory: "/catalogs",
            catalogFilename: "first.xml"
        });
        return {component: new CatalogPlotComponent({id: plotId, docked: false} as any), plotId};
    }

    afterEach(() => {
        catalogStore.clearCatalogPlotsByComponentId(componentId);
        catalogStore.catalogProfileStores.clear();
        widgetsStore.catalogPlotWidgets.clear();
        jest.restoreAllMocks();
    });

    test("keeps a restored plot waiting for its own catalog instead of the first one loaded", () => {
        const {component} = restorePlot();
        expect(component.catalogFileId).toBe(CatalogStore.PENDING_CATALOG_FILE_ID);

        // A catalog the plot was not saved against loads first.
        loadCatalog(11, "second.xml");

        expect(component.catalogFileId).toBe(CatalogStore.PENDING_CATALOG_FILE_ID);
        expect(component.widgetStore?.xColumnName).toBe("Fmag");

        // The catalog it was saved against arrives, and the plot follows its store onto it.
        loadCatalog(12, "first.xml");

        expect(component.catalogFileId).toBe(12);
        expect(component.widgetStore?.xColumnName).toBe("Fmag");
        component.componentWillUnmount();
    });

    test("still resolves a remounted tab and its cleanup after its original catalog closes", () => {
        const {component, plotId} = restorePlot();
        loadCatalog(11, "second.xml");
        loadCatalog(12, "first.xml");
        component.handleCatalogFileChange(11);
        const displayed = component.widgetStore!;
        component.componentWillUnmount();

        catalogStore.clearCatalogPlotsByFileId(12);

        // The tab is remounted under the store that has gone, and must find its component again.
        const remounted = new CatalogPlotComponent({id: plotId, docked: false} as any);
        expect(remounted.componentId).toBe(componentId);
        expect(remounted.catalogFileId).toBe(11);
        expect(remounted.widgetStore).toBe(displayed);
        remounted.componentWillUnmount();

        // Closing that tab must still release the component rather than leaking it.
        catalogStore.clearCatalogPlotsByWidgetId(plotId);
        expect(catalogStore.catalogPlots.has(componentId)).toBe(false);
        expect(widgetsStore.catalogPlotWidgets.size).toBe(0);
    });

    test("keeps the shown plot serializable after the catalog it was created with closes", () => {
        const {component, plotId} = restorePlot();
        loadCatalog(11, "second.xml");
        loadCatalog(12, "first.xml");
        component.handleCatalogFileChange(11);
        const displayed = component.widgetStore!;

        // Closing catalog 11's sibling takes away the store the layout tab is named after.
        catalogStore.clearCatalogPlotsByFileId(12);
        expect(widgetsStore.catalogPlotWidgets.has(plotId)).toBe(false);

        // The tab is still identified by that store, and must still save the plot it is showing.
        expect(widgetsStore.getDisplayedCatalogPlotWidget(plotId)).toBe(displayed);
        expect(widgetsStore.toWidgetSettingsConfig("catalog-plot", plotId)).toMatchObject({
            ...displayed.toConfig(),
            catalogFileId: 11
        });
        component.componentWillUnmount();
    });

    test("persists the plot the component is showing rather than the one it was created with", () => {
        const {component, plotId} = restorePlot();
        loadCatalog(11, "second.xml");
        loadCatalog(12, "first.xml");

        // Switching the File dropdown leaves the restored store behind a second one.
        component.handleCatalogFileChange(11);
        expect(component.catalogFileId).toBe(11);
        const displayed = component.widgetStore;
        expect(displayed).toBeDefined();
        expect(displayed).not.toBe(widgetsStore.catalogPlotWidgets.get(plotId));

        // The layout still saves under the original widget ID, but gets the plot on screen.
        expect(widgetsStore.toWidgetSettingsConfig("catalog-plot", plotId)).toEqual({
            ...displayed!.toConfig(),
            catalogFileId: 11,
            catalogDirectory: "/catalogs",
            catalogFilename: "second.xml"
        });
        component.componentWillUnmount();
    });
});
