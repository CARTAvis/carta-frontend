import {CARTA} from "carta-protobuf";
import type Konva from "konva";

import {type Point2D} from "models";
import {type TextAnnotationStore} from "stores/Frame";

const TEXT_ALIGNMENT = {
    [CARTA.TextAnnotationPosition.UPPER_LEFT]: {align: "left", verticalAlign: "top"},
    [CARTA.TextAnnotationPosition.UPPER_RIGHT]: {align: "right", verticalAlign: "top"},
    [CARTA.TextAnnotationPosition.LOWER_LEFT]: {align: "left", verticalAlign: "bottom"},
    [CARTA.TextAnnotationPosition.LOWER_RIGHT]: {align: "right", verticalAlign: "bottom"},
    [CARTA.TextAnnotationPosition.TOP]: {align: "center", verticalAlign: "top"},
    [CARTA.TextAnnotationPosition.BOTTOM]: {align: "center", verticalAlign: "bottom"},
    [CARTA.TextAnnotationPosition.LEFT]: {align: "left", verticalAlign: "middle"},
    [CARTA.TextAnnotationPosition.RIGHT]: {align: "right", verticalAlign: "middle"},
    [CARTA.TextAnnotationPosition.CENTER]: {align: "center", verticalAlign: "middle"}
};

/** Text box dimensions are CSS pixels, independent of image zoom. */
export function getTextAnnotationProps(region: TextAnnotationStore, size: Point2D): Konva.TextConfig {
    return {
        ...TEXT_ALIGNMENT[region.position ?? CARTA.TextAnnotationPosition.CENTER],
        width: size.x || undefined,
        height: size.y || undefined,
        text: region.text,
        fontSize: region.fontSize ?? 20,
        fontFamily: region.font ?? "Helvetica",
        fontStyle: region.fontStyle ?? "normal",
        fill: region.color
    };
}
