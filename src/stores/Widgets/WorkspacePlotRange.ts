import {type WorkspacePlotRange} from "models";

/** The zoom range of a line plot widget. */
interface ZoomablePlot {
    minX: number | undefined;
    maxX: number | undefined;
    minY: number | undefined;
    maxY: number | undefined;
    setXBounds(minVal: number, maxVal: number): void;
    setYBounds(minVal: number, maxVal: number): void;
}

/** Returns whether two saved values make a valid zoom range for a plot. */
export function isWorkspaceRange(min: unknown, max: unknown): boolean {
    return typeof min === "number" && typeof max === "number" && isFinite(min) && isFinite(max) && min < max;
}

/** Returns the zoom range of a plot. An axis that was not zoomed is left out. */
export function toWorkspacePlotRange(plot: ZoomablePlot): WorkspacePlotRange {
    return {
        ...(isWorkspaceRange(plot.minX, plot.maxX) ? {minX: plot.minX, maxX: plot.maxX} : {}),
        ...(isWorkspaceRange(plot.minY, plot.maxY) ? {minY: plot.minY, maxY: plot.maxY} : {})
    };
}

/** Zooms a plot to its saved range, on each axis that was zoomed. */
export function applyWorkspacePlotRange(plot: ZoomablePlot, range: WorkspacePlotRange): void {
    if (isWorkspaceRange(range.minX, range.maxX)) {
        plot.setXBounds(range.minX!, range.maxX!);
    }
    if (isWorkspaceRange(range.minY, range.maxY)) {
        plot.setYBounds(range.minY!, range.maxY!);
    }
}
