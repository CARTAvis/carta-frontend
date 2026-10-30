import {type Point2D} from "models";
import {type ContourSourceChunk} from "stores/Frame/ContourStore/ContourStore";

import {createSvgElement, svgGroupFromLayer} from "./svgExport";

export interface ContourExportBounds {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    marginX: number;
    marginY: number;
}

export interface ContourExportViewport {
    width: number;
    height: number;
    margin: number;
}

/** Render raw contour vertices using the exact polyline boundaries supplied by the backend. */
export function renderContoursToSvg(
    chunks: ContourSourceChunk[],
    color: string,
    lineWidth: number,
    dashLength: number,
    offsetX: number,
    offsetY: number,
    transformPoint: (point: Point2D) => Point2D | null = point => point,
    bounds?: ContourExportBounds,
    viewport?: ContourExportViewport
): SVGGElement {
    const group = svgGroupFromLayer("contours");
    const vertexScratch = {x: 0, y: 0};
    for (const {vertices, indexOffsets} of chunks) {
        let pathData = "";
        for (let line = 0; line < indexOffsets.length; line++) {
            const end = indexOffsets[line + 1] ?? vertices.length;
            if (end - indexOffsets[line] < 4) continue;
            if (bounds) {
                let minX = Infinity;
                let maxX = -Infinity;
                let minY = Infinity;
                let maxY = -Infinity;
                for (let index = indexOffsets[line]; index < end; index += 2) {
                    const x = vertices[index] - 0.5;
                    const y = vertices[index + 1] - 0.5;
                    if (!isFinite(x) || !isFinite(y)) {
                        minX = -Infinity;
                        maxX = Infinity;
                        minY = -Infinity;
                        maxY = Infinity;
                        break;
                    }
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
                if (maxX < bounds.xMin - bounds.marginX || minX > bounds.xMax + bounds.marginX || maxY < bounds.yMin - bounds.marginY || minY > bounds.yMax + bounds.marginY) continue;
            }
            let linePathData = "";
            let hasLineFirst = false;
            let lineFirstX = 0;
            let lineFirstY = 0;
            let lineLastX = 0;
            let lineLastY = 0;
            let minCanvasX = Infinity;
            let maxCanvasX = -Infinity;
            let minCanvasY = Infinity;
            let maxCanvasY = -Infinity;
            const closeLine = () => {
                if (hasLineFirst && Math.abs(lineFirstX - lineLastX) < 1e-6 && Math.abs(lineFirstY - lineLastY) < 1e-6) linePathData += "Z";
                hasLineFirst = false;
            };
            for (let index = indexOffsets[line]; index < end; index += 2) {
                // The transform callback receives borrowed scratch storage; it may mutate this point.
                vertexScratch.x = vertices[index];
                vertexScratch.y = vertices[index + 1];
                const point = transformPoint(vertexScratch);
                if (!point || !isFinite(point.x) || !isFinite(point.y)) {
                    closeLine();
                    continue;
                }
                const canvasX = point.x + offsetX;
                const canvasY = point.y + offsetY;
                linePathData += `${hasLineFirst ? "L" : "M"}${canvasX.toFixed(2)},${canvasY.toFixed(2)}`;
                // Snapshot endpoints because transforms may return the reused input point.
                if (!hasLineFirst) {
                    hasLineFirst = true;
                    lineFirstX = point.x;
                    lineFirstY = point.y;
                }
                lineLastX = point.x;
                lineLastY = point.y;
                minCanvasX = Math.min(minCanvasX, canvasX);
                maxCanvasX = Math.max(maxCanvasX, canvasX);
                minCanvasY = Math.min(minCanvasY, canvasY);
                maxCanvasY = Math.max(maxCanvasY, canvasY);
            }
            closeLine();
            if (
                linePathData &&
                (!viewport || (maxCanvasX >= offsetX - viewport.margin && minCanvasX <= offsetX + viewport.width + viewport.margin && maxCanvasY >= offsetY - viewport.margin && minCanvasY <= offsetY + viewport.height + viewport.margin))
            ) {
                pathData += linePathData;
            }
        }
        if (!pathData) continue;
        const attrs: Record<string, string | number> = {d: pathData, fill: "none", stroke: color, "stroke-width": lineWidth};
        if (dashLength > 0) attrs["stroke-dasharray"] = `${dashLength * 1.5},${dashLength * 0.5}`;
        group.appendChild(createSvgElement("path", attrs));
    }
    return group;
}
