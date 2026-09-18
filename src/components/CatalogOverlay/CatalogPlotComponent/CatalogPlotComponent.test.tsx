import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogPlotType, DragMode} from "enums";
import {AppStore, CatalogStore, WidgetsStore} from "stores";

import {CatalogPlotComponent} from "./CatalogPlotComponent";

/** A catalog loaded in this session, as a restored plot's association is matched against. */
function loadCatalog(fileId: number, filename: string) {
    const catalogHeader = [
        new CARTA.CatalogHeader({columnIndex: 0, dataType: CARTA.ColumnType.Double, name: "Fmag"}),
        new CARTA.CatalogHeader({columnIndex: 1, dataType: CARTA.ColumnType.Double, name: "Bmag"}),
        new CARTA.CatalogHeader({columnIndex: 2, dataType: CARTA.ColumnType.UnsupportedType, name: "Unsupported"})
    ];
    const catalogControlHeader = new Map([
        ["Fmag", {dataIndex: 0}],
        ["Bmag", {dataIndex: 1}],
        ["Unsupported", {dataIndex: 2}]
    ]);
    CatalogStore.Instance.catalogProfileStores.set(fileId, {
        catalogInfo: {fileId, directory: "/catalogs", fileInfo: {name: filename}},
        catalogHeader,
        catalogControlHeader,
        get2DPlotData: jest.fn(() => ({wcsX: [], wcsY: []})),
        get1DPlotData: jest.fn(() => ({wcsData: new Float32Array()})),
        getColumnHeader: (columnName: string) => {
            const dataIndex = catalogControlHeader.get(columnName)?.dataIndex;
            return dataIndex !== undefined ? catalogHeader[dataIndex] : undefined;
        }
    } as any);
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
            catalogData: [],
            numVisibleRows: 4,
            get2DPlotData: jest.fn(() => ({wcsX: [0, 10, 20, 30], wcsY: [0, 10, 20, 30]})),
            getOriginIndices: jest.fn(() => [12]),
            setSelectedPointIndices: jest.fn()
        };
        const catalogDisplayStore = {
            setCatalogTableAutoScroll: jest.fn()
        };
        const widgetStore = {
            dragMode: DragMode.Lasso,
            xColumnName: "Fmag",
            yColumnName: "Bmag",
            setIndicator: jest.fn(),
            plotType: CatalogPlotType.D2Scatter
        };
        catalogStore.catalogProfileStores.set(7, profileStore as any);
        catalogStore.setCatalogPlots("catalog-plot-component-0", 7, "catalog-plot-0");
        widgetsStore.catalogPlotWidgets.set("catalog-plot-0", widgetStore as any);
        catalogStore.catalogDisplayStores.set(7, catalogDisplayStore as any);
        const widget = widgetsStore.getCatalogWidgetStore("catalog-overlay-component-0", 1);
        const component = new CatalogPlotComponent({id: "catalog-plot-0", docked: false} as any);

        component["onLassoSelected"]([
            {x: 25, y: 25},
            {x: 35, y: 25},
            {x: 35, y: 35},
            {x: 25, y: 35}
        ]);
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
        // Every component, not just the first: a leftover one keeps its widget-to-component
        // mapping alive, and widget IDs are handed out again from the start of each test.
        Array.from(catalogStore.catalogPlots.keys()).forEach(plotComponentId => catalogStore.clearCatalogPlotsByComponentId(plotComponentId));
        catalogStore.catalogProfileStores.clear();
        widgetsStore.catalogPlotWidgets.clear();
        jest.restoreAllMocks();
    });

    test("drops restored columns the catalog lacks when the layout is applied against a loaded one", () => {
        const addWarning = jest.spyOn(AppStore.Instance.logStore, "addWarning").mockImplementation(jest.fn());
        loadCatalog(11, "first.xml");

        const plotId = (widgetsStore as any).initializeCatalogPlotWidget(plotProps, "catalog-plot-0", {
            ...plotProps,
            xColumnName: "Fmag",
            yColumnName: "Bmag_gone",
            statisticColumnName: "Vmag_gone",
            catalogDirectory: "/catalogs",
            catalogFilename: "first.xml"
        });
        const store = widgetsStore.catalogPlotWidgets.get(plotId)!;

        expect(catalogStore.getAssociatedIdByWidgetId(plotId).catalogFileId).toBe(11);
        expect(store.xColumnName).toBe("Fmag");
        expect(store.yColumnName).toBe(CatalogOverlay.NONE);
        expect(store.statisticColumnName).toBe(CatalogOverlay.NONE);
        expect(addWarning).toHaveBeenCalledWith(expect.stringContaining("Bmag_gone"), ["catalog"]);
    });

    test("drops restored plot columns whose catalog type is unsupported", () => {
        const addWarning = jest.spyOn(AppStore.Instance.logStore, "addWarning").mockImplementation(jest.fn());
        loadCatalog(11, "first.xml");

        const plotId = (widgetsStore as any).initializeCatalogPlotWidget(plotProps, "catalog-plot-0", {
            ...plotProps,
            xColumnName: "Fmag",
            yColumnName: "Unsupported",
            catalogDirectory: "/catalogs",
            catalogFilename: "first.xml"
        });
        const store = widgetsStore.catalogPlotWidgets.get(plotId)!;

        expect(store.xColumnName).toBe("Fmag");
        expect(store.yColumnName).toBe(CatalogOverlay.NONE);
        expect(addWarning).toHaveBeenCalledWith(expect.stringContaining("Unsupported"), ["catalog"]);
    });

    test("keeps a restored plot waiting for its own catalog instead of the first one loaded", () => {
        const {component} = restorePlot();
        expect(component.catalogFileId).toBe(CatalogStore.PENDING_CATALOG_FILE_ID);

        loadCatalog(11, "second.xml");

        expect(component.catalogFileId).toBe(CatalogStore.PENDING_CATALOG_FILE_ID);
        expect(component.widgetStore?.xColumnName).toBe("Fmag");

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

        const remounted = new CatalogPlotComponent({id: plotId, docked: false} as any);
        expect(remounted.componentId).toBe(componentId);
        expect(remounted.catalogFileId).toBe(11);
        expect(remounted.widgetStore).toBe(displayed);
        remounted.componentWillUnmount();

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

        catalogStore.clearCatalogPlotsByFileId(12);
        expect(widgetsStore.catalogPlotWidgets.has(plotId)).toBe(false);

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

        component.handleCatalogFileChange(11);
        expect(component.catalogFileId).toBe(11);
        const displayed = component.widgetStore;
        expect(displayed).toBeDefined();
        expect(displayed).not.toBe(widgetsStore.catalogPlotWidgets.get(plotId));

        expect(widgetsStore.toWidgetSettingsConfig("catalog-plot", plotId)).toEqual({
            ...displayed!.toConfig(),
            catalogFileId: 11,
            catalogDirectory: "/catalogs",
            catalogFilename: "second.xml"
        });
        component.componentWillUnmount();
    });
});
