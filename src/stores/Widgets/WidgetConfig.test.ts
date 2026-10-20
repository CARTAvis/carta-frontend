import Ajv from "ajv";

import {PlotType, RestFrameShiftMode, VelocityConvention} from "enums";
import {type ConfigurableStore, type Persisted} from "models";

// load the stores before the widget stores: importing one alone reaches ColormapComponent through a circular import before "utilities" is initialised
import "stores";

import {AnimatorWidgetStore} from "./AnimatorWidgetStore/AnimatorWidgetStore";
import {HistogramWidgetStore} from "./HistogramWidgetStore/HistogramWidgetStore";
import {RenderConfigWidgetStore} from "./RenderConfigWidgetStore/RenderConfigWidgetStore";
import {SpatialProfileWidgetStore} from "./SpatialProfileWidgetStore/SpatialProfileWidgetStore";
import {SpectralProfileWidgetStore} from "./SpectralProfileWidget/SpectralProfileWidgetStore";
import {StokesAnalysisWidgetStore} from "./StokesAnalysisWidgetStore/StokesAnalysisWidgetStore";

const LAYOUT_SCHEMA = require("carta-schemas/layout_schema_2.json");

const PLOT = {primaryLineColor: "#112233", lineWidth: 2, linePlotPointSize: 3, plotType: PlotType.POINTS};
const RANGE = {minXVal: 1, maxXVal: 2, minYVal: 3, maxYVal: 4};

const WIDGETS: [string, () => ConfigurableStore<object, Persisted<object>>, object][] = [
    ["render config", () => new RenderConfigWidgetStore(), {...PLOT, ...RANGE, logScaleY: false, markerTextVisible: false, meanRmsVisible: false}],
    ["histogram", () => new HistogramWidgetStore(), {...PLOT, ...RANGE, logScaleY: false, meanRmsVisible: true}],
    ["spatial profiler", () => new SpatialProfileWidgetStore(), {...PLOT, ...RANGE, coordinate: "y", wcsAxisVisible: false, meanRmsVisible: true}],
    [
        "spectral profiler",
        () => new SpectralProfileWidgetStore(),
        {
            ...PLOT,
            ...RANGE,
            meanRmsVisible: true,
            xAxisRestFrameEnabled: true,
            restFrameRedshift: 0.25,
            restFrameShiftMode: RestFrameShiftMode.REDSHIFT,
            restFrameVelocityConvention: VelocityConvention.OPTICAL,
            yAxisRestFrameEnabled: true
        }
    ],
    ["Stokes analysis", () => new StokesAnalysisWidgetStore(), {...PLOT, secondaryLineColor: "#445566", colorMap: "viridis", scatterPlotPointSize: 4, pointTransparency: 0.5, equalAxes: false}]
];

describe("widget config round trip", () => {
    test.each(WIDGETS)("a %s widget returns the applied config", (_, createStore, config) => {
        const store = createStore();

        store.applyConfig(config);

        expect(store.toConfig()).toEqual(config);
    });

    test.each(WIDGETS)("a %s widget keeps its line color when the saved one is not a string", (_, createStore) => {
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
    ["animator", () => new AnimatorWidgetStore()]
];

describe("widget config in a layout", () => {
    const validateWidget = new Ajv({strictTypes: false}).compile({$ref: "#/definitions/carta-widget", definitions: LAYOUT_SCHEMA.definitions});

    test.each(LAYOUT_WIDGETS)("a %s widget writes only fields the layout schema declares", (id, createStore) => {
        const declared = LAYOUT_SCHEMA.definitions[id].properties.widgetSettings.properties;

        expect(Object.keys(createStore().toConfig()).filter(key => !(key in declared))).toEqual([]);
    });

    test.each(LAYOUT_WIDGETS)("a %s widget writes settings the layout schema accepts", (id, createStore) => {
        const widget = JSON.parse(JSON.stringify({type: "component", id, widgetSettings: createStore().toConfig()}));

        expect(validateWidget(widget)).toBe(true);
    });
});
