/**
 * Fields that the frontend writes but that the linked schemas do not declare yet, by schema
 * definition.
 *
 * The schemas are updated once for the whole dev cycle, not with every change. This way, the
 * backend and the controller update their schemas pointer only once. Each of these fields is in an
 * object that the schema leaves open, so a workspace or layout that has the field still passes
 * validation. Remove an entry once the schema declares the field.
 */
export const PENDING_SCHEMA_FIELDS: Record<string, string[]> = {
    "layout/animator": ["timeLabelFormat", "timeZoneMode", "ianaTimeZone", "timeScale", "isoTimePrecision", "numericTimePrecision", "relativeTimeReference", "relativeReferenceMjdUtc", "relativeTimeUnit"],
    "layout/histogram": ["meanRmsVisible"],
    "layout/spectral-profiler": ["restFrameRedshift", "restFrameShiftMode", "restFrameVelocityConvention", "xAxisRestFrameEnabled", "yAxisRestFrameEnabled"],
    "workspace/contour-config": ["colormapInverted"],
    "workspace/vector-overlay-config": ["colormapInverted", "thresholdOption"]
};

/**
 * Returns the fields written to a schema definition that the definition does not declare and that
 * are not listed as pending.
 *
 * @param definitionId - the schema and its definition, such as `workspace/contour-config` or `layout/histogram`
 * @param declared - the declared properties of the definition, or undefined when the schema does not have this definition yet
 */
export function undeclaredFields(definitionId: string, declared: object | undefined, written: object): string[] {
    const pending = PENDING_SCHEMA_FIELDS[definitionId] ?? [];
    return Object.keys(written).filter(key => !(declared && key in declared) && !pending.includes(key));
}
