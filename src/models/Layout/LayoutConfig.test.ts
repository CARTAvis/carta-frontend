const MOCK_CATALOG_STORE = {widgetBindings: {layoutSettingsFor: jest.fn((_widgetId: string): {plotType: string} | undefined => undefined)}};
jest.mock("stores", () => ({AppStore: {}, CatalogStore: {Instance: MOCK_CATALOG_STORE}}));

import {LayoutConfig} from "./LayoutConfig";
import {REGULAR_WIDGET_SETTINGS, V6_LAYOUT} from "./V6Layout.fixture";

/** A session with two floating widgets. The first widget opened is now on top of the second. */
const CreateSession = (toWidgetSettingsConfig: (type: string, id: string, persistence: string) => object | undefined = () => undefined) => {
    const widgets = [
        {id: "log", type: "log", defaultWidth: 300, defaultHeight: 200, defaultX: 0, defaultY: 0},
        {id: "stats-0", type: "stats", defaultWidth: 400, defaultHeight: 300, defaultX: 40, defaultY: 60}
    ];
    const zIndexes = new Map([
        ["log", 2],
        ["stats-0", 1]
    ]);
    return {
        widgetsStore: {floatingWidgets: widgets, toWidgetSettingsConfig: jest.fn(toWidgetSettingsConfig), catalogPlotWidgets: new Map()},
        zIndexManager: {findIndex: (id: string) => zIndexes.get(id) ?? 0}
    };
};

/** A model with a maximized stack of a histogram, a catalog plot and a statistics widget. */
const MODEL_JSON = {
    global: {},
    layout: {
        type: "row",
        children: [
            {type: "tabset", children: [{type: "tab", id: "image-view", component: "image-view"}]},
            {
                type: "tabset",
                maximized: true,
                children: [
                    // The settings that the tabs got from the layout copy of a workspace.
                    {type: "tab", id: "histogram-0", component: "histogram", config: {widgetSettings: {widgetId: "histogram-a", lineWidth: 2}}},
                    {type: "tab", id: "catalog-plot-0", component: "catalog-plot", config: {widgetSettings: {widgetId: "plot-a", plotType: "Histogram"}}},
                    {type: "tab", id: "stats-0", component: "stats", config: {widgetSettings: {widgetId: "stats-a"}}}
                ]
            }
        ]
    }
};

/** Returns the settings that a widget store gives in each kind of layout. */
const WidgetSettings = (type: string, _id: string, persistence: string): object | undefined => {
    const isWorkspace = persistence === "workspace";
    switch (type) {
        case "histogram":
            return isWorkspace ? {...REGULAR_WIDGET_SETTINGS.histogram, widgetId: "histogram-a", autoBins: true} : {...REGULAR_WIDGET_SETTINGS.histogram, widgetId: "stale"};
        case "catalog-plot":
            return isWorkspace ? {widgetId: "plot-a", plotType: "Histogram", dragMode: false} : undefined;
        case "stats":
            return isWorkspace ? {widgetId: "stats-a"} : undefined;
        case "image-view":
            return isWorkspace ? {multiPanelEnabled: true} : undefined;
        default:
            return undefined;
    }
};

describe("LayoutConfig.createConfigToSave", () => {
    beforeEach(() => {
        MOCK_CATALOG_STORE.widgetBindings.layoutSettingsFor.mockImplementation(widgetId => (widgetId === "catalog-plot-0" ? {plotType: "Histogram"} : undefined));
    });

    test("saves the floating widgets in the order of their list, and a position of 0 as an empty value, in a regular layout, as CARTA v6.0 did", () => {
        const config = LayoutConfig.createConfigToSave(CreateSession() as never, MODEL_JSON);

        expect(config?.floating).toEqual([
            {type: "component", id: "log", defaultWidth: 300, defaultHeight: 200, defaultX: "", defaultY: ""},
            {type: "component", id: "stats", defaultWidth: 400, defaultHeight: 300, defaultX: 40, defaultY: 60}
        ]);
    });

    test("saves the floating widgets from the bottom one to the top one, with a position at the edge, in the layout copy of a workspace", () => {
        const config = LayoutConfig.createConfigToSave(CreateSession(WidgetSettings) as never, MODEL_JSON, "workspace");

        expect(config?.floating).toEqual([
            {type: "component", id: "stats", defaultWidth: 400, defaultHeight: 300, defaultX: 40, defaultY: 60, widgetSettings: {widgetId: "stats-a"}},
            {type: "component", id: "log", defaultWidth: 300, defaultHeight: 200, defaultX: 0, defaultY: 0}
        ]);
    });

    test("saves in a regular layout only the settings that CARTA v6.0 saved and the settings added since then, with the type of a catalog plot beside them", () => {
        const config = LayoutConfig.createConfigToSave(CreateSession(WidgetSettings) as never, MODEL_JSON);

        expect(config?.docked).toEqual({
            type: "row",
            content: [
                {type: "stack", content: [{type: "component", id: "image-view"}]},
                {
                    type: "stack",
                    content: [
                        {type: "component", id: "histogram", widgetSettings: REGULAR_WIDGET_SETTINGS.histogram},
                        {type: "component", id: "catalog-plot", plotType: "Histogram"},
                        {type: "component", id: "stats"}
                    ]
                }
            ]
        });
        expect(LayoutConfig.prepareLayout({...config, floating: []})).toBeDefined();
    });

    test("saves in the layout copy of a workspace the widget IDs, the extra settings and the maximized stack", () => {
        const config = LayoutConfig.createConfigToSave(CreateSession(WidgetSettings) as never, MODEL_JSON, "workspace");

        expect(config?.docked).toEqual({
            type: "row",
            content: [
                {type: "stack", content: [{type: "component", id: "image-view", widgetSettings: {multiPanelEnabled: true}}]},
                {
                    type: "stack",
                    maximized: true,
                    content: [
                        {type: "component", id: "histogram", widgetSettings: {...REGULAR_WIDGET_SETTINGS.histogram, widgetId: "histogram-a", autoBins: true}},
                        {type: "component", id: "catalog-plot", widgetSettings: {widgetId: "plot-a", plotType: "Histogram", dragMode: false}},
                        {type: "component", id: "stats", widgetSettings: {widgetId: "stats-a"}}
                    ]
                }
            ]
        });
        expect(LayoutConfig.prepareLayout(config, "workspace")).toBeDefined();
    });
});

describe("LayoutConfig.createConfigToApply", () => {
    const stacks = [
        {type: "stack", content: []},
        {type: "stack", maximized: true, content: []}
    ];

    test("keeps a maximized stack maximized in the layout copy of a workspace", () => {
        const applied: any[] = [];
        LayoutConfig.createConfigToApply(applied, stacks, [], "workspace");

        expect(applied.map(stack => stack.maximized)).toEqual([undefined, true]);
    });

    test("applies no maximized stack in a regular layout, as CARTA v6.0 did", () => {
        const applied: any[] = [];
        LayoutConfig.createConfigToApply(applied, stacks, []);

        expect(applied.map(stack => stack.maximized)).toEqual([undefined, undefined]);
    });
});

describe("LayoutConfig.prepareLayout", () => {
    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(jest.fn());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("accepts a layout saved by CARTA v6.0 as a regular layout", () => {
        expect(LayoutConfig.prepareLayout(V6_LAYOUT)).toEqual(V6_LAYOUT);
    });

    test("validates the layout copy of a workspace by the workspace schema, which allows a PV preview tab, a maximized stack and a widget at the edge", () => {
        const layout = {
            layoutVersion: 2,
            docked: {
                type: "row",
                content: [
                    {type: "stack", maximized: true, content: [{type: "component", id: "image-view"}]},
                    {
                        type: "stack",
                        content: [
                            {type: "component", id: "pv-preview"},
                            {type: "component", id: "pv-generator", widgetSettings: {widgetId: "pv-a"}}
                        ]
                    }
                ]
            },
            floating: [{type: "component", id: "channel-map-control", defaultWidth: 300, defaultHeight: 200, defaultX: 0, defaultY: 0}]
        };

        expect(LayoutConfig.prepareLayout(layout, "workspace")).toEqual(layout);
        // The layout schema does not allow these yet.
        expect(LayoutConfig.prepareLayout(layout)).toBeUndefined();
    });

    test("does not change the layout it validates", () => {
        const layout = {layoutVersion: 2, docked: {type: "row", content: [{type: "component", id: "image-view"}]}, floating: []};
        const copy = JSON.parse(JSON.stringify(layout));

        LayoutConfig.prepareLayout(layout, "workspace");

        expect(layout).toEqual(copy);
    });
});

describe("LayoutConfig.REGULAR_WIDGET_SETTINGS", () => {
    test("lists the settings of a layout saved by CARTA v6.0 and the settings added since then", () => {
        Object.entries(REGULAR_WIDGET_SETTINGS).forEach(([type, settings]) => expect([...LayoutConfig.REGULAR_WIDGET_SETTINGS[type]].sort()).toEqual(Object.keys(settings).sort()));
        expect(Object.keys(LayoutConfig.REGULAR_WIDGET_SETTINGS).sort()).toEqual(Object.keys(REGULAR_WIDGET_SETTINGS).sort());
    });
});
