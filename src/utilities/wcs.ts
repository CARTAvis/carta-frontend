import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {Point2D, WCSPoint2D, SpectralType} from "models";
import {NumberFormatType} from "stores";
import {add2D, subtract2D} from "./math2d";

export function isWCSStringFormatValid(wcsString: string, format: NumberFormatType): boolean {
    if (!wcsString || !format) {
        return false;
    }
    const hmsRegExp = /^\-?\d{0,2}\:\d{0,2}\:(\d{1,2}(\.\d+)?)?$/;
    const dmsRegExp = /^\-?\d*\:\d{0,2}\:(\d{1,2}(\.\d+)?)?$/;
    const decimalRegExp = /^\-?\d+(\.\d+)?$/;
    if (format === NumberFormatType.HMS) {
        return hmsRegExp.test(wcsString);
    } else if (format === NumberFormatType.DMS) {
        return dmsRegExp.test(wcsString);
    }
    return decimalRegExp.test(wcsString);
}

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

export function getTransformedCoordinates(astTransform: number, point: Point2D, forward: boolean = true) {
    return AST.transformPoint(astTransform, point.x, point.y, forward);
}

// TODO: possibly move to region class since they are the only callers
export function getFormattedWCSPoint(astTransform: number, pixelCoords: Point2D, addPixelOffset: boolean = true): WCSPoint2D {
    if (addPixelOffset) {
        pixelCoords = add2D(pixelCoords, {x: 1, y: 1});
    }
    if (astTransform) {
        const pointWCS = getTransformedCoordinates(astTransform, pixelCoords);
        const normVals = AST.normalizeCoordinates(astTransform, pointWCS.x, pointWCS.y);
        const wcsCoords = AST.getFormattedCoordinates(astTransform, normVals.x, normVals.y);
        if (wcsCoords) {
            return wcsCoords;
        }
    }
    return null;
}

export function getPixelValueFromWCS(astTransform: number, formattedWCSPoint: WCSPoint2D, addPixelOffset: boolean = true): Point2D {
    if (astTransform) {
        const pointWCS = AST.getWCSValueFromFormattedString(astTransform, formattedWCSPoint);
        let pointImage = getTransformedCoordinates(astTransform, pointWCS, false);
        if (pointImage) {
            return addPixelOffset ? subtract2D(pointImage, {x: 1, y: 1}) : pointImage;
        }
    }
    return null;
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

export function getTransformedChannelList(srcTransform: number, destTransform: number, matchingType: SpectralType, firstChannel: number, lastChannel: number) {
    if (matchingType === SpectralType.CHANNEL || firstChannel > lastChannel) {
        return [];
    }

    // Set spectral system for both transforms
    AST.set(srcTransform, `System=${matchingType}, StdOfRest=Helio`);
    AST.set(destTransform, `System=${matchingType}, StdOfRest=Helio`);

    const N = lastChannel - firstChannel + 1;
    const destChannels = new Array<number>(N);
    for (let i = 0; i < N; i++) {
        // Get spectral value from forward transform. Adjust for 1-based index
        const sourceSpectralValue = AST.transform3DPoint(srcTransform, 1, 1, firstChannel + i + 1, true);
        if (!sourceSpectralValue || !isFinite(sourceSpectralValue.z) || isAstBad(sourceSpectralValue.z)) {
            destChannels[i] = NaN;
            continue;
        }

        // Get a sensible pixel coordinate for the reverse transform by forward transforming first pixel in image
        const dummySpectralValue = AST.transform3DPoint(destTransform, 1, 1, 1, true);
        // Get pixel value from destination transform (reverse)
        const destPixelValue = AST.transform3DPoint(destTransform, dummySpectralValue.x, dummySpectralValue.y, sourceSpectralValue.z, false);
        if (!destPixelValue || !isFinite(destPixelValue.z) || isAstBad(sourceSpectralValue.z)) {
            destChannels[i] = NaN;
            continue;
        }

        // Revert back to 0-based index
        destChannels[i] = destPixelValue.z - 1;
    }
    return destChannels;
}

export function isAstBad(value: number) {
    return !isFinite(value) || value === -Number.MAX_VALUE;
}

export function isAstBadPoint(point: Point2D) {
    return !point || isAstBad(point.x) || isAstBad(point.y);
}