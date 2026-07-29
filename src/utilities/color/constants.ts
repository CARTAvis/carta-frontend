import {Colors} from "@blueprintjs/core";

import {ColorMap, SelectableColor} from "enums/color";

export const SWATCH_COLORS: string[] = [
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
    Colors.CERULEAN3,
    Colors.ROSE3,
    Colors.VERMILION3,
    Colors.LIGHT_GRAY3,
    Colors.DARK_GRAY3,
    Colors.WHITE,
    Colors.BLACK
];

export const DEFAULT_COLOR = SWATCH_COLORS[0];
export const TRANSPARENT_COLOR = "#00000000";

export const SELECTABLE_COLORS: string[] = [
    SelectableColor.Blue,
    SelectableColor.Orange,
    SelectableColor.Green,
    SelectableColor.Red,
    SelectableColor.Violet,
    SelectableColor.Sepia,
    SelectableColor.Indigo,
    SelectableColor.Gray,
    SelectableColor.Lime,
    SelectableColor.Turquoise,
    SelectableColor.Forest,
    SelectableColor.Gold,
    SelectableColor.Cerulean,
    SelectableColor.Rose,
    SelectableColor.Vermilion,
    SelectableColor.LightGray,
    SelectableColor.DarkGray
];

export const SUPPORTED_COLORS: string[] = [...SELECTABLE_COLORS, "white", "black"];

export const AUTO_COLOR_OPTIONS: string[] = SELECTABLE_COLORS.map(color => `auto-${color}`);

// Supported auto colors are in pattern "auto-blue", "auto-orange", "auto-green"...etc
// Validate with regex ^auto-(blue|orange|green...)$
export const SUPPORTED_AUTO_COLORS_REGEX = new RegExp(`^auto-(${SUPPORTED_COLORS.join("|")})$`);

/**
 * All provided colormaps.
 */
export const COLOR_MAPS_ALL: string[] = Object.values(ColorMap);

/**
 * The selected colormaps shown in the option.
 */
export const COLOR_MAPS_SELECTED: string[] = [
    ColorMap.Afmhot,
    ColorMap.Blues,
    ColorMap.Coolwarm,
    ColorMap.Cubehelix,
    ColorMap.GistHeat,
    ColorMap.GistStern,
    ColorMap.Gnuplot,
    ColorMap.Gnuplot2,
    ColorMap.Gray,
    ColorMap.Greens,
    ColorMap.Greys,
    ColorMap.Hot,
    ColorMap.Inferno,
    ColorMap.Jet,
    ColorMap.Magma,
    ColorMap.NipySpectral,
    ColorMap.Plasma,
    ColorMap.Rainbow,
    ColorMap.RdBu,
    ColorMap.RdGy,
    ColorMap.Reds,
    ColorMap.Seismic,
    ColorMap.Spectral,
    ColorMap.Tab10,
    ColorMap.Viridis
];

/**
 * Some commonly used single-color gradients.
 */
export const COLOR_MAPS_MONO = new Map<string, string>([
    [ColorMap.Red, "#ff0000"],
    [ColorMap.Orange, "#ffa500"],
    [ColorMap.Yellow, "#ffff00"],
    [ColorMap.Green, "#00ff00"],
    [ColorMap.Cyan, "#00ffff"],
    [ColorMap.Blue, "#0000ff"],
    [ColorMap.Violet, "#7f00ff"],
    [ColorMap.Magenta, "#ff00ff"]
]);
