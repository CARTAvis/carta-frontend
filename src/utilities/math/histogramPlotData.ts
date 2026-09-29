import {type CARTA} from "carta-protobuf";

import {type Point2D} from "models";

import {clamp} from "./math";

export interface HistogramPlotData {
    values: Point2D[];
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

export function getHistogramPlotData(histogram: CARTA.Histogram.$Properties | null | undefined, xBounds?: {min: number; max: number}): HistogramPlotData | null {
    const bins = histogram?.bins;
    const firstBinCenter = histogram?.firstBinCenter;
    const binWidth = histogram?.binWidth;
    if (!bins?.length || firstBinCenter == null || binWidth == null || !isFinite(firstBinCenter) || !isFinite(binWidth)) {
        return null;
    }

    const lastIndex = bins.length - 1;
    let minIndex = 0;
    let maxIndex = lastIndex;

    // Truncate array if zoomed in (sidestepping ChartJS bug with off-canvas rendering and speeding up layout)
    if (xBounds && binWidth !== 0 && isFinite(xBounds.min) && isFinite(xBounds.max)) {
        minIndex = clamp(Math.floor((xBounds.min - firstBinCenter) / binWidth), 0, lastIndex);
        maxIndex = clamp(Math.ceil((xBounds.max - firstBinCenter) / binWidth), 0, lastIndex);
    }

    const values: Point2D[] = [];
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    for (let i = minIndex; i <= maxIndex; i++) {
        const y = bins[i] ?? 0;
        values.push({x: firstBinCenter + binWidth * i, y});
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
    }

    if (!values.length) {
        return null;
    }

    return {values, xMin: values[0].x, xMax: values[values.length - 1].x, yMin, yMax};
}
