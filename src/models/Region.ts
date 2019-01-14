import {Point2D} from "./Point2D";

export enum RegionType {
    POINT = 0,
    RECTANGLE = 3,
    ELLIPSE = 4
}

export class Region {
    fileId: number;
    regionId: number = -1;
    regionType: RegionType;
    channelMin: number = -1;
    channelMax: number = -1;
    stokesValues: number[] = [];
    controlPoints: Point2D[] = [];

    public static  Validate(region: Region) {
        // All regions require at least one control point
        if (!region.controlPoints || !region.controlPoints.length) {
            return false;
        }

        // Basic validation, ensuring that the region has the correct number of control points
        switch (region.regionType) {
            case RegionType.POINT:
                return region.controlPoints.length === 1;
            case RegionType.RECTANGLE:
                return region.controlPoints.length === 2;
            case RegionType.ELLIPSE:
                return region.controlPoints.length === 2;
            default:
                return false;
        }
    }
}