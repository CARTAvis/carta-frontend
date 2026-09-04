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
export function renderContoursToSvg(
    vertexDataArrays: (Float32Array | null)[],
    _indexOffsetsArrays: Int32Array[],
    levels: number[],
    colors: string[],
    lineWidths: number[],
    dashLengths: number[],
    offsetX: number,
    offsetY: number
): SVGGElement {
    const group = svgGroupFromLayer("contours");

    for (let chunkIndex = 0; chunkIndex < vertexDataArrays.length; chunkIndex++) {
        const vertexData = vertexDataArrays[chunkIndex];

        if (!vertexData) {
            continue;
        }

        const totalPairs = vertexData.length / VERTEX_DATA_ELEMENTS;
        let pathData = "";
        let isFirstPoint = true;

        for (let i = 0; i < totalPairs; i++) {
            const dataOffset = i * VERTEX_DATA_ELEMENTS;

            const x = vertexData[dataOffset] + offsetX;
            const y = vertexData[dataOffset + 1] + offsetY;

            if (!isFinite(x) || !isFinite(y)) {
                isFirstPoint = true;
                continue;
            }

            if (isFirstPoint) {
                pathData += `M${x.toFixed(2)},${y.toFixed(2)}`;
                isFirstPoint = false;
            } else {
                pathData += `L${x.toFixed(2)},${y.toFixed(2)}`;
            }
        }

        if (!pathData) {
            continue;
        }

        // Use levelIndex 0 for styling — buildContoursSvg passes single-element arrays
        const levelIndex = 0;
        const color = colors[levelIndex % colors.length] ?? "#ffffff";
        const lineWidth = lineWidths[levelIndex % lineWidths.length] ?? 1;
        const dashLength = dashLengths[levelIndex % dashLengths.length] ?? 0;

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
