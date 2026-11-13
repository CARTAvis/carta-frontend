import Ajv from "ajv";

import {HistogramSettingsTabs, PlotType, SmoothingType, SpatialProfilerSettingsTabs, SpectralProfilerSettingsTabs, StokesAnalysisSettingsTabs} from "enums";
import {type ConfigurableStore, type Persisted, type WorkspaceLayoutConfigurable} from "models";
import {REGULAR_WIDGET_SETTINGS} from "models/Layout/V6Layout.fixture";
import {ImageViewConfigStore} from "stores/ImageViewConfig/ImageViewConfigStore";
import {undeclaredFields} from "utilities/schema/pendingSchemaFields";

// Import the stores before the widget stores. If a widget store is imported alone, a circular import reaches ColormapComponent before "utilities" is initialized.
import "stores";

import {AnimatorWidgetStore} from "./AnimatorWidgetStore/AnimatorWidgetStore";
import {HistogramWidgetStore} from "./HistogramWidgetStore/HistogramWidgetStore";
import {PvGeneratorWidgetStore} from "./PvGeneratorWidgetStore/PvGeneratorWidgetStore";
import {RenderConfigWidgetStore} from "./RenderConfigWidgetStore/RenderConfigWidgetStore";
import {SpatialProfileWidgetStore} from "./SpatialProfileWidgetStore/SpatialProfileWidgetStore";
import {SpectralLineQueryWidgetStore} from "./SpectralLineQueryWidgetStore/SpectralLineQueryWidgetStore";
import {SpectralProfileWidgetStore} from "./SpectralProfileWidget/SpectralProfileWidgetStore";
import {StatsWidgetStore} from "./StatsWidgetStore/StatsWidgetStore";
import {StokesAnalysisWidgetStore} from "./StokesAnalysisWidgetStore/StokesAnalysisWidgetStore";

const LAYOUT_SCHEMA = require("carta-schemas/layout_schema_2.json");
const WORKSPACE_SCHEMA = require("carta-schemas/workspace_schema_2.json");

const SMOOTHING = {
    type: SmoothingType.GAUSSIAN,
    lineColor: "#123123",
    lineType: PlotType.LINES,
    lineWidth: 2,
    pointRadius: 2,
    isOverlayOn: true,
    boxcarSize: 4,
    gaussianSigma: 2.5,
    hanningSize: 5,
    decimationWidth: 4,
    binWidth: 3,
    savitzkyGolaySize: 7,
    savitzkyGolayOrder: 2,
    selectedLine: "q",
    lineColors: {q: "#ff0000"}
};

/** The range of the data that a new store has. The layout copy of a workspace does not apply a saved range. */
const NO_DATA_RANGE = {minXVal: 0, maxXVal: 0, minYVal: 0, maxYVal: 0};

type LayoutWidget = WorkspaceLayoutConfigurable<object> & Partial<ConfigurableStore<object, Persisted<object>>>;

/** The widget stores whose settings a regular layout keeps, by the type of the widget. */
const REGULAR_WIDGETS: [keyof typeof REGULAR_WIDGET_SETTINGS, () => ConfigurableStore<object, Persisted<object>>][] = [
    ["render-config", () => new RenderConfigWidgetStore()],
    ["histogram", () => new HistogramWidgetStore()],
    ["spatial-profiler", () => new SpatialProfileWidgetStore()],
    ["spectral-profiler", () => new SpectralProfileWidgetStore()],
    ["stokes", () => new StokesAnalysisWidgetStore()],
    ["animator", () => new AnimatorWidgetStore()]
];

/** The extra settings that the layout copy of a workspace keeps, by the type of the widget. */
const WORKSPACE_EXTRAS: [string, () => LayoutWidget, object][] = [
    ["render-config", () => new RenderConfigWidgetStore(), {widgetId: "render-a"}],
    ["histogram", () => new HistogramWidgetStore(), {widgetId: "histogram-a", settingsTabId: HistogramSettingsTabs.STYLING, autoBins: false, numBins: 40}],
    ["spatial-profiler", () => new SpatialProfileWidgetStore(), {widgetId: "spatial-a", markerTextVisible: true, settingsTabId: SpatialProfilerSettingsTabs.SMOOTHING, smoothing: SMOOTHING}],
    ["spectral-profiler", () => new SpectralProfileWidgetStore(), {widgetId: "spectral-a", markerTextVisible: true, secondaryAxisCursorInfoVisible: true, settingsTabId: SpectralProfilerSettingsTabs.SMOOTHING, smoothing: SMOOTHING}],
    ["stokes", () => new StokesAnalysisWidgetStore(), {widgetId: "stokes-a", invertedColorMap: true, fractionalPolVisible: true, referenceAxesVisible: false, settingsTabId: StokesAnalysisSettingsTabs.SMOOTHING, smoothing: SMOOTHING}],
    ["stats", () => new StatsWidgetStore(), {widgetId: "stats-a"}],
    ["pv-generator", () => new PvGeneratorWidgetStore(), {widgetId: "pv-a"}],
    ["spectral-line-query", () => new SpectralLineQueryWidgetStore(), {widgetId: "query-a"}]
];

/** Returns the settings that a regular layout keeps for a widget type, with the values that the tests apply. */
function regularSettingsOf(type: string): object {
    return (REGULAR_WIDGET_SETTINGS as Record<string, object>)[type] ?? {};
}

/** Returns a copy of the settings without the range of the data. */
function withoutDataRange(settings: object): object {
    return Object.fromEntries(Object.entries(settings).filter(([key]) => !(key in NO_DATA_RANGE)));
}

describe("widget config in a regular layout", () => {
    test.each(REGULAR_WIDGETS)("a %s widget saves the fields that CARTA v6.0 saved and the fields added since then, and nothing else", (type, createStore) => {
        expect(Object.keys(createStore().toConfig()).sort()).toEqual(Object.keys(regularSettingsOf(type)).sort());
    });

    test.each(REGULAR_WIDGETS)("a %s widget applies a layout saved by CARTA v6.0 and returns it", (type, createStore) => {
        const store = createStore();

        store.applyConfig(regularSettingsOf(type));

        expect(store.toConfig()).toEqual(regularSettingsOf(type));
    });

    test.each(WORKSPACE_EXTRAS.filter(([type]) => type in REGULAR_WIDGET_SETTINGS))("a %s widget applies none of the settings that only the layout copy of a workspace keeps", (_, createStore, extras) => {
        const store = createStore();
        const before = store.toWorkspaceLayoutConfig();

        store.applyConfig?.(extras);

        expect(store.toWorkspaceLayoutConfig()).toEqual(before);
    });

    test.each(REGULAR_WIDGETS.filter(([type]) => "primaryLineColor" in regularSettingsOf(type)))("a %s widget keeps its line color when the saved one is not a string", (_, createStore) => {
        const store = createStore();
        const color = (store.toConfig() as {primaryLineColor: string}).primaryLineColor;

        store.applyConfig({primaryLineColor: {r: 255, g: 0, b: 0}});

        expect(store.toConfig()).toEqual(expect.objectContaining({primaryLineColor: color}));
    });
});

describe("widget config in the layout copy of a workspace", () => {
    test.each(WORKSPACE_EXTRAS)("a %s widget returns the applied config", (type, createStore, extras) => {
        const store = createStore();
        const config = {...withoutDataRange(regularSettingsOf(type)), ...extras};

        store.applyWorkspaceLayoutConfig(config);

        expect(withoutDataRange(store.toWorkspaceLayoutConfig())).toEqual(config);
    });

    test.each(WORKSPACE_EXTRAS.filter(([type]) => "minXVal" in regularSettingsOf(type)))("a %s widget does not apply the range of the data that a regular layout keeps", (type, createStore) => {
        const store = createStore();

        store.applyWorkspaceLayoutConfig(regularSettingsOf(type));

        expect(store.toWorkspaceLayoutConfig()).toEqual(expect.objectContaining(NO_DATA_RANGE));
    });
});

describe("widget config in the layout schema", () => {
    const validateWidget = new Ajv({strictTypes: false}).compile({$ref: "#/definitions/carta-widget", definitions: LAYOUT_SCHEMA.definitions});

    test.each(REGULAR_WIDGETS)("a %s widget writes only fields the layout schema declares", (type, createStore) => {
        const declared = LAYOUT_SCHEMA.definitions[type]?.properties.widgetSettings.properties;

        expect(undeclaredFields(`layout/${type}`, declared, createStore().toConfig())).toEqual([]);
    });

    test.each(REGULAR_WIDGETS)("a %s widget writes settings the layout schema accepts", (type, createStore) => {
        const widget = JSON.parse(JSON.stringify({type: "component", id: type, widgetSettings: createStore().toConfig()}));

        expect(validateWidget(widget)).toBe(true);
    });
});

describe("widget config in the workspace schema", () => {
    const validateWidget = new Ajv({strictTypes: false}).compile({$ref: "#/definitions/layout-carta-widget", definitions: WORKSPACE_SCHEMA.definitions});

    test.each(WORKSPACE_EXTRAS)("a %s widget writes only fields the layout definition of the workspace schema declares", (type, createStore) => {
        const declared = WORKSPACE_SCHEMA.definitions[`layout-${type}`]?.properties.widgetSettings?.properties;

        expect(undeclaredFields(`workspace/layout-${type}`, declared, createStore().toWorkspaceLayoutConfig())).toEqual([]);
    });

    test.each(WORKSPACE_EXTRAS)("a %s widget writes settings the workspace schema accepts", (type, createStore) => {
        const widget = JSON.parse(JSON.stringify({type: "component", id: type, widgetSettings: createStore().toWorkspaceLayoutConfig()}));

        expect(validateWidget(widget)).toBe(true);
    });

    test("writes the image view grid only with fields the workspace schema declares", () => {
        const grid = ImageViewConfigStore.Instance.toConfig();

        expect(undeclaredFields("workspace/layout-image-view", WORKSPACE_SCHEMA.definitions["layout-image-view"]?.properties.widgetSettings.properties, grid)).toEqual([]);
        expect(validateWidget(JSON.parse(JSON.stringify({type: "component", id: "image-view", widgetSettings: grid})))).toBe(true);
    });
});

describe("smoothing and Stokes settings in a layout", () => {
    test("keeps each smoothing setting that the layout copy of a workspace saved that the controls would not accept", () => {
        const store = new SpatialProfileWidgetStore();
        const defaults = store.smoothingStore.toConfig();

        store.applyWorkspaceLayoutConfig({smoothing: {type: "Median", boxcarSize: 1.5, savitzkyGolayOrder: 6, lineColors: {q: 7}}});

        expect(store.smoothingStore.toConfig()).toEqual(defaults);
    });

    test("draws a Stokes analysis scatter plot in the colormap that the layout copy of a workspace saved", () => {
        const store = new StokesAnalysisWidgetStore();
        const defaultColors = store.colorPixel;

        store.applyWorkspaceLayoutConfig({colorMap: "viridis"});

        expect(store.colorMap).toBe("viridis");
        expect(store.colorPixel).not.toBe(defaultColors);
    });

    test("sets only the colormap name of a Stokes analysis widget from a regular layout, as CARTA v6.0 did", () => {
        const store = new StokesAnalysisWidgetStore();
        const defaultColors = store.colorPixel;

        store.applyConfig({colorMap: "viridis"});

        expect(store.colorMap).toBe("viridis");
        expect(store.colorPixel).toBe(defaultColors);
    });
});
