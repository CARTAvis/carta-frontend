import {IconName, IOptionProps} from "@blueprintjs/core";

import {CustomIconName} from "icons/CustomIcons";

export type FileId = number;
export type RegionId = number;
// TODO: replace fileId: number/regionId: number with FileId, RegionId in codebase

export type LineKey = string | number;
export interface LineOption extends IOptionProps {
    disabled?: boolean;
    hightlight?: boolean;
    active?: boolean;
    icon?: IconName | CustomIconName;
    isCustomIcon?: boolean;
    isAnnotation?: boolean;
}
