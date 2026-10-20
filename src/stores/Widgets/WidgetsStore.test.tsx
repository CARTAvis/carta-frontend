import type React from "react";
import {Actions} from "flexlayout-react";

import {CatalogPlotType, CatalogSettingsTabs, HelpType, IsoTimePrecision, RelativeTimeReference, RelativeTimeUnit, TimeLabelFormat, TimeScale, TimeZoneMode, WorkspaceItemKind} from "enums";
import {getWidgetMap} from "models/Widget/Widget";
import {FloatingObjzIndexManager} from "models/zindex/zindex";
import {AppStore} from "stores/AppStore/AppStore";
import {CatalogStore} from "stores/Catalog/CatalogStore";
import {LayoutStore} from "stores/LayoutStore/LayoutStore";

import {WidgetsStore} from "./WidgetsStore";

describe("WidgetsStore PV preview test ids", () => {
    const originalSelectTab = Actions.selectTab;
    const appStoreMock = {
        activeImage: null,
        isDarkTheme: false,
        imageViewConfigStore: {visibleImages: []}
    };
    const layoutModelMock = {
        doAction: jest.fn(),
        getNodeById: jest.fn(),
        visitNodes: jest.fn()
    };

    beforeEach(() => {
        (Actions as any).selectTab = jest.fn(tabNodeId => ({type: "FlexLayout_SelectTab", data: {tabNode: tabNodeId}}));
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStoreMock as any);
        jest.spyOn(LayoutStore, "Instance", "get").mockReturnValue({layoutModel: layoutModelMock} as any);
        layoutModelMock.getNodeById.mockReset();
        layoutModelMock.doAction.mockReset();
        layoutModelMock.visitNodes.mockReset();
        CatalogStore.Instance.catalogProfileStores.clear();
        CatalogStore.Instance.catalogDisplayStores.clear();
        CatalogStore.Instance.widgetBindings.componentIds().forEach(componentId => CatalogStore.Instance.widgetBindings.closeComponent(componentId));
    });

    afterEach(() => {
        (Actions as any).selectTab = originalSelectTab;
        jest.restoreAllMocks();
    });

    test("uses the docked tab id for PV preview test ids while preserving the parent widget id for rendering", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const node = {
            getComponent: () => "pv-preview",
            getConfig: () => ({id: "pv-generator-2"}),
            getId: () => "pv-preview-2",
            getName: () => "PV Preview"
        };
        const componentId = (widgetsStore as any).getWidgetComponentId(node as any);
        const testId = (widgetsStore as any).getWidgetTestId(node as any);

        const renderValues: {content?: React.ReactElement<any>} = {};
        widgetsStore.onRenderTab(node as any, renderValues as any);

        expect(componentId).toBe("pv-generator-2");
        expect(testId).toBe("pv-preview-2");
        expect(renderValues.content?.props.nodeId).toBe("pv-preview-2");
    });

    test("uses the docked tab id for PV preview toolbar buttons", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const selectedNode = {
            getComponent: () => "pv-preview",
            getId: () => "pv-preview-3",
            isPoppedOut: () => false
        };
        const tabSetNode = {
            canMaximize: () => false,
            getSelectedNode: () => selectedNode
        };
        const renderValues: {buttons?: React.ReactNode[]} = {};

        widgetsStore.onRenderTabSet(tabSetNode as any, renderValues as any);

        const buttons = (renderValues.buttons || []) as React.ReactElement<any>[];

        expect(buttons).toHaveLength(1);
        expect(buttons[0].props["data-testid"]).toBe("pv-preview-3-header-dock-button");
    });

    test("passes the placeholder label through the docked widget factory", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const node = {
            getComponent: () => "placeholder",
            getConfig: () => ({id: "placeholder-2", label: "Missing widget"}),
            getId: () => "placeholder-2",
            getName: () => "Placeholder"
        };

        const element = widgetsStore.renderWidgetFactory(node as any) as React.ReactElement<any>;
        const children = element.props.children as React.ReactElement<any>[];

        expect(children).toHaveLength(2);
        expect(children[0].props.nodeId).toBe("placeholder-2");
        expect(children[1].props.id).toBe("placeholder-2");
        expect(children[1].props.label).toBe("Missing widget");
        expect(children[1].props.isDocked).toBe(true);
    });

    test("blocks popout actions for non-image tabs", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        layoutModelMock.getNodeById.mockReturnValue({
            getType: () => "tab",
            getComponent: () => "stats"
        });

        const result = widgetsStore.onAction({type: Actions.POPOUT_TAB, data: {node: "stats-0"}});

        expect(result).toBeUndefined();
    });

    test("blocks popout tabset actions when any tab is not image-view", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        layoutModelMock.getNodeById.mockReturnValue({
            getType: () => "tabset",
            getChildren: () => [{getComponent: () => "image-view"}, {getComponent: () => "stats"}]
        });

        const result = widgetsStore.onAction({type: Actions.POPOUT_TABSET, data: {node: "tabset-1"}});

        expect(result).toBeUndefined();
    });

    test("shows a settings button for a docked Animator", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const selectedNode = {
            getComponent: () => "animator",
            getId: () => "animator-0",
            isPoppedOut: () => false
        };
        const tabSetNode = {
            canMaximize: () => false,
            getSelectedNode: () => selectedNode
        };
        const renderValues: {buttons?: React.ReactNode[]} = {};

        widgetsStore.onRenderTabSet(tabSetNode as any, renderValues as any);

        const buttons = (renderValues.buttons || []) as React.ReactElement[];
        expect(buttons.some(button => button.props["data-testid"] === "animator-0-header-settings-button")).toBe(true);
    });

    test("selects the canonical docked widget tab", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const createTab = (id: string, isPoppedOut: boolean = false) => ({
            getComponent: () => "animator",
            getId: () => id,
            getType: () => "tab",
            isPoppedOut: () => isPoppedOut
        });
        const nodes = [createTab("animator-2"), createTab("animator-1", true), createTab("animator")];
        layoutModelMock.visitNodes.mockImplementation(callback => nodes.forEach(callback));

        expect(widgetsStore.selectDockedWidgetTab("animator")).toBe(true);
        expect(Actions.selectTab).toHaveBeenCalledWith("animator");
        expect(layoutModelMock.doAction).toHaveBeenCalledWith({type: "FlexLayout_SelectTab", data: {tabNode: "animator"}});
    });

    test("does not select a widget when only popped-out instances exist", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const poppedOutTab = {
            getComponent: () => "animator",
            getId: () => "animator-1",
            getType: () => "tab",
            isPoppedOut: () => true
        };
        layoutModelMock.visitNodes.mockImplementation(callback => callback(poppedOutTab));

        expect(widgetsStore.selectDockedWidgetTab("animator")).toBe(false);
        expect(layoutModelMock.doAction).not.toHaveBeenCalled();
    });

    test("persists Animator time label settings in widget config", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        widgetsStore.addWidget("animator", "animator-7", {
            timeLabelFormat: TimeLabelFormat.RELATIVE,
            timeZoneMode: TimeZoneMode.IANA,
            ianaTimeZone: "Pacific/Honolulu",
            timeScale: TimeScale.TT,
            isoTimePrecision: IsoTimePrecision.MILLISECOND,
            numericTimePrecision: 5,
            relativeTimeReference: RelativeTimeReference.CUSTOM,
            relativeReferenceMjdUtc: 58000,
            relativeTimeUnit: RelativeTimeUnit.DAY
        });

        expect(widgetsStore.toWidgetSettingsConfig("animator", "animator-7")).toEqual({
            timeLabelFormat: TimeLabelFormat.RELATIVE,
            timeZoneMode: TimeZoneMode.IANA,
            ianaTimeZone: "Pacific/Honolulu",
            timeScale: TimeScale.TT,
            isoTimePrecision: IsoTimePrecision.MILLISECOND,
            numericTimePrecision: 5,
            relativeTimeReference: RelativeTimeReference.CUSTOM,
            relativeReferenceMjdUtc: 58000,
            relativeTimeUnit: RelativeTimeUnit.DAY
        });
    });

    test.each(Array.from(getWidgetMap()).filter(([, registration]) => registration.createStore))("creates a store for a %s widget from its registration", widgetType => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({...appStoreMock, widgetsStore} as any);

        const firstId = widgetsStore.addWidget(widgetType);
        const secondId = widgetsStore.addWidget(widgetType);

        expect(firstId).toEqual(expect.stringContaining(widgetType));
        expect(secondId).not.toBe(firstId);
    });

    test("creates no store for a widget whose registration has none", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;

        expect(widgetsStore.addWidget("image-view")).toBeNull();
        expect(widgetsStore.addWidget("catalog-overlay")).toBeNull();
    });

    test("saves no settings for a widget whose store has none", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const id = widgetsStore.addWidget("layer-list")!;

        expect(widgetsStore.toWidgetSettingsConfig("layer-list", id)).toBeUndefined();
    });

    test("gives a profile widget an ID of its own, kept in the settings its layout saves", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({...appStoreMock, widgetsStore} as any);

        const id = widgetsStore.addWidget("spatial-profiler")!;

        expect(widgetsStore.toWidgetSettingsConfig("spatial-profiler", id)).toEqual(expect.objectContaining({widgetId: id}));
    });

    test("keeps the widget ID a layout saved, though the layout gives the widget another component ID", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;

        const id = widgetsStore.addWidget("stats", "stats-5", {widgetId: "stats-0"})!;

        expect(widgetsStore.toWidgetSettingsConfig("stats", id)).toEqual({widgetId: "stats-0"});
    });

    test("gives a widget another ID when the one its layout saved is already some other widget's", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        widgetsStore.addWidget("stats", "stats-0", {widgetId: "stats-0"});

        const id = widgetsStore.addWidget("stats", "stats-1", {widgetId: "stats-0"})!;

        expect(widgetsStore.toWidgetSettingsConfig("stats", id)).toEqual({widgetId: "stats-0-1"});
    });

    test("saves what each statistics widget shows under its widget ID, and restores it to the widget with that ID", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        widgetsStore.addWidget("stats", "stats-3", {widgetId: "stats-0"});
        widgetsStore.addWidget("stats", "stats-4", {widgetId: "stats-1"});
        widgetsStore.statsWidgets.get("stats-3")!.setCoordinate("Qz");

        const saved = widgetsStore.savedPlotWidgets({imageIdOf: () => undefined});
        expect(saved).toEqual({"stats-0": {type: "stats", coordinate: "Qz"}, "stats-1": {type: "stats", coordinate: "z"}});

        const issues = widgetsStore.restorePlotWidgets({"stats-1": {type: "stats", coordinate: "Uz"}, "stats-9": {type: "stats", coordinate: "Vz"}}, {fileIdOf: () => undefined, regionIdOf: () => undefined});
        expect(issues).toEqual([]);
        expect(widgetsStore.statsWidgets.get("stats-4")!.coordinate).toBe("Uz");
        expect(widgetsStore.statsWidgets.get("stats-3")!.coordinate).toBe("Qz");
    });

    test("reports what a widget could not be pointed at, naming the widget", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        widgetsStore.addWidget("stats", "stats-3", {widgetId: "stats-0"});

        const issues = widgetsStore.restorePlotWidgetBindings({"stats-0": {type: "stats", imageId: 4}}, {fileIdOf: () => undefined, regionIdOf: () => undefined});

        expect(issues).toEqual([{kind: WorkspaceItemKind.PlotWidget, subject: "stats-0", message: "Could not fully restore the widget stats-0: the image it showed was not restored, so it shows the active image"}]);
    });

    test("does not reuse a catalog plot ID retained by an existing layout tab", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        jest.spyOn(WidgetsStore, "Instance", "get").mockReturnValue(widgetsStore);
        const props = {xColumnName: "None", yColumnName: "None", plotType: CatalogPlotType.D2Scatter};
        const oldWidgetId = widgetsStore.addCatalogPlotWidget(props)!;
        const componentId = "catalog-plot-component-retained";

        CatalogStore.Instance.widgetBindings.register(componentId, 7, oldWidgetId);
        CatalogStore.Instance.widgetBindings.catalogClosed(7);

        // The tab keeps a plot of its own type, bound to no catalog, in place of the closed one's.
        expect(CatalogStore.Instance.widgetBindings.displayedForComponent(componentId)?.widgetId).toBe("catalog-plot-1");
        expect(widgetsStore.addCatalogPlotWidget(props)).toBe("catalog-plot-2");

        CatalogStore.Instance.widgetBindings.closeComponent(componentId);
        widgetsStore.catalogPlotWidgets.clear();
    });

    test("restores the settings section of a layout that names a catalog this session does not have", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        jest.spyOn(WidgetsStore, "Instance", "get").mockReturnValue(widgetsStore);

        // Layout V2 named the catalog by the file ID of the session that saved it. Nothing is open
        // here, so the widget shows no catalog, and the section it was left on waits for whichever
        // catalog it shows next rather than stay filed under the ID being replaced.
        (widgetsStore as any).addWidgetByType("catalog-overlay", {catalogFileId: 3, settingsTabId: CatalogSettingsTabs.ORIENTATION}, "catalog-overlay-0");

        const widgetStore = widgetsStore.catalogWidgets.get("catalog-overlay-0")!;
        expect(CatalogStore.Instance.widgetBindings.catalogOf("catalog-overlay-0")).toBeUndefined();
        expect(widgetStore.settingsTabFor(5)).toBe(CatalogSettingsTabs.ORIENTATION);
    });

    test("clears the catalog widget store when a docked catalog tab is closed", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        widgetsStore.getCatalogWidgetStore("catalog-overlay-7", 7);

        layoutModelMock.getNodeById.mockReturnValue({
            getType: () => "tab",
            getComponent: () => "catalog-overlay",
            getId: () => "catalog-overlay-7"
        });

        widgetsStore.onAction({type: Actions.DELETE_TAB, data: {node: "catalog-overlay-7"}});

        expect(widgetsStore.catalogWidgets.has("catalog-overlay-7")).toBe(false);
    });
});

describe("WidgetsStore reloadFloatingCatalogWidget", () => {
    const catalogStore = CatalogStore.Instance;

    beforeEach(() => {
        // A new WidgetsStore titles the image view from the images on screen, of which there are none.
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame: null, imageViewConfigStore: {visibleImages: []}, zIndexManager: {assignIndex: jest.fn()}} as any);
        catalogStore.catalogProfileStores.clear();
    });

    afterEach(() => {
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogImageIds.clear();
        jest.restoreAllMocks();
    });

    test("shows a catalog that is still loaded after one in the middle is closed", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        // Catalogs 1, 2 and 3 were opened and catalog 2 was closed, so two catalogs remain.
        catalogStore.catalogProfileStores.set(1, {} as any);
        catalogStore.catalogProfileStores.set(3, {} as any);

        widgetsStore.reloadFloatingCatalogWidget();

        const [componentId] = Array.from(widgetsStore.catalogWidgets.keys());
        expect(catalogStore.widgetBindings.catalogOf(componentId)).toBe(1);
    });

    test("prefers a loaded catalog of the active image", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        catalogStore.catalogProfileStores.set(1, {} as any);
        catalogStore.catalogProfileStores.set(3, {} as any);
        // The active image still lists catalog 2, which has no profile store.
        const frame = {frameInfo: {fileId: 7}, spatialSiblings: []};
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame: frame, imageViewConfigStore: {visibleFrames: [frame]}, zIndexManager: {assignIndex: jest.fn()}} as any);
        [2, 3].forEach(catalogFileId => catalogStore.catalogImageIds.set(catalogFileId, 7));

        widgetsStore.reloadFloatingCatalogWidget();

        const [componentId] = Array.from(widgetsStore.catalogWidgets.keys());
        expect(catalogStore.widgetBindings.catalogOf(componentId)).toBe(3);
    });

    test("leaves the widget without a catalog when none is loaded", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;

        widgetsStore.reloadFloatingCatalogWidget();

        expect(widgetsStore.catalogWidgets.size).toBe(0);
        expect(widgetsStore.floatingWidgets).toHaveLength(1);
    });
});

describe("WidgetsStore initWidgets", () => {
    beforeEach(() => {
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame: null, imageViewConfigStore: {visibleImages: []}, zIndexManager: {assignIndex: jest.fn()}} as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("brings a restored floating histogram to the front when selected", () => {
        const zIndexManager = new FloatingObjzIndexManager();
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({activeFrame: null, imageViewConfigStore: {visibleImages: []}, zIndexManager} as any);
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;

        widgetsStore.initWidgets([], [{id: "catalog-plot", widgetSettings: {plotType: CatalogPlotType.Histogram}, defaultX: 40, defaultY: 60}]);

        expect(widgetsStore.floatingWidgets).toHaveLength(1);
        const widget = widgetsStore.floatingWidgets[0];
        const id = widget.componentId || widget.id;
        expect(zIndexManager.findIndex(id)).toBe(1);

        zIndexManager.assignIndex("workspace-dialog");
        zIndexManager.updateIndexOnSelect(id);

        expect(zIndexManager.findIndex(id)).toBe(2);
        expect(zIndexManager.findIndex("workspace-dialog")).toBe(1);
    });

    test("creates a line plot by its widget type, even when a layout records its line style as a plot type", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        // An earlier build saved a line plot's plotType setting beside its widget type.
        const componentConfig = {
            id: "spatial-profiler",
            props: {id: "spatial-profiler-1", docked: true},
            widgetSettings: {coordinate: "y", plotType: "Steps"},
            plotType: "Steps"
        };

        widgetsStore.initWidgets([componentConfig], [{type: "component", id: "spatial-profiler", widgetSettings: {coordinate: "y"}, plotType: "Steps"}]);

        expect(widgetsStore.spatialProfileWidgets.get("spatial-profiler-1")?.coordinate).toBe("y");
        expect(Array.from(widgetsStore.spatialProfileWidgets.values()).map(store => store.coordinate)).toEqual(["y", "y"]);
    });

    test("creates a catalog plot by the plot type in its settings", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;

        widgetsStore.initWidgets([{id: "catalog-plot", props: {id: "catalog-plot-0", docked: true}, widgetSettings: {plotType: CatalogPlotType.Histogram}}], []);

        expect(widgetsStore.catalogPlotWidgets.get("catalog-plot-0")?.plotType).toBe(CatalogPlotType.Histogram);
    });

    test.each([
        ["histogram", CatalogPlotType.Histogram, HelpType.CATALOG_HISTOGRAM_PLOT],
        ["scatter", CatalogPlotType.D2Scatter, HelpType.CATALOG_SCATTER_PLOT]
    ])("restores the floating %s plot help button from current and legacy layout settings", (_label, plotType, expectedHelpType) => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;

        widgetsStore.initWidgets(
            [],
            [
                {type: "component", id: "catalog-plot", widgetSettings: {plotType}},
                {type: "component", id: "catalog-plot", plotType}
            ]
        );

        expect(widgetsStore.floatingWidgets).toHaveLength(2);
        widgetsStore.floatingWidgets.forEach(config => {
            expect(widgetsStore.catalogPlotWidgets.get(config.id)?.plotType).toBe(plotType);
            expect(config.helpType).toBe(expectedHelpType);
        });
    });

    test("creates a catalog plot by the plot type beside its settings in a layout saved before they held it", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;

        widgetsStore.initWidgets([{id: "catalog-plot", props: {id: "catalog-plot-0", docked: true}, plotType: CatalogPlotType.Histogram}], []);

        expect(widgetsStore.catalogPlotWidgets.get("catalog-plot-0")?.plotType).toBe(CatalogPlotType.Histogram);
    });
});
