import {type Point2D} from "models";

export const IsValidWcsPoint = (point: Point2D | null | undefined): point is Point2D => {
    return !!point && !isNaN(point.x) && !isNaN(point.y) && isFinite(point.x) && isFinite(point.y);
};
