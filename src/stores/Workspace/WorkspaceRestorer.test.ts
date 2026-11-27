import {afterEach, describe, expect, jest, test} from "@jest/globals";
import {AxiosError} from "axios";
import {CARTA} from "carta-protobuf";
import {observable, runInAction} from "mobx";
import {Subject} from "rxjs";

import {AppToaster} from "components/Shared";
import {
    AnimationMode,
    BeamType,
    CatalogDatabase,
    CatalogSystemType,
    HipsCoord,
    HipsProjection,
    ImageType,
    ImageViewLayer,
    RadiusUnits,
    RegionId,
    RegionOpacity,
    RestFrameShiftMode,
    SkyRefIs,
    SpectralSystem,
    SystemType,
    VelocityConvention,
    WorkspaceIssueEffect,
    WorkspaceIssueOutcome,
    WorkspaceItemKind
} from "enums";
import {SOME_IMAGES_NOT_RESTORED, type Workspace, type WorkspaceCatalogQuerySource, type WorkspaceImageSource, type WorkspaceIssue} from "models";
import {FloatingObjzIndexManager} from "models/zindex/zindex";
import {BackendService, CatalogApiService} from "services";
import {
    AppStore,
    CatalogOnlineQueryConfigStore,
    MirrorSiteStore,
    WorkspaceIdRegistry,
    type WorkspaceLeftOutItems,
    type WorkspaceLoadingStep,
    WorkspaceRecoveryAction,
    type WorkspaceRecoveryStore,
    type WorkspaceRestoreProgress,
    WorkspaceRestorer
} from "stores";
import {ACTIVE_FILE_ID} from "stores/Widgets";
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
const RegisterRegion = jest.fn((savedRegionId: number): Promise<number | undefined> => Promise.resolve(savedRegionId + 100));

/** The properties that a test sets on every image that the restorer opens, such as whether the image has a beam or supports a rest frame. */
let frameOverrides: Record<string, unknown> = {};

/** What the restorer needs of an image it has opened. */
function createFrame(fileId: number) {
    const frame = {
        frameInfo: {fileId, fileInfoExtended: {width: 100, height: 100}},
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
        setFittingResult: jest.fn(),
        setFittingLog: jest.fn(),
        setFittingResultRegionParams: jest.fn(),
        regionSet: {
            setNewRegionType: jest.fn(),
            setMode: jest.fn(),
            addExistingRegionAsync: jest.fn(async (points: unknown) => {
                const regionId = await RegisterRegion(savedRegionIdOf(points));
                return regionId === undefined ? undefined : {regionId, setLocked: jest.fn(), setLineRegionSampleWidth: jest.fn(), setCoordinate: jest.fn(), setOpacity: jest.fn(), setDashLength: jest.fn()};
            }),
            // Adds each region through addExistingRegionAsync, so that the tests can check each one.
            addExistingRegionsAsync: jest.fn((regions: {points: unknown; rotation: unknown; regionType: unknown; name: unknown; color: unknown; lineWidth: unknown; dashes: unknown; annotationStyles?: unknown; requestedId?: number}[]) => {
                const addOne = frame.regionSet.addExistingRegionAsync as (...args: unknown[]) => Promise<unknown>;
                return Promise.all(regions.map(r => addOne(r.points, r.rotation, r.regionType, r.name, r.color, r.lineWidth, r.dashes, r.annotationStyles, r.requestedId)));
            }),
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
        logStore: {setLevel: jest.fn(), setHiddenTags: jest.fn()},
        animatorStore: {
            stopAnimation: jest.fn(),
            minFrameRate: 1,
            maxFrameRate: 15,
            minStep: 1,
            maxStep: 50,
            setFrameRate: jest.fn(),
            setStep: jest.fn(),
            setPlayMode: jest.fn(),
            setAnimationMode: jest.fn(),
            setNumericInputType: jest.fn(),
            resetSettings: jest.fn()
        },
        imageFittingStore: {applyWorkspaceConfig: jest.fn(), resetSettings: jest.fn()},
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
        setWorkspaceRestoreProgress: jest.fn(),
        /** The Recovery that the restore waits on. By default the user skips every item at once. */
        workspaceRecovery: undefined as WorkspaceRecoveryStore | undefined,
        onRecovery: (recovery: WorkspaceRecoveryStore) => recovery.skipAll(),
        setWorkspaceRecovery: jest.fn((recovery: WorkspaceRecoveryStore | undefined) => {
            appStore.workspaceRecovery = recovery;
            if (recovery) {
                appStore.onRecovery(recovery);
            }
        }),
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
        timeSeriesStore: {isMember: jest.fn((_frame: unknown) => true)},
        activeFrame: undefined as ReturnType<typeof createFrame> | undefined,
        activeImage: undefined as unknown,
        setContourDataSourceUnlocked: jest.fn(),
        isFrameLockedToContour: true,
        toggleFrameContourLock: jest.fn(),
        setCursorFrozen: jest.fn(),
        isCursorMirrored: false,
        toggleCursorMirror: jest.fn(),
        setToolbarExpanded: jest.fn(),
        updateActiveLayer: jest.fn(),
        dialogStore: {dialogVisible: new Map([["vector-dialog", true]]), showDialog: jest.fn(), hideDialog: jest.fn(), setDialogGeometry: jest.fn(), selectTab: jest.fn(), resetPlaceAndTab: jest.fn(), applyUnappliedSettings: jest.fn()},
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
        preferenceStore: {
            regionColor: "#ffffff",
            regionLineWidth: 2,
            regionDashLength: 0,
            layout: "Default",
            spectralMatchingType: "VRAD",
            isCursorFrozen: false,
            setCodeSnippetsEnabledForSession: jest.fn(),
            applySessionPreferences: jest.fn((_values: unknown): {rejectedKeys: string[]} => ({rejectedKeys: []}))
        },
        imageViewConfigStore: {
            createColorBlending: jest.fn(),
            applyConfig: jest.fn(),
            imageNum: 1,
            getImageListIndex: jest.fn((_type: ImageType, fileId: number) => appStore.frames.findIndex(frame => frame.frameInfo.fileId === fileId))
        },
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
            pvGeneratorWidgets: new Map<string, unknown>(),
            floatingWidgets: [] as unknown[],
            removeUnopenedLayoutDisplayStores: jest.fn(),
            restorePlotWidgetBindings: jest.fn((_plotWidgets?: unknown, _ids?: unknown, _only?: (config: any) => boolean): unknown[] => []),
            restorePlotWidgets: jest.fn((_plotWidgets?: unknown, _ids?: unknown): unknown[] => []),
            restorePlotWidgetViews: jest.fn((_plotWidgets?: unknown, _ids?: unknown, _only?: (config: any) => boolean): unknown[] => []),
            nameRestoredWidgetTabs: jest.fn((_plotWidgets?: unknown): void => {}),
            restorePlotWidgetResults: jest.fn((_plotWidgets?: unknown, _isWanted?: () => boolean): Promise<unknown[]> => Promise.resolve([]))
        },
        layoutStore: {
            isComponentHidden: jest.fn((_component: string) => false),
            layoutExists: jest.fn((_name: string) => true),
            applyLayout: jest.fn((_name: string) => true),
            /** What applying the layout copy reports, as the WCS overlay of its image view reports it. */
            layoutProblems: [] as string[],
            applyLayoutConfig: jest.fn((_layout?: unknown, _layoutName?: string, _persistence?: string, problems?: string[]) => {
                calls.push("applyLayout");
                problems?.push(...appStore.layoutStore.layoutProblems);
                return true;
            })
        },
        overlaySettings: {applyTextConfig: jest.fn(), applyConfig: jest.fn((_config: unknown): string[] => []), forgetRestoredSettings: jest.fn(), global: {system: SystemType.Auto}}
    };

    jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore as any);
    return {appStore, calls, profileStore, displayStore};
}

/**
 * Drive a restore to the end the way a mobx flow does. A promise that rejects is thrown into the
 * restore, where the restore can catch it.
 */
async function drive(restorer: WorkspaceRestorer): Promise<WorkspaceIssue[]> {
    const generator = restorer.restore();
    let step = generator.next();
    while (!step.done) {
        let value: unknown;
        try {
            value = await step.value;
        } catch (err) {
            step = generator.throw(err);
            continue;
        }
        step = generator.next(value);
    }
    return step.value;
}

async function restoreIssues(workspace: Workspace): Promise<WorkspaceIssue[]> {
    return drive(new WorkspaceRestorer(workspace, WorkspaceRestorer.claimGeneration()));
}

/** Runs the restore to the end, and returns the restorer so that the test can check the ID maps. */
async function restored(workspace: Workspace, leftOut?: WorkspaceLeftOutItems): Promise<WorkspaceRestorer> {
    const restorer = new WorkspaceRestorer(workspace, WorkspaceRestorer.claimGeneration(), leftOut);
    await drive(restorer);
    return restorer;
}

/** What a restore reports, as the sentences a person reads. */
async function restore(workspace: Workspace): Promise<string[]> {
    return (await restoreIssues(workspace)).map(issue => issue.message);
}

const IMAGE = {id: 1, source: {type: "file" as const, filename: "image.fits"}};
const CATALOG = {id: 1, source: {type: "file" as const, filename: "sources.vot"}, associatedImageId: 1};
const LAYOUT = {layoutVersion: 2, docked: {type: "row", content: [{type: "component", id: "image-view"}]}, floating: []};

/** The saved ID of each region of a workspace made by {@link createWorkspace}, by its points. A test makes the backend refuse a region by having RegisterRegion return undefined. The restore passes on the points, not the saved ID. */
const SAVED_REGION_IDS = new WeakMap<object, number>();

/** Returns the ID that a region was saved with, from the points that the restore passes on. */
function savedRegionIdOf(points: unknown): number {
    return (points && typeof points === "object" && SAVED_REGION_IDS.get(points)) || 0;
}

function createWorkspace(overrides: Partial<Workspace> = {}): Workspace {
    const workspace: Workspace = {workspaceVersion: 2, frontendVersion: 0, files: [IMAGE], ...overrides};
    workspace.files?.forEach(file => file.regionsSet?.regions?.forEach(region => SAVED_REGION_IDS.set(region.points, region.id)));
    return workspace;
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
        // A display store that a regular layout made for a catalog that never opened is not taken over by a catalog of the workspace.
        expect(appStore.widgetsStore.removeUnopenedLayoutDisplayStores).toHaveBeenCalled();
    });

    describe("a workspace saved without the settings of the session, such as one of CARTA 6", () => {
        test("starts from the layout of the preferences, with the default image view and WCS overlay, before the images open", async () => {
            const {appStore, calls} = createSession();
            Object.assign(appStore.preferenceStore, {layout: "My layout"});
            appStore.layoutStore.applyLayout.mockImplementation((name: string) => {
                calls.push(`applyLayout ${name}`);
                return true;
            });
            appStore.appendFile.mockImplementationOnce(() => {
                calls.push("appendFile");
                const frame = createFrame(1);
                appStore.frameMap.set(1, frame as never);
                appStore.frames.push(frame as never);
                return Promise.resolve(frame as never);
            });

            await restore(createWorkspace());

            expect(appStore.layoutStore.applyLayout.mock.calls).toEqual([["My layout"]]);
            expect(calls.indexOf("applyLayout My layout")).toBeLessThan(calls.indexOf("appendFile"));
            expect(appStore.layoutStore.applyLayoutConfig).not.toHaveBeenCalled();
            expect(appStore.imageViewConfigStore.applyConfig).toHaveBeenCalledWith(null);
            expect(appStore.overlaySettings.applyConfig).toHaveBeenCalledWith(null);
        });

        test("uses the Default layout when the layout of the preferences is gone", async () => {
            const {appStore} = createSession();
            Object.assign(appStore.preferenceStore, {layout: "Removed"});
            appStore.layoutStore.layoutExists.mockImplementation((name: string) => name !== "Removed");

            await restore(createWorkspace());

            expect(appStore.layoutStore.applyLayout.mock.calls).toEqual([["Default"]]);
        });

        test("keeps the arrangement to the layout copy when the workspace saved one", async () => {
            const {appStore} = createSession();

            await restore(createWorkspace({layout: {docked: {}, floating: []} as never}));

            expect(appStore.layoutStore.applyLayout).not.toHaveBeenCalled();
            expect(appStore.layoutStore.applyLayoutConfig).toHaveBeenCalled();
        });

        test("sets the animator, the log, the cursor, the toolbar, the spectral matching and the Image Fitting dialog back as CARTA does when it starts", async () => {
            const {appStore} = createSession();
            Object.assign(appStore, {isCursorMirrored: true, spectralMatchingType: "FREQ"});
            Object.assign(appStore.preferenceStore, {isCursorFrozen: true, spectralMatchingType: "VOPT"});

            await restore(createWorkspace());

            expect(appStore.animatorStore.resetSettings).toHaveBeenCalled();
            expect(appStore.logStore.setLevel).toHaveBeenCalledWith(CARTA.ErrorSeverity.INFO);
            expect(appStore.logStore.setHiddenTags).toHaveBeenCalledWith([]);
            expect(appStore.setCursorFrozen).toHaveBeenCalledWith(true);
            expect(appStore.toggleCursorMirror).toHaveBeenCalledTimes(1);
            expect(appStore.setToolbarExpanded).toHaveBeenCalledWith(true);
            expect(appStore.updateActiveLayer).toHaveBeenCalledWith(ImageViewLayer.RegionMoving);
            expect(appStore.spectralMatchingType).toBe("VOPT");
            expect(appStore.imageFittingStore.resetSettings).toHaveBeenCalled();
        });

        test("uses the mirrors of the preferences and sets the online query dialog back", async () => {
            createSession();
            const mirrorSiteStore = MirrorSiteStore.Instance;
            const [first, second] = mirrorSiteStore.getMirrorSites(CatalogDatabase.SIMBAD);
            mirrorSiteStore.setActiveMirror(CatalogDatabase.SIMBAD, second);
            const configStore = CatalogOnlineQueryConfigStore.Instance;
            configStore.setCatalogDB(CatalogDatabase.VIZIER);
            configStore.setVizierKeyWords("galaxies");

            await restore(createWorkspace());

            expect(mirrorSiteStore.getActiveMirror(CatalogDatabase.SIMBAD)).toBe(first);
            expect(configStore.catalogDB).toBe(CatalogDatabase.SIMBAD);
            expect(configStore.vizierKeyWords).toBe("");
        });
    });

    test("applies the animator settings, and the channels that it plays of an image, keeping the defaults of values that are not valid", async () => {
        const {appStore} = createSession();
        appStore.appendFile.mockImplementationOnce(() => {
            const frame = {...createFrame(1), frameInfo: {fileId: 1, fileInfoExtended: {depth: 10}}, setAnimationRange: jest.fn()};
            appStore.frameMap.set(1, frame as never);
            appStore.frames.push(frame as never);
            return Promise.resolve(frame as never);
        });

        await restore(createWorkspace({files: [{...IMAGE, animationChannelRange: [2, 5]}], animator: {frameRate: 8, step: 99, playMode: 2, mode: 1, numericInputType: "Step"} as never}));

        expect((appStore.frames[0] as any).setAnimationRange).toHaveBeenCalledWith([2, 5]);
        expect(appStore.animatorStore.setFrameRate).toHaveBeenCalledWith(8);
        expect(appStore.animatorStore.setStep).not.toHaveBeenCalled();
        expect(appStore.animatorStore.setPlayMode).toHaveBeenCalledWith(2);
        expect(appStore.animatorStore.setNumericInputType).toHaveBeenCalledWith("Step");
        expect(appStore.animatorStore.setAnimationMode).toHaveBeenCalledWith(1);
    });

    test("reports an image that is not in the time series, and the animator when it cannot play the time series", async () => {
        const {appStore} = createSession();
        appStore.timeSeriesStore.isMember.mockReturnValue(false);

        const problems = await restore(createWorkspace({files: [{...IMAGE, timeSeriesMember: true}], animator: {mode: AnimationMode.TIME_SERIES} as never}));

        expect(appStore.setTimeSeriesMember).toHaveBeenCalledWith(appStore.frames[0], true);
        expect(problems).toEqual(["image.fits is not in the time series, because it has no observation time", "The animator does not play the time series, because fewer than 2 images of the time series were restored"]);
    });

    test("reports nothing when the images are in the time series and the animator plays it", async () => {
        const {appStore} = createSession();
        appStore.animatorStore.setAnimationMode.mockImplementation((mode: AnimationMode) => Object.assign(appStore.animatorStore, {animationMode: mode}));

        const problems = await restore(createWorkspace({files: [{...IMAGE, timeSeriesMember: true}], animator: {mode: AnimationMode.TIME_SERIES} as never}));

        expect(problems).toEqual([]);
    });

    test("applies the level and the hidden tags of the Log widget, and keeps the current ones when they are not valid", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({log: {level: 2, hiddenTags: ["Region", "Catalog"]}}));

        expect(appStore.logStore.setLevel).toHaveBeenCalledWith(2);
        expect(appStore.logStore.setHiddenTags).toHaveBeenCalledWith(["Region", "Catalog"]);

        appStore.logStore.setLevel.mockClear();
        appStore.logStore.setHiddenTags.mockClear();
        await restore(createWorkspace({log: {level: 9, hiddenTags: [1]} as never}));

        expect(appStore.logStore.setLevel).not.toHaveBeenCalled();
        expect(appStore.logStore.setHiddenTags).not.toHaveBeenCalled();
    });

    test("opens the saved dialogs in their order, and closes the other dialogs that a workspace keeps, but not a dialog of one step", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({openDialogs: ["region-dialog", "contour-dialog", "file-browser-dialog", "preference-dialog"]}));

        expect(appStore.dialogStore.hideDialog.mock.calls).toEqual([["vector-dialog"]]);
        expect(appStore.dialogStore.showDialog.mock.calls).toEqual([["region-dialog"], ["contour-dialog"], ["preference-dialog"]]);
    });

    test("opens the Snippet dialog with the saved snippet of the saved name, and empty for a missing name or another user's workspace", async () => {
        const {appStore} = createSession();
        const snippet = {code: "app.openFile('a.fits')", categories: []};
        const snippets = new Map<string, unknown>([["Open a file", snippet]]);
        Object.assign(appStore, {snippetStore: {snippets}});

        await restore(createWorkspace({openDialogs: ["snippet-dialog"], dialogSettings: {snippet: {name: "Open a file"}}}));
        expect(appStore.dialogStore.showDialog.mock.calls).toEqual([["snippet-dialog", {snippet, name: "Open a file"}]]);

        appStore.dialogStore.showDialog.mockClear();
        const problems = await restore(createWorkspace({openDialogs: ["snippet-dialog"], dialogSettings: {snippet: {name: "Gone"}}}));
        expect(appStore.dialogStore.showDialog.mock.calls).toEqual([["snippet-dialog", {newSnippet: true}]]);
        expect(problems).toContain('The Snippet dialog is empty, because there is no saved snippet named "Gone"');

        appStore.dialogStore.showDialog.mockClear();
        const sharedProblems = await restore(createWorkspace({editable: false, openDialogs: ["snippet-dialog"], dialogSettings: {snippet: {name: "Open a file"}}}));
        expect(appStore.dialogStore.showDialog.mock.calls).toEqual([["snippet-dialog", {newSnippet: true}]]);
        expect(sharedProblems).toEqual([]);

        // An example is the same for every user, so another user's workspace shows it too.
        const example = {code: "app.openFile('b.fits')", tags: ["example"], categories: ["Examples"]};
        snippets.set("02. Basics", example);
        appStore.dialogStore.showDialog.mockClear();
        await restore(createWorkspace({editable: false, openDialogs: ["snippet-dialog"], dialogSettings: {snippet: {name: "02. Basics"}}}));
        expect(appStore.dialogStore.showDialog.mock.calls).toEqual([["snippet-dialog", {snippet: example, name: "02. Basics"}]]);

        // The opener has turned code snippets off. The restore turns them on for this session only.
        appStore.dialogStore.showDialog.mockClear();
        const setCodeSnippetsEnabledForSession = jest.fn();
        Object.assign(appStore, {preferenceStore: {...appStore.preferenceStore, areCodeSnippetsShown: false, setCodeSnippetsEnabledForSession}});
        const offProblems = await restore(createWorkspace({openDialogs: ["snippet-dialog"], dialogSettings: {snippet: {name: "Open a file"}}}));
        expect(setCodeSnippetsEnabledForSession).toHaveBeenCalledWith(true);
        expect(appStore.dialogStore.showDialog.mock.calls).toEqual([["snippet-dialog", {snippet, name: "Open a file"}]]);
        expect(offProblems).toContain("Code snippets are turned on for this session only, because the workspace has the Snippet dialog open. The preference stays off");

        // A workspace without the Snippet dialog turns off code snippets for the session. The preference does not change.
        setCodeSnippetsEnabledForSession.mockClear();
        await restore(createWorkspace({}));
        expect(setCodeSnippetsEnabledForSession.mock.calls).toEqual([[false]]);
    });

    test("opens the File Info dialog with the text of its header search, closing it first when it is open", async () => {
        const {appStore} = createSession();
        const dialogStore = appStore.dialogStore as any;
        const calls: string[] = [];
        dialogStore.dialogVisible = new Map([["file-info-dialog", true]]);
        dialogStore.hideDialog = jest.fn((id: string) => calls.push(`hide ${id}`));
        dialogStore.setFileInfoSearchString = jest.fn((text?: string) => calls.push(`search ${text}`));
        dialogStore.showDialog = jest.fn((id: string) => calls.push(`show ${id}`));

        await restore(createWorkspace({openDialogs: ["file-info-dialog"], dialogs: {"file-info-dialog": {tab: "image-header", search: "CRVAL"}}}));

        expect(calls).toEqual(["hide file-info-dialog", "search CRVAL", "show file-info-dialog"]);
    });

    test("gives the Image Fitting dialog the saved height of its fitting settings, or the height that they start with", async () => {
        const {appStore} = createSession();
        const dialogStore = appStore.dialogStore as any;
        dialogStore.restoreFittingSettingsHeight = jest.fn();

        for (const settingsHeight of [30.5, 0, 100, 150, -1, "30"]) {
            await restore(createWorkspace({openDialogs: ["fitting-dialog"], dialogs: {"fitting-dialog": {settingsHeight} as any}}));
        }

        expect(dialogStore.restoreFittingSettingsHeight.mock.calls).toEqual([[30.5], [0], [100], [100], [undefined], [undefined]]);
    });

    test("puts each dialog back between the floating widgets as it was stacked", async () => {
        const {appStore} = createSession();
        const zIndexManager = new FloatingObjzIndexManager();
        ["stats-0", "catalog-plot-component-0", "histogram-0"].forEach(id => zIndexManager.assignIndex(id));
        const dialogStore = appStore.dialogStore as any;
        dialogStore.dialogVisible = new Map();
        dialogStore.showDialog = jest.fn((id: string) => {
            dialogStore.dialogVisible.set(id, true);
            zIndexManager.assignIndex(id);
        });
        Object.assign(appStore, {zIndexManager});
        // A catalog plot is stacked by its component ID.
        (appStore.widgetsStore as any).floatingWidgets = [{id: "stats-0"}, {id: "catalog-plot-0", componentId: "catalog-plot-component-0"}, {id: "histogram-0"}];

        await restore(createWorkspace({openDialogs: ["region-dialog", "contour-dialog"], dialogs: {"region-dialog": {widgetsBelow: 1}, "contour-dialog": {widgetsBelow: 3}}}));

        const order = ["stats-0", "catalog-plot-component-0", "histogram-0", "region-dialog", "contour-dialog"].sort((a, b) => (zIndexManager.findIndex(a) ?? 0) - (zIndexManager.findIndex(b) ?? 0));
        expect(order).toEqual(["stats-0", "region-dialog", "catalog-plot-component-0", "histogram-0", "contour-dialog"]);
    });

    test("opens a saved dialog where it was, with the tab that it showed, and puts a dialog without a valid place or tab back to its defaults", async () => {
        const {appStore} = createSession();

        await restore(
            createWorkspace({
                openDialogs: ["contour-dialog", "region-dialog", "vector-dialog"],
                dialogs: {
                    "contour-dialog": {x: 100, y: 50, width: 600, height: 700, tab: "Styling"},
                    "region-dialog": {x: 900, y: -20, width: 500, height: 1200, tab: "Unknown"},
                    "vector-dialog": {x: 10, y: 10, width: 0, height: 300},
                    "fitting-dialog": {x: 10, y: 10, width: 300, height: 300}
                }
            })
        );

        expect(appStore.dialogStore.setDialogGeometry.mock.calls).toEqual([
            ["contour-dialog", {x: 100, y: 50, width: 600, height: 700}],
            ["region-dialog", {x: 900, y: -20, width: 500, height: 1200}]
        ]);
        expect(appStore.dialogStore.resetPlaceAndTab.mock.calls).toEqual([["contour-dialog"], ["region-dialog"], ["vector-dialog"]]);
        expect(appStore.dialogStore.selectTab.mock.calls).toEqual([["contour-dialog", 2]]);
        expect(appStore.dialogStore.showDialog.mock.calls).toEqual([["contour-dialog"], ["region-dialog"], ["vector-dialog"]]);
    });

    test("applies the settings of contours and a vector overlay that are off without turning them on, and gives the dialogs their unapplied settings", async () => {
        const {appStore} = createSession();
        const unappliedContourConfig = {levels: [], thickness: 3} as never;
        const unappliedVectorOverlayConfig = {thickness: 2} as never;

        await restore(
            createWorkspace({
                files: [{...IMAGE, unappliedContourConfig, unappliedVectorOverlayConfig}],
                openDialogs: ["contour-dialog"],
                dialogSettings: {contour: {imageId: 1, levels: [1, 2], smoothingMode: 0, smoothingFactor: 1}, vectorOverlay: {imageId: 9} as never}
            })
        );

        const frame = appStore.frames[0];
        expect(frame.contourConfig.applyConfig).toHaveBeenCalledWith(unappliedContourConfig);
        expect(frame.applyContours).not.toHaveBeenCalled();
        expect(frame.vectorOverlayConfig.applyConfig).toHaveBeenCalledWith(unappliedVectorOverlayConfig);
        expect(frame.applyVectorOverlay).not.toHaveBeenCalled();
        expect(appStore.dialogStore.applyUnappliedSettings.mock.calls).toEqual([
            ["contour-dialog", {frame, values: {imageId: 1, levels: [1, 2], smoothingMode: 0, smoothingFactor: 1}}],
            ["vector-dialog", undefined]
        ]);
    });

    test("closes the analysis dialogs and resets the unapplied dialog settings for a workspace saved without the open dialogs, such as one of CARTA 6", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({}));

        expect(appStore.dialogStore.hideDialog.mock.calls).toEqual([["vector-dialog"]]);
        expect(appStore.dialogStore.showDialog).not.toHaveBeenCalled();
        expect(appStore.dialogStore.applyUnappliedSettings.mock.calls).toEqual([
            ["contour-dialog", undefined],
            ["vector-dialog", undefined]
        ]);
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

    test("puts each settings panel back between the floating widgets as it was stacked", async () => {
        const {appStore} = createSession();
        const zIndexManager = new FloatingObjzIndexManager();
        Object.assign(appStore, {zIndexManager});
        const widgetsStore = appStore.widgetsStore as any;
        // The layout opened the floating widgets. A catalog plot is stacked by its component ID.
        widgetsStore.floatingWidgets = [{id: "pv-generator-0"}, {id: "catalog-plot-0", componentId: "catalog-plot-component-0"}];
        ["pv-generator-0", "catalog-plot-component-0"].forEach(id => zIndexManager.assignIndex(id));
        widgetsStore.removeFloatingWidget = jest.fn();
        widgetsStore.layoutIdOf = jest.fn((_type: string, id: string) => id);
        widgetsStore.createFloatingSettingsWidget = jest.fn((_title: string, parentId: string) => {
            widgetsStore.floatingWidgets.push({type: "floating-settings", id: `${parentId}-settings`, parentId, setDefaultPosition: jest.fn(), setDefaultSize: jest.fn()});
            zIndexManager.assignIndex(`${parentId}-settings`);
        });

        await restore(
            createWorkspace({
                openWidgetSettings: [
                    {widgetId: "spectral-profiler-0", widgetType: "spectral-profiler", title: "Z Profile", widgetsBelow: 0},
                    {widgetId: "histogram-0", widgetType: "histogram", title: "Histogram", widgetsBelow: 1}
                ]
            })
        );

        const order = ["pv-generator-0", "catalog-plot-component-0", "spectral-profiler-0-settings", "histogram-0-settings"].sort((a, b) => (zIndexManager.findIndex(a) ?? 0) - (zIndexManager.findIndex(b) ?? 0));
        expect(order).toEqual(["spectral-profiler-0-settings", "pv-generator-0", "histogram-0-settings", "catalog-plot-component-0"]);
    });

    test("puts each PV Preview Viewer back between the floating widgets as it was stacked, and makes the active preview active again", async () => {
        const {appStore} = createSession();
        const zIndexManager = new FloatingObjzIndexManager();
        Object.assign(appStore, {zIndexManager});
        const widgetsStore = appStore.widgetsStore as any;
        const previews = [{name: "preview 0"}, {name: "preview 1"}];
        widgetsStore.pvGeneratorWidgets = new Map([
            ["pv-generator-0", {widgetId: "pv-generator-0", previewFrame: previews[0]}],
            ["pv-generator-1", {widgetId: "pv-generator-1", previewFrame: previews[1]}]
        ]);
        // The layout opened the generators, and each viewer opened on top when its preview arrived.
        widgetsStore.floatingWidgets = [{id: "pv-generator-0"}, {id: "pv-generator-1"}, {id: "viewer-0", type: "pv-preview", parentId: "pv-generator-0"}, {id: "viewer-1", type: "pv-preview", parentId: "pv-generator-1"}];
        ["pv-generator-0", "pv-generator-1", "viewer-0", "viewer-1"].forEach(id => zIndexManager.assignIndex(id));
        const panel = (widgetsBelow: number) => ({x: 0, y: 0, width: 100, height: 100, widgetsBelow});

        await restore(
            createWorkspace({
                plotWidgets: {
                    "pv-generator-0": {preview: {panel: panel(2)}},
                    "pv-generator-1": {preview: {isActive: true, panel: panel(0)}}
                } as never
            })
        );

        const order = ["pv-generator-0", "pv-generator-1", "viewer-0", "viewer-1"].sort((a, b) => (zIndexManager.findIndex(a) ?? 0) - (zIndexManager.findIndex(b) ?? 0));
        expect(order).toEqual(["viewer-1", "pv-generator-0", "viewer-0", "pv-generator-1"]);
        expect(appStore.updateActiveImageByFrame).toHaveBeenLastCalledWith(previews[1] as never);
    });

    test("leaves a PV preview that was not made again, and a workspace without the stack of the viewers", async () => {
        const {appStore} = createSession();
        const zIndexManager = new FloatingObjzIndexManager();
        Object.assign(appStore, {zIndexManager});
        const widgetsStore = appStore.widgetsStore as any;
        widgetsStore.pvGeneratorWidgets = new Map([
            ["pv-generator-0", {widgetId: "pv-generator-0", previewFrame: null}],
            ["pv-generator-1", {widgetId: "pv-generator-1", previewFrame: {name: "preview 1"}}]
        ]);
        widgetsStore.floatingWidgets = [{id: "pv-generator-1"}, {id: "viewer-1", type: "pv-preview", parentId: "pv-generator-1"}];
        ["pv-generator-1", "viewer-1"].forEach(id => zIndexManager.assignIndex(id));

        await restore(
            createWorkspace({
                plotWidgets: {
                    "pv-generator-0": {preview: {isActive: true}},
                    "pv-generator-1": {preview: {panel: {x: 0, y: 0, width: 100, height: 100}}}
                } as never
            })
        );

        expect(zIndexManager.findIndex("viewer-1")).toBeGreaterThan(zIndexManager.findIndex("pv-generator-1")!);
        expect(appStore.updateActiveImageByFrame).not.toHaveBeenCalledWith(null);
        expect(appStore.updateActiveImageByFrame.mock.calls.every(([frame]) => frame === appStore.frames[0])).toBe(true);
    });

    describe("widgets that showed the PV preview in front", () => {
        const request = {imageId: 0, regionId: 1, width: 3, reverse: false, previewRegionId: -1, xyRebin: 1, zRebin: 1};
        const plotWidgets = {
            "pv-generator-0": {type: "pv-generator", preview: {isActive: true, request}},
            "histogram-0": {type: "histogram", minX: 1, maxX: 2},
            "histogram-1": {type: "histogram", imageId: 0},
            "spatial-profiler-0": {type: "spatial-profiler"},
            "stats-0": {type: "stats"}
        };

        test("apply their saved view once the restore puts the preview in front again", async () => {
            const {appStore} = createSession();
            const preview = {name: "preview"};
            (appStore.widgetsStore as any).pvGeneratorWidgets = new Map([["pv-generator-0", {widgetId: "pv-generator-0", previewFrame: preview}]]);
            const pending: boolean[] = [];
            appStore.widgetsStore.restorePlotWidgetBindings.mockImplementation((_plotWidgets, ids) => {
                pending.push((ids as WorkspaceRestorer).isActivePvPreviewPending());
                return [];
            });

            await restore(createWorkspace({plotWidgets: plotWidgets as never}));

            expect(pending).toEqual([true, false]);
            const [, rebind] = appStore.widgetsStore.restorePlotWidgetBindings.mock.calls;
            const only = rebind[2]!;
            expect(
                Object.entries(plotWidgets)
                    .filter(([, config]) => only(config))
                    .map(([id]) => id)
            ).toEqual(["histogram-0", "spatial-profiler-0"]);
            const views = appStore.widgetsStore.restorePlotWidgetViews.mock;
            expect(views.calls).toHaveLength(2);
            expect(views.calls[1][2]).toBe(only);
            expect(appStore.updateActiveImageByFrame.mock.invocationCallOrder.at(-1)).toBeLessThan(views.invocationCallOrder[1]);
        });

        test("show the image in front without their saved view when the preview was not made again, and say so", async () => {
            const {appStore} = createSession();
            (appStore.widgetsStore as any).pvGeneratorWidgets = new Map([["pv-generator-0", {widgetId: "pv-generator-0", previewFrame: null}]]);

            const problems = await restore(createWorkspace({plotWidgets: plotWidgets as never}));

            expect(appStore.widgetsStore.restorePlotWidgetViews).toHaveBeenCalledTimes(1);
            expect(problems).toContain("The widgets that follow the image in front show it without their saved zoom, because the PV preview that was in front was not made again");
        });

        test("say nothing when the preview was not made again and no widget saved a zoom of it", async () => {
            const {appStore} = createSession();
            (appStore.widgetsStore as any).pvGeneratorWidgets = new Map([["pv-generator-0", {widgetId: "pv-generator-0", previewFrame: null}]]);
            const withoutZoom = {...plotWidgets, "histogram-0": {type: "histogram"}};

            const problems = await restore(createWorkspace({plotWidgets: withoutZoom as never}));

            expect(problems).toEqual([]);
        });
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

    test("locks the Contour dialog to the active image again when the workspace saved it following the active image", async () => {
        const {appStore} = createSession();
        // An earlier workspace left the dialog unlocked.
        Object.assign(appStore, {isFrameLockedToContour: false});

        await restore(createWorkspace({files: [IMAGE]}));

        expect(appStore.toggleFrameContourLock).toHaveBeenCalledTimes(1);
    });

    test("re-queries a saved SIMBAD source without changing the online query dialog", async () => {
        createSession();
        const source: WorkspaceCatalogQuerySource = {type: "simbad", center: {x: 12.5, y: -30.25}, system: CatalogSystemType.ICRS, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 500};
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const setDatabase = jest.spyOn(configStore, "setCatalogDB");
        const setRadius = jest.spyOn(configStore, "setSearchRadius");
        const updateCenter = jest.spyOn(configStore, "updateCenterPixelCoord");
        const load = jest.spyOn(CatalogApiService.Instance, "loadSimbadCatalog").mockResolvedValue({fileId: 10, dataSize: 5});
        // A workspace without the fields of the dialog sets them back to the defaults. Save empty fields, which change nothing, to check the query alone.
        const onlineCatalogQuery = {} as Workspace["onlineCatalogQuery"];

        expect(await restore(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}], onlineCatalogQuery}))).toEqual([]);

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
        expect(await restore(createWorkspace({catalogs: [{id: 1, source: {...source, table: undefined}, associatedImageId: 1}]}))).toContain("Could not load the catalog from the VizieR query: the query names no table");
        expect(load).not.toHaveBeenCalled();
    });

    test("says why an image or a catalog could not be opened, as the backend says it", async () => {
        const {appStore} = createSession();
        appStore.appendFile = jest.fn(() => Promise.reject("File /data/image.fits does not exist."));
        const catalogSource: WorkspaceCatalogQuerySource = {type: "vizier", center: {x: 12.5, y: -30.25}, system: CatalogSystemType.FK5, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 500, table: "I/355/gaiadr3"};
        jest.spyOn(CatalogApiService.Instance, "loadVizierCatalogs").mockRejectedValue(new Error("Network Error"));

        const issues = await restoreIssues(createWorkspace({catalogs: [{id: 1, source: catalogSource}]}));

        expect(issues.map(issue => issue.message)).toEqual(expect.arrayContaining(["Could not open the image image.fits: File /data/image.fits does not exist", expect.stringMatching(/^Could not load the catalog .*: Network Error$/)]));
    });

    test("lets the number formats of the WCS overlay follow the system when the image saved in front was not restored", async () => {
        const {appStore} = createSession();
        const dropFormatsOfSavedFrontImage = jest.fn(() => true);
        Object.assign(appStore, {overlaySettings: {...(appStore as any).overlaySettings, dropFormatsOfSavedFrontImage}});

        expect(await restore(createWorkspace({layout: LAYOUT}))).toEqual([]);
        expect(dropFormatsOfSavedFrontImage).not.toHaveBeenCalled();

        expect(await restore(createWorkspace({layout: LAYOUT, selectedFile: 9}))).toContain("The WCS overlay shows the number formats of the image in front, because the image that the workspace showed in front was not restored");
        expect(dropFormatsOfSavedFrontImage).toHaveBeenCalledTimes(1);
    });

    test("shows the active image on the rest frequency tab of the Image List when an image was not restored", async () => {
        const sessionWith = () => {
            const {appStore} = createSession();
            const layerList = {selectedFrameIndex: 0, resetSelectedFrameIndex: jest.fn()};
            Object.assign(appStore.widgetsStore, {layerListWidgets: new Map([["layer-list-0", layerList]])});
            return {appStore, layerList};
        };
        let {appStore, layerList} = sessionWith();
        expect(await restore(createWorkspace({layout: LAYOUT}))).toEqual([]);
        expect(layerList.resetSelectedFrameIndex).not.toHaveBeenCalled();

        ({appStore, layerList} = sessionWith());
        appStore.appendFile = jest.fn(() => Promise.reject("File /data/image.fits does not exist."));
        expect(await restore(createWorkspace({layout: LAYOUT}))).toContain("The rest frequency tab of the Image List shows the active image, because not every image was restored");
        expect(layerList.resetSelectedFrameIndex).toHaveBeenCalledTimes(1);
    });

    test("says why an online catalog could not be loaded, without a toast", async () => {
        createSession();
        const source: WorkspaceCatalogQuerySource = {type: "simbad", center: {x: 12.5, y: -30.25}, system: CatalogSystemType.ICRS, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 500};
        const query = jest.spyOn(CatalogApiService.Instance, "getSimbadCatalog").mockRejectedValue(new Error("Request to mirror simbad.example failed"));
        const toaster = jest.spyOn(AppToaster, "show").mockResolvedValue(undefined);

        const failed = await restoreIssues(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}]}));
        expect(failed.map(issue => issue.message)).toContainEqual(expect.stringMatching(/^Could not load the catalog .*: Request to mirror simbad.example failed$/));

        query.mockResolvedValue({status: 200, data: {data: [], metadata: []}} as any);
        const empty = await restoreIssues(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}]}));
        expect(empty.map(issue => issue.message)).toContainEqual(expect.stringMatching(/^Could not load the catalog .*: the query found no sources$/));
        expect(toaster).not.toHaveBeenCalled();
    });

    test("waits only once for a mirror that does not respond, and gives both catalogs the reason", async () => {
        createSession();
        const source: WorkspaceCatalogQuerySource = {type: "simbad", center: {x: 12.5, y: -30.25}, system: CatalogSystemType.ICRS, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 500};
        const timeout = new AxiosError("timeout of 60000ms exceeded", AxiosError.ETIMEDOUT);
        const service = CatalogApiService.Instance as unknown as {axiosInstanceSimbad: {get: (url: string) => Promise<unknown>}};
        const get = jest.spyOn(service.axiosInstanceSimbad, "get").mockRejectedValue(timeout);

        const issues = await restoreIssues(
            createWorkspace({
                catalogs: [
                    {id: 1, source, associatedImageId: 1},
                    {id: 2, source: {...source, radius: 3}, associatedImageId: 1}
                ]
            })
        );

        expect(get).toHaveBeenCalledTimes(1);
        const messages = issues.map(issue => issue.message).filter(message => message.startsWith("Could not load the catalog"));
        expect(messages).toHaveLength(2);
        expect(messages[0]).toMatch(/: Mirror .+ did not respond within 60 seconds\. The mirror may be unavailable\. Select another mirror site and retry$/);
        expect(messages[1]).toMatch(/: Mirror .+ did not respond within 60 seconds to an earlier query\. The mirror may be unavailable\. Select another mirror site and retry$/);
        // The report lists the second catalog under the first catalog. The first query waited for the mirror.
        const catalogs = issues.filter(issue => issue.kind === WorkspaceItemKind.Catalog);
        expect(catalogs.map(({label, catalogIds, causeCatalogId}) => ({label, catalogIds, causeCatalogId}))).toEqual([
            {label: "The SIMBAD catalog on image.fits", catalogIds: [1], causeCatalogId: undefined},
            {label: "The SIMBAD catalog on image.fits", catalogIds: [2], causeCatalogId: 1}
        ]);

        // The next restore tries the mirror again.
        await restoreIssues(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}]}));
        expect(get).toHaveBeenCalledTimes(2);
    });

    test("forgets the mirrors that timed out when a newer load supersedes the restore", async () => {
        createSession();
        const source: WorkspaceCatalogQuerySource = {type: "simbad", center: {x: 12.5, y: -30.25}, system: CatalogSystemType.ICRS, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 500};
        const timeout = new AxiosError("timeout of 60000ms exceeded", AxiosError.ETIMEDOUT);
        const service = CatalogApiService.Instance as unknown as {axiosInstanceSimbad: {get: (url: string) => Promise<unknown>}};
        // A newer load starts while the first query waits for the mirror.
        const get = jest.spyOn(service.axiosInstanceSimbad, "get").mockImplementationOnce(() => {
            WorkspaceRestorer.claimGeneration();
            return Promise.reject(timeout);
        });

        await restoreIssues(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}]}));
        expect(get).toHaveBeenCalledTimes(1);

        // A query after the superseded restore waits for the mirror again.
        get.mockRejectedValue(timeout);
        await expect(CatalogApiService.Instance.loadSimbadCatalog(source)).rejects.toThrow("Mirror");
        expect(get).toHaveBeenCalledTimes(2);
    });

    test("shows the stage and the item of the stage that it is on", async () => {
        const {appStore} = createSession();
        const source: WorkspaceCatalogQuerySource = {type: "vizier", center: {x: 12.5, y: -30.25}, system: CatalogSystemType.FK5, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 500, table: "I/355/gaiadr3"};
        jest.spyOn(CatalogApiService.Instance, "loadVizierCatalogs").mockResolvedValue([10]);

        await restore(
            createWorkspace({
                catalogs: [
                    {id: 1, source, associatedImageId: 1},
                    {id: 2, source: {...source, table: "I/239/hip_main"}, associatedImageId: 1}
                ]
            })
        );

        const stages = appStore.setWorkspaceRestoreProgress.mock.calls.map(([progress]: [WorkspaceRestoreProgress]) => progress);
        expect(stages).toEqual(
            expect.arrayContaining([
                {stage: "Opening images", index: 1, count: 1, item: expect.any(String)},
                // An online catalog is named as in the report, not as "from the VizieR query".
                {stage: "Opening catalogs", index: 1, count: 2, item: "The VizieR catalog I/355/gaiadr3 on image.fits"},
                {stage: "Opening catalogs", index: 2, count: 2, item: "The VizieR catalog I/239/hip_main on image.fits"}
            ])
        );
        expect(stages.at(-1)).toEqual(expect.objectContaining({stage: "Restoring the layout and widgets"}));
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
            frames: [],
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

    test("gives each alpha to its own layer, and reports a layer that could not be added, or a blend saved without alphas", async () => {
        const {appStore} = createSession();
        const colorBlending = {
            id: 0,
            selectedFrames: [] as unknown[],
            frames: [] as unknown[],
            deleteSelectedFrame: jest.fn(),
            setAlpha: jest.fn(),
            // The second layer is not matched to the base layer, so it is refused.
            addSelectedFrame: jest.fn((frame: unknown) => {
                if (frame === appStore.frames[1]) {
                    colorBlending.selectedFrames.push(frame);
                }
            }),
            isRasterVisible: true,
            isContourVisible: true,
            isVectorOverlayVisible: true,
            toggleRasterVisible: jest.fn(),
            toggleContourVisible: jest.fn(),
            toggleVectorOverlayVisible: jest.fn()
        };
        appStore.imageViewConfigStore.createColorBlending.mockImplementation(() => colorBlending);
        const files = [IMAGE, {...IMAGE, id: 2, source: {type: "file" as const, filename: "second.fits"}}, {...IMAGE, id: 3, source: {type: "file" as const, filename: "third.fits"}}];

        const problems = await restore(createWorkspace({files, colorBlendingImages: [{imageListIndex: 3, selectedFrameId: [2, 3], alpha: [0.5, 0.3, 0.8]}]}));

        expect(colorBlending.setAlpha.mock.calls).toEqual([
            [0, 0.5],
            [1, 0.3]
        ]);
        expect(problems).toContain("Could not add third.fits as a layer of the color-blended image 3 in the Image List: it is not matched to the base layer");

        colorBlending.selectedFrames = [];
        colorBlending.setAlpha.mockClear();
        await expect(restore(createWorkspace({files, colorBlendingImages: [{imageListIndex: 3} as never]}))).resolves.toBeDefined();
        expect(colorBlending.setAlpha).not.toHaveBeenCalled();
    });

    test("says that a layer could not be added because it is the base layer", async () => {
        const {appStore} = createSession();
        const colorBlending = {
            id: 0,
            selectedFrames: [] as unknown[],
            frames: [] as unknown[],
            // The first image is the base layer, the spatial reference of the color-blended image.
            get baseFrame() {
                return appStore.frames[0];
            },
            deleteSelectedFrame: jest.fn(),
            setAlpha: jest.fn(),
            addSelectedFrame: jest.fn(),
            toggleRasterVisible: jest.fn(),
            toggleContourVisible: jest.fn(),
            toggleVectorOverlayVisible: jest.fn()
        };
        appStore.imageViewConfigStore.createColorBlending.mockImplementation(() => colorBlending);

        const problems = await restore(createWorkspace({files: [IMAGE], colorBlendingImages: [{imageListIndex: 1, selectedFrameId: [1], alpha: [1, 1]}]}));

        expect(problems).toContain("Could not add image.fits as a layer of the color-blended image 1 in the Image List: it is the base layer");
    });

    test("lists a layer whose image was not restored under that image in the restore report", async () => {
        const {appStore} = createSession();
        const colorBlending = {selectedFrames: [], frames: [], deleteSelectedFrame: jest.fn(), setAlpha: jest.fn(), addSelectedFrame: jest.fn()};
        appStore.imageViewConfigStore.createColorBlending.mockImplementation(() => colorBlending);

        const issues = await restoreIssues(createWorkspace({files: [IMAGE], colorBlendingImages: [{imageListIndex: 1, selectedFrameId: [3], alpha: [1, 1]}]}));

        expect(issues).toContainEqual(expect.objectContaining({label: "The layer image 3 of the color-blended image 1", reason: "the image was not restored", causeImageId: 3}));
    });

    test("reports a color-blended image that could not be made, because none of its images was restored", async () => {
        const {appStore} = createSession();
        appStore.imageViewConfigStore.createColorBlending.mockImplementation(() => null);

        const issues = await restoreIssues(createWorkspace({files: [IMAGE], colorBlendingImages: [{imageListIndex: 1, selectedFrameId: [2], alpha: [1, 1]}]}));

        expect(issues).toContainEqual(
            expect.objectContaining({
                subject: "the color-blended image 1",
                message: "Could not restore the color-blended image 1 in the Image List, because none of its images was restored",
                outcome: WorkspaceIssueOutcome.Failed,
                label: "The color-blended image 1 in the Image List",
                reason: "none of its images was restored"
            })
        );
        expect(appStore.reorderFrame).not.toHaveBeenCalled();
    });

    test("reports a color-blended image that does not say where it is in the Image List, and makes the others", async () => {
        const {appStore} = createSession();
        const colorBlending = {selectedFrames: [] as unknown[], frames: [] as unknown[], deleteSelectedFrame: jest.fn(), setAlpha: jest.fn(), addSelectedFrame: jest.fn()};
        appStore.imageViewConfigStore.createColorBlending.mockImplementation(() => colorBlending);

        const issues = await restoreIssues(
            createWorkspace({
                files: [IMAGE],
                colorBlendingImages: [{selectedFrameId: [1], alpha: [1, 1]} as never, {imageListIndex: 1.5, selectedFrameId: [1], alpha: [1, 1]}, {imageListIndex: 1, selectedFrameId: [1], alpha: [1, 1]}]
            })
        );

        expect(issues.filter(issue => issue.subject === "a color-blended image")).toEqual([
            expect.objectContaining({message: "Could not restore a color-blended image, because the workspace does not say where it is in the Image List", outcome: WorkspaceIssueOutcome.Failed}),
            expect.objectContaining({message: "Could not restore a color-blended image, because the workspace does not say where it is in the Image List", outcome: WorkspaceIssueOutcome.Failed})
        ]);
        expect(appStore.imageViewConfigStore.createColorBlending).toHaveBeenCalledTimes(1);
        expect(appStore.reorderFrame).toHaveBeenCalledTimes(1);
        expect(appStore.reorderFrame).toHaveBeenCalledWith(expect.any(Number), 1, 1);
    });

    test("keeps contours saved without valid levels off, and says so", async () => {
        const {appStore} = createSession();

        const problems = await restore(createWorkspace({files: [{...IMAGE, contourConfig: {color: {r: 255, g: 0, b: 0, a: 1}} as never}]}));

        const frame = appStore.frames[0] as any;
        expect(frame.contourConfig.applyConfig).toHaveBeenCalled();
        expect(frame.applyContours).not.toHaveBeenCalled();
        expect(problems).toContain("The contours of image.fits were not turned on, because the workspace saved no valid contour levels");
    });

    test("selects again the regions that were selected together, and freezes the cursor where it was frozen", async () => {
        const {appStore} = createSession();
        const region = (id: number) => ({id, points: [{x: 0, y: 0}], rotation: 0, type: 3});

        await restore(createWorkspace({files: [{...IMAGE, regionsSet: {selectedRegion: 2, selectedRegions: [1, 2, 9], regions: [region(1), region(2)]}}], selectedFile: 1, cursor: {frozen: true, position: {x: 3, y: 4}}}));

        const frame = appStore.frames[0] as any;
        expect(frame.regionSet.setSelectionByIds).toHaveBeenCalledWith([101, 102], 102);
        expect(appStore.setCursorFrozen).toHaveBeenCalledWith(true);
        expect((appStore.activeFrame as any).updateCursorRegion).toHaveBeenCalledWith({x: 3, y: 4});
    });

    test("opens each file with the saved AIPS beam support for that file only, and reports the images that differ from the preference", async () => {
        const {appStore} = createSession();
        const preferenceStore = {...appStore.preferenceStore, hasAipsBeamSupport: false, hasAipsBeamSupportForRestore: undefined as boolean | undefined};
        Object.assign(appStore, {preferenceStore});
        const usedValues: (boolean | undefined)[] = [];
        const appendFile = appStore.appendFile.getMockImplementation()!;
        appStore.appendFile.mockImplementation((...args: unknown[]) => {
            usedValues.push(preferenceStore.hasAipsBeamSupportForRestore);
            return (appendFile as (...args: unknown[]) => ReturnType<typeof appendFile>)(...args);
        });
        const file = (id: number, hasAipsBeamSupport?: boolean) => ({id, source: {type: "file" as const, filename: `image${id}.fits`}, ...(hasAipsBeamSupport === undefined ? {} : {aipsBeamSupport: hasAipsBeamSupport})});

        // A stopped restore left a value. A file without a saved value opens with the preference.
        preferenceStore.hasAipsBeamSupportForRestore = true;
        const problems = await restore(createWorkspace({files: [file(1, true), file(2, false), file(3), file(4, true)]}));

        expect(usedValues).toEqual([true, false, undefined, true]);
        expect(preferenceStore.hasAipsBeamSupportForRestore).toBeUndefined();
        expect(problems).toContain("2 images are opened with AIPS beam support on, as the workspace saved them. Images that you open later use AIPS beam support off");
        expect(problems.filter(problem => problem.includes("AIPS"))).toHaveLength(1);
    });

    test("gives each image the type of a new region and the region mode that it was saved with, keeping the values that are not valid", async () => {
        const {appStore} = createSession();
        const second = {id: 2, source: {type: "file" as const, filename: "second.fits"}, regionsSet: {newRegionType: "point", regionMode: 2} as any};

        await restore(createWorkspace({files: [{...IMAGE, regionsSet: {newRegionType: 3, regionMode: 1}}, second]}));

        const calls = appStore.frames.map((frame: any) => [frame.regionSet.setNewRegionType.mock.calls, frame.regionSet.setMode.mock.calls]);
        expect(calls).toEqual([
            [[[3]], [[1]]],
            [[], []]
        ]);
    });

    test("does not give the image in front the toolbar's type of a new region when the image saved its own", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({files: [{...IMAGE, regionsSet: {newRegionType: 3, regionMode: 0}}], toolbar: {expanded: true, activeLayer: "region" as never, newRegionType: 4, regionMode: 1}}));

        const regionSet = (appStore.activeFrame as any).regionSet;
        expect([regionSet.setNewRegionType.mock.calls, regionSet.setMode.mock.calls]).toEqual([[[3]], [[0]]]);
    });

    test("mirrors the cursor again only when it was mirrored, and applies the image toolbar, keeping the values that are not valid", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({files: [IMAGE], cursor: {frozen: false, mirrored: true}, toolbar: {expanded: false, activeLayer: "catalog" as never, newRegionType: 4, regionMode: 1}}));
        expect(appStore.toggleCursorMirror).toHaveBeenCalledTimes(1);
        expect(appStore.setToolbarExpanded).toHaveBeenCalledWith(false);
        expect(appStore.updateActiveLayer).toHaveBeenCalledWith("catalog");
        expect([(appStore.activeFrame as any).regionSet.setNewRegionType.mock.calls, (appStore.activeFrame as any).regionSet.setMode.mock.calls]).toEqual([[[4]], [[1]]]);

        appStore.toggleCursorMirror.mockClear();
        appStore.updateActiveLayer.mockClear();
        await restore(createWorkspace({files: [IMAGE], cursor: {frozen: false}, toolbar: {expanded: true, activeLayer: "drawing" as never, newRegionType: 99 as never, regionMode: 7 as never}}));
        expect(appStore.toggleCursorMirror).not.toHaveBeenCalled();
        expect(appStore.updateActiveLayer).not.toHaveBeenCalled();
    });

    test("puts the cursor back before the layout makes the widgets, and keeps the saved center of the online query dialog", async () => {
        const {appStore} = createSession();
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const onlineCatalogQuery = {...configStore.toWorkspaceConfig(), center: {x: "10", y: "20"}, objectName: "M17"};

        await restore(createWorkspace({files: [IMAGE], layout: LAYOUT, selectedFile: 1, cursor: {frozen: true, position: {x: 5, y: 6}}, onlineCatalogQuery}));

        const cursorOrder = (appStore.activeFrame as any).updateCursorRegion.mock.invocationCallOrder[0];
        expect(cursorOrder).toBeLessThan(appStore.layoutStore.applyLayoutConfig.mock.invocationCallOrder[0]);
        expect([configStore.centerPixelCoord, configStore.objectName]).toEqual([{x: "10", y: "20"}, "M17"]);
        runInAction(() => configStore.resetObjectName());
    });

    test("turns the auto spatial matching of moment images off when it was off, and on again for a workspace that leaves it out", async () => {
        const {appStore} = createSession();
        const toggleMomentToMatch = jest.fn(() => ((appStore as any).shouldMatchMoment = !(appStore as any).shouldMatchMoment));
        Object.assign(appStore, {shouldMatchMoment: true, toggleMomentToMatch});

        await restore(createWorkspace({files: [IMAGE], momentAutoMatching: false}));
        expect((appStore as any).shouldMatchMoment).toBe(false);

        await restore(createWorkspace({files: [IMAGE]}));
        expect((appStore as any).shouldMatchMoment).toBe(true);
        expect(toggleMomentToMatch).toHaveBeenCalledTimes(2);
    });

    test("shows the saved image on the Beam tab after the image in front is chosen", async () => {
        const {appStore} = createSession();
        const setSelectedFrame = jest.fn();
        Object.assign(appStore, {overlaySettings: {...(appStore as any).overlaySettings, beam: {setSelectedFrame}}});

        await restore(createWorkspace({files: [IMAGE, {id: 2, source: {type: "file", filename: "other.fits"}}], beamSettingsImageId: 2}));

        expect(setSelectedFrame).toHaveBeenCalledWith(appStore.frames[1].frameInfo.fileId);
    });

    test("leaves the cursor where it is when the image that it was on is not in front, and says so", async () => {
        const {appStore} = createSession();

        // The image that was in front, 2, was not restored. So the first image is in front.
        const issues = await restoreIssues(createWorkspace({files: [IMAGE], selectedFile: 2, cursor: {frozen: true, position: {x: 5, y: 6}}}));

        expect((appStore.activeFrame as any).updateCursorRegion).not.toHaveBeenCalled();
        expect(appStore.setCursorFrozen).toHaveBeenCalledWith(true);
        expect(issues).toContainEqual(expect.objectContaining({message: "The cursor was not put back where it was, because the image that it was on is not in front", causeImageId: 2}));
    });

    test("leaves the cursor where it is without a report when the image in front was not saved, such as a PV preview", async () => {
        const {appStore} = createSession();

        const problems = await restore(createWorkspace({files: [IMAGE], cursor: {frozen: true, position: {x: 5, y: 6}}}));

        expect((appStore.activeFrame as any).updateCursorRegion).not.toHaveBeenCalled();
        expect(problems).not.toContain("The cursor was not put back where it was, because the image that it was on is not in front");
    });

    test("counts the cursor as put back on the image in front only when it was saved over the image", async () => {
        const {appStore} = createSession();

        // The image is 100 by 100 pixels. A cursor saved beside it shows its position, and the cursor profiles stay where they were.
        const over = await restored(createWorkspace({files: [IMAGE], selectedFile: 1, cursor: {frozen: true, position: {x: 5, y: 6}}}));
        expect(over.wasCursorRestoredOn(appStore.activeFrame.frameInfo.fileId)).toBe(true);
        const beside = await restored(createWorkspace({files: [IMAGE], selectedFile: 1, cursor: {frozen: true, position: {x: 250, y: 6}}}));
        expect(beside.wasCursorRestoredOn(appStore.activeFrame.frameInfo.fileId)).toBe(false);
    });

    test("puts a cursor that was not frozen where it was, so that the cursor profiles show that position", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({files: [IMAGE], selectedFile: 1, cursor: {frozen: false, position: {x: 5, y: 6}}}));

        expect((appStore.activeFrame as any).setCursorPosition).toHaveBeenCalledWith({x: 5, y: 6});
        expect((appStore.activeFrame as any).updateCursorRegion).toHaveBeenCalledWith({x: 5, y: 6});
        expect(appStore.setCursorFrozen).toHaveBeenCalledWith(false);
    });

    test("puts the color-blended image saved in front back there", async () => {
        const {appStore} = createSession();
        const colorBlendings = [{id: 0}, {id: 1}];
        appStore.imageViewConfigStore.createColorBlending.mockImplementation(() => {
            const colorBlending = colorBlendings.shift();
            appStore.activeImage = {type: ImageType.COLOR_BLENDING, store: colorBlending};
            return {...colorBlending, selectedFrames: [], frames: [], deleteSelectedFrame: jest.fn(), setAlpha: jest.fn(), addSelectedFrame: jest.fn()};
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
        // The layout copy of a workspace is applied in the workspace form, and validated by the workspace schema.
        expect(appStore.layoutStore.applyLayoutConfig).toHaveBeenCalledWith(LAYOUT, "", "workspace", []);
        expect(calls.indexOf("applyLayout")).toBeGreaterThan(calls.indexOf("restoreCatalogRows"));
    });

    describe("the field of view", () => {
        /** Restores a workspace saved with a view of `saved`, into a view of 640 by 400 pixels, or of `current`. */
        async function restoreIntoView(saved: Workspace["imageView"], current: {width: number; height: number; devicePixelRatio?: number} = {width: 640, height: 400}) {
            const setZoom = jest.fn();
            frameOverrides = {renderWidth: current.width, renderHeight: current.height, setZoom};
            const {appStore} = createSession();
            (appStore as unknown as {devicePixelRatio?: number}).devicePixelRatio = current.devicePixelRatio;
            const problems = await restore(createWorkspace({imageView: saved}));
            return {problems, setZoom};
        }

        test("scales the zoom, so that the same area of the image shows in a smaller view", async () => {
            const {problems, setZoom} = await restoreIntoView({width: 1280, height: 800, devicePixelRatio: 1});

            expect(setZoom).toHaveBeenCalledWith(0.5, true);
            expect(problems).toEqual([]);
        });

        test("compares the views in screen pixels, because the zoom counts screen pixels", async () => {
            const {setZoom} = await restoreIntoView({width: 640, height: 400, devicePixelRatio: 2});

            expect(setZoom).toHaveBeenCalledWith(0.5, true);
        });

        test("fits the whole saved area in a view of another shape, without a report", async () => {
            const {problems, setZoom} = await restoreIntoView({width: 800, height: 400, devicePixelRatio: 1});

            expect(setZoom).toHaveBeenCalledWith(0.8, true);
            expect(problems).toEqual([]);
        });

        test("does not report a browser window of another size, because matching it is optional", async () => {
            const {problems} = await restoreIntoView({width: 640, height: 400, devicePixelRatio: 2, viewport: {width: window.innerWidth + 100, height: window.innerHeight}});

            expect(problems).toEqual([]);
        });

        test("reports a browser window of another size in a window that was opened to match the saved size", async () => {
            createSession();
            const imageView = {width: 640, height: 400, devicePixelRatio: 1, viewport: {width: window.innerWidth + 100, height: window.innerHeight}};
            const workspace = createWorkspace({imageView});

            const problems = (await drive(new WorkspaceRestorer(workspace, WorkspaceRestorer.claimGeneration(), undefined, {checkWindowSize: true}))).map(issue => issue.message);

            expect(problems).toEqual([`This browser window is ${window.innerWidth}×${window.innerHeight}, not ${window.innerWidth + 100}×${window.innerHeight} as when the workspace was saved, so the images may not show exactly as saved`]);
        });

        test("does not report a browser window of the saved size", async () => {
            createSession();
            const workspace = createWorkspace({imageView: {width: 640, height: 400, devicePixelRatio: 1, viewport: {width: window.innerWidth, height: window.innerHeight}}});

            expect(await drive(new WorkspaceRestorer(workspace, WorkspaceRestorer.claimGeneration(), undefined, {checkWindowSize: true}))).toEqual([]);
        });

        test("keeps the saved zoom in a background tab, because the tab does not report the new size", async () => {
            jest.spyOn(document, "hidden", "get").mockReturnValue(true);

            expect((await restoreIntoView({width: 1280, height: 800, devicePixelRatio: 1})).setZoom).not.toHaveBeenCalled();
        });

        test("compares only the heights for an image that is stretched to the shape of the view, such as a PV image", async () => {
            const setZoom = jest.fn();
            frameOverrides = {renderWidth: 500, renderHeight: 500, setZoom, isStretchedToView: true};
            createSession();

            await restore(createWorkspace({imageView: {width: 1000, height: 500, devicePixelRatio: 1}}));

            expect(setZoom).not.toHaveBeenCalled();
        });

        test("scales both axis zooms of a stretched image by the height of the view", async () => {
            const setAxisZoom = jest.fn();
            frameOverrides = {renderWidth: 500, renderHeight: 250, isStretchedToView: true, isAxisZoomable: true, effectiveZoomLevel: {x: 2, y: 4}, setAxisZoom};
            createSession();

            await restore(createWorkspace({imageView: {width: 1000, height: 500, devicePixelRatio: 1}}));

            expect(setAxisZoom).toHaveBeenLastCalledWith(1, 2);
        });

        test("keeps the saved zoom when the image view is closed or behind another tab, because it does not report its new size", async () => {
            const setZoom = jest.fn();
            frameOverrides = {renderWidth: 640, renderHeight: 400, setZoom};
            const {appStore} = createSession();
            appStore.layoutStore.isComponentHidden.mockReturnValue(true);

            await restore(createWorkspace({imageView: {width: 1280, height: 800, devicePixelRatio: 1}}));

            expect(appStore.layoutStore.isComponentHidden).toHaveBeenCalledWith("image-view");
            expect(setZoom).not.toHaveBeenCalled();
        });

        test("uses the device pixel ratio from when the zoom was applied, because the app scales the zoom when the ratio changes later", async () => {
            const setZoom = jest.fn();
            frameOverrides = {renderWidth: 640, renderHeight: 400, setZoom};
            const {appStore} = createSession();
            (appStore as unknown as {devicePixelRatio: number}).devicePixelRatio = 1;
            // The window moves to a screen with a ratio of 2 while the restore waits for the size.
            jest.spyOn(window, "requestAnimationFrame").mockImplementationOnce(callback => {
                (appStore as unknown as {devicePixelRatio: number}).devicePixelRatio = 2;
                return window.setTimeout(() => callback(0), 0);
            });

            await restore(createWorkspace({imageView: {width: 640, height: 400, devicePixelRatio: 1}}));

            expect(setZoom).not.toHaveBeenCalled();
        });

        test("compares with the device pixel ratio of this screen", async () => {
            const {setZoom} = await restoreIntoView({width: 640, height: 400, devicePixelRatio: 1}, {width: 640, height: 400, devicePixelRatio: 2});

            expect(setZoom).toHaveBeenCalledWith(2, true);
        });

        test("scales only the reference image of spatially matched images, because the matched images follow it", async () => {
            const setZoom = jest.fn();
            frameOverrides = {renderWidth: 640, renderHeight: 400, setZoom};
            const {appStore} = createSession();
            appStore.setSpatialMatchingEnabled.mockImplementation((frame: {spatialReference?: unknown}, isEnabled: boolean) => {
                frame.spatialReference = isEnabled ? appStore.spatialReference : undefined;
            });
            const matched = {id: 2, source: {type: "file" as const, filename: "other.fits"}, references: {spatial: 1}};

            await restore(createWorkspace({files: [IMAGE, matched], references: {spatial: 1}, imageView: {width: 1280, height: 800, devicePixelRatio: 1}}));

            const scaledFileIds = setZoom.mock.contexts.map(frame => (frame as {frameInfo: {fileId: number}}).frameInfo.fileId);
            expect(appStore.frames[1].spatialReference).toBe(appStore.frames[0]);
            expect(scaledFileIds).toEqual([appStore.frames[0].frameInfo.fileId]);
        });

        test("leaves the zoom alone when the image view is not shown", async () => {
            expect((await restoreIntoView({width: 1280, height: 800, devicePixelRatio: 1}, {width: 1, height: 1})).setZoom).not.toHaveBeenCalled();
        });

        test("leaves the zoom alone when a newer load supersedes the restore while it waits for the size", async () => {
            const setZoom = jest.fn();
            frameOverrides = {renderWidth: 640, renderHeight: 400, setZoom};
            const {appStore} = createSession();
            // The newer load starts in the first frame that the wait asks for. The layout is applied
            // just before the wait, so a frame asked for earlier would fail this check.
            let hasLayoutBeforeFrame = false;
            jest.spyOn(window, "requestAnimationFrame").mockImplementationOnce(callback => {
                hasLayoutBeforeFrame = appStore.layoutStore.applyLayoutConfig.mock.calls.length > 0;
                WorkspaceRestorer.claimGeneration();
                return window.setTimeout(() => callback(0), 0);
            });

            await restore(createWorkspace({layout: LAYOUT, imageView: {width: 1280, height: 800, devicePixelRatio: 1}}));

            expect(hasLayoutBeforeFrame).toBe(true);
            expect(setZoom).not.toHaveBeenCalled();
        });

        test("keeps the saved zoom in a view of the same size, and for a workspace saved without the size", async () => {
            expect((await restoreIntoView({width: 640, height: 400, devicePixelRatio: 1})).setZoom).not.toHaveBeenCalled();
            expect((await restoreIntoView(undefined)).setZoom).not.toHaveBeenCalled();
        });
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

    test("names the saved image that a widget showed when the widget shows the active image instead", async () => {
        const {appStore} = createSession();
        const widgetIssue = (widgetId: string, effect: WorkspaceIssueEffect) => ({kind: WorkspaceItemKind.PlotWidget, subject: widgetId, message: widgetId, reason: widgetId, effect});
        appStore.widgetsStore.restorePlotWidgetBindings.mockReturnValue([
            widgetIssue("stats-0", WorkspaceIssueEffect.ActiveImage),
            widgetIssue("render-config-0", WorkspaceIssueEffect.ActiveImage),
            widgetIssue("histogram-0", WorkspaceIssueEffect.ActiveRegion)
        ]);
        appStore.widgetsStore.restorePlotWidgets.mockReturnValue([{kind: WorkspaceItemKind.PlotWidget, subject: "spectral-profiler-0", message: "spectral-profiler-0", reason: SOME_IMAGES_NOT_RESTORED}]);

        const issues = await restoreIssues(
            createWorkspace({
                selectedFile: 1,
                plotWidgets: {
                    "stats-0": {type: "stats", imageId: 5},
                    "render-config-0": {type: "render-config"},
                    "histogram-0": {type: "histogram", imageId: 1},
                    "spectral-profiler-0": {type: "spectral-profiler", imageId: 1, imageIds: [1, 6, 7]}
                }
            })
        );

        // A widget that saved no image followed the image in front, and it still follows the active
        // image. A missing region names no image. A profiler names the first image that is missing.
        expect(issues.map(issue => [issue.subject, issue.effect, issue.causeImageId])).toEqual([
            ["stats-0", WorkspaceIssueEffect.ActiveImage, 5],
            ["render-config-0", WorkspaceIssueEffect.ActiveImageFollowed, 1],
            ["histogram-0", WorkspaceIssueEffect.ActiveRegion, undefined],
            ["spectral-profiler-0", undefined, 6]
        ]);
    });

    test("reports an invalid embedded layout the layout store could not apply", async () => {
        const {appStore} = createSession();
        appStore.layoutStore.applyLayoutConfig.mockReturnValue(false);
        const invalidLayout = {...LAYOUT, docked: {type: "row", content: []}};

        expect(await restore(createWorkspace({layout: invalidLayout}))).toEqual(["Could not restore the layout the workspace was saved in"]);
        expect(appStore.layoutStore.applyLayoutConfig).toHaveBeenCalledWith(invalidLayout, "", "workspace", []);
    });

    test("reports each problem of the WCS overlay that the layout copy could not apply as a layout issue", async () => {
        const {appStore} = createSession();
        appStore.layoutStore.layoutProblems = ["Showed the WCS overlay in automatic coordinates instead of image coordinates, because the images are matched spatially"];

        expect(await restoreIssues(createWorkspace({layout: LAYOUT}))).toEqual([
            {kind: WorkspaceItemKind.Layout, subject: "", message: "Showed the WCS overlay in automatic coordinates instead of image coordinates, because the images are matched spatially", outcome: undefined}
        ]);
    });

    test("applies the custom texts of the WCS overlay, the custom title and colorbar label of each image, and the name and custom title of each color-blended image", async () => {
        const setTitleCustomText = jest.fn();
        const setColorbarLabelCustomText = jest.fn();
        frameOverrides = {setTitleCustomText, setColorbarLabelCustomText};
        const {appStore} = createSession();
        const colorBlending = {selectedFrames: [], frames: [], deleteSelectedFrame: jest.fn(), setAlpha: jest.fn(), addSelectedFrame: jest.fn(), setTitleCustomText: jest.fn(), setName: jest.fn()};
        appStore.imageViewConfigStore.createColorBlending.mockReturnValue(colorBlending);
        const wcsOverlay = {labels: {hasCustomText: true, customLabelX: "RA", customLabelY: "Dec"}, title: {hasCustomText: true}, colorbar: {hasLabelCustomText: true}};

        await restore(
            createWorkspace({
                files: [
                    {...IMAGE, titleCustomText: "M51", colorbarLabelCustomText: "flux"},
                    {...IMAGE, id: 2, source: {type: "file", filename: "second.fits"}}
                ],
                colorBlendingImages: [{name: "Color Blending 1", imageListIndex: 2, selectedFrameId: [2], alpha: [1, 1], titleCustomText: "RGB"}],
                wcsOverlay
            })
        );

        expect(appStore.overlaySettings.applyTextConfig).toHaveBeenCalledWith(wcsOverlay);
        // Both images share the mocks, so only the first image sets a text.
        expect(setTitleCustomText.mock.calls).toEqual([["M51"]]);
        expect(setColorbarLabelCustomText.mock.calls).toEqual([["flux"]]);
        expect(colorBlending.setName).toHaveBeenCalledWith("Color Blending 1");
        expect(colorBlending.setTitleCustomText).toHaveBeenCalledWith("RGB");
    });

    test("applies no layout, and sets the custom texts of the WCS overlay back to the defaults, when the workspace saved neither, as a workspace of CARTA 6", async () => {
        const {appStore} = createSession();

        await restore(createWorkspace({files: [IMAGE]}));

        expect(appStore.layoutStore.applyLayoutConfig).not.toHaveBeenCalled();
        expect(appStore.overlaySettings.applyTextConfig).toHaveBeenCalledWith(undefined);
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
        const viewIssue = {kind: WorkspaceItemKind.PlotWidget, subject: "stats-0", message: "Could not fully restore the widget stats-0: the fitting guesses were made in other units"};
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
            return [viewIssue];
        });
        appStore.widgetsStore.nameRestoredWidgetTabs.mockImplementationOnce(() => {
            calls.push("nameRestoredWidgetTabs");
        });
        const queryIssue = {kind: WorkspaceItemKind.PlotWidget, subject: "spectral-line-query-0", message: "Could not fully restore the widget spectral-line-query-0: the spectral line query returned no result"};
        appStore.widgetsStore.restorePlotWidgetResults.mockImplementationOnce(() => {
            calls.push("restorePlotWidgetResults");
            return Promise.resolve([queryIssue]);
        });

        const restorer = new WorkspaceRestorer(createWorkspace({layout: LAYOUT, plotWidgets}), WorkspaceRestorer.claimGeneration());
        const generator = restorer.restore();
        let step = generator.next();
        while (!step.done) {
            step = generator.next(await step.value);
        }
        // The last step reports what it could not apply, such as fitting guesses in other units.
        expect(step.value).toContainEqual(viewIssue);
        expect(appStore.widgetsStore.restorePlotWidgetViews).toHaveBeenCalledWith(plotWidgets, restorer);

        // The results of online queries are fetched again last, and their problems are reported.
        // The tabs are named after what the widgets show, also the tabs that are not mounted.
        expect(calls.filter(call => call.startsWith("applyLayout") || call.startsWith("restorePlot") || call === "nameRestoredWidgetTabs")).toEqual([
            "applyLayout",
            "restorePlotWidgetBindings",
            "restorePlotWidgets",
            "restorePlotWidgetViews",
            "nameRestoredWidgetTabs",
            "restorePlotWidgetResults"
        ]);
        expect(step.value).toContainEqual(queryIssue);
        expect(didSettleBeforeTheRest).toBe(true);
        expect(appStore.widgetsStore.restorePlotWidgets).toHaveBeenCalledWith(plotWidgets, restorer);
        expect(restorer.fileIdOf(1)).toBe(appStore.frames[0].frameInfo.fileId);
    });

    test("waits for the results of the widgets as a step that the user can skip, and says when the wait is long", async () => {
        jest.useFakeTimers();
        try {
            const {appStore} = createSession();
            let isWanted: (() => boolean) | undefined;
            appStore.widgetsStore.restorePlotWidgetResults.mockImplementationOnce((_plotWidgets?: unknown, wanted?: () => boolean) => {
                isWanted = wanted;
                // A query that does not answer.
                return new Promise<unknown[]>(() => undefined);
            });
            const steps: (WorkspaceLoadingStep | undefined)[] = [];
            appStore.setWorkspaceLoadingStep.mockImplementation((step?: WorkspaceLoadingStep) => {
                steps.push(step);
            });

            const restored = restore(createWorkspace({layout: LAYOUT}));
            await jest.advanceTimersByTimeAsync(0);
            expect(steps.at(-1)).toEqual({description: "Restoring the results of the widgets, such as a spectral line query", progress: 0, onSkip: expect.any(Function)});
            expect(isWanted?.()).toBe(true);

            await jest.advanceTimersByTimeAsync(WorkspaceRestorer.SLOW_WIDGET_RESULTS_MS);
            expect(steps.at(-1)?.description).toBe("Restoring the results of the widgets, such as a spectral line query takes long. Wait, or skip it to restore the rest of the workspace");

            steps.at(-1)?.onSkip?.();
            const issues = await restored;
            expect(isWanted?.()).toBe(false);
            expect(issues).toContain("Skipped waiting for the results of the widgets, such as a spectral line query or a PV preview. A result that still comes shows without its saved settings");
        } finally {
            jest.useRealTimers();
        }
    });

    test("reports what the catalog widgets could not be pointed at", async () => {
        const {appStore} = createSession();
        const issue = {kind: WorkspaceItemKind.CatalogWidget, subject: "catalog-overlay-0", message: "Could not restore catalog widget catalog-overlay-0"};
        appStore.catalogStore.widgetBindings.restore.mockReturnValue([issue]);

        const problems = await restore(createWorkspace({catalogs: [CATALOG], catalogWidgets: {"catalog-overlay-0": {type: "catalog-overlay", catalogId: 7}}}));

        expect(problems).toContain(issue.message);
    });

    test("says what kind of thing each report is about, which one, and whether it was left out", async () => {
        const {appStore} = createSession();
        appStore.appendFile = jest.fn(() => Promise.resolve(undefined));
        appStore.layoutStore.applyLayoutConfig.mockReturnValue(false);

        const issues = await restoreIssues(createWorkspace({catalogs: [CATALOG], layout: {...LAYOUT, docked: {type: "row", content: []}}}));

        // The session skips each item that Recovery offers. The catalog goes with its image.
        // The image issue names the saved image that it leaves out. The catalog issue names that image as its cause.
        expect(issues).toContainEqual({
            kind: WorkspaceItemKind.Image,
            subject: "image.fits",
            message: "Could not open the image image.fits",
            outcome: WorkspaceIssueOutcome.Skipped,
            label: "The image image.fits",
            imageIds: [IMAGE.id]
        });
        expect(issues).toContainEqual({
            kind: WorkspaceItemKind.Catalog,
            subject: "sources.vot",
            message: "Skipped the catalog sources.vot: the image it belongs to was skipped",
            outcome: WorkspaceIssueOutcome.Skipped,
            label: "The catalog sources.vot",
            reason: "the image it belongs to was skipped",
            causeImageId: IMAGE.id,
            catalogIds: [CATALOG.id]
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

        test("sets the center of offset coordinates saved as turned off, and leaves them off", async () => {
            const {appStore} = createSession();

            const problems = await restore(createWorkspace({files: [{...IMAGE, offsetCoordinates: {...savedSettings.offsetCoordinates, shown: false}}]}));

            const frame = appStore.frames[0];
            expect(problems).toEqual([]);
            expect(frame.setOffsetCenter).toHaveBeenCalledWith(5, 6);
            expect(frame.setSkyRefIs).toHaveBeenCalledWith(1);
            expect(frame.toggleOffsetCoord).not.toHaveBeenCalled();
        });

        test("does not report offset coordinates saved as turned off that the image no longer supports", async () => {
            frameOverrides = {isPVImage: true};
            createSession();

            const problems = await restore(createWorkspace({files: [{...IMAGE, offsetCoordinates: {...savedSettings.offsetCoordinates, shown: false}}]}));

            expect(problems).toEqual([]);
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

    test("applies the saved preferences for the session before it opens the images, without a report", async () => {
        const {appStore} = createSession();
        const preferences = {regionColor: "#00ff00"} as never;

        const problems = await restore(createWorkspace({preferences}));

        expect(appStore.preferenceStore.applySessionPreferences).toHaveBeenCalledWith(preferences);
        expect(appStore.preferenceStore.applySessionPreferences.mock.invocationCallOrder[0]).toBeLessThan(appStore.appendFile.mock.invocationCallOrder[0]);
        expect(problems).toEqual([]);
    });

    test("clears the preferences of a previous workspace for a workspace that saved none, and reports the saved preferences that it cannot apply", async () => {
        const {appStore} = createSession();
        appStore.preferenceStore.applySessionPreferences.mockReturnValueOnce({rejectedKeys: ["theme", "newKey"]});

        const problems = await restore(createWorkspace());

        expect(appStore.preferenceStore.applySessionPreferences).toHaveBeenCalledWith(undefined);
        expect(problems).toContain("Could not apply 2 preferences (theme, newKey) for this session: this version does not know the preference or does not accept the saved value. Your own value is used");
    });

    test("keeps the spectral matching type of the session when the saved one is not valid, and says so", async () => {
        const {appStore} = createSession();

        const problems = await restore(createWorkspace({spectralMatchingType: "SPEED" as never}));

        expect(appStore.setSpectralMatchingType).not.toHaveBeenCalled();
        expect(problems).toEqual(["Could not restore the spectral matching type SPEED: it is not one this version knows, so images are matched by VRAD"]);
    });

    describe("the regions of an image", () => {
        const region = (id: number) => ({id, name: `Region ${id}`, points: [{x: id, y: 0}], rotation: 0, type: 3});

        test("maps each region's saved ID to the one the backend gave it", async () => {
            createSession();

            const restorer = await restored(createWorkspace({files: [{...IMAGE, regionsSet: {regions: [region(1), region(2)]}}]}));

            expect(restorer.regionIdOf(1, 1)).toBe(101);
            expect(restorer.regionIdOf(1, 2)).toBe(102);
        });

        test("leaves out the styles that the workspace did not save, so that each region gets the default of its type", async () => {
            const {appStore} = createSession();
            const styled = {...region(2), color: "#ff0000", lineWidth: 3, dashes: [4]};

            await restore(createWorkspace({files: [{...IMAGE, regionsSet: {regions: [region(1), styled]}}]}));

            const styles = appStore.frames[0].regionSet.addExistingRegionAsync.mock.calls.map(call => (call as unknown[]).slice(4, 7));
            expect(styles).toEqual([
                [undefined, undefined, undefined],
                ["#ff0000", 3, [4]]
            ]);
        });

        test("moves a saved line width into the range of the Region dialog, and reports it", async () => {
            const {appStore} = createSession();
            const widths = [0, 0.5, 10, 50];

            const problems = await restore(createWorkspace({files: [{...IMAGE, regionsSet: {regions: widths.map((lineWidth, index) => ({...region(index + 1), lineWidth}))}}]}));

            expect(appStore.frames[0].regionSet.addExistingRegionAsync.mock.calls.map(call => (call as unknown[])[5])).toEqual([0.5, 0.5, 10, 10]);
            expect(problems).toEqual([
                "The line width of the region Region 1 of image.fits is 0.5, because the saved width 0 is not between 0.5 and 10",
                "The line width of the region Region 4 of image.fits is 10, because the saved width 50 is not between 0.5 and 10"
            ]);
        });

        test("asks the backend for each region's saved ID, so that its name stays the same", async () => {
            const {appStore} = createSession();
            const second = {id: 2, source: {type: "file" as const, filename: "second.fits"}};
            const generated = {request: {type: "other"} as never, images: [{id: 3, regionsSet: {regions: [region(9)]}}]};

            await restore(
                createWorkspace({
                    files: [
                        {...IMAGE, regionsSet: {regions: [region(2), region(2), region(0), region(2 ** 31)]}},
                        {...second, regionsSet: {regions: [region(3)]}}
                    ],
                    generatedImages: [generated]
                })
            );

            const requestedIds = appStore.frames.map(frame => frame.regionSet.addExistingRegionAsync.mock.calls.map(call => (call as unknown[])[8]));
            // A repeated or invalid ID gets a new ID above every saved ID, also those of generated images.
            expect(requestedIds.slice(0, 2)).toEqual([[2, 10, 11, 12], [3]]);
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

        test("leaves out and reports a region that the backend does not accept, so that its saved ID points at no region", async () => {
            createSession();
            RegisterRegion.mockImplementationOnce(() => Promise.resolve(undefined));

            const workspace = createWorkspace({files: [{...IMAGE, regionsSet: {regions: [region(1), region(2)]}}]});
            const restorer = await restored(workspace);

            expect(restorer.regionIdOf(1, 1)).toBeUndefined();
            expect(restorer.regionIdOf(1, 2)).toBe(102);
            RegisterRegion.mockImplementationOnce(() => Promise.resolve(undefined));
            expect(await restore(workspace)).toContain("Could not restore the region Region 1 of image.fits: the backend did not accept it");
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

        test("shows each region in the Region dialog in its saved coordinates, and world coordinates only on an image with a WCS", async () => {
            const {appStore} = createSession();
            const workspace = createWorkspace({files: [{...IMAGE, regionsSet: {regions: [{...region(1), coordinate: "Image" as never}, {...region(2), coordinate: "World" as never}, region(3)]}}]});

            await restore(workspace);
            const regionsOf = async () => (await Promise.all(appStore.frames[0].regionSet.addExistingRegionAsync.mock.results.map(result => result.value))) as {setCoordinate: jest.Mock}[];
            expect((await regionsOf()).map(restoredRegion => restoredRegion.setCoordinate.mock.calls)).toEqual([[["Image"]], [], []]);

            appStore.appendFile.mockImplementationOnce(() => {
                const frame = {...createFrame(9), isValidWcs: true};
                appStore.frameMap.set(9, frame as never);
                appStore.frames = [frame as never];
                return Promise.resolve(frame as never);
            });
            await restore(workspace);
            expect((await regionsOf()).map(restoredRegion => restoredRegion.setCoordinate.mock.calls)).toEqual([[["Image"]], [["World"]], []]);
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

    describe("the image fitting", () => {
        const savedRegion = {id: 5, type: 3, rotation: 0, points: []};
        const imageFitting = {
            imageId: 1,
            regionId: 5,
            components: [{center: {x: 1, y: 2}, amp: 3, fwhm: {x: 4, y: 5}, pa: 6, fixed: [true, false, false, false, false, false]}],
            autoInitialValues: false,
            backgroundOffset: 0.1,
            backgroundOffsetFixed: false,
            solver: CARTA.FittingSolverType.Qr,
            createModelImage: true,
            createResidualImage: false
        };

        test("shows the fit result of an image again, and applies the dialog settings over the ID the backend gave the region", async () => {
            const {appStore} = createSession();
            const fitResult = {result: "Component #1", log: "the log", ellipses: [{center: {x: 1, y: 2}, size: {x: 2, y: 2.5}, rotation: 6}]};

            const problems = await restore(createWorkspace({files: [{...IMAGE, regionsSet: {regions: [savedRegion]}, fitResult}], imageFitting}));

            const frame = appStore.frames[0];
            expect(problems).toEqual([]);
            expect(frame.setFittingResult).toHaveBeenCalledWith("Component #1");
            expect(frame.setFittingLog).toHaveBeenCalledWith("the log");
            expect(frame.setFittingResultRegionParams).toHaveBeenCalledWith([
                {
                    points: [
                        {x: 1, y: 2},
                        {x: 2, y: 2.5}
                    ],
                    rotation: 6
                }
            ]);
            expect(appStore.imageFittingStore.applyWorkspaceConfig).toHaveBeenCalledWith(imageFitting, frame.frameInfo.fileId, 105);
        });

        test("fits the field of view of the active image when the image it fitted was not restored, and says so", async () => {
            const {appStore} = createSession();

            const issues = await restoreIssues(createWorkspace({imageFitting: {...imageFitting, imageId: 9}}));

            expect(issues).toEqual([
                expect.objectContaining({
                    kind: WorkspaceItemKind.Dialog,
                    message: "The Image Fitting dialog: the image it fits was not restored, so it fits the active image",
                    causeImageId: 9
                })
            ]);
            expect(appStore.imageFittingStore.applyWorkspaceConfig).toHaveBeenCalledWith(expect.anything(), ACTIVE_FILE_ID, 0);
        });

        test("fits the field of view when the region it fitted was not restored, and says so", async () => {
            const {appStore} = createSession();

            const problems = await restore(createWorkspace({imageFitting}));

            expect(problems).toEqual(["The Image Fitting dialog: the region it fits was not restored, so it fits the field of view"]);
            expect(appStore.imageFittingStore.applyWorkspaceConfig).toHaveBeenCalledWith(expect.anything(), appStore.frames[0].frameInfo.fileId, 0);
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
            expect(appStore.setWorkspaceLoadingStep).toHaveBeenCalledWith({description: "Computing the cube histogram of image.fits", progress: 0.5, onSkip: expect.any(Function)});
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
                if (step?.description === "Computing the cube histogram of image.fits" && step.progress > 0) {
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
                requestMoment: jest.fn((message: CARTA.MomentRequest.$Properties, _frame?: unknown, _options?: {isStillWanted?: () => boolean}) => momentsMade ?? Promise.resolve((message.moments ?? []).map(moment => addFrame({moment})))),
                cancelRequestingMoment: jest.fn(),
                statsRequirementsOf: jest.fn((_fileId: number, _regionId: number) => undefined),
                requestPV: jest.fn((_message: CARTA.PvRequest.$Properties, _frame: unknown, _shouldKeep: boolean) => Promise.resolve(addFrame({}))),
                cancelRequestingPV: jest.fn(),
                loadRemoteFile: jest.fn((_query: CARTA.RemoteFileRequest.$Properties) => Promise.resolve(addFrame({}))),
                requestFitting: jest.fn((message: CARTA.FittingRequest.$Properties, _isStillWanted?: () => boolean) =>
                    Promise.resolve([...(message.createModelImage ? [addFrame({fittingImage: "model"})] : []), ...(message.createResidualImage ? [addFrame({fittingImage: "residual"})] : [])])
                ),
                imageFittingStore: {setIsFitting: jest.fn(), setIsCancelling: jest.fn(), progress: 0.3, applyWorkspaceConfig: jest.fn(), resetSettings: jest.fn()},
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

            expect(requestMoment).toHaveBeenCalledWith(expect.objectContaining({fileId: 1, regionId: 105, moments: momentRequest.moments, spectralRange: {min: 2, max: 8}, keep: false}), appStore.frames[0], {
                isStillWanted: expect.any(Function)
            });
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

        test("applies the channels that the animator plays of a generated image", async () => {
            const {appStore, requestMoment} = createGeneratingSession();
            requestMoment.mockImplementationOnce(() => {
                const frame = {...createFrame(201), frameInfo: {fileId: 201, fileInfoExtended: {depth: 10}}, generation: {moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}, setAnimationRange: jest.fn()};
                (appStore.frameMap as Map<number, unknown>).set(201, frame);
                appStore.frames.push(frame as never);
                return Promise.resolve([frame]);
            });

            const restorer = await restored(
                createWorkspace({
                    files: [{...IMAGE, regionsSet: {regions: [savedRegion]}}],
                    generatedImages: [{request: {...momentRequest, moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM]}, images: [{id: 2, moment: CARTA.Moment.MAX_OF_THE_SPECTRUM, animationChannelRange: [1, 3]}]}]
                })
            );

            const generated = appStore.frames.find(frame => frame.frameInfo.fileId === restorer.fileIdOf(2)) as any;
            expect(generated.setAnimationRange).toHaveBeenCalledWith([1, 3]);
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

            test("is made again over the shape that its region had when it was fitted, when the region was changed after", async () => {
                const {appStore, requestFitting} = createGeneratingSession();
                const fittedOver = {
                    regionType: CARTA.RegionType.RECTANGLE,
                    controlPoints: [
                        {x: 50, y: 50},
                        {x: 20, y: 20}
                    ],
                    rotation: 0
                };
                frameOverrides = {...frameOverrides, getRegion: (regionId: number) => (regionId === 105 ? {...fittedOver, rotation: 30} : undefined)};
                const backendService = {
                    ...(appStore as unknown as {backendService: object}).backendService,
                    setRegion: jest.fn((_fileId: number, _regionId: number, _region: unknown) => Promise.resolve({success: true, regionId: 500})),
                    removeRegion: jest.fn((_regionId: number) => true)
                };
                Object.assign(appStore, {backendService});
                requestFitting.mockImplementation(() => {
                    const frame = {...createFrame(300), generation: {request: {type: "fitting", regionId: 500}, fittingImage: "residual"}};
                    (appStore.frameMap as Map<number, unknown>).set(300, frame);
                    appStore.frames.push(frame as never);
                    return Promise.resolve([frame] as never);
                });

                await restored(
                    createWorkspace({
                        files: [{...IMAGE, regionsSet: {regions: [savedRegion]}}],
                        generatedImages: [{request: {...fittingRequest, regionShape: fittedOver}, images: [{id: 2, name: "image_residual.fits", fittingImage: "residual"}]}]
                    })
                );

                expect(backendService.setRegion).toHaveBeenCalledWith(1, -1, fittedOver);
                expect(requestFitting).toHaveBeenCalledWith(expect.objectContaining({regionId: 500}), expect.any(Function));
                expect(backendService.removeRegion).toHaveBeenCalledWith(500);
                expect((appStore.frames.find(frame => frame.frameInfo.fileId === 300) as any).generation.request).toEqual(expect.objectContaining({regionId: 105, regionShape: fittedOver}));
            });

            test("says why the fit failed", async () => {
                const {requestFitting} = createGeneratingSession();
                requestFitting.mockImplementation(() => Promise.reject(new Error("fit did not converge")));

                const problems = await restore(createWorkspace({generatedImages: [{request: {...fittingRequest, regionId: RegionId.IMAGE}, images: [{id: 2, fittingImage: "model"}]}]}));

                expect(problems).toEqual(["Could not make the image fitting images of image.fits: fit did not converge"]);
            });

            test("is reported, and not made, when it is not one this version can make", async () => {
                const {requestFitting} = createGeneratingSession();

                const problems = await restore(createWorkspace({generatedImages: [{request: {...fittingRequest, regionId: RegionId.IMAGE, fixedParams: [false]}, images: [{id: 2, fittingImage: "model"}]}]}));

                expect(requestFitting).not.toHaveBeenCalled();
                expect(problems).toEqual(["Could not make the image fitting images of image.fits: the request is not one this version can make"]);
            });
        });

        test("makes moment images over the shape that their region had when they were made, when the region was changed after", async () => {
            const {requestMoment, backend} = createGeneratingSession();
            const madeOver = {
                regionType: CARTA.RegionType.RECTANGLE,
                controlPoints: [
                    {x: 50, y: 50},
                    {x: 20, y: 20}
                ],
                rotation: 0
            };
            frameOverrides = {...frameOverrides, getRegion: (regionId: number) => (regionId === 105 ? {...madeOver, rotation: 30} : undefined)};
            const appStore = AppStore.Instance as unknown as {backendService: object};
            const backendService = {
                ...appStore.backendService,
                setRegion: jest.fn((_fileId: number, _regionId: number, _region: unknown) => Promise.resolve({success: true, regionId: 500})),
                removeRegion: jest.fn((_regionId: number) => true)
            };
            Object.assign(appStore, {backendService});

            await restored(createWorkspace({files: [{...IMAGE, regionsSet: {regions: [savedRegion]}}], generatedImages: [{request: {...momentRequest, regionShape: madeOver}, images: [{id: 2, moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}]}]}));

            expect(backendService.setRegion).toHaveBeenCalledWith(1, -1, madeOver);
            // The backend keeps the data of the region before the moments are asked for over it.
            expect(backend.setStatsRequirements.mock.calls[0][0]).toEqual(expect.objectContaining({fileId: 1, regionId: 500}));
            expect(requestMoment).toHaveBeenCalledWith(expect.objectContaining({regionId: 500}), expect.anything(), expect.anything());
            expect(backendService.removeRegion).toHaveBeenCalledWith(500);
        });

        describe("a PV image", () => {
            const savedLine = {id: 6, type: CARTA.RegionType.LINE, rotation: 0, points: []};
            const pvRequest = {type: "pv" as const, sourceImageId: 1, regionId: 6, width: 3, channelRange: {min: 2, max: 8}, reverse: false};

            /** Restores a PV image along a line that the session has at these points, on an image of 100 x 100 pixels. */
            async function restorePvAlong(controlPoints: {x: number; y: number}[]) {
                const session = createGeneratingSession();
                frameOverrides = {...frameOverrides, numChannels: 10, getRegion: (regionId: number) => (regionId === 106 ? {regionType: CARTA.RegionType.LINE, controlPoints} : undefined)};
                session.appStore.onRecovery = jest.fn((recovery: WorkspaceRecoveryStore) => recovery.skipAll());
                const issues = await restoreIssues(createWorkspace({files: [{...IMAGE, regionsSet: {regions: [savedLine]}}], generatedImages: [{request: pvRequest, images: [{id: 2, name: "image_pv.fits"}]}]}));
                return {...session, issues};
            }

            test("is made again along a line that crosses the image", async () => {
                const {appStore, requestPV, issues} = await restorePvAlong([
                    {x: 10, y: 10},
                    {x: 90, y: 90}
                ]);

                expect(issues).toEqual([]);
                expect(requestPV).toHaveBeenCalledTimes(1);
                expect(requestPV.mock.calls[0].slice(0, 3)).toEqual([expect.objectContaining({fileId: 1, regionId: 106, width: 3, spectralRange: {min: 2, max: 8}}), appStore.frames[0], true]);
            });

            describe("whose line was changed or deleted after the PV image was made", () => {
                const madeAlong = {
                    regionType: CARTA.RegionType.LINE,
                    controlPoints: [
                        {x: 10, y: 10},
                        {x: 90, y: 90}
                    ],
                    rotation: 45
                };
                const movedLine = {
                    regionType: CARTA.RegionType.LINE,
                    controlPoints: [
                        {x: 10, y: 90},
                        {x: 90, y: 10}
                    ],
                    rotation: 135
                };

                /** Restores a PV image made along `madeAlong`, when the session has the line `sessionLine` as region 106. */
                async function restorePvMadeAlong(sessionLine: typeof madeAlong | undefined, setRegionAcks: unknown[] = [{success: true, regionId: 500}], onRecovery?: (recovery: WorkspaceRecoveryStore) => void) {
                    const session = createGeneratingSession();
                    const backendService = {
                        ...(session.appStore as unknown as {backendService: object}).backendService,
                        setRegion: jest.fn((_fileId: number, _regionId: number, _region: unknown) => Promise.resolve(setRegionAcks.length > 1 ? setRegionAcks.shift() : setRegionAcks[0])),
                        removeRegion: jest.fn((_regionId: number) => true)
                    };
                    Object.assign(session.appStore, {backendService, ...(onRecovery ? {onRecovery} : {})});
                    const made: {generation?: {request: {type: string; regionId: number; regionShape?: unknown}}}[] = [];
                    session.requestPV.mockImplementation((message: CARTA.PvRequest.$Properties) => {
                        const frame = {...createFrame(200), generation: {request: {type: "pv", regionId: message.regionId ?? NaN}}};
                        made.push(frame);
                        (session.appStore.frameMap as Map<number, unknown>).set(200, frame);
                        session.appStore.frames.push(frame as never);
                        return Promise.resolve(frame as never);
                    });
                    frameOverrides = {...frameOverrides, numChannels: 10, getRegion: (regionId: number) => (regionId === 106 ? sessionLine : undefined)};
                    const files = sessionLine ? [{...IMAGE, regionsSet: {regions: [savedLine]}}] : [IMAGE];
                    const issues = await restoreIssues(createWorkspace({files, generatedImages: [{request: {...pvRequest, regionShape: madeAlong}, images: [{id: 2, name: "image_pv.fits"}]}]}));
                    return {...session, backendService, made, issues};
                }

                test("is made along the line it was made along when the line has not changed", async () => {
                    const {requestPV, backendService, issues} = await restorePvMadeAlong(madeAlong);

                    expect(issues).toEqual([]);
                    expect(backendService.setRegion).not.toHaveBeenCalled();
                    expect(requestPV.mock.calls[0][0]).toEqual(expect.objectContaining({regionId: 106}));
                });

                test("is made along the line it was made along, over a region that only the backend knows and that is removed after", async () => {
                    const {requestPV, backendService, made, issues} = await restorePvMadeAlong(movedLine);

                    expect(issues).toEqual([]);
                    expect(backendService.setRegion).toHaveBeenCalledWith(1, -1, madeAlong);
                    expect(requestPV.mock.calls[0][0]).toEqual(expect.objectContaining({regionId: 500}));
                    expect(backendService.removeRegion).toHaveBeenCalledWith(500);
                    // A later save names the line of the workspace, and keeps the line it was made along.
                    expect(made[0].generation?.request).toEqual(expect.objectContaining({regionId: 106, regionShape: madeAlong}));
                });

                test("is made along the line it was made along when the line was deleted", async () => {
                    const {requestPV, backendService, issues} = await restorePvMadeAlong(undefined);

                    expect(issues).toEqual([]);
                    expect(requestPV.mock.calls[0][0]).toEqual(expect.objectContaining({regionId: 500}));
                    expect(backendService.removeRegion).toHaveBeenCalledWith(500);
                });

                test("is made along a line of the image that its image is matched to, when the shape does not name the image it is in", async () => {
                    const session = createGeneratingSession();
                    const backendService = {
                        ...(session.appStore as unknown as {backendService: object}).backendService,
                        setRegion: jest.fn((_fileId: number, _regionId: number, _region: unknown) => Promise.resolve({success: true, regionId: 500})),
                        removeRegion: jest.fn((_regionId: number) => true)
                    };
                    Object.assign(session.appStore, {backendService});
                    frameOverrides = {...frameOverrides, numChannels: 10, getRegion: (regionId: number) => (regionId === 106 ? movedLine : undefined)};
                    const matched = {id: 3, source: {type: "file" as const, filename: "matched.fits"}, references: {spatial: 1}};

                    const issues = await restoreIssues(
                        createWorkspace({
                            files: [{...IMAGE, regionsSet: {regions: [savedLine]}}, matched],
                            generatedImages: [{request: {...pvRequest, sourceImageId: 3, regionShape: madeAlong}, images: [{id: 2, name: "matched_pv.fits"}]}]
                        })
                    );

                    expect(issues).toEqual([]);
                    // The line belongs to image 1, so the backend gets it on image 1, and the PV image is made of image 3.
                    const [imageOne, imageThree] = session.appStore.frames;
                    expect(backendService.setRegion).toHaveBeenCalledWith(imageOne.frameInfo.fileId, -1, madeAlong);
                    expect(session.requestPV.mock.calls[0][0]).toEqual(expect.objectContaining({fileId: imageThree.frameInfo.fileId, regionId: 500}));
                    expect(imageThree.frameInfo.fileId).not.toBe(imageOne.frameInfo.fileId);
                });

                test.each([
                    ["made before its image was matched", {references: {spatial: 1}}, 3],
                    ["made while its image was matched, and saved after the matching ended", {}, 1]
                ])("is made along the line it was made along, on the image the line belonged to then, when it was %s", async (_name, matching, shapeImageId) => {
                    const session = createGeneratingSession();
                    const backendService = {
                        ...(session.appStore as unknown as {backendService: object}).backendService,
                        setRegion: jest.fn((_fileId: number, _regionId: number, _region: unknown) => Promise.resolve({success: true, regionId: 500})),
                        removeRegion: jest.fn((_regionId: number) => true)
                    };
                    Object.assign(session.appStore, {backendService});
                    // The line of the workspace has the same shape. It belongs to another image, so it is another line.
                    frameOverrides = {...frameOverrides, numChannels: 10, getRegion: (regionId: number) => (regionId === 106 ? madeAlong : undefined)};
                    const source = {id: 3, source: {type: "file" as const, filename: "source.fits"}, regionsSet: {regions: [savedLine]}, ...matching};

                    const issues = await restoreIssues(
                        createWorkspace({
                            files: [{...IMAGE, regionsSet: {regions: [savedLine]}}, source],
                            generatedImages: [{request: {...pvRequest, sourceImageId: 3, regionShape: {...madeAlong, imageId: shapeImageId}}, images: [{id: 2, name: "source_pv.fits"}]}]
                        })
                    );

                    expect(issues).toEqual([]);
                    const [imageOne, imageThree] = session.appStore.frames;
                    expect(backendService.setRegion).toHaveBeenCalledWith((shapeImageId === 1 ? imageOne : imageThree).frameInfo.fileId, -1, {...madeAlong, imageId: shapeImageId});
                    expect(session.requestPV.mock.calls[0][0]).toEqual(expect.objectContaining({fileId: imageThree.frameInfo.fileId, regionId: 500}));
                });

                test("is offered again in Recovery when the backend does not add the line it was made along, and is made when the user retries", async () => {
                    const items: unknown[] = [];
                    const onRecovery = (recovery: WorkspaceRecoveryStore) => {
                        items.push(...recovery.items);
                        recovery.setChoice(0, {action: WorkspaceRecoveryAction.Retry});
                        recovery.continue();
                    };
                    const {requestPV, backendService, issues} = await restorePvMadeAlong(
                        movedLine,
                        [
                            {success: false, message: "no region"},
                            {success: true, regionId: 500}
                        ],
                        onRecovery
                    );

                    expect(items).toEqual([expect.objectContaining({message: "Could not make the PV image of image.fits: the shape of the region it was made over could not be set up (no region)", canRetry: true})]);
                    expect(issues).toEqual([]);
                    expect(backendService.setRegion).toHaveBeenCalledTimes(2);
                    expect(requestPV).toHaveBeenCalledTimes(1);
                    expect(backendService.removeRegion).toHaveBeenCalledTimes(1);
                });
            });

            test("is reported as failed, and not offered in Recovery, when its line does not cross the image", async () => {
                const {appStore, requestPV, issues} = await restorePvAlong([
                    {x: 110, y: 10},
                    {x: 150, y: 90}
                ]);

                expect(requestPV).not.toHaveBeenCalled();
                expect(appStore.onRecovery).not.toHaveBeenCalled();
                expect(issues).toEqual([expect.objectContaining({kind: WorkspaceItemKind.GeneratedImage, message: "Could not make the PV image of image.fits: The line does not cross the image", outcome: WorkspaceIssueOutcome.Failed})]);
            });
        });

        test("says why a moment request failed", async () => {
            createGeneratingSession(Promise.reject(new Error("Moment generation failed: no spectral axis.")));
            const wholeImage = {...momentRequest, regionId: RegionId.IMAGE};

            const problems = await restore(createWorkspace({generatedImages: [{request: wholeImage, images: [{id: 2, moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}]}]}));

            expect(problems).toEqual(["Could not make the moment images of image.fits: Moment generation failed: no spectral axis"]);
        });

        test("lets the user retry a moment request that failed, and keeps the images that a later request made", async () => {
            const {appStore, requestMoment} = createGeneratingSession();
            const original = requestMoment.getMockImplementation()!;
            requestMoment.mockImplementationOnce(() => Promise.reject(new Error("Moment generation failed: the backend is busy")));
            const items: unknown[] = [];
            appStore.onRecovery = recovery => {
                items.push(...recovery.items);
                recovery.setChoice(0, {action: WorkspaceRecoveryAction.Retry});
                recovery.continue();
            };
            const wholeImage = {...momentRequest, regionId: RegionId.IMAGE};

            const issues = await restoreIssues(
                createWorkspace({
                    generatedImages: [
                        {request: {...wholeImage, moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM]}, images: [{id: 2, moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}]},
                        {request: {...wholeImage, moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]}, images: [{id: 3, moment: CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM}]}
                    ]
                })
            );

            expect(items).toEqual([expect.objectContaining({kind: WorkspaceItemKind.GeneratedImage, message: "Could not make the moment images of image.fits: Moment generation failed: the backend is busy", canRetry: true})]);
            expect(issues).toEqual([]);
            expect(original).toBeDefined();
            // The retry comes after the later request made its images. So the retry keeps those images.
            expect(requestMoment.mock.calls.map(([message]) => [message.moments, message.keep])).toEqual([
                [[CARTA.Moment.MAX_OF_THE_SPECTRUM], false],
                [[CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM], false],
                [[CARTA.Moment.MAX_OF_THE_SPECTRUM], true]
            ]);
        });

        test("makes a request from a generated image after Recovery makes that image, and skips it with that image", async () => {
            const wholeImage = {...momentRequest, regionId: RegionId.IMAGE};
            const workspace = createWorkspace({
                generatedImages: [
                    {request: {...wholeImage, moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM]}, images: [{id: 2, name: "maximum.fits", moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}]},
                    {request: {...wholeImage, sourceImageId: 2, moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]}, images: [{id: 3, moment: CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM}]}
                ]
            });

            for (const action of [WorkspaceRecoveryAction.Retry, WorkspaceRecoveryAction.Skip] as const) {
                const {appStore, requestMoment} = createGeneratingSession();
                requestMoment.mockImplementationOnce(() => Promise.reject(new Error("Moment generation failed")));
                const subjects: string[][] = [];
                appStore.onRecovery = recovery => {
                    subjects.push(recovery.items.map(item => item.subject));
                    recovery.setChoice(0, {action});
                    recovery.continue();
                };

                const issues = await restoreIssues(workspace);

                // The later request waits for the image, and is not offered on its own.
                expect(subjects).toEqual([["the moment images of image.fits"]]);
                if (action === WorkspaceRecoveryAction.Retry) {
                    expect(issues).toEqual([]);
                    expect(requestMoment).toHaveBeenCalledTimes(3);
                    expect(requestMoment.mock.calls[2][1]).toBe(appStore.frames[1]);
                } else {
                    expect(issues.map(({message, outcome}) => [message, outcome])).toEqual([
                        ["Could not make the moment images of image.fits: Moment generation failed", WorkspaceIssueOutcome.Skipped],
                        ["Skipped making the moment images of maximum.fits: the image it is made from was skipped", WorkspaceIssueOutcome.Skipped]
                    ]);
                    expect(requestMoment).toHaveBeenCalledTimes(1);
                }
                jest.restoreAllMocks();
            }
        });

        test("keeps a chain of requests waiting for the first one, and skips the whole chain with it", async () => {
            const wholeImage = {...momentRequest, regionId: RegionId.IMAGE};
            const workspace = createWorkspace({
                generatedImages: [
                    {request: {...wholeImage, moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM]}, images: [{id: 2, name: "maximum.fits", moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}]},
                    {request: {...wholeImage, sourceImageId: 2, moments: [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM]}, images: [{id: 3, name: "integrated.fits", moment: CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM}]},
                    {request: {...wholeImage, sourceImageId: 3, moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM]}, images: [{id: 4, moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}]}
                ]
            });

            for (const action of [WorkspaceRecoveryAction.Retry, WorkspaceRecoveryAction.Skip] as const) {
                const {appStore, requestMoment} = createGeneratingSession();
                requestMoment.mockImplementationOnce(() => Promise.reject(new Error("Moment generation failed")));
                appStore.onRecovery = recovery => {
                    recovery.setChoice(0, {action});
                    recovery.continue();
                };

                const issues = await restoreIssues(workspace);

                if (action === WorkspaceRecoveryAction.Retry) {
                    expect(issues).toEqual([]);
                    expect(requestMoment).toHaveBeenCalledTimes(4);
                } else {
                    expect(issues.map(({outcome}) => outcome)).toEqual([WorkspaceIssueOutcome.Skipped, WorkspaceIssueOutcome.Skipped, WorkspaceIssueOutcome.Skipped]);
                    expect(issues[2].message).toBe("Skipped making the moment images of integrated.fits: the image it is made from was skipped");
                }
                jest.restoreAllMocks();
            }
        });

        test("puts the images back in the order of the saved image list, with a generated image between the images that were opened", async () => {
            const {appStore} = createGeneratingSession();
            // The workspace has no color-blended images, so the image list holds the frames alone.
            appStore.reorderFrame.mockImplementation((oldIndex: number, newIndex: number, length: number) => {
                const moved = appStore.frames.splice(oldIndex, length);
                appStore.frames.splice(newIndex, 0, ...moved);
            });
            const files = [
                {...IMAGE, imageListIndex: 2},
                {id: 4, source: {type: "file" as const, filename: "other.fits"}, imageListIndex: 0}
            ];
            const wholeImage = {...momentRequest, regionId: RegionId.IMAGE, moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM]};

            const restorer = await restored(createWorkspace({files, generatedImages: [{request: wholeImage, images: [{id: 2, moment: CARTA.Moment.MAX_OF_THE_SPECTRUM, imageListIndex: 1}]}]}));

            expect(appStore.frames.map(frame => frame.frameInfo.fileId)).toEqual([4, 2, 1].map(id => restorer.fileIdOf(id)));
        });

        test("keeps the order in which the images were opened for a workspace saved without the places of the images", async () => {
            const {appStore} = createGeneratingSession();
            const wholeImage = {...momentRequest, regionId: RegionId.IMAGE, moments: [CARTA.Moment.MAX_OF_THE_SPECTRUM]};

            await restore(createWorkspace({generatedImages: [{request: wholeImage, images: [{id: 2, moment: CARTA.Moment.MAX_OF_THE_SPECTRUM}]}]}));

            expect(appStore.reorderFrame).not.toHaveBeenCalled();
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
                if (step?.onSkip && step.description.startsWith("Making")) {
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

            const issues = await restoreIssues(workspace);
            const problems = issues.map(issue => issue.message);

            // What is made of the skipped images is skipped with them.
            expect(issues.map(issue => issue.outcome)).toEqual([WorkspaceIssueOutcome.Skipped, WorkspaceIssueOutcome.Skipped]);
            expect(cancelRequestingMoment).toHaveBeenCalledWith(1);
            // The images that the backend still makes for the skipped request are not wanted.
            const {isStillWanted} = requestMoment.mock.calls[0][2] as {isStillWanted: () => boolean};
            expect(isStillWanted()).toBe(false);
            expect(requestPV).not.toHaveBeenCalled();
            expect(problems).toEqual(["Skipped making the moment images of image.fits", "Skipped making the PV image of image.fits.moment.maximum: the image it is made from was skipped"]);
            // The report lists the PV request under the moment request, by the image that the PV request is made from.
            expect(issues.map(({label, reason, imageIds, causeImageId}) => ({label, reason, imageIds, causeImageId}))).toEqual([
                {label: "The moment images of image.fits", reason: undefined, imageIds: [2], causeImageId: undefined},
                {label: "The PV image of image.fits.moment.maximum", reason: "the image it is made from was skipped", imageIds: [3], causeImageId: 2}
            ]);
            expect(appStore.setWorkspaceLoadingStep).toHaveBeenCalledWith(expect.objectContaining({description: "Making the moment images of image.fits", progress: 0.5}));
        });

        test("waits for the backend to take on the region with no time limit, until the user skips it", async () => {
            jest.useFakeTimers();
            const {appStore, requestMoment, backend} = createGeneratingSession(undefined, false);
            let skipPreparing: (() => void) | undefined;
            appStore.setWorkspaceLoadingStep.mockImplementation((step: any) => {
                if (step?.description.startsWith("Preparing")) {
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
            expect(appStore.setWorkspaceLoadingStep).toHaveBeenCalledWith(expect.objectContaining({description: "Preparing the moment images of image.fits", progress: 0}));
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

    describe("Recovery", () => {
        const source: WorkspaceCatalogQuerySource = {type: "simbad", center: {x: 12.5, y: -30.25}, system: CatalogSystemType.ICRS, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 500};

        /** Makes `appendFile` fail for the first `count` calls, and open the image after. */
        function failToOpen(appStore: ReturnType<typeof createSession>["appStore"], count: number) {
            const open = appStore.appendFile;
            const appendFile = jest.fn((...args: unknown[]) => (appendFile.mock.calls.length <= count ? Promise.reject(new Error(`File /data/${args[1]} does not exist.`)) : (open as (...args: unknown[]) => Promise<unknown>)(...args)));
            appStore.appendFile = appendFile as never;
            return appendFile;
        }

        test("pauses after the images, and opens an image from the file that the user chooses", async () => {
            const {appStore} = createSession();
            const appendFile = failToOpen(appStore, 1);
            const recoveries: WorkspaceRecoveryStore[] = [];
            appStore.onRecovery = recovery => {
                recoveries.push(recovery);
                recovery.setChoice(0, {action: WorkspaceRecoveryAction.Repoint, location: {directory: "/moved", filename: "image-moved.fits", hdu: "0"}});
                recovery.continue();
            };

            const restorer = await restored(createWorkspace({files: [{...IMAGE, regionsSet: {regions: [{id: 5, type: 3, rotation: 0, points: []}]}}], catalogs: [CATALOG]}));

            expect(recoveries).toHaveLength(1);
            expect(recoveries[0].stage).toBe("Opening images");
            expect(recoveries[0].items).toEqual([
                {
                    kind: WorkspaceItemKind.Image,
                    subject: "image.fits",
                    message: "Could not open the image image.fits: File /data/image.fits does not exist",
                    label: "The image image.fits",
                    reason: "File /data/image.fits does not exist",
                    repointKind: "image",
                    canRetry: false,
                    dependents: ["1 region", "the catalog sources.vot"]
                }
            ]);
            expect(appendFile.mock.calls[1].slice(0, 3)).toEqual(["/moved", "image-moved.fits", "0"]);
            expect(restorer.repointed.images.get(IMAGE.id)).toEqual({from: IMAGE.source, to: {type: "file", directory: "/moved", filename: "image-moved.fits", hdu: "0"}});
            // The catalog of the image opens, and nothing is reported.
            expect(appStore.appendCatalog).toHaveBeenCalled();
            expect(restorer.fileIdOf(IMAGE.id)).toBeDefined();
            expect(appStore.workspaceRecovery).toBeUndefined();
        });

        test("puts an image from a new file back in its saved place among the images", async () => {
            const {appStore} = createSession();
            failToOpen(appStore, 1);
            // The workspace has no color-blended images, so the image list holds the frames alone.
            appStore.reorderFrame.mockImplementation((oldIndex: number, newIndex: number, length: number) => {
                const moved = appStore.frames.splice(oldIndex, length);
                appStore.frames.splice(newIndex, 0, ...moved);
            });
            appStore.onRecovery = recovery => {
                recovery.setChoice(0, {action: WorkspaceRecoveryAction.Repoint, location: {directory: "/moved", filename: "first-moved.fits"}});
                recovery.continue();
            };
            const files = [1, 2, 3].map(id => ({id, source: {type: "file" as const, filename: `image-${id}.fits`}}));

            const restorer = await restored(createWorkspace({files}));

            // The first image opens last, after the user chooses its new file, and then moves back to the front.
            expect(appStore.frames.map(frame => frame.frameInfo.fileId)).toEqual(files.map(fileInfo => restorer.fileIdOf(fileInfo.id)));
            expect(appStore.reorderFrame).toHaveBeenCalledWith(2, 0, 1);
        });

        test("asks again for an image that fails again, and reports it as skipped with the last reason", async () => {
            const {appStore} = createSession();
            failToOpen(appStore, 2);
            let round = 0;
            appStore.onRecovery = recovery => {
                round++;
                if (round === 1) {
                    recovery.setChoice(0, {action: WorkspaceRecoveryAction.Repoint, location: {directory: "/moved", filename: "wrong.fits"}});
                    recovery.continue();
                } else {
                    // The image keeps the name that the workspace gives it, with the file that was tried.
                    expect(recovery.items[0].message).toBe("Could not open the image image.fits from wrong.fits: File /data/wrong.fits does not exist");
                    recovery.skipAll();
                }
            };

            const restorer = await restored(createWorkspace({catalogs: [CATALOG]}));
            const issues = (restorer as unknown as {issues: WorkspaceIssue[]}).issues;

            expect(round).toBe(2);
            expect(issues.map(({message, outcome}) => [message, outcome])).toEqual([
                ["Could not open the image image.fits from wrong.fits: File /data/wrong.fits does not exist", WorkspaceIssueOutcome.Skipped],
                ["Skipped the catalog sources.vot: the image it belongs to was skipped", WorkspaceIssueOutcome.Skipped]
            ]);
            // The file did not open, so the workspace keeps its saved location.
            expect(restorer.repointed.images.size).toBe(0);
        });

        test("retries an online catalog after the user chooses another mirror", async () => {
            const {appStore} = createSession();
            const load = jest.spyOn(CatalogApiService.Instance, "loadSimbadCatalog").mockRejectedValueOnce(new Error("Request to mirror simbad.example failed")).mockResolvedValue({fileId: 12, dataSize: 3});
            const items: unknown[] = [];
            appStore.onRecovery = recovery => {
                items.push(...recovery.items);
                recovery.setChoice(0, {action: WorkspaceRecoveryAction.Retry});
                recovery.continue();
            };

            const issues = await restoreIssues(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}]}));

            expect(items).toEqual([
                expect.objectContaining({
                    kind: WorkspaceItemKind.Catalog,
                    message: "Could not load the catalog from the SIMBAD query: Request to mirror simbad.example failed",
                    canRetry: true,
                    database: CatalogDatabase.SIMBAD,
                    repointKind: undefined
                })
            ]);
            expect(load).toHaveBeenCalledTimes(2);
            expect(issues).toEqual([]);
        });

        test("shows image coordinates before the images open, when the layout saved image coordinates", async () => {
            const {appStore} = createSession();
            const systems: string[] = [];
            const open = appStore.appendFile;
            appStore.appendFile = jest.fn((...args: unknown[]) => {
                systems.push(appStore.overlaySettings.global.system);
                return (open as (...args: unknown[]) => Promise<unknown>)(...args);
            }) as never;
            const layout = {layoutVersion: 2, docked: {type: "row", content: [{type: "stack", content: [{type: "component", id: "image-view", widgetSettings: {wcsOverlay: {global: {system: SystemType.Image}}}}]}]}, floating: []};

            await restored(createWorkspace({layout: layout as never}));

            // The images are matched pixel to pixel, as they were matched when the workspace was saved.
            expect(systems).toEqual([SystemType.Image]);
        });

        test.each([
            ["saved world coordinates", {wcsOverlay: {global: {system: SystemType.Galactic}}}, SystemType.Galactic],
            ["saved no overlay, as a workspace of CARTA 6", undefined, SystemType.Auto]
        ])("leaves image coordinates before the images open, when the session shows them and the workspace %s", async (_, widgetSettings, expected) => {
            const {appStore} = createSession();
            appStore.overlaySettings.global.system = SystemType.Image;
            const systems: string[] = [];
            const open = appStore.appendFile;
            appStore.appendFile = jest.fn((...args: unknown[]) => {
                systems.push(appStore.overlaySettings.global.system);
                return (open as (...args: unknown[]) => Promise<unknown>)(...args);
            }) as never;
            const imageView = {type: "component", id: "image-view", ...(widgetSettings ? {widgetSettings} : {})};
            const layout = {layoutVersion: 2, docked: {type: "row", content: [{type: "stack", content: [imageView]}]}, floating: []};

            await restored(createWorkspace(widgetSettings ? {layout: layout as never} : {}));

            // The images are matched by sky position, as they were matched when the workspace was saved.
            expect(systems).toEqual([expected]);
        });

        test("skips the images and catalogs that the user chose to open the workspace without, and does not ask about them", async () => {
            const {appStore} = createSession();
            const appendFile = failToOpen(appStore, 0);
            const load = jest.spyOn(CatalogApiService.Instance, "loadSimbadCatalog").mockResolvedValue({fileId: 12, dataSize: 3});
            const onRecovery = jest.fn();
            appStore.onRecovery = onRecovery;
            const kept = {id: 2, source: {type: "file" as const, filename: "kept.fits"}};

            const restorer = await restored(createWorkspace({files: [IMAGE, kept], catalogs: [CATALOG, {id: 2, source, associatedImageId: 2}]}), {imageIds: [IMAGE.id], catalogIds: [2]});
            const issues = (restorer as unknown as {issues: WorkspaceIssue[]}).issues;

            expect(onRecovery).not.toHaveBeenCalled();
            expect(appendFile.mock.calls.map(call => call[1])).toEqual(["kept.fits"]);
            expect(load).not.toHaveBeenCalled();
            expect(issues.map(({message, outcome}) => [message, outcome])).toEqual([
                ["Left out the image image.fits: a file was missing when the workspace was opened", WorkspaceIssueOutcome.Skipped],
                ["Skipped the catalog sources.vot: the image it belongs to was skipped", WorkspaceIssueOutcome.Skipped],
                ["Left out the SIMBAD catalog on kept.fits: its mirror did not answer when the workspace was opened", WorkspaceIssueOutcome.Skipped]
            ]);
        });

        test("queries the mirror that the workspace saved, when the mirror is available", async () => {
            createSession();
            const mirrorSiteStore = MirrorSiteStore.Instance;
            const [first, second] = mirrorSiteStore.getMirrorSites(CatalogDatabase.SIMBAD);
            mirrorSiteStore.setActiveMirror(CatalogDatabase.SIMBAD, first);
            const asked: string[] = [];
            jest.spyOn(CatalogApiService.Instance, "loadSimbadCatalog").mockImplementation(() => {
                asked.push(mirrorSiteStore.getActiveMirror(CatalogDatabase.SIMBAD)!);
                return Promise.resolve({fileId: 12, dataSize: 3});
            });

            await restoreIssues(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}], catalogMirrors: {[CatalogDatabase.SIMBAD]: second}}));
            await restoreIssues(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}], catalogMirrors: {[CatalogDatabase.SIMBAD]: "https://unknown.example"}}));

            // An unknown mirror leaves the mirror of the session as it is.
            expect(asked).toEqual([second, second]);
            mirrorSiteStore.setActiveMirror(CatalogDatabase.SIMBAD, first);
        });

        test("offers the retry on a mirror that has not failed, and then on the mirror that failed longest ago", async () => {
            const {appStore} = createSession();
            const mirrorSiteStore = MirrorSiteStore.Instance;
            const mirrors = mirrorSiteStore.getMirrorSites(CatalogDatabase.SIMBAD);
            const [first, second] = mirrors;
            mirrorSiteStore.setActiveMirror(CatalogDatabase.SIMBAD, first);
            const asked: string[] = [];
            jest.spyOn(CatalogApiService.Instance, "loadSimbadCatalog").mockImplementation(() => {
                asked.push(mirrorSiteStore.getActiveMirror(CatalogDatabase.SIMBAD)!);
                return Promise.reject(new Error("Request failed"));
            });
            const offered: string[] = [];
            appStore.onRecovery = recovery => {
                offered.push(mirrorSiteStore.getActiveMirror(CatalogDatabase.SIMBAD)!);
                // Retry once on every mirror, and once more on the first mirror, which then failed longest ago.
                if (offered.length <= mirrors.length) {
                    recovery.setChoice(0, {action: WorkspaceRecoveryAction.Retry});
                    recovery.continue();
                } else {
                    recovery.skipAll();
                }
            };

            await restoreIssues(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}]}));

            expect(asked).toEqual([...mirrors, first]);
            expect(offered).toEqual([...mirrors.slice(1), first, second]);
            // The active mirror lasts for the session. Put it back for the other tests.
            mirrorSiteStore.setActiveMirror(CatalogDatabase.SIMBAD, first);
        });

        test("keeps the mirror that the user chose when another query failed on a different mirror", async () => {
            const {appStore} = createSession();
            const mirrorSiteStore = MirrorSiteStore.Instance;
            const [first, second] = mirrorSiteStore.getMirrorSites(CatalogDatabase.SIMBAD);
            mirrorSiteStore.setActiveMirror(CatalogDatabase.SIMBAD, first);
            jest.spyOn(CatalogApiService.Instance, "loadSimbadCatalog")
                .mockImplementationOnce(() => {
                    // The user chooses another mirror while the query runs.
                    mirrorSiteStore.setActiveMirror(CatalogDatabase.SIMBAD, second);
                    return Promise.reject(new Error("Request failed"));
                })
                .mockResolvedValue({fileId: 12, dataSize: 3});
            let offered: string | undefined;
            appStore.onRecovery = recovery => {
                offered = mirrorSiteStore.getActiveMirror(CatalogDatabase.SIMBAD);
                recovery.skipAll();
            };

            await restoreIssues(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}]}));

            expect(offered).toBe(second);
            // The active mirror lasts for the session. Put it back for the other tests.
            mirrorSiteStore.setActiveMirror(CatalogDatabase.SIMBAD, first);
        });

        test("waits for a timed-out mirror again when the user retries", async () => {
            const {appStore} = createSession();
            const timeout = new AxiosError("timeout of 60000ms exceeded", AxiosError.ETIMEDOUT);
            const service = CatalogApiService.Instance as unknown as {axiosInstanceSimbad: {get: (url: string) => Promise<unknown>}};
            const get = jest.spyOn(service.axiosInstanceSimbad, "get").mockRejectedValue(timeout);
            let round = 0;
            appStore.onRecovery = recovery => {
                round++;
                if (round === 1) {
                    recovery.setChoice(0, {action: WorkspaceRecoveryAction.Retry});
                    recovery.setChoice(1, {action: WorkspaceRecoveryAction.Retry});
                    recovery.continue();
                } else {
                    recovery.skipAll();
                }
            };

            await restoreIssues(
                createWorkspace({
                    catalogs: [
                        {id: 1, source, associatedImageId: 1},
                        {id: 2, source: {...source, radius: 3}, associatedImageId: 1}
                    ]
                })
            );

            // Each round waits for the mirror once.
            expect(round).toBe(2);
            expect(get).toHaveBeenCalledTimes(2);
        });

        test("skips an online query that the user does not wait for, without Recovery", async () => {
            const {appStore} = createSession();
            // The query never answers. Cancelling the pending queries rejects it. Axios does the same.
            let rejectQuery: ((reason: unknown) => void) | undefined;
            jest.spyOn(CatalogApiService.Instance, "loadSimbadCatalog").mockImplementation(() => new Promise((_, reject) => (rejectQuery = reject)));
            jest.spyOn(CatalogApiService.Instance, "cancelPendingQueries").mockImplementation(() => rejectQuery?.({__CANCEL__: true, message: "The online catalog query was skipped"}));

            const restoring = restoreIssues(createWorkspace({catalogs: [{id: 1, source, associatedImageId: 1}]}));
            await new Promise(resolve => setTimeout(resolve));
            const steps = appStore.setWorkspaceLoadingStep.mock.calls.map(([step]) => step as WorkspaceLoadingStep | undefined);
            const step = steps.find(candidate => candidate?.onSkip);
            // The step names the mirror that it waits for, and says when the query gives up.
            expect(step?.description).toBe(`Waiting for the mirror ${new URL(MirrorSiteStore.Instance.getActiveMirror(CatalogDatabase.SIMBAD)!).host}`);
            expect(step?.deadline).toBeGreaterThan(Date.now());
            expect(step!.deadline! - Date.now()).toBeLessThanOrEqual(CatalogApiService.QUERY_TIMEOUT_MS);
            step!.onSkip!();
            const issues = await restoring;

            expect(issues).toEqual([
                {kind: WorkspaceItemKind.Catalog, subject: "from the SIMBAD query", message: "Skipped the catalog from the SIMBAD query", outcome: WorkspaceIssueOutcome.Skipped, label: "The SIMBAD catalog on image.fits", catalogIds: [1]}
            ]);
            expect(appStore.setWorkspaceRecovery).not.toHaveBeenCalledWith(expect.anything());
            expect(appStore.setWorkspaceLoadingStep).toHaveBeenLastCalledWith(undefined);
        });

        test("stops waiting for the user when a newer load supersedes the restore", async () => {
            const {appStore} = createSession();
            failToOpen(appStore, 1);
            let recovery: WorkspaceRecoveryStore | undefined;
            appStore.onRecovery = waiting => {
                recovery = waiting;
            };

            const restoring = restoreIssues(createWorkspace({catalogs: [CATALOG]}));
            await new Promise(resolve => setTimeout(resolve));
            expect(recovery?.canContinue).toBe(false);
            WorkspaceRestorer.claimGeneration();
            const issues = await restoring;

            // The superseded restore reports nothing more, and opens no catalog.
            expect(issues).toEqual([]);
            expect(appStore.appendCatalog).not.toHaveBeenCalled();
            expect(appStore.workspaceRecovery).toBeUndefined();
        });

        test("lists what goes with an image that the user skips", async () => {
            const {appStore} = createSession();
            failToOpen(appStore, 1);
            let dependents: string[] = [];
            appStore.onRecovery = recovery => {
                dependents = recovery.items[0].dependents;
                recovery.skipAll();
            };
            const second = {id: 2, source: {type: "file" as const, filename: "second.fits"}, references: {spatial: 1}, contourConfig: {} as never, vectorOverlayConfig: {} as never};

            await restoreIssues(
                createWorkspace({
                    files: [IMAGE, second],
                    references: {spatial: 1},
                    catalogs: [CATALOG],
                    colorBlendingImages: [{imageListIndex: 0, selectedFrameId: [1, 2], alpha: [1, 1, 1]}],
                    generatedImages: [{request: {type: "pv", sourceImageId: 1, regionId: RegionId.IMAGE, width: 3, reverse: false}, images: [{id: 3}]}]
                } as Partial<Workspace>)
            );

            expect(dependents).toEqual(["the catalog sources.vot", "the PV image of image.fits", "the spatial matching of second.fits", "its place in 1 color-blended image"]);
        });

        test("shows the step that started last, and does not remove the step of another wait when its own ends", () => {
            const {appStore} = createSession();
            type Steps = {startStep: () => {show: (step: WorkspaceLoadingStep) => void; end: () => void}};
            const restorer = new WorkspaceRestorer(createWorkspace(), WorkspaceRestorer.claimGeneration()) as unknown as Steps;
            const histogram = {description: "Computing the cube histogram of image.fits", progress: 0.2, onSkip: jest.fn()};
            const query = {description: "Waiting for the catalog from the SIMBAD query", progress: 0, onSkip: jest.fn()};
            const shown = () => appStore.setWorkspaceLoadingStep.mock.calls.at(-1)?.[0];

            // The query ends first.
            const histogramStep = restorer.startStep();
            histogramStep.show(histogram);
            const queryStep = restorer.startStep();
            queryStep.show(query);
            histogramStep.show({...histogram, progress: 0.4});
            expect(shown()).toBe(query);
            queryStep.end();
            expect(shown()).toEqual({...histogram, progress: 0.4});
            histogramStep.end();
            expect(shown()).toBeUndefined();

            // The histogram ends first.
            const laterHistogram = restorer.startStep();
            laterHistogram.show(histogram);
            const laterQuery = restorer.startStep();
            laterQuery.show(query);
            laterHistogram.end();
            expect(shown()).toBe(query);
            laterQuery.end();
            expect(shown()).toBeUndefined();
        });

        test("writes only the sources of the images and catalogs the user chose new files for", () => {
            const stored = createWorkspace({
                files: [
                    {id: 1, directory: "/old", filename: "image.fits", source: {type: "file", directory: "/old", filename: "image.fits"}, channel: 3},
                    {id: 2, source: {type: "file", filename: "kept.fits"}}
                ],
                catalogs: [CATALOG, {...CATALOG, id: 2}]
            });

            const patched = WorkspaceRestorer.withRepointedSources(stored, {
                images: new Map([[1, {from: {type: "file" as const, directory: "/old", filename: "image.fits"}, to: {type: "file" as const, directory: "/new", filename: "image.fits"}}]]),
                catalogs: new Map([[2, {from: CATALOG.source, to: {type: "file" as const, directory: "/new", filename: "other.vot"}}]])
            })!;

            expect(patched.files).toEqual([{id: 1, source: {type: "file", directory: "/new", filename: "image.fits"}, channel: 3}, stored.files![1]]);
            expect(patched.catalogs).toEqual([CATALOG, {...CATALOG, id: 2, source: {type: "file", directory: "/new", filename: "other.vot"}}]);
            expect({...patched, files: undefined, catalogs: undefined}).toEqual({...stored, files: undefined, catalogs: undefined});
        });

        test("writes the new sources of an expression and a hypercube, and the mirrors that the user chose", () => {
            const lel = {type: "lel" as const, directory: "/old", expression: "a.fits - b.fits"};
            const hypercube = {type: "hypercube" as const, directory: "/old", stokesFiles: [{filename: "q.fits"}, {filename: "u.fits"}]};
            const stored = createWorkspace({
                files: [
                    {id: 1, source: lel},
                    {id: 2, source: hypercube}
                ],
                catalogMirrors: {[CatalogDatabase.SIMBAD]: "https://old.example"}
            });

            const patched = WorkspaceRestorer.withRepointedSources(stored, {
                images: new Map<number, {from: WorkspaceImageSource; to: WorkspaceImageSource}>([
                    [1, {from: lel, to: {...lel, directory: "/new"}}],
                    [2, {from: hypercube, to: {...hypercube, stokesFiles: [{filename: "q.fits", directory: "/new"}, {filename: "u.fits"}]}}]
                ]),
                catalogs: new Map(),
                mirrors: new Map([
                    [CatalogDatabase.SIMBAD, {from: "https://old.example", to: "https://new.example"}],
                    [CatalogDatabase.VIZIER, {from: "https://other.example", to: "https://new.example"}]
                ])
            })!;

            expect(patched.files!.map(file => file.source)).toEqual([
                {...lel, directory: "/new"},
                {...hypercube, stokesFiles: [{filename: "q.fits", directory: "/new"}, {filename: "u.fits"}]}
            ]);
            // The workspace saved another VizieR mirror than the change starts from, so the VizieR mirror is kept.
            expect(patched.catalogMirrors).toEqual({[CatalogDatabase.SIMBAD]: "https://new.example"});
        });

        test("changes no source that the stored workspace no longer has, as after it was saved again", () => {
            const stored = createWorkspace({
                files: [
                    {id: 1, source: {type: "file", filename: "another.fits"}},
                    {id: 2, source: {type: "file", filename: "image.fits"}}
                ]
            });
            const to = {type: "file" as const, directory: "/new", filename: "image.fits"};

            expect(WorkspaceRestorer.withRepointedSources(stored, {images: new Map([[1, {from: {type: "file", filename: "image.fits"}, to}]]), catalogs: new Map()})).toBeUndefined();
            const patched = WorkspaceRestorer.withRepointedSources(stored, {
                images: new Map([
                    [1, {from: {type: "file", filename: "image.fits"}, to}],
                    [2, {from: {type: "file", filename: "image.fits"}, to}]
                ]),
                catalogs: new Map()
            });
            expect(patched?.files).toEqual([stored.files![0], {id: 2, source: to}]);
        });

        test("reports an image or a VizieR catalog that cannot be opened as it is saved, without Recovery", async () => {
            const {appStore} = createSession();
            const vizier: WorkspaceCatalogQuerySource = {...source, type: "vizier"};

            const issues = await restoreIssues(
                createWorkspace({
                    files: [IMAGE, {id: 2, source: {type: "future"} as never}],
                    catalogs: [{id: 1, source: vizier, associatedImageId: 1}]
                })
            );

            expect(issues.map(({message, outcome}) => [message, outcome])).toEqual([
                ["Could not open the image an image of an unknown kind: the source is not one this version can open", WorkspaceIssueOutcome.Failed],
                ["Could not load the catalog from the VizieR query: the query names no table", WorkspaceIssueOutcome.Failed]
            ]);
            expect(appStore.setWorkspaceRecovery).not.toHaveBeenCalled();
        });
    });
});
