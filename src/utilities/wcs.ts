import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {CHANNEL_TYPES, Point2D, Transform2D} from "models";
import {add2D, length2D, scaleAboutPoint2D, scaleAndRotateAboutPoint2D, subtract2D} from "./math2d";

export function getHeaderNumericValue(headerEntry: CARTA.IHeaderEntry): number {
    if (!headerEntry) {
        return NaN;
    }

    if (headerEntry.entryType === CARTA.EntryType.FLOAT || headerEntry.entryType === CARTA.EntryType.INT) {
        return headerEntry.numericValue;
    } else {
        return parseFloat(headerEntry.value);
    }
}

// Tests a list of headers for valid channel information in either 3rd or 4th axis
export function findChannelType(entries: CARTA.IHeaderEntry[]) {
    if (!entries || !entries.length) {
        return undefined;
    }

    const typeHeader3 = entries.find(entry => entry.name.includes("CTYPE3"));
    const typeHeader4 = entries.find(entry => entry.name.includes("CTYPE4"));
    if (!typeHeader3 && !typeHeader4) {
        return undefined;
    }

    // Test each header entry to see if it has a valid channel type
    if (typeHeader3) {
        const headerVal = typeHeader3.value.trim().toUpperCase();
        const channelType = CHANNEL_TYPES.find(type => headerVal.indexOf(type.code) !== -1);
        if (channelType) {
            return {dimension: 3, type: {name: channelType.name, code: channelType.code, unit: channelType.unit}};
        }
    }

    if (typeHeader4) {
        const headerVal = typeHeader4.value.trim().toUpperCase();
        const channelType = CHANNEL_TYPES.find(type => headerVal.indexOf(type.code) !== -1);
        if (channelType) {
            return {dimension: 4, type: {name: channelType.name, code: channelType.code, unit: channelType.unit}};
        }
    }

    return undefined;
}

export function findRefPixel(entries: CARTA.IHeaderEntry[]) {
    if (!entries || !entries.length) {
        return undefined;
    }

    const pixVal1 = entries.find(entry => entry.name.includes("CRPIX1"));
    const pixVal2 = entries.find(entry => entry.name.includes("CRPIX2"));
    if (!pixVal1 && !pixVal2) {
        return undefined;
    }

    return {x: getHeaderNumericValue(pixVal1), y: getHeaderNumericValue(pixVal2)};
}

export function getTransformedCoordinates(astTransform: number, point: Point2D, forward: boolean = true) {
    const transformed: Point2D = AST.transformPoint(astTransform, point.x, point.y, forward);
    return transformed;
}

export function getTransform(astTransform: number, refPixel: Point2D): Transform2D {
    const transformedRef = getTransformedCoordinates(astTransform, refPixel, true);
    const delta = 1.0;
    const refTop = add2D(refPixel, {x: 0, y: delta / 2.0});
    const refBottom = add2D(refPixel, {x: 0, y: -delta / 2.0});
    const northVector = subtract2D(refTop, refBottom);
    const transformedRefTop = getTransformedCoordinates(astTransform, refTop, true);
    const transformedRefBottom = getTransformedCoordinates(astTransform, refBottom, true);
    const transformedNorthVector = subtract2D(transformedRefTop, transformedRefBottom);
    const scaling = length2D(transformedNorthVector) / length2D(northVector);
    const theta = Math.atan2(transformedNorthVector.y, transformedNorthVector.x) - Math.atan2(northVector.y, northVector.x);
    return {
        translation: subtract2D(transformedRef, refPixel),
        origin: {x: refPixel.x, y: refPixel.y},
        scale: scaling,
        rotation: theta
    };
}

export function getApproximateCoordinates(transform: Transform2D, point: Point2D, forward: boolean = true) {
    if (forward) {
        // Move point from the original frame to the reference frame, using the supplied transform
        const scaledPoint = scaleAndRotateAboutPoint2D(point, transform.origin, transform.scale, transform.rotation);
        return add2D(scaledPoint, transform.translation);
    } else {
        // Move point from the reference frame to the original frame, using the supplied transform
        const shiftedPoint = subtract2D(point, transform.translation);
        return scaleAndRotateAboutPoint2D(shiftedPoint, transform.origin, 1.0 / transform.scale, -transform.rotation);
    }
}