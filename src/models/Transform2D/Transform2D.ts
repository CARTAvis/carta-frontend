import type * as AST from "ast_wrapper";

import {type Point2D} from "models";
import {Add2D, Length2D, ScaleAndRotateAboutPoint2D, Subtract2D, TransformPoint} from "utilities";

export class Transform2D {
    translation: Point2D;
    rotation: number;
    scale: number;
    origin: Point2D;

    constructor(astTransform: AST.Mapping, refPixel: Point2D) {
        const transformedRef = TransformPoint(astTransform, refPixel, true);
        const delta = 1.0;
        const refTop = Add2D(refPixel, {x: 0, y: delta / 2.0});
        const refBottom = Add2D(refPixel, {x: 0, y: -delta / 2.0});
        const northVector = Subtract2D(refTop, refBottom);
        const transformedRefTop = TransformPoint(astTransform, refTop, true);
        const transformedRefBottom = TransformPoint(astTransform, refBottom, true);
        const transformedNorthVector = Subtract2D(transformedRefTop, transformedRefBottom);
        this.scale = Length2D(transformedNorthVector) / Length2D(northVector);
        this.rotation = Math.atan2(transformedNorthVector.y, transformedNorthVector.x) - Math.atan2(northVector.y, northVector.x);
        this.translation = Subtract2D(transformedRef, refPixel);
        this.origin = {x: refPixel.x, y: refPixel.y};
    }

    transformCoordinate(point: Point2D, isForward: boolean = true) {
        if (isForward) {
            // Move point from the original frame to the reference frame, using the supplied transform
            const scaledPoint = ScaleAndRotateAboutPoint2D(point, this.origin, this.scale, this.rotation);
            return Add2D(scaledPoint, this.translation);
        } else {
            // Move point from the reference frame to the original frame, using the supplied transform
            const shiftedPoint = Subtract2D(point, this.translation);
            return ScaleAndRotateAboutPoint2D(shiftedPoint, this.origin, 1.0 / this.scale, -this.rotation);
        }
    }
}
