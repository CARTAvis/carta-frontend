import {type Point2D} from "models";
import {type ContourSourceChunk} from "stores/Frame/ContourStore/ContourStore";

import {createSvgElement, svgGroupFromLayer} from "./svgExport";

/** Render raw contour vertices using the exact polyline boundaries supplied by the backend. */
export function renderContoursToSvg(chunks: ContourSourceChunk[], color: string, lineWidth: number, dashLength: number, offsetX: number, offsetY: number, transformPoint: (point: Point2D) => Point2D | null = point => point): SVGGElement {
    const group = svgGroupFromLayer("contours");
    for (const {vertices, indexOffsets} of chunks) {
        let pathData = "";
        let first: Point2D | null = null;
        let last: Point2D | null = null;
        const close = () => {
            if (first && last && Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) pathData += "Z";
            first = null;
            last = null;
        };
        for (let line = 0; line < indexOffsets.length; line++) {
            const end = indexOffsets[line + 1] ?? vertices.length;
            if (end - indexOffsets[line] < 4) continue;
            for (let index = indexOffsets[line]; index < end; index += 2) {
                const point = transformPoint({x: vertices[index], y: vertices[index + 1]});
                if (!point || !isFinite(point.x) || !isFinite(point.y)) {
                    close();
                    continue;
                }
                pathData += `${first ? "L" : "M"}${(point.x + offsetX).toFixed(2)},${(point.y + offsetY).toFixed(2)}`;
                if (!first) first = point;
                last = point;
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
