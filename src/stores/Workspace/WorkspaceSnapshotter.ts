import {CARTA} from "carta-protobuf";

import {CatalogDatabase, DialogId, type HipsCoord, type HipsProjection, ImageType, RegionId, RegionOpacity, WORKSPACE_DIALOG_TABS, WORKSPACE_DIALOGS, WorkspaceItemKind} from "enums";
import {
    CARTA_INFO,
    type Point2D,
    type Workspace,
    WORKSPACE_VERSION,
    type WorkspaceCatalog,
    type WorkspaceCatalogSource,
    type WorkspaceColorBlending,
    type WorkspaceContourDialogSettings,
    type WorkspaceDialog,
    type WorkspaceFile,
    type WorkspaceFittingRequest,
    type WorkspaceGenerationRequest,
    type WorkspaceImageSource,
    type WorkspaceIssue,
    type WorkspaceRegionShape,
    type WorkspaceVectorOverlayDialogSettings
} from "models";
import {AppStore, CatalogOnlineQueryConfigStore, type DialogSettings, HipsQueryStore, MirrorSiteStore} from "stores";
import {CURSOR_REGION_ID, type FrameStore, type ImageGenerationRequest} from "stores/Frame";
import {ACTIVE_FILE_ID} from "stores/Widgets";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";
import {fingerprintCatalogSelection, hashCatalogContent} from "utilities";

/** What a capture produced, and what it could not take with it. */
export interface WorkspaceSnapshot {
    workspace: Workspace;
    /** One entry per item that could not be captured as it stands. */
    issues: WorkspaceIssue[];
}

/** One request that made images, and the images from it that the session still shows. */
interface GeneratedImageGroup {
    request: ImageGenerationRequest;
    frames: FrameStore[];
}

/** A reason that a request for generated images is not saved. */
type UnsavedRequestReason = keyof typeof WorkspaceSnapshotter.UNSAVED_REQUEST_REASONS;

/** The workspace while it is being filled in: the collections the stages append to are already there. */
type WorkspaceUnderConstruction = Workspace & Required<Pick<Workspace, "files" | "colorBlendingImages" | "references">>;

/**
 * Takes what the running session is showing and turns it into a workspace, one named stage at a
 * time.
 *
 * This is the counterpart of {@link WorkspaceRestorer}. Each stage here has a stage there that reads
 * back what it writes. The stage numbers of the two classes do not match. The snapshotter owns which items
 * are captured and the IDs they refer to each other by. What each piece of state means stays with
 * whoever owns it: a frame's own config stores, a catalog's profile store for its table and query,
 * and its display store for how it is drawn.
 *
 * The workspace it returns is detached from the session: nothing in it is an observable the session
 * can go on changing while the workspace is being written out.
 */
export class WorkspaceSnapshotter {
    /**
     * The most selected rows of one catalog a workspace keeps. Each is saved as a fingerprint of its
     * own, so a selection of a million rows would make the workspace tens of megabytes.
     */
    public static readonly MAX_SAVED_SELECTED_ROWS = 100_000;

    /**
     * The reasons that a request for generated images is not saved. Each reason has a hint that says
     * what the user can do before saving, so that the request is saved.
     */
    public static readonly UNSAVED_REQUEST_REASONS = {
        momentsNotTold: {
            reason: "it cannot tell which moment each of its images is",
            hint: "Save the moment images as files, and open the files instead"
        },
        sourceClosed: {
            reason: "the image it was made from is closed",
            hint: "Open the image it was made from, make the image again, and close the old one"
        },
        sourceNotSaved: {
            reason: "the image it was made from was not saved",
            hint: "Fix the image it was made from first, or make the image again from an image that can be saved"
        },
        referenceNotSaved: {
            reason: "the image it was made from is matched to an image that was not saved",
            hint: "Match the image it was made from to an image that can be saved, or stop matching it"
        },
        regionDeleted: {
            reason: "the region it was made over has been deleted",
            hint: "Draw the region again, make the image again, and close the old one"
        }
    } as const;

    /** One entry per item that could not be captured as it stands. */
    private readonly issues: WorkspaceIssue[] = [];
    /**
     * Whether only the issues are collected. Then the stages skip the work that only a saved
     * workspace needs, such as the hashes of the catalogs.
     */
    private isCheckOnly = false;
    /** The requests for generated images that are saved, in an order in which each can be made again. */
    private readonly generatedImageGroups: GeneratedImageGroup[] = [];
    /** The generated images saved with the request that made them. */
    private readonly savedGeneratedImages = new Set<FrameStore>();
    private readonly workspace: WorkspaceUnderConstruction = {
        workspaceVersion: WORKSPACE_VERSION,
        frontendVersion: CARTA_INFO.version,
        description: "Workspace exported from CARTA",
        date: Date.now() / 1000,
        files: [],
        colorBlendingImages: [],
        references: {}
    };

    private get appStore(): AppStore {
        return AppStore.Instance;
    }

    /**
     * Returns what a capture of the session would leave out, without capturing the session. The
     * Workspace dialog runs it before the user saves, and again when the session changes. So it does
     * only the work that finds the issues.
     */
    public findIssues(): WorkspaceIssue[] {
        this.isCheckOnly = true;
        this.collectGeneratedImages();
        this.captureImages();
        this.captureGeneratedImages();
        this.captureColorBlending();
        this.captureCatalogs();
        this.checkSnippetCode();
        return this.issues;
    }

    /**
     * Capture the session as a workspace.
     *
     * @returns the workspace, detached from the session's own state, and one entry per item that
     *          could not be captured as it stands.
     */
    public capture(): WorkspaceSnapshot {
        this.collectGeneratedImages();
        this.captureImages();
        this.captureGeneratedImages();
        this.captureColorBlending();
        this.captureCatalogs();
        this.captureViews();
        this.captureLayout();
        this.captureSelection();
        return {workspace: this.detach(), issues: this.issues};
    }

    /** Stage 1: every image opened from a file or an expression, with how it was opened and how it is displayed. Stage 1a saves the generated images. */
    private captureImages(): void {
        const references = this.workspace.references;
        references.spatial = this.imageIdOf(this.appStore.spatialReference);
        references.spectral = this.imageIdOf(this.appStore.spectralReference);
        references.raster = this.imageIdOf(this.appStore.rasterScalingReference);
        this.workspace.spectralMatchingType = this.appStore.spectralMatchingType;

        let hasTemporaryFiles = false;
        for (const frame of this.appStore.frames) {
            // A generated image has no source to open it from. An image that a request made is
            // saved with the request, or reported with it. Any other generated image is not saved.
            if (frame?.frameInfo?.generated) {
                hasTemporaryFiles ||= !frame.generation;
                continue;
            }
            const workspaceImageId = this.imageIdOf(frame);
            if (workspaceImageId === undefined) {
                this.issues.push({
                    kind: WorkspaceItemKind.Image,
                    subject: frame.frameInfo.fileInfo.name ?? "",
                    message: `Could not save the image ${frame.frameInfo.fileInfo.name}: it is not one this session opened`
                });
                continue;
            }
            if (this.isCheckOnly) {
                this.reportUnacceptedRegions(frame);
                continue;
            }
            this.workspace.files.push(this.captureImage(frame, workspaceImageId, WorkspaceSnapshotter.imageSourceOf(frame)));
        }

        if (hasTemporaryFiles) {
            this.issues.push({
                kind: WorkspaceItemKind.Image,
                subject: "",
                message: "The workspace contains generated files. These will not be preserved when reloading.",
                hint: "To keep such an image, save it as a file and open the file instead"
            });
        }
    }

    /**
     * Stage 0: find the generated images that can be saved, by the request that made them.
     *
     * Save a request once, with the images from it that the session still shows. Save it only if it
     * can be made again: its source image and its region are both saved. These can be images that
     * another request made. So take a request only after everything it is made from is taken. This
     * also puts the requests in an order in which they can be made again.
     */
    private collectGeneratedImages(): void {
        const framesByRequest = new Map<ImageGenerationRequest, FrameStore[]>();
        for (const frame of this.appStore.frames) {
            const request = frame?.frameInfo?.generated ? frame.generation?.request : undefined;
            if (request) {
                framesByRequest.set(request, [...(framesByRequest.get(request) ?? []), frame]);
            }
        }
        let pending: GeneratedImageGroup[] = Array.from(framesByRequest, ([request, frames]) => ({request, frames: frames.sort((a, b) => a.frameInfo.fileId - b.frameInfo.fileId)}));

        // The reason to report for a request that waits, if the image that it waits for is not saved.
        const reasonsIfNotSaved = new Map<GeneratedImageGroup, UnsavedRequestReason>();
        let isTakingMore = true;
        while (isTakingMore) {
            isTakingMore = false;
            const waiting: GeneratedImageGroup[] = [];
            for (const group of pending) {
                const problem = this.whyNotSavable(group);
                if (problem === undefined) {
                    this.generatedImageGroups.push(group);
                    group.frames.forEach(frame => this.savedGeneratedImages.add(frame));
                    isTakingMore = true;
                } else if (problem.isWaiting) {
                    waiting.push(group);
                    reasonsIfNotSaved.set(group, problem.reason);
                } else {
                    this.reportUnsavedRequest(group.request, problem.reason);
                }
            }
            pending = waiting;
        }
        // The requests that are still waiting are made from an image that is not saved.
        pending.forEach(group => this.reportUnsavedRequest(group.request, reasonsIfNotSaved.get(group) ?? "sourceNotSaved"));
    }

    /**
     * Returns why a request cannot be saved. `isWaiting` is set when the request is made from a
     * generated image that may still be saved. Then the reason applies only if that image is not saved.
     *
     * @returns nothing when the request can be saved.
     */
    private whyNotSavable({request, frames}: GeneratedImageGroup): {reason: UnsavedRequestReason; isWaiting?: boolean} | undefined {
        if (request.type === "hips") {
            return undefined;
        }
        // Moment images are told apart by their moments. Without the moments, the images can be
        // told apart only when all of them remain, in the order that they were made.
        if (request.type === "moment" && frames.some(frame => frame.generation?.moment === undefined) && frames.length !== request.moments.length) {
            return {reason: "momentsNotTold"};
        }
        const source = request.source;
        if (!this.appStore.frames.includes(source)) {
            return {reason: "sourceClosed"};
        }
        // Use the region of the image that the source is shown with. When the source is matched to
        // another image, the region belongs to that image.
        const regionOwner = source.spatialReference ?? source;
        // The image that the shape of the region is in. It is saved before the request, so that a
        // restore can make the region on it again.
        const shapeOwner = "regionShapeOwner" in request ? request.regionShapeOwner : undefined;
        for (const image of [source, regionOwner, ...(shapeOwner ? [shapeOwner] : [])]) {
            if (image.frameInfo.generated && !this.savedGeneratedImages.has(image)) {
                return {reason: image === source ? "sourceNotSaved" : "referenceNotSaved", isWaiting: !!image.generation};
            }
        }
        if (this.imageIdOf(source) === undefined) {
            return {reason: "sourceNotSaved"};
        }
        if (this.imageIdOf(regionOwner) === undefined) {
            return {reason: "referenceNotSaved"};
        }
        // A request that kept the shape of its region is made again over that shape, also when the
        // region was deleted.
        const hasShape = "regionShape" in request && !!request.regionShape && !!shapeOwner && this.imageIdOf(shapeOwner) !== undefined;
        if (request.regionId > RegionId.CURSOR && !hasShape && !source.regionSet?.regions.some(region => region.regionId === request.regionId && !region.isTemporary)) {
            return {reason: "regionDeleted"};
        }
        return undefined;
    }

    private reportUnsavedRequest(request: ImageGenerationRequest, key: UnsavedRequestReason): void {
        const subject = WorkspaceSnapshotter.describeRequest(request);
        const {reason, hint} = WorkspaceSnapshotter.UNSAVED_REQUEST_REASONS[key];
        this.issues.push({kind: WorkspaceItemKind.GeneratedImage, subject, message: `Could not save ${subject}: ${reason}`, hint});
    }

    /** How a request is named to the user. */
    private static describeRequest(request: ImageGenerationRequest): string {
        switch (request.type) {
            case "moment":
                return `the moment images of ${request.source.frameInfo.fileInfo.name}`;
            case "pv":
                return `the PV image of ${request.source.frameInfo.fileInfo.name}`;
            case "fitting":
                return `the image fitting images of ${request.source.frameInfo.fileInfo.name}`;
            default:
                return `the HiPS image of ${request.query.hips}`;
        }
    }

    /**
     * Returns the workspace ID of an image: the ID that the image was given when it was opened.
     *
     * A generated image has a workspace ID only when it is saved with the request that made it,
     * although the session registered every image in the same way. Data that names any other
     * generated image cannot be saved either. If it were saved, a color blend could name an image
     * that the workspace does not save. The blend would then come back without one of its layers,
     * and no message would say so.
     */
    private imageIdOf(frame: FrameStore | undefined | null): number | undefined {
        if (frame?.frameInfo?.generated && !this.savedGeneratedImages.has(frame)) {
            return undefined;
        }
        return WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Image, frame?.frameInfo.fileId);
    }

    /**
     * The settings that the Contour and Vector Overlay dialogs show but that are not applied, for
     * images that the workspace keeps.
     */
    /**
     * Returns the name of the snippet that the Snippet dialog shows. The store keeps no name for an
     * example, so that saving an edited example asks for a new name. Find an example by its code
     * instead. An example whose code the user changed is not found, like a snippet that is not saved.
     */
    private shownSnippetName(): string | undefined {
        const snippetStore = this.appStore.snippetStore;
        if (snippetStore?.activeSnippetName) {
            return snippetStore.activeSnippetName;
        }
        const code = snippetStore?.activeSnippet?.code;
        if (!code) {
            return undefined;
        }
        return [...(snippetStore.snippets ?? new Map()).entries()].find(([, snippet]) => snippet.tags?.includes("example") && snippet.code === code)?.[0];
    }

    /**
     * Returns whether the Snippet dialog shows code that a restore does not show. That is code
     * without a snippet name, or code that differs from the saved snippet or the example of the
     * name. The workspace saves the name only, not the code.
     */
    private hasUnsavedSnippetCode(name: string | undefined): boolean {
        const code = this.appStore.snippetStore?.activeSnippet?.code ?? "";
        if (name === undefined) {
            return code.trim() !== "";
        }
        return this.appStore.snippetStore?.snippets?.get(name)?.code !== code;
    }

    /**
     * Reports the code in the open Snippet dialog that the workspace does not save.
     *
     * @returns the name that the workspace saves for the snippet that the dialog shows.
     */
    private checkSnippetCode(): string | undefined {
        if (!this.appStore.dialogStore?.dialogVisible?.get(DialogId.Snippet)) {
            return undefined;
        }
        const name = this.shownSnippetName();
        if (this.hasUnsavedSnippetCode(name)) {
            this.issues.push({
                kind: WorkspaceItemKind.Layout,
                subject: "Snippet",
                message: "Could not save the code in the Snippet dialog: it is not saved as a snippet",
                hint: "Save the snippet first, then save the workspace"
            });
        }
        return name;
    }

    private captureDialogSettings(): Workspace["dialogSettings"] {
        const dialogStore = this.appStore.dialogStore;
        const withImageId = (settings: DialogSettings | undefined) => {
            const imageId = settings ? this.imageIdOf(settings.frame) : undefined;
            return settings && imageId !== undefined ? {imageId, ...settings.values} : undefined;
        };
        const contour = withImageId(dialogStore?.unappliedSettingsOf?.(DialogId.Contour)) as WorkspaceContourDialogSettings | undefined;
        const vectorOverlay = withImageId(dialogStore?.unappliedSettingsOf?.(DialogId.Vector)) as WorkspaceVectorOverlayDialogSettings | undefined;
        const snippetName = this.checkSnippetCode();
        if (!contour && !vectorOverlay && !snippetName) {
            return undefined;
        }
        return {...(contour ? {contour} : {}), ...(vectorOverlay ? {vectorOverlay} : {}), ...(snippetName ? {snippet: {name: snippetName}} : {})};
    }

    /** The ID this workspace knows a catalog by: the one it was given when it was opened. */
    private catalogIdOf(catalogFileId: number | undefined): number | undefined {
        return WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, catalogFileId);
    }

    /** One image: how it would have to be opened, if it is opened, and everything it is shown with. */
    private captureImage(frame: FrameStore, workspaceImageId: number, source: WorkspaceImageSource | undefined): WorkspaceFile {
        const workspaceFile: WorkspaceFile = {
            id: workspaceImageId,
            source,
            timeSeriesMember: this.appStore.timeSeriesStore.isMember(frame) || undefined,
            imageListIndex: this.appStore.imageViewConfigStore.getImageListIndex(ImageType.FRAME, frame.frameInfo.fileId)
        };
        // Save the range of the animator only when it is not every channel.
        const [firstChannel, lastChannel] = frame.animationChannelRange ?? [];
        const depth = frame.frameInfo.fileInfoExtended?.depth ?? 1;
        if (typeof firstChannel === "number" && typeof lastChannel === "number" && (firstChannel !== 0 || lastChannel !== depth - 1)) {
            workspaceFile.animationChannelRange = [firstChannel, lastChannel];
        }
        workspaceFile.references = {};

        if (frame.spatialReference) {
            workspaceFile.references.spatial = this.imageIdOf(frame.spatialReference);
        } else if (frame.regionSet) {
            // Regions are only the image's own while it is not matched to another one.
            // A region without an ID from the backend is not saved, so it is not saved as selected either.
            const regionSet = frame.regionSet;
            const isSaved = (regionId: number | undefined) => regionId !== undefined && regionId > CURSOR_REGION_ID;
            const selectedRegions = Array.from(regionSet.selectedRegionIds ?? []).filter(isSaved);
            const focusedRegionId = regionSet.focusedRegion?.regionId;
            workspaceFile.regionsSet = {
                newRegionType: regionSet.newRegionType,
                regionMode: regionSet.mode,
                ...(regionSet.regions?.length ? {selectedRegion: isSaved(focusedRegionId) ? focusedRegionId : undefined, ...(selectedRegions.length > 1 ? {selectedRegions} : {}), regions: this.captureRegions(frame)} : {})
            };
        }

        if (frame.spectralCoordsSupported?.has(frame.spectralCoordinate)) {
            workspaceFile.spectralCoordinate = frame.spectralCoordinate;
        }
        if (frame.spectralCoordsSupported?.has(frame.spectralCoordinateSecondary)) {
            workspaceFile.spectralCoordinateSecondary = frame.spectralCoordinateSecondary;
        }
        workspaceFile.spectralSystem = frame.spectralSystem ?? undefined;
        workspaceFile.intensityUnit = frame.intensityUnit;
        const restFreqStore = frame.restFreqStore;
        const restFreq = restFreqStore?.customRestFreq;
        if (restFreq && !restFreqStore.isInvalidInput && (restFreq.value !== restFreqStore.headerRestFreq.value || restFreq.unit !== restFreqStore.headerRestFreq.unit)) {
            workspaceFile.restFrequency = {value: restFreq.value, unit: restFreq.unit};
        }
        if (frame.isRestFrameSupported) {
            workspaceFile.restFrame = {
                // Save the rest frame as off when the controls rejected the shift. The axis is not corrected in that case either.
                enabled: frame.isRestFrameEnabled && frame.isRestFrameShiftInputValid,
                redshift: frame.restFrameRedshift,
                shiftMode: frame.restFrameShiftMode,
                velocityConvention: frame.restFrameVelocityConvention
            };
        }

        if (frame.beamProperties) {
            const beam = frame.overlayBeamSettings;
            workspaceFile.beam = {visible: beam.isVisible, color: beam.color, type: beam.type, width: beam.width, shiftX: beam.shiftX, shiftY: beam.shiftY};
        }
        if (frame.titleCustomText !== frame.defaultTitleText) {
            workspaceFile.titleCustomText = frame.titleCustomText;
        }
        if (frame.colorbarLabelCustomText !== frame.defaultColorbarLabelText) {
            workspaceFile.colorbarLabelCustomText = frame.colorbarLabelCustomText;
        }
        // Save offset coordinates only on an image that is not matched to another image, as for regions. A matched image uses the offset coordinates of its reference image.
        // The offset center is set when the offset coordinates are first turned on. Save it when they are turned off too.
        if (!frame.spatialReference && frame.offsetCenter) {
            workspaceFile.offsetCoordinates = {center: {...frame.offsetCenter}, skyRefIs: frame.skyRefIs, shown: frame.isOffsetCoord};
        }
        if (frame.fittingResult) {
            // JSON cannot write NaN. A rotation that is not finite is saved as 0, as the ellipse is drawn with it.
            const finite = (value: number): number => (isFinite(value) ? value : 0);
            workspaceFile.fitResult = {
                result: frame.fittingResult,
                log: frame.fittingLog,
                ellipses: frame.fittingResultRegionParams.map(({points, rotation}) => ({center: {x: points[0].x, y: points[0].y}, size: {x: points[1].x, y: points[1].y}, rotation: finite(rotation)}))
            };
        }

        workspaceFile.center = frame.center;
        workspaceFile.zoomLevel = frame.zoomLevel;
        const zoomFrame = frame.spatialReference ?? frame;
        if (zoomFrame.isAxisZoomable) {
            workspaceFile.axisZoomLevel = {...zoomFrame.effectiveZoomLevel};
            workspaceFile.zoomAxis = zoomFrame.zoomAxis;
        }
        // Save the channel and the Stokes that the image is set to. An image that is not shown gets the
        // tiles of a new channel only when it is shown again. Until then, `channel` and `stokes` are
        // the values of the last tiles, for example 0 after a restore.
        workspaceFile.channel = frame.requiredChannel;
        workspaceFile.stokes = frame.requiredStokes;

        if (frame.spectralReference) {
            workspaceFile.references.spectral = this.imageIdOf(frame.spectralReference);
        }
        if (frame.rasterScalingReference) {
            workspaceFile.references.raster = this.imageIdOf(frame.rasterScalingReference);
        }

        workspaceFile.renderConfig = frame.renderConfig.toConfig();

        const contourConfig = frame.contourConfig.toConfig();
        if (contourConfig) {
            workspaceFile.contourConfig = contourConfig;
        }

        const vectorOverlayConfig = frame.vectorOverlayConfig.toConfig();
        if (vectorOverlayConfig) {
            workspaceFile.vectorOverlayConfig = vectorOverlayConfig;
        }

        const unappliedContourConfig = frame.contourConfig.toUnappliedConfig();
        if (unappliedContourConfig) {
            workspaceFile.unappliedContourConfig = unappliedContourConfig;
        }

        const unappliedVectorOverlayConfig = frame.vectorOverlayConfig.toUnappliedConfig(frame);
        if (unappliedVectorOverlayConfig) {
            workspaceFile.unappliedVectorOverlayConfig = unappliedVectorOverlayConfig;
        }

        return workspaceFile;
    }

    /** Reports each region of an image that the backend has not accepted. Such a region has no ID from the backend, and a workspace saves each region by its ID. */
    private reportUnacceptedRegions(frame: FrameStore): void {
        frame.regionSet.regions
            .filter(region => region.regionId < CURSOR_REGION_ID)
            .forEach(region => {
                const imageName = frame.frameInfo.fileInfo?.name ?? "";
                this.issues.push({
                    kind: WorkspaceItemKind.Image,
                    subject: imageName,
                    message: `Could not save ${region.name ? `the region "${region.name}"` : "a region"} of ${imageName}: the backend has not accepted the region`,
                    hint: "Wait until the backend accepts the region, or delete the region and draw it again"
                });
            });
    }

    /**
     * Returns the regions of an image. Leaves out a region without an ID from the backend, and
     * reports it. Such a region was refused by the backend, or the backend has not answered for it
     * yet. A workspace saves each region by its ID.
     */
    private captureRegions(frame: FrameStore): NonNullable<NonNullable<WorkspaceFile["regionsSet"]>["regions"]> {
        this.reportUnacceptedRegions(frame);
        return frame.regionSet.regions
            .filter(region => region.regionId > CURSOR_REGION_ID)
            .map(region => ({
                id: region.regionId,
                type: region.regionType,
                // JSON cannot write NaN, and the schema needs a number.
                rotation: isFinite(region.rotation) ? region.rotation : 0,
                points: region.controlPoints,
                name: region.name,
                color: region.color,
                lineWidth: region.lineWidth,
                locked: region.isLocked,
                dashes: region.dashLength ? [region.dashLength] : [],
                // Check if styles are available. If so, add them to the region
                annotationStyles: (region as any).getAnnotationStyles?.(),
                lineRegionSampleWidth: region.regionType === CARTA.RegionType.LINE || region.regionType === CARTA.RegionType.POLYLINE ? region.lineRegionSampleWidth : undefined,
                coordinate: region.coordinate,
                opacity: region.opacity === RegionOpacity.Visible ? undefined : region.opacity
            }));
    }

    /**
     * Stage 1a: save each generated image with the request that made it.
     *
     * Write each request once, and name its image and region by their workspace IDs. Save each
     * image like a file image, but without a source, because a restore makes it again instead of
     * opening it.
     */
    private captureGeneratedImages(): void {
        const generatedImages = this.generatedImageGroups.flatMap(({request, frames}) => {
            const workspaceRequest = this.workspaceRequestOf(request, frames);
            if (!workspaceRequest) {
                return [];
            }
            const images = frames.flatMap(frame => {
                const workspaceImageId = this.imageIdOf(frame);
                if (workspaceImageId === undefined) {
                    return [];
                }
                if (this.isCheckOnly) {
                    this.reportUnacceptedRegions(frame);
                    return [];
                }
                const image = this.captureImage(frame, workspaceImageId, undefined);
                return [{...image, name: frame.frameInfo.fileInfo.name ?? undefined, moment: frame.generation?.moment, fittingImage: frame.generation?.fittingImage}];
            });
            return images.length ? [{request: workspaceRequest, images}] : [];
        });
        if (generatedImages.length) {
            this.workspace.generatedImages = generatedImages;
        }
    }

    /** Returns a request as the workspace saves it, with its image and region named by their workspace IDs. */
    private workspaceRequestOf(request: ImageGenerationRequest, frames: FrameStore[]): WorkspaceGenerationRequest | undefined {
        if (request.type === "hips") {
            const query = request.query;
            const center = typeof query.ra === "number" && typeof query.dec === "number" ? {x: query.ra, y: query.dec} : undefined;
            return {
                type: "hips",
                survey: query.hips ?? "",
                width: query.width ?? 0,
                height: query.height ?? 0,
                object: query.object || undefined,
                center: query.object ? undefined : center,
                fov: query.fov ?? 0,
                coordsys: (query.coordsys ?? "") as HipsCoord,
                projection: (query.projection ?? "") as HipsProjection,
                rotationAngle: query.rotationAngle ?? 0
            };
        }
        const sourceImageId = this.imageIdOf(request.source);
        if (sourceImageId === undefined) {
            return undefined;
        }
        if (request.type === "pv") {
            return {
                type: "pv",
                sourceImageId,
                regionId: request.regionId,
                width: request.width,
                channelRange: request.channelRange && {...request.channelRange},
                reverse: request.reverse,
                ...this.regionShapeFieldOf(request)
            };
        }
        if (request.type === "fitting") {
            return {...WorkspaceSnapshotter.workspaceFittingRequestOf(request, sourceImageId), ...this.regionShapeFieldOf(request)};
        }
        // Save only the moments whose images are still shown. The other images were closed.
        const moments = frames.map(frame => frame.generation?.moment);
        return {
            type: "moment",
            sourceImageId,
            regionId: request.regionId,
            moments: moments.every(moment => moment !== undefined) ? (moments as CARTA.Moment[]) : [...request.moments],
            channelRange: {...request.channelRange},
            mask: request.mask,
            pixelRange: {...request.pixelRange},
            ...this.regionShapeFieldOf(request)
        };
    }

    /**
     * Returns the shape of the region of a request as the workspace saves it, with the image that the
     * region belonged to. Returns no field when the request has no shape, or when that image is not saved.
     */
    private regionShapeFieldOf(request: {regionShape?: WorkspaceRegionShape; regionShapeOwner?: FrameStore}): {regionShape?: WorkspaceRegionShape} {
        const shape = request.regionShape;
        const imageId = request.regionShapeOwner ? this.imageIdOf(request.regionShapeOwner) : undefined;
        return shape && imageId !== undefined ? {regionShape: {regionType: shape.regionType, controlPoints: shape.controlPoints.map(({x, y}) => ({x, y})), rotation: shape.rotation, imageId}} : {};
    }

    /**
     * Returns an image fitting as the workspace saves it. An initial value that the backend
     * generates is NaN, and JSON cannot write NaN, so such a value is saved as null.
     */
    private static workspaceFittingRequestOf(request: Extract<ImageGenerationRequest, {type: "fitting"}>, sourceImageId: number): WorkspaceFittingRequest {
        const guess = (value: number | null | undefined): number | null => (typeof value === "number" && isFinite(value) ? value : null);
        const [center, size] = (request.fovInfo?.controlPoints ?? []) as Point2D[];
        return {
            type: "fitting",
            sourceImageId,
            regionId: request.regionId,
            fov: center && size ? {center: {x: center.x, y: center.y}, size: {x: size.x, y: size.y}, rotation: request.fovInfo?.rotation ?? 0} : undefined,
            components: request.initialValues.map(component => ({
                center: {x: guess(component.center?.x), y: guess(component.center?.y)},
                amp: guess(component.amp),
                fwhm: {x: guess(component.fwhm?.x), y: guess(component.fwhm?.y)},
                pa: guess(component.pa)
            })),
            fixedParams: [...request.fixedParams],
            offset: request.offset,
            solver: request.solver
        };
    }

    /** How an image would have to be opened to bring it back. */
    private static imageSourceOf(frame: FrameStore): WorkspaceImageSource {
        const {directory, hdu} = frame.frameInfo;
        const isLelExpr = frame.frameInfo.lelExpr;
        const name = frame.frameInfo.fileInfo.name;
        const stokesFiles = frame.stokesFiles;

        if (stokesFiles?.length) {
            return {
                type: "hypercube",
                directory,
                hdu,
                stokesFiles: stokesFiles.map(stokesFile => ({
                    directory: stokesFile.directory ?? undefined,
                    filename: stokesFile.file ?? "",
                    hdu: stokesFile.hdu ?? undefined,
                    polarizationType: stokesFile.polarizationType ?? undefined
                }))
            };
        }
        if (isLelExpr) {
            return {type: "lel", directory, expression: name};
        }
        return {type: "file", directory, filename: name, hdu};
    }

    /** Stage 2: the color-blended images made up of the images just captured. */
    private captureColorBlending(): void {
        for (const [id, colorBlending] of this.appStore.imageViewConfigStore.colorBlendingImageMap) {
            const index = this.appStore.imageViewConfigStore.getImageListIndex(ImageType.COLOR_BLENDING, id);
            const selectedFrameId = colorBlending.selectedFrames.map(frame => this.imageIdOf(frame));
            // Each alpha lines up with the image beside it, so a blend missing one is not worth
            // saving in part.
            if (selectedFrameId.some(imageId => imageId === undefined)) {
                this.issues.push({
                    kind: WorkspaceItemKind.ColorBlending,
                    subject: "",
                    message: "Could not save a color-blended image: one of the images it is made of was not saved"
                });
                continue;
            }
            const workspaceColorBlending: WorkspaceColorBlending = {
                name: colorBlending.filename,
                imageListIndex: index,
                selectedFrameId: selectedFrameId as number[],
                alpha: colorBlending.alpha,
                ...(colorBlending.isRasterVisible === false ? {rasterVisible: false} : {}),
                ...(colorBlending.isContourVisible === false ? {contourVisible: false} : {}),
                ...(colorBlending.isVectorOverlayVisible === false ? {vectorOverlayVisible: false} : {})
            };
            if (colorBlending.titleCustomText !== colorBlending.filename) {
                workspaceColorBlending.titleCustomText = colorBlending.titleCustomText;
            }
            this.workspace.colorBlendingImages.push(workspaceColorBlending);
        }
    }

    /** Stage 3: every loaded catalog, with the image it is overlaid on and how it is drawn. */
    private captureCatalogs(): void {
        const catalogs: WorkspaceCatalog[] = [];
        this.appStore.catalogStore.catalogProfileStores.forEach((profileStore, catalogFileId) => {
            const catalogInfo = profileStore.catalogInfo;
            let source: WorkspaceCatalogSource | undefined = catalogInfo.query;
            if (!source && profileStore.isFileBasedCatalog) {
                source = {type: "file", directory: catalogInfo.directory, filename: catalogInfo.fileInfo.name ?? ""};
            }
            if (!source) {
                this.issues.push({
                    kind: WorkspaceItemKind.Catalog,
                    subject: catalogInfo.fileInfo.name ?? "",
                    message: `Could not save the catalog ${catalogInfo.fileInfo.name}: there is no record of how it was opened`
                });
                return;
            }

            const workspaceCatalogId = this.catalogIdOf(catalogFileId);
            if (workspaceCatalogId === undefined) {
                this.issues.push({
                    kind: WorkspaceItemKind.Catalog,
                    subject: catalogInfo.fileInfo.name ?? "",
                    message: `Could not save the catalog ${catalogInfo.fileInfo.name}: it is not one this session opened`
                });
                return;
            }

            // A catalog names its image by the ID this workspace knows the image by, not by the
            // session file ID, which is handed out again once the image is closed. A catalog whose
            // image the workspace does not save is not saved either. Examples are a generated image
            // that no saved request makes, or an image that the session lost track of. Restoring the
            // catalog would put it over whichever image happened to be in front.
            const imageFileId = this.appStore.catalogStore.imageIdOf(catalogFileId);
            const associatedImageId = this.imageIdOf(this.appStore.frames.find(frame => frame?.frameInfo.fileId === imageFileId));
            if (associatedImageId === undefined) {
                this.issues.push({
                    kind: WorkspaceItemKind.Catalog,
                    subject: catalogInfo.fileInfo.name ?? "",
                    message: `Could not save the catalog ${catalogInfo.fileInfo.name}: the image it is overlaid on was not saved`
                });
                return;
            }

            // Deliberately do not create display state while saving.
            const displayStore = this.appStore.catalogStore.getCatalogDisplayStore(catalogFileId);
            const selectedDataIndices = profileStore.rows.getSortedIndices(profileStore.selectedPointIndices);
            // Too large a selection is left out whole, along with showing only the selected rows,
            // which would show nothing without it.
            const isSelectionTooLarge = selectedDataIndices.length > WorkspaceSnapshotter.MAX_SAVED_SELECTED_ROWS;
            if (isSelectionTooLarge) {
                this.issues.push({
                    kind: WorkspaceItemKind.CatalogSelection,
                    subject: catalogInfo.fileInfo.name ?? "",
                    message: `Could not save the selected rows of the catalog ${catalogInfo.fileInfo.name}: ${selectedDataIndices.length} rows are selected, more than the ${WorkspaceSnapshotter.MAX_SAVED_SELECTED_ROWS} a workspace keeps`,
                    hint: `Select at most ${WorkspaceSnapshotter.MAX_SAVED_SELECTED_ROWS.toLocaleString("en-US")} rows`
                });
            }
            if (this.isCheckOnly) {
                return;
            }
            const rowSelection = isSelectionTooLarge ? undefined : fingerprintCatalogSelection(profileStore.catalogHeader, profileStore.rows.data, selectedDataIndices);
            const selection = rowSelection ? {...rowSelection, isShowingSelectedData: displayStore?.isShowingSelectedData || undefined} : undefined;

            catalogs.push({
                id: workspaceCatalogId,
                source,
                coordinateSystem: profileStore.catalogCoordinateSystem.system,
                associatedImageId,
                rowCount: catalogInfo.dataSize,
                tableConfig: profileStore.toTableConfig(),
                // Only an online catalog is worth fingerprinting: it is queried again rather than
                // stored, and it is the only kind that holds all of its rows in the session.
                contentHash: profileStore.isFileBasedCatalog ? undefined : hashCatalogContent(profileStore.catalogHeader, profileStore.rows.originalData),
                displayConfig: displayStore?.toConfig(),
                selection: selection && (selection.rowHashes.length || selection.isShowingSelectedData) ? selection : undefined
            });
        });

        this.workspace.catalogs = catalogs;
        // Save the mirror that each online database answered from, so that the workspace asks the same mirror again.
        const mirrors: Partial<Record<CatalogDatabase, string>> = {};
        for (const {source} of catalogs) {
            const database = source.type === "simbad" ? CatalogDatabase.SIMBAD : source.type === "vizier" ? CatalogDatabase.VIZIER : undefined;
            const mirror = database ? MirrorSiteStore.Instance.getActiveMirror(database) : undefined;
            if (database && mirror) {
                mirrors[database] = mirror;
            }
        }
        if (Object.keys(mirrors).length) {
            this.workspace.catalogMirrors = mirrors;
        }
    }

    /** Stage 4: what each catalog widget and each profile, analysis and statistics widget shows. Catalogs and images are named by their workspace IDs. */
    private captureViews(): void {
        // Only the catalogs stage 3 saved: a widget must not name one this workspace does not carry.
        const savedCatalogIds = new Set((this.workspace.catalogs ?? []).map(catalog => catalog.id));
        const catalogWidgets = this.appStore.catalogStore.widgetBindings.savedCatalogWidgets(savedCatalogIds);
        if (Object.keys(catalogWidgets).length > 0) {
            this.workspace.catalogWidgets = catalogWidgets;
        }

        // Name only the images that the workspace saves. A widget that shows another image is saved without its image. On restore, it shows the active image.
        const savedImageIds = new Set([...this.workspace.files, ...(this.workspace.generatedImages ?? []).flatMap(generated => generated.images)].map(image => image.id));
        const plotWidgets = this.appStore.widgetsStore.savedPlotWidgets({
            imageIdOf: fileId => {
                const imageId = this.imageIdOf(this.appStore.getFrame(fileId));
                return imageId !== undefined && savedImageIds.has(imageId) ? imageId : undefined;
            }
        });
        if (Object.keys(plotWidgets).length > 0) {
            this.workspace.plotWidgets = plotWidgets;
        }
        this.captureImageFitting(savedImageIds);
    }

    /**
     * Saves the settings of the Image Fitting dialog. When the dialog fits an image that the
     * workspace does not save, the dialog fits the active image after a restore. A region belongs to
     * its image, so the dialog then fits the field of view.
     */
    private captureImageFitting(savedImageIds: Set<number>): void {
        const fittingStore = this.appStore.imageFittingStore;
        const frame = fittingStore.selectedFileId === ACTIVE_FILE_ID ? undefined : this.appStore.getFrame(fittingStore.selectedFileId);
        const imageId = frame ? this.imageIdOf(frame) : undefined;
        const isImageSaved = imageId !== undefined && savedImageIds.has(imageId);
        const regionId = frame && !isImageSaved && fittingStore.selectedRegionId > 0 ? 0 : fittingStore.selectedRegionId;
        this.workspace.imageFitting = fittingStore.toWorkspaceConfig(isImageSaved ? imageId : undefined, regionId);
    }

    /**
     * Stage 5: the arrangement the session is showing.
     *
     * A workspace carries its own copy, so that reopening it brings back the widgets showing its
     * images and catalogs without depending on a separately saved layout. The copy is written in
     * the workspace form. So it also keeps the own ID of each widget and the settings that only a
     * workspace needs. The layout names no catalog: which catalog a table or plot widget shows is
     * kept in `catalogWidgets` instead.
     */
    private captureLayout(): void {
        const layout = this.appStore.layoutStore.currentLayoutConfig("workspace");
        // Leave out a floating PV Preview Viewer. The PV generator widget saves the preview and where
        // the floating viewer is, and a restore makes the preview and the viewer again. A viewer in the
        // layout would open again as a second, empty viewer. Keep a docked viewer that names its PV
        // generator. A restore shows the preview in it again. Leave out any other docked viewer.
        if (layout && Array.isArray(layout.floating)) {
            layout.floating = layout.floating.filter((widget: {id?: string}) => widget?.id !== "pv-preview");
        }
        if (layout?.docked) {
            WorkspaceSnapshotter.removeDockedPvPreviews(layout.docked);
        }
        this.saveRestFrequencyImages(layout);
        this.workspace.layout = layout;
        // The custom texts describe the images, so the workspace saves them apart from the layout copy.
        this.workspace.wcsOverlay = this.appStore.overlaySettings.toTextConfig();
        // Leave the size out when the image view is not shown. A size of 1 or less means that it was
        // never shown. An image view that is closed or behind another tab keeps the size that it had
        // when it was last shown, and that size can be wrong now. A PV preview is drawn in the PV
        // generator, not in the image view, so the size of another image is saved while a preview is
        // active.
        const activeFrame = this.appStore.activeFrame;
        const frame = activeFrame && !activeFrame.isPreview ? activeFrame : this.appStore.frames[0];
        if (frame && frame.renderWidth > 1 && frame.renderHeight > 1 && !this.appStore.layoutStore.isComponentHidden("image-view")) {
            this.workspace.imageView = {
                width: frame.renderWidth,
                height: frame.renderHeight,
                devicePixelRatio: this.appStore.devicePixelRatio,
                fullWidth: this.appStore.fullViewWidth,
                fullHeight: this.appStore.fullViewHeight,
                viewport: {width: window.innerWidth, height: window.innerHeight}
            };
        }
    }

    /**
     * Removes the PV Preview Viewers that name no PV generator from a docked layout. Removes a
     * container that is left empty, because a layout does not accept an empty one. Keeps the shown
     * tab of a stack on the same widget.
     *
     * @returns whether the container still has content.
     */
    private static removeDockedPvPreviews(container: {content?: any[]; activeItemIndex?: number}): boolean {
        if (!Array.isArray(container.content)) {
            return true;
        }
        const isPvPreview = (item: any) => item?.type === "component" && typeof item.id === "string" && /(^|-)pv-preview$/.test(item.id) && typeof item.widgetSettings?.pvGeneratorId !== "string";
        const kept: any[] = [];
        let activeIndex = container.activeItemIndex ?? 0;
        container.content.forEach((item, index) => {
            const isKept = !isPvPreview(item) && (item?.type === "component" || WorkspaceSnapshotter.removeDockedPvPreviews(item));
            if (isKept) {
                kept.push(item);
            } else if (index < (container.activeItemIndex ?? 0)) {
                activeIndex--;
            }
        });
        container.content = kept;
        if (container.activeItemIndex !== undefined) {
            activeIndex = Math.min(Math.max(activeIndex, 0), kept.length - 1);
            if (activeIndex > 0) {
                container.activeItemIndex = activeIndex;
            } else {
                delete container.activeItemIndex;
            }
        }
        return kept.length > 0;
    }

    /**
     * Saves the image that the rest frequency tab of each Image List shows by its place among the
     * images that the workspace saves. A restore opens only those images, in their order. When the
     * workspace does not save the image itself, the tab shows the active image after a restore.
     */
    private saveRestFrequencyImages(layout: {docked?: unknown; floating?: unknown[]} | undefined): void {
        const frames = this.appStore.frames ?? [];
        const isSaved = (frame: FrameStore) => this.imageIdOf(frame) !== undefined;
        const visit = (node: any) => {
            if (!node || typeof node !== "object") {
                return;
            }
            const settings = node.widgetSettings;
            if (node.id === "layer-list" && typeof settings?.restFrequencyImageIndex === "number") {
                const index = settings.restFrequencyImageIndex;
                if (frames[index] && isSaved(frames[index])) {
                    settings.restFrequencyImageIndex = frames.slice(0, index).filter(isSaved).length;
                } else {
                    delete settings.restFrequencyImageIndex;
                }
            }
            (Array.isArray(node.content) ? node.content : []).forEach(visit);
        };
        visit(layout?.docked);
        (layout?.floating ?? []).forEach(visit);
    }

    /**
     * Saves the floating settings panels of widgets, from the bottom one to the top one. The viewer
     * of a PV preview is not a settings panel. The PV generator widget saves it with the preview.
     */
    private captureWidgetSettings(): void {
        const widgetsStore = this.appStore.widgetsStore;
        const zIndexManager = this.appStore.zIndexManager;
        if (!widgetsStore?.floatingWidgets) {
            return;
        }
        const panels = widgetsStore.floatingWidgets.filter(config => config.type === "floating-settings" && config.parentId && config.parentType).sort((a, b) => (zIndexManager?.findIndex(a.id) ?? 0) - (zIndexManager?.findIndex(b.id) ?? 0));
        // A floating widget is stacked by its component ID when it has one, such as a catalog plot.
        const panelIds = new Set(panels.map(config => config.id));
        const widgetIds = widgetsStore.floatingWidgets.filter(config => !panelIds.has(config.id)).map(config => config.componentId || config.id);
        const zIndexOf = (id: string) => zIndexManager?.findIndex(id) ?? 0;
        this.workspace.openWidgetSettings = panels.map(config => ({
            widgetId: widgetsStore.workspaceIdOf(config.parentType!, config.parentId!),
            widgetType: config.parentType!,
            // The panel is titled "<title of the widget> Settings", and some panels add what they show, such as ": Region #1".
            title: (config.title ?? "").replace(/ Settings.*$/, ""),
            x: config.defaultX,
            y: config.defaultY,
            width: config.defaultWidth,
            height: config.defaultHeight,
            ...(zIndexManager && widgetIds.length ? {widgetsBelow: widgetIds.filter(id => zIndexOf(id) < zIndexOf(config.id)).length} : {})
        }));
    }

    /**
     * Returns the floating widgets and settings panels that a restore opens again, by the IDs that
     * they are stacked by. A catalog plot is stacked by its component ID. The viewer of a PV preview
     * is one of them, because the restore makes the preview again before it stacks the dialogs.
     */
    private get restoredFloatingWidgetIds(): string[] {
        return (this.appStore.widgetsStore?.floatingWidgets ?? []).map(config => config.componentId || config.id);
    }

    /** Returns where an open dialog is, the tab that it shows, and how many floating widgets are below it. */
    private captureDialog(id: string): WorkspaceDialog {
        const dialogStore = this.appStore.dialogStore;
        const zIndexManager = this.appStore.zIndexManager;
        const dialog: WorkspaceDialog = {};
        // Without floating widgets, the order of the dialogs alone is enough.
        const widgetIds = this.restoredFloatingWidgetIds;
        if (zIndexManager && widgetIds.length) {
            const index = zIndexManager.findIndex(id) ?? 0;
            dialog.widgetsBelow = widgetIds.filter(widgetId => (zIndexManager.findIndex(widgetId) ?? 0) < index).length;
        }
        const geometry = dialogStore.dialogGeometries?.get(id);
        if (geometry) {
            Object.assign(dialog, geometry);
        }
        const tab = dialogStore.selectedTabOf?.(id);
        const tabName = Object.entries(WORKSPACE_DIALOG_TABS[id] ?? {}).find(([, value]) => value === tab)?.[0];
        if (tabName !== undefined) {
            dialog.tab = tabName;
        }
        if (id === DialogId.FileInfo && typeof dialogStore.fileInfoSearchString === "string") {
            dialog.search = dialogStore.fileInfoSearchString;
        }
        if (id === DialogId.Fitting && typeof dialogStore.fittingSettingsHeight === "number") {
            dialog.settingsHeight = dialogStore.fittingSettingsHeight;
        }
        return dialog;
    }

    /** Stage 6: the state that only makes sense once everything it names has been captured. */
    private captureSelection(): void {
        this.workspace.selectedFile = this.imageIdOf(this.appStore.activeFrame);
        // Save the open dialogs from the bottom one to the top one, so that a restore stacks them in this order.
        const dialogStore = this.appStore.dialogStore;
        const zIndexManager = this.appStore.zIndexManager;
        if (dialogStore?.dialogVisible) {
            this.workspace.openDialogs = WORKSPACE_DIALOGS.filter(id => dialogStore.dialogVisible.get(id)).sort((a, b) => (zIndexManager?.findIndex(a) ?? 0) - (zIndexManager?.findIndex(b) ?? 0));
            const dialogs = Object.fromEntries(this.workspace.openDialogs.map(id => [id, this.captureDialog(id)]).filter(([, dialog]) => Object.keys(dialog).length));
            if (Object.keys(dialogs).length) {
                this.workspace.dialogs = dialogs;
            }
        }
        const dialogSettings = this.captureDialogSettings();
        if (dialogSettings) {
            this.workspace.dialogSettings = dialogSettings;
        }
        this.captureWidgetSettings();
        const isCursorFrozen = this.appStore.isCursorFrozen === true;
        const cursorPosition = this.appStore.activeFrame?.cursorInfo?.posImageSpace;
        // Leave out a position that is not a number, such as a point that matching could not transform.
        // The workspace schema checks the position, so such a value would stop the workspace from saving.
        const isFinitePosition = Number.isFinite(cursorPosition?.x) && Number.isFinite(cursorPosition?.y);
        this.workspace.cursor = {frozen: isCursorFrozen, ...(cursorPosition && isFinitePosition ? {position: {x: cursorPosition.x, y: cursorPosition.y}} : {}), ...(this.appStore.isCursorMirrored === true ? {mirrored: true} : {})};
        const beamFileId = this.appStore.overlaySettings?.beam?.selectedFileId;
        const beamImageId = typeof beamFileId === "number" && beamFileId !== this.appStore.activeFrame?.frameInfo.fileId ? this.imageIdOf(this.appStore.getFrame(beamFileId)) : undefined;
        if (beamImageId !== undefined) {
            this.workspace.beamSettingsImageId = beamImageId;
        }
        const regionSet = this.appStore.activeFrame?.regionSet;
        this.workspace.toolbar = {
            expanded: this.appStore.isToolbarExpanded !== false,
            activeLayer: this.appStore.activeLayer,
            ...(regionSet ? {newRegionType: regionSet.newRegionType, regionMode: regionSet.mode} : {})
        };
        this.workspace.onlineCatalogQuery = CatalogOnlineQueryConfigStore.Instance.toWorkspaceConfig();
        this.workspace.hipsQuery = HipsQueryStore.Instance.toWorkspaceConfig();
        if (this.appStore.shouldMatchMoment === false) {
            this.workspace.momentAutoMatching = false;
        }
        const animator = this.appStore.animatorStore;
        this.workspace.animator = {frameRate: animator.frameRate, step: animator.step, playMode: animator.playMode, mode: animator.animationMode, numericInputType: animator.numericInputType};
        this.workspace.log = {level: this.appStore.logStore.logLevel, hiddenTags: [...this.appStore.logStore.hiddenTags]};
        // The Contour dialog follows the active image by default. Save only the image it shows when it does not.
        const contourImageId = this.appStore.isFrameLockedToContour ? undefined : this.imageIdOf(this.appStore.contourDataSource);
        if (contourImageId !== undefined) {
            this.workspace.contourDataSource = {imageId: contourImageId};
        }
        const activeImage = this.appStore.activeImage;
        if (activeImage?.type === ImageType.COLOR_BLENDING) {
            const index = this.appStore.imageViewConfigStore.getImageListIndex(ImageType.COLOR_BLENDING, activeImage.store.id);
            if (this.workspace.colorBlendingImages.some(colorBlending => colorBlending.imageListIndex === index)) {
                this.workspace.selectedColorBlending = index;
            }
        }
    }

    /**
     * Cut the workspace loose from the session.
     *
     * What the stages collect still points at the session's own observables, and saving is not
     * instantaneous, so copy it before anything else gets a chance to change underneath.
     */
    private detach(): Workspace {
        return JSON.parse(JSON.stringify(this.workspace));
    }
}
