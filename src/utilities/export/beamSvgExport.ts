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

    // Apply rotation to the whole group (ellipse + cross-hairs)
    group.setAttribute("transform", `rotate(${plotProps.rotationDegrees},${positionX},${positionY})`);

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
        group.appendChild(ellipse);
    }

    // Cross-hair axes (horizontal along semiMajor, vertical along semiMinor)
    const hLine = createSvgElement("line", {
        x1: positionX - semiMajor,
        y1: positionY,
        x2: positionX + semiMajor,
        y2: positionY,
        stroke: plotProps.axisColor,
        "stroke-width": strokeWidth
    });
    group.appendChild(hLine);

    const vLine = createSvgElement("line", {
        x1: positionX,
        y1: positionY - semiMinor,
        x2: positionX,
        y2: positionY + semiMinor,
        stroke: plotProps.axisColor,
        "stroke-width": strokeWidth
    });
    group.appendChild(vLine);

    return group;
}
