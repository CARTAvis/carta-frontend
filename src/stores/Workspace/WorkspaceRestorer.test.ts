import {afterEach, describe, expect, jest, test} from "@jest/globals";
import {observable, runInAction} from "mobx";

import {CatalogSystemType, ImageType, RadiusUnits, WorkspaceItemKind} from "enums";
import {type Workspace, type WorkspaceCatalogQuerySource, type WorkspaceIssue} from "models";
import {CatalogApiService} from "services";
import {AppStore, CatalogOnlineQueryConfigStore, WorkspaceIdRegistry, WorkspaceRestorer} from "stores";
import {fingerprintCatalogSelection} from "utilities";

/** What the restorer needs of an image's render config, with the cube histogram's progress observable as in the real store. */
function createRenderConfig() {
    const state = observable({isUsingCubeHistogram: false, cubeHistogramProgress: 0});
    return {
        get isUsingCubeHistogram() {
            return state.isUsingCubeHistogram;
        },
        get cubeHistogramProgress() {
            return state.cubeHistogramProgress;
        },
        applyConfig: jest.fn((config: {useCubeHistogram?: boolean}) => runInAction(() => (state.isUsingCubeHistogram = config.useCubeHistogram ?? false))),
        updateSiblings: jest.fn(),
        awaitCompleteCubeHistogram: jest.fn(),
        keepRangeWithoutCubeHistogram: jest.fn(),
        /** Report the cube histogram's progress, as the backend's messages do. */
        reportCubeHistogramProgress: (progress: number) => runInAction(() => (state.cubeHistogramProgress = progress))
    };
}

/** What the restorer needs of an image it has opened. */
function createFrame(fileId: number) {
    return {
        frameInfo: {fileId},
        center: {x: 0, y: 0},
        isAxisZoomable: false,
        zoomLevel: 1,
        spatialReference: undefined,
        setChannels: jest.fn(),
        renderConfig: createRenderConfig(),
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
        rows: {
            data: catalogData,
            originalData: catalogData,
            // Nothing says how many pass the filter, so every row is looked among.
            get matchingRowCount() {
                return profileStore.catalogInfo.dataSize;
            },
            getOriginIndices: jest.fn((indices: number[]) => indices)
        },
        selectedPointIndices: [] as number[],
        setSelectedPointIndices: jest.fn(),
        setCatalogCoordinateSystem: jest.fn(),
        applyTableConfig: jest.fn(() => calls.push("applyTableConfig")),
        ensureColumnsRequested: jest.fn()
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
        appendConcatFile: jest.fn(),
        appendCatalog: jest.fn(() => {
            calls.push("appendCatalog");
            return Promise.resolve(10);
        }),
        getFrame: jest.fn((fileId: number) => frames.get(fileId)),
        requestCubeHistogram: jest.fn((_fileId?: number) => {
            calls.push("requestCubeHistogram");
        }),
        cancelCubeHistogramRequest: jest.fn(),
        setWorkspaceLoadingStep: jest.fn(),
        frameMap: frames,
        setSpatialReference: jest.fn(),
        setSpectralReference: jest.fn(),
        setRasterScalingReference: jest.fn(),
        setSpatialMatchingEnabled: jest.fn(),
        setSpectralMatchingEnabled: jest.fn(),
        setRasterScalingMatchingEnabled: jest.fn(),
        setTimeSeriesMember: jest.fn(),
        activeFrame: undefined as ReturnType<typeof createFrame> | undefined,
        activeImage: undefined as unknown,
        updateActiveImageByFrame: jest.fn((frame: ReturnType<typeof createFrame>) => {
            appStore.activeFrame = frame;
            appStore.activeImage = {type: ImageType.FRAME, store: frame};
        }),
        updateActiveImage: jest.fn((image: unknown) => {
            appStore.activeImage = image;
        }),
        reorderFrame: jest.fn(),
        spatialReference: undefined,
        spectralReference: undefined,
        rasterScalingReference: undefined,
        preferenceStore: {regionColor: "#ffffff", regionLineWidth: 2, regionDashLength: 0},
        imageViewConfigStore: {createColorBlending: jest.fn(), imageNum: 1},
        catalogStore: {
            close: jest.fn(),
            interruptRequests: jest.fn(),
            failRequest: jest.fn(),
            catalogProfileStores: new Map<number, unknown>([[10, profileStore]]),
            getCatalogDisplayStore: jest.fn(() => displayStore),
            restoreCatalogFromWorkspace: jest.fn((_catalogFileId?: number, _options?: unknown): Promise<{success: boolean; didStart: boolean; message?: string}> => {
                calls.push("restoreCatalogRows");
                return Promise.resolve({success: true, didStart: true});
            }),
            widgetBindings: {restore: jest.fn((_catalogWidgets?: unknown, _catalogs?: unknown, _catalogIds?: Map<number, number>): unknown[] => [])}
        },
        widgetsStore: {
            catalogWidgets: new Map(),
            catalogPlotWidgets: new Map()
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

    test("re-queries a saved SIMBAD source without changing the online query dialog", async () => {
        createSession();
        const source: WorkspaceCatalogQuerySource = {type: "simbad", center: {x: 12.5, y: -30.25}, system: CatalogSystemType.ICRS, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 500};
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const setDatabase = jest.spyOn(configStore, "setCatalogDB");
        const setRadius = jest.spyOn(configStore, "setSearchRadius");
        const updateCenter = jest.spyOn(configStore, "updateCenterPixelCoord");
        const load = jest.spyOn(CatalogApiService.Instance, "loadSimbadCatalog").mockResolvedValue({fileId: 10, dataSize: 5});

        expect(await restore(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}]}))).toEqual([]);

        expect(load).toHaveBeenCalledWith(source, 1);
        expect(setDatabase).not.toHaveBeenCalled();
        expect(setRadius).not.toHaveBeenCalled();
        expect(updateCenter).not.toHaveBeenCalled();
    });

    test("loads a saved VizieR table through its source and reports one without a table", async () => {
        createSession();
        const source: WorkspaceCatalogQuerySource = {type: "vizier", center: {x: 12.5, y: -30.25}, system: CatalogSystemType.FK5, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 500, table: "I/355/gaiadr3"};
        const load = jest.spyOn(CatalogApiService.Instance, "loadVizierCatalogs").mockResolvedValue([10]);

        expect(await restore(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}]}))).toEqual([]);
        expect(load).toHaveBeenCalledWith(source, ["I/355/gaiadr3"], 1);

        load.mockClear();
        expect(await restore(createWorkspace({catalogs: [{id: 1, source: {...source, table: undefined}, associatedImageId: 1}]}))).toContain("Could not load the catalog from the VizieR query");
        expect(load).not.toHaveBeenCalled();
    });

    test("matches no image to a reference the workspace could not name", async () => {
        // The session that saved this was matched to an image it could not save -- a generated one
        // -- so the workspace names no reference. An image that named none was not matched either,
        // and must not come back matched to whatever this session happens to be referencing.
        const {appStore} = createSession();
        appStore.spatialReference = {} as never;

        await restore(createWorkspace({files: [{...IMAGE, references: {}}], references: {}}));

        expect(appStore.setSpatialMatchingEnabled).not.toHaveBeenCalled();
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

    test("puts the image the workspace was saved with in front", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({files: [IMAGE, {...IMAGE, id: 2, source: {type: "file", filename: "second.fits"}}], selectedFile: 2}));

        expect(appStore.activeFrame?.frameInfo.fileId).toBe(appStore.frames[1].frameInfo.fileId);
    });

    test("puts the first restored image in front when the one saved in front is not back", async () => {
        const {appStore} = createSession();

        // A generated image was in front when it was saved, so the workspace names none.
        await restore(createWorkspace({files: [IMAGE, {...IMAGE, id: 2, source: {type: "file", filename: "second.fits"}}], selectedFile: undefined}));

        expect(appStore.activeFrame?.frameInfo.fileId).toBe(appStore.frames[0].frameInfo.fileId);
    });

    test("keeps the first restored image in front after rebuilding a color-blended image", async () => {
        const {appStore} = createSession();
        // A new color-blended image is put in front, and the image in front is then its base.
        appStore.imageViewConfigStore.createColorBlending.mockImplementation(() => {
            appStore.activeFrame = appStore.frames[1];
            return null;
        });

        await restore(
            createWorkspace({
                files: [IMAGE, {...IMAGE, id: 2, source: {type: "file", filename: "second.fits"}}],
                selectedFile: undefined,
                colorBlendingImages: [{imageListIndex: 2, selectedFrameId: [2], alpha: [1, 1]}]
            })
        );

        expect(appStore.imageViewConfigStore.createColorBlending).toHaveBeenCalled();
        expect(appStore.activeFrame?.frameInfo.fileId).toBe(appStore.frames[0].frameInfo.fileId);
    });

    test("puts the color-blended image saved in front back there", async () => {
        const {appStore} = createSession();
        const colorBlendings = [{id: 0}, {id: 1}];
        appStore.imageViewConfigStore.createColorBlending.mockImplementation(() => {
            const colorBlending = colorBlendings.shift();
            appStore.activeImage = {type: ImageType.COLOR_BLENDING, store: colorBlending};
            return {...colorBlending, selectedFrames: [], deleteSelectedFrame: jest.fn(), setAlpha: jest.fn(), addSelectedFrame: jest.fn()};
        });

        await restore(
            createWorkspace({
                files: [IMAGE, {...IMAGE, id: 2, source: {type: "file", filename: "second.fits"}}],
                selectedFile: 1,
                colorBlendingImages: [
                    {imageListIndex: 2, selectedFrameId: [2], alpha: [1, 1]},
                    {imageListIndex: 3, selectedFrameId: [2], alpha: [1, 1]}
                ],
                selectedColorBlending: 2
            })
        );

        expect(appStore.activeImage).toEqual({type: ImageType.COLOR_BLENDING, store: expect.objectContaining({id: 0})});
    });

    test("puts the image in front back before the catalogs open, so that it does not undo the restored widgets", async () => {
        const {appStore} = createSession();
        appStore.imageViewConfigStore.createColorBlending.mockImplementation(() => {
            appStore.activeFrame = appStore.frames[1];
            return null;
        });

        await restore(
            createWorkspace({
                files: [IMAGE, {...IMAGE, id: 2, source: {type: "file", filename: "second.fits"}}],
                selectedFile: 1,
                colorBlendingImages: [{imageListIndex: 2, selectedFrameId: [2], alpha: [1, 1]}],
                catalogs: [CATALOG]
            })
        );

        // A change of the image in front moves the catalog widgets onto its catalogs, and it takes
        // effect when the restore next waits; after the widgets are restored it would undo them.
        const lastFrontChange = Math.max(...appStore.updateActiveImageByFrame.mock.invocationCallOrder);
        expect(lastFrontChange).toBeGreaterThan(appStore.imageViewConfigStore.createColorBlending.mock.invocationCallOrder[0]);
        expect(lastFrontChange).toBeLessThan(appStore.appendCatalog.mock.invocationCallOrder[0]);
        expect(appStore.catalogStore.widgetBindings.restore).toHaveBeenCalled();
        expect(appStore.activeFrame?.frameInfo.fileId).toBe(appStore.frames[0].frameInfo.fileId);
    });

    test("asks for the columns its saved plots are drawn from, though the table hides them", async () => {
        const {appStore, profileStore} = createSession();

        await restore(
            createWorkspace({
                catalogs: [CATALOG, {...CATALOG, id: 2}],
                catalogWidgets: {
                    "plot-a": {type: "catalog-plot", catalogId: 1, xColumnName: "Fmag", yColumnName: "Bmag", statisticColumnName: "Vmag"},
                    "plot-b": {type: "catalog-plot", catalogId: 2, xColumnName: "Other"},
                    "table-a": {type: "catalog-overlay", catalogId: 1}
                }
            })
        );

        expect(profileStore.ensureColumnsRequested).toHaveBeenCalledWith(["Fmag", "Bmag", "Vmag"]);
        // Asked for before the rows are, so that the rows carry them.
        expect(profileStore.ensureColumnsRequested.mock.invocationCallOrder[0]).toBeLessThan(appStore.catalogStore.restoreCatalogFromWorkspace.mock.invocationCallOrder[0]);
    });

    test("asks for as many of a catalog's rows as it had loaded when it was saved", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({catalogs: [{...CATALOG, tableConfig: {maxRows: 400, loadedRows: 300}}]}));

        expect(appStore.catalogStore.restoreCatalogFromWorkspace).toHaveBeenCalledWith(10, expect.objectContaining({loadedRows: 300}));
    });

    test("asks for a catalog's rows only once the one before it has come back", async () => {
        const {appStore, profileStore} = createSession();
        const secondCatalog = {id: 2, source: {type: "file" as const, filename: "other.vot"}, associatedImageId: 1};
        appStore.catalogStore.catalogProfileStores.set(20, profileStore);
        let nextCatalogFileId = 0;
        appStore.appendCatalog.mockImplementation(() => Promise.resolve((nextCatalogFileId += 10)));

        let finishFirst!: (result: {success: boolean; didStart: boolean}) => void;
        const firstCompletion = new Promise<{success: boolean; didStart: boolean}>(resolve => {
            finishFirst = resolve;
        });
        appStore.catalogStore.restoreCatalogFromWorkspace.mockImplementation((catalogFileId: number) => (catalogFileId === 10 ? firstCompletion : Promise.resolve({success: true, didStart: true})));

        const generator = new WorkspaceRestorer(createWorkspace({catalogs: [CATALOG, secondCatalog]}), WorkspaceRestorer.claimGeneration()).restore();
        let step = generator.next();
        while (!step.done && step.value !== firstCompletion) {
            step = generator.next(await step.value);
        }

        // The backend answers one catalog request at a time, so a second one sent now would only wait
        // behind the first, and could time out doing so.
        expect(step.done).toBe(false);
        expect(appStore.catalogStore.restoreCatalogFromWorkspace.mock.calls.map(([catalogFileId]) => catalogFileId)).toEqual([10]);

        finishFirst({success: true, didStart: true});
        while (!step.done) {
            step = generator.next(await step.value);
        }
        expect(appStore.catalogStore.restoreCatalogFromWorkspace.mock.calls.map(([catalogFileId]) => catalogFileId)).toEqual([10, 20]);
        expect(step.value).toEqual([]);
    });

    test("keeps the original report when a catalog row request cannot start", async () => {
        const {appStore} = createSession();
        appStore.catalogStore.restoreCatalogFromWorkspace.mockResolvedValue({success: false, didStart: false, message: "The catalog request could not be sent"});

        const problems = await restore(createWorkspace({catalogs: [CATALOG]}));

        expect(problems).toEqual(["Could not restore the rows of the catalog sources.vot"]);
    });

    test("restores selected catalog rows by content identity in the selection index space", async () => {
        const {profileStore, displayStore} = createSession();
        const selection = fingerprintCatalogSelection(profileStore.catalogHeader as any, profileStore.rows.data as any, [1]);
        profileStore.rows.getOriginIndices.mockReturnValue([3]);

        expect(await restore(createWorkspace({catalogs: [{...CATALOG, selection: {...selection!, isShowingSelectedData: true}}]}))).toEqual([]);
        expect(profileStore.rows.getOriginIndices).toHaveBeenCalledWith([1]);
        expect(profileStore.setSelectedPointIndices).toHaveBeenCalledWith([3], false);
        expect(displayStore.setShowSelectedData).toHaveBeenCalledWith(true);
    });

    test("reports selection identity data that did not finish loading separately from missing rows", async () => {
        const {profileStore, displayStore} = createSession();
        const selection = fingerprintCatalogSelection(profileStore.catalogHeader as any, profileStore.rows.data as any, [1]);
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
        expect(appStore.catalogStore.restoreCatalogFromWorkspace).toHaveBeenCalledWith(10, {overlay: undefined, selection: undefined});
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

    test("takes back out a catalog that arrives after another restore takes the session", async () => {
        const {appStore, profileStore} = createSession();
        WorkspaceIdRegistry.Instance.clear(WorkspaceItemKind.Catalog);
        let finishCatalog!: (fileId: number) => void;
        const opening = new Promise<number>(resolve => (finishCatalog = resolve));
        appStore.appendCatalog.mockReturnValue(opening);
        const generator = new WorkspaceRestorer(createWorkspace({catalogs: [CATALOG], layout: LAYOUT}), WorkspaceRestorer.claimGeneration()).restore();

        let step = generator.next();
        while (!step.done && !appStore.appendCatalog.mock.calls.length) {
            step = generator.next(await step.value);
        }
        expect(appStore.appendCatalog).toHaveBeenCalledTimes(1);

        WorkspaceRestorer.claimGeneration();
        finishCatalog(10);
        while (!step.done) {
            step = generator.next(await step.value);
        }

        expect(appStore.catalogStore.close).toHaveBeenCalledWith(10);
        expect(WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, 10)).toBeUndefined();
        expect(profileStore.applyTableConfig).not.toHaveBeenCalled();
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

    test("reports an invalid embedded layout the layout store could not apply", async () => {
        const {appStore} = createSession();
        appStore.layoutStore.applyLayoutConfig.mockReturnValue(false);
        const invalidLayout = {...LAYOUT, docked: {type: "row", content: []}};

        expect(await restore(createWorkspace({layout: invalidLayout}))).toEqual(["Could not restore the layout the workspace was saved in"]);
        expect(appStore.layoutStore.applyLayoutConfig).toHaveBeenCalledWith(invalidLayout);
    });

    test("points the catalog widgets at the catalogs just loaded", async () => {
        const {appStore} = createSession();

        const catalogWidgets = {"catalog-overlay-0": {type: "catalog-overlay" as const, catalogId: 1}};
        await restore(createWorkspace({catalogs: [CATALOG], catalogWidgets}));

        expect(appStore.catalogStore.widgetBindings.restore).toHaveBeenCalledWith(catalogWidgets, [CATALOG], new Map([[1, 10]]));
    });

    test("reports what the catalog widgets could not be pointed at", async () => {
        const {appStore} = createSession();
        const issue = {kind: WorkspaceItemKind.CatalogWidget, subject: "catalog-overlay-0", message: "Could not restore catalog widget catalog-overlay-0"};
        appStore.catalogStore.widgetBindings.restore.mockReturnValue([issue]);

        const problems = await restore(createWorkspace({catalogs: [CATALOG], catalogWidgets: {"catalog-overlay-0": {type: "catalog-overlay", catalogId: 7}}}));

        expect(problems).toContain(issue.message);
    });

    test("says what kind of thing each report is about, and which one", async () => {
        const {appStore} = createSession();
        appStore.appendFile = jest.fn(() => Promise.resolve(undefined));
        appStore.layoutStore.applyLayoutConfig.mockReturnValue(false);

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

    describe("an image whose percentile range was taken from the cube histogram", () => {
        const cubeImage = {...IMAGE, renderConfig: {useCubeHistogram: true, selectedPercentile: [99.5], scaleMin: [1], scaleMax: [2]}};

        afterEach(() => {
            jest.useRealTimers();
        });

        test("computes its cube histogram again while the catalogs open, and waits for it before the layout", async () => {
            const {appStore, calls} = createSession();
            appStore.requestCubeHistogram.mockImplementation((fileId?: number) => {
                calls.push("requestCubeHistogram");
                const renderConfig = appStore.getFrame(fileId as number)!.renderConfig;
                // Complete only once the catalogs have started opening.
                setTimeout(() => {
                    renderConfig.reportCubeHistogramProgress(0.5);
                    setTimeout(() => {
                        calls.push("cubeHistogramComplete");
                        renderConfig.reportCubeHistogramProgress(1);
                    }, 0);
                }, 0);
            });

            const issues = await restore(createWorkspace({files: [cubeImage], catalogs: [CATALOG], layout: LAYOUT}));

            const frame = appStore.frames[0];
            expect(issues).toEqual([]);
            expect(frame.renderConfig.awaitCompleteCubeHistogram).toHaveBeenCalledTimes(1);
            expect(appStore.requestCubeHistogram).toHaveBeenCalledWith(frame.frameInfo.fileId);
            expect(calls.indexOf("requestCubeHistogram")).toBeLessThan(calls.indexOf("appendCatalog"));
            expect(calls.indexOf("cubeHistogramComplete")).toBeLessThan(calls.indexOf("applyLayout"));
            expect(appStore.setWorkspaceLoadingStep).toHaveBeenCalledWith({description: "cube histogram of image.fits", progress: 0.5});
            expect(appStore.setWorkspaceLoadingStep).toHaveBeenLastCalledWith(undefined);
            expect(frame.renderConfig.keepRangeWithoutCubeHistogram).not.toHaveBeenCalled();
        });

        test("asks for nothing when only its contours were taken from the cube histogram", async () => {
            const {appStore} = createSession();

            await restore(createWorkspace({files: [{...IMAGE, renderConfig: {useCubeHistogramContours: true}}]}));

            expect(appStore.requestCubeHistogram).not.toHaveBeenCalled();
        });

        test("keeps its saved range as a custom one when the backend stops reporting progress", async () => {
            jest.useFakeTimers();
            const {appStore} = createSession();

            const pending = restore(createWorkspace({files: [cubeImage]}));
            await jest.advanceTimersByTimeAsync(60_000);
            const issues = await pending;

            const frame = appStore.frames[0];
            expect(frame.renderConfig.keepRangeWithoutCubeHistogram).toHaveBeenCalledTimes(1);
            expect(appStore.cancelCubeHistogramRequest).toHaveBeenCalledWith(frame.frameInfo.fileId);
            expect(issues).toEqual(["Could not compute the cube histogram of image.fits; its percentile range is kept as a custom range"]);
        });
    });
});
