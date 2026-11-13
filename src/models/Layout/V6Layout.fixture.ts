/**
 * Layouts in the form that CARTA v6.0.0 saved them, for tests.
 *
 * Each object in {@link V6_WIDGET_SETTINGS} has the fields that the `toConfig` method of the widget
 * store returned in v6.0.0, in the same order. The values are not the defaults, so a test can see
 * whether a value was applied. {@link POST_V6_WIDGET_SETTINGS} has the fields that a regular layout
 * keeps since v6.0: the rest frame of the spectral profiler (#2898), the mean and RMS of the
 * histogram (#2976), and the time labels of the animator (#2881).
 */
export const V6_WIDGET_SETTINGS = {
    "render-config": {
        primaryLineColor: "#112233",
        lineWidth: 2,
        linePlotPointSize: 3,
        logScaleY: false,
        markerTextVisible: false,
        meanRmsVisible: false,
        plotType: "Points",
        minXVal: -1,
        maxXVal: 10,
        minYVal: 1,
        maxYVal: 100
    },
    "spatial-profiler": {
        coordinate: "y",
        primaryLineColor: "#112233",
        lineWidth: 2,
        linePlotPointSize: 3,
        wcsAxisVisible: false,
        meanRmsVisible: true,
        plotType: "Lines",
        minXVal: -2,
        maxXVal: 20,
        minYVal: 2,
        maxYVal: 200
    },
    "spectral-profiler": {
        primaryLineColor: "#112233",
        lineWidth: 2,
        linePlotPointSize: 3,
        meanRmsVisible: true,
        plotType: "Points",
        minXVal: -3,
        maxXVal: 30,
        minYVal: 3,
        maxYVal: 300
    },
    histogram: {
        primaryLineColor: "#112233",
        lineWidth: 2,
        linePlotPointSize: 3,
        logScaleY: false,
        plotType: "Lines",
        minXVal: -4,
        maxXVal: 40,
        minYVal: 4,
        maxYVal: 400
    },
    stokes: {
        primaryLineColor: "#112233",
        secondaryLineColor: "#445566",
        lineWidth: 2,
        linePlotPointSize: 3,
        plotType: "Points",
        colorMap: "viridis",
        scatterPlotPointSize: 4,
        pointTransparency: 0.5,
        equalAxes: false
    },
    "catalog-overlay": {
        catalogFileId: 1,
        catalogColor: "#ff00ff",
        highlightColor: "#00ff00",
        catalogSize: 20,
        catalogShape: 2,
        tableSeparatorPosition: "40%",
        thickness: 3
    }
} as const;

export const POST_V6_WIDGET_SETTINGS = {
    "spectral-profiler": {
        xAxisRestFrameEnabled: true,
        restFrameRedshift: 0.25,
        restFrameShiftMode: "redshift",
        restFrameVelocityConvention: "optical",
        yAxisRestFrameEnabled: true
    },
    histogram: {
        meanRmsVisible: true
    },
    animator: {
        timeLabelFormat: "mjd",
        timeZoneMode: "iana",
        ianaTimeZone: "Asia/Taipei",
        timeScale: "TAI",
        isoTimePrecision: "second",
        numericTimePrecision: 3,
        relativeTimeReference: "custom",
        relativeReferenceMjdUtc: 60000.5,
        relativeTimeUnit: "hour"
    }
} as const;

/** The widget settings that a regular layout keeps for each widget type: the v6.0 settings and the settings added since then. */
export const REGULAR_WIDGET_SETTINGS = {
    "render-config": V6_WIDGET_SETTINGS["render-config"],
    "spatial-profiler": V6_WIDGET_SETTINGS["spatial-profiler"],
    "spectral-profiler": {...V6_WIDGET_SETTINGS["spectral-profiler"], ...POST_V6_WIDGET_SETTINGS["spectral-profiler"]},
    histogram: {...V6_WIDGET_SETTINGS.histogram, ...POST_V6_WIDGET_SETTINGS.histogram},
    stokes: V6_WIDGET_SETTINGS.stokes,
    "catalog-overlay": V6_WIDGET_SETTINGS["catalog-overlay"],
    animator: POST_V6_WIDGET_SETTINGS.animator
} as const;

/** A layout saved by CARTA v6.0.0. A catalog plot keeps its type beside its settings, not in them. */
export const V6_LAYOUT = {
    layoutVersion: 2,
    docked: {
        type: "row",
        content: [
            {
                type: "column",
                width: 60,
                content: [
                    {type: "stack", content: [{type: "component", id: "image-view"}], height: 70},
                    {
                        type: "stack",
                        height: 30,
                        activeItemIndex: 1,
                        content: [
                            {type: "component", id: "render-config", widgetSettings: V6_WIDGET_SETTINGS["render-config"]},
                            {type: "component", id: "histogram", widgetSettings: REGULAR_WIDGET_SETTINGS.histogram},
                            {type: "component", id: "animator", widgetSettings: POST_V6_WIDGET_SETTINGS.animator}
                        ]
                    }
                ]
            },
            {
                type: "column",
                width: 40,
                content: [
                    {type: "stack", content: [{type: "component", id: "spatial-profiler", widgetSettings: V6_WIDGET_SETTINGS["spatial-profiler"]}]},
                    {type: "stack", content: [{type: "component", id: "spectral-profiler", widgetSettings: REGULAR_WIDGET_SETTINGS["spectral-profiler"]}]},
                    {
                        type: "stack",
                        content: [
                            {type: "component", id: "stokes", widgetSettings: V6_WIDGET_SETTINGS.stokes},
                            {type: "component", id: "catalog-overlay", widgetSettings: V6_WIDGET_SETTINGS["catalog-overlay"]},
                            {type: "component", id: "catalog-plot", plotType: "Histogram"},
                            {type: "component", id: "stats"}
                        ]
                    }
                ]
            }
        ]
    },
    floating: [
        {type: "component", id: "log", defaultWidth: 300, defaultHeight: 200, defaultX: 40, defaultY: 60},
        {type: "component", id: "catalog-plot", defaultWidth: 400, defaultHeight: 300, defaultX: 80, defaultY: 90, plotType: "2D scatter"}
    ]
};
