import {IOptionProps} from "@blueprintjs/core";

export type FileId = number;
export type RegionId = number;
// TODO: replace fileId: number/regionId: number with FileId, RegionId in codebase

export type LineKey = string | number;
export interface LineOption extends IOptionProps{
    disabled?: boolean;
    hightlight?: boolean;
}
