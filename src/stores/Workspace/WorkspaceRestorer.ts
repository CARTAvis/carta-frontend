import {WorkspaceItemKind} from "enums";
import {describeCatalogSource, describeImageSource, type Workspace, type WorkspaceCatalog, type WorkspaceCatalogSource, type WorkspaceFile, type WorkspaceImageSource, type WorkspaceIssue} from "models";
import {CatalogApiService} from "services";
import {AppStore, CatalogProfileStore, type CatalogRestoreOutcome, restoreWorkspaceZoom} from "stores";
import {type FrameStore} from "stores/Frame";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";
import {awaited, awaitedFlow, hashCatalogContent, resolveCatalogSelection} from "utilities";

/** One catalog whose rows have been asked for, and what the answer has to be judged against. */
interface CatalogConfigRequest {
    catalogInfo: WorkspaceCatalog;
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
export class WorkspaceRestorer {
    /** How many workspace loads have been started, so that a later one can take over from an earlier. */
    private static generationCounter = 0;

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
        return ++WorkspaceRestorer.generationCounter;
    }

    /** Whether a load is still the one the session is following. */
    public static isCurrentGeneration(generation: number): boolean {
        return generation === WorkspaceRestorer.generationCounter;
    }

    /** One entry per item that could not be brought back as saved. */
    private readonly issues: WorkspaceIssue[] = [];
    /** Workspace image ID to the file ID this session gave it. */
    private readonly frameIds = new Map<number, number>();
    /** Workspace catalog ID to the file ID this session gave it. */
    private readonly catalogIds = new Map<number, number>();

    constructor(
        private readonly workspace: Workspace,
        private readonly generation: number
    ) {}

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
        this.configureImages();
        this.restoreColorBlending();
        yield* this.openCatalogs();
        if (!this.isCurrent) {
            return this.issues;
        }
        yield* this.configureCatalogs();
        if (!this.isCurrent) {
            return this.issues;
        }
        this.restoreLayout();
        this.restoreViews();
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

    /** Stage 3: apply what each image is displayed with, now that all of them exist. */
    private configureImages(): void {
        for (const fileInfo of this.workspace.files ?? []) {
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

            if (this.workspace.references && fileInfo.references) {
                // An image was matched only if it named the reference it was matched to. A
                // workspace that names no reference -- because the session's own was an image it
                // could not save -- matches nothing, rather than every image that named none.
                const wasMatchedTo = (imageId: number | undefined, referenceId: number | undefined): boolean => imageId !== undefined && imageId === referenceId;
                if (this.appStore.spatialReference && wasMatchedTo(fileInfo.references.spatial, this.workspace.references.spatial)) {
                    this.appStore.setSpatialMatchingEnabled(frame, true);
                }
                if (this.appStore.spectralReference && wasMatchedTo(fileInfo.references.spectral, this.workspace.references.spectral)) {
                    this.appStore.setSpectralMatchingEnabled(frame, true);
                }
                if (this.appStore.rasterScalingReference && wasMatchedTo(fileInfo.references.raster, this.workspace.references.raster)) {
                    this.appStore.setRasterScalingMatchingEnabled(frame, true);
                }
            }

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

            this.restoreRegions(frame, fileInfo);
        }
    }

    /** Regions are only the image's own while it is not matched to another one. */
    private restoreRegions(frame: FrameStore, fileInfo: WorkspaceFile): void {
        if (frame.spatialReference || !fileInfo.regionsSet?.regions) {
            return;
        }

        const preferenceStore = this.appStore.preferenceStore;
        for (const regionInfo of fileInfo.regionsSet.regions) {
            const region = frame.regionSet.addExistingRegion(
                regionInfo.points,
                regionInfo.rotation,
                regionInfo.type,
                regionInfo.id,
                regionInfo.name ?? "",
                regionInfo.color ?? preferenceStore.regionColor,
                regionInfo.lineWidth ?? preferenceStore.regionLineWidth,
                regionInfo.dashes ?? [preferenceStore.regionDashLength],
                false,
                regionInfo.annotationStyles
            );
            if (region) {
                region.setLocked(regionInfo.locked ?? false);
                if (fileInfo.regionsSet.selectedRegion === regionInfo.id) {
                    frame.regionSet.selectSingleRegion(region);
                }
            }
        }
    }

    /** Stage 4: rebuild the colour-blended images made up of the images just opened. */
    private restoreColorBlending(): void {
        if (!this.workspace.colorBlendingImages) {
            return;
        }

        this.workspace.colorBlendingImages.sort((a, b) => a.imageListIndex - b.imageListIndex);
        for (const {imageListIndex, selectedFrameId, alpha} of this.workspace.colorBlendingImages) {
            const colorBlending = this.appStore.imageViewConfigStore.createColorBlending();
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
            const fileId = yield* awaitedFlow<number | undefined>(this.appStore.appendCatalog(source.directory ?? "", source.filename, CatalogProfileStore.INIT_TABLE_ROWS, targetFrameId));
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
     * Every catalog is asked for before any of them is waited on: a catalog's rows come from the
     * backend, so waiting for one at a time would make restoring a workspace of many catalogs take
     * as long as all of them put together. What comes back is still dealt with in the order the
     * workspace lists them, so what a restore reports does not depend on which answer arrived first.
     */
    private *configureCatalogs(): Generator<Promise<unknown>, void, any> {
        // Every request goes out first, so the waits below overlap rather than queue.
        const requests = (this.workspace.catalogs ?? []).map(catalogInfo => this.startCatalogConfig(catalogInfo));

        for (const request of requests) {
            if (!this.isCurrent) {
                return;
            }
            if (!request) {
                continue;
            }
            const {catalogInfo, catalogFileId, description, rowFailure, completion} = request;
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
                selection: catalogInfo.selection
            });
            return {catalogInfo, catalogFileId, description, rowFailure, completion};
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
        const selectionData = selectionHeaders.map(header => profileStore.catalogData.get(header?.columnIndex ?? NaN)?.data);
        const loadedRows = selectionData.length ? Math.min(...selectionData.map(data => data?.length ?? 0)) : 0;
        const availableRows = profileStore.isFileBasedCatalog ? (profileStore.filterDataSize ?? profileStore.catalogInfo.dataSize) : profileStore.numVisibleRows;
        const requiredRows = Math.min(catalogInfo.selection.searchRows ?? loadedRows, availableRows);
        if (selectionData.some(data => !data) || loadedRows < requiredRows) {
            this.report(WorkspaceItemKind.CatalogSelection, description, `Could not restore the selected rows of the catalog ${description}: the identifying data was not fully loaded`);
            displayStore?.setShowSelectedData(false);
            return;
        }
        const selectedDataIndices = resolveCatalogSelection(profileStore.catalogHeader, profileStore.catalogData, catalogInfo.selection);
        if (!selectedDataIndices) {
            this.report(WorkspaceItemKind.CatalogSelection, description, `Could not restore the selected rows of the catalog ${description}: the identifying data was not fully loaded`);
            displayStore?.setShowSelectedData(false);
            return;
        }
        const selectedPointIndices = profileStore.getOriginIndices(selectedDataIndices).filter(Number.isInteger);
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
            if (hashCatalogContent(profileStore.catalogHeader, profileStore.catalogOriginalData) !== catalogInfo.contentHash) {
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

    /** Stage 8: point the widgets and plots that show a catalog at the catalogs just loaded. */
    private restoreViews(): void {
        this.issues.push(...this.appStore.catalogStore.widgetBindings.restore(this.workspace.catalogWidgets, this.workspace.catalogs, this.catalogIds));
    }

    /** Stage 9: settle the state that depends on everything else already being in place. */
    private settle(): void {
        // Sync up raster scaling once all images are loaded and configured
        if (this.appStore.rasterScalingReference) {
            this.appStore.rasterScalingReference.renderConfig.updateSiblings();
        }

        // Loading catalogs moves the active image around, so put the saved one back in front.
        const selectedFrame = this.workspace.selectedFile === undefined ? undefined : this.frameOf(this.workspace.selectedFile);
        if (selectedFrame) {
            this.appStore.updateActiveImageByFrame(selectedFrame);
        }
    }

    /** The frame a workspace image ID now refers to, if it was restored. */
    private frameOf(workspaceFileId: number): FrameStore | undefined {
        const frameId = this.frameIds.get(workspaceFileId);
        return frameId === undefined ? undefined : this.appStore.frameMap.get(frameId);
    }
}
