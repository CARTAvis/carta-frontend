import {createSvgElement, svgGroupFromLayer} from "./svgExport";

// Vertex data has 8 floats per vertex pair: [x1, y1, len, norm, x2, y2, -len, -norm]
// We only need the (x, y) positions from the first vertex of each pair
const VERTEX_DATA_ELEMENTS = 8;

/**
 * Converts contour vertex data to SVG path elements.
 * Each contour level becomes a separate `<path>` with appropriate styling.
 * Separate polylines (enclosed contours) within a level get individual
 * sub-paths (M commands) so they are not linked together.
 */
export function renderContoursToSvg(vertexDataArrays: (Float32Array | null)[], color: string, lineWidth: number, dashLength: number, offsetX: number, offsetY: number): SVGGElement {
    const group = svgGroupFromLayer("contours");

    for (let chunkIndex = 0; chunkIndex < vertexDataArrays.length; chunkIndex++) {
        const vertexData = vertexDataArrays[chunkIndex];

        if (!vertexData) {
            continue;
        }

        const totalPairs = vertexData.length / VERTEX_DATA_ELEMENTS;
        let pathData = "";
        let isFirstPoint = true;
        let firstPoint: {x: number; y: number} | null = null;
        let lastPoint: {x: number; y: number} | null = null;

        const finishSubpath = () => {
            if (firstPoint && lastPoint && Math.abs(firstPoint.x - lastPoint.x) < 1e-6 && Math.abs(firstPoint.y - lastPoint.y) < 1e-6) {
                pathData += "Z";
            }
            firstPoint = null;
            lastPoint = null;
        };

        for (let i = 0; i < totalPairs; i++) {
            const dataOffset = i * VERTEX_DATA_ELEMENTS;

            const x = vertexData[dataOffset] + offsetX;
            const y = vertexData[dataOffset + 1] + offsetY;

            if (!isFinite(x) || !isFinite(y)) {
                finishSubpath();
                isFirstPoint = true;
                continue;
            }

            if (isFirstPoint) {
                pathData += `M${x.toFixed(2)},${y.toFixed(2)}`;
                firstPoint = {x, y};
                isFirstPoint = false;
            } else {
                pathData += `L${x.toFixed(2)},${y.toFixed(2)}`;
            }
            lastPoint = {x, y};
        }

        finishSubpath();

        if (!pathData) {
            continue;
        }

        const attrs: Record<string, string | number> = {
            d: pathData,
            fill: "none",
            stroke: color,
            "stroke-width": lineWidth
        };

        if (dashLength > 0) {
            attrs["stroke-dasharray"] = `${dashLength * 1.5},${dashLength * 0.5}`;
        }

        const path = createSvgElement("path", attrs);
        group.appendChild(path);
    }

    return group;
}
