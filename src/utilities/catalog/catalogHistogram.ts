import type * as React from "react";
import {type Chart} from "chart.js";

import {type Point2D} from "models";
import {type XBorder} from "stores/Widgets";

interface HistogramInteractionOptions {
    getChart: () => Chart<"bar"> | null;
    getData: () => {bins: Point2D[]; binSize: number; binIndices: number[][]};
    getBorder: () => XBorder | undefined;
    setBorder: (border: XBorder) => void;
    selectPoints: (indices: number[]) => void;
}

export class CatalogHistogramInteraction {
    private dragStartX: number | undefined;
    private dragCurrentX: number | undefined;
    private panPreviousX: number | undefined;
    private hasHandledDrag = false;
    private ownerWindow: Window | null = null;

    constructor(private readonly options: HistogramInteractionOptions) {}

    get selectionStartX() {
        return this.dragStartX;
    }

    get selectionCurrentX() {
        return this.dragCurrentX;
    }

    consumeHandledDrag() {
        const didHandleDrag = this.hasHandledDrag;
        this.hasHandledDrag = false;
        return didHandleDrag;
    }

    stopTracking = (shouldPreserveDragHandled = false) => {
        this.dragStartX = undefined;
        this.dragCurrentX = undefined;
        this.panPreviousX = undefined;
        if (!shouldPreserveDragHandled) {
            this.hasHandledDrag = false;
        }
        this.ownerWindow?.removeEventListener("mouseup", this.onWindowMouseUp);
        this.ownerWindow = null;
    };

    onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target as Element | null;
        if (event.button !== 0 || target?.closest(".profiler-toolbar")) {
            return;
        }
        this.hasHandledDrag = false;
        this.ownerWindow = event.currentTarget.ownerDocument.defaultView;
        this.ownerWindow?.addEventListener("mouseup", this.onWindowMouseUp);
        if (event.shiftKey) {
            this.panPreviousX = event.nativeEvent.offsetX;
        } else {
            this.dragStartX = event.nativeEvent.offsetX;
            this.dragCurrentX = undefined;
        }
    };

    onMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target as Element | null;
        if (target?.closest(".profiler-toolbar")) {
            return;
        }
        const offsetX = event.nativeEvent.offsetX;
        const chart = this.options.getChart();
        if (this.panPreviousX !== undefined && chart) {
            const xScale = chart.scales["x"];
            if (xScale) {
                const previousValue = xScale.getValueForPixel(this.panPreviousX);
                const currentValue = xScale.getValueForPixel(offsetX);
                if (previousValue !== undefined && currentValue !== undefined) {
                    const delta = previousValue - currentValue;
                    const border = this.options.getBorder();
                    const currentMin = border?.xMin ?? xScale.min;
                    const currentMax = border?.xMax ?? xScale.max;
                    this.options.setBorder({xMin: currentMin + delta, xMax: currentMax + delta});
                    if (delta !== 0) {
                        this.hasHandledDrag = true;
                    }
                }
                this.panPreviousX = offsetX;
            }
        } else if (this.dragStartX !== undefined) {
            this.dragCurrentX = offsetX;
            chart?.draw();
        }
    };

    onMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target as Element | null;
        if (target?.closest(".profiler-toolbar")) {
            this.stopTracking();
            this.options.getChart()?.draw();
            return;
        }
        const chart = this.options.getChart();
        if (this.panPreviousX !== undefined) {
            this.stopTracking(this.hasHandledDrag && chart?.canvas === event.target);
            return;
        }
        if (this.dragStartX !== undefined && this.dragCurrentX !== undefined && chart) {
            const xScale = chart.scales["x"];
            if (xScale && Math.abs(event.nativeEvent.offsetX - this.dragStartX) > 3) {
                this.hasHandledDrag = true;
                const x1 = xScale.getValueForPixel(this.dragStartX);
                const x2 = xScale.getValueForPixel(this.dragCurrentX);
                if (x1 !== undefined && x2 !== undefined) {
                    this.selectBinsInRange(Math.min(x1, x2), Math.max(x1, x2));
                }
            }
        }
        this.stopTracking(chart?.canvas === event.target);
    };

    private onWindowMouseUp = () => {
        const chart = this.options.getChart();
        const xScale = chart?.scales["x"];
        if (this.dragStartX !== undefined && this.dragCurrentX !== undefined && xScale && Math.abs(this.dragCurrentX - this.dragStartX) > 3) {
            const x1 = xScale.getValueForPixel(this.dragStartX);
            const x2 = xScale.getValueForPixel(this.dragCurrentX);
            if (x1 !== undefined && x2 !== undefined) {
                this.hasHandledDrag = true;
                this.selectBinsInRange(Math.min(x1, x2), Math.max(x1, x2));
            }
        }
        this.stopTracking();
        chart?.draw();
    };

    private selectBinsInRange(xMin: number, xMax: number) {
        const {bins, binSize, binIndices} = this.options.getData();
        const selected: number[] = [];
        for (let i = 0; i < bins.length; i++) {
            const halfBin = binSize / 2;
            if (bins[i].x + halfBin >= xMin && bins[i].x - halfBin <= xMax) {
                for (const index of binIndices[i]) {
                    selected.push(index);
                }
            }
        }
        this.options.selectPoints(selected);
    }
}
