import Ajv from "ajv";

import {HistogramSettingsTabs, PlotType, RestFrameShiftMode, SmoothingType, SpatialProfilerSettingsTabs, SpectralProfilerSettingsTabs, StokesAnalysisSettingsTabs, VelocityConvention} from "enums";
import {type ConfigurableStore, type Persisted} from "models";
import {ImageViewConfigStore} from "stores/ImageViewConfig/ImageViewConfigStore";
import {undeclaredFields} from "utilities/schema/pendingSchemaFields";

// load the stores before the widget stores: importing one alone reaches ColormapComponent through a circular import before "utilities" is initialised
import "stores";

import {AnimatorWidgetStore} from "./AnimatorWidgetStore/AnimatorWidgetStore";
import {HistogramWidgetStore} from "./HistogramWidgetStore/HistogramWidgetStore";
import {RenderConfigWidgetStore} from "./RenderConfigWidgetStore/RenderConfigWidgetStore";
import {SpatialProfileWidgetStore} from "./SpatialProfileWidgetStore/SpatialProfileWidgetStore";
import {SpectralProfileWidgetStore} from "./SpectralProfileWidget/SpectralProfileWidgetStore";
import {StatsWidgetStore} from "./StatsWidgetStore/StatsWidgetStore";
import {StokesAnalysisWidgetStore} from "./StokesAnalysisWidgetStore/StokesAnalysisWidgetStore";

const LAYOUT_SCHEMA = require("carta-schemas/layout_schema_2.json");

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

const PLOT = {widgetId: "plot-a", primaryLineColor: "#112233", lineWidth: 2, linePlotPointSize: 3, plotType: PlotType.POINTS};

const WIDGETS: [string, () => ConfigurableStore<object, Persisted<object>>, object][] = [
    ["render config", () => new RenderConfigWidgetStore(), {...PLOT, logScaleY: false, markerTextVisible: false, meanRmsVisible: false}],
    ["histogram", () => new HistogramWidgetStore(), {...PLOT, logScaleY: false, meanRmsVisible: true, settingsTabId: HistogramSettingsTabs.STYLING, autoBins: false, numBins: 40}],
    ["spatial profiler", () => new SpatialProfileWidgetStore(), {...PLOT, coordinate: "y", wcsAxisVisible: false, meanRmsVisible: true, markerTextVisible: true, settingsTabId: SpatialProfilerSettingsTabs.SMOOTHING, smoothing: SMOOTHING}],
    [
        "spectral profiler",
        () => new SpectralProfileWidgetStore(),
        {
            ...PLOT,
            meanRmsVisible: true,
            restFrameShiftMode: RestFrameShiftMode.REDSHIFT,
            restFrameVelocityConvention: VelocityConvention.OPTICAL,
            markerTextVisible: true,
            secondaryAxisCursorInfoVisible: true,
            settingsTabId: SpectralProfilerSettingsTabs.SMOOTHING,
            smoothing: SMOOTHING
        }
    ],
    [
        "Stokes analysis",
        () => new StokesAnalysisWidgetStore(),
        {
            ...PLOT,
            secondaryLineColor: "#445566",
            colorMap: "viridis",
            scatterPlotPointSize: 4,
            pointTransparency: 0.5,
            equalAxes: false,
            invertedColorMap: true,
            fractionalPolVisible: true,
            referenceAxesVisible: false,
            settingsTabId: StokesAnalysisSettingsTabs.SMOOTHING,
            smoothing: SMOOTHING
        }
    ],
    ["statistics", () => new StatsWidgetStore(), {widgetId: "stats-a"}]
];

describe("widget config round trip", () => {
    test.each(WIDGETS)("a %s widget returns the applied config", (_, createStore, config) => {
        const store = createStore();

        store.applyConfig(config);

        expect(store.toConfig()).toEqual(config);
    });

    test.each(WIDGETS.filter(([, , config]) => "primaryLineColor" in config))("a %s widget keeps its line color when the saved one is not a string", (_, createStore) => {
        const store = createStore();
        const color = (store.toConfig() as {primaryLineColor: string}).primaryLineColor;

        store.applyConfig({primaryLineColor: {r: 255, g: 0, b: 0}});

        expect(store.toConfig()).toEqual(expect.objectContaining({primaryLineColor: color}));
    });
});

/** The layout schema's widget for each store, as a layout saves it. */
const LAYOUT_WIDGETS: [string, () => ConfigurableStore<object, Persisted<object>>][] = [
    ["render-config", () => new RenderConfigWidgetStore()],
    ["histogram", () => new HistogramWidgetStore()],
    ["spatial-profiler", () => new SpatialProfileWidgetStore()],
    ["spectral-profiler", () => new SpectralProfileWidgetStore()],
    ["stokes", () => new StokesAnalysisWidgetStore()],
    ["animator", () => new AnimatorWidgetStore()],
    ["stats", () => new StatsWidgetStore()]
];

describe("widget config in a layout", () => {
    const validateWidget = new Ajv({strictTypes: false}).compile({$ref: "#/definitions/carta-widget", definitions: LAYOUT_SCHEMA.definitions});

    test.each(LAYOUT_WIDGETS)("a %s widget writes only fields the layout schema declares", (id, createStore) => {
        const declared = LAYOUT_SCHEMA.definitions[id]?.properties.widgetSettings.properties;

        expect(undeclaredFields(`layout/${id}`, declared, createStore().toConfig())).toEqual([]);
    });

    test.each(LAYOUT_WIDGETS)("a %s widget writes settings the layout schema accepts", (id, createStore) => {
        const widget = JSON.parse(JSON.stringify({type: "component", id, widgetSettings: createStore().toConfig()}));

        expect(validateWidget(widget)).toBe(true);
    });
});

describe("image view grid in a layout", () => {
    const validateWidget = new Ajv({strictTypes: false}).compile({$ref: "#/definitions/carta-widget", definitions: LAYOUT_SCHEMA.definitions});
    const grid = () => ImageViewConfigStore.Instance.toConfig();

    test("writes only fields the layout schema declares", () => {
        expect(undeclaredFields("layout/image-view", LAYOUT_SCHEMA.definitions["image-view"]?.properties.widgetSettings.properties, grid())).toEqual([]);
    });

    test("writes settings the layout schema accepts", () => {
        expect(validateWidget(JSON.parse(JSON.stringify({type: "component", id: "image-view", widgetSettings: grid()})))).toBe(true);
    });
});

describe("smoothing and Stokes settings in a layout", () => {
    test("keeps each smoothing setting a layout saved that the controls would not accept", () => {
        const store = new SpatialProfileWidgetStore();
        const defaults = store.smoothingStore.toConfig();

        store.applyConfig({smoothing: {type: "Median", boxcarSize: 1.5, savitzkyGolayOrder: 6, lineColors: {q: 7}}});

        expect(store.smoothingStore.toConfig()).toEqual(defaults);
    });

    test("draws a Stokes analysis scatter plot in the colormap a layout saved", () => {
        const store = new StokesAnalysisWidgetStore();
        const defaultColors = store.colorPixel;

        store.applyConfig({colorMap: "viridis"});

        expect(store.colorMap).toBe("viridis");
        expect(store.colorPixel).not.toBe(defaultColors);
    });
});
