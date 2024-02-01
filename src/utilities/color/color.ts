// Static assets
import {Colors} from "@blueprintjs/core";
import allMaps from "static/allmaps.png";

import {AppStore} from "stores";
import {RenderConfigStore} from "stores/Frame";

export const SWATCH_COLORS = [
    Colors.BLUE3,
    Colors.ORANGE3,
    Colors.GREEN3,
    Colors.RED3,
    Colors.VIOLET3,
    Colors.SEPIA3,
    Colors.INDIGO3,
    Colors.GRAY3,
    Colors.LIME3,
    Colors.TURQUOISE3,
    Colors.FOREST3,
    Colors.GOLD3,
    Colors.COBALT3,
    Colors.LIGHT_GRAY3,
    Colors.DARK_GRAY3,
    Colors.WHITE,
    Colors.BLACK
];
export const DEFAULT_COLOR = SWATCH_COLORS[0];

const SELECTABLE_COLORS = ["blue", "orange", "green", "red", "violet", "sepia", "indigo", "gray", "lime", "turquoise", "forest", "gold", "cobalt", "light_gray", "dark_gray", "white", "black"];
export const AUTO_COLOR_OPTIONS = SELECTABLE_COLORS.map(color => {
    return `auto-${color}`;
});

// SUPPORTED_COLORS are supported since ver. 1.4, and rose/vermilion are removed from selectable colors due to similar to red
const SUPPORTED_COLORS = [...SELECTABLE_COLORS, "rose", "vermilion"];

// Supported auto colors are in pattern "auto-blue", "auto-orange", "auto-green"...etc
// Validate with regex ^auto-(blue|orange|green...)$
const SUPPORTED_AUTO_COLORS_REGEX = new RegExp(`^auto-(${SUPPORTED_COLORS.join("|")})$`);

function initContextWithSize(width: number, height: number) {
    const canvas = document.createElement("canvas") as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext("2d");
}

let colormapContext: CanvasRenderingContext2D | undefined;
const imageObj = new Image();
imageObj.src = allMaps;
imageObj.onload = () => {
    colormapContext = initContextWithSize(imageObj.width, imageObj.height);
    colormapContext.drawImage(imageObj, 0, 0, imageObj.width, imageObj.height, 0, 0, imageObj.width, imageObj.height);
};

// return color map as Uint8ClampedArray according colorMap
export function getColorsForValues(colorMap: string): {color: Uint8ClampedArray; size: number} {
    if (RenderConfigStore?.COLOR_MAPS_CALCULATED.get(colorMap)) {
        const targetColorHex: string = RenderConfigStore.COLOR_MAPS_CALCULATED.get(colorMap);
        const startColorHex: string = "#000000"; // black
        const steps = 1024;
        const gradientColors = new Uint8ClampedArray(generateColorGradientArray(targetColorHex, startColorHex, steps));
        return {color: gradientColors, size: steps};
    }

    const colorMaps = RenderConfigStore.COLOR_MAPS_ALL;
    const colorMapIndex = colorMaps.indexOf(colorMap);

    if (colormapContext) {
        // const colorMapPixel = colormapContext?.getImageData(0, colorMapIndex * 5 + 2, imageObj.width - 1, 1);
        const colorMapPixel = colormapContext?.getImageData(0, colorMapIndex * 5 + 2, imageObj.width, 1);
        return {color: colorMapPixel?.data, size: colorMapPixel?.width};
    }
    return {color: new Uint8ClampedArray([0, 0, 0, 0]), size: 1};
}

export function isAutoColor(color: string): boolean {
    return SUPPORTED_AUTO_COLORS_REGEX.test(color);
}

export function genColorFromIndex(index: number) {
    const selectedColor = Number.isInteger(index) && index >= 0 ? SELECTABLE_COLORS[index % SELECTABLE_COLORS.length] : SELECTABLE_COLORS[0];
    return Colors[`${selectedColor.toUpperCase()}${AppStore.Instance.darkTheme ? "4" : "2"}`];
}

export function getColorForTheme(color: string) {
    if (!isAutoColor(color)) {
        return color;
    }

    if (color === "auto-black") {
        return Colors.BLACK;
    } else if (color === "auto-white") {
        return Colors.WHITE;
    }

    const requiredColor = color.substr(5).toUpperCase();
    return Colors[`${requiredColor}${AppStore.Instance.darkTheme ? "4" : "2"}`];
}

function hexToRgb(hex: string): number[] {
    // Remove the hash if it exists
    hex = hex.replace(/^#/, "");

    // Parse the hex values into separate R, G, B values
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return [r, g, b];
}

function generateColorGradientArray(targetColorHex: string, startColorHex = "#000000", steps: number = 1023) {
    const gradientArray = [];

    // Convert Hex to RGBA
    const targetColor = hexToRgb(targetColorHex);
    const startColor = hexToRgb(startColorHex);

    for (let i = 0; i <= steps - 1; i++) {
        // Calculate the interpolation factor
        const factor = i / (steps - 1);

        // Interpolate RGBA values from the start color to the target color
        const red = Math.round((1 - factor) * startColor[0] + factor * targetColor[0]);
        const green = Math.round((1 - factor) * startColor[1] + factor * targetColor[1]);
        const blue = Math.round((1 - factor) * startColor[2] + factor * targetColor[2]);
        const alpha = 255;

        // Push the RGBA values as a string to the array
        gradientArray.push(red, green, blue, alpha);
    }

    return gradientArray;
}
