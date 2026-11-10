import {CARTA} from "carta-protobuf";
import {isEqual} from "lodash";
import {autorun, comparer, observable, reaction, runInAction} from "mobx";

import {
    AnimationMode,
    BeamType,
    CatalogDatabase,
    FrequencyUnit,
    HipsCoord,
    HipsProjection,
    ImageType,
    PlayMode,
    RegionId,
    RegionOpacity,
    RestFrameShiftMode,
    SkyRefIs,
    VelocityConvention,
    WORKSPACE_DIALOGS,
    WorkspaceIssueEffect,
    WorkspaceIssueOutcome,
    WorkspaceItemKind
} from "enums";
import {
    describeCatalogSource,
    describeImageSource,
    GetIntensityOptions,
    isWidgetWorkspaceConfigOf,
    MOMENT_TEXT,
    type Point2D,
    SOME_IMAGES_NOT_RESTORED,
    SPECTRAL_MATCHING_TYPES,
    type Workspace,
    type WorkspaceCatalog,
    type WorkspaceCatalogFileSource,
    type WorkspaceCatalogSource,
    type WorkspaceFile,
    type WorkspaceFileImageSource,
    type WorkspaceFittingRequest,
    type WorkspaceGeneratedFile,
    type WorkspaceGeneratedImages,
    type WorkspaceGenerationRequest,
    type WorkspaceHipsRequest,
    type WorkspaceIdReader,
    type WorkspaceImageSource,
    type WorkspaceIssue,
    type WorkspaceMomentRequest,
    type WorkspacePvRequest
} from "models";
import {BackendService, CatalogApiService, MirrorTimeoutError} from "services";
import {AppStore, CatalogOnlineQueryConfigStore, type CatalogRestoreOutcome, type ColorBlendingStore, MirrorSiteStore, restoreWorkspaceZoom, StreamingRowSource, type WorkspaceLoadingStep} from "stores";
import {type FrameStore, LINE_REGION_SAMPLE_WIDTH_MAX, LINE_REGION_SAMPLE_WIDTH_MIN} from "stores/Frame";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";
import {type WorkspaceFileLocation, WorkspaceRecoveryAction, type WorkspaceRecoveryChoice, type WorkspaceRecoveryItem, WorkspaceRecoveryStore} from "stores/Workspace/WorkspaceRecoveryStore";
import {awaited, awaitedFlow, hashCatalogContent, isValidRedshift, resolveCatalogSelection} from "utilities";

/** Returns the host of a URL, such as "simbad.u-strasbg.fr", or the whole URL when it cannot be parsed. */
function hostOf(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

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

/** The result of one attempt to open or make an item of a stage. */
type TaskOutcome =
    /** The item is open, or it is reported and the user cannot do anything about it. */
    | "done"
    /** The item waits for an image that another item of the stage makes after Recovery. */
    | "deferred"
    /** The item failed, and the user can retry it, choose a new file for it or skip it. */
    | WorkspaceRecoveryItem;

/** One item of a stage: an image, a catalog or a request that makes images. */
interface RestoreTask {
    /** Returns how the item is named to the user. A new location changes the name. */
    subject(): string;
    /** The workspace IDs of the images that the item opens or makes. */
    imageIds: number[];
    /** The workspace IDs of the catalogs that the item opens. */
    catalogIds?: number[];
    /** Tries to open or make the item once. */
    attempt(): Generator<Promise<unknown>, TaskOutcome, any>;
    /** Uses the file that the user chose for the next attempt. */
    repoint?(location: WorkspaceFileLocation): void;
}

/** The files that the user chose during a restore, for the images and catalogs that opened from them. */
export interface WorkspaceRepointedSources {
    /** The saved source and the new source of each image, by its workspace ID. */
    images: Map<number, {from: WorkspaceImageSource | undefined; to: WorkspaceFileImageSource}>;
    /** The saved source and the new source of each catalog, by its workspace ID. */
    catalogs: Map<number, {from: WorkspaceCatalogSource; to: WorkspaceCatalogFileSource}>;
}

/** Returns "1 region" or "3 regions". */
function countOf(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Returns why a load failed, as the backend or the request says it, without the final period. For
 * example, "File /data/cube.fits does not exist".
 */
function reasonOf(err: unknown): string | undefined {
    const text = (err instanceof Error ? err.message : String(err ?? "")).trim().replace(/\.$/, "");
    return text || undefined;
}

/** Throws the reason for an online catalog query that answered with no sources, for the report. */
function noSources(): never {
    throw new Error("the query found no sources");
}

/** Adds the reason to a sentence that reports a failure, when the reason is known. */
function withReason(sentence: string, reason: string | undefined): string {
    return reason ? `${sentence}: ${reason}` : sentence;
}

/** Returns the text with its first letter in upper case, such as "The moment images of cube.fits". */
function capitalized(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
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

    /**
     * Returns a copy of a stored workspace, with the sources of the images and catalogs that the
     * user chose new files for. Everything else is kept as stored.
     *
     * Change a source only while the stored workspace still has the source that the restore started
     * from. The workspace may have been saved again since then, and an ID may then name another
     * file. Returns undefined when no source can be changed.
     */
    public static withRepointedSources(workspace: Workspace, repointed: WorkspaceRepointedSources): Workspace | undefined {
        let changes = 0;
        const files = workspace.files?.map(fileInfo => {
            const repoint = repointed.images.get(fileInfo.id);
            if (!repoint || !isEqual(fileInfo.source, repoint.from)) {
                return fileInfo;
            }
            changes++;
            const source = repoint.to;
            // Drop the location fields of workspaces written before version 2, so that they do not
            // name the old file next to the new source.
            const patched: WorkspaceFile = {...fileInfo, source};
            delete patched.directory;
            delete patched.filename;
            delete patched.hdu;
            return patched;
        });
        const catalogs = workspace.catalogs?.map(catalogInfo => {
            const repoint = repointed.catalogs.get(catalogInfo.id);
            if (!repoint || !isEqual(catalogInfo.source, repoint.from)) {
                return catalogInfo;
            }
            changes++;
            return {...catalogInfo, source: repoint.to};
        });
        return changes ? {...workspace, ...(files && {files}), ...(catalogs && {catalogs})} : undefined;
    }

    /** One entry per item that could not be brought back as saved. */
    private readonly issues: WorkspaceIssue[] = [];
    /** Workspace image ID to the file ID this session gave it. */
    private readonly frameIds = new Map<number, number>();
    /** Workspace catalog ID to the file ID this session gave it. */
    private readonly catalogIds = new Map<number, number>();
    /** The Workspace ID of the first catalog whose query a mirror did not answer, by the URL of the mirror. */
    private readonly timedOutCatalogIds = new Map<string, number>();
    /**
     * The mirrors whose online catalog query failed in this restore, by URL. The number is the
     * round of the latest failure. A larger number means a later round.
     */
    private readonly failedMirrorRounds = new Map<string, number>();
    /** The number of rounds of the catalog stage so far. */
    private catalogRound = 0;
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
    /** The images that moment images have been made from so far. */
    private readonly momentSources = new Set<FrameStore>();
    /** The workspace IDs of the images that the user skipped, and of the images made from them. */
    private readonly skippedImageIds = new Set<number>();
    /** The workspace IDs of the images that Recovery may still open. These are the images of the failed and the deferred items. */
    private readonly awaitedImageIds = new Set<number>();
    /** The files that the user chose, for the images and catalogs that opened from them. */
    public readonly repointed: WorkspaceRepointedSources = {images: new Map(), catalogs: new Map()};
    /** The steps that the restore waits for at the same time, in the order that they started. */
    private readonly waitingSteps: {step?: WorkspaceLoadingStep}[] = [];
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
        WorkspaceRestorer.clearSession();
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
        // The backend registers the regions while the images are configured. Moment and PV images
        // wait for the regions. The cube histograms are computed while the catalogs open. The
        // restore waits for both before it applies the layout.
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
        this.showProgress("Finishing the images");
        yield* awaited(cubeHistograms);
        yield* awaited(regions);
        if (!this.isCurrent) {
            return this.issues;
        }
        this.showProgress("Restoring the layout and widgets");
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

    /**
     * Report something that could not be brought back, naming what it was about.
     *
     * @param outcome - why the item is not in the session at all. Leave it out when the item is in
     *                  the session, but not as it was saved.
     */
    private report(kind: WorkspaceItemKind, subject: string, message: string, outcome?: WorkspaceIssueOutcome, details?: Pick<WorkspaceIssue, "label" | "reason" | "imageIds" | "causeImageId" | "catalogIds" | "causeCatalogId">): void {
        this.issues.push({kind, subject, message, outcome, ...details});
    }

    /**
     * Stage 1: put the session back to an empty state for the workspace to be restored into.
     * Cancelling a load does the same, to close what the load has opened so far.
     */
    public static clearSession(): void {
        const appStore = AppStore.Instance;
        CatalogApiService.Instance.cancelPendingQueries("The online catalog query was given up on to open a workspace");
        appStore.catalogStore.interruptRequests("The previous workspace restore was interrupted");
        appStore.animatorStore.stopAnimation();
        appStore.tileService.clearRequestQueue();
        appStore.removeAllFrames();
    }

    /**
     * Start a step that the restore waits for, and return how to show and end it.
     *
     * Steps can overlap. For example, a cube histogram is computed while an online catalog query
     * runs. The dialog shows the step that started last, with its Skip. When that step ends, the
     * dialog shows the step before it again. A step that ends does not remove the step of another
     * wait.
     */
    private startStep(): {show: (step: WorkspaceLoadingStep) => void; end: () => void} {
        const entry: {step?: WorkspaceLoadingStep} = {};
        this.waitingSteps.push(entry);
        const update = () => {
            // A later load owns the dialog. It shows its own steps.
            if (this.isCurrent) {
                const shown = [...this.waitingSteps].reverse().find(waiting => waiting.step);
                this.appStore.setWorkspaceLoadingStep(shown?.step);
            }
        };
        return {
            show: step => {
                if (this.waitingSteps.includes(entry)) {
                    entry.step = step;
                    update();
                }
            },
            end: () => {
                const index = this.waitingSteps.indexOf(entry);
                if (index >= 0) {
                    this.waitingSteps.splice(index, 1);
                    update();
                }
            }
        };
    }

    /** Show the user the stage that this restore is in, and the item of the stage that it is on. */
    private showProgress(stage: string, index?: number, count?: number, item?: string): void {
        if (this.isCurrent) {
            this.appStore.setWorkspaceRestoreProgress({stage, index, count, item});
        }
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
        yield* this.runStage(
            "Opening images",
            (this.workspace.files ?? []).map(fileInfo => this.imageTask(fileInfo))
        );
        this.putImagesInSavedOrder();
    }

    /**
     * Puts the opened images in the order that the workspace saved them in. An image that opens
     * after a retry or from a new file is added after the other images, so move it back to its
     * saved place.
     */
    private putImagesInSavedOrder(): void {
        if (!this.isCurrent) {
            return;
        }
        const imageList = this.appStore.imageViewConfigStore;
        const fileIds = (this.workspace.files ?? []).map(fileInfo => this.frameIds.get(fileInfo.id)).filter((fileId): fileId is number => fileId !== undefined);
        const indexes = fileIds.map(fileId => imageList.getImageListIndex(ImageType.FRAME, fileId)).filter(index => index >= 0);
        // The images of this restore take the places from the first of them on.
        let place = Math.min(...indexes);
        for (const fileId of fileIds) {
            const index = imageList.getImageListIndex(ImageType.FRAME, fileId);
            if (index < 0) {
                continue;
            }
            if (index !== place) {
                this.appStore.reorderFrame(index, place, 1);
            }
            place++;
        }
    }

    /** Returns the task that opens one image, from its saved source or from the file the user chooses. */
    private imageTask(fileInfo: WorkspaceFile): RestoreTask {
        const state = {source: fileInfo.source, isRepointed: false};
        return {
            subject: () => describeImageSource(state.source),
            imageIds: [fileInfo.id],

            attempt: () => this.attemptImage(fileInfo, state),
            repoint: ({directory, filename, hdu}) => {
                state.source = {type: "file", directory, filename, hdu};
                state.isRepointed = true;
            }
        };
    }

    private *attemptImage(fileInfo: WorkspaceFile, state: {source: WorkspaceImageSource | undefined; isRepointed: boolean}): Generator<Promise<unknown>, TaskOutcome, any> {
        const {source} = state;
        // The workspace names the image by its saved file, also after the user chose another file.
        const subject = describeImageSource(fileInfo.source);
        const tried = state.isRepointed ? ` from ${describeImageSource(source)}` : "";
        if (!source || !["file", "lel", "hypercube"].includes(source.type)) {
            const reason = "the source is not one this version can open";
            this.report(WorkspaceItemKind.Image, subject, `Could not open the image ${subject}: ${reason}`, WorkspaceIssueOutcome.Failed, {label: `The image ${subject}`, reason, imageIds: [fileInfo.id]});
            return "done";
        }
        let frame: FrameStore | undefined;
        let reason: string | undefined;
        try {
            frame = (yield* this.openImageSource(source)) ?? undefined;
        } catch (err) {
            console.error(err);
            reason = reasonOf(err);
        }
        // Check again here, not only before the attempt. The image finished opening while this
        // restore was suspended. A load that started in the meantime may own the session now.
        if (!this.isCurrent) {
            this.closeSupersededImage(frame);
            return "done";
        }
        if (!frame) {
            return {
                kind: WorkspaceItemKind.Image,
                subject,
                message: withReason(`Could not open the image ${subject}${tried}`, reason),
                label: `The image ${subject}${tried}`,
                reason,
                repointKind: source?.type === "file" ? "image" : undefined,
                canRetry: source?.type !== "file",
                dependents: this.dependentsOfImages([fileInfo.id])
            };
        }
        if (state.isRepointed && source?.type === "file") {
            this.repointed.images.set(fileInfo.id, {from: fileInfo.source, to: source});
        }
        this.adoptImage(fileInfo, frame);
        return "done";
    }

    /**
     * Run the items of a stage, then let the user choose what to do with the items that failed.
     * Run the items that the user retries or chooses a new file for again, and ask again for the
     * items that fail again. The stage ends when no item is left to run.
     *
     * @param startRound - starts what the attempts of one round share, such as the memory of the
     * mirrors that timed out. It returns the function that ends it.
     */
    private *runStage(stage: string, tasks: RestoreTask[], startRound?: () => () => void): Generator<Promise<unknown>, void, any> {
        let pending = tasks;
        while (pending.length) {
            const failed: {task: RestoreTask; item: WorkspaceRecoveryItem}[] = [];
            const deferred: RestoreTask[] = [];
            const endRound = startRound?.();
            try {
                for (const [index, task] of pending.entries()) {
                    if (!this.isCurrent) {
                        return;
                    }
                    this.showProgress(stage, index + 1, pending.length, task.subject());
                    const outcome = yield* task.attempt();
                    if (!this.isCurrent) {
                        return;
                    }
                    if (outcome === "deferred") {
                        // The images of a deferred item are awaited too. An item made from them waits as well.
                        task.imageIds.forEach(id => this.awaitedImageIds.add(id));
                        deferred.push(task);
                    } else if (outcome === "done") {
                        task.imageIds.forEach(id => this.awaitedImageIds.delete(id));
                    } else {
                        task.imageIds.forEach(id => this.awaitedImageIds.add(id));
                        failed.push({task, item: outcome});
                    }
                }
            } finally {
                endRound?.();
            }
            if (!failed.length) {
                // An item is deferred only while it waits for an image of an item that failed in this
                // round. With no failure, no item waits any more. Run the deferred items again, so
                // that the stage ends.
                this.awaitedImageIds.clear();
                pending = deferred;
                continue;
            }
            const choices = yield* this.askUser(
                stage,
                failed.map(({item}) => item)
            );
            if (!this.isCurrent) {
                return;
            }
            pending = [];
            choices.forEach((choice, index) => {
                const {task, item} = failed[index];
                if (choice.action === WorkspaceRecoveryAction.Skip) {
                    task.imageIds.forEach(id => {
                        this.awaitedImageIds.delete(id);
                        this.skippedImageIds.add(id);
                    });
                    this.report(item.kind, item.subject, item.message, WorkspaceIssueOutcome.Skipped, {
                        label: item.label,
                        reason: item.reason,
                        imageIds: task.imageIds,
                        catalogIds: task.catalogIds,
                        causeCatalogId: item.causeCatalogId
                    });
                    return;
                }
                if (choice.action === WorkspaceRecoveryAction.Repoint) {
                    task.repoint?.(choice.location);
                }
                pending.push(task);
            });
            // Run the deferred items after the items that they wait for.
            pending.push(...deferred);
        }
    }

    /**
     * Show the user the items of a stage that failed, and wait for a choice for each item.
     *
     * A cancelled or superseded restore does not wait. Every item is then skipped, and the caller
     * sees that the restore no longer owns the session.
     */
    private *askUser(stage: string, items: WorkspaceRecoveryItem[]): Generator<Promise<unknown>, WorkspaceRecoveryChoice[], any> {
        const recovery = new WorkspaceRecoveryStore(stage, items);
        this.appStore.setWorkspaceRecovery(recovery);
        const disposeReaction = reaction(
            () => this.isCurrent,
            isCurrent => !isCurrent && recovery.abandon(),
            {fireImmediately: true}
        );
        try {
            return yield* awaited(recovery.decided);
        } finally {
            disposeReaction();
            if (this.appStore.workspaceRecovery === recovery) {
                this.appStore.setWorkspaceRecovery(undefined);
            }
        }
    }

    /**
     * Returns what the restore leaves out with the images, when the user skips them. For example,
     * "2 regions" or "the catalog sources.vot".
     */
    private dependentsOfImages(imageIds: number[]): string[] {
        const ids = new Set(imageIds);
        const dependents: string[] = [];
        for (const id of imageIds) {
            const fileInfo = this.images.get(id);
            const regionCount = (fileInfo?.regionsSet?.regions ?? []).filter(region => region.id > RegionId.CURSOR).length;
            if (regionCount) {
                dependents.push(countOf(regionCount, "region"));
            }
            if (fileInfo?.contourConfig) {
                dependents.push(`the contours of ${this.nameOf(fileInfo)}`);
            }
            if (fileInfo?.vectorOverlayConfig) {
                dependents.push(`the vector overlay of ${this.nameOf(fileInfo)}`);
            }
        }
        for (const catalog of this.workspace.catalogs ?? []) {
            if (catalog.associatedImageId !== undefined && ids.has(catalog.associatedImageId)) {
                dependents.push(`the catalog ${describeCatalogSource(catalog.source)}`);
            }
        }
        for (const {request} of this.generatedImages) {
            if (request.type !== "hips" && ids.has(request.sourceImageId)) {
                dependents.push(this.subjectOf(request));
            }
        }
        for (const kind of ["spatial", "spectral", "raster"] as const) {
            const referenceId = this.workspace.references?.[kind];
            if (referenceId === undefined || !ids.has(referenceId)) {
                continue;
            }
            for (const fileInfo of this.allImages) {
                if (!ids.has(fileInfo.id) && fileInfo.references?.[kind] === referenceId) {
                    dependents.push(`the ${kind} matching of ${this.nameOf(fileInfo)}`);
                }
            }
        }
        const blendings = (this.workspace.colorBlendingImages ?? []).filter(blending => blending.selectedFrameId?.some(id => ids.has(id))).length;
        if (blendings) {
            dependents.push(`its place in ${countOf(blendings, "color-blended image")}`);
        }
        return dependents;
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
     * Stage 2b: query each HiPS image again, after the file images are open. A HiPS query does not
     * depend on any other data in the session.
     */
    private *openHipsImages(): Generator<Promise<unknown>, void, any> {
        const hipsImages = this.generatedImages.filter((generated): generated is WorkspaceGeneratedImages & {request: WorkspaceHipsRequest} => generated.request.type === "hips" && generated.images.length > 0);
        yield* this.runStage(
            "Opening HiPS images",
            hipsImages.map(generated => ({
                subject: () => WorkspaceRestorer.describeRequest(generated.request, ""),
                imageIds: [generated.images[0].id],
                attempt: () => this.attemptHipsImage(generated)
            }))
        );
    }

    private *attemptHipsImage({request, images}: WorkspaceGeneratedImages & {request: WorkspaceHipsRequest}): Generator<Promise<unknown>, TaskOutcome, any> {
        const subject = WorkspaceRestorer.describeRequest(request, "");
        const query = WorkspaceRestorer.hipsQueryOf(request);
        if (!query) {
            const reason = "the query is not one this version can read";
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject}: ${reason}`, WorkspaceIssueOutcome.Failed, {label: capitalized(subject), reason, imageIds: [images[0].id]});
            return "done";
        }
        let frame: FrameStore | undefined;
        let reason: string | undefined;
        try {
            frame = (yield* awaitedFlow<FrameStore | undefined | 0>(this.appStore.loadRemoteFile(query))) || undefined;
        } catch (err) {
            console.error(err);
            reason = reasonOf(err);
        }
        if (!this.isCurrent) {
            this.closeSupersededImage(frame);
            return "done";
        }
        if (!frame) {
            return {
                kind: WorkspaceItemKind.GeneratedImage,
                subject,
                message: withReason(`Could not make ${subject}`, reason),
                label: capitalized(subject),
                reason,
                canRetry: true,
                dependents: this.dependentsOfImages([images[0].id])
            };
        }
        this.adoptImage(images[0], frame);
        return "done";
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

    /** Returns the name of a saved request, as shown to the user, with the image that it is made from. */
    private subjectOf(request: WorkspaceGenerationRequest): string {
        if (request.type === "hips") {
            return WorkspaceRestorer.describeRequest(request, "");
        }
        const sourceInfo = this.images.get(request.sourceImageId);
        return WorkspaceRestorer.describeRequest(request, sourceInfo ? this.nameOf(sourceInfo) : "an image");
    }

    /** Returns the name of a request, as shown to the user. */
    private static describeRequest(request: WorkspaceGenerationRequest, sourceName: string): string {
        switch (request.type) {
            case "moment":
                return `the moment images of ${sourceName}`;
            case "pv":
                return `the PV image of ${sourceName}`;
            case "fitting":
                return `the image fitting images of ${sourceName}`;
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
     * image and over its restored region. A request that is retried, or that waits for its image,
     * runs after the others. A request can use an image, or a region on an image, that
     * an earlier request made. So configure the images of each request before the next request is
     * made.
     */
    private *generateImages(regions: Promise<unknown>): Generator<Promise<unknown>, void, any> {
        const requests = this.generatedImages.filter(({request}) => request.type === "moment" || request.type === "pv" || request.type === "fitting");
        if (!requests.length) {
            return;
        }
        // Make the request over the region by the ID that the backend gave the region.
        yield* awaited(regions);
        yield* this.runStage(
            "Making generated images",
            requests.map(generated => ({
                subject: () => this.subjectOf(generated.request),
                imageIds: generated.images.map(image => image.id),
                attempt: () => this.attemptGeneratedImages(generated)
            }))
        );
    }

    private *attemptGeneratedImages(generated: WorkspaceGeneratedImages): Generator<Promise<unknown>, TaskOutcome, any> {
        const outcome = yield* this.makeImagesAgain(generated);
        if (!this.isCurrent) {
            if (Array.isArray(outcome)) {
                outcome.forEach(frame => this.closeSupersededImage(frame));
            }
            return "done";
        }
        if (outcome === "deferred") {
            return "deferred";
        }
        if (!Array.isArray(outcome)) {
            const imageIds = generated.images.map(image => image.id);
            const subject = this.subjectOf(generated.request);
            return {
                kind: WorkspaceItemKind.GeneratedImage,
                subject,
                message: withReason(`Could not make ${subject}`, outcome.reason),
                label: capitalized(subject),
                reason: outcome.reason,
                canRetry: true,
                dependents: this.dependentsOfImages(imageIds)
            };
        }
        const images = this.adoptGeneratedImages(generated, outcome);
        if (!images.length) {
            return "done";
        }
        this.restoreRestFrequencies(images);
        yield* awaited(Promise.resolve());
        if (!this.isCurrent) {
            return "done";
        }
        yield* awaited(this.configureImages(images));
        return "done";
    }

    /**
     * Run one saved moment, PV or image fitting request again.
     *
     * @returns the images that it made, or none when the request cannot be made or was skipped.
     * Returns "deferred" when the image that it is made from may still be made after Recovery.
     * Returns the failure when the backend could not make the images. The user can retry them.
     */
    private *makeImagesAgain(generated: WorkspaceGeneratedImages): Generator<Promise<unknown>, FrameStore[] | "deferred" | {reason: string | undefined}, any> {
        const {request, images} = generated;
        if (request.type !== "moment" && request.type !== "pv" && request.type !== "fitting") {
            return [];
        }
        const subject = this.subjectOf(request);
        const details = {label: capitalized(subject), imageIds: generated.images.map(image => image.id), causeImageId: request.sourceImageId};
        const source = this.frameOf(request.sourceImageId);
        if (!source) {
            if (this.awaitedImageIds.has(request.sourceImageId)) {
                return "deferred";
            }
            if (this.skippedImageIds.has(request.sourceImageId)) {
                // The images of this request are skipped with it. An item made from them is skipped too.
                generated.images.forEach(image => this.skippedImageIds.add(image.id));
                const reason = "the image it is made from was skipped";
                this.report(WorkspaceItemKind.GeneratedImage, subject, `Skipped making ${subject}: ${reason}`, WorkspaceIssueOutcome.Skipped, {...details, reason});
            } else {
                const reason = "the image it is made from was not restored";
                this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject}: ${reason}`, WorkspaceIssueOutcome.Failed, {...details, reason});
            }
            return [];
        }
        const regionId = typeof request.regionId === "number" ? this.regionIdOf(request.sourceImageId, request.regionId) : undefined;
        if (regionId === undefined) {
            const reason = "the region it is made over was not restored";
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject}: ${reason}`, WorkspaceIssueOutcome.Failed, {label: details.label, reason, imageIds: details.imageIds});
            return [];
        }

        let outcome: FrameStore[] | "skipped" | undefined;
        let reason: string | undefined;
        if (request.type === "moment") {
            // The first request that makes moment images of an image replaces no images. A later
            // request keeps the images that earlier requests made. This includes a request that the
            // user retries after a later request made its images. The backend numbers the names of
            // kept images, as it did when the images were first made.
            const message = WorkspaceRestorer.momentMessageOf(request, source, regionId, this.momentSources.has(source));
            if (message && regionId > RegionId.CURSOR) {
                const handshake = yield* awaited(this.introduceRegionToBackend(source, regionId, `Preparing ${subject}`));
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
                try {
                    outcome = yield* awaited(
                        this.waitForRequest(
                            made,
                            waiting,
                            `Making ${subject}`,
                            () => source.requestingMomentsProgress,
                            () => this.appStore.cancelRequestingMoment(source.frameInfo.fileId)
                        )
                    );
                } catch (err) {
                    outcome = [];
                    reason = reasonOf(err);
                }
            }
        } else if (request.type === "fitting") {
            // Make only the images that the session still showed. The fit also shows its result again.
            const message = WorkspaceRestorer.fittingMessageOf(request, source, regionId, images);
            if (message) {
                const fittingStore = this.appStore.imageFittingStore;
                fittingStore.setIsFitting(true);
                fittingStore.setIsCancelling(false);
                const waiting = {isSkipped: false};
                const made = (this.appStore.requestFitting(message, () => !waiting.isSkipped && this.isCurrent) as unknown as Promise<FrameStore[] | undefined>).then(frames => frames ?? []);
                try {
                    outcome = yield* awaited(
                        this.waitForRequest(
                            made,
                            waiting,
                            `Making ${subject}`,
                            () => fittingStore.progress ?? 0,
                            () => this.appStore.backendService.cancelRequestingFitting(source.frameInfo.fileId)
                        )
                    );
                } catch (err) {
                    outcome = [];
                    reason = reasonOf(err);
                }
            }
        } else {
            const message = WorkspaceRestorer.pvMessageOf(request, source, regionId);
            if (message) {
                source.resetPvRequestState();
                const waiting = {isSkipped: false};
                const made = (this.appStore.requestPV(message, source, true, () => !waiting.isSkipped && this.isCurrent) as unknown as Promise<FrameStore | undefined>).then(frame => (frame ? [frame] : []));
                try {
                    outcome = yield* awaited(
                        this.waitForRequest(
                            made,
                            waiting,
                            `Making ${subject}`,
                            () => source.requestingPVProgress,
                            () => this.appStore.cancelRequestingPV(source.frameInfo.fileId)
                        )
                    );
                } catch (err) {
                    outcome = [];
                    reason = reasonOf(err);
                }
            }
        }

        if (outcome === undefined) {
            const reason = "the request is not one this version can make";
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Could not make ${subject}: ${reason}`, WorkspaceIssueOutcome.Failed, {label: details.label, reason, imageIds: details.imageIds});
            return [];
        }
        if (outcome === "skipped") {
            // The images of this request are skipped with it. An item made from them is skipped too.
            generated.images.forEach(image => this.skippedImageIds.add(image.id));
            this.report(WorkspaceItemKind.GeneratedImage, subject, `Skipped making ${subject}`, WorkspaceIssueOutcome.Skipped, {label: details.label, imageIds: details.imageIds});
            return [];
        }
        if (!outcome.length) {
            return {reason};
        }
        if (request.type === "moment") {
            this.momentSources.add(source);
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
            const step = this.startStep();
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
                step.end();
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
            step.show({description, progress: 0, onSkip: () => finish("skipped")});
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

    /**
     * Returns the request that a saved image fitting makes, or nothing when this version cannot make
     * it. The request makes only the model and residual images that the workspace saves.
     */
    private static fittingMessageOf(request: WorkspaceFittingRequest, source: FrameStore, regionId: number, images: WorkspaceGeneratedFile[]): CARTA.FittingRequest.$Properties | undefined {
        const {components, fixedParams, fov} = request;
        const isNumber = (value: unknown): value is number => typeof value === "number" && isFinite(value);
        const guess = (value: unknown): number => (isNumber(value) ? value : NaN);
        const isPoint = (point: unknown): point is Point2D => isNumber((point as Point2D)?.x) && isNumber((point as Point2D)?.y);
        const isFovValid = regionId !== 0 || (fov !== undefined && isPoint(fov.center) && isPoint(fov.size) && isNumber(fov.rotation));
        if (
            !Array.isArray(components) ||
            !components.length ||
            !Array.isArray(fixedParams) ||
            fixedParams.length !== components.length * 6 + 1 ||
            !fixedParams.every(isFixed => typeof isFixed === "boolean") ||
            !Object.values(CARTA.FittingSolverType).includes(request.solver) ||
            !isFovValid
        ) {
            return undefined;
        }
        return {
            fileId: source.frameInfo.fileId,
            initialValues: components.map(component => ({
                center: {x: guess(component?.center?.x), y: guess(component?.center?.y)},
                amp: guess(component?.amp),
                fwhm: {x: guess(component?.fwhm?.x), y: guess(component?.fwhm?.y)},
                pa: guess(component?.pa)
            })),
            fixedParams: [...fixedParams],
            regionId,
            fovInfo: regionId === 0 && fov ? {regionType: CARTA.RegionType.RECTANGLE, rotation: fov.rotation, controlPoints: [{...fov.center}, {...fov.size}]} : null,
            createModelImage: images.some(image => image.fittingImage === "model"),
            createResidualImage: images.some(image => image.fittingImage === "residual"),
            offset: isNumber(request.offset) ? request.offset : 0,
            solver: request.solver
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
     *
     * @throws The error of the request, when the request fails before it is skipped.
     */
    private waitForRequest(made: Promise<FrameStore[]>, waiting: {isSkipped: boolean}, description: string, progressOf: () => number, cancel: () => void): Promise<FrameStore[] | "skipped"> {
        return new Promise((resolve, reject) => {
            let isSettled = false;
            const step = this.startStep();
            /** Stops the wait. Returns false when the wait has already stopped. */
            const finish = (): boolean => {
                if (isSettled) {
                    return false;
                }
                isSettled = true;
                disposeProgress();
                step.end();
                return true;
            };
            const settle = (outcome: FrameStore[] | "skipped"): boolean => {
                if (!finish()) {
                    return false;
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
                if (!isSettled) {
                    step.show({description, progress, onSkip: skip});
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
                    if (finish()) {
                        reject(err);
                    }
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
            let frameIndex = unclaimed.indexOf(frames[index]);
            if (request.type === "moment" && typeof image.moment === "number") {
                frameIndex = unclaimed.findIndex(frame => frame.generation?.moment === image.moment);
            } else if (request.type === "fitting") {
                frameIndex = unclaimed.findIndex(frame => frame.generation?.fittingImage === image.fittingImage);
            }
            const frame = frameIndex >= 0 ? unclaimed.splice(frameIndex, 1)[0] : undefined;
            if (!frame) {
                if (frames.length) {
                    const imageName = this.nameOf(image);
                    this.report(WorkspaceItemKind.Image, imageName, `Could not make the image ${imageName}`, WorkspaceIssueOutcome.Failed, {label: `The image ${imageName}`, imageIds: [image.id]});
                }
                continue;
            }
            this.adoptImage(image, frame);
            // When the source image is the spatial reference, the session matches a moment image to it
            // by itself. Turn the match off for an image that was saved unmatched.
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
     * Puts an image in front: the image that was saved in front, or else the first restored image.
     * Each image that a request made again was put in front when it arrived.
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
     * Restore the rest frequency that converts the spectral axis of the given images. Run it after
     * the images open and before they are matched. Skip an image whose rest frequency is the one in
     * its header.
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
            const outcome = await this.waitForCubeHistogram(frame, `Computing the cube histogram of ${imageName}`);
            if ((outcome === "skipped" || outcome === "superseded") && isOpen()) {
                frame.renderConfig.keepRangeWithoutCubeHistogram(stokesIndex);
                this.appStore.cancelCubeHistogramRequest(frame.frameInfo.fileId);
                if (outcome === "skipped" && this.isCurrent) {
                    this.report(WorkspaceItemKind.Image, imageName, `Skipped computing the cube histogram of ${imageName}; its percentile range is kept as a custom range; select Per-cube to compute it again`);
                }
            }
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
            const step = this.startStep();
            const finish = (outcome: "complete" | "closed" | "superseded" | "skipped", dispose: () => void) => {
                if (isSettled) {
                    return;
                }
                isSettled = true;
                dispose();
                step.end();
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
                    step.show({description, progress, onSkip: skip});
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

    /**
     * Stage 5: open every catalog against the image it belongs to.
     *
     * A mirror that times out is waited for only once. The later online catalogs on that mirror fail
     * at once. Their reason says that the mirror timed out on an earlier query.
     */
    private *openCatalogs(): Generator<Promise<unknown>, void, any> {
        yield* this.runStage(
            "Opening catalogs",
            (this.workspace.catalogs ?? []).map(catalogInfo => this.catalogTask(catalogInfo)),
            // Each round of attempts waits for a timed-out mirror once. A retry waits for it again.
            () => {
                this.catalogRound++;
                const forgetTimedOutMirrors = CatalogApiService.Instance.rememberTimedOutMirrors();
                return () => {
                    forgetTimedOutMirrors();
                    this.moveOffFailedMirrors();
                };
            }
        );
    }

    /**
     * Make a mirror that failed in this round no longer the active one, so that Recovery offers a
     * retry on another mirror first. The new mirror is the available one that failed longest ago, or
     * one that has not failed. The active mirror of each database lasts only for this session.
     */
    private moveOffFailedMirrors(): void {
        const mirrorSiteStore = MirrorSiteStore.Instance;
        for (const database of [CatalogDatabase.SIMBAD, CatalogDatabase.VIZIER]) {
            const activeMirror = mirrorSiteStore.getActiveMirror(database);
            const activeRound = activeMirror ? this.failedMirrorRounds.get(activeMirror) : undefined;
            if (activeRound !== this.catalogRound) {
                continue;
            }
            const roundOf = (mirror: string) => this.failedMirrorRounds.get(mirror) ?? 0;
            const available = mirrorSiteStore.getMirrorSites(database).filter(mirror => !mirrorSiteStore.isMirrorUnavailable(database, mirror));
            const next = available.reduce<string | undefined>((best, mirror) => (best === undefined || roundOf(mirror) < roundOf(best) ? mirror : best), undefined);
            if (next && roundOf(next) < activeRound) {
                mirrorSiteStore.setActiveMirror(database, next);
            }
        }
    }

    /**
     * Returns how the restore report and the progress name a catalog, such as "The catalog
     * sources.vot" or "The SIMBAD catalog on cube.fits". The name of the image tells apart two online
     * catalogs from the same service.
     */
    private labelOfCatalog(catalogInfo: WorkspaceCatalog): string {
        const source = catalogInfo.source;
        if (source.type === "file") {
            return `The catalog ${source.filename}`;
        }
        const service = source.type === "simbad" ? "SIMBAD" : "VizieR";
        const table = source.type === "vizier" && source.table ? ` ${source.table}` : "";
        const image = catalogInfo.associatedImageId === undefined ? undefined : this.images.get(catalogInfo.associatedImageId);
        return `The ${service} catalog${table} on ${image ? this.nameOf(image) : "an image"}`;
    }

    /** Returns the task that opens one catalog, from its saved source or from the file the user chooses. */
    private catalogTask(catalogInfo: WorkspaceCatalog): RestoreTask {
        const state = {source: catalogInfo.source, isRepointed: false};
        return {
            subject: () => (state.source.type === "file" ? describeCatalogSource(state.source) : this.labelOfCatalog(catalogInfo)),
            imageIds: [],
            catalogIds: [catalogInfo.id],
            attempt: () => this.attemptCatalog(catalogInfo, state),
            repoint: ({directory, filename}) => {
                state.source = {type: "file", directory, filename};
                state.isRepointed = true;
            }
        };
    }

    private *attemptCatalog(catalogInfo: WorkspaceCatalog, state: {source: WorkspaceCatalogSource; isRepointed: boolean}): Generator<Promise<unknown>, TaskOutcome, any> {
        const {source} = state;
        // The workspace names the catalog by its saved source, also after the user chose another file.
        const description = describeCatalogSource(catalogInfo.source);
        const tried = state.isRepointed ? ` from ${describeCatalogSource(source)}` : "";
        const imageId = catalogInfo.associatedImageId;
        const targetFrameId = imageId === undefined ? undefined : this.frameIds.get(imageId);
        if (imageId !== undefined && targetFrameId === undefined) {
            if (this.skippedImageIds.has(imageId)) {
                const reason = "the image it belongs to was skipped";
                this.report(WorkspaceItemKind.Catalog, description, `Skipped the catalog ${description}: ${reason}`, WorkspaceIssueOutcome.Skipped, {
                    label: this.labelOfCatalog(catalogInfo),
                    catalogIds: [catalogInfo.id],
                    reason,
                    causeImageId: imageId
                });
            } else {
                const reason = "the image it belongs to was not restored";
                this.report(WorkspaceItemKind.Catalog, description, `Could not load the catalog ${description}: ${reason}`, WorkspaceIssueOutcome.Failed, {
                    label: this.labelOfCatalog(catalogInfo),
                    catalogIds: [catalogInfo.id],
                    reason,
                    causeImageId: imageId
                });
            }
            return "done";
        }

        const query: {isSkipped: boolean; mirrorUrl?: string} = {isSkipped: false};
        let catalogFileId: number | undefined;
        let reason: string | undefined;
        let causeCatalogId: number | undefined;
        try {
            if (source.type === "vizier" && !source.table) {
                const reason = "the query names no table";
                this.report(WorkspaceItemKind.Catalog, description, `Could not load the catalog ${description}: ${reason}`, WorkspaceIssueOutcome.Failed, {label: this.labelOfCatalog(catalogInfo), catalogIds: [catalogInfo.id], reason});
                return "done";
            }
            catalogFileId = (yield* this.openCatalogSource(source, targetFrameId, description, query)) ?? undefined;
        } catch (err) {
            console.error(err);
            reason = reasonOf(err);
            if (query.mirrorUrl && !query.isSkipped) {
                this.failedMirrorRounds.set(query.mirrorUrl, this.catalogRound);
            }
            // A query that did not wait for a mirror is listed under the first query that waited for it.
            if (err instanceof MirrorTimeoutError) {
                if (err.didTimeOutEarlier) {
                    causeCatalogId = this.timedOutCatalogIds.get(err.mirrorUrl);
                } else {
                    this.timedOutCatalogIds.set(err.mirrorUrl, catalogInfo.id);
                }
            }
        }
        if (!this.isCurrent) {
            this.closeSupersededCatalog(catalogFileId);
            return "done";
        }
        if (catalogFileId === undefined) {
            if (query.isSkipped) {
                this.report(WorkspaceItemKind.Catalog, description, `Skipped the catalog ${description}`, WorkspaceIssueOutcome.Skipped, {label: this.labelOfCatalog(catalogInfo), catalogIds: [catalogInfo.id]});
                return "done";
            }
            return {
                kind: WorkspaceItemKind.Catalog,
                subject: description,
                message: withReason(`Could not load the catalog ${description}${tried}`, reason),
                label: `${this.labelOfCatalog(catalogInfo)}${tried}`,
                causeCatalogId,
                reason,
                repointKind: source.type === "file" ? "catalog" : undefined,
                canRetry: source.type !== "file",
                database: source.type === "simbad" ? CatalogDatabase.SIMBAD : source.type === "vizier" ? CatalogDatabase.VIZIER : undefined,
                dependents: []
            };
        }

        if (state.isRepointed && source.type === "file") {
            this.repointed.catalogs.set(catalogInfo.id, {from: catalogInfo.source, to: source});
        }
        this.catalogIds.set(catalogInfo.id, catalogFileId);
        // The workspace is the authority on which catalog its own ID names.
        WorkspaceIdRegistry.Instance.adopt(WorkspaceItemKind.Catalog, catalogFileId, catalogInfo.id);
        return "done";
    }

    /**
     * Open one catalog the way the workspace says it was opened, re-running a query if that is what it was.
     *
     * While an online query runs, the restore dialog offers to skip it. Then the user does not have
     * to wait for a mirror that does not answer. A skipped query sets `query.isSkipped`. The query
     * sets `query.mirrorUrl` to the mirror that it asks.
     */
    private *openCatalogSource(source: WorkspaceCatalogSource, targetFrameId: number | undefined, description: string, query: {isSkipped: boolean; mirrorUrl?: string}): Generator<Promise<unknown>, number | undefined, any> {
        if (source.type === "file") {
            const fileId = yield* awaitedFlow<number | undefined>(this.appStore.appendCatalog(source.directory ?? "", source.filename, StreamingRowSource.INIT_TABLE_ROWS, targetFrameId));
            return typeof fileId === "number" ? fileId : undefined;
        }
        const skip = () => {
            query.isSkipped = true;
            CatalogApiService.Instance.cancelPendingQueries("The online catalog query was skipped");
        };
        query.mirrorUrl = MirrorSiteStore.Instance.getActiveMirror(source.type === "simbad" ? CatalogDatabase.SIMBAD : CatalogDatabase.VIZIER);
        const step = this.startStep();
        step.show({
            description: query.mirrorUrl ? `Waiting for the mirror ${hostOf(query.mirrorUrl)}` : `Waiting for the catalog ${description}`,
            progress: 0,
            onSkip: skip,
            deadline: Date.now() + CatalogApiService.QUERY_TIMEOUT_MS
        });
        try {
            if (source.type === "simbad") {
                const {fileId} = yield* awaited(CatalogApiService.Instance.loadSimbadCatalog(source, targetFrameId));
                return fileId ?? noSources();
            }
            return (yield* awaited(CatalogApiService.Instance.loadVizierCatalogs(source, [source.table!], targetFrameId)))[0] ?? noSources();
        } finally {
            step.end();
        }
    }

    /**
     * Stage 6: apply what each catalog was saved with, and bring its rows in line with it.
     *
     * One catalog is asked for at a time, in the order the workspace lists them. The backend answers
     * catalog requests one after another anyway, so sending them all at once would save nothing,
     * and a request left waiting behind the others could be given up on before its turn came.
     */
    private *configureCatalogs(): Generator<Promise<unknown>, void, any> {
        const catalogs = this.workspace.catalogs ?? [];
        for (const [index, catalogInfo] of catalogs.entries()) {
            if (!this.isCurrent) {
                return;
            }
            this.showProgress("Applying the catalog settings", index + 1, catalogs.length, catalogInfo.source.type === "file" ? describeCatalogSource(catalogInfo.source) : this.labelOfCatalog(catalogInfo));
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
        this.issues.push(...this.withImageCauses(this.appStore.widgetsStore.restorePlotWidgetBindings(this.workspace.plotWidgets, this)));
        yield* awaited(Promise.resolve());
        if (!this.isCurrent) {
            return;
        }
        this.issues.push(...this.withImageCauses(this.appStore.widgetsStore.restorePlotWidgets(this.workspace.plotWidgets, this)));
        yield* awaited(Promise.resolve());
        if (!this.isCurrent) {
            return;
        }
        this.appStore.widgetsStore.restorePlotWidgetViews(this.workspace.plotWidgets);
    }

    /**
     * Names the saved image whose absence caused the problem of each widget, so that the report
     * lists the widget under the item that left the image out.
     *
     * A widget that saved no image followed the image in front. When that image was not restored,
     * the widget still follows the active image, which is now another image. So its effect becomes
     * {@link WorkspaceIssueEffect.ActiveImageFollowed}.
     */
    private withImageCauses(issues: WorkspaceIssue[]): WorkspaceIssue[] {
        return issues.map(issue => {
            const config = this.workspace.plotWidgets?.[issue.subject] as {imageId?: unknown; imageIds?: unknown} | undefined;
            if (issue.effect === WorkspaceIssueEffect.ActiveImage) {
                if (typeof config?.imageId === "number") {
                    return {...issue, causeImageId: config.imageId};
                }
                return {...issue, effect: WorkspaceIssueEffect.ActiveImageFollowed, causeImageId: this.workspace.selectedFile};
            }
            if (issue.reason === SOME_IMAGES_NOT_RESTORED && Array.isArray(config?.imageIds)) {
                const missing = config.imageIds.find(imageId => typeof imageId === "number" && this.fileIdOf(imageId) === undefined);
                return missing === undefined ? issue : {...issue, causeImageId: missing};
            }
            return issue;
        });
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
