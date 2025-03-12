import {Point2D} from "models";

export interface CursorInfo {
    posImageSpace: Point2D;
    isInsideImage: boolean;
    posWCS: Point2D;
    infoWCS: {x: string; y: string};
}
