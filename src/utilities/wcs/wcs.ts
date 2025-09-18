import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";

import {Point2D, SPECTRAL_DEFAULT_UNIT, SpectralType, WCSPoint2D} from "models";
import {NumberFormatType, OverlaySettings} from "stores";
import {FrameStore} from "stores/Frame";
import {add2D, magDir2D, polygonPerimeter, rotate2D, scale2D, subtract2D, trimFitsComment} from "utilities";

export function isWCSStringFormatValid(wcsString: string, format: NumberFormatType | undefined): boolean {
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

export function getHeaderNumericValue(headerEntry: CARTA.IHeaderEntry | undefined): number {
    if (!headerEntry) {
        return NaN;
    }

    if (headerEntry.entryType === CARTA.EntryType.FLOAT || headerEntry.entryType === CARTA.EntryType.INT) {
        return headerEntry.numericValue ?? NaN;
    } else {
        return parseFloat(trimFitsComment(headerEntry.value));
    }
}

export function transformPoint(astTransform: AST.FrameSet | AST.Mapping, point: Point2D, forward: boolean = true) {
    return AST.transformPoint(astTransform, point.x, point.y, forward);
}

export function getReferencePixel(frame: FrameStore): Point2D {
    const x = getHeaderNumericValue(frame?.frameInfo?.fileInfoExtended?.headerEntries?.find(entry => entry.name === "CRPIX1"));
    const y = getHeaderNumericValue(frame.frameInfo?.fileInfoExtended?.headerEntries?.find(entry => entry.name === "CRPIX2"));
    return {x, y};
}

/**
 * Calculates the pixel sizes (in arcseconds per pixel) along the rendered X and Y axes by
 * measuring WCS geodesic distances around the reference pixel (CRPIX).
 *
 * @param frame - The `FrameStore` providing WCS transform (`frame.wcsInfo`) and FITS headers
 * @param rounding - Optional number of decimal places to round the pixel size in arcseconds.
 *                   If omitted, raw (unrounded) arcsecond values are returned.
 * @returns An object with `{ x, y }` pixel sizes in arcseconds; `NaN` values if they cannot be determined
 */
export function getPixelSizes(frame: FrameStore, rounding?: number): {x: number; y: number} {
    const crpixX = frame?.frameInfo?.fileInfoExtended?.headerEntries.find(entry => entry.name === `CRPIX${frame.dirXNumber}`);
    const crpixY = frame?.frameInfo?.fileInfoExtended?.headerEntries.find(entry => entry.name === `CRPIX${frame.dirYNumber}`);

    if (crpixX && crpixY) {
        const crpixXVal = getHeaderNumericValue(crpixX);
        const crpixYVal = getHeaderNumericValue(crpixY);
        const xPixelSizeArcsec = AST.geodesicDistance(frame.wcsInfo, crpixXVal - 0.5, crpixYVal, crpixXVal + 0.5, crpixYVal);
        const yPixelSizeArcsec = AST.geodesicDistance(frame.wcsInfo, crpixXVal, crpixYVal - 0.5, crpixXVal, crpixYVal + 0.5);

        if (!isFinite(xPixelSizeArcsec) || !isFinite(yPixelSizeArcsec)) {
            return {x: NaN, y: NaN};
        }

        if (isFinite(rounding as number)) {
            const factor = Math.pow(10, rounding as number);
            return {
                x: Math.round(xPixelSizeArcsec * factor) / factor,
                y: Math.round(yPixelSizeArcsec * factor) / factor
            };
        }
        return {x: xPixelSizeArcsec, y: yPixelSizeArcsec};
    }
    return {x: NaN, y: NaN};
}

export function getFormattedWCSPoint(astTransform: AST.FrameSet, pixelCoords: Point2D) {
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

export function getUnformattedWCSPoint(astTransform: AST.FrameSet, pixelCoords: Point2D) {
    if (astTransform) {
        if (OverlaySettings.Instance.isImgCoordinates) {
            // need second frame(WCS frame) in the frame to get WCS point
            AST.setI(astTransform, "Current", 2);
        }

        const equinox = AST.getString(astTransform, "System") === "FK4" ? "1950.0" : "2000.0";
        AST.set(astTransform, `Equinox=${equinox}`);
        const pointWCS = transformPoint(astTransform, pixelCoords);
        const normVals = AST.normalizeCoordinates(astTransform, pointWCS.x, pointWCS.y);

        if (OverlaySettings.Instance.isImgCoordinates) {
            AST.setI(astTransform, "Current", 1);
        }

        if (normVals) {
            return normVals;
        }
    }
    return null;
}

export function getPixelValueFromWCS(astTransform: AST.FrameSet, formattedWCSPoint: WCSPoint2D): Point2D | null {
    if (astTransform) {
        const pointWCS = AST.getWCSValueFromFormattedString(astTransform, formattedWCSPoint);
        return transformPoint(astTransform, pointWCS, false);
    }
    return null;
}

export function getTransformedChannel(srcTransform: AST.FrameSet, destTransform: AST.FrameSet, matchingType: SpectralType, srcChannel: number) {
    if (matchingType === SpectralType.CHANNEL) {
        return srcChannel;
    }

    const defaultUnit = SPECTRAL_DEFAULT_UNIT.get(matchingType);
    if (!defaultUnit) {
        return NaN;
    }

    // Set common spectral
    const copySrc = AST.copy(srcTransform);
    const copyDest = AST.copy(destTransform);
    AST.set(copySrc, `System=${matchingType}, StdOfRest=Helio, Unit=${defaultUnit}`);
    AST.set(copyDest, `System=${matchingType}, StdOfRest=Helio, Unit=${defaultUnit}`);

    // Get spectral value from forward transform
    const sourceSpectralValue = AST.transform3DPoint(copySrc, 0, 0, srcChannel, true);
    if (!sourceSpectralValue || !isFinite(sourceSpectralValue.z)) {
        return NaN;
    }

    // Get a sensible pixel coordinate for the reverse transform by forward transforming first pixel in image
    const dummySpectralValue = AST.transform3DPoint(copyDest, 0, 0, 0, true);
    // Get pixel value from destination transform (reverse)
    const destPixelValue = AST.transform3DPoint(copyDest, dummySpectralValue.x, dummySpectralValue.y, sourceSpectralValue.z, false);

    AST.deleteObject(copySrc);
    AST.deleteObject(copyDest);

    if (!destPixelValue || !isFinite(destPixelValue.z)) {
        return NaN;
    }

    return destPixelValue.z;
}

export function getTransformedChannelList(srcTransform: AST.FrameSet, destTransform: AST.FrameSet, matchingType: SpectralType, firstChannel: number, lastChannel: number) {
    if (matchingType === SpectralType.CHANNEL || firstChannel > lastChannel) {
        return [];
    }

    const defaultUnit = SPECTRAL_DEFAULT_UNIT.get(matchingType);
    if (!defaultUnit) {
        return [];
    }

    // Set common spectral
    const copySrc = AST.copy(srcTransform);
    const copyDest = AST.copy(destTransform);
    AST.set(copySrc, `System=${matchingType}, StdOfRest=Helio, Unit=${defaultUnit}`);
    AST.set(copyDest, `System=${matchingType}, StdOfRest=Helio, Unit=${defaultUnit}`);

    // Get a sensible pixel coordinate for the reverse transform by forward transforming first pixel in image
    const dummySpectralValue = AST.transform3DPoint(copyDest, 1, 1, 1, true);

    const N = lastChannel - firstChannel + 1;
    const destChannels = new Array<number>(N);
    for (let i = 0; i < N; i++) {
        // Get spectral value from forward transform
        const sourceSpectralValue = AST.transform3DPoint(copySrc, 1, 1, firstChannel + i, true);
        if (!sourceSpectralValue || !isFinite(sourceSpectralValue.z) || isAstBad(sourceSpectralValue.z)) {
            destChannels[i] = NaN;
            continue;
        }

        // Get pixel value from destination transform (reverse)
        const destPixelValue = AST.transform3DPoint(copyDest, dummySpectralValue.x, dummySpectralValue.y, sourceSpectralValue.z, false);
        if (!destPixelValue || !isFinite(destPixelValue.z) || isAstBad(sourceSpectralValue.z)) {
            destChannels[i] = NaN;
            continue;
        }

        destChannels[i] = destPixelValue.z;
    }

    AST.deleteObject(copySrc);
    AST.deleteObject(copyDest);
    return destChannels;
}

export function isAstBad(value: number) {
    return !isFinite(value) || value === -Number.MAX_VALUE;
}

export function isAstBadPoint(point: Point2D) {
    return !point || isAstBad(point.x) || isAstBad(point.y);
}

export function getApproximateEllipsePoints(astTransform: AST.FrameSet, centerReferenceImage: Point2D, radA: number, radB: number, rotation: number, targetVertexCount: number): Point2D[] {
    const dTheta = (2.0 * Math.PI) / targetVertexCount;
    const xCoords = new Float64Array(targetVertexCount);
    const yCoords = new Float64Array(targetVertexCount);

    for (let i = 0; i < targetVertexCount; i++) {
        const theta = i * dTheta;
        const p = add2D(centerReferenceImage, rotate2D({x: radA * Math.cos(theta), y: radB * Math.sin(theta)}, (rotation * Math.PI) / 180.0));
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

export function getApproximatePolygonPoints(astTransform: AST.FrameSet, controlPoints: Point2D[], targetVertexCount: number, closed: boolean = true): Point2D[] {
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
        if (i === M - 1 && !closed) {
            approxPointsOriginalSpace.push(p1);
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
