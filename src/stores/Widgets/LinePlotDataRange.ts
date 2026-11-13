import {type Persisted} from "models";

/**
 * The range of the data that a line plot widget last plotted. A regular layout keeps it, and the
 * settings panel of the widget shows it in its range inputs before the widget plots data.
 */
export interface LinePlotDataRange {
    minXVal: number | undefined;
    maxXVal: number | undefined;
    minYVal: number | undefined;
    maxYVal: number | undefined;
}

/** Applies the range of the data that a regular layout saved, as CARTA v6.0 applied it: each value that is a number. */
export function applyLinePlotDataRange(range: LinePlotDataRange, settings: Persisted<LinePlotDataRange>): void {
    if (typeof settings.minXVal === "number") {
        range.minXVal = settings.minXVal;
    }
    if (typeof settings.maxXVal === "number") {
        range.maxXVal = settings.maxXVal;
    }
    if (typeof settings.minYVal === "number") {
        range.minYVal = settings.minYVal;
    }
    if (typeof settings.maxYVal === "number") {
        range.maxYVal = settings.maxYVal;
    }
}

/** The names of the fields of {@link LinePlotDataRange}. The layout copy of a workspace keeps none of them. */
export type LinePlotDataRangeField = keyof LinePlotDataRange;
