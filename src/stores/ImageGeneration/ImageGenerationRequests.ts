import {CARTA} from "carta-protobuf";
import {comparer, reaction} from "mobx";

import {MOMENT_TEXT, NONLINEAR_SPECTRAL_AXIS_MESSAGE, NONLINEAR_SPECTRAL_AXIS_UNSUPPORTED_MOMENTS, type Point2D, type WorkspaceMomentRequest, type WorkspacePvRequest} from "models";
import {BackendService} from "services";
import {type FrameStore, type RegionStore} from "stores/Frame";

/**
 * The settings of a moment request, as a workspace saves them. The image and the region are not
 * part of these settings.
 */
export type MomentSettings = Omit<WorkspaceMomentRequest, "type" | "sourceImageId" | "regionId">;

/**
 * The settings of a PV request, as a workspace saves them. The image and the region are not part of
 * these settings.
 */
export type PvSettings = Omit<WorkspacePvRequest, "type" | "sourceImageId" | "regionId">;

/** How many pixels wide a PV cut is averaged over, when no width is given. */
export const PV_DEFAULT_WIDTH = 3;

function isNumber(value: unknown): value is number {
    return typeof value === "number" && isFinite(value);
}

/**
 * Returns whether a line region crosses the image. Only the first two control points are used, so
 * a polyline is checked by its first segment.
 *
 * The line crosses the image when the four image corners are not all on one side of the line, and
 * when both ends are not beyond the same edge of the image.
 */
export function isLineOnImage(region: Pick<RegionStore, "controlPoints"> | null | undefined, frame: Pick<FrameStore, "frameInfo"> | null | undefined): boolean {
    if (region && frame?.frameInfo?.fileInfoExtended) {
        const startPoint = region.controlPoints[0];
        const endPoint = region.controlPoints[1];
        const width = frame.frameInfo.fileInfoExtended.width;
        const height = frame.frameInfo.fileInfoExtended.height;
        const imageCorners: Point2D[] = [
            {x: -0.5, y: -0.5},
            {x: width - 0.5, y: -0.5},
            {x: -0.5, y: height - 0.5},
            {x: width - 0.5, y: height - 0.5}
        ];

        // Count on which side of the line each image corner is. See https://stackoverflow.com/a/1560510.
        let sideValue = 0;
        for (const corner of imageCorners) {
            sideValue = sideValue + Math.sign((endPoint.x - startPoint.x) * (corner.y - startPoint.y) - (endPoint.y - startPoint.y) * (corner.x - startPoint.x));
        }

        if (sideValue <= 2 && sideValue >= -2) {
            // Both ends can still be beyond the same edge of the image.
            if ((startPoint.x < -0.5 && endPoint.x < -0.5) || (startPoint.y < -0.5 && endPoint.y < -0.5) || (startPoint.x > width - 0.5 && endPoint.x > width - 0.5) || (startPoint.y > height - 0.5 && endPoint.y > height - 0.5)) {
                return false;
            }

            return true;
        }
    }
    return false;
}

/** Returns whether the first two control points of a line region round to the same pixel. */
export function isLineInOnePixel(region: Pick<RegionStore, "controlPoints"> | null | undefined): boolean {
    if (region) {
        const startPoint = region.controlPoints[0];
        const endPoint = region.controlPoints[1];
        if (Math.round(startPoint.x) === Math.round(endPoint.x) && Math.round(startPoint.y) === Math.round(endPoint.y)) {
            return true;
        }
    }
    return false;
}

/**
 * Returns why moment images of `source` cannot be made, or nothing when they can. The GUI, the
 * scripting API and the workspace restore use the same rules.
 */
export function momentProblemOf(source: FrameStore, moments: CARTA.Moment[] | null | undefined): string | undefined {
    if (source.isSpectralAxisNonlinear && moments?.some(moment => NONLINEAR_SPECTRAL_AXIS_UNSUPPORTED_MOMENTS.includes(moment))) {
        return NONLINEAR_SPECTRAL_AXIS_MESSAGE;
    }
    if (source.numChannels <= 1) {
        return "The image has only one channel";
    }
    return undefined;
}

/**
 * Returns why a PV image of `source` along the region `regionId` cannot be made, or nothing when it
 * can. The GUI, the scripting API and the workspace restore use the same rules.
 *
 * @param channelRange - the first and last channel, as channel indices. Leave it out to use all
 *                       channels.
 */
export function pvProblemOf(source: FrameStore, regionId: number, channelRange?: {min: number; max: number}): string | undefined {
    if (source.isSpectralAxisNonlinear) {
        return NONLINEAR_SPECTRAL_AXIS_MESSAGE;
    }
    if (source.numChannels <= 1) {
        return "The image has only one channel";
    }
    const region = source.getRegion(regionId);
    if (!region) {
        return `The image has no region ${regionId}`;
    }
    if (region.regionType !== CARTA.RegionType.LINE && region.regionType !== CARTA.RegionType.POLYLINE) {
        return `Region ${regionId} is not a line or polyline`;
    }
    if (!isLineOnImage(region, source)) {
        return "The line does not cross the image";
    }
    if (isLineInOnePixel(region)) {
        return "The line starts and ends in the same pixel";
    }
    if (channelRange && channelRange.min >= channelRange.max) {
        return "The channel range has fewer than two channels";
    }
    return undefined;
}

/**
 * Returns the backend request that makes moment images of `source` over the region `regionId`.
 * Returns nothing when the settings are not valid, for example when they name an unknown moment.
 *
 * @param shouldKeep - whether the new images keep the moment images made before them.
 */
export function momentMessageOf(settings: MomentSettings, source: FrameStore, regionId: number, shouldKeep: boolean): CARTA.MomentRequest.$Properties | undefined {
    const {moments, channelRange, mask, pixelRange} = settings;
    if (
        !Array.isArray(moments) ||
        !moments.length ||
        !moments.every(moment => MOMENT_TEXT.has(moment)) ||
        !Number.isInteger(channelRange?.min) ||
        !Number.isInteger(channelRange?.max) ||
        !Object.values(CARTA.MomentMask).includes(mask) ||
        !isNumber(pixelRange?.min) ||
        !isNumber(pixelRange?.max)
    ) {
        return undefined;
    }
    return {
        fileId: source.frameInfo.fileId,
        moments,
        axis: CARTA.MomentAxis.SPECTRAL,
        regionId,
        spectralRange: {min: channelRange.min, max: channelRange.max},
        mask,
        pixelRange: new CARTA.FloatBounds({min: pixelRange.min, max: pixelRange.max}),
        keep: shouldKeep,
        restFreq: source.restFreqStore?.restFreqInHz
    };
}

/**
 * Returns the backend request that makes a PV image of `source` along the line or polyline region
 * `regionId`. Returns nothing when the settings are not valid.
 *
 * @param shouldKeep - whether the new image keeps the PV images made before it.
 */
export function pvMessageOf(settings: PvSettings, source: FrameStore, regionId: number, shouldKeep: boolean): CARTA.PvRequest.$Properties | undefined {
    const {width, channelRange} = settings;
    if (!Number.isInteger(width) || width < 1 || (channelRange !== undefined && (!Number.isInteger(channelRange?.min) || !Number.isInteger(channelRange?.max)))) {
        return undefined;
    }
    return {
        fileId: source.frameInfo.fileId,
        regionId,
        width,
        spectralRange: channelRange ? {min: channelRange.min, max: channelRange.max} : null,
        reverse: settings.reverse === true,
        keep: shouldKeep
    };
}

/** A wait for the backend to keep the data of a region. */
export interface RegionDataWait<T extends string> {
    /**
     * Resolves with "ready" when the backend keeps the data, with "closed" when the image is closed
     * first, or with the outcome that `stop` was called with.
     */
    ready: Promise<"ready" | "closed" | T>;
    /** Ends the wait with `outcome`. Does nothing when the wait has already ended. */
    stop: (outcome: T) => void;
}

/**
 * Makes the backend keep the data of a region of an image, and waits until it does.
 *
 * The backend makes moments over a region only when it already keeps the region data of the
 * image. The backend starts to keep this data when a widget first asks for statistics, a
 * histogram or a profile of the region. When no widget has asked yet, for example during a
 * workspace restore or in a script, the moment request fails. This function asks for one statistic
 * of the region, waits for the answer, and then cancels that request. Sending the request without
 * waiting is not enough. The backend handles requests out of order, so the moment request could
 * arrive first.
 *
 * The wait has no time limit. It ends when the backend answers, when the image is closed, or when
 * `stop` is called.
 *
 * When a statistics widget already asks for statistics of the region, the function sends the
 * request of the widget again, and waits for the answer. The backend answers the same request
 * again. A widget that has just asked may not have its answer yet, so the function does not skip
 * the wait. At the end of the wait, the function sends what the widgets ask for at that time, or
 * no statistics when no widget asks. It sends nothing when this is what it sent first.
 *
 * @param isOpen - returns whether the image is still open.
 * @param widgetStatsOf - returns the statistics that the widgets ask for of the region, as last sent
 *                        to the backend.
 */
export function waitForRegionData<T extends string>(frame: FrameStore, regionId: number, isOpen: () => boolean, widgetStatsOf: () => CARTA.SetStatsRequirements.$Properties | undefined): RegionDataWait<T> {
    const backendService = BackendService.Instance;
    const fileId = frame.frameInfo.fileId;
    const widgetConfigs = widgetStatsOf()?.statsConfigs;
    const sentConfigs = widgetConfigs?.length ? widgetConfigs : [{coordinate: "z", statsTypes: [CARTA.StatsType.NumPixels]}];
    let finish: (outcome: "ready" | "closed" | T) => void = () => {};
    const ready = new Promise<"ready" | "closed" | T>(resolve => {
        let isSettled = false;
        finish = outcome => {
            if (isSettled) {
                return;
            }
            isSettled = true;
            subscription.unsubscribe();
            disposeReaction();
            const configs = widgetStatsOf()?.statsConfigs ?? [];
            if (outcome !== "closed" && !comparer.structural(configs, sentConfigs)) {
                backendService.setStatsRequirements({fileId, regionId, statsConfigs: configs});
            }
            resolve(outcome);
        };
        const subscription = backendService.statsStream.subscribe(stats => {
            if (stats?.fileId === fileId && stats.regionId === regionId) {
                finish("ready");
            }
        });
        const disposeReaction = reaction(
            () => isOpen(),
            open => {
                if (!open) {
                    finish("closed");
                }
            },
            {equals: comparer.structural}
        );
        backendService.setStatsRequirements({fileId, regionId, statsConfigs: sentConfigs});
    });
    return {ready, stop: outcome => finish(outcome)};
}

/** Options of a request that makes moment images or a PV image. */
export interface ImageRequestOptions {
    /**
     * Called when the images are made. When it returns false, the images are closed on the backend
     * and not added to the session.
     */
    isStillWanted?: () => boolean;
    /**
     * Whether the request throws the error of the backend, and throws an `ImageRequestCancelledError`
     * when the request is cancelled. Otherwise the request returns no images. When this option is
     * left out, the request throws the error of the backend only during a workspace restore, and
     * never throws an `ImageRequestCancelledError`.
     */
    shouldThrow?: boolean;
}

/** The error of a request that makes images, when the request is cancelled. */
export class ImageRequestCancelledError extends Error {
    constructor() {
        super("The request was cancelled");
        this.name = "ImageRequestCancelledError";
    }
}
