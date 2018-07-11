import {Point2D} from "./Point2D";

export class CursorInfo {
    posCanvasSpace: Point2D;
    posImageSpace: Point2D;
    posWCS: Point2D;
    infoWCS: { x: string, y: string };
    value: number;
}