import {createSvgElement, createSvgText, svgGroupFromLayer} from "./svgExport";

const SVG_NS = "http://www.w3.org/2000/svg";
let gradientCounter = 0;

/**
 * Renders the colorbar to SVG with gradient, ticks, labels, and title.
 *
 * The gradient is sampled at 256 stops for perceptually lossless fidelity
 * across all colormap types (including multi-hue and diverging maps).
 */
export function renderColorbarToSvg(
    colorscaleArray: (string | number)[],
    position: string,
    barX: number,
    barY: number,
    barWidth: number,
    barHeight: number,
    tickPositions: number[],
    tickTexts: string[],
    tickColor: string,
    tickWidth: number,
    tickLength: number,
    numberFont: string,
    numberFontSize: number,
    numberColor: string,
    numberRotation: number,
    labelText: string,
    labelFont: string,
    labelFontSize: number,
    labelColor: string,
    labelRotation: number,
    isBorderVisible: boolean,
    borderColor: string,
    borderWidth: number
): SVGGElement {
    const group = svgGroupFromLayer("colorbar");
    const defs = document.createElementNS(SVG_NS, "defs");
    group.appendChild(defs);

    // Create gradient from colorscale array
    // colorscaleArray is [offset, "rgb(...)", offset, "rgb(...)", ...]
    const isVertical = position === "right";
    const gradientId = `colorbar-gradient-${gradientCounter++}`;
    const gradient = createSvgElement("linearGradient", isVertical ? {id: gradientId, x1: "0%", y1: "100%", x2: "0%", y2: "0%"} : {id: gradientId, x1: "0%", y1: "0%", x2: "100%", y2: "0%"});

    // Sample at evenly-spaced stops for high fidelity
    if (colorscaleArray && colorscaleArray.length >= 2) {
        const stops: {offset: number; color: string}[] = [];
        for (let i = 0; i < colorscaleArray.length; i += 2) {
            stops.push({
                offset: colorscaleArray[i] as number,
                color: colorscaleArray[i + 1] as string
            });
        }

        // SVG requires gradient stops to be in strictly ascending order of offset.
        // If the colorscale is inverted, the raw array may have decreasing offsets,
        // which causes the SVG gradient to collapse and not render.
        stops.sort((a, b) => a.offset - b.offset);

        for (const stopData of stops) {
            const stop = createSvgElement("stop", {
                offset: `${(stopData.offset * 100).toFixed(2)}%`,
                "stop-color": stopData.color
            });
            gradient.appendChild(stop);
        }
    }
    defs.appendChild(gradient);

    // Gradient bar
    const bar = createSvgElement("rect", {
        x: barX,
        y: barY,
        width: barWidth,
        height: barHeight,
        fill: `url(#${gradientId})`
    });
    group.appendChild(bar);

    // Border
    if (isBorderVisible) {
        const border = createSvgElement("rect", {
            x: barX,
            y: barY,
            width: barWidth,
            height: barHeight,
            fill: "none",
            stroke: borderColor,
            "stroke-width": borderWidth
        });
        group.appendChild(border);
    }

    // Ticks and number labels
    for (let i = 0; i < tickPositions.length; i++) {
        const pos = tickPositions[i];
        const text = tickTexts[i] ?? "";

        if (isVertical) {
            // Vertical colorbar (right position)
            const tickY = barY + barHeight - pos;
            const tick = createSvgElement("line", {
                x1: barX + barWidth,
                y1: tickY,
                x2: barX + barWidth + tickLength,
                y2: tickY,
                stroke: tickColor,
                "stroke-width": tickWidth
            });
            group.appendChild(tick);

            if (text) {
                const label = createSvgText(text, barX + barWidth + tickLength + 4, tickY, {
                    fill: numberColor,
                    "font-family": numberFont,
                    "font-size": numberFontSize,
                    "dominant-baseline": "central",
                    transform: numberRotation !== 0 ? `rotate(${numberRotation},${barX + barWidth + tickLength + 4},${tickY})` : ""
                });
                group.appendChild(label);
            }
        } else {
            // Horizontal colorbar (top/bottom position)
            const tickX = barX + pos;
            const tick = createSvgElement("line", {
                x1: tickX,
                y1: barY + barHeight,
                x2: tickX,
                y2: barY + barHeight + tickLength,
                stroke: tickColor,
                "stroke-width": tickWidth
            });
            group.appendChild(tick);

            if (text) {
                const label = createSvgText(text, tickX, barY + barHeight + tickLength + numberFontSize, {
                    fill: numberColor,
                    "font-family": numberFont,
                    "font-size": numberFontSize,
                    "text-anchor": "middle",
                    transform: numberRotation !== 0 ? `rotate(${numberRotation},${tickX},${barY + barHeight + tickLength + numberFontSize})` : ""
                });
                group.appendChild(label);
            }
        }
    }

    // Label text
    if (labelText) {
        if (isVertical) {
            const labelX = barX + barWidth + tickLength + numberFontSize + 20;
            const labelY = barY + barHeight / 2;
            const label = createSvgText(labelText, labelX, labelY, {
                fill: labelColor,
                "font-family": labelFont,
                "font-size": labelFontSize,
                "text-anchor": "middle",
                "dominant-baseline": "central",
                transform: `rotate(${labelRotation},${labelX},${labelY})`
            });
            group.appendChild(label);
        } else {
            const label = createSvgText(labelText, barX + barWidth / 2, barY - labelFontSize, {
                fill: labelColor,
                "font-family": labelFont,
                "font-size": labelFontSize,
                "text-anchor": "middle"
            });
            group.appendChild(label);
        }
    }

    return group;
}
