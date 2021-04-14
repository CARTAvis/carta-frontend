import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {Point2D, WCSPoint2D, SpectralType, SPECTRAL_DEFAULT_UNIT} from "models";
import {NumberFormatType} from "stores";
import {add2D, polygonPerimeter, rotate2D, scale2D, subtract2D, magDir2D} from "./math2d";
import {trimFitsComment} from "./parsing";

export function isWCSStringFormatValid(wcsString: string, format: NumberFormatType): boolean {
    if (!wcsString || !format) {
        return false;
    }
    const hmsRegExp = /^-?\d{0,2}:\d{0,2}:(\d{1,2}(\.\d+)?)?$/;
    const dmsRegExp = /^-?\d*:\d{0,2}:(\d{1,2}(\.\d+)?)?$/;
    const decimalRegExp = /^-?\d+(\.\d+)?$/;
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
        return parseFloat(trimFitsComment(headerEntry.value));
    }
}

export function transformPoint(astTransform: number, point: Point2D, forward: boolean = true) {
    return AST.transformPoint(astTransform, point.x, point.y, forward);
}

// TODO: possibly move to region class since they are the only callers
export function getFormattedWCSPoint(astTransform: number, pixelCoords: Point2D) {
    if (astTransform) {
        const pointWCS = transformPoint(astTransform, pixelCoords);
        const normVals = AST.normalizeCoordinates(astTransform, pointWCS.x, pointWCS.y);
        const wcsCoords = AST.getFormattedCoordinates(astTransform, normVals.x, normVals.y);
        if (wcsCoords) {
            return wcsCoords;
        }
    }
    return null;
}

export function getPixelValueFromWCS(astTransform: number, formattedWCSPoint: WCSPoint2D): Point2D {
    if (astTransform) {
        const pointWCS = AST.getWCSValueFromFormattedString(astTransform, formattedWCSPoint);
        return transformPoint(astTransform, pointWCS, false);
    }
    return null;
}

export function getTransformedChannel(srcTransform: number, destTransform: number, matchingType: SpectralType, srcChannel: number) {
    if (matchingType === SpectralType.CHANNEL) {
        return srcChannel;
    }

    const defaultUnit = SPECTRAL_DEFAULT_UNIT.get(matchingType);
    if (!defaultUnit) {
        return NaN;
    }

    // Set common spectral
    AST.set(srcTransform, `System=${matchingType}, StdOfRest=Helio, Unit=${defaultUnit}`);
    AST.set(destTransform, `System=${matchingType}, StdOfRest=Helio, Unit=${defaultUnit}`);
    const sourceSpectralValue = AST.transform3DPoint(srcTransform, 0, 0, srcChannel, true);
    if (!sourceSpectralValue || !isFinite(sourceSpectralValue.z)) {
        return NaN;
    }

    // Get a sensible pixel coordinate for the reverse transform by forward transforming first pixel in image
    const dummySpectralValue = AST.transform3DPoint(destTransform, 0, 0, 0, true);
    // Get pixel value from destination transform (reverse)
    const destPixelValue = AST.transform3DPoint(destTransform, dummySpectralValue.x, dummySpectralValue.y, sourceSpectralValue.z, false);
    if (!destPixelValue || !isFinite(destPixelValue.z)) {
        return NaN;
    }

    return destPixelValue.z;
}

export function getTransformedChannelList(srcTransform: number, destTransform: number, matchingType: SpectralType, firstChannel: number, lastChannel: number) {
    if (matchingType === SpectralType.CHANNEL || firstChannel > lastChannel) {
        return [];
    }

    const defaultUnit = SPECTRAL_DEFAULT_UNIT.get(matchingType);
    if (!defaultUnit) {
        return [];
    }

    // Set common spectral
    AST.set(srcTransform, `System=${matchingType}, StdOfRest=Helio, Unit=${defaultUnit}`);
    AST.set(destTransform, `System=${matchingType}, StdOfRest=Helio, Unit=${defaultUnit}`);

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

export function getApproximateEllipsePoints(astTransform: number, centerReferenceImage: Point2D, radA: number, radB: number, rotation: number, targetVertexCount: number): Point2D[] {
    const dTheta = 2.0 * Math.PI / targetVertexCount;
    const xCoords = new Float64Array(targetVertexCount);
    const yCoords = new Float64Array(targetVertexCount);

    for (let i = 0; i < targetVertexCount; i++) {
        const theta = i * dTheta;
        const p = add2D(centerReferenceImage, rotate2D({x: radA * Math.cos(theta), y: radB * Math.sin(theta)}, rotation * Math.PI / 180.0));
        xCoords[i] = p.x;
        yCoords[i] = p.y;
    }

    const results = AST.transformPointArrays(astTransform, xCoords, yCoords, false);
    const approximatePoints = new Array<Point2D>(targetVertexCount);
    for (let i = 0; i < targetVertexCount; i++) {
        approximatePoints[i] = {x: results.x[i], y: results.y[i]};
    }
    return approximatePoints;
}

export function getApproximatePolygonPoints(astTransform: number, controlPoints: Point2D[], targetVertexCount: number, closed: boolean = true): Point2D[] {
    const totalLength = polygonPerimeter(controlPoints, closed);
    const idealSubdivisionLength = totalLength / targetVertexCount;

    const M = controlPoints.length + (closed ? 1 : 0);
    const approxPointsOriginalSpace = new Array<Point2D>();
    for (let i = 1; i < M; i++) {
        const p1 = controlPoints[i % controlPoints.length];
        const p0 = controlPoints[i - 1];
        const {mag, dir} = magDir2D(subtract2D(p1, p0));
        const subdivisionCount = Math.round(mag / idealSubdivisionLength);
        const segmentSubdivisionLength = mag / subdivisionCount;
        approxPointsOriginalSpace.push(p0);
        for (let j = 1; j < subdivisionCount; j++) {
            const p = add2D(p0, scale2D(dir, j * segmentSubdivisionLength));
            approxPointsOriginalSpace.push(p);
        }
    }

    const N = approxPointsOriginalSpace.length;

    if (N) {
        const xCoords = new Float64Array(N);
        const yCoords = new Float64Array(N);
        for (let i = 0; i < N; i++) {
            xCoords[i] = approxPointsOriginalSpace[i].x;
            yCoords[i] = approxPointsOriginalSpace[i].y;
        }

        const results = AST.transformPointArrays(astTransform, xCoords, yCoords, false);
        const approximatePoints = new Array<Point2D>(N);
        for (let i = 0; i < N; i++) {
            approximatePoints[i] = {x: results.x[i], y: results.y[i]};
        }
        return approximatePoints;
    } else {
        return [];
    }
}