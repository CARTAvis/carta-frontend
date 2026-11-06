import {CARTA} from "carta-protobuf";

import {type HipsCoord, type HipsProjection, ImageType, RegionId, RegionOpacity, WorkspaceItemKind} from "enums";
import {CARTA_INFO, type Workspace, WORKSPACE_VERSION, type WorkspaceCatalog, type WorkspaceCatalogSource, type WorkspaceFile, type WorkspaceGenerationRequest, type WorkspaceImageSource, type WorkspaceIssue} from "models";
import {AppStore} from "stores";
import {CURSOR_REGION_ID, type FrameStore, type ImageGenerationRequest} from "stores/Frame";
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

/** The workspace while it is being filled in: the collections the stages append to are already there. */
type WorkspaceUnderConstruction = Workspace & Required<Pick<Workspace, "files" | "colorBlendingImages" | "references">>;

/**
 * Takes what the running session is showing and turns it into a workspace, one named stage at a
 * time.
 *
 * This is the counterpart of {@link WorkspaceRestorer}: the stages here mirror the ones there, so
 * that whatever a stage writes has a stage that reads it back. The snapshotter owns which items
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

    /** Stage 1: every image, with how it was opened and how it is displayed. */
    private captureImages(): void {
        const references = this.workspace.references;
        references.spatial = this.imageIdOf(this.appStore.spatialReference);
        references.spectral = this.imageIdOf(this.appStore.spectralReference);
        references.raster = this.imageIdOf(this.appStore.rasterScalingReference);

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
            timeSeriesMember: this.appStore.timeSeriesStore.isMember(frame) || undefined
        };
        workspaceFile.references = {};

        if (frame.spatialReference) {
            workspaceFile.references.spatial = this.imageIdOf(frame.spatialReference);
        } else if (frame.regionSet?.regions.length) {
            // Regions are only the image's own while it is not matched to another one.
            workspaceFile.regionsSet = {
                selectedRegion: frame.regionSet.focusedRegion?.regionId,
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
        // Save offset coordinates only on an image that is not matched to another image, as for regions. A matched image uses the offset coordinates of its reference image.
        if (!frame.spatialReference && frame.isOffsetCoord && frame.offsetCenter) {
            workspaceFile.offsetCoordinates = {center: {...frame.offsetCenter}, skyRefIs: frame.skyRefIs};
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
                // Save the image without a source, because a restore makes it again.
                const image = this.captureImage(frame, workspaceImageId, undefined);
                return [{...image, name: frame.frameInfo.fileInfo.name ?? undefined, moment: frame.generation?.moment}];
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
            this.workspace.colorBlendingImages.push({imageListIndex: index, selectedFrameId: selectedFrameId as number[], alpha: colorBlending.alpha});
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
            // image the workspace does not carry -- a generated one, or one it has lost track of --
            // is not saved: restoring it would put it over whichever image happened to be in front.
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
    }

    /** Stage 4: what each catalog table and plot widget shows, naming catalogs by the workspace's own IDs. */
    private captureViews(): void {
        // Only the catalogs stage 3 saved: a widget must not name one this workspace does not carry.
        const savedCatalogIds = new Set((this.workspace.catalogs ?? []).map(catalog => catalog.id));
        const catalogWidgets = this.appStore.catalogStore.widgetBindings.savedCatalogWidgets(savedCatalogIds);
        if (Object.keys(catalogWidgets).length > 0) {
            this.workspace.catalogWidgets = catalogWidgets;
        }

        // Save only the widgets that show an image that stage 1 saved, like the catalogs above.
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
    }

    /** Stage 6: the state that only makes sense once everything it names has been captured. */
    private captureSelection(): void {
        this.workspace.selectedFile = this.imageIdOf(this.appStore.activeFrame);
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
