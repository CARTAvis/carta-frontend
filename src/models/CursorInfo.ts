import {Point2D} from "./Point2D";

export enum CursorInfoVisibility {
    Always = "always",
    Never = "never",
    ActiveImage = "activeImage",
    HideTiled = "hideTiled"
}

export interface CursorInfo {
    posImageSpace: Point2D;
    isInsideImage: boolean;
    posWCS: Point2D;
    infoWCS: {x: string; y: string};
}
