import {createSvgElement, svgGroupFromLayer} from "./svgExport";

/**
 * Converts vector overlay data to SVG line elements.
 * Each vector has position (x, y), intensity, and angle.
 */
export function renderVectorOverlayToSvg(positions: Float32Array | null, numVectors: number, lengthScale: number, lineWidth: number, color: string | string[], offsetX: number, offsetY: number): SVGGElement {
    const group = svgGroupFromLayer("vector-overlay");
    if (offsetX !== 0 || offsetY !== 0) {
        group.setAttribute("transform", `translate(${offsetX},${offsetY})`);
    }

    if (!positions || numVectors === 0) {
        return group;
    }

    // Each vector has 4 floats: [x, y, intensity, angle]
    for (let i = 0; i < numVectors; i++) {
        const x = positions[i * 4];
        const y = positions[i * 4 + 1];
        const intensity = positions[i * 4 + 2];
        const angle = positions[i * 4 + 3];

        if (!isFinite(x) || !isFinite(y) || !isFinite(angle)) {
            continue;
        }

        const length = intensity * lengthScale;
        if (length <= 0) {
            continue;
        }

        const halfLength = length / 2;
        const dx = halfLength * Math.cos(angle);
        const dy = halfLength * Math.sin(angle);
        const stroke = Array.isArray(color) ? (color[i] ?? color[color.length - 1] ?? "#ffffff") : color;

        const line = createSvgElement("line", {
            x1: (x - dx).toFixed(2),
            y1: (y - dy).toFixed(2),
            x2: (x + dx).toFixed(2),
            y2: (y + dy).toFixed(2),
            stroke,
            "stroke-width": lineWidth,
            fill: "none"
        });
        group.appendChild(line);
    }

    return group;
}
