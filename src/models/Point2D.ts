import {toFixed} from "utilities/units";

export class Point2D {
    x: number;
    y: number;

    public static ToString(point: Point2D, unit: string, decimals: number = -1) {
        return point ? `(${decimals < 0 ? point.x : toFixed(point.x, decimals)} ${unit}, ${decimals < 0 ? point.y : toFixed(point.y, decimals)} ${unit})` : "";
    }
}

export class WCSPoint2D {
    x: string;
    y: string;

    public static ToString(wcsPoint: WCSPoint2D) {
        return wcsPoint ? `(${wcsPoint.x}, ${wcsPoint.y})` : "";
    }
}
