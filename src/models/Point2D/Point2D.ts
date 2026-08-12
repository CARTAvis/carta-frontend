import {toFixed} from "utilities";

export class Point2D {
    x: number;
    y: number;

    public static toString(point: Point2D, unit: string, decimals: number = -1) {
        return point ? `(${decimals < 0 ? point.x : toFixed(point.x, decimals)} ${unit}, ${decimals < 0 ? point.y : toFixed(point.y, decimals)} ${unit})` : "";
    }
}

export class WCSPoint2D {
    x: string;
    y: string;

    public static toString(wcsPoint: WCSPoint2D, decimals: number = -1) {
        if (!wcsPoint) {
            return "";
        }

        const roundCoordinate = (coordinate: string) => {
            const unitMatch = coordinate.match(/(\s*(?:deg|["']))$/i);
            const unit = unitMatch?.[1] ?? "";
            const value = unit ? coordinate.slice(0, -unit.length) : coordinate;
            const match = value.match(/^(.*\.)(\d+)$/);
            if (!match) {
                return coordinate;
            }

            if (value.includes(":")) {
                const parts = match[1].slice(0, -1).split(":");
                const seconds = Number(parts.pop()) + Number(`0.${match[2]}`);
                return `${[...parts, toFixed(seconds, decimals)].join(":")}${unit}`;
            }
            return `${toFixed(Number(value), decimals)}${unit}`;
        };

        return `(${decimals < 0 ? wcsPoint.x : roundCoordinate(wcsPoint.x)}, ${decimals < 0 ? wcsPoint.y : roundCoordinate(wcsPoint.y)})`;
    }
}
