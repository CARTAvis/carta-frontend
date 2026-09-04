import {createSvgElement, createSvgText, svgGroupFromLayer} from "./svgExport";

const SVG_NS = "http://www.w3.org/2000/svg";
let gradientCounter = 0;

export type ColorbarPosition = "right" | "top" | "bottom";

export interface ColorbarSvgOptions {
    colorscaleArray: (string | number)[];
    position: ColorbarPosition;
    bar: {x: number; y: number; width: number; height: number; gradientVisible: boolean};
    ticks: {positions: number[]; texts: string[]; visible: boolean; color: string; width: number; length: number};
    numbers: {visible: boolean; fontFamily: string; fontSize: number; fontStyle: string; fontWeight: number; color: string; rotation: number; gap: number; width: number};
    label: {text: string; fontFamily: string; fontSize: number; fontStyle: string; fontWeight: number; color: string; rotation: number};
    border: {visible: boolean; color: string; width: number};
}

/** Renders the colorbar to SVG with gradient, ticks, labels, and title. */
export function renderColorbarToSvg({colorscaleArray, position, bar, ticks, numbers, label, border}: ColorbarSvgOptions): SVGGElement {
    const group = svgGroupFromLayer("colorbar");
    const defs = document.createElementNS(SVG_NS, "defs");
    group.appendChild(defs);

    // Create gradient from colorscale array
    // colorscaleArray is [offset, "rgb(...)", offset, "rgb(...)", ...]
    const isVertical = position === "right";
    const gradientId = `colorbar-gradient-${gradientCounter++}`;
    const gradient = createSvgElement("linearGradient", isVertical ? {id: gradientId, x1: "0%", y1: "100%", x2: "0%", y2: "0%"} : {id: gradientId, x1: "0%", y1: "0%", x2: "100%", y2: "0%"});

    // Preserve the supplied colorscale stops.
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
    const barRect = createSvgElement("rect", {
        x: bar.x,
        y: bar.y,
        width: bar.width,
        height: bar.height,
        fill: bar.gradientVisible ? `url(#${gradientId})` : "none"
    });
    group.appendChild(barRect);

    // Border
    if (border.visible) {
        const borderRect = createSvgElement("rect", {
            x: bar.x,
            y: bar.y,
            width: bar.width,
            height: bar.height,
            fill: "none",
            stroke: border.color,
            "stroke-width": border.width
        });
        group.appendChild(borderRect);
    }

    // Ticks and number labels
    for (let i = 0; (ticks.visible || numbers.visible) && i < ticks.positions.length; i++) {
        const pos = ticks.positions[i];
        const text = ticks.texts[i] ?? "";

        if (isVertical) {
            const tickY = pos;
            const tickX = bar.x + bar.width;
            if (ticks.visible) {
                const tick = createSvgElement("line", {
                    x1: tickX - ticks.length,
                    y1: tickY,
                    x2: tickX,
                    y2: tickY,
                    stroke: ticks.color,
                    "stroke-width": ticks.width
                });
                group.appendChild(tick);
            }

            if (numbers.visible && text) {
                const labelX = tickX + numbers.gap + (numbers.rotation === 0 ? 0 : numbers.fontSize / 2);
                const numberLabel = createSvgText(text, labelX, tickY, {
                    fill: numbers.color,
                    "font-family": numbers.fontFamily,
                    "font-size": numbers.fontSize,
                    "font-style": numbers.fontStyle,
                    "font-weight": numbers.fontWeight,
                    "text-anchor": numbers.rotation === 0 ? "start" : "middle",
                    "dominant-baseline": "central",
                    ...(numbers.rotation !== 0 ? {transform: `rotate(${numbers.rotation},${labelX},${tickY})`} : {})
                });
                group.appendChild(numberLabel);
            }
        } else {
            const tickX = pos;
            const tickY = position === "top" ? bar.y : bar.y + bar.height;
            if (ticks.visible) {
                const tick = createSvgElement("line", {
                    x1: tickX,
                    y1: tickY + (position === "top" ? ticks.length : -ticks.length),
                    x2: tickX,
                    y2: tickY,
                    stroke: ticks.color,
                    "stroke-width": ticks.width
                });
                group.appendChild(tick);
            }

            if (numbers.visible && text) {
                const labelY = position === "top" ? bar.y - numbers.gap : bar.y + bar.height + numbers.fontSize + numbers.gap;
                const numberLabel = createSvgText(text, tickX, labelY, {
                    fill: numbers.color,
                    "font-family": numbers.fontFamily,
                    "font-size": numbers.fontSize,
                    "font-style": numbers.fontStyle,
                    "font-weight": numbers.fontWeight,
                    "text-anchor": "middle"
                });
                group.appendChild(numberLabel);
            }
        }
    }

    // Label text
    if (label.text) {
        if (isVertical) {
            const labelX = bar.x + bar.width + numbers.width + numbers.gap + (label.rotation === 0 ? 0 : label.fontSize / 2);
            const labelY = bar.y + bar.height / 2;
            const title = createSvgText(label.text, labelX, labelY, {
                fill: label.color,
                "font-family": label.fontFamily,
                "font-size": label.fontSize,
                "font-style": label.fontStyle,
                "font-weight": label.fontWeight,
                "text-anchor": "middle",
                "dominant-baseline": "central",
                ...(label.rotation !== 0 ? {transform: `rotate(${label.rotation},${labelX},${labelY})`} : {})
            });
            group.appendChild(title);
        } else {
            const labelY = position === "top" ? bar.y - numbers.width - numbers.gap : bar.y + bar.height + numbers.width + numbers.gap + label.fontSize;
            const title = createSvgText(label.text, bar.x + bar.width / 2, labelY, {
                fill: label.color,
                "font-family": label.fontFamily,
                "font-size": label.fontSize,
                "font-style": label.fontStyle,
                "font-weight": label.fontWeight,
                "text-anchor": "middle"
            });
            group.appendChild(title);
        }
    }

    return group;
}
