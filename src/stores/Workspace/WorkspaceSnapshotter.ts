import {CARTA} from "carta-protobuf";

import {CatalogDatabase, type HipsCoord, type HipsProjection, ImageType, RegionId, RegionOpacity, WORKSPACE_DIALOGS, WorkspaceItemKind} from "enums";
import {
    CARTA_INFO,
    type Point2D,
    type Workspace,
    WORKSPACE_VERSION,
    type WorkspaceCatalog,
    type WorkspaceCatalogSource,
    type WorkspaceColorBlending,
    type WorkspaceFile,
    type WorkspaceFittingRequest,
    type WorkspaceGenerationRequest,
    type WorkspaceImageSource,
    type WorkspaceIssue
} from "models";
import {AppStore, CatalogOnlineQueryConfigStore, MirrorSiteStore} from "stores";
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

/** Calls `visit` with each image view widget in a layout config, docked or floating. */
function forEachImageView(node: unknown, visit: (imageView: {widgetSettings?: Record<string, unknown>}) => void): void {
    if (Array.isArray(node)) {
        node.forEach(child => forEachImageView(child, visit));
    } else if (node && typeof node === "object") {
        const config = node as Record<string, unknown>;
        if (config.type === "component" && config.id === "image-view") {
            visit(config as {widgetSettings?: Record<string, unknown>});
        }
        Object.values(config).forEach(child => forEachImageView(child, visit));
    }
}

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

    /** One entry per item that could not be captured as it stands. */
    private readonly issues: WorkspaceIssue[] = [];
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
            this.workspace.files.push(this.captureImage(frame, workspaceImageId, WorkspaceSnapshotter.imageSourceOf(frame)));
        }

        if (hasTemporaryFiles) {
            this.issues.push({
                kind: WorkspaceItemKind.Image,
                subject: "",
                message: "The workspace contains generated files. These will not be preserved when reloading."
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
                } else if (problem === "waiting") {
                    waiting.push(group);
                } else {
                    this.reportUnsavedRequest(group.request, problem);
                }
            }
            pending = waiting;
        }
        // The requests that are still waiting are made from an image that is not saved.
        pending.forEach(group => this.reportUnsavedRequest(group.request, "the image it was made from was not saved"));
    }

    /**
     * Returns why a request cannot be saved, or "waiting" when the data that it is made from may
     * still be saved.
     *
     * @returns nothing when the request can be saved.
     */
    private whyNotSavable({request, frames}: GeneratedImageGroup): string | "waiting" | undefined {
        if (request.type === "hips") {
            return undefined;
        }
        // Moment images are told apart by their moments. Without the moments, the images can be
        // told apart only when all of them remain, in the order that they were made.
        if (request.type === "moment" && frames.some(frame => frame.generation?.moment === undefined) && frames.length !== request.moments.length) {
            return "it cannot tell which moment each of its images is";
        }
        const source = request.source;
        if (!this.appStore.frames.includes(source)) {
            return "the image it was made from is closed";
        }
        // Use the region of the image that the source is shown with. When the source is matched to
        // another image, the region belongs to that image.
        const regionOwner = source.spatialReference ?? source;
        for (const image of [source, regionOwner]) {
            if (image.frameInfo.generated && !this.savedGeneratedImages.has(image)) {
                return image.generation ? "waiting" : "the image it was made from was not saved";
            }
        }
        if (this.imageIdOf(source) === undefined || this.imageIdOf(regionOwner) === undefined) {
            return "the image it was made from was not saved";
        }
        if (request.regionId > RegionId.CURSOR && !source.regionSet?.regions.some(region => region.regionId === request.regionId && !region.isTemporary)) {
            return "the region it was made over has been deleted";
        }
        return undefined;
    }

    private reportUnsavedRequest(request: ImageGenerationRequest, reason: string): void {
        const subject = WorkspaceSnapshotter.describeRequest(request);
        this.issues.push({kind: WorkspaceItemKind.GeneratedImage, subject, message: `Could not save ${subject}: ${reason}`});
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
        } else if (frame.regionSet?.regions.length) {
            // Regions are only the image's own while it is not matched to another one.
            const selectedRegions = Array.from(frame.regionSet.selectedRegionIds ?? []);
            workspaceFile.regionsSet = {
                selectedRegion: frame.regionSet.focusedRegion?.regionId,
                ...(selectedRegions.length > 1 ? {selectedRegions} : {}),
                regions: this.captureRegions(frame)
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
        if (!frame.spatialReference && frame.isOffsetCoord && frame.offsetCenter) {
            workspaceFile.offsetCoordinates = {center: {...frame.offsetCenter}, skyRefIs: frame.skyRefIs};
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
        workspaceFile.channel = frame.channel;
        workspaceFile.stokes = frame.stokes;

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

        return workspaceFile;
    }

    private captureRegions(frame: FrameStore): NonNullable<NonNullable<WorkspaceFile["regionsSet"]>["regions"]> {
        return frame.regionSet.regions
            .filter(region => region.regionId !== CURSOR_REGION_ID)
            .map(region => ({
                id: region.regionId,
                type: region.regionType,
                rotation: region.rotation,
                points: region.controlPoints,
                name: region.name,
                color: region.color,
                lineWidth: region.lineWidth,
                locked: region.isLocked,
                dashes: region.dashLength ? [region.dashLength] : [],
                // Check if styles are available. If so, add them to the region
                annotationStyles: (region as any).getAnnotationStyles?.(),
                lineRegionSampleWidth: region.regionType === CARTA.RegionType.LINE || region.regionType === CARTA.RegionType.POLYLINE ? region.lineRegionSampleWidth : undefined,
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
            return {type: "pv", sourceImageId, regionId: request.regionId, width: request.width, channelRange: request.channelRange && {...request.channelRange}, reverse: request.reverse};
        }
        if (request.type === "fitting") {
            return WorkspaceSnapshotter.workspaceFittingRequestOf(request, sourceImageId);
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
            pixelRange: {...request.pixelRange}
        };
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
                    message: `Could not save the selected rows of the catalog ${catalogInfo.fileInfo.name}: ${selectedDataIndices.length} rows are selected, more than the ${WorkspaceSnapshotter.MAX_SAVED_SELECTED_ROWS} a workspace keeps`
                });
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
     * images and catalogs without depending on a separately saved layout. The layout names no
     * catalog: which catalog a table or plot widget shows is kept in `catalogWidgets` instead.
     */
    private captureLayout(): void {
        this.workspace.layout = this.appStore.layoutStore.currentLayoutConfig();
        // A saved layout leaves out the overlay settings that have a preference. A workspace shows
        // the same overlay on any computer, so its layout keeps them as they are shown.
        const wcsOverlay = this.appStore.overlaySettings.toConfig(true);
        forEachImageView(this.workspace.layout, imageView => {
            if (imageView.widgetSettings) {
                imageView.widgetSettings.wcsOverlay = wcsOverlay;
            }
        });
        // The custom texts describe the images, so the workspace saves them.
        this.workspace.wcsOverlay = this.appStore.overlaySettings.toTextConfig();
        // A size of 1 or less means that the image view is not shown, so the size is left out.
        const frame = this.appStore.activeFrame;
        if (frame && frame.renderWidth > 1 && frame.renderHeight > 1) {
            this.workspace.imageView = {width: frame.renderWidth, height: frame.renderHeight, pixelRatio: this.appStore.pixelRatio};
        }
    }

    /**
     * Saves the floating settings panels of widgets, from the bottom one to the top one. The panel
     * of a PV preview is left out, because a restore does not make the preview again.
     */
    private captureWidgetSettings(): void {
        const widgetsStore = this.appStore.widgetsStore;
        const zIndexManager = this.appStore.zIndexManager;
        if (!widgetsStore?.floatingWidgets) {
            return;
        }
        const panels = widgetsStore.floatingWidgets
            .filter(config => config.type === "floating-settings" && config.parentId && config.parentType && config.parentType !== "pv-generator")
            .sort((a, b) => (zIndexManager?.findIndex(a.id) ?? 0) - (zIndexManager?.findIndex(b.id) ?? 0));
        this.workspace.openWidgetSettings = panels.map(config => ({
            widgetId: widgetsStore.workspaceIdOf(config.parentType!, config.parentId!),
            widgetType: config.parentType!,
            // The panel is titled "<title of the widget> Settings", and some panels add what they show, such as ": Region #1".
            title: (config.title ?? "").replace(/ Settings.*$/, ""),
            x: config.defaultX,
            y: config.defaultY,
            width: config.defaultWidth,
            height: config.defaultHeight
        }));
    }

    /** Stage 6: the state that only makes sense once everything it names has been captured. */
    private captureSelection(): void {
        this.workspace.selectedFile = this.imageIdOf(this.appStore.activeFrame);
        // Save the open dialogs from the bottom one to the top one, so that a restore stacks them in this order.
        const dialogStore = this.appStore.dialogStore;
        const zIndexManager = this.appStore.zIndexManager;
        if (dialogStore?.dialogVisible) {
            this.workspace.openDialogs = WORKSPACE_DIALOGS.filter(id => dialogStore.dialogVisible.get(id)).sort((a, b) => (zIndexManager?.findIndex(a) ?? 0) - (zIndexManager?.findIndex(b) ?? 0));
        }
        this.captureWidgetSettings();
        const isCursorFrozen = this.appStore.isCursorFrozen === true;
        const cursorPosition = this.appStore.activeFrame?.cursorInfo?.posImageSpace;
        this.workspace.cursor = {frozen: isCursorFrozen, ...(isCursorFrozen && cursorPosition ? {position: {x: cursorPosition.x, y: cursorPosition.y}} : {})};
        this.workspace.onlineCatalogQuery = CatalogOnlineQueryConfigStore.Instance.toWorkspaceConfig();
        const animator = this.appStore.animatorStore;
        this.workspace.animator = {frameRate: animator.frameRate, step: animator.step, playMode: animator.playMode, mode: animator.animationMode};
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
