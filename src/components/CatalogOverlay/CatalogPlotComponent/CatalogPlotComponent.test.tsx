import {CARTA} from "carta-protobuf";
import * as GSL from "gsl_wrapper";

import {CatalogOverlay, CatalogPlotType, DragMode, WorkspaceItemKind} from "enums";
import {type WorkspaceCatalogWidgetConfig} from "models";
import {AppStore, CatalogStore, WidgetsStore, WorkspaceIdRegistry} from "stores";
import {CatalogHistogramInteraction} from "utilities";

import {CatalogPlotComponent} from "./CatalogPlotComponent";

/** A catalog loaded in this session, under the workspace ID a restored plot names it by. */
function loadCatalog(fileId: number, filename: string, workspaceCatalogId?: number) {
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
        selectedPointIndices: [],
        catalogHeader,
        catalogControlHeader,
        get2DPlotData: jest.fn(() => ({wcsX: [], wcsY: []})),
        get1DPlotData: jest.fn(() => ({wcsData: new Float32Array()})),
        getColumnHeader: (columnName: string) => {
            const dataIndex = catalogControlHeader.get(columnName)?.dataIndex;
            return dataIndex !== undefined ? catalogHeader[dataIndex] : undefined;
        }
    } as any);
    if (workspaceCatalogId !== undefined) {
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, fileId, workspaceCatalogId);
    }
}

/** The workspace's own ID for the catalog a restored plot was saved against. */
const FIRST_CATALOG_WORKSPACE_ID = 5;

describe("CatalogPlotComponent catalog selection", () => {
    afterEach(() => {
        WidgetsStore.Instance.catalogWidgets.clear();
        // Plot widget IDs are handed out again from the start of each suite, so a component left
        // holding one here would be found by the next suite's lookups.
        CatalogStore.Instance.widgetBindings.componentIds().forEach(plotComponentId => CatalogStore.Instance.widgetBindings.closeComponent(plotComponentId));
        jest.restoreAllMocks();
    });

    test("updates the widget selection when a plot selection is made", () => {
        const catalogStore = CatalogStore.Instance;
        const widgetsStore = WidgetsStore.Instance;
        const profileStore = {
            catalogInfo: {fileId: 7, fileInfo: {name: "test-catalog"}},
            selectedPointIndices: [],
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
        catalogStore.widgetBindings.register("catalog-plot-component-0", 7, "catalog-plot-0");
        widgetsStore.catalogPlotWidgets.set("catalog-plot-0", widgetStore as any);
        catalogStore.catalogDisplayStores.set(7, catalogDisplayStore as any);
        widgetsStore.getCatalogWidgetStore("catalog-overlay-component-0", 1);
        const component = new CatalogPlotComponent({id: "catalog-plot-0", docked: false} as any);

        component["onLassoSelected"]([
            {x: 25, y: 25},
            {x: 35, y: 25},
            {x: 35, y: 35},
            {x: 25, y: 35}
        ]);
        component.componentWillUnmount();

        expect(catalogStore.widgetBindings.catalogOf("catalog-overlay-component-0")).toBe(7);
        expect(profileStore.getOriginIndices).toHaveBeenCalledWith([3]);
        expect(profileStore.setSelectedPointIndices).toHaveBeenCalledWith([12], true);
        expect(catalogDisplayStore.setCatalogTableAutoScroll).toHaveBeenCalledWith(true);
    });

    test("clears the selection when a plot selection contains no sources", () => {
        const component = new CatalogPlotComponent({id: "catalog-plot-0", docked: false} as any);
        const onDeselect = jest.spyOn(component as any, "onDeselect").mockImplementation(() => undefined);

        component["selectCatalogPoints"]([]);

        expect(onDeselect).toHaveBeenCalledTimes(1);
        component.componentWillUnmount();
    });

    test("clears histogram pan state when released outside the plot", () => {
        const interaction = new CatalogHistogramInteraction({
            getChart: () => null,
            getData: () => ({bins: [], binSize: 0, binIndices: []}),
            getBorder: () => undefined,
            setBorder: jest.fn(),
            selectPoints: jest.fn()
        });
        interaction["panPreviousX"] = 10;
        interaction["hasHandledDrag"] = true;

        interaction["onWindowMouseUp"]({clientX: 0} as MouseEvent);

        expect(interaction.consumeHandledDrag()).toBe(false);
    });

    test("selects histogram bins when released outside the plot", () => {
        const selectPoints = jest.fn();
        const interaction = new CatalogHistogramInteraction({
            getChart: () => ({chartArea: {left: 0, right: 100}, canvas: {getBoundingClientRect: () => ({left: 100})}, scales: {x: {getValueForPixel: (pixel: number) => pixel}}, draw: jest.fn()}) as any,
            getData: () => ({
                bins: [
                    {x: 20, y: 1},
                    {x: 60, y: 1}
                ],
                binSize: 20,
                binIndices: [[7], [8]]
            }),
            getBorder: () => undefined,
            setBorder: jest.fn(),
            selectPoints
        });
        interaction["dragStartX"] = 10;
        interaction["dragCurrentX"] = 30;

        interaction["onWindowMouseUp"]({clientX: 170} as MouseEvent);

        expect(selectPoints).toHaveBeenCalledWith([7, 8]);
    });

    test("selects histogram bins on release when no mousemove was recorded", () => {
        const selectPoints = jest.fn();
        const interaction = new CatalogHistogramInteraction({
            getChart: () => ({chartArea: {left: 0, right: 100}, canvas: {getBoundingClientRect: () => ({left: 100})}, scales: {x: {getValueForPixel: (pixel: number) => pixel}}, draw: jest.fn()}) as any,
            getData: () => ({bins: [{x: 20, y: 1}], binSize: 20, binIndices: [[7]]}),
            getBorder: () => undefined,
            setBorder: jest.fn(),
            selectPoints
        });
        interaction["dragStartX"] = 10;

        interaction["onWindowMouseUp"]({clientX: 130} as MouseEvent);

        expect(selectPoints).toHaveBeenCalledWith([7]);
    });
});

describe("CatalogPlotComponent restored plots", () => {
    // The component resolves its stores through AppStore, so the assertions read the same instance.
    const widgetsStore = AppStore.Instance.widgetsStore;
    const catalogStore = CatalogStore.Instance;
    const componentId = "catalog-plot-component-0";
    const plotProps = {xColumnName: "None", yColumnName: "None", plotType: CatalogPlotType.D2Scatter};

    /** What a workspace kept for the plot: the catalog "first.xml" was saved as, and what it was drawn from. */
    const savedPlot = {type: "catalog-plot" as const, catalogId: FIRST_CATALOG_WORKSPACE_ID, xColumnName: "Fmag", yColumnName: "Bmag"};

    /** A plot tab the workspace's layout brought back, known by its stable ID. */
    function restorePlot(): {component: CatalogPlotComponent; plotId: string} {
        const plotId = (widgetsStore as any).initializeCatalogPlotWidget(plotProps, "catalog-plot-0", {plotType: plotProps.plotType, widgetId: "plot-a"});
        return {component: new CatalogPlotComponent({id: plotId, docked: false} as any), plotId};
    }

    /** Attach a restored plot to its catalog, the way WorkspaceRestorer does once it is loaded. */
    function bindRestoredPlot(_plotId: string, catalogFileId: number, config: Partial<WorkspaceCatalogWidgetConfig> = {}) {
        return catalogStore.widgetBindings.restore({"plot-a": {...savedPlot, ...config}}, [{id: FIRST_CATALOG_WORKSPACE_ID, source: {type: "file", filename: "first.xml"}}], new Map([[FIRST_CATALOG_WORKSPACE_ID, catalogFileId]]));
    }

    afterEach(() => {
        // Every component, not just the first: a leftover one keeps its widget-to-component
        // mapping alive, and widget IDs are handed out again from the start of each test.
        catalogStore.widgetBindings.componentIds().forEach(plotComponentId => catalogStore.widgetBindings.closeComponent(plotComponentId));
        catalogStore.catalogProfileStores.clear();
        widgetsStore.catalogPlotWidgets.clear();
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
        jest.restoreAllMocks();
    });

    test("drops restored columns the catalog lacks, and reports them", () => {
        loadCatalog(11, "first.xml", FIRST_CATALOG_WORKSPACE_ID);
        const {component, plotId} = restorePlot();

        // A restored plot is moved onto its catalog, and its columns checked against that catalog.
        const issues = bindRestoredPlot(plotId, 11, {yColumnName: "Bmag_gone", statisticColumnName: "Vmag_gone"});
        const store = widgetsStore.catalogPlotWidgets.get(plotId)!;

        expect(catalogStore.widgetBindings.displayedForWidget(plotId).catalogFileId).toBe(11);
        expect(store.xColumnName).toBe("Fmag");
        expect(store.yColumnName).toBe(CatalogOverlay.NONE);
        expect(store.statisticColumnName).toBe(CatalogOverlay.NONE);
        expect(issues.map(issue => issue.message)).toEqual([expect.stringContaining("column Bmag_gone, column Vmag_gone is unavailable")]);
        component.componentWillUnmount();
    });

    test("drops restored plot columns whose catalog type is unsupported", () => {
        loadCatalog(11, "first.xml", FIRST_CATALOG_WORKSPACE_ID);
        const {component, plotId} = restorePlot();

        const issues = bindRestoredPlot(plotId, 11, {yColumnName: "Unsupported"});
        const store = widgetsStore.catalogPlotWidgets.get(plotId)!;

        expect(store.xColumnName).toBe("Fmag");
        expect(store.yColumnName).toBe(CatalogOverlay.NONE);
        expect(issues.map(issue => issue.message)).toEqual([expect.stringContaining("column Unsupported is unavailable")]);
        component.componentWillUnmount();
    });

    test("still resolves a remounted tab and its cleanup after its original catalog closes", () => {
        const {component, plotId} = restorePlot();
        loadCatalog(11, "second.xml");
        loadCatalog(12, "first.xml", FIRST_CATALOG_WORKSPACE_ID);
        bindRestoredPlot(plotId, 12);
        component.handleCatalogFileChange(11);
        const displayed = component.widgetStore!;
        component.componentWillUnmount();

        catalogStore.widgetBindings.catalogClosed(12);

        const remounted = new CatalogPlotComponent({id: plotId, docked: false} as any);
        expect(remounted.componentId).toBe(componentId);
        expect(remounted.catalogFileId).toBe(11);
        expect(remounted.widgetStore).toBe(displayed);
        remounted.componentWillUnmount();

        catalogStore.widgetBindings.closeWidget(plotId);
        expect(catalogStore.widgetBindings.displayedForComponent(componentId)).toBeUndefined();
        expect(widgetsStore.catalogPlotWidgets.size).toBe(0);
    });

    test("keeps the shown plot serializable after the catalog it was created with closes", () => {
        const {component, plotId} = restorePlot();
        loadCatalog(11, "second.xml");
        loadCatalog(12, "first.xml", FIRST_CATALOG_WORKSPACE_ID);
        bindRestoredPlot(plotId, 12);
        component.handleCatalogFileChange(11);
        const displayed = component.widgetStore!;

        catalogStore.widgetBindings.catalogClosed(12);
        expect(widgetsStore.catalogPlotWidgets.has(plotId)).toBe(false);

        expect(widgetsStore.catalogPlotWidgets.get(catalogStore.widgetBindings.displayedForWidget(plotId).widgetId)).toBe(displayed);
        // A layout keeps the tab's identity and what survives any catalog, naming none.
        expect(widgetsStore.toWidgetSettingsConfig("catalog-plot", plotId)).toEqual({widgetId: "plot-a", ...displayed.toLayoutSettings()});
        component.componentWillUnmount();
    });

    test("persists the plot the component is showing rather than the one it was created with", () => {
        const {component, plotId} = restorePlot();
        loadCatalog(11, "second.xml");
        loadCatalog(12, "first.xml", FIRST_CATALOG_WORKSPACE_ID);
        bindRestoredPlot(plotId, 12);

        component.handleCatalogFileChange(11);
        expect(component.catalogFileId).toBe(11);
        const displayed = component.widgetStore;
        expect(displayed).toBeDefined();
        expect(displayed).not.toBe(widgetsStore.catalogPlotWidgets.get(plotId));

        expect(widgetsStore.toWidgetSettingsConfig("catalog-plot", plotId)).toEqual({widgetId: "plot-a", ...displayed!.toLayoutSettings()});
        component.componentWillUnmount();
    });
});

describe("CatalogPlotComponent linear fit", () => {
    afterEach(() => {
        CatalogStore.Instance.widgetBindings.componentIds().forEach(plotComponentId => CatalogStore.Instance.widgetBindings.closeComponent(plotComponentId));
        CatalogStore.Instance.catalogProfileStores.delete(7);
        WidgetsStore.Instance.catalogPlotWidgets.delete("catalog-plot-0");
        jest.clearAllMocks();
    });

    function createPlot() {
        const profileStore = {
            catalogInfo: {fileId: 7, fileInfo: {name: "test-catalog"}},
            selectedPointIndices: [],
            catalogData: new Map(),
            get2DPlotData: jest.fn(() => ({wcsX: [1, 2, 3], wcsY: [2, 4, NaN]})),
            getSortedIndices: jest.fn((indices: number[]) => indices)
        };
        const widgetStore = {
            plotType: CatalogPlotType.D2Scatter,
            xColumnName: "Fmag",
            yColumnName: "Bmag",
            isFittingEnabled: true,
            setFitting: jest.fn(),
            setIndicator: jest.fn(),
            setMinMaxX: jest.fn()
        };
        CatalogStore.Instance.catalogProfileStores.set(7, profileStore as any);
        CatalogStore.Instance.widgetBindings.register("catalog-plot-component-0", 7, "catalog-plot-0");
        WidgetsStore.Instance.catalogPlotWidgets.set("catalog-plot-0", widgetStore as any);
        const component = new CatalogPlotComponent({id: "catalog-plot-0", docked: false} as any);
        // With fitting on, the plot fits what is shown as soon as it is created.
        jest.clearAllMocks();
        return {component, widgetStore};
    }

    test("draws no line through fewer than two points, and keeps fitting on for the next selection", () => {
        const {component, widgetStore} = createPlot();

        // One point selected, and a second whose value is missing.
        component["handleFittingClick"]([0]);
        component["handleFittingClick"]([1, 2]);
        component.componentWillUnmount();

        expect(GSL.getFittingParameters).not.toHaveBeenCalled();
        expect(widgetStore.setFitting).toHaveBeenCalledTimes(2);
        expect(widgetStore.setFitting).toHaveBeenCalledWith(null);
        expect(widgetStore.setMinMaxX).toHaveBeenCalledWith(null);
    });

    test("fits a line through two points", () => {
        const {component, widgetStore} = createPlot();

        component["handleFittingClick"]([0, 1]);
        component.componentWillUnmount();

        expect(GSL.getFittingParameters).toHaveBeenCalledWith(new Float64Array([1, 2]), new Float64Array([2, 4]));
        expect(widgetStore.setFitting).toHaveBeenCalledWith(expect.objectContaining({slope: 1}));
    });
});
