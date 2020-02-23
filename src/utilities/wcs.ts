import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {CHANNEL_TYPES, Point2D, SpectralType} from "models";

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

export function getTransformedCoordinates(astTransform: number, point: Point2D, forward: boolean = true) {
    const transformed: Point2D = AST.transformPoint(astTransform, point.x, point.y, forward);
    return transformed;
}

export function getTransformedChannel(srcTransform: number, destTransform: number, matchingType: SpectralType, srcChannel: number) {
    if (matchingType === SpectralType.CHANNEL) {
        return srcChannel;
    }

    // Set spectral system for both transforms
    AST.set(srcTransform, `System=${matchingType}`);
    AST.set(destTransform, `System=${matchingType}`);
    // Get spectral value from forward transform. Adjust for 1-based index
    const sourceSpectralValue = AST.transform3DPoint(srcTransform, 1, 1, srcChannel + 1, true);
    if (!sourceSpectralValue || !isFinite(sourceSpectralValue.z)) {
        return NaN;
    }

    // Get a sensible pixel coordinate for the reverse transform by forward transforming first pixel in image
    const dummySpectralValue = AST.transform3DPoint(destTransform, 1, 1, 1, true);
    // Get pixel value from destination transform (reverse)
    const destPixelValue = AST.transform3DPoint(destTransform, dummySpectralValue.x, dummySpectralValue.y, sourceSpectralValue.z, false);
    if (!destPixelValue || !isFinite(destPixelValue.z)) {
        return NaN;
    }

    // Revert back to 0-based index
    return destPixelValue.z  - 1;
}