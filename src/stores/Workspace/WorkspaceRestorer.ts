import {CARTA} from "carta-protobuf";
import {autorun, comparer, observable, reaction, runInAction} from "mobx";

import {AnimationMode, BeamType, FrequencyUnit, HipsCoord, HipsProjection, ImageType, PlayMode, RegionId, RegionOpacity, RestFrameShiftMode, SkyRefIs, VelocityConvention, WORKSPACE_DIALOGS, WorkspaceItemKind} from "enums";
import {
    describeCatalogSource,
    describeImageSource,
    GetIntensityOptions,
    isWidgetWorkspaceConfigOf,
    MOMENT_TEXT,
    SPECTRAL_MATCHING_TYPES,
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
import {AppStore, CatalogOnlineQueryConfigStore, type CatalogRestoreOutcome, type ColorBlendingStore, restoreWorkspaceZoom, StreamingRowSource} from "stores";
import {type FrameStore, LINE_REGION_SAMPLE_WIDTH_MAX, LINE_REGION_SAMPLE_WIDTH_MIN} from "stores/Frame";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";
import {awaited, awaitedFlow, hashCatalogContent, isValidRedshift, resolveCatalogSelection} from "utilities";

/** How long a restore waits for the backend to take on a region before making images over it anyway, in milliseconds. */
const REGION_HANDSHAKE_TIMEOUT = 10_000;

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
     * How many workspace loads have been started, so that a later one can take over from an earlier.
     * It is observable, so that a wait of an earlier load ends as soon as a later load starts.
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
    /** The requests for generated images the workspace carries, each with the images it made. */
    private readonly generatedImages: WorkspaceGeneratedImages[];
    /** Every image the workspace shows, opened or made again, by its workspace ID. */
    private readonly images = new Map<number, WorkspaceFile>();
    /** How each generated image is named to the user, by its workspace ID. */
    private readonly generatedImageNames = new Map<number, string>();
    /** The images moments have been made of again so far. */
    private readonly momentSources = new Set<FrameStore>();
    /** Images that name a reference that is a generated image not made yet, to be matched once it is. */
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
        this.restoreSpectralMatchingType();
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
        this.restoreContourDataSource();
        this.restoreAnimator();
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
        this.restoreDialogs();
        this.restoreWidgetSettings();
        this.restoreCursor();
        if (this.workspace.onlineCatalogQuery && typeof this.workspace.onlineCatalogQuery === "object") {
            // Apply the fields last. Choosing the image in front and freezing the cursor move the center of the dialog.
            CatalogOnlineQueryConfigStore.Instance.applyWorkspaceConfig(this.workspace.onlineCatalogQuery);
        }
        return this.issues;
    }

    /**
     * Freezes the cursor again where it was frozen, on the image in front, so that the cursor
     * profiles show that position. A cursor that was not frozen follows the mouse.
     */
    private restoreCursor(): void {
        const cursor = this.workspace.cursor;
        if (!cursor || typeof cursor.frozen !== "boolean") {
            return;
        }
        const position = cursor.position;
        const frame = this.appStore.activeFrame;
        if (cursor.frozen && frame && typeof position?.x === "number" && typeof position?.y === "number" && isFinite(position.x) && isFinite(position.y)) {
            frame.setCursorPosition(position);
            frame.updateCursorRegion(position);
        }
        this.appStore.setCursorFrozen(cursor.frozen);
    }

    /**
     * Opens the analysis dialogs that were open, and closes the other analysis dialogs. Open them
     * last, when the images and regions that they show are back.
     */
    private restoreDialogs(): void {
        const saved = this.workspace.openDialogs;
        if (!Array.isArray(saved)) {
            return;
        }
        const dialogStore = this.appStore.dialogStore;
        WORKSPACE_DIALOGS.filter(id => !saved.includes(id) && dialogStore.dialogVisible.get(id)).forEach(id => dialogStore.hideDialog(id));
        saved.filter(id => WORKSPACE_DIALOGS.includes(id)).forEach(id => dialogStore.showDialog(id));
    }

    /**
     * Opens the settings panels of widgets that were open, where they were, and closes the other
     * floating settings panels. Open them after the layout, when the widgets are back.
     */
    private restoreWidgetSettings(): void {
        const saved = this.workspace.openWidgetSettings;
        if (!Array.isArray(saved)) {
            return;
        }
        const widgetsStore = this.appStore.widgetsStore;
        widgetsStore.floatingWidgets.filter(config => config.type === "floating-settings").forEach(config => widgetsStore.removeFloatingWidget(config.id));
        const isPlaced = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
        for (const panel of saved) {
            if (!panel || typeof panel.widgetId !== "string" || typeof panel.widgetType !== "string" || typeof panel.title !== "string") {
                continue;
            }
            const parentId = widgetsStore.layoutIdOf(panel.widgetType, panel.widgetId);
            if (parentId === undefined) {
                this.report(WorkspaceItemKind.Layout, panel.title, "The settings panel of this widget was not opened, because the widget was not restored");
                continue;
            }
            widgetsStore.createFloatingSettingsWidget(panel.title, parentId, panel.widgetType);
            const config = widgetsStore.floatingWidgets.find(w => w.type === "floating-settings" && w.parentId === parentId);
            if (config && isPlaced(panel.x) && isPlaced(panel.y)) {
                config.setDefaultPosition(panel.x, panel.y);
            }
            if (config && isPlaced(panel.width) && isPlaced(panel.height) && panel.width > 0 && panel.height > 0) {
                config.setDefaultSize(panel.width, panel.height);
            }
        }
    }

    /**
     * Applies the settings of the animator, and the channels that it plays of each image. Do this
     * after the images open. Opening an image chooses what the animator steps through.
     */
    private restoreAnimator(): void {
        const isInteger = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);
        for (const fileInfo of this.workspace.files ?? []) {
            const frame = this.frameOf(fileInfo.id);
            const range = fileInfo.animationChannelRange;
            const depth = frame?.frameInfo.fileInfoExtended?.depth ?? 1;
            if (frame && Array.isArray(range) && range.length === 2 && range.every(isInteger) && range[0] >= 0 && range[0] <= range[1] && range[1] < depth) {
                frame.setAnimationRange([range[0], range[1]]);
            }
        }
        const saved = this.workspace.animator;
        if (!saved || typeof saved !== "object") {
            return;
        }
        const animator = this.appStore.animatorStore;
        if (isInteger(saved.frameRate) && saved.frameRate >= animator.minFrameRate && saved.frameRate <= animator.maxFrameRate) {
            animator.setFrameRate(saved.frameRate);
        }
        if (isInteger(saved.step) && saved.step >= animator.minStep && saved.step <= animator.maxStep) {
            animator.setStep(saved.step);
        }
        if (Object.values(PlayMode).includes(saved.playMode)) {
            animator.setPlayMode(saved.playMode);
        }
        if (Object.values(AnimationMode).includes(saved.mode) && saved.mode !== AnimationMode.NONE) {
            animator.setAnimationMode(saved.mode);
        }
    }

    /**
     * Shows in the Contour dialog the image that it showed, when it did not follow the active image.
     * Do this after the image in front is chosen. A change of the image in front changes the image of
     * the dialog while the dialog follows it.
     */
    private restoreContourDataSource(): void {
        const imageId = this.workspace.contourDataSource?.imageId;
        if (typeof imageId !== "number") {
            return;
        }
        const frame = this.frameOf(imageId);
        if (frame) {
            this.appStore.setContourDataSourceUnlocked(frame);
        } else {
            this.report(WorkspaceItemKind.Image, "", "The Contour dialog follows the active image, because the image that it showed was not restored");
        }
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

    /**
     * Sets the spectral coordinate that spectrally matched images are matched by. Set it before the
     * images are matched, as matching an image moves it to the channel of its reference in this
     * coordinate. A workspace saved before it kept this setting keeps the setting of the session.
     */
    private restoreSpectralMatchingType(): void {
        const type = this.workspace.spectralMatchingType;
        if (type === undefined) {
            return;
        }
        if (SPECTRAL_MATCHING_TYPES.includes(type)) {
            this.appStore.setSpectralMatchingType(type);
        } else {
            this.report(WorkspaceItemKind.Image, "spectral matching", `Could not restore the spectral matching type ${String(type)}: it is not one this version knows, so images are matched by ${this.appStore.spectralMatchingType}`);
        }
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

    /** Take an image just opened or made again as the one the workspace names by its ID. */
    private adoptImage(fileInfo: WorkspaceFile, frame: FrameStore): void {
        this.frameIds.set(fileInfo.id, frame.frameInfo.fileId);
        // The workspace is the authority on which image its own ID names.
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Image, frame.frameInfo.fileId, fileInfo.id);

        frame.setChannels(fileInfo.channel ?? 0, fileInfo.stokes ?? 0, false);

        // References have to be in place before any image can be matched against them.
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
     * Stage 2b: query each HiPS image again. A query depends on nothing else in the session, so it
     * is made with the images that are opened.
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
                this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject} again: the query is not one this version can read`);
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
                this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject} again`);
                continue;
            }
            this.adoptImage(images[0], frame);
        }
    }

    /** The query a saved HiPS request makes, or nothing if it is not one this version can make. */
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

    /** How a request is named to the user. */
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
     * Stage 3: apply what each image is displayed with, once it exists: every image opened, then
     * those each request makes again as it makes them.
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
     * Match an image to the reference it was matched to, if it named one.
     *
     * A workspace that names no reference -- because the session's own was an image it could not
     * save -- matches nothing, rather than every image that named none, and an image is not matched
     * to whichever image stands in for a reference that did not come back. A reference made again by
     * a request is not there yet when the images opened are configured, so those wait for it.
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
     * Stage 3b: make the moment and PV images again, in the order they were saved in, each from its
     * image and over its region as restored. A request can be made of an image or over a region of
     * one an earlier request made, so each request's images are configured before the next is made.
     */
    private *generateImages(regions: Promise<unknown>): Generator<Promise<unknown>, void, any> {
        const requests = this.generatedImages.filter(({request}) => request.type === "moment" || request.type === "pv");
        if (!requests.length) {
            return;
        }
        // A request is made over a region by the ID the backend gave it.
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
     * @returns the images it made, none when it could not be made or was skipped.
     */
    private *makeImagesAgain({request}: WorkspaceGeneratedImages): Generator<Promise<unknown>, FrameStore[], any> {
        if (request.type !== "moment" && request.type !== "pv") {
            return [];
        }
        const sourceInfo = this.images.get(request.sourceImageId);
        const subject = WorkspaceRestorer.describeRequest(request, sourceInfo ? this.nameOf(sourceInfo) : "an image");
        const source = this.frameOf(request.sourceImageId);
        if (!source) {
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject} again: the image it is made from was not restored`);
            return [];
        }
        const regionId = typeof request.regionId === "number" ? this.regionIdOf(request.sourceImageId, request.regionId) : undefined;
        if (regionId === undefined) {
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject} again: the region it is made over was not restored`);
            return [];
        }

        let outcome: FrameStore[] | "skipped" | undefined;
        if (request.type === "moment") {
            // The first request of an image replaces nothing; a later one keeps the images the earlier
            // ones made. The backend numbers the names of kept images, as it did when they were made.
            const message = WorkspaceRestorer.momentMessageOf(request, source, regionId, this.momentSources.has(source));
            this.momentSources.add(source);
            if (message && regionId > RegionId.CURSOR) {
                yield* awaited(this.introduceRegionToBackend(source, regionId));
                if (!this.isCurrent) {
                    return [];
                }
            }
            if (message) {
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
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject} again: the request is not one this version can make`);
            return [];
        }
        if (outcome === "skipped") {
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Skipped making ${subject} again`);
            return [];
        }
        if (!outcome.length) {
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject} again`);
        }
        return outcome;
    }

    /**
     * Get the backend ready to make moments over a region of an image.
     *
     * The backend makes moments over a region only of an image whose region data it already keeps,
     * which it starts doing the first time a widget asks it for a region's statistics, histogram or
     * profile. In a session some widget has always asked by then; during a restore none has yet, and
     * the request fails. So ask for one statistic of the region, wait for it to come back, and take
     * the request back. The backend handles requests out of order, so sending the request alone is
     * not enough: the moments could be asked for before it is taken on.
     */
    private introduceRegionToBackend(frame: FrameStore, regionId: number): Promise<void> {
        const backendService = BackendService.Instance;
        const fileId = frame.frameInfo.fileId;
        return new Promise<void>(resolve => {
            let isDone = false;
            const finish = () => {
                if (isDone) {
                    return;
                }
                isDone = true;
                clearTimeout(timer);
                subscription.unsubscribe();
                backendService.setStatsRequirements({fileId, regionId, statsConfigs: []});
                resolve();
            };
            const subscription = backendService.statsStream.subscribe(stats => {
                if (stats?.fileId === fileId && stats.regionId === regionId) {
                    finish();
                }
            });
            const timer = setTimeout(finish, REGION_HANDSHAKE_TIMEOUT);
            backendService.setStatsRequirements({fileId, regionId, statsConfigs: [{coordinate: "z", statsTypes: [CARTA.StatsType.NumPixels]}]});
        });
    }

    /** The request a saved moment request makes, or nothing if it is not one this version can make. */
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

    /** The request a saved PV request makes, or nothing if it is not one this version can make. */
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
     * Wait for a request that makes images, showing its progress and letting the user skip it.
     *
     * Skipping asks the backend to stop, but does not wait for it to: the restore carries on at once,
     * and images that still arrive for a skipped request are closed without being shown.
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
            // A skipped request's images are closed before they are shown; this catches any that are not.
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
     * Take the images a request made again as the ones the workspace names, by which moment each is
     * when the request made several.
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
                    this.report(WorkspaceItemKind.Image, imageName, `Could not make the image ${imageName} again`);
                }
                continue;
            }
            this.adoptImage(image, frame);
            // A moment image is matched to the image it was made of on its own; one saved unmatched stays so.
            if (frame.spatialReference && image.references?.spatial === undefined) {
                this.appStore.setSpatialMatchingEnabled(frame, false);
            }
            adopted.push(image);
        }
        // Images the workspace does not show are not left in the session.
        unclaimed.forEach(frame => this.closeSupersededImage(frame));

        // Images that wait for one of these as their reference are matched now.
        const pending = this.pendingMatches.splice(0);
        for (const match of pending) {
            this.matchImage(match.frame, match.fileInfo, match.kind);
        }
        return adopted;
    }

    /**
     * The image the session is left with in front: the one saved there, or else the first restored.
     * The images a request made again were each put in front as they arrived.
     */
    private chooseFrontImage(): void {
        // The image saved in front may not be back: it could not be opened or made again, or it was a
        // generated image the workspace does not carry. A session with images open has one in front.
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
                // A solid region is saved with no dashes. Make it solid again. Otherwise it keeps the
                // dash length of the preferences.
                if (Array.isArray(regionInfo.dashes) && regionInfo.dashes.length === 0) {
                    region.setDashLength(0);
                }
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
        // Select again the regions that were selected together, with the focused region in focus.
        const selectedRegions = fileInfo.regionsSet.selectedRegions;
        if (Array.isArray(selectedRegions) && selectedRegions.length > 1) {
            const ids = selectedRegions.flatMap(savedId => (typeof savedId === "number" && regionIds.has(savedId) ? [regionIds.get(savedId) as number] : []));
            frame.regionSet.setSelectionByIds(ids, selectedRegion === undefined ? undefined : regionIds.get(selectedRegion));
        }
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
     * Wait for the cube histogram of an image, and return how the wait ends: "complete" when the
     * histogram is complete, "closed" when the image is closed (a later workspace load closes every
     * image), "superseded" when a later workspace load starts, or "skipped" when the user skips it.
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
            // Hide the layers that were hidden. A new color-blended image shows all of them.
            const saved = this.workspace.colorBlendingImages.find(blend => blend.imageListIndex === imageListIndex);
            if (saved?.rasterVisible === false && colorBlending?.isRasterVisible) {
                colorBlending.toggleRasterVisible();
            }
            if (saved?.contourVisible === false && colorBlending?.isContourVisible) {
                colorBlending.toggleContourVisible();
            }
            if (saved?.vectorOverlayVisible === false && colorBlending?.isVectorOverlayVisible) {
                colorBlending.toggleVectorOverlayVisible();
            }

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
     * Applied after the catalogs are loaded, so that each catalog widget that the layout creates
     * starts on a loaded catalog. Stage 8 then points each widget at the catalog it was saved with. A
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
