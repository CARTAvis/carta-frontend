import {CARTA} from "carta-protobuf";
import {autorun, comparer, observable, reaction, runInAction} from "mobx";

import {BeamType, FrequencyUnit, HipsCoord, HipsProjection, ImageType, RegionId, RegionOpacity, RestFrameShiftMode, SkyRefIs, VelocityConvention, WorkspaceItemKind} from "enums";
import {
    describeCatalogSource,
    describeImageSource,
    GetIntensityOptions,
    isWidgetWorkspaceConfigOf,
    MOMENT_TEXT,
    type Workspace,
    type WorkspaceCatalog,
    type WorkspaceCatalogSource,
    type WorkspaceFile,
    type WorkspaceGeneratedImages,
    type WorkspaceGenerationRequest,
    type WorkspaceHipsRequest,
    type WorkspaceIdReader,
    type WorkspaceImageSource,
    type WorkspaceIssue,
    type WorkspaceMomentRequest,
    type WorkspacePvRequest
} from "models";
import {BackendService, CatalogApiService} from "services";
import {AppStore, type CatalogRestoreOutcome, type ColorBlendingStore, restoreWorkspaceZoom, StreamingRowSource} from "stores";
import {type FrameStore, LINE_REGION_SAMPLE_WIDTH_MAX, LINE_REGION_SAMPLE_WIDTH_MIN} from "stores/Frame";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";
import {awaited, awaitedFlow, hashCatalogContent, isValidRedshift, resolveCatalogSelection} from "utilities";

/** Which of the session's references an image is matched to. */
type ReferenceKind = "spatial" | "spectral" | "raster";

/** One catalog whose rows have been asked for, and what the answer has to be judged against. */
interface CatalogConfigRequest {
    catalogFileId: number;
    /** How the catalog is named to the user. */
    description: string;
    /** What to report if its rows do not come back. */
    rowFailure: string;
    completion: Promise<CatalogRestoreOutcome>;
}

/**
 * Brings a workspace back into the running session, one named stage at a time.
 *
 * Restoring is not a single step: images have to exist before catalogs can be attached to them, a
 * catalog's rows have to match its saved query before its overlay is drawn, and the widgets and
 * plots showing a catalog can only be bound once it is loaded. Running the stages in a fixed order
 * makes what a restored session looks like a property of the workspace, rather than of which store
 * happened to be ready first.
 *
 * The restorer owns the order and the loading. What each piece of state means stays with whoever
 * owns it: a frame's own config stores, a catalog's profile store for its table and query, and its
 * display store for how it is drawn.
 */
export class WorkspaceRestorer implements WorkspaceIdReader {
    /**
     * The number of workspace loads that have started. A later load uses it to take over from an
     * earlier load. It is observable, so that a wait in an earlier load ends as soon as a later
     * load starts.
     */
    private static readonly GenerationCounter = observable.box(0);

    /**
     * Take the session over from whatever load is already running.
     *
     * A restore is a long run of asynchronous stages, and nothing stops a second load being started
     * while the first is still in the middle of one. The two would otherwise go on interleaving
     * their images, catalogs and layout into one session. The newest load owns the session, and an
     * older one stops as soon as it next gets the chance.
     *
     * @returns which load this is, to be passed to the restorer and checked against afterwards.
     */
    public static claimGeneration(): number {
        runInAction(() => WorkspaceRestorer.GenerationCounter.set(WorkspaceRestorer.GenerationCounter.get() + 1));
        return WorkspaceRestorer.GenerationCounter.get();
    }

    /** Whether a load is still the one the session is following. */
    public static isCurrentGeneration(generation: number): boolean {
        return generation === WorkspaceRestorer.GenerationCounter.get();
    }

    /** One entry per item that could not be brought back as saved. */
    private readonly issues: WorkspaceIssue[] = [];
    /** Workspace image ID to the file ID this session gave it. */
    private readonly frameIds = new Map<number, number>();
    /** Workspace catalog ID to the file ID this session gave it. */
    private readonly catalogIds = new Map<number, number>();
    /** For each Workspace image ID, maps the saved ID of each region to the ID that the backend gave the restored region. */
    private readonly regionIds = new Map<number, Map<number, number>>();
    /** The image the session is left with in front once the restore is done. */
    private frontFrame: FrameStore | undefined;
    /** The color-blended images rebuilt, by the image list index each was saved at. */
    private readonly colorBlendings = new Map<number, ColorBlendingStore>();
    /** The requests for generated images that the workspace saves, each with the images that it made. */
    private readonly generatedImages: WorkspaceGeneratedImages[];
    /** Every image the workspace shows, opened or made again, by its workspace ID. */
    private readonly images = new Map<number, WorkspaceFile>();
    /** How each generated image is named to the user, by its workspace ID. */
    private readonly generatedImageNames = new Map<number, string>();
    /** The images moments have been made of again so far. */
    private readonly momentSources = new Set<FrameStore>();
    /** Images whose reference is a generated image that is not made yet. They are matched when the reference is made. */
    private readonly pendingMatches: {frame: FrameStore; fileInfo: WorkspaceFile; kind: ReferenceKind}[] = [];

    constructor(
        private readonly workspace: Workspace,
        private readonly generation: number
    ) {
        this.generatedImages = (Array.isArray(workspace.generatedImages) ? workspace.generatedImages : []).filter(
            generated => typeof generated?.request?.type === "string" && Array.isArray(generated.images) && generated.images.every(image => typeof image?.id === "number")
        );
        for (const fileInfo of workspace.files ?? []) {
            this.images.set(fileInfo.id, fileInfo);
        }
        for (const {images} of this.generatedImages) {
            for (const image of images) {
                this.images.set(image.id, image);
                this.generatedImageNames.set(image.id, image.name || "a generated image");
            }
        }
    }

    /** Every image the workspace shows: the files it opens, then the images its requests make. */
    private get allImages(): WorkspaceFile[] {
        return Array.from(this.images.values());
    }

    /** How an image the workspace shows is named to the user. */
    private nameOf(fileInfo: WorkspaceFile): string {
        return this.generatedImageNames.get(fileInfo.id) ?? describeImageSource(fileInfo.source);
    }

    /** Whether this restore is still the one the session is following. */
    private get isCurrent(): boolean {
        return WorkspaceRestorer.isCurrentGeneration(this.generation);
    }

    /**
     * Take back out of the session an image this restore had asked for before it was superseded.
     *
     * A file that is already on its way from the backend is added to whatever session exists by the
     * time it arrives, which may be the one a later load has since cleared and started filling. The
     * restore that asked for it is the only thing that knows it does not belong there.
     */
    private closeSupersededImage(frame: FrameStore | undefined): void {
        if (frame && this.appStore.frames.includes(frame)) {
            this.appStore.closeFile(frame, false);
        }
    }

    /** The same, for a catalog that finished opening into a session this restore no longer owns. */
    private closeSupersededCatalog(catalogFileId: number | undefined): void {
        if (catalogFileId !== undefined) {
            this.appStore.catalogStore.close(catalogFileId);
        }
    }

    private get appStore(): AppStore {
        return AppStore.Instance;
    }

    /**
     * Restore the workspace, replacing whatever the session currently holds.
     *
     * @returns one entry per item that could not be brought back as saved.
     */
    public *restore(): Generator<Promise<unknown>, WorkspaceIssue[], any> {
        this.clearSession();
        yield* this.openImages();
        if (!this.isCurrent) {
            return this.issues;
        }
        yield* this.openHipsImages();
        if (!this.isCurrent) {
            return this.issues;
        }
        // End this step before the images are matched. A new rest frequency reaches the WCS of an
        // image only when the step that set it ends. Matching the images uses this WCS.
        this.restoreRestFrequencies(this.allImages);
        yield* awaited(Promise.resolve());
        if (!this.isCurrent) {
            return this.issues;
        }
        // The backend registers the regions and computes the cube histograms while the catalogs open.
        // The restore waits for both before it applies the layout.
        const regions = this.configureImages(this.allImages);
        yield* this.generateImages(regions);
        if (!this.isCurrent) {
            return this.issues;
        }
        this.restoreOffsetCoordinates();
        this.chooseFrontImage();
        const cubeHistograms = this.restoreCubeHistograms();
        this.restoreColorBlending();
        this.putFrontImageBack();
        yield* this.openCatalogs();
        if (!this.isCurrent) {
            return this.issues;
        }
        yield* this.configureCatalogs();
        if (!this.isCurrent) {
            return this.issues;
        }
        yield* awaited(cubeHistograms);
        yield* awaited(regions);
        if (!this.isCurrent) {
            return this.issues;
        }
        this.restoreLayout();
        yield* this.restoreViews();
        if (!this.isCurrent) {
            return this.issues;
        }
        this.settle();
        return this.issues;
    }

    /** Report something that could not be brought back, naming what it was about. */
    private report(kind: WorkspaceItemKind, subject: string, message: string): void {
        this.issues.push({kind, subject, message});
    }

    /** Stage 1: put the session back to an empty state for the workspace to be restored into. */
    private clearSession(): void {
        CatalogApiService.Instance.cancelPendingQueries("The online catalog query was given up on to open a workspace");
        this.appStore.catalogStore.interruptRequests("The previous workspace restore was interrupted");
        this.appStore.animatorStore.stopAnimation();
        this.appStore.tileService.clearRequestQueue();
        this.appStore.removeAllFrames();
    }

    /** Stage 2: open every image, and map the workspace's image IDs onto this session's file IDs. */
    private *openImages(): Generator<Promise<unknown>, void, any> {
        for (const fileInfo of this.workspace.files ?? []) {
            if (!this.isCurrent) {
                return;
            }
            let frame: FrameStore | undefined;
            try {
                frame = (yield* this.openImageSource(fileInfo.source)) ?? undefined;
            } catch (err) {
                console.error(err);
            }
            // Checked again here rather than only at the top of the loop: the image finished opening
            // while this restore was suspended, and a load started in the meantime owns the session.
            if (!this.isCurrent) {
                this.closeSupersededImage(frame);
                return;
            }
            if (!frame) {
                this.report(WorkspaceItemKind.Image, describeImageSource(fileInfo.source), `Could not open the image ${describeImageSource(fileInfo.source)}`);
                continue;
            }
            this.adoptImage(fileInfo, frame);
        }
    }

    /** Uses an image that was just opened or made again as the image that the workspace names by this ID. */
    private adoptImage(fileInfo: WorkspaceFile, frame: FrameStore): void {
        this.frameIds.set(fileInfo.id, frame.frameInfo.fileId);
        // The workspace is the authority on which image its own ID names.
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Image, frame.frameInfo.fileId, fileInfo.id);

        frame.setChannels(fileInfo.channel ?? 0, fileInfo.stokes ?? 0, false);

        // Set the references before any image is matched against them.
        if (this.workspace.references?.spatial === fileInfo.id) {
            this.appStore.setSpatialReference(frame);
        }
        if (this.workspace.references?.spectral === fileInfo.id) {
            this.appStore.setSpectralReference(frame);
        }
        if (this.workspace.references?.raster === fileInfo.id) {
            this.appStore.setRasterScalingReference(frame);
        }
        if (fileInfo.timeSeriesMember) {
            this.appStore.setTimeSeriesMember(frame, true);
        }
    }

    /**
     * Stage 2b: query each HiPS image again. A HiPS query does not depend on any other data in the
     * session, so it runs together with the opening of the file images.
     */
    private *openHipsImages(): Generator<Promise<unknown>, void, any> {
        for (const {request, images} of this.generatedImages) {
            if (request.type !== "hips" || !images.length) {
                continue;
            }
            if (!this.isCurrent) {
                return;
            }
            const subject = WorkspaceRestorer.describeRequest(request, "");
            const query = WorkspaceRestorer.hipsQueryOf(request);
            if (!query) {
                this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject}: the query is not one this version can read`);
                continue;
            }
            let frame: FrameStore | undefined;
            try {
                frame = (yield* awaitedFlow<FrameStore | undefined | 0>(this.appStore.loadRemoteFile(query))) || undefined;
            } catch (err) {
                console.error(err);
            }
            if (!this.isCurrent) {
                this.closeSupersededImage(frame);
                return;
            }
            if (!frame) {
                this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject}`);
                continue;
            }
            this.adoptImage(images[0], frame);
        }
    }

    /** Returns the query that a saved HiPS request makes, or nothing when this version cannot make it. */
    private static hipsQueryOf(request: WorkspaceHipsRequest): CARTA.RemoteFileRequest.$Properties | undefined {
        const isNumber = (value: unknown): value is number => typeof value === "number" && isFinite(value);
        const {survey, width, height, object, center, fov, coordsys, projection, rotationAngle} = request;
        const hasPlace = (typeof object === "string" && object.length > 0) || (isNumber(center?.x) && isNumber(center?.y));
        if (
            typeof survey !== "string" ||
            !survey ||
            !isNumber(width) ||
            !isNumber(height) ||
            !isNumber(fov) ||
            !isNumber(rotationAngle) ||
            !hasPlace ||
            !Object.values(HipsCoord).includes(coordsys) ||
            !Object.values(HipsProjection).includes(projection)
        ) {
            return undefined;
        }
        const place = object ? {object} : {ra: center?.x, dec: center?.y};
        return {hips: survey, width, height, ...place, fov, coordsys, projection, rotationAngle};
    }

    /** Returns the name of a request, as shown to the user. */
    private static describeRequest(request: WorkspaceGenerationRequest, sourceName: string): string {
        switch (request.type) {
            case "moment":
                return `the moment images of ${sourceName}`;
            case "pv":
                return `the PV image of ${sourceName}`;
            default:
                return `the HiPS image of ${request.survey}`;
        }
    }

    /** Open one image the way the workspace says it was opened. */
    private *openImageSource(source: WorkspaceImageSource | undefined): Generator<Promise<unknown>, FrameStore | undefined, any> {
        switch (source?.type) {
            case "lel":
                return yield* awaitedFlow<FrameStore | undefined>(this.appStore.appendFile(source.directory ?? "", source.expression, "", true, false));
            case "hypercube": {
                const stokesFiles = source.stokesFiles.map(stokesFile => ({
                    directory: stokesFile.directory ?? source.directory ?? "",
                    file: stokesFile.filename,
                    hdu: stokesFile.hdu ?? "",
                    polarizationType: stokesFile.polarizationType
                }));
                const fileId = yield* awaited<number | undefined | null>(this.appStore.appendConcatFile(stokesFiles, source.directory ?? "", source.hdu ?? ""));
                return fileId === undefined || fileId === null ? undefined : (this.appStore.getFrame(fileId) ?? undefined);
            }
            case "file":
                return yield* awaitedFlow<FrameStore | undefined>(this.appStore.appendFile(source.directory ?? "", source.filename, source.hdu, false, false));
            default:
                return undefined;
        }
    }

    /**
     * Stage 3: apply the display settings of each image when the image exists. Apply them first to
     * every opened image, then to the images of each request as the request makes them.
     */
    private configureImages(images: WorkspaceFile[]): Promise<unknown> {
        const regions: Promise<void>[] = [];
        for (const fileInfo of images) {
            const frame = this.frameOf(fileInfo.id);
            if (!frame) {
                continue;
            }

            if (this.workspace.selectedFile === fileInfo.id) {
                this.appStore.updateActiveImageByFrame(frame);
            }

            if (fileInfo.renderConfig) {
                frame.renderConfig.applyConfig(fileInfo.renderConfig);
            }

            for (const kind of ["spatial", "spectral", "raster"] as const) {
                this.matchImage(frame, fileInfo, kind);
            }

            this.restoreSpectralSettings(frame, fileInfo);
            this.restoreImageViewSettings(frame, fileInfo);

            if (fileInfo.contourConfig) {
                frame.contourConfig.applyConfig(fileInfo.contourConfig);
                frame.applyContours();
            }
            if (fileInfo.vectorOverlayConfig) {
                frame.vectorOverlayConfig.applyConfig(fileInfo.vectorOverlayConfig);
                frame.applyVectorOverlay();
            }

            if (fileInfo.center) {
                frame.center = fileInfo.center;
            }
            restoreWorkspaceZoom(frame, fileInfo);

            regions.push(this.restoreRegions(frame, fileInfo));
        }
        return Promise.all(regions);
    }

    /**
     * Matches an image to the reference that it was matched to, if the workspace names one.
     *
     * When the workspace names no reference, because the reference of the session was an image that
     * it could not save, match nothing. Do not match every image that named no reference, and do
     * not match an image to a stand-in for a reference that did not come back. A reference that a
     * request makes again does not exist yet when the opened images are configured, so those images
     * wait for it.
     */
    private matchImage(frame: FrameStore, fileInfo: WorkspaceFile, kind: ReferenceKind): void {
        const referenceId = this.workspace.references?.[kind];
        if (referenceId === undefined || fileInfo.references?.[kind] !== referenceId) {
            return;
        }
        const reference = this.frameOf(referenceId);
        if (!reference) {
            if (this.generatedImageNames.has(referenceId)) {
                this.pendingMatches.push({frame, fileInfo, kind});
            }
            return;
        }
        if (kind === "spatial" && this.appStore.spatialReference === reference) {
            this.appStore.setSpatialMatchingEnabled(frame, true);
        } else if (kind === "spectral" && this.appStore.spectralReference === reference) {
            this.appStore.setSpectralMatchingEnabled(frame, true);
        } else if (kind === "raster" && this.appStore.rasterScalingReference === reference) {
            this.appStore.setRasterScalingMatchingEnabled(frame, true);
        }
    }

    /**
     * Stage 3b: make the moment and PV images again, in the saved order, each from its restored
     * image and over its restored region. A request can use an image, or a region on an image, that
     * an earlier request made. So configure the images of each request before the next request is
     * made.
     */
    private *generateImages(regions: Promise<unknown>): Generator<Promise<unknown>, void, any> {
        const requests = this.generatedImages.filter(({request}) => request.type === "moment" || request.type === "pv");
        if (!requests.length) {
            return;
        }
        // Make the request over the region by the ID that the backend gave the region.
        yield* awaited(regions);
        for (const generated of requests) {
            if (!this.isCurrent) {
                return;
            }
            const frames = yield* this.makeImagesAgain(generated);
            if (!this.isCurrent) {
                frames.forEach(frame => this.closeSupersededImage(frame));
                return;
            }
            const images = this.adoptGeneratedImages(generated, frames);
            if (!images.length) {
                continue;
            }
            this.restoreRestFrequencies(images);
            yield* awaited(Promise.resolve());
            if (!this.isCurrent) {
                return;
            }
            yield* awaited(this.configureImages(images));
        }
    }

    /**
     * Run one saved moment or PV request again.
     *
     * @returns the images that it made, or none when the request could not be made or was skipped.
     */
    private *makeImagesAgain({request}: WorkspaceGeneratedImages): Generator<Promise<unknown>, FrameStore[], any> {
        if (request.type !== "moment" && request.type !== "pv") {
            return [];
        }
        const sourceInfo = this.images.get(request.sourceImageId);
        const subject = WorkspaceRestorer.describeRequest(request, sourceInfo ? this.nameOf(sourceInfo) : "an image");
        const source = this.frameOf(request.sourceImageId);
        if (!source) {
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject}: the image it is made from was not restored`);
            return [];
        }
        const regionId = typeof request.regionId === "number" ? this.regionIdOf(request.sourceImageId, request.regionId) : undefined;
        if (regionId === undefined) {
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject}: the region it is made over was not restored`);
            return [];
        }

        let outcome: FrameStore[] | "skipped" | undefined;
        if (request.type === "moment") {
            // The first request on an image replaces no images. A later request keeps the images
            // that earlier requests made. The backend numbers the names of kept images, as it did
            // when the images were first made.
            const message = WorkspaceRestorer.momentMessageOf(request, source, regionId, this.momentSources.has(source));
            this.momentSources.add(source);
            if (message && regionId > RegionId.CURSOR) {
                const handshake = yield* awaited(this.introduceRegionToBackend(source, regionId, `preparing ${subject}`));
                if (!this.isCurrent) {
                    return [];
                }
                if (handshake === "skipped") {
                    outcome = "skipped";
                } else if (handshake === "closed") {
                    outcome = [];
                }
            }
            if (message && outcome === undefined) {
                source.resetMomentRequestState();
                const waiting = {isSkipped: false};
                const made = (this.appStore.requestMoment(message, source, () => !waiting.isSkipped && this.isCurrent) as unknown as Promise<FrameStore[] | undefined>).then(frames => frames ?? []);
                outcome = yield* awaited(
                    this.waitForRequest(
                        made,
                        waiting,
                        `making ${subject}`,
                        () => source.requestingMomentsProgress,
                        () => this.appStore.cancelRequestingMoment(source.frameInfo.fileId)
                    )
                );
            }
        } else {
            const message = WorkspaceRestorer.pvMessageOf(request, source, regionId);
            if (message) {
                source.resetPvRequestState();
                const waiting = {isSkipped: false};
                const made = (this.appStore.requestPV(message, source, true, () => !waiting.isSkipped && this.isCurrent) as unknown as Promise<FrameStore | undefined>).then(frame => (frame ? [frame] : []));
                outcome = yield* awaited(
                    this.waitForRequest(
                        made,
                        waiting,
                        `making ${subject}`,
                        () => source.requestingPVProgress,
                        () => this.appStore.cancelRequestingPV(source.frameInfo.fileId)
                    )
                );
            }
        }

        if (outcome === undefined) {
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject}: the request is not one this version can make`);
            return [];
        }
        if (outcome === "skipped") {
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Skipped making ${subject}`);
            return [];
        }
        if (!outcome.length) {
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject}`);
        }
        return outcome;
    }

    /**
     * Gets the backend ready to make moments over a region of an image.
     *
     * The backend makes moments over a region only when it already keeps the region data of the
     * image. It starts to keep this data the first time that a widget asks for statistics, a
     * histogram or a profile of the region. In a normal session, a widget has always asked by then.
     * During a restore, no widget has asked yet, so the moment request fails. So ask for one
     * statistic of the region, wait for the answer, and then cancel that request. Sending the
     * request alone is not enough, because the backend handles requests out of order, and the
     * moment request could arrive first.
     *
     * The wait has no time limit. It ends when the backend answers, when the image is closed or a
     * later workspace load starts, or when the user skips it. Skipping it also skips the moment
     * request.
     */
    private introduceRegionToBackend(frame: FrameStore, regionId: number, description: string): Promise<"ready" | "closed" | "superseded" | "skipped"> {
        const backendService = BackendService.Instance;
        const fileId = frame.frameInfo.fileId;
        return new Promise(resolve => {
            let isSettled = false;
            const finish = (outcome: "ready" | "closed" | "superseded" | "skipped") => {
                if (isSettled) {
                    return;
                }
                isSettled = true;
                subscription.unsubscribe();
                disposeReaction();
                if (outcome !== "closed") {
                    backendService.setStatsRequirements({fileId, regionId, statsConfigs: []});
                }
                if (this.isCurrent) {
                    this.appStore.setWorkspaceLoadingStep(undefined);
                }
                resolve(outcome);
            };
            const subscription = backendService.statsStream.subscribe(stats => {
                if (stats?.fileId === fileId && stats.regionId === regionId) {
                    finish("ready");
                }
            });
            const disposeReaction = reaction(
                () => ({isOpen: this.appStore.frames.includes(frame), isCurrent: this.isCurrent}),
                ({isOpen, isCurrent}) => {
                    if (!isOpen) {
                        finish("closed");
                    } else if (!isCurrent) {
                        finish("superseded");
                    }
                },
                {equals: comparer.structural}
            );
            this.appStore.setWorkspaceLoadingStep({description, progress: 0, onSkip: () => finish("skipped")});
            backendService.setStatsRequirements({fileId, regionId, statsConfigs: [{coordinate: "z", statsTypes: [CARTA.StatsType.NumPixels]}]});
        });
    }

    /** Returns the request that a saved moment request makes, or nothing when this version cannot make it. */
    private static momentMessageOf(request: WorkspaceMomentRequest, source: FrameStore, regionId: number, shouldKeep: boolean): CARTA.MomentRequest.$Properties | undefined {
        const {moments, channelRange, mask, pixelRange} = request;
        const isNumber = (value: unknown): value is number => typeof value === "number" && isFinite(value);
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

    /** Returns the request that a saved PV request makes, or nothing when this version cannot make it. */
    private static pvMessageOf(request: WorkspacePvRequest, source: FrameStore, regionId: number): CARTA.PvRequest.$Properties | undefined {
        const {width, channelRange} = request;
        if (!Number.isInteger(width) || width < 1 || (channelRange !== undefined && (!Number.isInteger(channelRange?.min) || !Number.isInteger(channelRange?.max)))) {
            return undefined;
        }
        return {
            fileId: source.frameInfo.fileId,
            regionId,
            width,
            spectralRange: channelRange ? {min: channelRange.min, max: channelRange.max} : null,
            reverse: request.reverse === true,
            keep: true
        };
    }

    /**
     * Waits for a request that makes images, shows its progress and lets the user skip it.
     *
     * Skipping asks the backend to stop, but does not wait for the backend. The restore continues
     * at once. Images that still arrive for a skipped request are closed without being shown.
     */
    private waitForRequest(made: Promise<FrameStore[]>, waiting: {isSkipped: boolean}, description: string, progressOf: () => number, cancel: () => void): Promise<FrameStore[] | "skipped"> {
        return new Promise(resolve => {
            let isSettled = false;
            const settle = (outcome: FrameStore[] | "skipped"): boolean => {
                if (isSettled) {
                    return false;
                }
                isSettled = true;
                disposeProgress();
                if (this.isCurrent) {
                    this.appStore.setWorkspaceLoadingStep(undefined);
                }
                resolve(outcome);
                return true;
            };
            const skip = () => {
                waiting.isSkipped = true;
                cancel();
                settle("skipped");
            };
            const disposeProgress = autorun(() => {
                const progress = progressOf();
                if (this.isCurrent && !isSettled) {
                    this.appStore.setWorkspaceLoadingStep({description, progress, onSkip: skip});
                }
            });
            // The images of a skipped request are normally closed before they are shown. This also
            // closes any that were shown.
            made.then(
                frames => {
                    if (!settle(frames)) {
                        frames.forEach(frame => this.closeSupersededImage(frame));
                    }
                },
                err => {
                    console.error(err);
                    settle([]);
                }
            );
        });
    }

    /**
     * Uses the images that a request made again as the images that the workspace names. When the
     * request made several images, match them by their moments.
     *
     * @returns the saved images that were made again.
     */
    private adoptGeneratedImages({request, images}: WorkspaceGeneratedImages, frames: FrameStore[]): WorkspaceFile[] {
        const adopted: WorkspaceFile[] = [];
        const unclaimed = [...frames];
        for (const [index, image] of images.entries()) {
            const frameIndex = request.type === "moment" && typeof image.moment === "number" ? unclaimed.findIndex(frame => frame.generation?.moment === image.moment) : unclaimed.indexOf(frames[index]);
            const frame = frameIndex >= 0 ? unclaimed.splice(frameIndex, 1)[0] : undefined;
            if (!frame) {
                if (frames.length) {
                    const imageName = this.nameOf(image);
                    this.report(WorkspaceItemKind.Image, imageName, `Could not make the image ${imageName}`);
                }
                continue;
            }
            this.adoptImage(image, frame);
            // The session matches a moment image to its source image by itself. Turn the match off
            // for an image that was saved unmatched.
            if (frame.spatialReference && image.references?.spatial === undefined) {
                this.appStore.setSpatialMatchingEnabled(frame, false);
            }
            adopted.push(image);
        }
        // Close the images that the workspace does not show.
        unclaimed.forEach(frame => this.closeSupersededImage(frame));

        // Match now the images that wait for one of these images as their reference.
        const pending = this.pendingMatches.splice(0);
        for (const match of pending) {
            this.matchImage(match.frame, match.fileInfo, match.kind);
        }
        return adopted;
    }

    /**
     * Returns the image to put in front: the image that was saved in front, or else the first
     * restored image. Each image that a request made again was put in front when it arrived.
     */
    private chooseFrontImage(): void {
        // The image saved in front can be missing. It could not be opened or made again, or it was
        // a generated image that the workspace does not save. A session with open images always has
        // one image in front.
        const savedFrontFrame = this.workspace.selectedFile === undefined ? undefined : this.frameOf(this.workspace.selectedFile);
        this.frontFrame = savedFrontFrame ?? this.allImages.map(fileInfo => this.frameOf(fileInfo.id)).find(frame => frame !== undefined);
        if (this.frontFrame && this.appStore.activeFrame !== this.frontFrame) {
            this.appStore.updateActiveImageByFrame(this.frontFrame);
        }
    }

    /**
     * Sets the spectral coordinates, spectral system and intensity unit of the image, on this image
     * only. An image that is spectrally matched to another image was saved with the settings of
     * that image.
     */
    private restoreSpectralSettings(frame: FrameStore, fileInfo: WorkspaceFile): void {
        const imageName = this.nameOf(fileInfo);
        const unsupported: string[] = [];
        if (fileInfo.spectralCoordinate !== undefined && !frame.setSpectralCoordinate(fileInfo.spectralCoordinate, false)) {
            unsupported.push(`the spectral coordinate ${fileInfo.spectralCoordinate}`);
        }
        if (fileInfo.spectralCoordinateSecondary !== undefined && !frame.setSpectralCoordinateSecondary(fileInfo.spectralCoordinateSecondary, false)) {
            unsupported.push(`the secondary spectral coordinate ${fileInfo.spectralCoordinateSecondary}`);
        }
        if (fileInfo.spectralSystem !== undefined && !frame.setSpectralSystem(fileInfo.spectralSystem, false)) {
            unsupported.push(`the spectral system ${fileInfo.spectralSystem}`);
        }
        const intensityUnit = fileInfo.intensityUnit;
        if (intensityUnit !== undefined) {
            if (intensityUnit === frame.headerUnit || GetIntensityOptions(frame.intensityConfig).includes(intensityUnit)) {
                frame.setIntensityUnit(intensityUnit);
            } else {
                unsupported.push(`the intensity unit ${intensityUnit}`);
            }
        }
        if (unsupported.length) {
            this.report(WorkspaceItemKind.Image, imageName, `Could not show ${imageName} in ${unsupported.join(", ")}`);
        }
    }

    /**
     * Restores the offset coordinates of each image.
     *
     * The workspace saves offset coordinates only on an image that is not matched to another image.
     * Pass them on to the images matched to it, as the controls do. Set them after every image is
     * matched. Matching an image moves the offset center of the image that it is matched to.
     */
    private restoreOffsetCoordinates(): void {
        for (const fileInfo of this.allImages) {
            const frame = this.frameOf(fileInfo.id);
            const offset = fileInfo.offsetCoordinates;
            if (!frame || !offset || frame.spatialReference) {
                continue;
            }
            const center = offset.center;
            const isSupported = !frame.isPVImage && !frame.isSwappedZ && !frame.isUVImage;
            if (isSupported && center && frame.setOffsetCenter(center.x, center.y)) {
                if (offset.skyRefIs === SkyRefIs.Origin || offset.skyRefIs === SkyRefIs.Pole) {
                    frame.setSkyRefIs(offset.skyRefIs);
                }
                if (!frame.isOffsetCoord) {
                    frame.toggleOffsetCoord();
                }
            } else {
                const imageName = this.nameOf(fileInfo);
                this.report(WorkspaceItemKind.Image, imageName, `Could not show ${imageName} with offset coordinates`);
            }
        }
    }

    /**
     * Stage 2a: restore the rest frequency that converts the spectral axis of each image. Skip an
     * image whose rest frequency is the one in its header.
     */
    private restoreRestFrequencies(images: WorkspaceFile[]): void {
        for (const fileInfo of images) {
            const frame = this.frameOf(fileInfo.id);
            const restFrequency = fileInfo.restFrequency;
            if (!frame || !restFrequency) {
                continue;
            }
            const {value, unit} = restFrequency;
            if (typeof value === "number" && isFinite(value) && value > 0 && Object.values(FrequencyUnit).includes(unit as FrequencyUnit)) {
                frame.restFreqStore.setCustomUnit(unit as FrequencyUnit);
                frame.restFreqStore.setCustomVal(value);
            } else {
                const imageName = this.nameOf(fileInfo);
                this.report(WorkspaceItemKind.Image, imageName, `Could not convert ${imageName} with the rest frequency ${value} ${unit}`);
            }
        }
    }

    /** The rest frame and beam the image was shown with, set on the image alone. */
    private restoreImageViewSettings(frame: FrameStore, fileInfo: WorkspaceFile): void {
        const unsupported: string[] = [];

        const restFrame = fileInfo.restFrame;
        if (restFrame) {
            if (!frame.isRestFrameSupported) {
                if (restFrame.enabled) {
                    unsupported.push("its rest frame");
                }
            } else if (Object.values(RestFrameShiftMode).includes(restFrame.shiftMode) && Object.values(VelocityConvention).includes(restFrame.velocityConvention) && isValidRedshift(restFrame.redshift)) {
                frame.setRestFrameShiftMode(restFrame.shiftMode);
                frame.setRestFrameVelocityConvention(restFrame.velocityConvention);
                frame.setRestFrameRedshift(restFrame.redshift);
                frame.setRestFrameEnabled(restFrame.enabled === true);
            } else {
                unsupported.push("its rest frame");
            }
        }

        const beam = fileInfo.beam;
        if (beam && !frame.beamProperties) {
            unsupported.push("its beam");
        } else if (beam) {
            const beamSettings = frame.overlayBeamSettings;
            const isNumber = (value: unknown): value is number => typeof value === "number" && isFinite(value);
            if (typeof beam.visible === "boolean") {
                beamSettings.setVisible(beam.visible);
            }
            if (typeof beam.color === "string" && beam.color) {
                beamSettings.setColor(beam.color);
            }
            if (Object.values(BeamType).includes(beam.type)) {
                beamSettings.setType(beam.type);
            }
            if (isNumber(beam.width) && beam.width > 0) {
                beamSettings.setWidth(beam.width);
            }
            if (isNumber(beam.shiftX)) {
                beamSettings.setShiftX(beam.shiftX);
            }
            if (isNumber(beam.shiftY)) {
                beamSettings.setShiftY(beam.shiftY);
            }
        }

        if (unsupported.length) {
            const imageName = this.nameOf(fileInfo);
            this.report(WorkspaceItemKind.Image, imageName, `Could not show ${imageName} with ${unsupported.join(" or ")}`);
        }
    }

    /**
     * Restores the regions of the image. An image that is matched to another image has no regions
     * of its own.
     *
     * The backend gives each restored region a new ID. Map the saved ID of each region to the new
     * ID after the backend answers.
     */
    private async restoreRegions(frame: FrameStore, fileInfo: WorkspaceFile): Promise<void> {
        if (frame.spatialReference || !fileInfo.regionsSet?.regions) {
            return;
        }

        const preferenceStore = this.appStore.preferenceStore;
        const regionIds = new Map<number, number>();
        this.regionIds.set(fileInfo.id, regionIds);
        const selectedRegion = fileInfo.regionsSet.selectedRegion;
        await Promise.all(
            fileInfo.regionsSet.regions.map(async regionInfo => {
                const region = await frame.regionSet.addExistingRegionAsync(
                    regionInfo.points,
                    regionInfo.rotation,
                    regionInfo.type,
                    regionInfo.id,
                    regionInfo.name ?? "",
                    regionInfo.color ?? preferenceStore.regionColor,
                    regionInfo.lineWidth ?? preferenceStore.regionLineWidth,
                    regionInfo.dashes ?? [preferenceStore.regionDashLength],
                    regionInfo.annotationStyles
                );
                regionIds.set(regionInfo.id, region.regionId);
                region.setLocked(regionInfo.locked ?? false);
                if (regionInfo.opacity === RegionOpacity.SemiTransparent || regionInfo.opacity === RegionOpacity.Invisible) {
                    region.setOpacity(regionInfo.opacity);
                }
                const sampleWidth = regionInfo.lineRegionSampleWidth;
                if (typeof sampleWidth === "number" && Number.isInteger(sampleWidth) && sampleWidth >= LINE_REGION_SAMPLE_WIDTH_MIN && sampleWidth <= LINE_REGION_SAMPLE_WIDTH_MAX) {
                    region.setLineRegionSampleWidth(sampleWidth);
                }
                if (selectedRegion === regionInfo.id) {
                    frame.regionSet.selectSingleRegion(region);
                }
            })
        );
    }

    /**
     * Returns the ID in this session of a region from the workspace, or nothing when the region was
     * not restored.
     *
     * The cursor, the whole image and the other fixed region IDs are the same in every session. A
     * region of an image that is matched to another image belongs to that other image.
     *
     * @param workspaceImageId - the workspace ID of the image that the region was saved on. Leave
     *                           it out for the image that was in front.
     * @param savedRegionId - the ID that the region was saved with.
     */
    public regionIdOf(workspaceImageId: number | undefined, savedRegionId: number): number | undefined {
        if (savedRegionId <= RegionId.CURSOR) {
            return savedRegionId;
        }
        if (workspaceImageId === undefined) {
            return this.workspace.selectedFile === undefined ? undefined : this.regionIdOf(this.workspace.selectedFile, savedRegionId);
        }
        const fileInfo = this.images.get(workspaceImageId);
        const ownerId = fileInfo?.references?.spatial ?? workspaceImageId;
        return this.regionIds.get(ownerId)?.get(savedRegionId);
    }

    /**
     * Stage 3a: compute again the cube histograms that the percentile ranges of images came from.
     *
     * A workspace is a snapshot, so a restored image with such a range still follows the cube
     * histogram. The backend computes only one cube histogram at a time for a session, so the
     * restore asks for them one after another. The range applied in stage 3 stays until the cube
     * histogram is complete. For an unchanged file, the percentile then gives the same range again.
     * When the cube histogram of an image does not come, the image keeps its saved range as a
     * custom range.
     */
    private async restoreCubeHistograms(): Promise<void> {
        const pending = this.allImages.flatMap(fileInfo => {
            const frame = this.frameOf(fileInfo.id);
            return frame?.renderConfig.isUsingCubeHistogram ? [{fileInfo, frame}] : [];
        });
        for (const {fileInfo, frame} of pending) {
            const isOpen = () => this.appStore.frames.includes(frame);
            if (!this.isCurrent) {
                // A later load took over and kept these images. Do not leave any of them waiting for a
                // cube histogram that nobody will request.
                if (isOpen()) {
                    frame.renderConfig.keepRangeWithoutCubeHistogram(frame.requiredPolarizationIndex);
                }
                continue;
            }

            const imageName = this.nameOf(fileInfo);
            // Name the restored Stokes in the request, and store the result under that Stokes. Without a
            // coordinate, the backend uses the Stokes that the frontend last sent for the image. The
            // frontend sends it only while the image is in view, through a throttled update, so the
            // backend may still have another Stokes.
            const stokesIndex = frame.requiredPolarizationIndex;
            frame.renderConfig.awaitCompleteCubeHistogram();
            frame.renderConfig.setStokesIndex(stokesIndex);
            this.appStore.requestCubeHistogram(frame.frameInfo.fileId, frame.coordinateOptionsZ?.[stokesIndex]?.value ?? "z");
            const outcome = await this.waitForCubeHistogram(frame, `cube histogram of ${imageName}`);
            if ((outcome === "skipped" || outcome === "superseded") && isOpen()) {
                frame.renderConfig.keepRangeWithoutCubeHistogram(stokesIndex);
                this.appStore.cancelCubeHistogramRequest(frame.frameInfo.fileId);
                if (outcome === "skipped" && this.isCurrent) {
                    this.report(WorkspaceItemKind.Image, imageName, `Skipped computing the cube histogram of ${imageName}; its percentile range is kept as a custom range; select Per-cube to compute it again`);
                }
            }
        }
        if (this.isCurrent) {
            this.appStore.setWorkspaceLoadingStep(undefined);
        }
    }

    /**
     * Wait for the cube histogram of an image, and return how the wait ends:
     * - "complete": the histogram is complete;
     * - "closed": the image was closed. A later workspace load closes every image;
     * - "superseded": a later workspace load started;
     * - "skipped": the user skipped the wait.
     *
     * The wait has no time limit. The user decides when to stop waiting, with the Skip button.
     */
    private waitForCubeHistogram(frame: FrameStore, description: string): Promise<"complete" | "closed" | "superseded" | "skipped"> {
        return new Promise(resolve => {
            let isSettled = false;
            const finish = (outcome: "complete" | "closed" | "superseded" | "skipped", dispose: () => void) => {
                if (isSettled) {
                    return;
                }
                isSettled = true;
                dispose();
                resolve(outcome);
            };
            const skip = () => finish("skipped", disposeReaction);
            const disposeReaction = reaction(
                () => ({progress: frame.renderConfig.cubeHistogramProgress, isOpen: this.appStore.frames.includes(frame), isCurrent: this.isCurrent}),
                ({progress, isOpen, isCurrent}, _previous, self) => {
                    if (!isOpen || progress >= 1) {
                        finish(isOpen ? "complete" : "closed", () => self.dispose());
                        return;
                    }
                    if (!isCurrent) {
                        finish("superseded", () => self.dispose());
                        return;
                    }
                    this.appStore.setWorkspaceLoadingStep({description, progress, onSkip: skip});
                },
                {fireImmediately: true, equals: comparer.structural}
            );
        });
    }

    /** Stage 4: rebuild the color-blended images made up of the images just opened. */
    private restoreColorBlending(): void {
        if (!this.workspace.colorBlendingImages) {
            return;
        }

        this.workspace.colorBlendingImages.sort((a, b) => a.imageListIndex - b.imageListIndex);
        for (const {imageListIndex, selectedFrameId, alpha} of this.workspace.colorBlendingImages) {
            const colorBlending = this.appStore.imageViewConfigStore.createColorBlending();
            if (colorBlending) {
                this.colorBlendings.set(imageListIndex, colorBlending);
            }
            while (colorBlending?.selectedFrames.length) {
                colorBlending.deleteSelectedFrame(0);
            }
            colorBlending?.setAlpha(0, alpha[0]);

            for (let i = 0; i < selectedFrameId.length; i++) {
                const frame = this.frameOf(selectedFrameId[i]);
                if (frame) {
                    colorBlending?.addSelectedFrame(frame);
                    colorBlending?.setAlpha(colorBlending.selectedFrames.length, alpha[i + 1]);
                }
            }

            this.appStore.reorderFrame(this.appStore.imageViewConfigStore.imageNum - 1, imageListIndex, 1);
        }
    }

    /**
     * Rebuilding a color-blended image puts it in front, so put the image saved in front back there,
     * or else the image chosen for the front. This has to happen before the catalogs open: a change
     * of the image in front moves the catalog widgets onto that image's catalogs, and done after the
     * widgets are restored it would undo them.
     */
    private putFrontImageBack(): void {
        const colorBlending = this.workspace.selectedColorBlending === undefined ? undefined : this.colorBlendings.get(this.workspace.selectedColorBlending);
        if (colorBlending) {
            this.appStore.updateActiveImage({type: ImageType.COLOR_BLENDING, store: colorBlending});
        } else if (this.frontFrame) {
            this.appStore.updateActiveImageByFrame(this.frontFrame);
        }
    }

    /** Stage 5: open every catalog against the image it belongs to. */
    private *openCatalogs(): Generator<Promise<unknown>, void, any> {
        for (const catalogInfo of this.workspace.catalogs ?? []) {
            if (!this.isCurrent) {
                return;
            }
            const description = describeCatalogSource(catalogInfo.source);
            const targetFrameId = catalogInfo.associatedImageId === undefined ? undefined : this.frameIds.get(catalogInfo.associatedImageId);
            if (catalogInfo.associatedImageId !== undefined && targetFrameId === undefined) {
                this.report(WorkspaceItemKind.Catalog, description, `Could not load the catalog ${description}: the image it belongs to was not restored`);
                continue;
            }

            let catalogFileId: number | undefined;
            try {
                catalogFileId = (yield* this.openCatalogSource(catalogInfo.source, targetFrameId)) ?? undefined;
            } catch (err) {
                console.error(err);
            }
            if (!this.isCurrent) {
                this.closeSupersededCatalog(catalogFileId);
                return;
            }
            if (catalogFileId === undefined) {
                this.report(WorkspaceItemKind.Catalog, description, `Could not load the catalog ${description}`);
                continue;
            }

            this.catalogIds.set(catalogInfo.id, catalogFileId);
            // The workspace is the authority on which catalog its own ID names.
            WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, catalogFileId, catalogInfo.id);
        }
    }

    /** Open one catalog the way the workspace says it was opened, re-running a query if that is what it was. */
    private *openCatalogSource(source: WorkspaceCatalogSource, targetFrameId: number | undefined): Generator<Promise<unknown>, number | undefined, any> {
        if (source.type === "file") {
            const fileId = yield* awaitedFlow<number | undefined>(this.appStore.appendCatalog(source.directory ?? "", source.filename, StreamingRowSource.INIT_TABLE_ROWS, targetFrameId));
            return typeof fileId === "number" ? fileId : undefined;
        }

        if (source.type === "simbad") {
            const {fileId} = yield* awaited(CatalogApiService.Instance.loadSimbadCatalog(source, targetFrameId));
            return fileId;
        }

        if (!source.table) {
            return undefined;
        }
        return (yield* awaited(CatalogApiService.Instance.loadVizierCatalogs(source, [source.table], targetFrameId)))[0];
    }

    /**
     * Stage 6: apply what each catalog was saved with, and bring its rows in line with it.
     *
     * One catalog is asked for at a time, in the order the workspace lists them. The backend answers
     * catalog requests one after another anyway, so sending them all at once would save nothing,
     * and a request left waiting behind the others could be given up on before its turn came.
     */
    private *configureCatalogs(): Generator<Promise<unknown>, void, any> {
        for (const catalogInfo of this.workspace.catalogs ?? []) {
            if (!this.isCurrent) {
                return;
            }
            const request = this.startCatalogConfig(catalogInfo);
            if (!request) {
                continue;
            }
            const {catalogFileId, description, rowFailure, completion} = request;
            try {
                const restoreResult = yield* awaited(completion);
                if (!this.isCurrent) {
                    return;
                }
                if (!restoreResult.didStart) {
                    this.report(WorkspaceItemKind.Catalog, description, rowFailure);
                } else if (!restoreResult.success) {
                    this.report(WorkspaceItemKind.Catalog, description, `${rowFailure}: ${restoreResult.message ?? "the data request failed"}`);
                } else {
                    this.restoreCatalogSelection(catalogInfo, catalogFileId, description);
                }
            } catch (err) {
                console.error(err);
                this.appStore.catalogStore.failRequest(catalogFileId, "The catalog restoration failed");
                this.report(WorkspaceItemKind.Catalog, description, rowFailure);
            }
        }
    }

    /** The columns the saved plots of one catalog are drawn from. */
    private plotColumnsOf(workspaceCatalogId: number): string[] {
        return Object.values(this.workspace.catalogWidgets ?? {})
            .flatMap(config => (isWidgetWorkspaceConfigOf(config, "catalog-plot") && config.catalogId === workspaceCatalogId ? [config.xColumnName, config.yColumnName, config.statisticColumnName] : []))
            .filter((columnName): columnName is string => typeof columnName === "string");
    }

    /**
     * Put one catalog's saved state back and ask the backend for the rows it names.
     *
     * @returns what the answer has to be judged against, or nothing when there is no answer coming.
     */
    private startCatalogConfig(catalogInfo: WorkspaceCatalog): CatalogConfigRequest | undefined {
        const catalogFileId = this.catalogIds.get(catalogInfo.id);
        if (catalogFileId === undefined) {
            return undefined;
        }
        const profileStore = this.appStore.catalogStore.catalogProfileStores.get(catalogFileId);
        const description = describeCatalogSource(catalogInfo.source);

        this.checkCatalogContent(catalogInfo, catalogFileId, description);

        if (catalogInfo.coordinateSystem !== undefined) {
            profileStore?.setCatalogCoordinateSystem(catalogInfo.coordinateSystem);
        }

        const imageOverlay = catalogInfo.displayConfig?.imageOverlay;
        const failure = imageOverlay ? `Could not draw the catalog ${description} over its image` : `Could not restore the rows of the catalog ${description}`;
        let shouldRestoreOverlay = true;
        let rowFailure = failure;
        try {
            // The table/query state is independent of the display state. Apply it even when a
            // display mapping is invalid, so a bad overlay cannot prevent valid rows from
            // being restored.
            profileStore?.applyTableConfig(catalogInfo.tableConfig);
            // A saved plot can be drawn from a column the table has since hidden. Its rows are asked
            // for with the table's, or the plot comes back empty; the column stays hidden.
            profileStore?.ensureColumnsRequested(this.plotColumnsOf(catalogInfo.id));

            if (catalogInfo.displayConfig) {
                const result = this.appStore.catalogStore.getCatalogDisplayStore(catalogFileId)?.applyConfig(catalogInfo.displayConfig);
                if (result && !result.success) {
                    this.report(WorkspaceItemKind.Catalog, description, `Could not restore how the catalog ${description} is drawn: ${result.errors.join("; ")}`);
                    shouldRestoreOverlay = false;
                    rowFailure = `Could not restore the rows of the catalog ${description}`;
                }
            }

            const completion = this.appStore.catalogStore.restoreCatalogFromWorkspace(catalogFileId, {
                overlay: shouldRestoreOverlay ? imageOverlay : undefined,
                selection: catalogInfo.selection,
                loadedRows: catalogInfo.tableConfig?.loadedRows
            });
            return {catalogFileId, description, rowFailure, completion};
        } catch (err) {
            console.error(err);
            this.appStore.catalogStore.failRequest(catalogFileId, "The catalog restoration failed");
            this.report(WorkspaceItemKind.Catalog, description, rowFailure);
            return undefined;
        }
    }

    private restoreCatalogSelection(catalogInfo: WorkspaceCatalog, catalogFileId: number, description: string): void {
        if (!catalogInfo.selection) {
            return;
        }
        const profileStore = this.appStore.catalogStore.catalogProfileStores.get(catalogFileId);
        const displayStore = this.appStore.catalogStore.getCatalogDisplayStore(catalogFileId);
        if (!profileStore) {
            return;
        }
        const selectionHeaders = catalogInfo.selection.columns.map(columnName => profileStore.catalogHeader.find(header => header.name === columnName));
        if (selectionHeaders.some(header => !header)) {
            this.report(WorkspaceItemKind.CatalogSelection, description, `Could not restore the selected rows of the catalog ${description}: one or more identifying columns are unavailable`);
            displayStore?.setShowSelectedData(false);
            return;
        }
        const selectionData = selectionHeaders.map(header => profileStore.rows.data.get(header?.columnIndex ?? NaN)?.data);
        const loadedRows = selectionData.length ? Math.min(...selectionData.map(data => data?.length ?? 0)) : 0;
        const availableRows = profileStore.rows.matchingRowCount;
        const requiredRows = Math.min(catalogInfo.selection.searchRows ?? loadedRows, availableRows);
        if (selectionData.some(data => !data) || loadedRows < requiredRows) {
            this.report(WorkspaceItemKind.CatalogSelection, description, `Could not restore the selected rows of the catalog ${description}: the identifying data was not fully loaded`);
            displayStore?.setShowSelectedData(false);
            return;
        }
        const selectedDataIndices = resolveCatalogSelection(profileStore.catalogHeader, profileStore.rows.data, catalogInfo.selection);
        if (!selectedDataIndices) {
            this.report(WorkspaceItemKind.CatalogSelection, description, `Could not restore the selected rows of the catalog ${description}: the identifying data was not fully loaded`);
            displayStore?.setShowSelectedData(false);
            return;
        }
        const selectedPointIndices = profileStore.rows.getOriginIndices(selectedDataIndices).filter(Number.isInteger);
        profileStore.setSelectedPointIndices(selectedPointIndices, false);
        displayStore?.setShowSelectedData(!!catalogInfo.selection.isShowingSelectedData && selectedPointIndices.length > 0);
        if (selectedPointIndices.length !== catalogInfo.selection.rowHashes.length) {
            this.report(
                WorkspaceItemKind.CatalogSelection,
                description,
                `Restored ${selectedPointIndices.length} of ${catalogInfo.selection.rowHashes.length} selected rows of the catalog ${description}; the other sources are no longer available`
            );
        }
    }

    /**
     * Report a catalog that is no longer the one that was saved. An online catalog is re-queried
     * rather than stored, and a file may have been rewritten, so this is a legitimate difference
     * rather than a failure.
     */
    private checkCatalogContent(catalogInfo: WorkspaceCatalog, catalogFileId: number, description: string): void {
        const profileStore = this.appStore.catalogStore.catalogProfileStores.get(catalogFileId);
        const rowCount = profileStore?.catalogInfo?.dataSize;
        if (catalogInfo.rowCount !== undefined && rowCount !== undefined && rowCount !== catalogInfo.rowCount) {
            this.report(WorkspaceItemKind.Catalog, description, `The catalog ${description} now has ${rowCount} rows instead of ${catalogInfo.rowCount}`);
            return;
        }

        // The same number of rows does not make them the same rows, so compare what the query
        // returned against the fingerprint taken when it was saved.
        if (catalogInfo.contentHash !== undefined && profileStore && !profileStore.isFileBasedCatalog) {
            if (hashCatalogContent(profileStore.catalogHeader, profileStore.rows.originalData) !== catalogInfo.contentHash) {
                this.report(WorkspaceItemKind.Catalog, description, `The catalog ${description} returned different data from the one that was saved`);
            }
        }
    }

    /**
     * Stage 7: put back the arrangement the workspace was saved in.
     *
     * Applied after the catalogs are loaded, so that the widgets and plots a layout brings back can
     * be bound to their catalogs as they are created rather than having to wait for them. A
     * workspace saved before layouts were part of one leaves the session's arrangement alone.
     */
    private restoreLayout(): void {
        const layout = this.workspace.layout;
        if (!layout) {
            return;
        }

        // The layout store validates and upgrades a copy before replacing the current widgets.
        if (!this.appStore.layoutStore.applyLayoutConfig(layout)) {
            this.report(WorkspaceItemKind.Layout, "", "Could not restore the layout the workspace was saved in");
        }
    }

    /**
     * Stage 8: point the widgets and plots at the catalogs, images and regions that were just
     * restored.
     *
     * Restore a profile, analysis or statistics widget in three steps. Point it at its image and
     * region, apply the rest of what it showed after it settles, and zoom it last. Pointing a
     * widget at another image resets what it shows. Changing what it shows resets its zoom.
     */
    private *restoreViews(): Generator<Promise<unknown>, void, any> {
        this.issues.push(...this.appStore.catalogStore.widgetBindings.restore(this.workspace.catalogWidgets, this.workspace.catalogs, this.catalogIds));
        this.issues.push(...this.appStore.widgetsStore.restorePlotWidgetBindings(this.workspace.plotWidgets, this));
        yield* awaited(Promise.resolve());
        if (!this.isCurrent) {
            return;
        }
        this.issues.push(...this.appStore.widgetsStore.restorePlotWidgets(this.workspace.plotWidgets, this));
        yield* awaited(Promise.resolve());
        if (!this.isCurrent) {
            return;
        }
        this.appStore.widgetsStore.restorePlotWidgetViews(this.workspace.plotWidgets);
    }

    public wasActiveImageRestored(): boolean {
        return this.workspace.selectedFile === undefined || this.frameIds.has(this.workspace.selectedFile);
    }

    /** Returns the file ID that a workspace image has in this session, or nothing when the image was not restored. */
    public fileIdOf(workspaceImageId: number): number | undefined {
        return this.frameIds.get(workspaceImageId);
    }

    /** Stage 9: settle the state that depends on everything else already being in place. */
    private settle(): void {
        // Sync up raster scaling once all images are loaded and configured
        if (this.appStore.rasterScalingReference) {
            this.appStore.rasterScalingReference.renderConfig.updateSiblings();
        }
    }

    /** The frame a workspace image ID now refers to, if it was restored. */
    private frameOf(workspaceFileId: number): FrameStore | undefined {
        const frameId = this.frameIds.get(workspaceFileId);
        return frameId === undefined ? undefined : this.appStore.frameMap.get(frameId);
    }
}
