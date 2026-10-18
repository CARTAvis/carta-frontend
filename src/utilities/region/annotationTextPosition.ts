import {type Point2D} from "models";

/** Convert Konva's anchor offsets to the centered position used by SVG text. */
export function getTextCenterFromOffset(anchor: Point2D, offset: Point2D, width: number, height: number): Point2D {
    return {x: anchor.x - offset.x + width / 2, y: anchor.y - offset.y + height / 2};
}

/** Calculate Konva offsets for placing the text center at a requested point. */
export function getTextOffsetForCenter(anchor: Point2D, center: Point2D, width: number, height: number): Point2D {
    return {x: anchor.x - center.x + width / 2, y: anchor.y - center.y + height / 2};
}
