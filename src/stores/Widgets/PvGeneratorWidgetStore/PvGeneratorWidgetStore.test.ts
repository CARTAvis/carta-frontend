import {CARTA} from "carta-protobuf";
import {observable, runInAction} from "mobx";

import {FloatingObjzIndexManager} from "models/zindex/zindex";

import {TelemetryService} from "../../../services";
import {AppStore, PreferenceStore, PV_DEFAULT_WIDTH} from "../..";
import {ACTIVE_FILE_ID} from "../RegionWidgetStore/RegionWidgetStore";

import {PvGeneratorWidgetStore} from "./PvGeneratorWidgetStore";

describe("PvGeneratorWidgetStore on a nonlinear spectral axis", () => {
    const createStore = (isSpectralAxisNonlinear: boolean) => {
        const region = {
            regionId: 1,
            regionType: CARTA.RegionType.LINE,
            size: {x: 3, y: 4},
            controlPoints: [
                {x: 1, y: 1},
                {x: 4, y: 5}
            ],
            isTemporary: false,
            nameString: "line"
        };
        const frame = {
            isSpectralAxisNonlinear,
            numChannels: 11,
            channelValueBounds: {min: 0, max: 10},
            findChannelIndexByValue: jest.fn((value: number) => value),
            frameInfo: {fileId: 3, fileInfoExtended: {width: 10, height: 10}},
            getRegion: jest.fn(() => region),
            regionSet: {focusedRegion: undefined, regions: [region]},
            resetPvRequestState: jest.fn(),
            setIsRequestingPV: jest.fn()
        };
        const appStore = {activeFrame: frame, frames: [frame], getFrame: jest.fn(() => frame), focusedRegion: undefined, requestPV: jest.fn(), requestPreviewPV: jest.fn()};
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore as unknown as AppStore);
        jest.spyOn(TelemetryService.Instance, "addTelemetryEntry").mockResolvedValue(undefined);
        const store = new PvGeneratorWidgetStore();
        store.setRegionId(ACTIVE_FILE_ID, region.regionId);
        return {store, appStore, frame};
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("requests neither a PV image nor a preview", () => {
        const {store, appStore} = createStore(true);
        store.requestPV();
        store.requestPV(true, "pv-generator-0-1");
        expect(appStore.requestPV).not.toHaveBeenCalled();
        expect(appStore.requestPreviewPV).not.toHaveBeenCalled();
    });

    test("starts with the width that the scripting API also uses", () => {
        const {store} = createStore(false);
        expect(store.width).toBe(PV_DEFAULT_WIDTH);
    });

    test("still requests a PV image for a linear spectral axis", () => {
        const {store, appStore} = createStore(false);
        store.requestPV();
        expect(appStore.requestPV).toHaveBeenCalledTimes(1);
    });

    test("requests neither a PV image nor a preview of an image with one channel", () => {
        const {store, appStore, frame} = createStore(false);
        frame.numChannels = 1;
        store.requestPV();
        store.requestPV(true, "pv-generator-0");
        expect(appStore.requestPV).not.toHaveBeenCalled();
        expect(appStore.requestPreviewPV).not.toHaveBeenCalled();
        expect(frame.setIsRequestingPV).not.toHaveBeenCalled();
    });
});

describe("PvGeneratorWidgetStore in a workspace", () => {
    const createStore = () => {
        const frame = {
            channelValueBounds: {min: 0, max: 10},
            spectralCoordinate: "Frequency (GHz)",
            spectralSystem: "LSRK",
            frameInfo: {fileId: 3},
            getRegion: jest.fn(),
            regionSet: {focusedRegion: undefined, regions: []}
        };
        const appStore = {activeFrame: frame, frames: [frame], getFrame: jest.fn(() => frame), focusedRegion: undefined};
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore as unknown as AppStore);
        return {store: new PvGeneratorWidgetStore(), frame};
    };
    const ids = {imageIdOf: (fileId: number) => (fileId === 3 ? 1 : undefined)};
    // As in a restore, a fixed region ID such as none stays the same, and region 5 comes back as 105.
    const reader = {
        fileIdOf: (imageId: number) => (imageId === 1 ? 3 : undefined),
        regionIdOf: (_imageId: number | undefined, regionId: number) => (regionId <= 0 ? regionId : regionId === 5 ? 105 : undefined),
        wasActiveImageRestored: () => true
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("saves the settings, the range in its spectral coordinate and the preview region, and applies them again", () => {
        const {store} = createStore();
        store.setWidth(5);
        store.setKeep(true);
        store.setXYRebin(2);
        store.setZRebin(3);
        store.setSpectralRange({min: 2, max: 8});
        store.setPreviewRegionId(5);

        const config = store.toWorkspaceConfig(ids);

        // The cut is saved with the image and region of the widget, as in the other widgets.
        expect(config).toMatchObject({width: 5, reverse: store.isReverse, keep: true, xyRebin: 2, zRebin: 3, channelRange: [2, 8], channelUnit: "Frequency (GHz), LSRK", previewRegionId: 5});

        const restored = createStore().store;
        expect(restored.applyWorkspaceBinding(config, reader)).toEqual([]);
        expect(restored.applyWorkspaceConfig(config, reader)).toEqual([]);
        restored.applyWorkspaceView(config);
        expect([restored.width, restored.shouldKeep, restored.xyRebin, restored.zRebin, restored.previewRegionId, restored.range]).toEqual([5, true, 2, 3, 105, {min: 2, max: 8}]);
    });

    test("leaves out a range of the whole spectral axis, and keeps the whole axis for a range in another spectral coordinate", () => {
        const {store} = createStore();
        expect(store.toWorkspaceConfig(ids)).not.toHaveProperty("channelRange");

        store.applyWorkspaceView({width: 3, reverse: false, keep: false, xyRebin: 1, zRebin: 1, previewRegionId: -1, channelRange: [2, 8], channelUnit: "Velocity (km/s), LSRK"});

        expect(store.range).toEqual({min: 0, max: 10});
    });

    test("keeps the range of the image of the cut while a PV image is active, and saves that image with the range", () => {
        const cube = {channelValueBounds: {min: 0, max: 10}, spectralCoordinate: "Frequency (GHz)", spectralSystem: "LSRK", frameInfo: {fileId: 3}, getRegion: jest.fn(), regionSet: {regions: []}};
        const pvImage = {channelValueBounds: null, spectralCoordinate: "", spectralSystem: "", frameInfo: {fileId: 4}, getRegion: jest.fn(), regionSet: {regions: []}};
        const state = observable({activeFrame: cube as object}, {activeFrame: observable.ref});
        const frames = [cube, pvImage];
        const appStore = {
            get activeFrame() {
                return state.activeFrame;
            },
            frames,
            getFrame: jest.fn((fileId: number) => frames.find(frame => frame.frameInfo.fileId === fileId)),
            focusedRegion: undefined
        };
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore as unknown as AppStore);
        const store = new PvGeneratorWidgetStore();
        store.setSpectralRange({min: 2, max: 8});
        runInAction(() => (state.activeFrame = pvImage));

        const config = store.toWorkspaceConfig({imageIdOf: (fileId: number) => (fileId === 3 ? 1 : fileId === 4 ? 2 : undefined)});

        expect(config).toMatchObject({channelRange: [2, 8], channelUnit: "Frequency (GHz), LSRK", channelRangeImageId: 1});

        // The restore makes the PV image active again, and applies the range on the image of the cut.
        const restored = new PvGeneratorWidgetStore();
        runInAction(() => (state.activeFrame = pvImage));
        expect(restored.applyWorkspaceConfig(config, {...reader, fileIdOf: (imageId: number) => (imageId === 1 ? 3 : undefined)})).toEqual([]);
        restored.applyWorkspaceView(config);
        expect(restored.range).toEqual({min: 2, max: 8});

        // The image of the cut was not restored, and another cube in the same spectral coordinate is active.
        const other = {...cube, channelValueBounds: {min: 0, max: 20}, frameInfo: {fileId: 5}};
        frames.push(other);
        runInAction(() => (state.activeFrame = other));
        const missing = new PvGeneratorWidgetStore();
        expect(missing.applyWorkspaceConfig(config, {...reader, fileIdOf: () => undefined})).toEqual(["the image that its spectral range was chosen on was not restored, so the range is the whole spectral axis"]);
        missing.applyWorkspaceView(config);
        expect(missing.range).toEqual({min: 0, max: 20});
    });

    test("says when the region of the preview was not restored", () => {
        const {store} = createStore();

        expect(store.applyWorkspaceConfig({width: 3, reverse: false, keep: false, xyRebin: 1, zRebin: 1, previewRegionId: 9}, reader)).toEqual(["the region that its preview showed was not restored, so the preview shows the whole image"]);
    });
});

describe("PvGeneratorWidgetStore with a PV preview in a workspace", () => {
    const createSession = (limit: number) => {
        const region = {regionId: 1, regionType: CARTA.RegionType.LINE, size: {x: 3, y: 4}, isTemporary: false, nameString: "line"};
        const frame = {
            channelValueBounds: {min: 0, max: 9},
            spectralCoordinate: "Frequency (GHz)",
            spectralSystem: "LSRK",
            findChannelIndexByValue: jest.fn((value: number) => value),
            frameInfo: {fileId: 3, fileInfoExtended: {width: 1000, height: 1000, depth: 10, headerEntries: [{name: "BITPIX", numericValue: -32}]}},
            getRegion: jest.fn((regionId: number) => (regionId === 1 ? region : undefined)),
            regionSet: {focusedRegion: undefined, regions: [region]},
            resetPvRequestState: jest.fn(),
            setIsRequestingPV: jest.fn()
        };
        const panel = {type: "pv-preview", parentId: "pv-generator-0", defaultX: 10, defaultY: 20, defaultWidth: 300, defaultHeight: 200, setDefaultPosition: jest.fn(), setDefaultSize: jest.fn()};
        const previewFrame = {renderConfig: {toConfig: jest.fn(() => ({colorMap: "viridis"})), applyConfig: jest.fn()}};
        const widgetsStore = {pvGeneratorWidgets: new Map(), floatingWidgets: [panel], spectralProfilerList: [], closePvPreviewViewer: jest.fn()};
        const appStore = {
            activeFrame: frame,
            frames: [frame],
            getFrame: jest.fn(() => frame),
            widgetsStore,
            requestPreviewPV: jest.fn(async (_message: unknown, _frame: unknown, id: string) => {
                widgetsStore.pvGeneratorWidgets.get(id)?.setPreviewFrame(previewFrame as never);
            })
        };
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore as unknown as AppStore);
        jest.spyOn(PreferenceStore, "Instance", "get").mockReturnValue({pvPreviewCubeSizeLimit: limit, isPVAxesOrderReverse: false} as unknown as PreferenceStore);
        const store = new PvGeneratorWidgetStore();
        store.setRegionId(ACTIVE_FILE_ID, region.regionId);
        widgetsStore.pvGeneratorWidgets.set("pv-generator-0", store);
        return {store, appStore, panel, previewFrame};
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("saves whether the preview is the active image, and how many other floating widgets are below its viewer", () => {
        const {store, appStore, panel, previewFrame} = createSession(1);
        store.setPreviewFrame(previewFrame as never);
        const zIndexManager = new FloatingObjzIndexManager();
        // A settings panel is not counted. A catalog plot is stacked by its component ID.
        Object.assign(panel, {id: "viewer"});
        appStore.widgetsStore.floatingWidgets = [
            {id: "pv-generator-0"},
            {id: "settings", type: "floating-settings", parentId: "pv-generator-0", parentType: "pv-generator"},
            panel,
            {id: "catalog-plot-0", componentId: "catalog-plot-component-0"}
        ] as never;
        ["pv-generator-0", "settings", "viewer", "catalog-plot-component-0"].forEach(id => zIndexManager.assignIndex(id));
        // The store keeps the preview as an observable, so the active frame is the one that it keeps.
        Object.assign(appStore, {zIndexManager, activeFrame: store.previewFrame});

        expect(store.toWorkspaceConfig({imageIdOf: () => 1}).preview).toEqual({renderConfig: {colorMap: "viridis"}, cubeSize: 0.04, isActive: true, panel: {x: 10, y: 20, width: 300, height: 200, widgetsBelow: 1}});
    });

    test("saves the preview with how it is drawn and where its panel is, and makes it again on restore", async () => {
        const {store, appStore, panel, previewFrame} = createSession(1);
        store.setPreviewFrame(previewFrame as never);

        const config = store.toWorkspaceConfig({imageIdOf: () => 1});
        // The whole cube of 1000 by 1000 by 10 pixels of 4 bytes is 0.04 GB.
        expect(config.preview).toEqual({renderConfig: {colorMap: "viridis"}, cubeSize: 0.04, panel: {x: 10, y: 20, width: 300, height: 200}});

        store.setPreviewFrame(null);
        expect(await store.restoreWorkspaceResult(config)).toEqual([]);

        expect(appStore.requestPreviewPV).toHaveBeenCalledTimes(1);
        expect(previewFrame.renderConfig.applyConfig).toHaveBeenCalledWith({colorMap: "viridis"});
        expect(panel.setDefaultPosition).toHaveBeenCalledWith(10, 20);
        expect(panel.setDefaultSize).toHaveBeenCalledWith(300, 200);
    });

    test("saves the request that made the preview, and makes the preview again with it, though the widget shows other settings", async () => {
        const {store, appStore} = createSession(1);
        await store.requestPV(true, "pv-generator-0");
        const made = (appStore.requestPreviewPV.mock.calls[0] as unknown[])[0];
        expect(made).toMatchObject({fileId: 3, regionId: 1, width: 3, spectralRange: {min: 0, max: 9}});
        // The user changes the settings without making the preview again.
        store.setWidth(5);
        store.setXYRebin(2);

        const config = JSON.parse(JSON.stringify(store.toWorkspaceConfig({imageIdOf: (fileId: number) => (fileId === 3 ? 1 : undefined)})));
        expect(config.preview.request).toEqual({imageId: 1, regionId: 1, width: 3, channels: [0, 9], reverse: false, previewRegionId: -1, xyRebin: 1, zRebin: 1});
        // The size of the shown preview, though the rebinning of the widget now reads less.
        expect([config.preview.cubeSize, store.estimatedCubeSize]).toEqual([0.04, 0.01]);

        appStore.requestPreviewPV.mockClear();
        const restored = new PvGeneratorWidgetStore();
        appStore.widgetsStore.pvGeneratorWidgets.set("pv-generator-0", restored);
        const reader = {fileIdOf: (imageId: number) => (imageId === 1 ? 3 : undefined), regionIdOf: (_imageId: number | undefined, regionId: number) => regionId, wasActiveImageRestored: () => true};
        restored.applyWorkspaceConfig(config, reader as never);
        expect(await restored.restoreWorkspaceResult(config)).toEqual([]);
        expect((appStore.requestPreviewPV.mock.calls[0] as unknown[])[0]).toMatchObject({fileId: 3, regionId: 1, width: 3, spectralRange: {min: 0, max: 9}, previewSettings: expect.objectContaining({rebinXy: 1, rebinZ: 1})});

        // The cube was not restored.
        appStore.requestPreviewPV.mockClear();
        restored.applyWorkspaceConfig(config, {...reader, fileIdOf: () => undefined} as never);
        expect(await restored.restoreWorkspaceResult(config)).toEqual(["the image or the line region that the PV preview was made from was not restored, so the preview was not made again"]);
        expect(appStore.requestPreviewPV).not.toHaveBeenCalled();
    });

    test("does not make again a preview larger than the cube size limit of the preferences, says how to make it, and closes a docked viewer of the preview", async () => {
        // The whole cube of 1000 by 1000 by 10 pixels of 4 bytes is 0.04 GB.
        const {store, appStore} = createSession(0.01);

        const problems = await store.restoreWorkspaceResult({width: 3, reverse: false, keep: false, xyRebin: 1, zRebin: 1, previewRegionId: -1, preview: {}});

        expect(appStore.requestPreviewPV).not.toHaveBeenCalled();
        expect(problems).toEqual(["the PV preview needs about 0.04 GB, more than the PV preview cube size limit of 0.01 GB, so it was not made again. Raise the limit in Preferences > Performance to make it"]);
        expect(appStore.widgetsStore.closePvPreviewViewer).toHaveBeenCalledWith("pv-generator-0");
    });
});
