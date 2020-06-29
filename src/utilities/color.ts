// Static assets
import allMaps from "static/allmaps.png";
import {Colors} from "@blueprintjs/core";
import {RenderConfigStore} from "stores";

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

function initContextWithSize(width: number, height: number) {
    const canvas = document.createElement("canvas") as HTMLCanvasElement;
    canvas.width = width; 
    canvas.height = height;
    return canvas.getContext("2d");
}

let colormapContext: CanvasRenderingContext2D | undefined;

// return color map as Uint8ClampedArray according colorMap
export function getColorsForValues (colorMap: string): {color: Uint8ClampedArray, size: number} {
    const colorMaps = RenderConfigStore.COLOR_MAPS_ALL;
    const colorMapIndex = colorMaps.indexOf(colorMap);

    // the source image for colormaps is 1024x790, with each colormap taking a 1024x10 region
    if (!colormapContext) {
        colormapContext = initContextWithSize(1024, 1);
    }
    if (!allMaps) {
        return null;
    }
    const imageObj = new Image();
    imageObj.src = allMaps;
    colormapContext.drawImage(imageObj, 0, 10 * colorMapIndex + 1, 1024, 1, 0, 0, 1024, 1);
    const colorMapPixel = colormapContext.getImageData(0, 0, 1023, 1);
    return {color: colorMapPixel.data, size: colorMapPixel.width}; 
}
