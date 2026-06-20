import {CatalogOverlayShape} from "enums";

import {createSvgElement, svgGroupFromLayer} from "./svgExport";

/**
 * Converts catalog overlay data to SVG elements.
 * Catalog positions are stored as Float32Array pairs (x, y) in canvas pixel space.
 */
export function renderCatalogToSvg(positionArrays: Map<number, Float32Array>, shapes: Map<number, string | CatalogOverlayShape>, sizes: Map<number, number>, colors: Map<number, string>, offsetX: number, offsetY: number): SVGGElement {
    const group = svgGroupFromLayer("catalog-overlay");
    if (offsetX !== 0 || offsetY !== 0) {
        group.setAttribute("transform", `translate(${offsetX},${offsetY})`);
    }

    positionArrays.forEach((positions, fileId) => {
        const shape = shapes.get(fileId) ?? CatalogOverlayShape.CIRCLE_FILLED;
        const size = sizes.get(fileId) ?? 5;
        const color = colors.get(fileId) ?? "#21a5af";

        const numPoints = Math.floor(positions.length / 2);
        for (let i = 0; i < numPoints; i++) {
            const x = positions[i * 2];
            const y = positions[i * 2 + 1];

            if (!isFinite(x) || !isFinite(y)) {
                continue;
            }

            const element = renderCatalogShape(x, y, size, color, shape);
            if (element) {
                group.appendChild(element);
            }
        }
    });

    return group;
}

function renderCatalogShape(x: number, y: number, size: number, color: string, shape: string | CatalogOverlayShape): SVGElement | null {
    const halfSize = size / 2;
    const shapeName = typeof shape === "number" ? CatalogOverlayShape[shape] : shape;

    switch (shapeName) {
        case "CircleFilled":
        case "CIRCLE_FILLED":
            return createSvgElement("circle", {cx: x, cy: y, r: halfSize, fill: color, stroke: "none"});
        case "CircleLined":
        case "CIRCLE_LINED":
            return createSvgElement("circle", {cx: x, cy: y, r: halfSize, fill: "none", stroke: color, "stroke-width": 1});
        case "BoxFilled":
            return createSvgElement("rect", {x: x - halfSize, y: y - halfSize, width: size, height: size, fill: color, stroke: "none"});
        case "BoxLined":
        case "BOX_LINED":
            return createSvgElement("rect", {x: x - halfSize, y: y - halfSize, width: size, height: size, fill: "none", stroke: color, "stroke-width": 1});
        case "EllipseFilled":
            return createSvgElement("ellipse", {cx: x, cy: y, rx: halfSize, ry: halfSize * 0.6, fill: color, stroke: "none"});
        case "EllipseLined":
        case "ELLIPSE_LINED":
            return createSvgElement("ellipse", {cx: x, cy: y, rx: halfSize, ry: halfSize * 0.6, fill: "none", stroke: color, "stroke-width": 1});
        case "Cross":
        case "CROSS_FILLED":
        case "CROSS_LINED":
            return createCrossShape(x, y, halfSize, color);
        case "X":
        case "X_FILLED":
        case "X_LINED":
            return createXShape(x, y, halfSize, color);
        case "TriangleFilled":
            return createTriangle(x, y, halfSize, color, true);
        case "TriangleLined":
        case "TRIANGLE_LINED_UP":
            return createTriangle(x, y, halfSize, color, false);
        case "TRIANGLE_LINED_DOWN":
            return createTriangle(x, y, halfSize, color, false, true);
        case "HexagonFilled":
            return createHexagon(x, y, halfSize, color, true);
        case "HexagonLined":
        case "HEXAGON_LINED":
        case "HEXAGON_LINED_2":
            return createHexagon(x, y, halfSize, color, false);
        case "RhombFilled":
            return createRhomb(x, y, halfSize, color, true);
        case "RhombLined":
        case "RHOMB_LINED":
            return createRhomb(x, y, halfSize, color, false);
        case "LineSegment":
        case "LineSegment_FILLED":
            return createSvgElement("line", {x1: x - halfSize, y1: y, x2: x + halfSize, y2: y, stroke: color, "stroke-width": 1});
        default:
            return createSvgElement("circle", {cx: x, cy: y, r: halfSize, fill: color, stroke: "none"});
    }
}

function createCrossShape(x: number, y: number, halfSize: number, color: string): SVGElement {
    return createSvgElement("path", {
        d: `M${x - halfSize},${y}L${x + halfSize},${y}M${x},${y - halfSize}L${x},${y + halfSize}`,
        stroke: color,
        "stroke-width": 1,
        fill: "none"
    });
}

function createXShape(x: number, y: number, halfSize: number, color: string): SVGElement {
    return createSvgElement("path", {
        d: `M${x - halfSize},${y - halfSize}L${x + halfSize},${y + halfSize}M${x + halfSize},${y - halfSize}L${x - halfSize},${y + halfSize}`,
        stroke: color,
        "stroke-width": 1,
        fill: "none"
    });
}

function createTriangle(x: number, y: number, halfSize: number, color: string, isFilled: boolean, isDownward: boolean = false): SVGElement {
    const tip = `${x},${isDownward ? y + halfSize : y - halfSize}`;
    const baseLeft = `${x - halfSize},${isDownward ? y - halfSize : y + halfSize}`;
    const baseRight = `${x + halfSize},${isDownward ? y - halfSize : y + halfSize}`;
    return createSvgElement("polygon", {
        points: `${tip} ${baseLeft} ${baseRight}`,
        fill: isFilled ? color : "none",
        stroke: isFilled ? "none" : color,
        "stroke-width": isFilled ? 0 : 1
    });
}

function createHexagon(x: number, y: number, halfSize: number, color: string, isFilled: boolean): SVGElement {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        points.push(`${(x + halfSize * Math.cos(angle)).toFixed(2)},${(y + halfSize * Math.sin(angle)).toFixed(2)}`);
    }
    return createSvgElement("polygon", {
        points: points.join(" "),
        fill: isFilled ? color : "none",
        stroke: isFilled ? "none" : color,
        "stroke-width": isFilled ? 0 : 1
    });
}

function createRhomb(x: number, y: number, halfSize: number, color: string, isFilled: boolean): SVGElement {
    return createSvgElement("polygon", {
        points: `${x},${y - halfSize} ${x + halfSize},${y} ${x},${y + halfSize} ${x - halfSize},${y}`,
        fill: isFilled ? color : "none",
        stroke: isFilled ? "none" : color,
        "stroke-width": isFilled ? 0 : 1
    });
}
