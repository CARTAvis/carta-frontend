// Static assets
import allMaps from "static/allmaps.png";
import {Colors} from "@blueprintjs/core";
import {RenderConfigStore, AppStore} from "stores";

export const SWATCH_COLORS = [
    Colors.BLUE3,
    Colors.GREEN3,
    Colors.ORANGE3,
    Colors.RED3,
    Colors.VERMILION3,
    Colors.ROSE3,
    Colors.VIOLET3,
    Colors.INDIGO3,
    Colors.COBALT3,
    Colors.TURQUOISE3,
    Colors.FOREST3,
    Colors.LIME3,
    Colors.GOLD3,
    Colors.SEPIA3,
    Colors.BLACK,
    Colors.DARK_GRAY3,
    Colors.GRAY3,
    Colors.LIGHT_GRAY3,
    Colors.WHITE
];
export const DEFAULT_COLOR = SWATCH_COLORS[0];

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
export function getColorsForValues(colorMap: string): { color: Uint8ClampedArray, size: number } {
    const colorMaps = RenderConfigStore.COLOR_MAPS_ALL;
    const colorMapIndex = colorMaps.indexOf(colorMap);

    if (colormapContext) {
        const colorMapPixel = colormapContext?.getImageData(0, colorMapIndex * 5 + 2, imageObj.width - 1, 1);
        return {color: colorMapPixel?.data, size: colorMapPixel?.width};
    }
    return {color: new Uint8ClampedArray([0, 0, 0, 0]), size: 1};
}

export function isAutoColor(color: string) {
    return color?.indexOf("auto-") === 0;
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
    if (AppStore.Instance.darkTheme) {
        return Colors[`${requiredColor}4`];
    } else {
        return Colors[`${requiredColor}2`];
    }
}
