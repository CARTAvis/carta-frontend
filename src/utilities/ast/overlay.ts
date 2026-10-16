import * as AST from "ast_wrapper";

import {SkyRefIs} from "enums";
import {type OverlaySettings} from "stores";
import {type FrameStore} from "stores/Frame";
import {setAstSystem} from "utilities/ast/ast";

function getOffsetAxisSetting(referenceSizeArcsec: number) {
    if (referenceSizeArcsec < 120) return {unit: "arcsec", format: "s.*"};
    if (referenceSizeArcsec < 7200) return {unit: "arcmin", format: "m.*"};
    return {unit: "deg", format: "d.*"};
}

function getLatitudeReferenceSize(frame: FrameStore, viewSizeArcsec: number): number {
    if (frame.skyRefIs !== SkyRefIs.Pole || !frame.wcsInfoOffset) return viewSizeArcsec;
    const skyWcs = AST.copy(frame.wcsInfoOffset);
    if (!skyWcs) return viewSizeArcsec;
    try {
        AST.setI(skyWcs, "Current", 2);
        const center = AST.transformPoint(skyWcs, frame.center.x, frame.center.y, true);
        return center && isFinite(center.y) ? Math.max(viewSizeArcsec, (Math.abs(center.y) * 3600 * 180) / Math.PI) : viewSizeArcsec;
    } finally {
        AST.deleteObject(skyWcs);
    }
}

/** Configure a copied WCS identically for canvas and SVG coordinate overlays. */
export function configureAstOverlayWcs(wcs: AST.FrameSet, frame: FrameStore, settings: OverlaySettings, effectiveAspectRatio: number): void {
    if (!frame.hasSquarePixels) {
        const currentIndex = parseInt(AST.getString(wcs, "Current"), 10);
        const mapping = AST.scaleMap2D(1, 1 / effectiveAspectRatio);
        const pixelFrame = AST.frame(2, "Domain=PIXEL");
        try {
            AST.addFrame(wcs, 1, mapping, pixelFrame);
        } finally {
            AST.deleteObject(pixelFrame);
            AST.deleteObject(mapping);
        }
        const baseIndex = parseInt(AST.getString(wcs, "Nframe"), 10);
        AST.setI(wcs, "Base", baseIndex);
        AST.setI(wcs, "Current", settings.isImgCoordinates ? baseIndex : currentIndex);
    }

    if (!(frame.isPVImage && frame.spectralAxis?.valid) && !(frame.isSwappedZ && frame.spectralAxis?.valid)) {
        const {formatStringX, formatStringY} = settings.numbers;
        if (formatStringX !== undefined && formatStringY !== undefined && settings.global.explicitSystem !== undefined && settings.isWcsCoordinates && frame.isValidWcs) {
            const labels = `${frame.dirX > 2 || frame.dirXLabel === "" ? "" : `Label(${frame.dirX})=${frame.dirXLabel},`} ${frame.dirY > 2 || frame.dirYLabel === "" ? "" : `Label(${frame.dirY})=${frame.dirYLabel},`}`;
            AST.set(wcs, `Format(${frame.dirX})=${formatStringX}, Format(${frame.dirY})=${formatStringY},${labels}`);
            setAstSystem(wcs, settings.global.explicitSystem, settings.global);
        }
    }

    if (frame.isOffsetCoord && settings.isWcsCoordinates) {
        const fov = frame.getWcsSizeInArcsec(frame.fovSize);
        const viewSize = Math.min(fov.x, fov.y);
        const axis2 = getOffsetAxisSetting(getLatitudeReferenceSize(frame, viewSize));
        const axis1 = frame.skyRefIs === SkyRefIs.Pole ? {unit: "deg", format: "d.*"} : axis2;
        AST.set(wcs, `Format(1)=${axis1.format}, Format(2)=${axis2.format}, Unit(1)=${settings.labels.hasCustomText ? '""' : axis1.unit}, Unit(2)=${settings.labels.hasCustomText ? '""' : axis2.unit}`);
    }
    if (settings.labels.hasCustomText) AST.set(wcs, 'Unit(1)="", Unit(2)=""');
}
