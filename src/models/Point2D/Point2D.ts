import {ToFixed} from "utilities";

export class Point2D {
    x: number;
    y: number;

    public static ToString(point: Point2D, unit: string, decimals: number = -1) {
        return point ? `(${decimals < 0 ? point.x : ToFixed(point.x, decimals)} ${unit}, ${decimals < 0 ? point.y : ToFixed(point.y, decimals)} ${unit})` : "";
    }
}

export class WCSPoint2D {
    x: string;
    y: string;

    public static ToString(wcsPoint: WCSPoint2D) {
        return wcsPoint ? `(${wcsPoint.x}, ${wcsPoint.y})` : "";
    }
}
