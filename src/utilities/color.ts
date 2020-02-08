// Static assets
import allMaps from "static/allmaps.png";
import { Colors } from "@blueprintjs/core";
import {RenderConfigStore} from "stores";

export interface RGBA {
    r: number;
    g: number;
    b: number;
    a?: number;
}

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

export function isColorValid(colorString: string): boolean {
    const colorHex: RegExp = /^#([A-Fa-f0-9]{3}){1,2}$/;
    return colorHex.test(colorString);
}

// adapted from https://stackoverflow.com/questions/21646738/convert-hex-to-rgba
export function hexStringToRgba(colorString: string, alpha: number = 1): RGBA {
    if (!isColorValid(colorString)) {
        return null;
    }

    let c = colorString.substring(1).split("");
    if (c.length === 3) { // shorthand hex color
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    const hex = Number("0x" + c.join(""));

    return {
        r: (hex >> 16) & 255,
        g: (hex >> 8) & 255,
        b: hex & 255,
        a: alpha
    };
}
// end stolen from https://stackoverflow.com/questions/21646738/convert-hex-to-rgba

function initContextWithSize(width: number, height: number) {
    const canvas = document.createElement("canvas") as HTMLCanvasElement;
    canvas.width = width; 
    canvas.height = height; 
    const ctx = canvas.getContext("2d");
    return ctx;
}

// return color map as Uint8ClampedArray according colorMap
export function getColorsForValues (colorMap: string): {color: Uint8ClampedArray, size: number} {
    const colorMaps = RenderConfigStore.COLOR_MAPS_ALL;
    const colorMapIndex = colorMaps.indexOf(colorMap);

    // the source image for colormaps is 1024x790, with each colormap taking a 1024x10 region
    const ctx = initContextWithSize(1024, 1);
    if (!allMaps) {
        return null;
    }
    const imageObj = new Image();
    imageObj.src = allMaps;
    ctx.drawImage(imageObj, 0, 10 * colorMapIndex + 1, 1024, 1, 0, 0, 1024, 1);
    const colorMapPixel = ctx.getImageData(0, 0, 1023, 1);
    return {color: colorMapPixel.data, size: colorMapPixel.width}; 
}
