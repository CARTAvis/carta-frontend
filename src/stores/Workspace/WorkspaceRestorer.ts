import {comparer, reaction} from "mobx";

import {ImageType, RegionId, WorkspaceItemKind} from "enums";
import {describeCatalogSource, describeImageSource, isWidgetWorkspaceConfigOf, type Workspace, type WorkspaceCatalog, type WorkspaceCatalogSource, type WorkspaceFile, type WorkspaceImageSource, type WorkspaceIssue} from "models";
import {CatalogApiService} from "services";
import {AppStore, type CatalogRestoreOutcome, type ColorBlendingStore, restoreWorkspaceZoom, StreamingRowSource} from "stores";
import {type FrameStore} from "stores/Frame";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";
import {awaited, awaitedFlow, hashCatalogContent, resolveCatalogSelection} from "utilities";

/**
 * How long a cube histogram may go without progress before a restore gives up on it, in
 * milliseconds. The backend reports its progress every two seconds while it computes.
 */
const CUBE_HISTOGRAM_STALL_TIMEOUT = 60_000;

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
    /** Workspace image ID to the IDs its regions were saved with, each to the ID the backend gave the region restored from it. */
    private readonly regionIds = new Map<number, Map<number, number>>();
    /** The image the session is left with in front once the restore is done. */
    private frontFrame: FrameStore | undefined;
    /** The color-blended images rebuilt, by the image list index each was saved at. */
    private readonly colorBlendings = new Map<number, ColorBlendingStore>();

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
        // Registered with the backend, and the cube histograms computed, while the catalogs open;
        // both are waited for before the layout.
        const regions = this.configureImages();
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
    private configureImages(): Promise<unknown> {
        const regions: Promise<void>[] = [];
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

            regions.push(this.restoreRegions(frame, fileInfo));
        }

        // The image saved in front may not be back: it could not be opened, or it was a generated
        // image the workspace does not carry. A session with images open has one in front.
        const savedFrontFrame = this.workspace.selectedFile === undefined ? undefined : this.frameOf(this.workspace.selectedFile);
        this.frontFrame = savedFrontFrame ?? (this.workspace.files ?? []).map(fileInfo => this.frameOf(fileInfo.id)).find(frame => frame !== undefined);
        if (!savedFrontFrame && this.frontFrame) {
            this.appStore.updateActiveImageByFrame(this.frontFrame);
        }
        return Promise.all(regions);
    }

    /**
     * Regions are only the image's own while it is not matched to another one.
     *
     * The backend gives each restored region an ID of its own, so the ID each was saved with is
     * mapped to it once the backend has answered.
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
                if (selectedRegion === regionInfo.id) {
                    frame.regionSet.selectSingleRegion(region);
                }
            })
        );
    }

    /**
     * The ID a region a workspace names has in this session.
     *
     * The cursor, the whole image and the other fixed region IDs are the same in every session. A
     * region of an image matched to another is one of that image's.
     *
     * @param workspaceImageId - the workspace ID of the image the region was saved on.
     * @param savedRegionId - the ID the region was saved with.
     * @returns nothing for a region that was not restored.
     */
    public regionIdOf(workspaceImageId: number, savedRegionId: number): number | undefined {
        if (savedRegionId <= RegionId.CURSOR) {
            return savedRegionId;
        }
        const fileInfo = this.workspace.files?.find(file => file.id === workspaceImageId);
        const ownerId = fileInfo?.references?.spatial ?? workspaceImageId;
        return this.regionIds.get(ownerId)?.get(savedRegionId);
    }

    /**
     * Stage 3a: compute again the cube histograms that images' percentile ranges were taken from.
     *
     * A workspace is a snapshot, so an image restored with such a range keeps following the cube
     * histogram. The backend computes one cube histogram at a time for a session, so they are asked
     * for one after another. The range applied in stage 3 stays until a cube histogram is complete,
     * and for an unchanged file the percentile then gives it again. An image whose cube histogram
     * does not come keeps its saved range as a custom one.
     */
    private async restoreCubeHistograms(): Promise<void> {
        const pending = (this.workspace.files ?? []).flatMap(fileInfo => {
            const frame = this.frameOf(fileInfo.id);
            return frame?.renderConfig.isUsingCubeHistogram ? [{fileInfo, frame}] : [];
        });
        for (const {fileInfo, frame} of pending) {
            const isOpen = () => this.appStore.frames.includes(frame);
            if (!this.isCurrent) {
                // Taken over by a later load that kept these images: leave none of them waiting on a
                // cube histogram nobody will ask for.
                if (isOpen()) {
                    frame.renderConfig.keepRangeWithoutCubeHistogram(frame.requiredPolarizationIndex);
                }
                continue;
            }

            const imageName = describeImageSource(fileInfo.source);
            // The backend computes it in whichever Stokes it last showed the image in, which for an
            // image not yet in view is not the one restored; name it, and file the result under it.
            const stokesIndex = frame.requiredPolarizationIndex;
            frame.renderConfig.awaitCompleteCubeHistogram();
            frame.renderConfig.setStokesIndex(stokesIndex);
            this.appStore.requestCubeHistogram(frame.frameInfo.fileId, frame.coordinateOptionsZ?.[stokesIndex]?.value ?? "z");
            const isComplete = await this.waitForCubeHistogram(frame, `cube histogram of ${imageName}`);
            if (!isComplete && isOpen()) {
                frame.renderConfig.keepRangeWithoutCubeHistogram(stokesIndex);
                this.appStore.cancelCubeHistogramRequest(frame.frameInfo.fileId);
                if (this.isCurrent) {
                    this.report(WorkspaceItemKind.Image, imageName, `Could not compute the cube histogram of ${imageName}; its percentile range is kept as a custom range`);
                }
            }
        }
        if (this.isCurrent) {
            this.appStore.setWorkspaceLoadingStep(undefined);
        }
    }

    /**
     * Resolve to whether an image's cube histogram completes. It does not if the image is closed,
     * which a later workspace load does to every image, or if the backend stops reporting progress.
     */
    private waitForCubeHistogram(frame: FrameStore, description: string): Promise<boolean> {
        return new Promise(resolve => {
            let stallTimer: ReturnType<typeof setTimeout> | undefined;
            const finish = (isComplete: boolean, dispose: () => void) => {
                clearTimeout(stallTimer);
                dispose();
                resolve(isComplete);
            };
            const disposeReaction = reaction(
                () => ({progress: frame.renderConfig.cubeHistogramProgress, isOpen: this.appStore.frames.includes(frame)}),
                ({progress, isOpen}, _previous, self) => {
                    if (!isOpen || progress >= 1) {
                        finish(isOpen, () => self.dispose());
                        return;
                    }
                    if (this.isCurrent) {
                        this.appStore.setWorkspaceLoadingStep({description, progress});
                    }
                    clearTimeout(stallTimer);
                    stallTimer = setTimeout(() => finish(false, disposeReaction), CUBE_HISTOGRAM_STALL_TIMEOUT);
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
    }

    /** The frame a workspace image ID now refers to, if it was restored. */
    private frameOf(workspaceFileId: number): FrameStore | undefined {
        const frameId = this.frameIds.get(workspaceFileId);
        return frameId === undefined ? undefined : this.appStore.frameMap.get(frameId);
    }
}
