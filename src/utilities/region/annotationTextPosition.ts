import {type Point2D} from "models";

/** Convert Konva's anchor offsets to the centered position used by SVG text. */
export function getTextCenterFromOffset(anchor: Point2D, offset: Point2D, width: number, height: number, pixelRatio = 1): Point2D {
    return {
        x: anchor.x + (width / 2 - offset.x) * pixelRatio,
        y: anchor.y + (height / 2 - offset.y) * pixelRatio
    };
}

/** Calculate Konva offsets for placing the text center at a requested point. */
export function getTextOffsetForCenter(anchor: Point2D, center: Point2D, width: number, height: number): Point2D {
    return {x: anchor.x - center.x + width / 2, y: anchor.y - center.y + height / 2};
}
