import {CARTA} from "carta-protobuf";
import {action, comparer, computed, makeObservable, observable, reaction} from "mobx";

import {ConnectionStatus, RegionId, type SpectralSystem, SpectralType, type SpectralUnit} from "enums";
import {NONLINEAR_SPECTRAL_AXIS_MESSAGE, NONLINEAR_SPECTRAL_AXIS_UNSUPPORTED_MOMENTS} from "models";
import {type AppStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {ImageRequestCancelledError, momentMessageOf, pvMessageOf, waitForRegionData} from "stores/ImageGeneration/ImageGenerationRequests";

/** The kind of images that a job makes. */
export type ImageGenerationJobKind = "moment" | "pv";

/** The status of a job. Only a running job changes its status. */
export type ImageGenerationJobStatus = "running" | "done" | "failed" | "cancelled";

/** A channel range, given as spectral values. */
export interface SpectralRangeSettings {
    min: number;
    max: number;
    /** The spectral type of the values. The default is the type that the image shows. */
    type?: SpectralType;
    /**
     * The unit of the values. The default is the unit that the image shows, when `type` is the type
     * that the image shows. Otherwise the default is the first unit that the image supports for
     * `type`.
     */
    unit?: SpectralUnit;
    /** The spectral system of the values. The default is the system that the image shows. */
    system?: SpectralSystem;
}

/**
 * The channels that a job uses. Give `channels` or `spectralRange`, not both. Give neither to use
 * all channels.
 */
interface ChannelSettings {
    /** The first and last channel, as channel indices. */
    channels?: {min: number; max: number};
    spectralRange?: SpectralRangeSettings;
}

/** The settings of a job that makes moment images. */
export interface MomentJobSettings extends ChannelSettings {
    moments: CARTA.Moment[];
    /** The closed region that the moments are made over. The default is the whole image. */
    regionId?: number;
    /** How the pixel range masks the cube. The default is no mask. */
    mask?: CARTA.MomentMask;
    /** The pixel range of the mask. Give it when `mask` is set. The default is from 0 to 0. */
    pixelRange?: {min: number; max: number};
    /** Whether to keep the moment images made before. The default is true. */
    keep?: boolean;
}

/** The settings of a job that makes a PV image. */
export interface PvJobSettings extends ChannelSettings {
    /** The line or polyline region that the cut follows. */
    regionId: number;
    /** How many pixels wide the cut is averaged over. The default is 1. */
    width?: number;
    /** Whether the position axis is drawn vertically. The default is false. */
    reverse?: boolean;
    /** Whether to keep the PV images made before. The default is true. */
    keep?: boolean;
}

/** What a script reads about a job. */
export interface ImageGenerationJobState {
    id: number;
    kind: ImageGenerationJobKind;
    /** The file ID of the image that the images are made from. */
    fileId: number;
    status: ImageGenerationJobStatus;
    /**
     * The progress of the job, from 0 to 1. It is 0 while the job waits for the region data, and
     * after the job fails or is cancelled.
     */
    progress: number;
    /** The images that the job made. For a moment image, `moment` is the moment that it shows. */
    images: {fileId: number; moment?: CARTA.Moment}[];
    /** Why the job failed. */
    error?: string;
}

/**
 * Returns the message of an error, without the final period. Returns "the request failed" when the
 * error has no message.
 */
function reasonOf(err: unknown): string {
    const text = (err instanceof Error ? err.message : String(err ?? "")).trim().replace(/\.$/, "");
    return text || "the request failed";
}

class ImageGenerationJob {
    @observable status: ImageGenerationJobStatus = "running";
    @observable images: FrameStore[] = [];
    @observable error: string | undefined = undefined;
    /** Ends the wait for the region data. It is set only while the job waits for the data. */
    stopWaiting: (() => void) | undefined = undefined;
    /**
     * Whether the request that makes the images has been sent. While it is true, cancelling the job
     * also cancels the backend request.
     */
    isRequesting = false;
    /** Resolves when the job ends. */
    readonly ended: Promise<void>;
    private resolveEnded: () => void = () => {};

    constructor(
        readonly id: number,
        readonly kind: ImageGenerationJobKind,
        readonly frame: FrameStore
    ) {
        makeObservable(this);
        this.ended = new Promise(resolve => (this.resolveEnded = resolve));
    }

    @computed get isRunning(): boolean {
        return this.status === "running";
    }

    @computed get progress(): number {
        if (this.status === "done") {
            return 1;
        }
        if (this.status !== "running" || !this.isRequesting) {
            return 0;
        }
        return (this.kind === "moment" ? this.frame.requestingMomentsProgress : this.frame.requestingPVProgress) ?? 0;
    }

    /** Ends a running job. Does nothing when the job has already ended. */
    @action end(status: Exclude<ImageGenerationJobStatus, "running">, images: FrameStore[] = [], error?: string) {
        if (this.status !== "running") {
            return;
        }
        this.status = status;
        this.images = images;
        this.error = error;
        this.resolveEnded();
    }

    /** Clears the request state of the image, so that the progress dialog of the GUI closes. */
    resetFrameRequestState() {
        if (this.kind === "moment") {
            this.frame.resetMomentRequestState();
        } else {
            this.frame.resetPvRequestState();
            this.frame.setIsRequestPVCancelling(false);
        }
    }

    get state(): ImageGenerationJobState {
        return {
            id: this.id,
            kind: this.kind,
            fileId: this.frame.frameInfo.fileId,
            status: this.status,
            progress: this.progress,
            images: this.images.map(image => (this.kind === "moment" ? {fileId: image.frameInfo.fileId, moment: image.generation?.moment} : {fileId: image.frameInfo.fileId})),
            error: this.error
        };
    }
}

/**
 * The jobs that make moment images and PV images for scripts.
 *
 * A job starts at once and runs in the background. A script then reads its status and progress,
 * waits for it, or cancels it. This way a script does not need to guess how long a large cube
 * takes. The jobs are kept until the session ends.
 */
export class ImageGenerationJobStore {
    private nextId = 1;
    private readonly jobs = new Map<number, ImageGenerationJob>();

    constructor(private readonly appStore: AppStore) {}

    /**
     * Starts a job that makes moment images of the image with the file ID `fileId`.
     *
     * @returns the ID of the job.
     * @throws When a workspace is loading, when the image is not open, when it already makes
     *         moment images, when a moment needs a linear spectral axis that the image does not
     *         have, or when the settings are not valid.
     */
    startMoments = (fileId: number, settings: MomentJobSettings): number => {
        const frame = this.idleFrame(fileId, "moment");
        const regionId = settings.regionId ?? RegionId.IMAGE;
        if (regionId !== RegionId.IMAGE && !frame.getRegion(regionId)?.isClosedRegion) {
            throw new Error(`Image ${fileId} has no closed region with the ID ${regionId}`);
        }
        const moments = settings.moments;
        if (frame.isSpectralAxisNonlinear && moments?.some(moment => NONLINEAR_SPECTRAL_AXIS_UNSUPPORTED_MOMENTS.includes(moment))) {
            throw new Error(NONLINEAR_SPECTRAL_AXIS_MESSAGE);
        }
        const channelRange = ImageGenerationJobStore.channelRangeOf(frame, settings) ?? {min: 0, max: Math.max(frame.numChannels - 1, 0)};
        const message = momentMessageOf({moments, channelRange, mask: settings.mask ?? CARTA.MomentMask.None, pixelRange: settings.pixelRange ?? {min: 0, max: 0}}, frame, regionId, settings.keep ?? true);
        if (!message) {
            throw new Error("The moment settings are not valid");
        }
        const job = this.addJob("moment", frame);
        // Mark the image as busy at once. Then the GUI cannot start another request while the job
        // waits for the region data.
        frame.resetMomentRequestState();
        frame.setIsRequestingMoments(true);
        void this.run(job, regionId, regionId > RegionId.CURSOR, async () => {
            const made = this.appStore.requestMoment(message, frame, {isStillWanted: () => job.isRunning, shouldThrow: true}) as unknown as Promise<FrameStore[] | undefined>;
            return (await made) ?? [];
        });
        return job.id;
    };

    /**
     * Starts a job that makes a PV image of the image with the file ID `fileId`.
     *
     * @returns the ID of the job.
     * @throws When a workspace is loading, when the image is not open, when it already makes a PV
     *         image, when its spectral axis is not linear, or when the settings are not valid.
     */
    startPv = (fileId: number, settings: PvJobSettings): number => {
        const frame = this.idleFrame(fileId, "pv");
        const regionType = frame.getRegion(settings?.regionId)?.regionType;
        if (regionType !== CARTA.RegionType.LINE && regionType !== CARTA.RegionType.POLYLINE) {
            throw new Error(`Image ${fileId} has no line or polyline region with the ID ${settings?.regionId}`);
        }
        if (frame.isSpectralAxisNonlinear) {
            throw new Error(NONLINEAR_SPECTRAL_AXIS_MESSAGE);
        }
        const shouldKeep = settings.keep ?? true;
        const channelRange = ImageGenerationJobStore.channelRangeOf(frame, settings);
        const message = pvMessageOf({width: settings.width ?? 1, channelRange, reverse: settings.reverse ?? false}, frame, settings.regionId, shouldKeep);
        if (!message) {
            throw new Error("The PV settings are not valid");
        }
        const job = this.addJob("pv", frame);
        frame.resetPvRequestState();
        frame.setIsRequestingPV(true);
        void this.run(job, settings.regionId, false, async () => {
            const made = this.appStore.requestPV(message, frame, shouldKeep, {isStillWanted: () => job.isRunning, shouldThrow: true}) as unknown as Promise<FrameStore | undefined>;
            const image = await made;
            return image ? [image] : [];
        });
        return job.id;
    };

    /**
     * Returns what a script reads about a job.
     *
     * @throws When there is no job with the ID `jobId`.
     */
    getJob = (jobId: number): ImageGenerationJobState => {
        return this.jobOf(jobId).state;
    };

    /**
     * Cancels a running job. Images that the backend still makes for it are closed without being
     * shown. Does nothing when the job has already ended.
     *
     * @throws When there is no job with the ID `jobId`.
     */
    cancelJob = (jobId: number): void => {
        this.stop(this.jobOf(jobId), "cancelled");
    };

    private jobOf(jobId: number): ImageGenerationJob {
        const job = this.jobs.get(jobId);
        if (!job) {
            throw new Error(`There is no image generation job with the ID ${jobId}`);
        }
        return job;
    }

    /**
     * Returns the open image with the file ID `fileId`.
     *
     * @throws When a workspace is loading, when the image is not open, or when the image already
     *         makes images of the kind `kind`.
     */
    private idleFrame(fileId: number, kind: ImageGenerationJobKind): FrameStore {
        if (this.appStore.isLoadingWorkspace) {
            throw new Error("A workspace is loading");
        }
        const frame = this.appStore.frames.find(f => f.frameInfo.fileId === fileId);
        if (!frame) {
            throw new Error(`No image with the file ID ${fileId} is open`);
        }
        const isBusy = Array.from(this.jobs.values()).some(job => job.isRunning && job.kind === kind && job.frame === frame);
        if (isBusy || (kind === "moment" ? frame.isRequestingMoments : frame.isRequestingPV)) {
            throw new Error(`Image ${fileId} already makes ${kind === "moment" ? "moment images" : "a PV image"}`);
        }
        return frame;
    }

    private addJob(kind: ImageGenerationJobKind, frame: FrameStore): ImageGenerationJob {
        const job = new ImageGenerationJob(this.nextId++, kind, frame);
        this.jobs.set(job.id, job);
        return job;
    }

    /**
     * Ends a running job. Stops the wait for the region data, or cancels the backend request.
     *
     * @param shouldResetFrame - whether to clear the request state of the image at once. Use it when
     *                           no answer of the backend will clear the state, for example after
     *                           the connection is lost.
     */
    private stop(job: ImageGenerationJob, status: "failed" | "cancelled", error?: string, shouldResetFrame = false) {
        if (!job.isRunning) {
            return;
        }
        job.end(status, [], error);
        if (shouldResetFrame) {
            job.resetFrameRequestState();
        }
        job.stopWaiting?.();
        if (job.isRequesting) {
            const fileId = job.frame.frameInfo.fileId;
            if (job.kind === "moment") {
                this.appStore.cancelRequestingMoment(fileId);
            } else {
                this.appStore.cancelRequestingPV(fileId);
            }
        }
    }

    /**
     * Runs a job. When the job needs the region data, waits for the data first. Then makes the
     * images.
     * The job fails when its image is closed, when its region is deleted, when a workspace starts to
     * load, or when the connection to the backend is lost. The job ends at once when it is stopped,
     * also when the backend never answers its request.
     *
     * @param regionId - the region of the job, or a negative ID when the job uses the whole image.
     * @param shouldWaitForRegionData - whether the backend must keep the data of the region first.
     */
    private async run(job: ImageGenerationJob, regionId: number, shouldWaitForRegionData: boolean, request: () => Promise<FrameStore[]>) {
        const frame = job.frame;
        const disposeWatch = reaction(
            () => ({
                isOpen: this.appStore.frames.includes(frame),
                hasRegion: regionId <= RegionId.CURSOR || !!frame.getRegion(regionId),
                isLoadingWorkspace: this.appStore.isLoadingWorkspace,
                isConnected: this.appStore.backendService.connectionStatus === ConnectionStatus.ACTIVE
            }),
            ({isOpen, hasRegion, isLoadingWorkspace, isConnected}) => {
                if (!isConnected) {
                    // The backend drops its requests when the connection is lost, so no answer will come.
                    this.stop(job, "failed", "the connection to the backend was lost", true);
                } else if (isLoadingWorkspace) {
                    this.stop(job, "failed", "a workspace was loaded");
                } else if (!isOpen) {
                    this.stop(job, "failed", "the image was closed");
                } else if (!hasRegion) {
                    this.stop(job, "failed", "the region was deleted");
                }
            },
            {equals: comparer.structural}
        );
        let hasSentRequest = false;
        try {
            if (shouldWaitForRegionData) {
                const wait = waitForRegionData<"stopped">(frame, regionId, () => this.appStore.frames.includes(frame));
                job.stopWaiting = () => wait.stop("stopped");
                const outcome = await wait.ready;
                job.stopWaiting = undefined;
                if (outcome === "closed") {
                    this.stop(job, "failed", "the image was closed");
                }
                if (!job.isRunning) {
                    return;
                }
            }
            job.isRequesting = true;
            hasSentRequest = true;
            const requested = request();
            // A request that ends after the job is stopped has nothing to report.
            requested.catch(() => {});
            const images = await Promise.race([requested, job.ended.then(() => [])]);
            job.end("done", images);
        } catch (err) {
            if (err instanceof ImageRequestCancelledError) {
                job.end("cancelled");
            } else {
                job.end("failed", [], reasonOf(err));
            }
        } finally {
            job.isRequesting = false;
            if (!hasSentRequest) {
                job.resetFrameRequestState();
            }
            disposeWatch();
        }
    }

    /**
     * Returns the channel range of a job as channel indices, with the smaller index first. Returns
     * nothing when the settings give no range.
     *
     * @throws When the settings give both channels and spectral values, or a range that the image
     *         cannot use.
     */
    static channelRangeOf(frame: FrameStore, settings: ChannelSettings): {min: number; max: number} | undefined {
        const {channels, spectralRange} = settings;
        if (channels && spectralRange) {
            throw new Error("Give either channels or a spectral range, not both");
        }
        if (channels) {
            const isChannel = (value: unknown) => Number.isInteger(value) && (value as number) >= 0 && (value as number) < frame.numChannels;
            if (!isChannel(channels.min) || !isChannel(channels.max)) {
                throw new Error(`The channels must be from 0 to ${frame.numChannels - 1}`);
            }
            return {min: Math.min(channels.min, channels.max), max: Math.max(channels.min, channels.max)};
        }
        if (!spectralRange) {
            return undefined;
        }
        const type = spectralRange.type ?? frame.spectralType;
        const supported = Array.from(frame.spectralCoordsSupported?.values() ?? []);
        let unit = spectralRange.unit ?? (type === frame.spectralType ? frame.spectralUnit : supported.find(coord => coord.type === type)?.unit) ?? null;
        if (type === SpectralType.CHANNEL) {
            unit = null;
        }
        if (type !== SpectralType.CHANNEL && !supported.some(coord => coord.type === type && coord.unit === unit)) {
            throw new Error(`The image does not support the spectral type ${type} with the unit ${unit}`);
        }
        const system = spectralRange.system ?? frame.spectralSystem;
        const systems = frame.spectralSystemsSupported ?? [];
        if (spectralRange.system && !systems.includes(spectralRange.system)) {
            throw new Error(`The image does not support the spectral system ${spectralRange.system}`);
        }
        const min = frame.findChannelIndexInCoordinate(spectralRange.min, type, unit, system, true);
        const max = frame.findChannelIndexInCoordinate(spectralRange.max, type, unit, system, true);
        if (min === undefined || max === undefined || !isFinite(min) || !isFinite(max)) {
            throw new Error("The spectral range cannot be converted to channels");
        }
        return {min: Math.min(min, max), max: Math.max(min, max)};
    }
}
