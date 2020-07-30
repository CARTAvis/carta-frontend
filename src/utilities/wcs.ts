import {CARTA} from "carta-protobuf";
import * as AST from "ast_wrapper";
import {Point2D, SpectralType} from "models";
import {add2D, length2D, normalize2D, pointDistance, polygonPerimeter, rotate2D, scale2D, subtract2D, magDir2D} from "./math2d";

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

export function transformPoint(astTransform: number, point: Point2D, forward: boolean = true) {
    return AST.transformPoint(astTransform, point.x, point.y, forward);
}

export function getFormattedWCSString(astTransform: number, pixelCoords: Point2D) {
    if (astTransform) {
        const pointWCS = transformPoint(astTransform, pixelCoords);
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

    const results = AST.transformPointArrays(astTransform, xCoords, yCoords, 0) as { x: Float64Array, y: Float64Array };
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
    const xCoords = new Float64Array(N);
    const yCoords = new Float64Array(N);
    for (let i = 0; i < N; i++) {
        xCoords[i] = approxPointsOriginalSpace[i].x;
        yCoords[i] = approxPointsOriginalSpace[i].y;
    }

    const results = AST.transformPointArrays(astTransform, xCoords, yCoords, 0) as { x: Float64Array, y: Float64Array };
    const approximatePoints = new Array<Point2D>(N);
    for (let i = 0; i < N; i++) {
        approximatePoints[i] = {x: results.x[i], y: results.y[i]};
    }
    return approximatePoints;
}