import {CARTA} from "carta-protobuf";
import {comparer, reaction} from "mobx";

import {MOMENT_TEXT, type WorkspaceMomentRequest, type WorkspacePvRequest} from "models";
import {BackendService} from "services";
import {type FrameStore} from "stores/Frame";

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

function isNumber(value: unknown): value is number {
    return typeof value === "number" && isFinite(value);
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
 * @param isOpen - returns whether the image is still open.
 */
export function waitForRegionData<T extends string>(frame: FrameStore, regionId: number, isOpen: () => boolean): RegionDataWait<T> {
    const backendService = BackendService.Instance;
    const fileId = frame.frameInfo.fileId;
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
            if (outcome !== "closed") {
                backendService.setStatsRequirements({fileId, regionId, statsConfigs: []});
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
        backendService.setStatsRequirements({fileId, regionId, statsConfigs: [{coordinate: "z", statsTypes: [CARTA.StatsType.NumPixels]}]});
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
