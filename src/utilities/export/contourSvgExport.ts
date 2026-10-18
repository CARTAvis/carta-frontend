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

/** Render raw contour vertices using the exact polyline boundaries supplied by the backend. */
export function renderContoursToSvg(
    chunks: ContourSourceChunk[],
    color: string,
    lineWidth: number,
    dashLength: number,
    offsetX: number,
    offsetY: number,
    transformPoint: (point: Point2D) => Point2D | null = point => point,
    bounds?: ContourExportBounds
): SVGGElement {
    const group = svgGroupFromLayer("contours");
    const vertexScratch = {x: 0, y: 0};
    for (const {vertices, indexOffsets} of chunks) {
        let pathData = "";
        let hasFirst = false;
        let firstX = 0;
        let firstY = 0;
        let lastX = 0;
        let lastY = 0;
        const close = () => {
            if (hasFirst && Math.abs(firstX - lastX) < 1e-6 && Math.abs(firstY - lastY) < 1e-6) pathData += "Z";
            hasFirst = false;
        };
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
            for (let index = indexOffsets[line]; index < end; index += 2) {
                vertexScratch.x = vertices[index];
                vertexScratch.y = vertices[index + 1];
                const point = transformPoint(vertexScratch);
                if (!point || !isFinite(point.x) || !isFinite(point.y)) {
                    close();
                    continue;
                }
                pathData += `${hasFirst ? "L" : "M"}${(point.x + offsetX).toFixed(2)},${(point.y + offsetY).toFixed(2)}`;
                // Snapshot endpoints because transforms may return the reused input point.
                if (!hasFirst) {
                    hasFirst = true;
                    firstX = point.x;
                    firstY = point.y;
                }
                lastX = point.x;
                lastY = point.y;
            }
            close();
        }
        if (!pathData) continue;
        const attrs: Record<string, string | number> = {d: pathData, fill: "none", stroke: color, "stroke-width": lineWidth};
        if (dashLength > 0) attrs["stroke-dasharray"] = `${dashLength * 1.5},${dashLength * 0.5}`;
        group.appendChild(createSvgElement("path", attrs));
    }
    return group;
}
