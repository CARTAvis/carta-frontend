import {ImageType, WorkspaceItemKind} from "enums";
import {CARTA_INFO, type Workspace, WORKSPACE_VERSION, type WorkspaceCatalog, type WorkspaceCatalogSource, type WorkspaceFile, type WorkspaceImageSource, type WorkspaceIssue} from "models";
import {AppStore} from "stores";
import {CURSOR_REGION_ID, type FrameStore} from "stores/Frame";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";
import {fingerprintCatalogSelection, hashCatalogContent} from "utilities";

/** What a capture produced, and what it could not take with it. */
export interface WorkspaceSnapshot {
    workspace: Workspace;
    /** One entry per item that could not be captured as it stands. */
    issues: WorkspaceIssue[];
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
    /** One entry per item that could not be captured as it stands. */
    private readonly issues: WorkspaceIssue[] = [];
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
        this.captureImages();
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
            // A generated image has no source to open it from again.
            if (frame?.frameInfo?.generated) {
                hasTemporaryFiles = true;
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
            this.workspace.files.push(this.captureImage(frame, workspaceImageId));
        }

        if (hasTemporaryFiles) {
            this.issues.push({
                kind: WorkspaceItemKind.Image,
                subject: "",
                message: "The workspace contains generated files. These will not be preserved when reloading."
            });
        }
    }

    /** The ID this workspace knows an image by: the one it was given when it was opened. */
    private imageIdOf(frame: FrameStore | undefined | null): number | undefined {
        return this.imageIdOfFile(frame?.frameInfo.fileId);
    }

    /** The same ID, for an image named only by the file ID this session gave it. */
    private imageIdOfFile(imageFileId: number | undefined): number | undefined {
        return WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Image, imageFileId);
    }

    /** The ID this workspace knows a catalog by: the one it was given when it was opened. */
    private catalogIdOf(catalogFileId: number | undefined): number | undefined {
        return WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, catalogFileId);
    }

    /** One image: how it would have to be opened, and everything it is shown with. */
    private captureImage(frame: FrameStore, workspaceImageId: number): WorkspaceFile {
        const workspaceFile: WorkspaceFile = {
            id: workspaceImageId,
            source: WorkspaceSnapshotter.imageSourceOf(frame),
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
                annotationStyles: (region as any).getAnnotationStyles?.()
            }));
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

    /** Stage 2: the colour-blended images made up of the images just captured. */
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
                    message: "Could not save a colour-blended image: one of the images it is made of was not saved"
                });
                continue;
            }
            this.workspace.colorBlendingImages.push({imageListIndex: index, selectedFrameId: selectedFrameId as number[], alpha: colorBlending.alpha});
        }
    }

    /** Stage 3: every loaded catalog, with the image it is overlaid on and how it is drawn. */
    private captureCatalogs(): void {
        const catalogs: WorkspaceCatalog[] = [];
        // A catalog names its image by the ID this workspace knows the image by. The association is
        // held under the session file ID of the image, which is handed out again to another file
        // once this one is closed, and is not what the restorer looks an image up by.
        const imageOfCatalog = new Map<number, number>();
        this.appStore.catalogStore.imageAssociatedCatalogId.forEach((catalogFileIds, imageFileId) => {
            const workspaceImageId = this.imageIdOfFile(imageFileId);
            if (workspaceImageId === undefined) {
                return;
            }
            catalogFileIds.forEach(catalogFileId => imageOfCatalog.set(catalogFileId, workspaceImageId));
        });

        this.appStore.catalogStore.catalogProfileStores.forEach((profileStore, catalogFileId) => {
            const catalogInfo = profileStore.catalogInfo;
            let source: WorkspaceCatalogSource | undefined = catalogInfo.query;
            if (!source && profileStore.isFileBasedCatalog) {
                source = {type: "file", directory: catalogInfo.directory, filename: catalogInfo.fileInfo.name ?? ""};
            }
            if (!source) {
                return;
            }

            // Deliberately do not create display state while saving.
            const displayStore = this.appStore.catalogStore.getCatalogDisplayStore(catalogFileId);
            const selectedDataIndices = profileStore.getSortedIndices(profileStore.selectedPointIndices);
            const rowSelection = fingerprintCatalogSelection(profileStore.catalogHeader, profileStore.catalogData, selectedDataIndices);
            const selection = rowSelection ? {...rowSelection, isShowingSelectedData: displayStore?.isShowingSelectedData || undefined} : undefined;

            const workspaceCatalogId = this.catalogIdOf(catalogFileId);
            if (workspaceCatalogId === undefined) {
                this.issues.push({
                    kind: WorkspaceItemKind.Catalog,
                    subject: catalogInfo.fileInfo.name ?? "",
                    message: `Could not save the catalog ${catalogInfo.fileInfo.name}: it is not one this session opened`
                });
                return;
            }

            catalogs.push({
                id: workspaceCatalogId,
                source,
                coordinateSystem: profileStore.catalogCoordinateSystem.system,
                associatedImageId: imageOfCatalog.get(catalogFileId),
                rowCount: catalogInfo.dataSize,
                tableConfig: profileStore.toTableConfig(),
                // Only an online catalog is worth fingerprinting: it is queried again rather than
                // stored, and it is the only kind that holds all of its rows in the session.
                contentHash: profileStore.isFileBasedCatalog ? undefined : hashCatalogContent(profileStore.catalogHeader, profileStore.catalogOriginalData),
                displayConfig: displayStore?.toConfig(),
                selection: selection && (selection.rowHashes.length || selection.isShowingSelectedData) ? selection : undefined
            });
        });

        this.workspace.catalogs = catalogs;
    }

    /** Stage 4: which catalog each panel is showing, named by the workspace's own catalog IDs. */
    private captureViews(): void {
        const selectedCatalogIds: Record<string, number> = {};
        this.appStore.widgetsStore.catalogWidgets.forEach((widgetStore, componentId) => {
            const widgetId = widgetStore.widgetId || componentId;
            const catalogFileId = widgetStore.selectedCatalogId;
            // A panel restored for a catalog that was unavailable keeps naming that catalog.
            if (widgetStore.unavailableWorkspaceCatalogId !== undefined) {
                selectedCatalogIds[widgetId] = widgetStore.unavailableWorkspaceCatalogId;
            } else if (this.appStore.catalogStore.catalogProfileStores.has(catalogFileId)) {
                const workspaceCatalogId = this.catalogIdOf(catalogFileId);
                if (workspaceCatalogId !== undefined) {
                    selectedCatalogIds[widgetId] = workspaceCatalogId;
                }
            }
        });
        if (Object.keys(selectedCatalogIds).length > 0) {
            this.workspace.selectedCatalogIds = selectedCatalogIds;
        }
    }

    /**
     * Stage 5: the arrangement the session is showing.
     *
     * A workspace carries its own copy, so that reopening it brings back the widgets showing its
     * images and catalogs without depending on a separately saved layout. Captured after the
     * catalogs, the way the restorer applies it after loading them, so that the widget settings a
     * layout holds name catalogs this workspace has already captured.
     */
    private captureLayout(): void {
        this.workspace.layout = this.appStore.layoutStore.currentLayoutConfig();
    }

    /** Stage 6: the state that only makes sense once everything it names has been captured. */
    private captureSelection(): void {
        this.workspace.selectedFile = this.imageIdOf(this.appStore.activeFrame);
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
