import {RegionOpacity} from "enums";

const SEMI_TRANSPARENT_ICON_OPACITY = 0.3;
const DEFAULT_ICON_OPACITY = 1;

export function getRegionIconOpacity(opacity: RegionOpacity): number {
    return opacity === RegionOpacity.SemiTransparent ? SEMI_TRANSPARENT_ICON_OPACITY : DEFAULT_ICON_OPACITY;
}
