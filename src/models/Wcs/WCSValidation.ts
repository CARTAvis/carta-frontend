import {Point2D} from "models";

export const isValidWcsPoint = (point: Point2D | null | undefined): point is Point2D => {
    return !!point && !isNaN(point.x) && !isNaN(point.y) && isFinite(point.x) && isFinite(point.y);
};
