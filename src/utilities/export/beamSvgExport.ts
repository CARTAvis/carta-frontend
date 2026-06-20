import {createSvgElement, svgGroupFromLayer} from "./svgExport";

/**
 * Renders the beam profile ellipse with cross-hair axes to SVG.
 */
export function renderBeamToSvg(positionX: number, positionY: number, semiMajor: number, semiMinor: number, rotationDegrees: number, color: string, axisColor: string, strokeWidth: number, isFilled: boolean): SVGGElement {
    const group = svgGroupFromLayer("beam-profile");

    // Apply rotation to the whole group (ellipse + cross-hairs)
    group.setAttribute("transform", `rotate(${rotationDegrees},${positionX},${positionY})`);

    if (semiMajor > 0 && semiMinor > 0) {
        const ellipse = createSvgElement("ellipse", {
            cx: positionX,
            cy: positionY,
            rx: semiMajor,
            ry: semiMinor,
            fill: isFilled ? color : "none",
            stroke: color,
            "stroke-width": strokeWidth
        });
        group.appendChild(ellipse);
    }

    // Cross-hair axes (horizontal along semiMajor, vertical along semiMinor)
    const hLine = createSvgElement("line", {
        x1: positionX - semiMajor,
        y1: positionY,
        x2: positionX + semiMajor,
        y2: positionY,
        stroke: axisColor,
        "stroke-width": strokeWidth
    });
    group.appendChild(hLine);

    const vLine = createSvgElement("line", {
        x1: positionX,
        y1: positionY - semiMinor,
        x2: positionX,
        y2: positionY + semiMinor,
        stroke: axisColor,
        "stroke-width": strokeWidth
    });
    group.appendChild(vLine);

    return group;
}
