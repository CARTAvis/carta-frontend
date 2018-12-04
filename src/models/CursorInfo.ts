import {Point2D} from "./Point2D";

export interface CursorInfo {
    posCanvasSpace: Point2D;
    posImageSpace: Point2D;
    posWCS: Point2D;
    infoWCS: { x: string, y: string };
    value: number;
}