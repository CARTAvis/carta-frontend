const MOCK_APP_STORE = {
    widgetsStore: {
        removeFloatingWidgets: jest.fn(),
        clearDockedWidgets: jest.fn(),
        clearPopoutPositions: jest.fn(),
        initWidgets: jest.fn((_docked: any[], _floating: any[], _persistence: string): string[] => []),
        updateImageWidgetTitle: jest.fn(),
        floatingWidgets: [] as any[],
        toWidgetSettingsConfig: jest.fn(),
        catalogPlotWidgets: new Map()
    },
    catalogStore: {widgetBindings: {displayedForWidget: () => ({widgetId: ""})}},
    alertStore: {showAlert: jest.fn()}
};

jest.mock("stores", () => ({
    AppStore: {Instance: MOCK_APP_STORE},
    AlertStore: {Instance: MOCK_APP_STORE.alertStore},
    CatalogStore: {Instance: {widgetBindings: {layoutSettingsFor: () => undefined}}}
}));
jest.mock("components/Shared", () => ({AppToaster: {show: jest.fn()}, SuccessToast: jest.fn()}));
jest.mock("services", () => ({ApiService: {Instance: {}}}));

import {Model} from "flexlayout-react";
import {runInAction} from "mobx";

import {LayoutConfig, PresetLayout} from "models";
import {V6_LAYOUT} from "models/Layout/V6Layout.fixture";
import {findDeep} from "utilities";

import {LayoutStore} from "./LayoutStore";

/** The widget types a layout config docks, in the order they appear. */
const DockedComponentIds = (node: any): string[] => {
    if (node?.type === "component") {
        return [node.id];
    }
    return (node?.content ?? []).flatMap(DockedComponentIds);
};

describe("LayoutStore layout configs", () => {
    const layoutStore = LayoutStore.Instance;
    const defaultConfig = () => LayoutConfig.getPresetConfig(PresetLayout.DEFAULT);

    beforeEach(() => {
        jest.clearAllMocks();
        // flexlayout-react is mocked for every test; a model here gives back the JSON it was built from.
        (Model.fromJson as jest.Mock).mockImplementation(json => ({setOnAllowDrop: jest.fn(), toJson: () => json}));
        runInAction(() => {
            layoutStore.layoutModel = null;
            layoutStore.currentLayoutName = PresetLayout.DEFAULT;
        });
    });

    test("puts a layout config's widgets in place, naming no saved layout", () => {
        expect(layoutStore.applyLayoutConfig(defaultConfig())).toBe(true);

        expect(MOCK_APP_STORE.widgetsStore.clearDockedWidgets).toHaveBeenCalledTimes(1);
        expect(MOCK_APP_STORE.widgetsStore.initWidgets).toHaveBeenCalledTimes(1);
        const [dockedConfigs, floatingConfigs] = MOCK_APP_STORE.widgetsStore.initWidgets.mock.calls[0];
        expect(dockedConfigs.map((config: any) => config.id)).toEqual(DockedComponentIds(defaultConfig()!.docked));
        expect(floatingConfigs).toEqual([]);
        expect(layoutStore.layoutModel).not.toBeNull();
        expect(layoutStore.currentLayoutName).toBe("");
    });

    test("names the saved layout it applies", () => {
        expect(layoutStore.applyLayout(PresetLayout.CUBEVIEW)).toBe(true);

        expect(layoutStore.currentLayoutName).toBe(PresetLayout.CUBEVIEW);
    });

    test("applies a preset, a saved layout and a dynamic layout as regular layouts, which leave the image view grid alone", () => {
        // A dynamic layout and the layout of the preferences are applied by name, as a preset is.
        layoutStore.applyLayout(PresetLayout.CUBEVIEW);
        layoutStore.applyLayoutConfig(V6_LAYOUT, "v6");

        expect(MOCK_APP_STORE.widgetsStore.initWidgets.mock.calls.map(call => call[2])).toEqual(["regular", "regular"]);
    });

    test("applies a layout saved by CARTA v6.0 with the settings it saved", () => {
        expect(layoutStore.applyLayoutConfig(V6_LAYOUT, "v6")).toBe(true);

        const [dockedConfigs, floatingConfigs] = MOCK_APP_STORE.widgetsStore.initWidgets.mock.calls[0];
        const histogram = dockedConfigs.find((config: any) => config.id === "histogram");
        expect(histogram.widgetSettings).toEqual(findDeep(V6_LAYOUT.docked, (item: any) => item.id === "histogram")[0].widgetSettings);
        expect(dockedConfigs.find((config: any) => config.id === "catalog-plot").plotType).toBe("Histogram");
        expect(floatingConfigs).toEqual(V6_LAYOUT.floating);
    });

    test("applies the layout copy of a workspace in the workspace form, keeping a maximized stack and a PV preview tab", () => {
        const layout = {
            layoutVersion: 2,
            docked: {
                type: "row",
                content: [
                    {type: "stack", content: [{type: "component", id: "image-view"}]},
                    {type: "stack", maximized: true, content: [{type: "component", id: "pv-preview"}]}
                ]
            },
            floating: []
        };

        expect(layoutStore.applyLayoutConfig(layout, "", "workspace")).toBe(true);

        expect(MOCK_APP_STORE.widgetsStore.initWidgets.mock.calls[0][2]).toBe("workspace");
        expect(findDeep(layoutStore.currentLayoutConfig("workspace")?.docked, (item: any) => item.maximized === true)).toHaveLength(1);
        // A regular layout of the same arrangement keeps no maximized stack.
        expect(findDeep(layoutStore.currentLayoutConfig()?.docked, (item: any) => item.maximized === true)).toHaveLength(0);
    });

    test("leaves the current layout in place when the layout copy of a workspace is not valid, or there is no layout", () => {
        layoutStore.applyLayoutConfig(defaultConfig());
        const layoutModel = layoutStore.layoutModel;
        MOCK_APP_STORE.widgetsStore.clearDockedWidgets.mockClear();
        MOCK_APP_STORE.widgetsStore.initWidgets.mockClear();
        jest.spyOn(console, "error").mockImplementation(jest.fn());

        expect(layoutStore.applyLayoutConfig({docked: {type: "not-a-layout"}}, "", "workspace")).toBe(false);
        expect(layoutStore.applyLayoutConfig(undefined)).toBe(false);

        expect(layoutStore.layoutModel).toBe(layoutModel);
        expect(MOCK_APP_STORE.widgetsStore.clearDockedWidgets).not.toHaveBeenCalled();
        expect(MOCK_APP_STORE.widgetsStore.initWidgets).not.toHaveBeenCalled();
        expect(layoutStore.currentLayoutName).toBe("");
    });

    test("applies a regular layout that it saved, with a floating widget at the edge and a PV generator and a channel map docked, as CARTA v6.0 did", () => {
        const layout = {
            layoutVersion: 2,
            docked: {
                type: "row",
                content: [
                    {
                        type: "stack",
                        content: [
                            {type: "component", id: "image-view"},
                            {type: "component", id: "pv-generator"},
                            {type: "component", id: "channel-map-control"}
                        ]
                    }
                ]
            },
            floating: []
        };
        expect(layoutStore.applyLayoutConfig(layout, "first")).toBe(true);
        MOCK_APP_STORE.widgetsStore.floatingWidgets = [{id: "log", type: "log", defaultWidth: 300, defaultHeight: 200, defaultX: 0, defaultY: 0}];
        MOCK_APP_STORE.widgetsStore.initWidgets.mockClear();

        const saved = layoutStore.currentLayoutConfig();
        MOCK_APP_STORE.widgetsStore.floatingWidgets = [];

        // A regular layout is not validated when it is applied, only when it is loaded from the server.
        expect(saved?.floating).toEqual([{type: "component", id: "log", defaultWidth: 300, defaultHeight: 200, defaultX: "", defaultY: ""}]);
        expect(layoutStore.applyLayoutConfig(saved, "second")).toBe(true);
        const [dockedConfigs, floatingConfigs] = MOCK_APP_STORE.widgetsStore.initWidgets.mock.calls[0];
        expect(dockedConfigs.map((config: any) => config.id)).toEqual(["image-view", "pv-generator", "channel-map-control"]);
        expect(floatingConfigs).toEqual(saved?.floating);
    });

    test("passes on what the WCS overlay of the layout copy of a workspace could not apply", () => {
        MOCK_APP_STORE.widgetsStore.initWidgets.mockReturnValueOnce(["The overlay problem"]);
        const problems: string[] = [];

        expect(layoutStore.applyLayoutConfig(defaultConfig(), "", "workspace", problems)).toBe(true);

        expect(problems).toEqual(["The overlay problem"]);
        expect(MOCK_APP_STORE.alertStore.showAlert).not.toHaveBeenCalled();
    });

    test("reports no layout config before a layout is shown", () => {
        expect(layoutStore.currentLayoutConfig()).toBeUndefined();
    });

    test("gives back the layout it shows in the form it was applied from", () => {
        layoutStore.applyLayoutConfig(defaultConfig());

        const config = layoutStore.currentLayoutConfig();

        expect(config).toMatchObject({layoutVersion: LayoutConfig.currentSchemaVersion, floating: []});
        expect(DockedComponentIds(config?.docked)).toEqual(DockedComponentIds(defaultConfig()!.docked));
        expect(LayoutConfig.prepareLayout(config, "regular")).toBeDefined();
    });

    test("records a widget's plot type only in its settings", () => {
        layoutStore.applyLayoutConfig(defaultConfig());
        MOCK_APP_STORE.widgetsStore.toWidgetSettingsConfig.mockImplementation((type: string) => (type === "spatial-profiler" ? {coordinate: "y", plotType: "Steps"} : undefined));

        const profilers = findDeep(layoutStore.currentLayoutConfig()?.docked, (item: any) => item.id === "spatial-profiler");

        expect(profilers.length).toBeGreaterThan(0);
        profilers.forEach((profiler: any) => {
            expect(profiler.widgetSettings).toEqual({coordinate: "y", plotType: "Steps"});
            expect(profiler.plotType).toBeUndefined();
        });
        MOCK_APP_STORE.widgetsStore.toWidgetSettingsConfig.mockReset();
    });
});

describe("LayoutStore.isComponentHidden", () => {
    const layoutStore = LayoutStore.Instance;

    /**
     * Sets a layout whose selected tabs are `shown` and whose other tabs are `hidden`. The tabs are in
     * the tab set `tabSet`, and the layout maximizes the tab set `maximized`.
     */
    function setTabs(shown: string[], hidden: string[], tabSet: unknown = {getType: () => "tabset"}, maximized?: unknown) {
        const tabs = [...shown.map(component => ({component, isVisible: true})), ...hidden.map(component => ({component, isVisible: false}))];
        const model = {
            getMaximizedTabset: () => maximized,
            visitNodes: (visit: (node: unknown) => void) => {
                visit({getType: () => "row"});
                tabs.forEach(tab => visit({getType: () => "tab", getComponent: () => tab.component, isVisible: () => tab.isVisible, getParent: () => tabSet, getLayoutId: () => "main"}));
            }
        };
        runInAction(() => {
            layoutStore.layoutModel = model as unknown as Model;
        });
    }

    afterEach(() => {
        runInAction(() => {
            layoutStore.layoutModel = null;
        });
    });

    test("says a widget is hidden when it is behind another tab or not in the layout", () => {
        setTabs(["histogram"], ["image-view"]);
        expect(layoutStore.isComponentHidden("image-view")).toBe(true);
        expect(layoutStore.isComponentHidden("animator")).toBe(true);
        expect(layoutStore.isComponentHidden("histogram")).toBe(false);
    });

    test("says a widget is hidden when another tab set is maximized, or when its border is closed", () => {
        const tabSet = {getType: () => "tabset"};
        setTabs(["image-view"], [], tabSet, {getType: () => "tabset"});
        expect(layoutStore.isComponentHidden("image-view")).toBe(true);

        setTabs(["image-view"], [], tabSet, tabSet);
        expect(layoutStore.isComponentHidden("image-view")).toBe(false);

        setTabs(["image-view"], [], {getType: () => "border", isShowing: () => false});
        expect(layoutStore.isComponentHidden("image-view")).toBe(true);

        setTabs(["image-view"], [], {getType: () => "border", isShowing: () => true});
        expect(layoutStore.isComponentHidden("image-view")).toBe(false);
    });

    test("says a widget is shown when one of its tabs is shown, and when there is no layout yet", () => {
        setTabs(["image-view"], ["image-view"]);
        expect(layoutStore.isComponentHidden("image-view")).toBe(false);

        runInAction(() => {
            layoutStore.layoutModel = null;
        });
        expect(layoutStore.isComponentHidden("image-view")).toBe(false);
    });
});
