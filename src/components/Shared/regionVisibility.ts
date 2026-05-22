import {RegionOpacity} from "enums";

const SEMI_TRANSPARENT_VISIBILITY_ICON_OPACITY = 0.3;
const DEFAULT_VISIBILITY_ICON_OPACITY = 1;

export function getRegionVisibilityIconOpacity(opacity: RegionOpacity): number {
    return opacity === RegionOpacity.SemiTransparent ? SEMI_TRANSPARENT_VISIBILITY_ICON_OPACITY : DEFAULT_VISIBILITY_ICON_OPACITY;
}
