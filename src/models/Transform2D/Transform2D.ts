import * as AST from "ast_wrapper";

import {Point2D} from "models";
import {add2D, length2D, scaleAndRotateAboutPoint2D, subtract2D, transformPoint} from "utilities";

export class Transform2D {
    translation: Point2D;
    rotation: number;
    scale: number;
    origin: Point2D;

    constructor(astTransform: AST.Mapping, refPixel: Point2D) {
        const transformedRef = transformPoint(astTransform, refPixel, true);
        const delta = 1.0;
        const refTop = add2D(refPixel, {x: 0, y: delta / 2.0});
        const refBottom = add2D(refPixel, {x: 0, y: -delta / 2.0});
        const northVector = subtract2D(refTop, refBottom);
        const transformedRefTop = transformPoint(astTransform, refTop, true);
        const transformedRefBottom = transformPoint(astTransform, refBottom, true);
        const transformedNorthVector = subtract2D(transformedRefTop, transformedRefBottom);
        this.scale = length2D(transformedNorthVector) / length2D(northVector);
        this.rotation = Math.atan2(transformedNorthVector.y, transformedNorthVector.x) - Math.atan2(northVector.y, northVector.x);
        this.translation = subtract2D(transformedRef, refPixel);
        this.origin = {x: refPixel.x, y: refPixel.y};
    }

    transformCoordinate(point: Point2D, forward: boolean = true) {
        if (forward) {
            // Move point from the original frame to the reference frame, using the supplied transform
            const scaledPoint = scaleAndRotateAboutPoint2D(point, this.origin, this.scale, this.rotation);
            return add2D(scaledPoint, this.translation);
        } else {
            // Move point from the reference frame to the original frame, using the supplied transform
            const shiftedPoint = subtract2D(point, this.translation);
            return scaleAndRotateAboutPoint2D(shiftedPoint, this.origin, 1.0 / this.scale, -this.rotation);
        }
    }
}
