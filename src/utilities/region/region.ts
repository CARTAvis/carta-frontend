import {CARTA} from "carta-protobuf";

import {type Point2D} from "models";
import {toFixed} from "utilities/units/units";

const CENTER_POINT_INDEX = 0;
const SIZE_POINT_INDEX = 1;

export function getRegionProperties(regionType: CARTA.RegionType, controlPoints: Point2D[], rotation: number): string {
    const point = controlPoints[CENTER_POINT_INDEX];
    const center = isFinite(point.x) && isFinite(point.y) ? `${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix` : "Invalid";

    switch (regionType) {
        case CARTA.RegionType.POINT:
            return `Point (pixel) [${center}]`;
        case CARTA.RegionType.LINE:
            let lineProperties = "Line (pixel) [";
            controlPoints.forEach((point, index) => {
                lineProperties += isFinite(point.x) && isFinite(point.y) ? `[${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix]` : "[Invalid]";
                lineProperties += index !== controlPoints.length - 1 ? ", " : "]";
            });
            return lineProperties;
        case CARTA.RegionType.RECTANGLE:
            return `rotbox[[${center}], [${toFixed(controlPoints[SIZE_POINT_INDEX].x, 6)}pix, ${toFixed(controlPoints[SIZE_POINT_INDEX].y, 6)}pix], ${toFixed(rotation, 6)}deg]`;
        case CARTA.RegionType.ELLIPSE:
            return `ellipse[[${center}], [${toFixed(controlPoints[SIZE_POINT_INDEX].x, 6)}pix, ${toFixed(controlPoints[SIZE_POINT_INDEX].y, 6)}pix], ${toFixed(rotation, 6)}deg]`;
        case CARTA.RegionType.POLYGON:
            let polygonProperties = "poly[";
            controlPoints.forEach((point, index) => {
                polygonProperties += isFinite(point.x) && isFinite(point.y) ? `[${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix]` : "[Invalid]";
                polygonProperties += index !== controlPoints.length - 1 ? ", " : "]";
            });
            return polygonProperties;
        case CARTA.RegionType.POLYLINE:
            let polylineProperties = "Polyline (pixel) [";
            controlPoints.forEach((point, index) => {
                polylineProperties += isFinite(point.x) && isFinite(point.y) ? `[${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix]` : "[Invalid]";
                polylineProperties += index !== controlPoints.length - 1 ? ", " : "]";
            });
            return polylineProperties;
        default:
            return "Not Implemented";
    }
}
