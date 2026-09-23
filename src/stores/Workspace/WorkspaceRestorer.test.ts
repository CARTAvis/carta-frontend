import {afterEach, describe, expect, jest, test} from "@jest/globals";

import {WorkspaceItemKind} from "enums";
import {type Workspace, type WorkspaceIssue} from "models";
import {CatalogApiService} from "services";
import {AppStore, WorkspaceRestorer} from "stores";
import {fingerprintCatalogSelection} from "utilities";

/** What the restorer needs of an image it has opened. */
function createFrame(fileId: number) {
    return {
        frameInfo: {fileId},
        center: {x: 0, y: 0},
        isAxisZoomable: false,
        zoomLevel: 1,
        spatialReference: undefined,
        setChannels: jest.fn(),
        renderConfig: {applyConfig: jest.fn(), updateSiblings: jest.fn()},
        contourConfig: {applyConfig: jest.fn()},
        vectorOverlayConfig: {applyConfig: jest.fn()},
        applyContours: jest.fn(),
        applyVectorOverlay: jest.fn(),
        regionSet: {addExistingRegion: jest.fn(), selectSingleRegion: jest.fn()}
    };
}

/**
 * A session for the restorer to work against, recording the calls whose order the restore depends
 * on. The catalog it opens is a file-based one that is already loaded.
 */
function createSession() {
    const calls: string[] = [];
    const frames = new Map<number, ReturnType<typeof createFrame>>();
    let nextFileId = 0;

    const catalogHeader = [{columnIndex: 0, name: "Name"}];
    const catalogData = new Map([[0, {dataType: 0, data: ["a", "b", "c", "d", "e"]}]]);
    const profileStore = {
        catalogInfo: {dataSize: 5},
        isFileBasedCatalog: true,
        catalogHeader,
        catalogData,
        catalogOriginalData: catalogData,
        selectedPointIndices: [] as number[],
        getOriginIndices: jest.fn((indices: number[]) => indices),
        setSelectedPointIndices: jest.fn(),
        setCatalogCoordinateSystem: jest.fn(),
        applyTableConfig: jest.fn(() => calls.push("applyTableConfig"))
    };
    const displayStore = {
        applyConfig: jest.fn((): {success: boolean; errors: string[]} => {
            calls.push("applyDisplayConfig");
            return {success: true, errors: []};
        }),
        setShowSelectedData: jest.fn()
    };

    const appStore = {
        animatorStore: {stopAnimation: jest.fn()},
        tileService: {clearRequestQueue: jest.fn()},
        removeAllFrames: jest.fn(),
        /** The images the session currently holds, in the order they were opened. */
        frames: [] as ReturnType<typeof createFrame>[],
        appendFile: jest.fn(() => {
            const frame = createFrame(++nextFileId);
            frames.set(frame.frameInfo.fileId, frame);
            appStore.frames.push(frame);
            return Promise.resolve(frame);
        }),
        closeFile: jest.fn((frame: ReturnType<typeof createFrame>, _shouldConfirmClose?: boolean) => {
            appStore.frames = appStore.frames.filter(f => f !== frame);
        }),
        removeCatalog: jest.fn(),
        appendConcatFile: jest.fn(),
        appendCatalog: jest.fn(() => {
            calls.push("appendCatalog");
            return Promise.resolve(10);
        }),
        getFrame: jest.fn((fileId: number) => frames.get(fileId)),
        frameMap: frames,
        setSpatialReference: jest.fn(),
        setSpectralReference: jest.fn(),
        setRasterScalingReference: jest.fn(),
        setSpatialMatchingEnabled: jest.fn(),
        setSpectralMatchingEnabled: jest.fn(),
        setRasterScalingMatchingEnabled: jest.fn(),
        setTimeSeriesMember: jest.fn(),
        updateActiveImageByFrame: jest.fn(),
        reorderFrame: jest.fn(),
        spatialReference: undefined,
        spectralReference: undefined,
        rasterScalingReference: undefined,
        preferenceStore: {regionColor: "#ffffff", regionLineWidth: 2, regionDashLength: 0},
        imageViewConfigStore: {createColorBlending: jest.fn(), imageNum: 1},
        catalogStore: {
            catalogRequests: {
                failAll: jest.fn(),
                wait: jest.fn(() => Promise.resolve({success: true})),
                finish: jest.fn()
            },
            setWorkspaceCatalogId: jest.fn(),
            catalogProfileStores: new Map<number, unknown>([[10, profileStore]]),
            getCatalogDisplayStore: jest.fn(() => displayStore),
            restoreCatalogFromWorkspace: jest.fn((_catalogFileId?: number, _overlay?: unknown, _isWaitingForCompletion?: boolean, _selection?: unknown) => {
                calls.push("restoreCatalogRows");
                return true;
            }),
            getAssociatedIdByWidgetId: jest.fn(() => ({catalogPlotComponentId: "", catalogFileId: 10})),
            rebindCatalogPlot: jest.fn((_catalogPlotWidgetId?: string, _catalogFileId?: number) => true)
        },
        widgetsStore: {
            catalogWidgets: new Map(),
            catalogPlotWidgets: new Map(),
            restoreCatalogPanels: jest.fn(),
            setCatalogWidgetSelectionByWidgetId: jest.fn((_widgetId?: string, _catalogFileId?: number) => true)
        },
        layoutStore: {
            applyLayoutConfig: jest.fn((_layout?: unknown) => {
                calls.push("applyLayout");
                return true;
            })
        }
    };

    jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore as any);
    return {appStore, calls, profileStore, displayStore};
}

/** What the restorer needs of a catalog plot: the catalog it names, and a way to go on naming it. */
function createPlotStore(workspaceCatalogId: number, columns: {xColumnName: string; yColumnName?: string}) {
    const plotStore = {
        workspaceCatalogId,
        statisticColumnName: "None",
        setWorkspaceCatalogId: jest.fn((id: number) => {
            plotStore.workspaceCatalogId = id;
        }),
        ...columns
    };
    return plotStore;
}

/** Drive the restore the way a mobx flow does. */
async function restoreIssues(workspace: Workspace): Promise<WorkspaceIssue[]> {
    const generator = new WorkspaceRestorer(workspace, WorkspaceRestorer.claimGeneration()).restore();
    let step = generator.next();
    while (!step.done) {
        step = generator.next(await step.value);
    }
    return step.value;
}

/** What a restore reports, as the sentences a person reads. */
async function restore(workspace: Workspace): Promise<string[]> {
    return (await restoreIssues(workspace)).map(issue => issue.message);
}

const IMAGE = {id: 1, source: {type: "file" as const, filename: "image.fits"}};
const CATALOG = {id: 1, source: {type: "file" as const, filename: "sources.vot"}, associatedImageId: 1};
const LAYOUT = {layoutVersion: 2, docked: {type: "row", content: [{type: "component", id: "image-view"}]}, floating: []};

function createWorkspace(overrides: Partial<Workspace> = {}): Workspace {
    return {workspaceVersion: 2, frontendVersion: 0, files: [IMAGE], ...overrides};
}

describe("WorkspaceRestorer", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("restores nothing but reports no problems for an empty workspace", async () => {
        const {appStore} = createSession();

        expect(await restore(createWorkspace({files: []}))).toEqual([]);
        expect(appStore.removeAllFrames).toHaveBeenCalled();
    });

    test("reports a catalog whose image was not restored, and does not open it", async () => {
        const {appStore} = createSession();

        const problems = await restore(createWorkspace({catalogs: [{...CATALOG, associatedImageId: 7}]}));

        expect(problems).toEqual(["Could not load the catalog sources.vot: the image it belongs to was not restored"]);
        expect(appStore.appendCatalog).not.toHaveBeenCalled();
    });

    test("applies a catalog's table config before how it is drawn, and reloads its rows last", async () => {
        const {calls} = createSession();

        const problems = await restore(createWorkspace({catalogs: [{...CATALOG, tableConfig: {maxRows: 4}, displayConfig: {color: "#123456"}}]}));

        expect(problems).toEqual([]);
        expect(calls).toEqual(["appendCatalog", "applyTableConfig", "applyDisplayConfig", "restoreCatalogRows"]);
    });

    test("restores selected catalog rows by content identity in the selection index space", async () => {
        const {profileStore, displayStore} = createSession();
        const selection = fingerprintCatalogSelection(profileStore.catalogHeader as any, profileStore.catalogData as any, [1]);
        profileStore.getOriginIndices.mockReturnValue([3]);

        expect(await restore(createWorkspace({catalogs: [{...CATALOG, selection: {...selection!, isShowingSelectedData: true}}]}))).toEqual([]);
        expect(profileStore.getOriginIndices).toHaveBeenCalledWith([1]);
        expect(profileStore.setSelectedPointIndices).toHaveBeenCalledWith([3], false);
        expect(displayStore.setShowSelectedData).toHaveBeenCalledWith(true);
    });

    test("reports selection identity data that did not finish loading separately from missing rows", async () => {
        const {profileStore, displayStore} = createSession();
        const selection = fingerprintCatalogSelection(profileStore.catalogHeader as any, profileStore.catalogData as any, [1]);
        profileStore.catalogInfo.dataSize = 10;

        expect(await restore(createWorkspace({catalogs: [{...CATALOG, selection: {...selection!, searchRows: 10, isShowingSelectedData: true}}]}))).toEqual([
            "Could not restore the selected rows of the catalog sources.vot: the identifying data was not fully loaded"
        ]);
        expect(profileStore.setSelectedPointIndices).not.toHaveBeenCalled();
        expect(displayStore.setShowSelectedData).toHaveBeenCalledWith(false);
    });

    test("does not draw a catalog whose display config was rejected", async () => {
        const {appStore, displayStore, calls} = createSession();
        displayStore.applyConfig.mockReturnValue({success: false, errors: ['The size axis is mapped to "Fmag", which this catalog does not have']});

        const problems = await restore(createWorkspace({catalogs: [{...CATALOG, displayConfig: {color: "#123456"}}]}));

        expect(problems).toEqual(['Could not restore how the catalog sources.vot is drawn: The size axis is mapped to "Fmag", which this catalog does not have']);
        expect(appStore.catalogStore.restoreCatalogFromWorkspace).toHaveBeenCalledWith(10, undefined, true, undefined);
        expect(calls).toContain("applyTableConfig");
    });

    test("restores the arrangement the workspace was saved in, once its catalogs are loaded", async () => {
        const {appStore, calls} = createSession();

        const problems = await restore(createWorkspace({catalogs: [CATALOG], layout: LAYOUT}));

        expect(problems).toEqual([]);
        expect(appStore.layoutStore.applyLayoutConfig).toHaveBeenCalledWith(LAYOUT);
        expect(calls.indexOf("applyLayout")).toBeGreaterThan(calls.indexOf("restoreCatalogRows"));
    });

    test("gives up on an online query that is still on its way", async () => {
        createSession();
        const cancelPendingQueries = jest.spyOn(CatalogApiService.Instance, "cancelPendingQueries").mockImplementation(jest.fn());

        await restore(createWorkspace());

        // The query would otherwise land on whichever image is active when it returns, which by
        // then is one of the images this restore has just opened.
        expect(cancelPendingQueries).toHaveBeenCalled();
    });

    test("stops a restore that a later workspace load has taken the session from", async () => {
        const {appStore} = createSession();
        const workspace = createWorkspace({files: [IMAGE, {id: 2, source: {type: "file" as const, filename: "second.fits"}}], layout: LAYOUT});
        const generator = new WorkspaceRestorer(workspace, WorkspaceRestorer.claimGeneration()).restore();

        // Start another load, the way a second loadWorkspace would, while the first image is opening.
        let step = generator.next();
        WorkspaceRestorer.claimGeneration();
        while (!step.done) {
            step = generator.next(await step.value);
        }

        expect(appStore.appendFile).toHaveBeenCalledTimes(1);
        expect(appStore.layoutStore.applyLayoutConfig).not.toHaveBeenCalled();
    });

    test("takes back out an image that finished opening after a later load took the session", async () => {
        const {appStore} = createSession();
        let arrive!: (frame: unknown) => void;
        const opening = new Promise<any>(resolve => {
            arrive = resolve;
        });
        const frame = createFrame(99);
        appStore.appendFile.mockImplementation(() => {
            appStore.frames.push(frame);
            return opening as ReturnType<typeof appStore.appendFile>;
        });

        const generator = new WorkspaceRestorer(createWorkspace({layout: LAYOUT}), WorkspaceRestorer.claimGeneration()).restore();
        const step = generator.next();

        // The second load claims the session while the first image is still on its way, and the
        // image only arrives afterwards.
        WorkspaceRestorer.claimGeneration();
        arrive(frame);
        let next = generator.next(await step.value);
        while (!next.done) {
            next = generator.next(await next.value);
        }

        expect(appStore.closeFile).toHaveBeenCalledWith(frame, false);
        expect(appStore.frames).not.toContain(frame);
        expect(appStore.layoutStore.applyLayoutConfig).not.toHaveBeenCalled();
    });

    test("leaves the session's arrangement alone for a workspace saved without one", async () => {
        const {appStore} = createSession();

        expect(await restore(createWorkspace())).toEqual([]);
        expect(appStore.layoutStore.applyLayoutConfig).not.toHaveBeenCalled();
    });

    test("reports an arrangement the session could not apply", async () => {
        const {appStore} = createSession();
        appStore.layoutStore.applyLayoutConfig.mockReturnValue(false);

        expect(await restore(createWorkspace({layout: LAYOUT}))).toEqual(["Could not restore the layout the workspace was saved in"]);
    });

    test("rejects an invalid embedded layout before asking the layout store to replace widgets", async () => {
        const {appStore} = createSession();
        const invalidLayout = {...LAYOUT, docked: {type: "row", content: []}};

        expect(await restore(createWorkspace({layout: invalidLayout}))).toEqual(["Could not restore the layout the workspace was saved in"]);
        expect(appStore.layoutStore.applyLayoutConfig).not.toHaveBeenCalled();
    });

    test("points each catalog widget at the catalog it was showing", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({catalogs: [CATALOG], selectedCatalogIds: {"catalog-overlay-0": 1}}));

        expect(appStore.widgetsStore.restoreCatalogPanels).toHaveBeenCalledWith(["catalog-overlay-0"]);
        expect(appStore.widgetsStore.setCatalogWidgetSelectionByWidgetId).toHaveBeenCalledWith("catalog-overlay-0", 10);
    });

    test("reports a catalog widget selection that could not be applied", async () => {
        const {appStore} = createSession();
        appStore.widgetsStore.setCatalogWidgetSelectionByWidgetId.mockReturnValue(false);

        const problems = await restore(createWorkspace({catalogs: [CATALOG], selectedCatalogIds: {"catalog-overlay-0": 1}}));

        expect(problems).toContain("Could not restore catalog widget catalog-overlay-0 to the catalog sources.vot: the widget selection could not be applied");
    });

    test("preserves and reports an unavailable catalog widget source while identifying its fallback", async () => {
        const {appStore} = createSession();
        const widgetStore = {widgetId: "catalog-overlay-0", selectedCatalogId: 10, setUnavailableWorkspaceCatalogId: jest.fn()};
        appStore.widgetsStore.catalogWidgets.set("catalog-overlay-0", widgetStore);

        const problems = await restore(createWorkspace({catalogs: [CATALOG], selectedCatalogIds: {"catalog-overlay-0": 7}}));

        expect(widgetStore.setUnavailableWorkspaceCatalogId).toHaveBeenCalledWith(7);
        expect(problems).toContain("Could not restore catalog widget catalog-overlay-0: workspace catalog 7 is unavailable; it is showing the catalog sources.vot instead");
    });

    test("preserves and reports an unavailable catalog plot source while identifying its fallback", async () => {
        const {appStore} = createSession();
        const plotStore = createPlotStore(7, {xColumnName: "Name", yColumnName: undefined});
        appStore.widgetsStore.catalogPlotWidgets.set("catalog-plot-0", plotStore);

        const problems = await restore(createWorkspace({catalogs: [CATALOG]}));

        expect(plotStore.workspaceCatalogId).toBe(7);
        expect(problems).toContain("Could not restore catalog plot catalog-plot-0: workspace catalog 7 is unavailable; it is showing the catalog sources.vot instead");
    });

    test("rebinds a restored catalog plot to the catalog it was saved against after catalog switch", async () => {
        const {appStore} = createSession();
        const catalogB = {id: 2, source: {type: "file" as const, filename: "sources_b.vot"}, associatedImageId: 1};
        const profileStoreB = {
            applyTableConfig: jest.fn(() => ({success: true, errors: []})),
            catalogHeader: [{name: "FLUX_B"}, {name: "MAG_B"}],
            isComplete: true
        };
        appStore.catalogStore.catalogProfileStores.set(20, profileStoreB);
        let catalogIndex = 0;
        appStore.appendCatalog = jest.fn(() => Promise.resolve(catalogIndex++ === 0 ? 10 : 20));

        const plotStore = createPlotStore(2, {xColumnName: "FLUX_B", yColumnName: "MAG_B"});
        appStore.widgetsStore.catalogPlotWidgets.set("catalog-plot-0", plotStore);
        (appStore.catalogStore.getAssociatedIdByWidgetId as jest.Mock).mockReturnValue({catalogPlotComponentId: "catalog-plot-component-0", catalogFileId: 10});

        const problems = await restore(createWorkspace({catalogs: [CATALOG, catalogB]}));

        expect(problems).toEqual([]);
        expect(appStore.catalogStore.rebindCatalogPlot).toHaveBeenCalledWith("catalog-plot-0", 20);
    });

    test("reports catalog plot columns that are no longer available", async () => {
        const {appStore} = createSession();
        appStore.widgetsStore.catalogPlotWidgets.set("catalog-plot-0", {workspaceCatalogId: 1, xColumnName: "Name", yColumnName: "Flux", statisticColumnName: "None"});

        const problems = await restore(createWorkspace({catalogs: [CATALOG]}));

        expect(problems).toContain("Could not fully restore catalog plot catalog-plot-0 for the catalog sources.vot: column Flux is unavailable");
    });

    test("says what kind of thing each report is about, and which one", async () => {
        const {appStore} = createSession();
        appStore.appendFile = jest.fn(() => Promise.resolve(undefined));

        const issues = await restoreIssues(createWorkspace({catalogs: [CATALOG], layout: {...LAYOUT, docked: {type: "row", content: []}}}));

        expect(issues).toContainEqual({
            kind: WorkspaceItemKind.Image,
            subject: "image.fits",
            message: "Could not open the image image.fits"
        });
        expect(issues).toContainEqual({
            kind: WorkspaceItemKind.Catalog,
            subject: "sources.vot",
            message: "Could not load the catalog sources.vot: the image it belongs to was not restored"
        });
        expect(issues).toContainEqual({
            kind: WorkspaceItemKind.Layout,
            subject: "",
            message: "Could not restore the layout the workspace was saved in"
        });
    });
});
