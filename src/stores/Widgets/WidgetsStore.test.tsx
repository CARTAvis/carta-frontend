import type React from "react";
import {Actions} from "flexlayout-react";

import {CatalogPlotType, IsoTimePrecision, RelativeTimeReference, RelativeTimeUnit, TimeLabelFormat, TimeScale, TimeZoneMode} from "enums";
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
        widgetsStore.addAnimatorWidget("animator-7", {
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

    test("persists catalog display settings alongside panel layout settings", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const widgetStore = widgetsStore.getCatalogWidgetStore("catalog-overlay-7", 7);
        const displayConfig = {color: "#123456", shape: "circle", size: 12, thickness: 3};
        const displayStore = {toConfig: () => displayConfig};

        CatalogStore.Instance.catalogDisplayStores.set(7, displayStore as any);

        expect(widgetsStore.toWidgetSettingsConfig("catalog-overlay", "catalog-overlay-7")).toEqual({
            ...displayConfig,
            ...widgetStore.toLayoutSettings()
        });

        CatalogStore.Instance.catalogDisplayStores.delete(7);
    });

    test("defers restored catalog display settings until this session selects a catalog", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const displayStore = {applyConfigWhenReady: jest.fn()};
        const widgetSettings = {catalogFileId: 7, catalogColor: "#123456", catalogShape: "circle", catalogSize: 14, panelPosition: "top"};

        CatalogStore.Instance.catalogDisplayStores.set(1, displayStore as any);

        expect((widgetsStore as any).initializeCatalogOverlayWidget(widgetSettings, "catalog-overlay-7")).toBe("catalog-overlay-7");
        expect(CatalogStore.Instance.catalogDisplayStores.has(7)).toBe(false);
        expect(displayStore.applyConfigWhenReady).not.toHaveBeenCalled();

        widgetsStore.updateCatalogPanelSelection(1);

        expect(displayStore.applyConfigWhenReady).toHaveBeenCalledWith({
            ...widgetSettings,
            color: "#123456",
            shape: "circle",
            size: 14
        });

        CatalogStore.Instance.catalogDisplayStores.delete(1);
        CatalogStore.Instance.catalogProfiles.delete("catalog-overlay-7");
    });

    test("binds a restored plot to a catalog from the current session", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const widgetSettings = {plotType: CatalogPlotType.D2Scatter, xColumnName: "Fmag", yColumnName: "Bmag", catalogFileId: 3};

        const widgetStoreId = (widgetsStore as any).initializeCatalogPlotWidget({xColumnName: "None", yColumnName: "None", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-0", widgetSettings);
        const pendingAssociation = CatalogStore.Instance.getAssociatedIdByWidgetId(widgetStoreId);

        expect(pendingAssociation.catalogFileId).toBe(CatalogStore.PENDING_CATALOG_FILE_ID);

        CatalogStore.Instance.bindPendingCatalogPlots(1);
        const {catalogFileId, catalogPlotComponentId} = CatalogStore.Instance.getAssociatedIdByWidgetId(widgetStoreId);

        expect(catalogFileId).toBe(1);
        expect(widgetsStore.toWidgetSettingsConfig("catalog-plot", widgetStoreId)).toEqual(widgetsStore.catalogPlotWidgets.get(widgetStoreId)?.toConfig());

        CatalogStore.Instance.catalogPlots.delete(catalogPlotComponentId);
    });

    test("restores a plot from a layout written before the catalog association was saved", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const widgetSettings = {plotType: CatalogPlotType.D2Scatter, xColumnName: "Fmag", yColumnName: "Bmag"};

        const widgetStoreId = (widgetsStore as any).initializeCatalogPlotWidget({xColumnName: "None", yColumnName: "None", plotType: CatalogPlotType.D2Scatter}, "catalog-plot-0", widgetSettings);
        const {catalogFileId, catalogPlotComponentId} = CatalogStore.Instance.getAssociatedIdByWidgetId(widgetStoreId);

        expect(catalogFileId).toBe(CatalogStore.PENDING_CATALOG_FILE_ID);

        CatalogStore.Instance.catalogPlots.delete(catalogPlotComponentId);
    });

    test("clears both catalog associations when a docked catalog tab is closed", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        widgetsStore.getCatalogWidgetStore("catalog-overlay-7", 7);
        CatalogStore.Instance.catalogProfiles.set("catalog-overlay-7", 7);

        layoutModelMock.getNodeById.mockReturnValue({
            getType: () => "tab",
            getComponent: () => "catalog-overlay",
            getId: () => "catalog-overlay-7"
        });

        widgetsStore.onAction({type: Actions.DELETE_TAB, data: {node: "catalog-overlay-7"}});

        expect(widgetsStore.catalogWidgets.has("catalog-overlay-7")).toBe(false);
        expect(CatalogStore.Instance.catalogProfiles.has("catalog-overlay-7")).toBe(false);
    });

    test("prefers current catalog display fields over legacy fields when restoring", () => {
        const widgetsStore = new (WidgetsStore as any)() as WidgetsStore;
        const displayStore = {applyConfigWhenReady: jest.fn()};
        const widgetSettings = {
            catalogFileId: 7,
            catalogColor: "#123456",
            catalogShape: "circle",
            catalogSize: 14,
            color: "#abcdef",
            shape: "box",
            size: 9
        };

        CatalogStore.Instance.catalogDisplayStores.set(1, displayStore as any);

        (widgetsStore as any).initializeCatalogOverlayWidget(widgetSettings, "catalog-overlay-7");
        widgetsStore.updateCatalogPanelSelection(1);

        expect(displayStore.applyConfigWhenReady).toHaveBeenCalledWith(widgetSettings);

        CatalogStore.Instance.catalogDisplayStores.delete(1);
        CatalogStore.Instance.catalogProfiles.delete("catalog-overlay-7");
    });
});
