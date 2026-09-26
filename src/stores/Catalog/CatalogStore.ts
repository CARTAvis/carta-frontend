import * as AST from "ast_wrapper";
import type {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {CatalogOverlay, CatalogPlotType, CatalogSystemType, CatalogUpdateMode, WorkspaceItemKind} from "enums";
import {type WorkspaceCatalogImageOverlay, type WorkspaceCatalogSelection} from "models";
import {CatalogWebGLService, type StreamedMessage} from "services";
import {AppStore, CatalogDisplayStore, type CatalogOnlineQueryProfileStore, type CatalogProfileStore, WidgetsStore} from "stores";
import {CatalogPlotBindingStore} from "stores/Catalog/CatalogPlotBindingStore";
import {type FrameStore} from "stores/Frame";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";
import {CatalogAxisEligibility, type CatalogCoordinateSystem, getDegreesPerCatalogUnit, minMaxArray, PendingRequestTracker, ProtobufProcessing, type RequestOutcome, setAstCatalogSystem} from "utilities";

type CatalogOverlayCoords = {
    x: Float32Array;
    y: Float32Array;
};

export interface WorkspaceCatalogRestoreOptions {
    overlay?: WorkspaceCatalogImageOverlay;
    selection?: WorkspaceCatalogSelection;
}

/** Whether row restoration was accepted, and how it ended (including an online catalog). */
export interface CatalogRestoreOutcome extends RequestOutcome {
    didStart: boolean;
}

/** The two columns the drawn overlay uses, which may differ from the widget controls. */
function getPlottedOverlayColumns(displayStore: CatalogDisplayStore | undefined): [string, string] | undefined {
    const plottedStore = displayStore?.hasPlottedImageOverlay ? displayStore : undefined;
    const xColumn = plottedStore?.plottedImageOverlayXAxis ?? displayStore?.xAxis;
    const yColumn = plottedStore?.plottedImageOverlayYAxis ?? displayStore?.yAxis;
    if (!xColumn || !yColumn || xColumn === CatalogOverlay.NONE || yColumn === CatalogOverlay.NONE) {
        return undefined;
    }
    return [xColumn, yColumn];
}

export class CatalogStore {
    /** Sentinel used while a restored plot is waiting for a catalog from the current session. */
    public static readonly PENDING_CATALOG_FILE_ID = 0;

    private static staticInstance: CatalogStore;

    public static get Instance() {
        if (!CatalogStore.staticInstance) {
            CatalogStore.staticInstance = new CatalogStore();
        }
        return CatalogStore.staticInstance;
    }

    @observable private _catalogGLData: Map<number, CatalogOverlayCoords> = new Map();
    @observable catalogCounts: Map<number, number> = new Map();
    /** Catalog file IDs held for catalogs that are still loading. */
    private readonly pendingFileIds = new Set<number>();
    /** Catalog file ID : the file ID of the image it is overlaid on, in the order catalogs were opened. */
    readonly catalogImageIds = observable.map<number, number>();
    /** Catalog plot binding and Workspace ID lifecycle. */
    public readonly plotBindings = new CatalogPlotBindingStore(
        this,
        () => WidgetsStore.Instance,
        message => AppStore.Instance.logStore.addWarning(message, ["catalog"])
    );
    // catalog file Id : catalog Profile store
    @observable catalogProfileStores: Map<number, CatalogProfileStore | CatalogOnlineQueryProfileStore> = new Map();
    // Catalog display state is scoped to the catalog, not to an overlay widget.
    @observable catalogDisplayStores: Map<number, CatalogDisplayStore> = new Map();
    private static readonly CatalogRestoreTimeout = 30_000;
    /**
     * The catalog requests whose rows are still arriving, keyed by catalog file ID.
     *
     * A catalog answers with a run of responses rather than a reply, so whoever asked has to be
     * told when the last one has come, when none is coming, and when another request has taken
     * over. That is the same bookkeeping for any streamed request, so a tracker keeps it rather
     * than this store.
     */
    public readonly catalogRequests = new PendingRequestTracker<number>({
        timeoutMs: CatalogStore.CatalogRestoreTimeout,
        timeoutMessage: "Timed out waiting for catalog data",
        supersededMessage: "The catalog restore was superseded",
        onFailure: catalogFileId => {
            const profileStore = this.catalogProfileStores.get(catalogFileId);
            profileStore?.setLoadingDataStatus(false);
            profileStore?.setUpdatingDataStream(false);
        }
    });

    private constructor() {
        makeObservable(this);
    }

    @computed get catalogGLData() {
        return this._catalogGLData;
    }

    /** Send one catalog request and account for a send that could not start a stream. */
    private sendFilterRequest(catalogFileId: number, filter: CARTA.CatalogFilterRequest.$Properties): number | false {
        const appStore = AppStore.Instance;
        if (!appStore.activeFrame) {
            this.catalogRequests.finish(catalogFileId, false, "The catalog request could not be sent");
            return false;
        }

        let requestId: number | false;
        try {
            requestId = appStore.backendService.setCatalogFilterRequest(filter);
        } catch (error) {
            this.catalogRequests.finish(catalogFileId, false, "The catalog request could not be sent");
            throw error;
        }
        if (typeof requestId === "number") {
            this.catalogRequests.attach(catalogFileId, requestId);
        } else {
            this.catalogRequests.finish(catalogFileId, false, "The catalog request could not be sent");
        }
        return requestId;
    }

    private clearSelectedRows(profileStore: CatalogProfileStore | CatalogOnlineQueryProfileStore, displayStore?: CatalogDisplayStore): void {
        profileStore.setSelectedPointIndices([], false);
        displayStore?.setShowSelectedData(false);
    }

    /** A column-only refresh must not erase the overlay that is already drawn. */
    private shouldPreserveImageOverlayDuringColumnUpdate(profileStore: CatalogProfileStore | CatalogOnlineQueryProfileStore, displayStore: CatalogDisplayStore): boolean {
        if (!profileStore.isUpdateColumnMode || !displayStore.hasPlottedImageOverlay || displayStore.plottedImageOverlaySystem === undefined) {
            return false;
        }
        const {plottedImageOverlayXAxis: xAxis, plottedImageOverlayYAxis: yAxis} = displayStore;
        if (xAxis === CatalogOverlay.NONE || yAxis === CatalogOverlay.NONE) {
            return false;
        }
        const coords = profileStore.get2DCoordinateData(xAxis, yAxis, profileStore.catalogData, displayStore.plottedImageOverlaySystem);
        return Boolean(coords.wcsX && coords.wcsY);
    }

    /** Apply the current table filters, including columns needed by a hidden overlay mapping. */
    @action requestFilteredRows(catalogFileId: number): void {
        const profileStore = this.catalogProfileStores.get(catalogFileId);
        const displayStore = this.getCatalogDisplayStore(catalogFileId);
        if (!profileStore || !displayStore) {
            return;
        }
        const shouldSkipRequest = !profileStore.isUpdateColumnMode && (profileStore.isLoadingOntoImage || !profileStore.shouldUpdateTableView || !profileStore.hasFilter);
        if (shouldSkipRequest) {
            return;
        }

        this.clearSelectedRows(profileStore, displayStore);
        if (!this.shouldPreserveImageOverlayDuringColumnUpdate(profileStore, displayStore)) {
            this.clearImageCoordsData(catalogFileId);
        }
        if (!profileStore.isFileBasedCatalog) {
            profileStore.resetFilterRequest(profileStore.getUserFilters());
            return;
        }

        profileStore.updateTableStatus(false);
        profileStore.resetFilterRequest();
        const filter = profileStore.updateRequestDataSize;
        if (filter.imageBounds) {
            filter.imageBounds.xColumnName = displayStore.xAxis;
            filter.imageBounds.yColumnName = displayStore.yAxis;
        }
        filter.filterConfigs = profileStore.getUserFilters();
        filter.columnIndices = profileStore.columnIndices;
        this.sendFilterRequest(catalogFileId, filter);
    }

    /** Re-read a file catalog after the user changes the table's sort order. */
    @action requestSortedRows(catalogFileId: number, columnName: string, sortingType: CARTA.SortingType | null): void {
        const profileStore = this.catalogProfileStores.get(catalogFileId);
        if (!profileStore) {
            return;
        }
        this.clearSelectedRows(profileStore, this.getCatalogDisplayStore(catalogFileId));
        this.clearImageCoordsData(catalogFileId);
        profileStore.setSortingInfo(columnName, sortingType);
        if (profileStore.isFileBasedCatalog) {
            profileStore.resetFilterRequest();
            const filter = profileStore.updateRequestDataSize;
            filter.sortColumn = columnName;
            filter.sortingType = sortingType;
            this.sendFilterRequest(catalogFileId, filter);
        }
    }

    /** Ask for the next table chunk only when the previous one has finished. */
    @action requestMoreRows(catalogFileId: number): void {
        const profileStore = this.catalogProfileStores.get(catalogFileId);
        const displayStore = this.getCatalogDisplayStore(catalogFileId);
        if (!profileStore || profileStore.isLoadingData || profileStore.updateMode !== CatalogUpdateMode.TableUpdate || !profileStore.shouldUpdateData || displayStore?.isShowingSelectedData) {
            return;
        }
        profileStore.setUpdateMode(CatalogUpdateMode.TableUpdate);
        const filter = profileStore.updateRequestDataSize;
        filter.columnIndices = profileStore.columnIndices;
        profileStore.setLoadingDataStatus(true);
        this.sendFilterRequest(catalogFileId, filter);
    }

    /** Ask for rows that a catalog plot does not yet hold. */
    @action requestPlotRows(catalogFileId: number): void {
        const profileStore = this.catalogProfileStores.get(catalogFileId);
        if (!profileStore?.isFileBasedCatalog || !profileStore.shouldUpdateData) {
            return;
        }
        profileStore.setUpdateMode(CatalogUpdateMode.PlotsUpdate);
        profileStore.setUpdatingDataStream(true);
        this.sendFilterRequest(catalogFileId, profileStore.updateRequestDataSize);
    }

    /** Restore the table's default request while clearing its selection and display mappings. */
    @action resetCatalogRows(catalogFileId: number): void {
        const profileStore = this.catalogProfileStores.get(catalogFileId);
        const displayStore = this.getCatalogDisplayStore(catalogFileId);
        if (!profileStore || !displayStore) {
            return;
        }
        profileStore.resetCatalogFilterRequest();
        this.clearSelectedRows(profileStore, displayStore);
        this.clearImageCoordsData(catalogFileId);
        if (profileStore.isFileBasedCatalog) {
            this.sendFilterRequest(catalogFileId, profileStore.catalogFilterRequest);
        }
        displayStore.resetMaps();
    }

    /** Accept only the current stream, then update its rows and finish its request. */
    @action handleFilterStream = ({requestId, message: catalogFilter}: StreamedMessage<CARTA.CatalogFilterResponse>): void => {
        const catalogFileId = catalogFilter.fileId;
        if (!this.catalogRequests.accepts(catalogFileId, requestId)) {
            return;
        }
        this.catalogRequests.noteProgress(catalogFileId);
        const profileStore = this.catalogProfileStores.get(catalogFileId);
        const progress = catalogFilter.progress;
        if (!profileStore) {
            if (progress === 1) {
                this.catalogRequests.finish(catalogFileId, false, "The catalog was closed before restoration completed");
            }
            return;
        }

        const isColumnUpdateMode = profileStore.isUpdateColumnMode;
        const displayStore = this.getCatalogDisplayStore(catalogFileId);
        const isViewUpdate = !isColumnUpdateMode && profileStore.updateMode === CatalogUpdateMode.ViewUpdate;
        const overlayColumns = getPlottedOverlayColumns(displayStore);
        const getEligibilityStatus = (columnName: string) => profileStore.getCoordinateEligibility(columnName).status;
        const didHaveUnknownCoordinateFormat = isViewUpdate && Boolean(overlayColumns?.some(columnName => getEligibilityStatus(columnName) === CatalogAxisEligibility.Unknown));
        const catalogData = ProtobufProcessing.processCatalogData(catalogFilter.columns);
        profileStore.updateCatalogData(catalogFilter, catalogData);
        profileStore.setProgress(progress);
        if (progress === 1) {
            profileStore.setLoadingDataStatus(false);
            profileStore.setUpdatingDataStream(false);
        }

        if (isViewUpdate && overlayColumns) {
            const [xColumn, yColumn] = overlayColumns;
            // The overlay already drawn may hold fewer rows than the catalog now has.
            const maxRows = (displayStore?.hasPlottedImageOverlay ? displayStore.plottedImageOverlayMaxRows : undefined) ?? profileStore.maxRows;
            const frame = this.frameOf(catalogFileId);
            if (frame) {
                // The drawn overlay, not the current widget controls, determines the coordinate
                // system used for incoming rows and for a restored drawing.
                const coordinateSystem =
                    displayStore?.hasPlottedImageOverlay && displayStore.plottedImageOverlaySystem !== undefined
                        ? {...profileStore.catalogCoordinateSystem, system: displayStore.plottedImageOverlaySystem}
                        : profileStore.catalogCoordinateSystem;
                let coords = profileStore.get2DCoordinateData(xColumn, yColumn, catalogData, coordinateSystem.system);
                const isCoordinateFormatSettled = didHaveUnknownCoordinateFormat && overlayColumns.every(columnName => getEligibilityStatus(columnName) === CatalogAxisEligibility.Eligible);
                if (isCoordinateFormatSettled) {
                    // Re-read the accumulated prefix now that the format of a unitless string
                    // column is known; earlier chunks were held as NaN.
                    this.clearImageCoordsData(catalogFileId);
                    coords = profileStore.get2DCoordinateData(xColumn, yColumn, profileStore.catalogData, coordinateSystem.system, catalogFilter.subsetEndIndex);
                }
                const wcs = frame.isValidWcs ? frame.wcsInfo : 0;
                if (coords.wcsX && coords.wcsY) {
                    this.convertToImageCoordinate(
                        catalogFileId,
                        coords.wcsX,
                        coords.wcsY,
                        wcs,
                        coords.xHeaderInfo?.units ?? "",
                        coords.yHeaderInfo?.units ?? "",
                        coordinateSystem,
                        isCoordinateFormatSettled ? 0 : catalogFilter.subsetEndIndex,
                        isCoordinateFormatSettled ? 0 : catalogFilter.subsetDataSize,
                        maxRows
                    );
                    displayStore?.setPlottedImageOverlayState(xColumn, yColumn, coordinateSystem.system);
                }
            }
        }
        if (progress === 1) {
            this.catalogRequests.complete(catalogFileId, requestId);
        }
    };

    /** A request failure also ends non-Restore loading, which has no pending wait. */
    failRequest(catalogFileId: number, message: string): void {
        this.catalogRequests.finish(catalogFileId, false, message);
    }

    /** Stop waits from the previous Workspace while a new one takes over. */
    interruptRequests(message: string): void {
        this.catalogRequests.failAll(message);
    }

    /** A new connection can reuse request IDs from the old one. */
    resetRequests(message: string): void {
        this.catalogRequests.reset(message);
    }

    /**
     * Open a catalog over an image.
     *
     * The catalog's file ID is held while `load` runs, so a catalog asked for meanwhile is not given
     * the same one, and is let go however loading ends. `load` builds the catalog's rows for that ID,
     * or returns undefined when there is no catalog to open; an error it throws is passed on.
     *
     * @returns the catalog's file ID, or undefined when there was nothing to open or the image was
     * closed while the catalog loaded.
     */
    async open(frame: FrameStore, load: (fileId: number) => Promise<CatalogProfileStore | CatalogOnlineQueryProfileStore | undefined>): Promise<number | undefined> {
        const fileId = this.reserveFileId();
        try {
            const profileStore = await load(fileId);
            if (!profileStore) {
                return undefined;
            }
            if (AppStore.Instance.getFrame(frame.frameInfo.fileId) !== frame) {
                // The backend holds a file catalog it was asked to load; nothing will show it now.
                if (profileStore.isFileBasedCatalog) {
                    AppStore.Instance.backendService.closeCatalogFile(fileId);
                }
                return undefined;
            }
            this.addLoadedCatalog(fileId, frame, profileStore);
            return fileId;
        } finally {
            this.releaseFileId(fileId);
        }
    }

    /** Everything that has to hold once a catalog exists, in the order it has to be set up. */
    @action private addLoadedCatalog(fileId: number, frame: FrameStore, profileStore: CatalogProfileStore | CatalogOnlineQueryProfileStore): void {
        const imageFileId = frame.frameInfo.fileId;
        if (!this.catalogsOn(imageFileId).length) {
            // The first catalog on this image
            WidgetsStore.Instance.resetCatalogWidgetSelections([fileId]);
        }
        this.catalogImageIds.set(fileId, imageFileId);
        this.addCatalog(fileId, profileStore.catalogInfo.dataSize);
        this.getOrCreateCatalogDisplayStore(fileId);
        this.catalogProfileStores.set(fileId, profileStore);
        this.plotBindings.validateColumns(fileId);
        // A catalog that every existing widget is still waiting past gets a widget of its own, so
        // that it is never left displayed in none.
        if (WidgetsStore.Instance.updateCatalogWidgetSelection(fileId) === undefined) {
            WidgetsStore.Instance.createFloatingCatalogWidget(fileId);
        }
    }

    /**
     * A catalog only takes up its file ID once its profile store exists, which is not until its data
     * comes back. Without holding the ID in the meantime, a catalog asked for while another is still
     * on its way is handed the same one, and whichever arrives second replaces the first.
     */
    @action private reserveFileId(): number {
        let fileId = 1;
        while (this.catalogProfileStores.has(fileId) || this.pendingFileIds.has(fileId)) {
            fileId += 1;
        }
        this.pendingFileIds.add(fileId);
        return fileId;
    }

    @action private releaseFileId(fileId: number): void {
        this.pendingFileIds.delete(fileId);
    }

    @action addCatalog(fileId: number, size: number) {
        // A catalog is given the ID a workspace will know it by as soon as it is opened, so that
        // saving only has to read it back.
        WorkspaceIdRegistry.Instance.register(WorkspaceItemKind.Catalog, fileId);
        this.catalogGLData.set(fileId, {
            x: new Float32Array(size),
            y: new Float32Array(size)
        });
        this.catalogCounts.set(fileId, 0);
    }

    @action convertToImageCoordinate(
        fileId: number,
        xData: Array<number>,
        yData: Array<number>,
        wcsInfo: AST.FrameSet,
        xUnit: string,
        yUnit: string,
        catalogCoordinateSystem: CatalogCoordinateSystem,
        subsetEndIndex: number,
        subsetDataSize: number,
        maxRows?: number
    ) {
        const catalog = this.catalogGLData.get(fileId);
        if (catalog && xData && yData) {
            const startIndex = Math.max(0, subsetEndIndex - subsetDataSize);
            const rowLimit = maxRows === undefined ? xData.length : Math.max(0, maxRows - startIndex);
            const plottedXData = xData.slice(0, rowLimit);
            const plottedYData = yData.slice(0, rowLimit);
            if (!plottedXData.length) {
                return;
            }
            const position = new Float32Array(plottedXData.length * 2);
            let xImageCoords: ArrayLike<number> = plottedXData;
            let yImageCoords: ArrayLike<number> = plottedYData;
            let pixelOffset = 0;
            switch (catalogCoordinateSystem.system) {
                case CatalogSystemType.Pixel0:
                    break;
                case CatalogSystemType.Pixel1:
                    pixelOffset = -1;
                    break;
                default:
                    const pixelData = CatalogStore.transformCatalogData(plottedXData, plottedYData, wcsInfo, xUnit, yUnit, catalogCoordinateSystem);
                    xImageCoords = pixelData.xImageCoords;
                    yImageCoords = pixelData.yImageCoords;
                    break;
            }
            for (let i = 0; i < xImageCoords.length; i++) {
                const x = xImageCoords[i] + pixelOffset;
                const y = yImageCoords[i] + pixelOffset;
                catalog.x[startIndex + i] = x;
                catalog.y[startIndex + i] = y;
                position[i * 2] = x;
                position[i * 2 + 1] = y;
            }
            // The highest row written, not a running total: a batch that arrives twice, or a
            // re-request that starts again from a row already drawn, must not inflate the count
            // into vertices the GL layer was never given.
            this.catalogCounts.set(fileId, Math.max(this.catalogCounts.get(fileId) ?? 0, startIndex + plottedXData.length));
            CatalogWebGLService.Instance.updatePositionArray(fileId, position, startIndex * 2);
        }
    }

    @action clearImageCoordsData(fileId: number) {
        const catalog = this.catalogGLData.get(fileId);
        if (catalog) {
            catalog.x = new Float32Array(catalog.x.length);
            catalog.y = new Float32Array(catalog.y.length);
            const position = new Float32Array(catalog.x.length * 2);
            this.catalogCounts.set(fileId, 0);
            CatalogWebGLService.Instance.updatePositionArray(fileId, position, 0);
        }
    }

    /**
     * Close a catalog, and move every plot and table widget showing it onto a catalog its image still
     * has. Nothing is closed when the backend cannot be told.
     *
     * @returns whether the catalog was closed.
     */
    @action close(fileId: number): boolean {
        if (fileId < 0 || !AppStore.Instance.backendService.closeCatalogFile(fileId)) {
            return false;
        }
        // Plots move while the catalog still names its image.
        this.plotBindings.closeCatalog(fileId);
        // Drop the catalog's earlier requests before ending the one still in flight, so that the
        // request being ended is left marked stale: a response arriving after this file ID has been
        // handed to the next catalog opened must not be taken for an answer about that one.
        this.catalogRequests.forget(fileId);
        this.catalogRequests.finish(fileId, false, "The catalog was closed before restoration completed");
        this.removeCatalogDisplayStore(fileId);
        WorkspaceIdRegistry.Instance.release(WorkspaceItemKind.Catalog, fileId);
        this.catalogGLData.delete(fileId);
        CatalogWebGLService.Instance.clearTexture(fileId);
        const imageFileId = this.imageIdOf(fileId);
        this.catalogImageIds.delete(fileId);
        const associatedCatalogIds = imageFileId === undefined ? [] : this.catalogsOn(imageFileId);
        if (associatedCatalogIds.length) {
            WidgetsStore.Instance.replaceCatalogWidgetSelection(fileId, associatedCatalogIds[0]);
        }
        this.catalogProfileStores.delete(fileId);
        return true;
    }

    @action resetActiveCatalogFile(imageFileId: number) {
        const activeCatalogFileIds = this.catalogsOn(imageFileId);
        if (activeCatalogFileIds.length) {
            WidgetsStore.Instance.resetCatalogWidgetSelections(activeCatalogFileIds);
            this.plotBindings.resetSelections(activeCatalogFileIds);
        }
    }

    /** The file ID of the image a catalog is overlaid on. */
    imageIdOf(catalogFileId: number): number | undefined {
        return this.catalogImageIds.get(catalogFileId);
    }

    /** The image a catalog is overlaid on, while that image is open. */
    frameOf(catalogFileId: number): FrameStore | undefined {
        const imageFileId = this.imageIdOf(catalogFileId);
        return imageFileId === undefined ? undefined : (AppStore.Instance.getFrame(imageFileId) ?? undefined);
    }

    /** The catalogs overlaid on one image, in the order they were opened. */
    catalogsOn(imageFileId: number): number[] {
        const catalogFileIds: number[] = [];
        this.catalogImageIds.forEach((catalogImageFileId, catalogFileId) => {
            if (catalogImageFileId === imageFileId) {
                catalogFileIds.push(catalogFileId);
            }
        });
        return catalogFileIds;
    }

    /** Close every catalog overlaid on an image that is being closed. */
    @action closeCatalogsOn(imageFileId: number) {
        this.catalogsOn(imageFileId).forEach(catalogFileId => this.close(catalogFileId));
        // A catalog the backend could not close must not be taken for one on the next image given this file ID.
        this.catalogsOn(imageFileId).forEach(catalogFileId => this.catalogImageIds.delete(catalogFileId));
    }

    @computed get activeCatalogFiles() {
        const activeFrame = AppStore.Instance.activeFrame;
        if (activeFrame) {
            return this.visibleCatalogFiles.get(activeFrame) ?? [];
        } else {
            return [];
        }
    }

    @computed get visibleCatalogFiles(): Map<FrameStore, number[]> {
        const appStore = AppStore.Instance;
        const visibleCatalogMap = new Map<FrameStore, number[]>();

        /// TODO: this should be cleaned up a bit
        for (const frame of appStore.imageViewConfigStore.visibleFrames) {
            const imageId = frame.frameInfo.fileId;
            let associatedCatalogIds = this.catalogsOn(imageId);
            frame.spatialSiblings?.forEach(frame => {
                const catalogs = this.catalogsOn(frame.frameInfo.fileId);
                associatedCatalogIds = [...new Set(([] as number[]).concat(...[associatedCatalogIds, catalogs]))].filter(catalogFileId => {
                    return this.catalogGLData.has(catalogFileId);
                });
            });
            visibleCatalogMap.set(
                frame,
                associatedCatalogIds.sort((a, b) => a - b)
            );
        }
        return visibleCatalogMap;
    }

    /**
     * The catalogs whose rows are still arriving, named as the user sees them.
     *
     * A catalog holds only part of its rows while a request is in flight, and each column is
     * allocated to the full requested size with the rows that have not arrived left empty, so what
     * is read off it in that state describes neither what was asked for nor what is there.
     */
    @computed get streamingCatalogNames(): string[] {
        const names: string[] = [];
        this.catalogProfileStores.forEach(profileStore => {
            if (profileStore.isLoadingOntoImage) {
                names.push(profileStore.catalogInfo.fileInfo.name || `catalog ${profileStore.catalogInfo.fileId}`);
            }
        });
        return names;
    }

    getCatalogFileNames(fileIds: Array<number>) {
        const fileList = new Map<number, string>();
        fileIds.forEach(catalogFileId => {
            const catalogProfileStore = this.catalogProfileStores.get(catalogFileId);
            if (catalogProfileStore) {
                const catalogFile = catalogProfileStore.catalogInfo;
                if (catalogFile.fileInfo.name) {
                    fileList.set(catalogFile.fileId, catalogFile.fileInfo.name);
                }
            }
        });
        return fileList;
    }

    /**
     * Draw a catalog over the image it is associated with, from the columns its display config
     * names as the position axes.
     *
     * @returns whether the overlay could be drawn.
     */
    @action plotImageOverlay(catalogFileId: number, overlay?: WorkspaceCatalogImageOverlay): boolean {
        const profileStore = this.catalogProfileStores.get(catalogFileId);

        if (!profileStore) {
            return false;
        }
        const displayStore = this.getOrCreateCatalogDisplayStore(catalogFileId);
        const {xAxis, yAxis} = overlay ?? displayStore;
        if (!overlay && displayStore.catalogPlotType !== CatalogPlotType.ImageOverlay) {
            return false;
        }
        if (xAxis === CatalogOverlay.NONE || yAxis === CatalogOverlay.NONE) {
            return false;
        }
        // A restored overlay names the system it was drawn in, which the coordinate control may
        // since have been moved on from. The equinox and epoch stay the catalog's own.
        const coordinateSystem = overlay?.system === undefined ? profileStore.catalogCoordinateSystem : {...profileStore.catalogCoordinateSystem, system: overlay.system};
        const system = coordinateSystem.system;
        const maxRows = this.getOverlayMaxRows(profileStore, overlay?.maxRows);

        profileStore.setUpdateMode(CatalogUpdateMode.ViewUpdate);
        const frame = this.frameOf(catalogFileId);
        let isPlotted = !!frame;
        if (frame) {
            displayStore.setPlottedImageOverlayState(xAxis, yAxis, system, maxRows);
            const imageCoords = profileStore.get2DCoordinateData(xAxis, yAxis, profileStore.catalogData, system);
            const wcs = frame.isValidWcs ? frame.wcsInfo : 0;
            this.clearImageCoordsData(catalogFileId);
            if (imageCoords.wcsX && imageCoords.wcsY) {
                this.convertToImageCoordinate(catalogFileId, imageCoords.wcsX, imageCoords.wcsY, wcs, imageCoords.xHeaderInfo?.units ?? "", imageCoords.yHeaderInfo?.units ?? "", coordinateSystem, 0, 0, maxRows);
            } else if (!profileStore.shouldUpdateData) {
                // The rows this catalog holds are all the rows there are, and the columns the
                // overlay maps hold no coordinates among them -- a saved overlay whose columns a
                // re-run query no longer returns, for instance. Nothing later will change that, so
                // the catalog is not left marked as carrying an overlay with no points in it.
                displayStore.clearPlottedImageOverlayState();
                isPlotted = false;
            }
            profileStore.setSelectedPointIndices(profileStore.selectedPointIndices, false);
        }
        if (profileStore.shouldUpdateData) {
            // A saved config can map columns that this catalog does not display by default, and the
            // rows still to be streamed would arrive without them.
            profileStore.ensureColumnsRequested([xAxis, yAxis, displayStore.sizeMapColumn, displayStore.sizeMinorMapColumn, displayStore.colorMapColumn, displayStore.orientationMapColumn]);
            profileStore.setUpdatingDataStream(true);
            this.sendFilterRequest(catalogFileId, profileStore.updateRequestDataSize);
        }
        // An overlay with no image left to draw on, or nothing to draw on it, has not been drawn,
        // however far the rest got.
        return isPlotted;
    }

    /**
     * Bring a catalog back to the rows a workspace saved, once its display config has been applied,
     * and draw the overlay it was saved with.
     *
     * A file-based catalog opens with a preview of its first rows, read before the saved filters,
     * sorting and columns existed. The preview is dropped and the catalog is asked for again from
     * its first row, so that neither the table nor the overlay is left holding preview rows the
     * saved query would not have selected. The overlay is set up before the request goes out,
     * because each batch of rows is drawn as it arrives.
     *
     * Starts the request before returning, so Restore can start every catalog before awaiting any
     * result. An already-loaded online catalog completes without another backend request.
     */
    @action restoreCatalogFromWorkspace(catalogFileId: number, options: WorkspaceCatalogRestoreOptions = {}): Promise<CatalogRestoreOutcome> {
        const completion = this.catalogRequests.start(catalogFileId);
        let didStart = false;
        try {
            didStart = this.startCatalogRestoreRows(catalogFileId, options);
        } catch (error) {
            console.error(error);
            if (this.catalogRequests.isPending(catalogFileId)) {
                this.catalogRequests.finish(catalogFileId, false, "The catalog restoration failed");
            }
        }
        return completion.then(outcome => ({...outcome, didStart}));
    }

    private startCatalogRestoreRows(catalogFileId: number, options: WorkspaceCatalogRestoreOptions): boolean {
        const {overlay, selection} = options;

        const profileStore = this.catalogProfileStores.get(catalogFileId);
        if (!profileStore) {
            this.catalogRequests.finish(catalogFileId, false, "The catalog is not loaded");
            return false;
        }

        // An online catalog holds all of its rows already, and applying its display config has just
        // filtered and sorted them in place, so there is nothing to ask the backend for.
        if (!profileStore.isFileBasedCatalog) {
            const isSuccess = overlay ? this.plotImageOverlay(catalogFileId, overlay) : true;
            this.catalogRequests.finish(catalogFileId, isSuccess, isSuccess ? undefined : "The online catalog overlay could not be drawn");
            return isSuccess;
        }

        const displayStore = this.getOrCreateCatalogDisplayStore(catalogFileId);
        const frame = this.frameOf(catalogFileId);
        if (overlay && (overlay.xAxis === CatalogOverlay.NONE || overlay.yAxis === CatalogOverlay.NONE || !frame)) {
            this.catalogRequests.finish(catalogFileId, false, "The saved overlay has no usable image or position axes");
            return false;
        }

        if (overlay) {
            // Rows that stream in only carry the columns that were asked for, so a column the
            // overlay is mapped from has to be requested even when the table does not show it.
            profileStore.ensureColumnsRequested([overlay.xAxis, overlay.yAxis, displayStore.sizeMapColumn, displayStore.sizeMinorMapColumn, displayStore.colorMapColumn, displayStore.orientationMapColumn]);
            displayStore.setPlottedImageOverlayState(overlay.xAxis, overlay.yAxis, overlay.system, this.getOverlayMaxRows(profileStore, overlay.maxRows));
            this.clearImageCoordsData(catalogFileId);
        }

        const selectionColumnIndices = selection?.columns.map(columnName => profileStore.catalogControlHeader.get(columnName)?.columnIndex).filter((columnIndex): columnIndex is number => columnIndex !== undefined) ?? [];
        profileStore.resetFilterRequest();
        profileStore.setUpdateMode(overlay ? CatalogUpdateMode.ViewUpdate : CatalogUpdateMode.TableUpdate);

        const filter = profileStore.updateRequestDataSize;
        filter.filterConfigs = profileStore.getUserFilters();
        filter.sortColumn = profileStore.sortingInfo.columnName;
        filter.sortingType = profileStore.sortingInfo.sortingType;
        filter.columnIndices = [...new Set([...profileStore.columnIndices, ...selectionColumnIndices])];
        if (selection) {
            const searchRows = Math.min(profileStore.catalogInfo.dataSize, selection.searchRows ?? profileStore.maxRows);
            filter.subsetDataSize = Math.max(filter.subsetDataSize ?? 0, searchRows);
        }
        if (overlay) {
            // The table limit controls the number of visible rows, but the overlay may need more
            // rows from the same filtered/sorted result. The profile's normal request-size getter
            // only knows about the table limit, so widen this one request without changing it.
            filter.subsetDataSize = Math.max(filter.subsetDataSize ?? 0, this.getOverlayMaxRows(profileStore, overlay.maxRows));
        }
        profileStore.setUpdatingDataStream(true);
        const requestId = this.sendFilterRequest(catalogFileId, filter);
        if (requestId === false) {
            return false;
        }
        return true;
    }

    private getOverlayMaxRows(profileStore: CatalogProfileStore | CatalogOnlineQueryProfileStore, maxRows: number | undefined): number {
        const requestedRows = maxRows ?? profileStore.maxRows;
        return Number.isFinite(requestedRows) ? Math.max(0, Math.min(profileStore.catalogInfo.dataSize, requestedRows)) : 0;
    }

    /** The display store of a catalog, or undefined when the catalog has none. */
    getCatalogDisplayStore(fileId: number): CatalogDisplayStore | undefined {
        return this.catalogDisplayStores.get(fileId);
    }

    /** Releases the display store of a catalog that is being closed. */
    @action removeCatalogDisplayStore(fileId: number) {
        this.catalogDisplayStores.get(fileId)?.dispose();
        this.catalogDisplayStores.delete(fileId);
    }

    /** As {@link getCatalogDisplayStore}, but creates the display store when the catalog has none. */
    @action getOrCreateCatalogDisplayStore(fileId: number): CatalogDisplayStore {
        let displayStore = this.catalogDisplayStores.get(fileId);
        if (!displayStore) {
            displayStore = new CatalogDisplayStore(fileId);
            this.catalogDisplayStores.set(fileId, displayStore);
        }
        return displayStore;
    }

    /** Radians per unit of the column's declared units, for AST. Unknown units are degrees. */
    private static getFractionFromUnit(unit: string): number {
        return (getDegreesPerCatalogUnit(unit) * Math.PI) / 180.0;
    }

    private static transformCatalogData(
        xWcsData: Array<number>,
        yWcsData: Array<number>,
        wcsInfo: AST.FrameSet,
        xUnit: string,
        yUnit: string,
        catalogCoordinateSystem: CatalogCoordinateSystem
    ): {xImageCoords: Float64Array; yImageCoords: Float64Array} {
        if (xWcsData?.length === yWcsData?.length && xWcsData?.length > 0) {
            const overlay = AppStore.Instance.overlaySettings;
            const N = xWcsData.length;

            const xFraction = CatalogStore.getFractionFromUnit(xUnit);
            const yFraction = CatalogStore.getFractionFromUnit(yUnit);

            const wcsCopy = AST.copy(wcsInfo);
            if (wcsCopy !== 0 && overlay.isImgCoordinates) {
                AST.setI(wcsCopy, "Current", 2);
            }

            setAstCatalogSystem(wcsCopy, catalogCoordinateSystem);

            const xWCSValues = new Float64Array(N);
            const yWCSValues = new Float64Array(N);

            for (let i = 0; i < N; i++) {
                xWCSValues[i] = xWcsData[i] * xFraction;
                yWCSValues[i] = yWcsData[i] * yFraction;
            }

            const results = AST.transformPointArrays(wcsCopy, xWCSValues, yWCSValues, false);
            AST.deleteObject(wcsCopy);
            return {xImageCoords: results.x, yImageCoords: results.y};
        }
        return {xImageCoords: new Float64Array(0), yImageCoords: new Float64Array(0)};
    }

    getFrameMinMaxPoints(frameId: number): {minX: number; maxX: number; minY: number; maxY: number} {
        const minMax = {minX: Number.MAX_VALUE, maxX: -Number.MAX_VALUE, minY: Number.MAX_VALUE, maxY: -Number.MAX_VALUE};
        this.catalogsOn(frameId).forEach(catalogId => {
            const coords = this.catalogGLData.get(catalogId);
            const count = this.catalogCounts.get(catalogId);
            if (coords?.x && coords?.y) {
                const minMaxX = minMaxArray(coords.x.slice(0, count));
                const minMaxY = minMaxArray(coords.y.slice(0, count));
                if (minMaxX.minVal < minMax.minX) {
                    minMax.minX = minMaxX.minVal;
                }

                if (minMaxX.maxVal > minMax.maxX) {
                    minMax.maxX = minMaxX.maxVal;
                }

                if (minMaxY.minVal < minMax.minY) {
                    minMax.minY = minMaxY.minVal;
                }

                if (minMaxY.maxVal > minMax.maxY) {
                    minMax.maxY = minMaxY.maxVal;
                }
            }
        });
        return minMax;
    }
}
