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
                const sexagesimalMatch = value.match(/^([+-]?)(\d+):(\d{1,2}):(\d{1,2})(\.\d+)?$/);
                if (!sexagesimalMatch) {
                    return coordinate;
                }
                const [, sign, major, minute, second, fraction = ""] = sexagesimalMatch;
                const roundedSeconds = Number(`${second}${fraction}`);
                const normalizedSeconds = Number(toFixed(roundedSeconds, decimals));
                let totalMinutes = Number(minute);
                let totalMajor = Number(major);
                if (normalizedSeconds >= 60) {
                    totalMinutes++;
                }
                if (totalMinutes >= 60) {
                    totalMajor += Math.floor(totalMinutes / 60);
                    totalMinutes %= 60;
                }
                const secondsString = toFixed(normalizedSeconds >= 60 ? 0 : normalizedSeconds, decimals).padStart(decimals > 0 ? decimals + 3 : 2, "0");
                return `${sign}${String(totalMajor).padStart(2, "0")}:${String(totalMinutes).padStart(2, "0")}:${secondsString}${unit}`;
            }
            return `${toFixed(Number(value), decimals)}${unit}`;
        };

        return `(${decimals < 0 ? wcsPoint.x : roundCoordinate(wcsPoint.x)}, ${decimals < 0 ? wcsPoint.y : roundCoordinate(wcsPoint.y)})`;
    }
}
