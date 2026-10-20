import {type WorkspacePlotRange} from "models";

/** What a line plot widget is zoomed to. */
interface ZoomablePlot {
    minX: number | undefined;
    maxX: number | undefined;
    minY: number | undefined;
    maxY: number | undefined;
    setXBounds(minVal: number, maxVal: number): void;
    setYBounds(minVal: number, maxVal: number): void;
}

/** Whether two values a workspace saved make a range a plot can be zoomed to. */
export function isWorkspaceRange(min: unknown, max: unknown): boolean {
    return typeof min === "number" && typeof max === "number" && isFinite(min) && isFinite(max) && min < max;
}

/** The range a plot was zoomed to, leaving out an axis that was not zoomed. */
export function toWorkspacePlotRange(plot: ZoomablePlot): WorkspacePlotRange {
    return {
        ...(isWorkspaceRange(plot.minX, plot.maxX) ? {minX: plot.minX, maxX: plot.maxX} : {}),
        ...(isWorkspaceRange(plot.minY, plot.maxY) ? {minY: plot.minY, maxY: plot.maxY} : {})
    };
}

/** Zoom a plot to the range a workspace saved for it, on each axis that was zoomed. */
export function applyWorkspacePlotRange(plot: ZoomablePlot, range: WorkspacePlotRange): void {
    if (isWorkspaceRange(range.minX, range.maxX)) {
        plot.setXBounds(range.minX!, range.maxX!);
    }
    if (isWorkspaceRange(range.minY, range.maxY)) {
        plot.setYBounds(range.minY!, range.maxY!);
    }
}
