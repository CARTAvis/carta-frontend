import type * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";

import {type Point2D, Transform2D} from "models";
import {isAstBadPoint, scale2D, toFixed, transformPoint} from "utilities";

const CENTER_POINT_INDEX = 0;
const SIZE_POINT_INDEX = 1;

export interface RegionTransformSource {
    regionType: CARTA.RegionType;
    center: Point2D;
    size: Point2D;
    controlPoints: Point2D[];
    rotation: number;
}

export function getRegionPixelProperties(regionType: CARTA.RegionType, controlPoints: Point2D[], rotation: number): string {
    const point = controlPoints[CENTER_POINT_INDEX];
    const center = isFinite(point.x) && isFinite(point.y) ? `${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix` : "Invalid";

    switch (regionType) {
        case CARTA.RegionType.POINT:
            return `Point (pixel) [${center}]`;
        case CARTA.RegionType.LINE:
            let lineProperties = "Line (pixel) [";
            controlPoints.forEach((point, index) => {
                lineProperties += getPointPixelString(point);
                lineProperties += index !== controlPoints.length - 1 ? ", " : "]";
            });
            return lineProperties;
        case CARTA.RegionType.RECTANGLE: {
            const size = getSizePixelString(controlPoints[SIZE_POINT_INDEX]);
            return `rotbox[[${center}], [${size}], ${toFixed(rotation, 6)}deg]`;
        }
        case CARTA.RegionType.ELLIPSE: {
            const size = getSizePixelString(controlPoints[SIZE_POINT_INDEX]);
            return `ellipse[[${center}], [${size}], ${toFixed(rotation, 6)}deg]`;
        }
        case CARTA.RegionType.POLYGON:
            let polygonProperties = "poly[";
            controlPoints.forEach((point, index) => {
                polygonProperties += getPointPixelString(point);
                polygonProperties += index !== controlPoints.length - 1 ? ", " : "]";
            });
            return polygonProperties;
        case CARTA.RegionType.POLYLINE:
            let polylineProperties = "Polyline (pixel) [";
            controlPoints.forEach((point, index) => {
                polylineProperties += getPointPixelString(point);
                polylineProperties += index !== controlPoints.length - 1 ? ", " : "]";
            });
            return polylineProperties;
        default:
            return "Not Implemented";
    }
}

export function getTransformedRegionProperties(region: RegionTransformSource, spatialTransformAST: AST.Mapping): {controlPoints: Point2D[]; rotation: number} {
    switch (region.regionType) {
        case CARTA.RegionType.RECTANGLE:
        case CARTA.RegionType.ELLIPSE:
        case CARTA.RegionType.ANNRECTANGLE:
        case CARTA.RegionType.ANNELLIPSE:
        case CARTA.RegionType.ANNTEXT: {
            const center = transformPoint(spatialTransformAST, region.center, false);
            if (isAstBadPoint(center)) {
                return {controlPoints: [center, region.size], rotation: region.rotation};
            }

            const transform = new Transform2D(spatialTransformAST, center);
            return {
                controlPoints: [center, scale2D(region.size, 1.0 / transform.scale)],
                rotation: region.rotation - (transform.rotation * 180) / Math.PI
            };
        }
        default:
            return {
                controlPoints: region.controlPoints.map(point => transformPoint(spatialTransformAST, point, false)),
                rotation: region.rotation
            };
    }
}

function getPointPixelString(point: Point2D): string {
    return isFinite(point.x) && isFinite(point.y) ? `[${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix]` : "[Invalid]";
}

function getSizePixelString(point: Point2D): string {
    return `${toFixed(point.x, 6)}pix, ${toFixed(point.y, 6)}pix`;
}
