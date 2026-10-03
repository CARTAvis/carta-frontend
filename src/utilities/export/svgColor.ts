import {getColorsForValues} from "utilities/color/color";

type ColorMapLookup = ReturnType<typeof getColorsForValues>;

const COLOR_MAP_LOOKUP_CACHE = new Map<string, ColorMapLookup>();

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** Samples a configured colormap using the same bias/contrast/inversion order as the overlay shaders. */
export function sampleSvgColormapColor(colorMap: string, fraction: number, bias: number, contrast: number, fallbackColor: string, isInverted = false): string {
    let lookup = COLOR_MAP_LOOKUP_CACHE.get(colorMap);
    if (!lookup) {
        lookup = getColorsForValues(colorMap);
        // A one-entry transparent result means the colormap image has not loaded yet.
        if (lookup.size > 1) {
            COLOR_MAP_LOOKUP_CACHE.set(colorMap, lookup);
        }
    }

    if (!lookup.size || lookup.color.length < 4) {
        return fallbackColor;
    }

    let sampledFraction = clamp(fraction - bias, 0, 1);
    sampledFraction = clamp((sampledFraction - 0.5) * contrast + 0.5, 0, 1);
    if (isInverted) {
        sampledFraction = 1 - sampledFraction;
    }

    const colorIndex = clamp(Math.round(sampledFraction * (lookup.size - 1)), 0, lookup.size - 1);
    const offset = colorIndex * 4;
    return `rgba(${lookup.color[offset]}, ${lookup.color[offset + 1]}, ${lookup.color[offset + 2]}, ${(lookup.color[offset + 3] ?? 255) / 255})`;
}
