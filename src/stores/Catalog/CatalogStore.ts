import * as AST from "ast_wrapper";
import {action, computed, makeObservable, observable} from "mobx";

import {CatalogOverlay, CatalogPlotType, CatalogSystemType, CatalogUpdateMode, WorkspaceItemKind} from "enums";
import {type WorkspaceCatalogImageOverlay, type WorkspaceCatalogSelection} from "models";
import {CatalogWebGLService} from "services";
import {AppStore, CatalogDisplayStore, type CatalogOnlineQueryProfileStore, type CatalogProfileStore, WidgetsStore} from "stores";
import {type FrameStore} from "stores/Frame";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";
import {type CatalogCoordinateSystem, getDegreesPerCatalogUnit, isCatalogNumericDataType, minMaxArray, PendingRequestTracker, setAstCatalogSystem} from "utilities";

type CatalogOverlayCoords = {
    x: Float32Array;
    y: Float32Array;
};

export interface WorkspaceCatalogRestoreOptions {
    overlay?: WorkspaceCatalogImageOverlay;
    shouldWaitForCompletion?: boolean;
    selection?: WorkspaceCatalogSelection;
}

/**
 * What one catalog plot component is showing: the catalog it is pointed at, and the plot it keeps
 * for each catalog it has been pointed at.
 *
 * The selection lives here rather than beside the plots, so that "which catalog this component is
 * showing" has one answer. The component that draws it reads this rather than holding its own copy,
 * which is what lets a workspace restore move a plot onto its catalog after the fact.
 */
export class CatalogPlotComponentState {
    /** The catalog this component is showing, or 0 while it has none. */
    @observable activeCatalogFileId: number;
    /** Catalog file ID : the ID of the plot widget store kept for that catalog. */
    readonly plotWidgetIds = observable.map<number, string>();

    constructor(activeCatalogFileId: number) {
        this.activeCatalogFileId = activeCatalogFileId;
        makeObservable(this);
    }

    @action setActiveCatalogFileId = (catalogFileId: number | undefined) => {
        this.activeCatalogFileId = catalogFileId ?? 0;
    };
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
    // image file id : catalog file Id
    @observable imageAssociatedCatalogId: Map<number, Array<number>> = new Map();
    // catalog plot component Id : what that component is showing
    @observable catalogPlots: Map<string, CatalogPlotComponentState> = new Map();
    // Retains the component association after its catalog-specific widget store closes.
    @observable private catalogPlotComponents: Map<string, string> = new Map();
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
            switch (catalogCoordinateSystem.system) {
                case CatalogSystemType.Pixel0:
                    for (let i = 0; i < plottedXData.length; i++) {
                        catalog.x[startIndex + i] = plottedXData[i];
                        catalog.y[startIndex + i] = plottedYData[i];
                        position[i * 2] = plottedXData[i];
                        position[i * 2 + 1] = plottedYData[i];
                    }
                    break;
                case CatalogSystemType.Pixel1:
                    for (let i = 0; i < plottedXData.length; i++) {
                        catalog.x[startIndex + i] = plottedXData[i] - 1;
                        catalog.y[startIndex + i] = plottedYData[i] - 1;
                        position[i * 2] = plottedXData[i] - 1;
                        position[i * 2 + 1] = plottedYData[i] - 1;
                    }
                    break;
                default:
                    const pixelData = CatalogStore.transformCatalogData(plottedXData, plottedYData, wcsInfo, xUnit, yUnit, catalogCoordinateSystem);
                    for (let i = 0; i < pixelData.xImageCoords.length; i++) {
                        catalog.x[startIndex + i] = pixelData.xImageCoords[i];
                        catalog.y[startIndex + i] = pixelData.yImageCoords[i];
                        position[i * 2] = pixelData.xImageCoords[i];
                        position[i * 2 + 1] = pixelData.yImageCoords[i];
                    }
                    break;
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

    @action removeCatalog(fileId: number, catalogComponentId?: string) {
        // Drop the catalog's earlier requests before ending the one still in flight, so that the
        // request being ended is left marked stale: a response arriving after this file ID has been
        // handed to the next catalog opened must not be taken for an answer about that one.
        this.catalogRequests.forget(fileId);
        this.catalogRequests.finish(fileId, false, "The catalog was closed before restoration completed");
        this.removeCatalogDisplayStore(fileId);
        WorkspaceIdRegistry.Instance.release(WorkspaceItemKind.Catalog, fileId);
        this.catalogGLData.delete(fileId);
        CatalogWebGLService.Instance.clearTexture(fileId);
        // update associated image
        const frame = AppStore.Instance.getFrame(this.getFrameIdByCatalogId(fileId));
        const fileIds = frame ? this.imageAssociatedCatalogId.get(frame.frameInfo.fileId) : undefined;
        let associatedCatalogIds: number[] = [];
        if (frame && fileIds) {
            associatedCatalogIds = fileIds.filter(catalogFileId => catalogFileId !== fileId);
            this.updateImageAssociatedCatalogId(frame.frameInfo.fileId, associatedCatalogIds);
        }

        if (catalogComponentId && associatedCatalogIds.length) {
            WidgetsStore.Instance.replaceCatalogWidgetSelection(fileId, associatedCatalogIds[0]);
        }
    }

    /** Move a plot widget onto another catalog, discarding whichever plot that catalog held in the same component. */
    @action rebindCatalogPlot = (catalogPlotWidgetId: string, catalogFileId: number): boolean => {
        for (const componentState of this.catalogPlots.values()) {
            for (const [currentCatalogFileId, widgetId] of componentState.plotWidgetIds.entries()) {
                if (widgetId !== catalogPlotWidgetId) {
                    continue;
                }
                if (currentCatalogFileId === catalogFileId) {
                    return false;
                }

                const replacedWidgetId = componentState.plotWidgetIds.get(catalogFileId);
                if (replacedWidgetId && replacedWidgetId !== catalogPlotWidgetId) {
                    WidgetsStore.Instance.deleteCatalogPlotWidget(replacedWidgetId);
                }
                componentState.plotWidgetIds.delete(currentCatalogFileId);
                componentState.plotWidgetIds.set(catalogFileId, catalogPlotWidgetId);
                componentState.setActiveCatalogFileId(catalogFileId);
                return true;
            }
        }
        return false;
    };

    @action updateImageAssociatedCatalogId(activeFrameIndex: number, associatedCatalogFiles: number[]) {
        this.imageAssociatedCatalogId.set(activeFrameIndex, associatedCatalogFiles);
    }

    @action resetActiveCatalogFile(imageFileId: number) {
        const fileIds = this.imageAssociatedCatalogId.get(imageFileId);
        const activeCatalogFileIds = fileIds ?? [];
        if (activeCatalogFileIds.length) {
            WidgetsStore.Instance.resetCatalogWidgetSelections(activeCatalogFileIds);
            this.resetCatalogPlotSelections(activeCatalogFileIds);
        }
    }

    /**
     * Keep every plot component showing a catalog that is actually on the image now in front.
     *
     * A component holds its own selection, so this is the one place that moves it when the catalog
     * it was showing is no longer one of the choices.
     */
    @action resetCatalogPlotSelections = (activeCatalogFileIds: number[]) => {
        if (!activeCatalogFileIds.length) {
            return;
        }
        const activeCatalogFileIdSet = new Set(activeCatalogFileIds);
        this.catalogPlots.forEach(componentState => {
            if (!activeCatalogFileIdSet.has(componentState.activeCatalogFileId)) {
                componentState.setActiveCatalogFileId(activeCatalogFileIds[0]);
            }
        });
    };

    getImageIdByCatalog(catalogFileId: number): number | undefined {
        let imageFileId: number | undefined = undefined;
        this.imageAssociatedCatalogId.forEach((catalogFileList, imageId) => {
            if (catalogFileList.includes(catalogFileId)) {
                imageFileId = imageId;
            }
        });
        return imageFileId;
    }

    /** The catalog a plot component is showing, if it has one. */
    getActiveCatalogPlotFile = (componentId: string): number | undefined => {
        return this.catalogPlots.get(componentId)?.activeCatalogFileId;
    };

    /** The plot a component keeps for one catalog, if it has been pointed at that catalog. */
    getCatalogPlotWidgetId = (componentId: string, catalogFileId: number | undefined): string | undefined => {
        return catalogFileId === undefined ? undefined : this.catalogPlots.get(componentId)?.plotWidgetIds.get(catalogFileId);
    };

    /**
     * Show the catalog a user picked in a plot component.
     *
     * A plot restored while its catalog was absent keeps that catalog's workspace ID so a later save
     * still names it, but a catalog the user picked replaces it: the plot now belongs to the catalog
     * it is showing, not to the one it was restored for.
     */
    @action selectCatalogPlotFile = (componentId: string, catalogFileId: number) => {
        this.catalogPlots.get(componentId)?.setActiveCatalogFileId(catalogFileId);
        if (!this.catalogProfileStores.has(catalogFileId)) {
            return;
        }
        const widgetId = this.getCatalogPlotWidgetId(componentId, catalogFileId);
        const plotStore = widgetId ? WidgetsStore.Instance.catalogPlotWidgets.get(widgetId) : undefined;
        const workspaceCatalogId = WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, catalogFileId);
        if (workspaceCatalogId !== undefined) {
            plotStore?.setWorkspaceCatalogId(workspaceCatalogId);
        }
    };

    @action setCatalogPlots(componentId: string, fileId: number, widgetId: string) {
        let componentState = this.catalogPlots.get(componentId);
        if (!componentState) {
            componentState = new CatalogPlotComponentState(fileId);
            this.catalogPlots.set(componentId, componentState);
        }
        componentState.plotWidgetIds.set(fileId, widgetId);
        // Kept past the widget store's own lifetime, so that a tab whose catalog has closed can
        // still be resolved back to the component it belongs to.
        this.catalogPlotComponents.set(widgetId, componentId);
        if (fileId !== CatalogStore.PENDING_CATALOG_FILE_ID) {
            // A layout can be applied while its catalog is already open, binding a restored plot
            // here rather than when the catalog arrives. Check its columns either way.
            this.validateCatalogPlotColumns(fileId);
        }
    }

    /**
     * The plot store one catalog plot component is showing. A component keeps one store per catalog
     * it has been switched to, so the widget ID it was created with is not always the plot on
     * screen. A component that has never been mounted has settled on nothing, and the widget's own
     * binding stands in for it.
     */
    public getDisplayedCatalogPlot(catalogPlotWidgetId: string): {widgetId: string; catalogFileId: number | undefined} {
        const {catalogPlotComponentId, catalogFileId} = this.getAssociatedIdByWidgetId(catalogPlotWidgetId);
        if (catalogPlotComponentId === undefined) {
            return {widgetId: catalogPlotWidgetId, catalogFileId};
        }
        const selectedCatalogFileId = this.getActiveCatalogPlotFile(catalogPlotComponentId) ?? catalogFileId;
        if (selectedCatalogFileId === undefined) {
            return {widgetId: catalogPlotWidgetId, catalogFileId};
        }
        return {
            widgetId: this.getCatalogPlotWidgetId(catalogPlotComponentId, selectedCatalogFileId) ?? catalogPlotWidgetId,
            catalogFileId: selectedCatalogFileId
        };
    }

    /**
     * Drop restored plot columns the catalog turns out not to have, and say which. Columns are
     * restored before the catalog is known, so they are checked once its data arrives, the way
     * a restored display config is.
     */
    @action validateCatalogPlotColumns(fileId: number) {
        const profileStore = this.catalogProfileStores.get(fileId);
        if (!profileStore) {
            return;
        }
        const dropped = new Set<string>();
        this.catalogPlots.forEach(componentState => {
            const widgetId = componentState.plotWidgetIds.get(fileId);
            const plotStore = widgetId ? WidgetsStore.Instance.catalogPlotWidgets.get(widgetId) : undefined;
            plotStore
                ?.resetUnknownColumns(column => {
                    const header = profileStore.getColumnHeader(column);
                    return header !== undefined && isCatalogNumericDataType(header.dataType);
                })
                .forEach(column => dropped.add(column));
        });
        if (dropped.size) {
            const catalogName = profileStore.catalogInfo.fileInfo.name ?? `catalog ${fileId}`;
            const columns = Array.from(dropped)
                .map(column => `"${column}"`)
                .join(", ");
            AppStore.Instance.logStore.addWarning(`Plot settings for ${catalogName} were not restored: ${columns} ${dropped.size > 1 ? "are not valid numeric columns" : "is not a valid numeric column"} in this catalog`, ["catalog"]);
        }
    }

    // remove catalog plot widget, keep placeholder
    @action clearCatalogPlotsByFileId(fileId: number) {
        const imageFileId = this.getImageIdByCatalog(fileId);
        const availableFileIds = (imageFileId === undefined ? [] : (this.imageAssociatedCatalogId.get(imageFileId) ?? [])).filter(candidateFileId => candidateFileId !== fileId && this.catalogProfileStores.has(candidateFileId));
        this.catalogPlots.forEach(componentState => {
            const widgetId = componentState.plotWidgetIds.get(fileId);
            if (widgetId) {
                WidgetsStore.Instance.deleteCatalogPlotWidget(widgetId);
            }
            componentState.plotWidgetIds.delete(fileId);
            if (componentState.activeCatalogFileId === fileId) {
                const remainingFile = availableFileIds.find(candidateFileId => componentState.plotWidgetIds.has(candidateFileId)) ?? availableFileIds[0] ?? componentState.plotWidgetIds.keys().next().value;
                componentState.setActiveCatalogFileId(remainingFile ?? undefined);
            }
        });
    }

    /** Whether a layout tab still retains this plot ID after its catalog store was removed. */
    public isCatalogPlotWidgetIdReserved(widgetId: string): boolean {
        return this.catalogPlotComponents.has(widgetId);
    }

    @action clearCatalogPlotsByComponentId(componentId: string) {
        const componentState = this.catalogPlots.get(componentId);
        if (componentState) {
            componentState.plotWidgetIds.forEach(widgetId => WidgetsStore.Instance.deleteCatalogPlotWidget(widgetId));
            this.catalogPlots.delete(componentId);
        }
        this.catalogPlotComponents.forEach((plotComponentId, widgetId) => {
            if (plotComponentId === componentId) {
                this.catalogPlotComponents.delete(widgetId);
            }
        });
    }

    @action clearCatalogPlotsByWidgetId(widgetId: string) {
        const catalogs = this.getAssociatedIdByWidgetId(widgetId);
        if (catalogs.catalogPlotComponentId) {
            this.clearCatalogPlotsByComponentId(catalogs.catalogPlotComponentId);
        }
    }

    @action closeAssociatedCatalog(imageFileId: number) {
        const appStore = AppStore.Instance;
        const catalogFileIds = this.imageAssociatedCatalogId.get(imageFileId);
        if (catalogFileIds?.length) {
            catalogFileIds.forEach(catalogFileId => {
                if (this.catalogDisplayStores.has(catalogFileId)) {
                    appStore.removeCatalog(catalogFileId);
                }
            });
            this.imageAssociatedCatalogId.delete(imageFileId);
        }
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
            let associatedCatalogIds = [...(this.imageAssociatedCatalogId.get(imageId) ?? [])];
            frame.spatialSiblings?.forEach(frame => {
                const catalogs = [...(this.imageAssociatedCatalogId.get(frame.frameInfo.fileId) ?? [])];
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

    getFrameIdByCatalogId(catalogId: number): number {
        let frameId = -1;
        this.imageAssociatedCatalogId.forEach((catalogIds, imageId) => {
            if (catalogIds.includes(catalogId)) {
                frameId = imageId;
            }
        });
        return frameId;
    }

    getAssociatedIdByWidgetId(catalogPlotWidgetId: string): {catalogPlotComponentId: string | undefined; catalogFileId: number | undefined} {
        let catalogPlotComponentId: string | undefined;
        let catalogFileId: number | undefined;
        this.catalogPlots.forEach((componentState, componentId) => {
            componentState.plotWidgetIds.forEach((widgetId, fileId) => {
                if (widgetId === catalogPlotWidgetId) {
                    catalogPlotComponentId = componentId;
                    catalogFileId = fileId;
                }
            });
        });
        if (catalogPlotComponentId !== undefined) {
            return {catalogPlotComponentId, catalogFileId};
        }
        // A widget loses its own binding when its catalog closes, but the layout still identifies
        // the tab by it. The component it was created in outlives that, and is still showing a
        // plot, so the tab resolves through it rather than becoming an orphan.
        const retainedComponentId = this.catalogPlotComponents.get(catalogPlotWidgetId);
        return {
            catalogPlotComponentId: retainedComponentId,
            catalogFileId: retainedComponentId !== undefined ? this.getActiveCatalogPlotFile(retainedComponentId) : undefined
        };
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
        const appStore = AppStore.Instance;
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
        const frame = appStore.getFrame(this.getFrameIdByCatalogId(catalogFileId));
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
            appStore.sendCatalogFilter(profileStore.updateRequestDataSize);
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
     * @returns whether the catalog could be restored as saved.
     */
    @action restoreCatalogFromWorkspace(catalogFileId: number, options: WorkspaceCatalogRestoreOptions = {}): boolean {
        const {overlay, shouldWaitForCompletion = false, selection} = options;
        if (shouldWaitForCompletion) {
            this.catalogRequests.start(catalogFileId);
        }

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
        const hasOverlay = !!overlay && overlay.xAxis !== CatalogOverlay.NONE && overlay.yAxis !== CatalogOverlay.NONE;
        const frame = AppStore.Instance.getFrame(this.getFrameIdByCatalogId(catalogFileId));
        if (overlay && (!hasOverlay || !frame)) {
            this.catalogRequests.finish(catalogFileId, false, "The saved overlay has no usable image or position axes");
            return false;
        }

        if (overlay && hasOverlay) {
            // Rows that stream in only carry the columns that were asked for, so a column the
            // overlay is mapped from has to be requested even when the table does not show it.
            profileStore.ensureColumnsRequested([overlay.xAxis, overlay.yAxis, displayStore.sizeMapColumn, displayStore.sizeMinorMapColumn, displayStore.colorMapColumn, displayStore.orientationMapColumn]);
            displayStore.setPlottedImageOverlayState(overlay.xAxis, overlay.yAxis, overlay.system, this.getOverlayMaxRows(profileStore, overlay.maxRows));
            this.clearImageCoordsData(catalogFileId);
        }

        const selectionColumnIndices = selection?.columns.map(columnName => profileStore.catalogControlHeader.get(columnName)?.columnIndex).filter((columnIndex): columnIndex is number => columnIndex !== undefined) ?? [];
        profileStore.resetFilterRequest();
        profileStore.setUpdateMode(hasOverlay ? CatalogUpdateMode.ViewUpdate : CatalogUpdateMode.TableUpdate);

        const filter = profileStore.updateRequestDataSize;
        filter.filterConfigs = profileStore.getUserFilters();
        filter.sortColumn = profileStore.sortingInfo.columnName;
        filter.sortingType = profileStore.sortingInfo.sortingType;
        filter.columnIndices = [...new Set([...profileStore.columnIndices, ...selectionColumnIndices])];
        if (selection) {
            const searchRows = Math.min(profileStore.catalogInfo.dataSize, selection.searchRows ?? profileStore.maxRows);
            filter.subsetDataSize = Math.max(filter.subsetDataSize ?? 0, searchRows);
        }
        if (overlay && hasOverlay) {
            // The table limit controls the number of visible rows, but the overlay may need more
            // rows from the same filtered/sorted result. The profile's normal request-size getter
            // only knows about the table limit, so widen this one request without changing it.
            filter.subsetDataSize = Math.max(filter.subsetDataSize ?? 0, this.getOverlayMaxRows(profileStore, overlay.maxRows));
        }
        profileStore.setUpdatingDataStream(true);
        const requestId = AppStore.Instance.sendCatalogFilter(filter);
        if (requestId === false) {
            this.catalogRequests.finish(catalogFileId, false, "The catalog request could not be sent");
            return false;
        }
        if (typeof requestId === "number") {
            this.catalogRequests.attach(catalogFileId, requestId);
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
        this.imageAssociatedCatalogId.get(frameId)?.forEach(catalogId => {
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
