/** The settings of the line plots that a regular layout keeps for a plot widget, as CARTA v6.0 kept them. */
const LINE_PLOT_SETTINGS = ["primaryLineColor", "lineWidth", "linePlotPointSize", "plotType", "minXVal", "maxXVal", "minYVal", "maxYVal"] as const;

/**
 * The widget settings that a regular layout keeps, by widget type. These are the settings that
 * CARTA v6.0 kept, and the settings added since then for the rest frame of the spectral profiler,
 * the mean and RMS of the histogram, and the time labels of the animator. A regular layout keeps
 * no settings for the other widgets. A layout is saved with only these settings, so settings
 * that a widget got from the layout copy of a workspace do not go into a regular layout.
 */
export const REGULAR_LAYOUT_WIDGET_SETTINGS: Readonly<Record<string, readonly string[]>> = {
    "render-config": [...LINE_PLOT_SETTINGS, "logScaleY", "markerTextVisible", "meanRmsVisible"],
    "spatial-profiler": [...LINE_PLOT_SETTINGS, "coordinate", "wcsAxisVisible", "meanRmsVisible"],
    "spectral-profiler": [...LINE_PLOT_SETTINGS, "meanRmsVisible", "xAxisRestFrameEnabled", "restFrameRedshift", "restFrameShiftMode", "restFrameVelocityConvention", "yAxisRestFrameEnabled"],
    histogram: [...LINE_PLOT_SETTINGS, "logScaleY", "meanRmsVisible"],
    stokes: ["primaryLineColor", "secondaryLineColor", "lineWidth", "linePlotPointSize", "plotType", "colorMap", "scatterPlotPointSize", "pointTransparency", "equalAxes"],
    "catalog-overlay": ["catalogFileId", "catalogColor", "highlightColor", "catalogSize", "catalogShape", "tableSeparatorPosition", "thickness"],
    animator: ["timeLabelFormat", "timeZoneMode", "ianaTimeZone", "timeScale", "isoTimePrecision", "numericTimePrecision", "relativeTimeReference", "relativeReferenceMjdUtc", "relativeTimeUnit"]
};
