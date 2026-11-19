import {type Point2D} from "models";

import {createSvgElement} from "./svgExport";

export function createCircleMarker(center: Point2D, radius: number, fill: string, stroke: string, strokeWidth: number): SVGElement {
    return createSvgElement("circle", {cx: center.x, cy: center.y, r: radius, fill, stroke, "stroke-width": strokeWidth});
}

export function createRectMarker(center: Point2D, width: number, height: number, fill: string, stroke: string, strokeWidth: number): SVGElement {
    return createSvgElement("rect", {x: center.x - width / 2, y: center.y - height / 2, width, height, fill, stroke, "stroke-width": strokeWidth});
}

export function createDiamondMarker(center: Point2D, halfSize: number, fill: string, stroke: string, strokeWidth: number): SVGElement {
    return createSvgElement("polygon", {
        points: `${center.x},${center.y - halfSize} ${center.x + halfSize},${center.y} ${center.x},${center.y + halfSize} ${center.x - halfSize},${center.y}`,
        fill,
        stroke,
        "stroke-width": strokeWidth
    });
}

export function createCrossMarker(center: Point2D, halfSize: number, isDiagonal: boolean, stroke: string, strokeWidth: number): SVGElement {
    const d = isDiagonal
        ? `M${center.x - halfSize},${center.y - halfSize}L${center.x + halfSize},${center.y + halfSize}M${center.x + halfSize},${center.y - halfSize}L${center.x - halfSize},${center.y + halfSize}`
        : `M${center.x},${center.y - halfSize}L${center.x},${center.y + halfSize}M${center.x - halfSize},${center.y}L${center.x + halfSize},${center.y}`;
    return createSvgElement("path", {d, fill: "none", stroke, "stroke-width": strokeWidth});
}
