import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {Point2D, SpectralType} from "models";
import {add2D} from "./math2d";

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

export function getTransformedCoordinates(astTransform: number, point: Point2D, forward: boolean = true, offset: boolean = false) {
    // When going from pixel coordinates to pixel coordinates, we need to add one first, to go to one-indexed FITS pixel coordinates
    // Then need to subtract one after the transformation to return to zero-indexed CARTA pixel coordinates
    const result = AST.transformPoint(astTransform, point.x + (offset ? 1 : 0), point.y + (offset ? 1 : 0), forward);
    if (result) {
        return {x: result.x - (offset ? 1 : 0), y: result.y - (offset ? 1 : 0)};
    }
    return result;
}

export function getFormattedWCSString(astTransform: number, pixelCoords: Point2D, addPixelOffset: boolean = true) {
    if (addPixelOffset) {
        pixelCoords = add2D(pixelCoords, {x: 1, y: 1});
    }
    if (astTransform) {
        const pointWCS = getTransformedCoordinates(astTransform, pixelCoords);
        const normVals = AST.normalizeCoordinates(astTransform, pointWCS.x, pointWCS.y);
        const wcsCoords = AST.getFormattedCoordinates(astTransform, normVals.x, normVals.y);
        if (wcsCoords) {
            return `WCS: (${wcsCoords.x}, ${wcsCoords.y})`;
        }
    }
    return "";
}

export function getTransformedChannel(srcTransform: number, destTransform: number, matchingType: SpectralType, srcChannel: number) {
    if (matchingType === SpectralType.CHANNEL) {
        return srcChannel;
    }

    // Set spectral system for both transforms
    AST.set(srcTransform, `System=${matchingType}, StdOfRest=Helio`);
    AST.set(destTransform, `System=${matchingType}, StdOfRest=Helio`);
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
    return destPixelValue.z - 1;
}

export function isAstBad(value: number) {
    return !isFinite(value) || value === -Number.MAX_VALUE;
}

export function isAstBadPoint(point: Point2D) {
    return !point || isAstBad(point.x) || isAstBad(point.y);
}