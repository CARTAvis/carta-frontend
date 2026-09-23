import {clamp, minMaxArray} from "../math/math";
import {toExponential} from "../units/units";

const SCATTER_GRID_SIZE = 64;

export interface CatalogScatterBorder {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}

interface ScatterSpatialIndex {
    xData: ArrayLike<number>;
    yData: ArrayLike<number>;
    border: CatalogScatterBorder;
    chartWidth: number;
    chartHeight: number;
    cells: Map<number, number[]>;
}

export function getCatalogScatterBorder(xArray: ArrayLike<number>, yArray: ArrayLike<number>): CatalogScatterBorder {
    const xMinMax = minMaxArray(xArray);
    const yMinMax = minMaxArray(yArray);
    const xPadding = xMinMax.minVal === xMinMax.maxVal ? (xMinMax.maxVal === 0 ? 1 : Math.abs(xMinMax.maxVal * 0.05)) : 0;
    const yPadding = yMinMax.minVal === yMinMax.maxVal ? (yMinMax.maxVal === 0 ? 1 : Math.abs(yMinMax.maxVal * 0.05)) : 0;
    return {
        xMin: xMinMax.minVal - xPadding,
        xMax: xMinMax.maxVal + xPadding,
        yMin: yMinMax.minVal - yPadding,
        yMax: yMinMax.maxVal + yPadding
    };
}

export function formatCatalogPlotTick(value: number, rangeMin: number, rangeMax: number, ticks: readonly {value: string | number}[] = []): string {
    const rangeExponent = getExponent(rangeMax - rangeMin);
    const maxAbsoluteValue = Math.max(Math.abs(rangeMin), Math.abs(rangeMax));
    const shouldUseScientificNotation = getExponent(maxAbsoluteValue) >= 3 || getExponent(maxAbsoluteValue) <= -3;
    const tickValues = ticks.map(tick => Number(tick.value)).filter(Number.isFinite);
    const decimals = getMinimumTickDecimals(tickValues, shouldUseScientificNotation);
    return shouldUseScientificNotation || rangeExponent <= 0 ? formatTickLabel(value, decimals, shouldUseScientificNotation) : String(value);
}

function getExponent(value: number): number {
    return parseFloat(value.toExponential(1).split("e")[1]);
}

function formatTickLabel(value: number, decimals: number, shouldUseScientificNotation: boolean): string {
    return shouldUseScientificNotation ? toExponential(value, decimals) : value.toFixed(decimals);
}

function getMinimumTickDecimals(tickValues: number[], shouldUseScientificNotation: boolean): number {
    for (let decimals = 0; decimals <= 20; decimals++) {
        const hasDuplicateLabel = tickValues.some((tickValue, index) => index > 0 && formatTickLabel(tickValue, decimals, shouldUseScientificNotation) === formatTickLabel(tickValues[index - 1], decimals, shouldUseScientificNotation));
        if (!hasDuplicateLabel) {
            return decimals;
        }
    }
    return 20;
}

export class CatalogScatterSpatialIndex {
    private index: ScatterSpatialIndex | undefined;

    clear() {
        this.index = undefined;
    }

    getNearestPointIndex(xData: ArrayLike<number>, yData: ArrayLike<number>, border: CatalogScatterBorder, chartWidth: number, chartHeight: number, x: number, y: number): number {
        const xRange = border.xMax - border.xMin;
        const yRange = border.yMax - border.yMin;
        if (!Number.isFinite(xRange) || !Number.isFinite(yRange) || xRange <= 0 || yRange <= 0 || !Math.min(xData.length, yData.length)) {
            return -1;
        }

        const index = this.getOrCreateIndex(xData, yData, border, chartWidth, chartHeight);
        const cellWidth = chartWidth / SCATTER_GRID_SIZE;
        const cellHeight = chartHeight / SCATTER_GRID_SIZE;
        const cursorCellX = clamp(Math.floor(((x - border.xMin) / xRange) * SCATTER_GRID_SIZE), 0, SCATTER_GRID_SIZE - 1);
        const cursorCellY = clamp(Math.floor(((y - border.yMin) / yRange) * SCATTER_GRID_SIZE), 0, SCATTER_GRID_SIZE - 1);
        const cursorPixelX = clamp(((x - border.xMin) / xRange) * chartWidth, 0, chartWidth);
        const cursorPixelY = clamp(((y - border.yMin) / yRange) * chartHeight, 0, chartHeight);
        let nearestIndex = -1;
        let minDistance = Number.POSITIVE_INFINITY;

        for (let radius = 0; radius < SCATTER_GRID_SIZE; radius++) {
            const minCellX = Math.max(0, cursorCellX - radius);
            const maxCellX = Math.min(SCATTER_GRID_SIZE - 1, cursorCellX + radius);
            const minCellY = Math.max(0, cursorCellY - radius);
            const maxCellY = Math.min(SCATTER_GRID_SIZE - 1, cursorCellY + radius);
            for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
                for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
                    if (radius > 0 && Math.max(Math.abs(cellX - cursorCellX), Math.abs(cellY - cursorCellY)) !== radius) {
                        continue;
                    }
                    const cell = index.cells.get(cellY * SCATTER_GRID_SIZE + cellX);
                    if (!cell) {
                        continue;
                    }
                    for (const pointIndex of cell) {
                        const deltaX = ((xData[pointIndex] - x) * chartWidth) / xRange;
                        const deltaY = ((yData[pointIndex] - y) * chartHeight) / yRange;
                        const distance = deltaX * deltaX + deltaY * deltaY;
                        if (distance === 0) {
                            return pointIndex;
                        }
                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestIndex = pointIndex;
                        }
                    }
                }
            }

            if (nearestIndex >= 0) {
                const minX = minCellX * cellWidth;
                const maxX = (maxCellX + 1) * cellWidth;
                const minY = minCellY * cellHeight;
                const maxY = (maxCellY + 1) * cellHeight;
                const distanceToUnvisited = Math.min(cursorPixelX - minX, maxX - cursorPixelX, cursorPixelY - minY, maxY - cursorPixelY);
                if (radius === SCATTER_GRID_SIZE - 1 || minDistance <= distanceToUnvisited * distanceToUnvisited) {
                    return nearestIndex;
                }
            }
        }
        return nearestIndex;
    }

    getCandidatesInBounds(xData: ArrayLike<number>, yData: ArrayLike<number>, border: CatalogScatterBorder, chartWidth: number, chartHeight: number, bounds: CatalogScatterBorder): Set<number> | undefined {
        const xRange = border.xMax - border.xMin;
        const yRange = border.yMax - border.yMin;
        if (!Number.isFinite(xRange) || !Number.isFinite(yRange) || xRange <= 0 || yRange <= 0 || chartWidth <= 0 || chartHeight <= 0) {
            return undefined;
        }

        const index = this.getOrCreateIndex(xData, yData, border, chartWidth, chartHeight);
        const minCellX = clamp(Math.floor(((bounds.xMin - border.xMin) / xRange) * SCATTER_GRID_SIZE), 0, SCATTER_GRID_SIZE - 1);
        const maxCellX = clamp(Math.floor(((bounds.xMax - border.xMin) / xRange) * SCATTER_GRID_SIZE), 0, SCATTER_GRID_SIZE - 1);
        const minCellY = clamp(Math.floor(((bounds.yMin - border.yMin) / yRange) * SCATTER_GRID_SIZE), 0, SCATTER_GRID_SIZE - 1);
        const maxCellY = clamp(Math.floor(((bounds.yMax - border.yMin) / yRange) * SCATTER_GRID_SIZE), 0, SCATTER_GRID_SIZE - 1);
        const candidates = new Set<number>();
        for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
            for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
                index.cells.get(cellY * SCATTER_GRID_SIZE + cellX)?.forEach(pointIndex => candidates.add(pointIndex));
            }
        }
        return candidates;
    }

    private getOrCreateIndex(xData: ArrayLike<number>, yData: ArrayLike<number>, border: CatalogScatterBorder, chartWidth: number, chartHeight: number): ScatterSpatialIndex {
        const current = this.index;
        if (
            current &&
            current.xData === xData &&
            current.yData === yData &&
            current.border.xMin === border.xMin &&
            current.border.xMax === border.xMax &&
            current.border.yMin === border.yMin &&
            current.border.yMax === border.yMax &&
            current.chartWidth === chartWidth &&
            current.chartHeight === chartHeight
        ) {
            return current;
        }

        const cells = new Map<number, number[]>();
        const xRange = border.xMax - border.xMin;
        const yRange = border.yMax - border.yMin;
        for (let i = 0, numPoints = Math.min(xData.length, yData.length); i < numPoints; i++) {
            const pointX = xData[i];
            const pointY = yData[i];
            if (!Number.isFinite(pointX) || !Number.isFinite(pointY) || pointX < border.xMin || pointX > border.xMax || pointY < border.yMin || pointY > border.yMax) {
                continue;
            }
            const cellX = clamp(Math.floor(((pointX - border.xMin) / xRange) * SCATTER_GRID_SIZE), 0, SCATTER_GRID_SIZE - 1);
            const cellY = clamp(Math.floor(((pointY - border.yMin) / yRange) * SCATTER_GRID_SIZE), 0, SCATTER_GRID_SIZE - 1);
            const key = cellY * SCATTER_GRID_SIZE + cellX;
            const cell = cells.get(key);
            if (cell) {
                cell.push(i);
            } else {
                cells.set(key, [i]);
            }
        }

        this.index = {xData, yData, border, chartWidth, chartHeight, cells};
        return this.index;
    }
}
