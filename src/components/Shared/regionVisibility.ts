import {RegionsOpacity} from "enums";

const SEMI_TRANSPARENT_VISIBILITY_ICON_OPACITY = 0.3;
const DEFAULT_VISIBILITY_ICON_OPACITY = 1;

export function getRegionVisibilityIconOpacity(opacity: RegionsOpacity): number {
    return opacity === RegionsOpacity.SemiTransparent ? SEMI_TRANSPARENT_VISIBILITY_ICON_OPACITY : DEFAULT_VISIBILITY_ICON_OPACITY;
}
