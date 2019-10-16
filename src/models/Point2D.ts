import {toFixed} from "utilities";

export class Point2D {
    x: number;
    y: number;

    public static GetString(point: Point2D, decimals: number = -1) {
        if (decimals < 0) {
            return `(${point.x}, ${point.y})`;
        }
        else {
            return `(${toFixed(point.x, decimals)}, ${toFixed(point.y, decimals)})`;
        }
    }
}