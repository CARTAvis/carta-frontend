import {Point2D} from "./Point2D";

export interface CursorInfo {
    posImageSpace: Point2D;
    posWCS: Point2D;
    infoWCS: { x: string, y: string };
}