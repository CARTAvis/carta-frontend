import {CARTA} from "carta-protobuf";

import {TelemetryService} from "../../../services";
import {AppStore} from "../..";
import {ACTIVE_FILE_ID} from "../RegionWidgetStore/RegionWidgetStore";

import {PvGeneratorWidgetStore} from "./PvGeneratorWidgetStore";

describe("PvGeneratorWidgetStore on a nonlinear spectral axis", () => {
    const createStore = (isSpectralAxisNonlinear: boolean) => {
        const region = {regionId: 1, regionType: CARTA.RegionType.LINE, size: {x: 3, y: 4}, isTemporary: false, nameString: "line"};
        const frame = {
            isSpectralAxisNonlinear,
            channelValueBounds: {min: 0, max: 10},
            findChannelIndexByValue: jest.fn((value: number) => value),
            frameInfo: {fileId: 3},
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
        return {store, appStore};
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

    test("still requests a PV image for a linear spectral axis", () => {
        const {store, appStore} = createStore(false);
        store.requestPV();
        expect(appStore.requestPV).toHaveBeenCalledTimes(1);
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

    test("says when the region of the preview was not restored", () => {
        const {store} = createStore();

        expect(store.applyWorkspaceConfig({width: 3, reverse: false, keep: false, xyRebin: 1, zRebin: 1, previewRegionId: 9}, reader)).toEqual(["the region that its preview showed was not restored, so the preview shows the whole image"]);
    });
});
