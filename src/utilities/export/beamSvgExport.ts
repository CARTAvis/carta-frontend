import {type Point2D} from "models";

import {createSvgElement, svgGroupFromLayer} from "./svgExport";

export interface BeamPlotProps {
    position: Point2D;
    semiMajor: number;
    semiMinor: number;
    rotationDegrees: number;
    color: string;
    axisColor: string;
    strokeWidth: number;
    isFilled: boolean;
    scale?: Point2D;
}

/**
 * Renders the beam profile ellipse with cross-hair axes to SVG.
 */
export function renderBeamToSvg(plotProps: BeamPlotProps, pixelRatio: number): SVGGElement {
    const positionX = plotProps.position.x * pixelRatio;
    const positionY = plotProps.position.y * pixelRatio;
    const semiMajor = plotProps.semiMajor * pixelRatio;
    const semiMinor = plotProps.semiMinor * pixelRatio;
    const strokeWidth = plotProps.strokeWidth * pixelRatio;
    const group = svgGroupFromLayer("beam-profile");

    // Screen-axis scaling must follow beam rotation, as in the viewer's outer Konva group.
    const scale = plotProps.scale ?? {x: 1, y: 1};
    const isScaled = scale.x !== 1 || scale.y !== 1;
    const theta = (plotProps.rotationDegrees * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    if (!isScaled) group.setAttribute("transform", `rotate(${plotProps.rotationDegrees},${positionX},${positionY})`);
    const axisPoint = (x: number, y: number): Point2D => (isScaled ? {x: positionX + scale.x * (x * cos - y * sin), y: positionY + scale.y * (x * sin + y * cos)} : {x: positionX + x, y: positionY + y});

    if (semiMajor > 0 && semiMinor > 0) {
        const ellipse = createSvgElement("ellipse", {
            cx: positionX,
            cy: positionY,
            rx: semiMajor,
            ry: semiMinor,
            fill: plotProps.isFilled ? plotProps.color : "none",
            stroke: plotProps.color,
            "stroke-width": strokeWidth
        });
        if (isScaled) {
            // Resolve the scaled ellipse's principal axes. Keeping scale out of SVG
            // transforms preserves Konva's fixed stroke width in svg2pdf as well.
            const xx = scale.x ** 2 * ((semiMajor * cos) ** 2 + (semiMinor * sin) ** 2);
            const yy = scale.y ** 2 * ((semiMajor * sin) ** 2 + (semiMinor * cos) ** 2);
            const xy = scale.x * scale.y * (semiMajor ** 2 - semiMinor ** 2) * cos * sin;
            const difference = Math.hypot(xx - yy, 2 * xy);
            ellipse.setAttribute("rx", `${Math.sqrt((xx + yy + difference) / 2)}`);
            ellipse.setAttribute("ry", `${Math.sqrt(Math.max(0, (xx + yy - difference) / 2))}`);
            ellipse.setAttribute("transform", `rotate(${(Math.atan2(2 * xy, xx - yy) * 90) / Math.PI},${positionX},${positionY})`);
        }
        group.appendChild(ellipse);
    }

    // Cross-hair axes (horizontal along semiMajor, vertical along semiMinor)
    const hStart = axisPoint(-semiMajor, 0);
    const hEnd = axisPoint(semiMajor, 0);
    const hLine = createSvgElement("line", {
        x1: hStart.x,
        y1: hStart.y,
        x2: hEnd.x,
        y2: hEnd.y,
        stroke: plotProps.axisColor,
        "stroke-width": strokeWidth
    });
    group.appendChild(hLine);

    const vStart = axisPoint(0, -semiMinor);
    const vEnd = axisPoint(0, semiMinor);
    const vLine = createSvgElement("line", {
        x1: vStart.x,
        y1: vStart.y,
        x2: vEnd.x,
        y2: vEnd.y,
        stroke: plotProps.axisColor,
        "stroke-width": strokeWidth
    });
    group.appendChild(vLine);

    return group;
}
