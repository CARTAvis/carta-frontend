import {afterEach, describe, expect, jest, test} from "@jest/globals";
import {CARTA} from "carta-protobuf";
import {observable, runInAction} from "mobx";
import {Subject} from "rxjs";

import {BeamType, CatalogSystemType, HipsCoord, HipsProjection, ImageType, RadiusUnits, RegionId, RegionOpacity, RestFrameShiftMode, SkyRefIs, SpectralSystem, VelocityConvention, WorkspaceItemKind} from "enums";
import {type Workspace, type WorkspaceCatalogQuerySource, type WorkspaceIssue} from "models";
import {BackendService, CatalogApiService} from "services";
import {AppStore, CatalogOnlineQueryConfigStore, WorkspaceIdRegistry, type WorkspaceLoadingStep, WorkspaceRestorer} from "stores";
import {fingerprintCatalogSelection} from "utilities";

/** The parts of the render config of an image that the restorer uses. The progress of the cube histogram is observable, as in the real store. */
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
        setStokesIndex: jest.fn(),
        awaitCompleteCubeHistogram: jest.fn(),
        keepRangeWithoutCubeHistogram: jest.fn(),
        /** Report the progress of the cube histogram, as the messages from the backend do. */
        reportCubeHistogramProgress: (progress: number) => runInAction(() => (state.cubeHistogramProgress = progress))
    };
}

/** The ID that the backend gives a restored region. It is a new ID, not related to the saved ID. */
const RegisterRegion = jest.fn((savedRegionId: number): Promise<number> => Promise.resolve(savedRegionId + 100));

/** The properties that a test sets on every image that the restorer opens, such as whether the image has a beam or supports a rest frame. */
let frameOverrides: Record<string, unknown> = {};

/** What the restorer needs of an image it has opened. */
function createFrame(fileId: number) {
    const frame = {
        frameInfo: {fileId},
        center: {x: 0, y: 0},
        isAxisZoomable: false,
        zoomLevel: 1,
        spatialReference: undefined,
        setCursorPosition: jest.fn(),
        updateCursorRegion: jest.fn(),
        setChannels: jest.fn((_channel: number, stokes: number) => {
            frame.requiredPolarizationIndex = stokes;
        }),
        requiredPolarizationIndex: 0,
        coordinateOptionsZ: [
            {value: "Iz", label: "I"},
            {value: "Qz", label: "Q"}
        ],
        renderConfig: createRenderConfig(),
        contourConfig: {applyConfig: jest.fn()},
        vectorOverlayConfig: {applyConfig: jest.fn()},
        applyContours: jest.fn(),
        applyVectorOverlay: jest.fn(),
        headerUnit: "Jy/beam",
        intensityConfig: {nativeIntensityUnit: "Jy/beam"},
        setSpectralCoordinate: jest.fn((coordinate: string, _shouldAlignSiblings?: boolean) => coordinate !== "Unsupported"),
        setSpectralCoordinateSecondary: jest.fn((coordinate: string, _shouldAlignSiblings?: boolean) => coordinate !== "Unsupported"),
        setSpectralSystem: jest.fn((system: string, _shouldAlignSiblings?: boolean) => system !== "Unsupported"),
        setIntensityUnit: jest.fn(),
        restFreqStore: {setCustomUnit: jest.fn(), setCustomVal: jest.fn()},
        isRestFrameSupported: true,
        setRestFrameShiftMode: jest.fn(),
        setRestFrameVelocityConvention: jest.fn(),
        setRestFrameRedshift: jest.fn(),
        setRestFrameEnabled: jest.fn(),
        beamProperties: {},
        overlayBeamSettings: {setVisible: jest.fn(), setColor: jest.fn(), setType: jest.fn(), setWidth: jest.fn(), setShiftX: jest.fn(), setShiftY: jest.fn()},
        isPVImage: false,
        isSwappedZ: false,
        isUVImage: false,
        isOffsetCoord: false,
        setOffsetCenter: jest.fn((x: number, y: number) => isFinite(x) && isFinite(y)),
        setSkyRefIs: jest.fn(),
        toggleOffsetCoord: jest.fn(),
        regionSet: {
            addExistingRegionAsync: jest.fn(async (_points: unknown, _rotation: number, _type: unknown, savedRegionId: number) => ({
                regionId: await RegisterRegion(savedRegionId),
                setLocked: jest.fn(),
                setLineRegionSampleWidth: jest.fn(),
                setOpacity: jest.fn(),
                setDashLength: jest.fn()
            })),
            selectSingleRegion: jest.fn(),
            setSelectionByIds: jest.fn()
        },
        ...frameOverrides
    };
    return frame;
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
        animatorStore: {stopAnimation: jest.fn(), minFrameRate: 1, maxFrameRate: 15, minStep: 1, maxStep: 50, setFrameRate: jest.fn(), setStep: jest.fn(), setPlayMode: jest.fn(), setAnimationMode: jest.fn()},
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
        requestCubeHistogram: jest.fn((_fileId?: number, _coordinate?: string) => {
            calls.push("requestCubeHistogram");
        }),
        cancelCubeHistogramRequest: jest.fn(),
        setWorkspaceLoadingStep: jest.fn(),
        frameMap: frames,
        setSpatialReference: jest.fn((frame: unknown) => {
            appStore.spatialReference = frame as never;
        }),
        setSpectralReference: jest.fn((frame: unknown) => {
            appStore.spectralReference = frame as never;
        }),
        setRasterScalingReference: jest.fn((frame: unknown) => {
            appStore.rasterScalingReference = frame as never;
        }),
        spectralMatchingType: "VRAD",
        setSpectralMatchingType: jest.fn((type: string) => {
            appStore.spectralMatchingType = type;
        }),
        setSpatialMatchingEnabled: jest.fn(),
        setSpectralMatchingEnabled: jest.fn(),
        setRasterScalingMatchingEnabled: jest.fn(),
        setTimeSeriesMember: jest.fn(),
        activeFrame: undefined as ReturnType<typeof createFrame> | undefined,
        activeImage: undefined as unknown,
        setContourDataSourceUnlocked: jest.fn(),
        setCursorFrozen: jest.fn(),
        dialogStore: {dialogVisible: new Map([["vector-dialog", true]]), showDialog: jest.fn(), hideDialog: jest.fn()},
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
            catalogPlotWidgets: new Map(),
            restorePlotWidgetBindings: jest.fn((_plotWidgets?: unknown, _ids?: unknown): unknown[] => []),
            restorePlotWidgets: jest.fn((_plotWidgets?: unknown, _ids?: unknown): unknown[] => []),
            restorePlotWidgetViews: jest.fn((_plotWidgets?: unknown): void => undefined)
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

/** Runs the restore to the end, and returns the restorer so that the test can check the ID maps. */
async function restored(workspace: Workspace): Promise<WorkspaceRestorer> {
    const restorer = new WorkspaceRestorer(workspace, WorkspaceRestorer.claimGeneration());
    const generator = restorer.restore();
    let step = generator.next();
    while (!step.done) {
        step = generator.next(await step.value);
    }
    return restorer;
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
        frameOverrides = {};
    });

    test("restores nothing but reports no problems for an empty workspace", async () => {
        const {appStore} = createSession();

        expect(await restore(createWorkspace({files: []}))).toEqual([]);
        expect(appStore.removeAllFrames).toHaveBeenCalled();
    });

    test("applies the animator settings, and the channels that it plays of an image, keeping the defaults of values that are not valid", async () => {
        const {appStore} = createSession();
        appStore.appendFile.mockImplementationOnce(() => {
            const frame = {...createFrame(1), frameInfo: {fileId: 1, fileInfoExtended: {depth: 10}}, setAnimationRange: jest.fn()};
            appStore.frameMap.set(1, frame as never);
            appStore.frames.push(frame as never);
            return Promise.resolve(frame as never);
        });

        await restore(createWorkspace({files: [{...IMAGE, animationChannelRange: [2, 5]}], animator: {frameRate: 8, step: 99, playMode: 2, mode: 1} as never}));

        expect((appStore.frames[0] as any).setAnimationRange).toHaveBeenCalledWith([2, 5]);
        expect(appStore.animatorStore.setFrameRate).toHaveBeenCalledWith(8);
        expect(appStore.animatorStore.setStep).not.toHaveBeenCalled();
        expect(appStore.animatorStore.setPlayMode).toHaveBeenCalledWith(2);
        expect(appStore.animatorStore.setAnimationMode).toHaveBeenCalledWith(1);
    });

    test("opens the saved analysis dialogs in their order, and closes the other analysis dialogs, but not another dialog", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({openDialogs: ["region-dialog", "contour-dialog", "preference-dialog"]}));

        expect(appStore.dialogStore.hideDialog.mock.calls).toEqual([["vector-dialog"]]);
        expect(appStore.dialogStore.showDialog.mock.calls).toEqual([["region-dialog"], ["contour-dialog"]]);
    });

    test("leaves the dialogs as they are for a workspace saved without them", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({}));

        expect(appStore.dialogStore.hideDialog).not.toHaveBeenCalled();
        expect(appStore.dialogStore.showDialog).not.toHaveBeenCalled();
    });

    test("opens the saved settings panels where they were, closes the other floating settings panels, and reports a panel whose widget was not restored", async () => {
        const {appStore} = createSession();
        const config = {type: "floating-settings", id: "new", parentId: "spectral-profiler-1", setDefaultPosition: jest.fn(), setDefaultSize: jest.fn()};
        const widgetsStore = appStore.widgetsStore as any;
        widgetsStore.floatingWidgets = [{type: "floating-settings", id: "old", parentId: "histogram-0"}];
        widgetsStore.removeFloatingWidget = jest.fn((id: string) => (widgetsStore.floatingWidgets = widgetsStore.floatingWidgets.filter((w: {id: string}) => w.id !== id)));
        widgetsStore.layoutIdOf = jest.fn((_type: string, id: string) => (id === "spectral-profiler-3" ? "spectral-profiler-1" : undefined));
        widgetsStore.createFloatingSettingsWidget = jest.fn(() => widgetsStore.floatingWidgets.push(config));

        const problems = await restore(
            createWorkspace({
                openWidgetSettings: [
                    {widgetId: "spectral-profiler-3", widgetType: "spectral-profiler", title: "Z Profile", x: 0, y: 30, width: 650, height: 400},
                    {widgetId: "stokes-0", widgetType: "stokes", title: "Stokes Analysis"}
                ]
            })
        );

        expect(widgetsStore.removeFloatingWidget).toHaveBeenCalledWith("old");
        expect(widgetsStore.createFloatingSettingsWidget.mock.calls).toEqual([["Z Profile", "spectral-profiler-1", "spectral-profiler"]]);
        expect(config.setDefaultPosition).toHaveBeenCalledWith(0, 30);
        expect(config.setDefaultSize).toHaveBeenCalledWith(650, 400);
        expect(problems).toEqual(["The settings panel of this widget was not opened, because the widget was not restored"]);
    });

    test("applies the saved fields of the online catalog query dialog", async () => {
        createSession();
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const onlineCatalogQuery = {...configStore.toWorkspaceConfig(), objectName: "M17", vizierKeywords: "gaia"};

        await restore(createWorkspace({onlineCatalogQuery}));

        expect([configStore.objectName, configStore.vizierKeyWords]).toEqual(["M17", "gaia"]);
        runInAction(() => {
            configStore.resetObjectName();
            configStore.setVizierKeyWords("");
        });
    });

    test("shows the saved image in the Contour dialog when the dialog did not follow the active image", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({files: [IMAGE, {id: 2, source: {type: "file", filename: "other.fits"}}], contourDataSource: {imageId: 2}}));

        expect(appStore.setContourDataSourceUnlocked).toHaveBeenCalledWith(appStore.frames[1]);
    });

    test("leaves the Contour dialog following the active image when the image it showed was not restored, and says so", async () => {
        const {appStore} = createSession();

        const problems = await restore(createWorkspace({contourDataSource: {imageId: 9}}));

        expect(appStore.setContourDataSourceUnlocked).not.toHaveBeenCalled();
        expect(problems).toEqual(["The Contour dialog follows the active image, because the image that it showed was not restored"]);
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

    test("hides the layers of a color-blended image that were hidden", async () => {
        const {appStore} = createSession();
        const colorBlending = {
            id: 0,
            selectedFrames: [],
            deleteSelectedFrame: jest.fn(),
            setAlpha: jest.fn(),
            addSelectedFrame: jest.fn(),
            isRasterVisible: true,
            isContourVisible: true,
            isVectorOverlayVisible: true,
            toggleRasterVisible: jest.fn(),
            toggleContourVisible: jest.fn(),
            toggleVectorOverlayVisible: jest.fn()
        };
        appStore.imageViewConfigStore.createColorBlending.mockImplementation(() => colorBlending);

        await restore(createWorkspace({colorBlendingImages: [{imageListIndex: 1, selectedFrameId: [1], alpha: [1, 1], contourVisible: false}]}));

        expect([colorBlending.toggleRasterVisible, colorBlending.toggleContourVisible, colorBlending.toggleVectorOverlayVisible].map(toggle => toggle.mock.calls.length)).toEqual([0, 1, 0]);
    });

    test("selects again the regions that were selected together, and freezes the cursor where it was frozen", async () => {
        const {appStore} = createSession();
        const region = (id: number) => ({id, points: [{x: 0, y: 0}], rotation: 0, type: 3});

        await restore(createWorkspace({files: [{...IMAGE, regionsSet: {selectedRegion: 2, selectedRegions: [1, 2, 9], regions: [region(1), region(2)]}}], cursor: {frozen: true, position: {x: 3, y: 4}}}));

        const frame = appStore.frames[0] as any;
        expect(frame.regionSet.setSelectionByIds).toHaveBeenCalledWith([101, 102], 102);
        expect(appStore.setCursorFrozen).toHaveBeenCalledWith(true);
        expect((appStore.activeFrame as any).updateCursorRegion).toHaveBeenCalledWith({x: 3, y: 4});
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

    test("points the profile and analysis widgets at their images and regions, and gives them the rest once they have settled", async () => {
        const {appStore, calls} = createSession();
        const plotWidgets = {"stats-0": {type: "stats" as const, imageId: 1}};
        let didSettleBeforeTheRest = false;
        appStore.widgetsStore.restorePlotWidgetBindings.mockImplementationOnce(() => {
            calls.push("restorePlotWidgetBindings");
            Promise.resolve().then(() => (didSettleBeforeTheRest = !calls.includes("restorePlotWidgets")));
            return [];
        });
        appStore.widgetsStore.restorePlotWidgets.mockImplementationOnce(() => {
            calls.push("restorePlotWidgets");
            return [];
        });
        appStore.widgetsStore.restorePlotWidgetViews.mockImplementationOnce(() => {
            calls.push("restorePlotWidgetViews");
        });

        const restorer = new WorkspaceRestorer(createWorkspace({layout: LAYOUT, plotWidgets}), WorkspaceRestorer.claimGeneration());
        const generator = restorer.restore();
        let step = generator.next();
        while (!step.done) {
            step = generator.next(await step.value);
        }

        expect(calls.filter(call => call.startsWith("applyLayout") || call.startsWith("restorePlot"))).toEqual(["applyLayout", "restorePlotWidgetBindings", "restorePlotWidgets", "restorePlotWidgetViews"]);
        expect(didSettleBeforeTheRest).toBe(true);
        expect(appStore.widgetsStore.restorePlotWidgets).toHaveBeenCalledWith(plotWidgets, restorer);
        expect(restorer.fileIdOf(1)).toBe(appStore.frames[0].frameInfo.fileId);
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

    test("shows an image in the spectral coordinates, spectral system and intensity unit it was saved in, without aligning other images", async () => {
        const {appStore} = createSession();

        const problems = await restore(createWorkspace({files: [{...IMAGE, spectralCoordinate: "Radio velocity (km/s)", spectralCoordinateSecondary: "Channel", spectralSystem: SpectralSystem.LSRK, intensityUnit: "Jy/beam"}]}));

        const frame = appStore.frames[0];
        expect(problems).toEqual([]);
        expect(frame.setSpectralCoordinate).toHaveBeenCalledWith("Radio velocity (km/s)", false);
        expect(frame.setSpectralCoordinateSecondary).toHaveBeenCalledWith("Channel", false);
        expect(frame.setSpectralSystem).toHaveBeenCalledWith("LSRK", false);
        expect(frame.setIntensityUnit).toHaveBeenCalledWith("Jy/beam");
    });

    test("reports the spectral settings an image can no longer be shown in", async () => {
        const {appStore} = createSession();

        const problems = await restore(createWorkspace({files: [{...IMAGE, spectralCoordinate: "Unsupported", spectralSystem: "Unsupported" as SpectralSystem, intensityUnit: "K"}]}));

        expect(problems).toEqual(["Could not show image.fits in the spectral coordinate Unsupported, the spectral system Unsupported, the intensity unit K"]);
        expect(appStore.frames[0].setIntensityUnit).not.toHaveBeenCalled();
    });

    describe("the rest frequency, rest frame, beam and offset coordinates of an image", () => {
        const savedSettings = {
            restFrequency: {value: 230.5, unit: "GHz"},
            restFrame: {enabled: true, redshift: 0.01, shiftMode: RestFrameShiftMode.REDSHIFT, velocityConvention: VelocityConvention.OPTICAL},
            beam: {visible: false, color: "#00ff00", type: BeamType.Solid, width: 2, shiftX: 3, shiftY: -4},
            offsetCoordinates: {center: {x: 5, y: 6}, skyRefIs: SkyRefIs.Pole}
        };

        test("shows the image with the ones it was saved with", async () => {
            const {appStore} = createSession();

            const problems = await restore(createWorkspace({files: [{...IMAGE, ...savedSettings}]}));

            const frame = appStore.frames[0];
            expect(problems).toEqual([]);
            expect(frame.restFreqStore.setCustomUnit).toHaveBeenCalledWith("GHz");
            expect(frame.restFreqStore.setCustomVal).toHaveBeenCalledWith(230.5);
            expect(frame.setRestFrameShiftMode).toHaveBeenCalledWith("redshift");
            expect(frame.setRestFrameVelocityConvention).toHaveBeenCalledWith("optical");
            expect(frame.setRestFrameRedshift).toHaveBeenCalledWith(0.01);
            expect(frame.setRestFrameEnabled).toHaveBeenCalledWith(true);
            const beam = frame.overlayBeamSettings;
            expect([beam.setVisible, beam.setColor, beam.setType, beam.setWidth, beam.setShiftX, beam.setShiftY].map(setter => setter.mock.calls)).toEqual([[[false]], [["#00ff00"]], [["solid"]], [[2]], [[3]], [[-4]]]);
            expect(frame.setOffsetCenter).toHaveBeenCalledWith(5, 6);
            expect(frame.setSkyRefIs).toHaveBeenCalledWith(1);
            expect(frame.toggleOffsetCoord).toHaveBeenCalledTimes(1);
        });

        test("reports a rest frame, beam or offset coordinates the image no longer has or supports", async () => {
            frameOverrides = {isRestFrameSupported: false, isPVImage: true, beamProperties: undefined};
            const {appStore} = createSession();

            const problems = await restore(createWorkspace({files: [{...IMAGE, ...savedSettings}]}));

            const frame = appStore.frames[0];
            expect(problems).toEqual(["Could not show image.fits with its rest frame or its beam", "Could not show image.fits with offset coordinates"]);
            expect(frame.setRestFrameEnabled).not.toHaveBeenCalled();
            expect(frame.toggleOffsetCoord).not.toHaveBeenCalled();
            expect(frame.overlayBeamSettings.setVisible).not.toHaveBeenCalled();
        });

        test("sets the rest frequency in a step of its own, before the images are matched with it", async () => {
            const {appStore} = createSession();
            const matched = {id: 2, source: {type: "file" as const, filename: "matched.fits"}, restFrequency: {value: 230.5, unit: "GHz"}, references: {spectral: 1}};
            const generator = new WorkspaceRestorer(createWorkspace({files: [IMAGE, matched], references: {spectral: 1}}), WorkspaceRestorer.claimGeneration()).restore();

            let didMatchBeforeRestFrequency: boolean | undefined;
            let step = generator.next();
            while (!step.done) {
                const restFreqStore = appStore.frames[1]?.restFreqStore;
                if (didMatchBeforeRestFrequency === undefined && restFreqStore?.setCustomVal.mock.calls.length) {
                    didMatchBeforeRestFrequency = appStore.setSpectralMatchingEnabled.mock.calls.length > 0;
                }
                step = generator.next(await step.value);
            }

            expect(didMatchBeforeRestFrequency).toBe(false);
            expect(appStore.setSpectralMatchingEnabled).toHaveBeenCalled();
        });

        test("puts the offset coordinates back once every image is matched, since matching one moves them", async () => {
            const {appStore} = createSession();
            const matched = {id: 2, source: {type: "file" as const, filename: "matched.fits"}, references: {spatial: 1}};

            await restore(createWorkspace({files: [{...IMAGE, offsetCoordinates: savedSettings.offsetCoordinates, references: {spatial: 1}}, matched], references: {spatial: 1}}));

            const setOffsetCenter = appStore.frames[0].setOffsetCenter;
            expect(setOffsetCenter).toHaveBeenCalledWith(5, 6);
            expect(setOffsetCenter.mock.invocationCallOrder[0]).toBeGreaterThan(Math.max(...appStore.setSpatialMatchingEnabled.mock.invocationCallOrder));
        });

        test("reports a rest frequency it cannot convert with, and keeps the header's", async () => {
            const {appStore} = createSession();

            const problems = await restore(createWorkspace({files: [{...IMAGE, restFrequency: {value: 230.5, unit: "parsec"}}]}));

            expect(problems).toEqual(["Could not convert image.fits with the rest frequency 230.5 parsec"]);
            expect(appStore.frames[0].restFreqStore.setCustomVal).not.toHaveBeenCalled();
        });

        test("ignores the settings of a beam no control would set", async () => {
            const {appStore} = createSession();

            await restore(createWorkspace({files: [{...IMAGE, beam: {visible: "yes", color: "", type: "dotted", width: 0, shiftX: "1", shiftY: null} as any}]}));

            const beam = appStore.frames[0].overlayBeamSettings;
            expect([beam.setVisible, beam.setColor, beam.setType, beam.setWidth, beam.setShiftX, beam.setShiftY].every(setter => setter.mock.calls.length === 0)).toBe(true);
        });
    });

    test("sets the spectral matching type before it opens the images, so that matching takes the saved channel", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({spectralMatchingType: "FREQ" as never}));

        expect(appStore.setSpectralMatchingType).toHaveBeenCalledWith("FREQ");
        expect(appStore.setSpectralMatchingType.mock.invocationCallOrder[0]).toBeLessThan(appStore.appendFile.mock.invocationCallOrder[0]);
    });

    test("keeps the spectral matching type of the session when the saved one is not valid, and says so", async () => {
        const {appStore} = createSession();

        const problems = await restore(createWorkspace({spectralMatchingType: "SPEED" as never}));

        expect(appStore.setSpectralMatchingType).not.toHaveBeenCalled();
        expect(problems).toEqual(["Could not restore the spectral matching type SPEED: it is not one this version knows, so images are matched by VRAD"]);
    });

    describe("the regions of an image", () => {
        const region = (id: number) => ({id, points: [{x: 0, y: 0}], rotation: 0, type: 3});

        test("maps each region's saved ID to the one the backend gave it", async () => {
            createSession();

            const restorer = await restored(createWorkspace({files: [{...IMAGE, regionsSet: {regions: [region(1), region(2)]}}]}));

            expect(restorer.regionIdOf(1, 1)).toBe(101);
            expect(restorer.regionIdOf(1, 2)).toBe(102);
        });

        test("waits for the backend to give the regions their IDs before restoring the layout", async () => {
            const {calls} = createSession();
            RegisterRegion.mockImplementationOnce(
                savedRegionId =>
                    new Promise(resolve =>
                        setTimeout(() => {
                            calls.push("regionRegistered");
                            resolve(savedRegionId + 100);
                        }, 0)
                    )
            );

            await restore(createWorkspace({files: [{...IMAGE, regionsSet: {regions: [region(1)]}}], layout: LAYOUT}));

            expect(calls.indexOf("regionRegistered")).toBeGreaterThanOrEqual(0);
            expect(calls.indexOf("applyLayout")).toBeGreaterThan(calls.indexOf("regionRegistered"));
        });

        test("keeps the cursor, the whole image and the other fixed region IDs as they are", async () => {
            createSession();

            const restorer = await restored(createWorkspace());

            expect([RegionId.CURSOR, RegionId.IMAGE, RegionId.ACTIVE].map(regionId => restorer.regionIdOf(1, regionId))).toEqual([RegionId.CURSOR, RegionId.IMAGE, RegionId.ACTIVE]);
        });

        test("gives no ID for a region that was not restored", async () => {
            createSession();

            const restorer = await restored(createWorkspace({files: [{...IMAGE, regionsSet: {regions: [region(1)]}}]}));

            expect(restorer.regionIdOf(1, 2)).toBeUndefined();
            expect(restorer.regionIdOf(7, 1)).toBeUndefined();
        });

        test("puts back the sample width of a line region, and ignores one no control allows", async () => {
            const {appStore} = createSession();

            await restore(
                createWorkspace({
                    files: [
                        {
                            ...IMAGE,
                            regionsSet: {
                                regions: [
                                    {...region(1), lineRegionSampleWidth: 7},
                                    {...region(2), lineRegionSampleWidth: 50}
                                ]
                            }
                        }
                    ]
                })
            );

            const restoredRegions = (await Promise.all(appStore.frames[0].regionSet.addExistingRegionAsync.mock.results.map(result => result.value))) as {setLineRegionSampleWidth: jest.Mock}[];
            expect(restoredRegions.map(restoredRegion => restoredRegion.setLineRegionSampleWidth.mock.calls)).toEqual([[[7]], []]);
        });

        test("hides or dims a region as it was saved, and leaves one no control would set as shown", async () => {
            const {appStore} = createSession();

            await restore(
                createWorkspace({
                    files: [{...IMAGE, regionsSet: {regions: [{...region(1), opacity: RegionOpacity.Invisible}, {...region(2), opacity: RegionOpacity.SemiTransparent}, {...region(3), opacity: 0.3 as RegionOpacity}, region(4)]}}]
                })
            );

            const restoredRegions = (await Promise.all(appStore.frames[0].regionSet.addExistingRegionAsync.mock.results.map(result => result.value))) as {setOpacity: jest.Mock}[];
            expect(restoredRegions.map(restoredRegion => restoredRegion.setOpacity.mock.calls)).toEqual([[[0]], [[0.5]], [], []]);
        });

        test("makes a region saved with no dashes solid, whatever dash length the preferences give", async () => {
            const {appStore} = createSession();

            await restore(createWorkspace({files: [{...IMAGE, regionsSet: {regions: [{...region(1), dashes: []}, {...region(2), dashes: [4]}, region(3)]}}]}));

            const restoredRegions = (await Promise.all(appStore.frames[0].regionSet.addExistingRegionAsync.mock.results.map(result => result.value))) as {setDashLength: jest.Mock}[];
            expect(restoredRegions.map(restoredRegion => restoredRegion.setDashLength.mock.calls)).toEqual([[[0]], [], []]);
        });

        test("finds a matched image's region among the regions of the image it was matched to", async () => {
            createSession();
            const matched = {id: 2, source: {type: "file" as const, filename: "matched.fits"}, references: {spatial: 1}};

            const restorer = await restored(createWorkspace({files: [{...IMAGE, regionsSet: {regions: [region(1)]}}, matched]}));

            expect(restorer.regionIdOf(2, 1)).toBe(101);
        });
    });

    describe("an image whose percentile range was taken from the cube histogram", () => {
        const cubeImage = {...IMAGE, renderConfig: {useCubeHistogram: true, selectedPercentile: [99.5], scaleMin: [1], scaleMax: [2]}};

        afterEach(() => {
            jest.useRealTimers();
        });

        test("computes its cube histogram again while the catalogs open, and waits for it before the layout", async () => {
            const {appStore, calls} = createSession();
            appStore.requestCubeHistogram.mockImplementation((fileId?: number, _coordinate?: string) => {
                calls.push("requestCubeHistogram");
                const renderConfig = appStore.getFrame(fileId as number)!.renderConfig;
                // Complete the histogram only after the catalogs start to open.
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
            expect(appStore.requestCubeHistogram).toHaveBeenCalledWith(frame.frameInfo.fileId, "Iz");
            expect(calls.indexOf("requestCubeHistogram")).toBeLessThan(calls.indexOf("appendCatalog"));
            expect(calls.indexOf("cubeHistogramComplete")).toBeLessThan(calls.indexOf("applyLayout"));
            expect(appStore.setWorkspaceLoadingStep).toHaveBeenCalledWith({description: "cube histogram of image.fits", progress: 0.5, onSkip: expect.any(Function)});
            expect(appStore.setWorkspaceLoadingStep).toHaveBeenLastCalledWith(undefined);
            expect(frame.renderConfig.keepRangeWithoutCubeHistogram).not.toHaveBeenCalled();
        });

        test("asks for the cube histogram of the Stokes it is restored in, and files the result under it", async () => {
            const {appStore} = createSession();
            appStore.requestCubeHistogram.mockImplementation((fileId?: number, _coordinate?: string) => {
                setTimeout(() => appStore.getFrame(fileId as number)!.renderConfig.reportCubeHistogramProgress(1), 0);
            });

            await restore(createWorkspace({files: [{...cubeImage, stokes: 1}]}));

            const frame = appStore.frames[0];
            expect(appStore.requestCubeHistogram).toHaveBeenCalledWith(frame.frameInfo.fileId, "Qz");
            expect(frame.renderConfig.setStokesIndex).toHaveBeenCalledWith(1);
        });

        test("asks for nothing when only its contours were taken from the cube histogram", async () => {
            const {appStore} = createSession();

            await restore(createWorkspace({files: [{...IMAGE, renderConfig: {useCubeHistogramContours: true}}]}));

            expect(appStore.requestCubeHistogram).not.toHaveBeenCalled();
        });

        test("leaves no image waiting on its cube histogram once a later load has taken over without clearing the session", async () => {
            jest.useFakeTimers();
            const {appStore} = createSession();

            const pending = restoreIssues(createWorkspace({files: [cubeImage, {...cubeImage, id: 2, stokes: 1}]}));
            await jest.advanceTimersByTimeAsync(0);
            // A later load takes over the session and then fails to fetch its workspace, so these images stay open.
            WorkspaceRestorer.claimGeneration();
            const issues = await pending;

            const [first, second] = appStore.frames;
            expect(appStore.requestCubeHistogram).toHaveBeenCalledTimes(1);
            expect(first.renderConfig.keepRangeWithoutCubeHistogram).toHaveBeenCalledWith(0);
            expect(appStore.cancelCubeHistogramRequest).toHaveBeenCalledWith(first.frameInfo.fileId);
            // This image was never requested and was restored in Q, so the kept range is the range of Q.
            expect(second.renderConfig.keepRangeWithoutCubeHistogram).toHaveBeenCalledWith(1);
            expect(issues).toEqual([]);
        });

        test("keeps its saved range as a custom one when the user skips it, and goes on with the next image", async () => {
            const {appStore} = createSession();
            appStore.requestCubeHistogram.mockImplementation((fileId?: number, _coordinate?: string) => {
                const renderConfig = appStore.getFrame(fileId as number)!.renderConfig;
                setTimeout(() => renderConfig.reportCubeHistogramProgress(0.2), 0);
            });
            appStore.setWorkspaceLoadingStep.mockImplementation((step?: WorkspaceLoadingStep) => {
                // Skip the first image's cube histogram as soon as its progress is shown.
                if (step?.description === "cube histogram of image.fits" && step.progress > 0) {
                    step.onSkip?.();
                }
            });

            const pending = restore(createWorkspace({files: [cubeImage, {...cubeImage, id: 2, source: {...cubeImage.source, filename: "second.fits"}}]}));
            await new Promise(resolve => setTimeout(resolve, 0));
            await new Promise(resolve => setTimeout(resolve, 0));
            const [first, second] = appStore.frames;
            second.renderConfig.reportCubeHistogramProgress(1);
            const issues = await pending;

            expect(appStore.requestCubeHistogram).toHaveBeenCalledTimes(2);
            expect(first.renderConfig.keepRangeWithoutCubeHistogram).toHaveBeenCalledTimes(1);
            expect(appStore.cancelCubeHistogramRequest).toHaveBeenCalledWith(first.frameInfo.fileId);
            expect(second.renderConfig.keepRangeWithoutCubeHistogram).not.toHaveBeenCalled();
            expect(issues).toEqual(["Skipped computing the cube histogram of image.fits; its percentile range is kept as a custom range; select Per-cube to compute it again"]);
            expect(appStore.setWorkspaceLoadingStep).toHaveBeenLastCalledWith(undefined);
        });
    });

    describe("generated images", () => {
        const savedRegion = {id: 5, type: 3, rotation: 0, points: []};
        const momentRequest = {
            type: "moment" as const,
            sourceImageId: 1,
            regionId: 5,
            moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM, CARTA.Moment.MAX_OF_THE_SPECTRUM],
            channelRange: {min: 2, max: 8},
            mask: CARTA.MomentMask.Include,
            pixelRange: {min: 0.1, max: 1}
        };

        /** A session that makes generated images as the backend does: moment images come back in the order of the request. */
        function createGeneratingSession(momentsMade?: Promise<unknown>, shouldAnswerStats = true) {
            frameOverrides = {resetMomentRequestState: jest.fn(), resetPvRequestState: jest.fn(), requestingMomentsProgress: 0.5, requestingPVProgress: 0};
            const session = createSession();
            const {appStore} = session;
            let nextFileId = 100;
            const addFrame = (generation: unknown) => {
                const frame = {...createFrame(++nextFileId), generation};
                (appStore.frameMap as Map<number, unknown>).set(frame.frameInfo.fileId, frame);
                appStore.frames.push(frame as never);
                return frame;
            };
            const generating = {
                requestMoment: jest.fn((message: CARTA.MomentRequest.$Properties, _frame?: unknown, _isStillWanted?: () => boolean) => momentsMade ?? Promise.resolve((message.moments ?? []).map(moment => addFrame({moment})))),
                cancelRequestingMoment: jest.fn(),
                requestPV: jest.fn((_message: CARTA.PvRequest.$Properties, _frame: unknown, _shouldKeep: boolean) => Promise.resolve(addFrame({}))),
                cancelRequestingPV: jest.fn(),
                loadRemoteFile: jest.fn((_query: CARTA.RemoteFileRequest.$Properties) => Promise.resolve(addFrame({}))),
                requestFitting: jest.fn((message: CARTA.FittingRequest.$Properties, _isStillWanted?: () => boolean) =>
                    Promise.resolve([...(message.createModelImage ? [addFrame({fittingImage: "model"})] : []), ...(message.createResidualImage ? [addFrame({fittingImage: "residual"})] : [])])
                ),
                imageFittingStore: {setIsFitting: jest.fn(), setIsCancelling: jest.fn(), progress: 0.3},
                backendService: {cancelRequestingFitting: jest.fn()}
            };
            Object.assign(appStore, generating);
            // The backend answers a statistics request for a region with that region's statistics.
            const statsStream = new Subject<{fileId: number; regionId: number}>();
            const backend = {
                statsStream,
                setStatsRequirements: jest.fn((message: {fileId: number; regionId: number; statsConfigs: unknown[]}) => {
                    if (message.statsConfigs.length && shouldAnswerStats) {
                        setTimeout(() => statsStream.next({fileId: message.fileId, regionId: message.regionId}));
                    }
                    return true;
                })
            };
            jest.spyOn(BackendService, "Instance", "get").mockReturnValue(backend as never);
            return {...session, ...generating, backend};
        }

        test("makes moment images again once the regions are back, over the ID the backend gave the region", async () => {
            const {appStore, requestMoment, backend} = createGeneratingSession();
            const workspace = createWorkspace({
                files: [{...IMAGE, regionsSet: {regions: [savedRegion]}}],
                generatedImages: [
                    {
                        request: momentRequest,
                        images: [
                            {id: 2, name: "image.fits.moment.maximum", moment: CARTA.Moment.MAX_OF_THE_SPECTRUM, renderConfig: {colorMap: "viridis"} as never},
                            {id: 3, name: "image.fits.moment.integrated", moment: CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM}
                        ]
                    }
                ]
            });

            const restorer = await restored(workspace);

            expect(requestMoment).toHaveBeenCalledWith(expect.objectContaining({fileId: 1, regionId: 105, moments: momentRequest.moments, spectralRange: {min: 2, max: 8}, keep: false}), appStore.frames[0], expect.any(Function));
            // The backend is asked for a statistic of the region, and answers it, before the
            // moments are asked for.
            expect(backend.setStatsRequirements.mock.calls.map(([message]) => message)).toEqual([
                {fileId: 1, regionId: 105, statsConfigs: [{coordinate: "z", statsTypes: [CARTA.StatsType.NumPixels]}]},
                {fileId: 1, regionId: 105, statsConfigs: []}
            ]);
            expect(backend.setStatsRequirements.mock.invocationCallOrder[1]).toBeLessThan(requestMoment.mock.invocationCallOrder[0]);
            // Each image gets the moment that it was saved with, whatever order the backend sent
            // the images in.
            const maximum = appStore.frames.find(frame => frame.frameInfo.fileId === restorer.fileIdOf(2)) as any;
            expect(maximum.generation.moment).toBe(CARTA.Moment.MAX_OF_THE_SPECTRUM);
            expect(maximum.renderConfig.applyConfig).toHaveBeenCalledWith({colorMap: "viridis"});
            expect((appStore.frames.find(frame => frame.frameInfo.fileId === restorer.fileIdOf(3)) as any).generation.moment).toBe(CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM);
        });

        describe("an image fitting", () => {
            const fittingRequest = {
                type: "fitting" as const,
                sourceImageId: 1,
                regionId: 5,
                components: [{center: {x: 12, y: null}, amp: 1.5, fwhm: {x: 3, y: 2}, pa: null}],
                fixedParams: [false, false, true, false, false, false, true],
                offset: 0.1,
                solver: CARTA.FittingSolverType.Qr
            };

            test("is made again over the ID the backend gave the region, with only the images that the workspace saves", async () => {
                const {appStore, requestFitting} = createGeneratingSession();
                const workspace = createWorkspace({
                    files: [{...IMAGE, regionsSet: {regions: [savedRegion]}}],
                    generatedImages: [{request: fittingRequest, images: [{id: 2, name: "image_residual.fits", fittingImage: "residual", renderConfig: {colorMap: "viridis"} as never}]}]
                });

                const restorer = await restored(workspace);

                expect(requestFitting).toHaveBeenCalledWith(
                    {
                        fileId: 1,
                        initialValues: [{center: {x: 12, y: NaN}, amp: 1.5, fwhm: {x: 3, y: 2}, pa: NaN}],
                        fixedParams: fittingRequest.fixedParams,
                        regionId: 105,
                        fovInfo: null,
                        createModelImage: false,
                        createResidualImage: true,
                        offset: 0.1,
                        solver: CARTA.FittingSolverType.Qr
                    },
                    expect.any(Function)
                );
                const residual = appStore.frames.find(frame => frame.frameInfo.fileId === restorer.fileIdOf(2)) as any;
                expect(residual.generation.fittingImage).toBe("residual");
                expect(residual.renderConfig.applyConfig).toHaveBeenCalledWith({colorMap: "viridis"});
            });

            test("fits the saved field of view again", async () => {
                const {requestFitting} = createGeneratingSession();
                const fov = {center: {x: 10, y: 20}, size: {x: 40, y: 30}, rotation: 30};

                await restore(createWorkspace({generatedImages: [{request: {...fittingRequest, regionId: 0, fov}, images: [{id: 2, fittingImage: "model"}]}]}));

                expect(requestFitting.mock.calls[0][0]).toMatchObject({
                    regionId: 0,
                    fovInfo: {regionType: CARTA.RegionType.RECTANGLE, rotation: 30, controlPoints: [fov.center, fov.size]},
                    createModelImage: true,
                    createResidualImage: false
                });
            });

            test("is reported, and not made, when it is not one this version can make", async () => {
                const {requestFitting} = createGeneratingSession();

                const problems = await restore(createWorkspace({generatedImages: [{request: {...fittingRequest, regionId: RegionId.IMAGE, fixedParams: [false]}, images: [{id: 2, fittingImage: "model"}]}]}));

                expect(requestFitting).not.toHaveBeenCalled();
                expect(problems).toEqual(["Could not make the image fitting images of image.fits: the request is not one this version can make"]);
            });
        });

        test("keeps the images of an earlier request of the same image when it makes a later one", async () => {
            const {requestMoment} = createGeneratingSession();
            const wholeImage = {...momentRequest, regionId: RegionId.IMAGE};

            await restore(
                createWorkspace({
                    generatedImages: [
                        {request: {...wholeImage, moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM]}, images: [{id: 2, moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}]},
                        {request: {...wholeImage, moments: [CARTA.Moment.MIN_OF_THE_SPECTRUM]}, images: [{id: 3, moment: CARTA.Moment.MIN_OF_THE_SPECTRUM}]}
                    ]
                })
            );

            expect(requestMoment.mock.calls.map(([message]) => message.keep)).toEqual([false, true]);
        });

        test("reports a request the user skips, and what is made of its images", async () => {
            const {appStore, cancelRequestingMoment, requestMoment, requestPV} = createGeneratingSession(new Promise(() => {}));
            appStore.setWorkspaceLoadingStep.mockImplementation((step: any) => {
                if (step?.onSkip && step.description.startsWith("making")) {
                    setTimeout(step.onSkip);
                }
            });
            const workspace = createWorkspace({
                files: [{...IMAGE, regionsSet: {regions: [savedRegion]}}],
                generatedImages: [
                    {request: momentRequest, images: [{id: 2, name: "image.fits.moment.maximum", moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}]},
                    {request: {type: "pv", sourceImageId: 2, regionId: RegionId.IMAGE, width: 3, reverse: false}, images: [{id: 3, name: "pv.fits"}]}
                ]
            });

            const problems = await restore(workspace);

            expect(cancelRequestingMoment).toHaveBeenCalledWith(1);
            // The images that the backend still makes for the skipped request are not wanted.
            const isStillWanted = requestMoment.mock.calls[0][2] as () => boolean;
            expect(isStillWanted()).toBe(false);
            expect(requestPV).not.toHaveBeenCalled();
            expect(problems).toEqual(["Skipped making the moment images of image.fits", "Could not make the PV image of image.fits.moment.maximum: the image it is made from was not restored"]);
            expect(appStore.setWorkspaceLoadingStep).toHaveBeenCalledWith(expect.objectContaining({description: "making the moment images of image.fits", progress: 0.5}));
        });

        test("waits for the backend to take on the region with no time limit, until the user skips it", async () => {
            jest.useFakeTimers();
            const {appStore, requestMoment, backend} = createGeneratingSession(undefined, false);
            let skipPreparing: (() => void) | undefined;
            appStore.setWorkspaceLoadingStep.mockImplementation((step: any) => {
                if (step?.description.startsWith("preparing")) {
                    skipPreparing = step.onSkip;
                }
            });
            const workspace = createWorkspace({
                files: [{...IMAGE, regionsSet: {regions: [savedRegion]}}],
                generatedImages: [{request: momentRequest, images: [{id: 2, name: "image.fits.moment.maximum", moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}]}]
            });

            const restoring = restore(workspace);
            // Much longer than any fixed limit: the restore still waits for the backend.
            await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
            expect(skipPreparing).toBeDefined();
            expect(requestMoment).not.toHaveBeenCalled();

            skipPreparing?.();
            await jest.advanceTimersByTimeAsync(0);
            const problems = await restoring;
            jest.useRealTimers();

            expect(requestMoment).not.toHaveBeenCalled();
            expect(backend.setStatsRequirements.mock.calls.map(([message]) => message.statsConfigs.length)).toEqual([1, 0]);
            expect(problems).toEqual(["Skipped making the moment images of image.fits"]);
            expect(appStore.setWorkspaceLoadingStep).toHaveBeenCalledWith(expect.objectContaining({description: "preparing the moment images of image.fits", progress: 0}));
        });

        test("reports a request whose region did not come back, without making it", async () => {
            const {requestMoment} = createGeneratingSession();

            const problems = await restore(createWorkspace({generatedImages: [{request: {...momentRequest, regionId: 9}, images: [{id: 2, moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}]}]}));

            expect(requestMoment).not.toHaveBeenCalled();
            expect(problems).toEqual(["Could not make the moment images of image.fits: the region it is made over was not restored"]);
        });

        test("queries a HiPS image again with the images opened, so an image can be matched to it", async () => {
            const {appStore, loadRemoteFile} = createGeneratingSession();
            const hips = {type: "hips" as const, survey: "CDS/P/DSS2/red", width: 100, height: 80, center: {x: 10, y: -20}, fov: 1, coordsys: HipsCoord.Icrs, projection: HipsProjection.TAN, rotationAngle: 0};

            await restore(createWorkspace({files: [{...IMAGE, references: {spatial: 2}}], generatedImages: [{request: hips, images: [{id: 2, name: "DSS2.fits"}]}], references: {spatial: 2}}));

            expect(loadRemoteFile).toHaveBeenCalledWith({hips: "CDS/P/DSS2/red", width: 100, height: 80, ra: 10, dec: -20, fov: 1, coordsys: "icrs", projection: "TAN", rotationAngle: 0});
            expect(appStore.spatialReference).toBe(appStore.frames[1]);
            expect(appStore.setSpatialMatchingEnabled).toHaveBeenCalledWith(appStore.frames[0], true);
        });

        test("matches an image to a reference made again by a request once it is made", async () => {
            const {appStore, requestMoment} = createGeneratingSession();

            await restore(
                createWorkspace({
                    files: [{...IMAGE, references: {spatial: 2}}],
                    generatedImages: [{request: {...momentRequest, regionId: RegionId.IMAGE}, images: [{id: 2, moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}]}],
                    references: {spatial: 2}
                })
            );

            expect(appStore.setSpatialMatchingEnabled).toHaveBeenCalledWith(appStore.frames[0], true);
            expect(appStore.setSpatialMatchingEnabled.mock.invocationCallOrder[0]).toBeGreaterThan(requestMoment.mock.invocationCallOrder[0]);
        });
    });
});
