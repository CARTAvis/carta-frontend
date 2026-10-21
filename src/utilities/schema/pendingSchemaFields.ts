/**
 * Fields the frontend writes that the linked schemas do not declare yet, by schema definition.
 *
 * The schemas are brought up to date once for the whole dev cycle instead of with every change, so
 * that the backend and controller move their schemas pointer once. Each of these fields sits in an
 * object the schema leaves open, so a workspace or layout that carries it still validates. Remove
 * an entry once the schema declares the field.
 */
export const PENDING_SCHEMA_FIELDS: Record<string, string[]> = {
    "layout/animator": ["timeLabelFormat", "timeZoneMode", "ianaTimeZone", "timeScale", "isoTimePrecision", "numericTimePrecision", "relativeTimeReference", "relativeReferenceMjdUtc", "relativeTimeUnit"],
    "layout/histogram": ["widgetId", "meanRmsVisible", "settingsTabId", "autoBins"],
    "layout/image-view": ["multiPanelEnabled", "panelMode", "panelColumns", "panelRows"],
    "layout/render-config": ["widgetId"],
    "layout/spatial-profiler": ["widgetId", "markerTextVisible", "settingsTabId", "smoothing"],
    "layout/spectral-profiler": ["widgetId", "restFrameShiftMode", "restFrameVelocityConvention", "markerTextVisible", "secondaryAxisCursorInfoVisible", "settingsTabId", "smoothing"],
    "layout/stats": ["widgetId"],
    "layout/stokes": ["widgetId", "invertedColorMap", "fractionalPolVisible", "referenceAxesVisible", "settingsTabId", "smoothing"],
    "workspace/contour-config": ["colormapInverted"],
    "workspace/vector-overlay-config": ["colormapInverted", "thresholdOption"]
};

/**
 * The fields written to a schema definition that it neither declares nor lists as pending.
 *
 * @param definitionId - the schema and the definition in it, as `workspace/contour-config` or `layout/histogram`
 * @param declared - the definition's declared properties, or undefined when the schema has no such definition yet
 */
export function undeclaredFields(definitionId: string, declared: object | undefined, written: object): string[] {
    const pending = PENDING_SCHEMA_FIELDS[definitionId] ?? [];
    return Object.keys(written).filter(key => !(declared && key in declared) && !pending.includes(key));
}
