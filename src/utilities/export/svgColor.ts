import {getColorsForValues} from "utilities/color/color";
import {clamp} from "utilities/math/math";

type ColorMapLookup = ReturnType<typeof getColorsForValues>;
interface CachedColorMap {
    lookup: ColorMapLookup;
    cssColors: string[];
}

const COLOR_MAP_LOOKUP_CACHE = new Map<string, CachedColorMap>();

/** Samples a configured colormap using the same bias/contrast/inversion order as the overlay shaders. */
export function sampleSvgColormapColor(colorMap: string, fraction: number, bias: number, contrast: number, fallbackColor: string, isInverted = false): string {
    let cachedColorMap = COLOR_MAP_LOOKUP_CACHE.get(colorMap);
    if (!cachedColorMap) {
        const lookup = getColorsForValues(colorMap);
        // A one-entry transparent result means the colormap image has not loaded yet.
        if (lookup.size > 1) {
            const cssColors = Array.from({length: lookup.size}, (_, index) => {
                const offset = index * 4;
                return `rgba(${lookup.color[offset]}, ${lookup.color[offset + 1]}, ${lookup.color[offset + 2]}, ${(lookup.color[offset + 3] ?? 255) / 255})`;
            });
            cachedColorMap = {lookup, cssColors};
            COLOR_MAP_LOOKUP_CACHE.set(colorMap, cachedColorMap);
        } else {
            cachedColorMap = {lookup, cssColors: []};
        }
    }

    const {lookup, cssColors} = cachedColorMap;
    if (!lookup.size || lookup.color.length < 4) {
        return fallbackColor;
    }

    let sampledFraction = clamp(fraction - bias, 0, 1);
    sampledFraction = clamp((sampledFraction - 0.5) * contrast + 0.5, 0, 1);
    if (isInverted) {
        sampledFraction = 1 - sampledFraction;
    }

    const colorIndex = clamp(Math.round(sampledFraction * (lookup.size - 1)), 0, lookup.size - 1);
    if (cssColors.length) return cssColors[colorIndex];
    const offset = colorIndex * 4;
    return `rgba(${lookup.color[offset]}, ${lookup.color[offset + 1]}, ${lookup.color[offset + 2]}, ${(lookup.color[offset + 3] ?? 255) / 255})`;
}
