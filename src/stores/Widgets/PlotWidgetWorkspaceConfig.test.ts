// load the stores before the widget stores: importing one alone reaches ColormapComponent through a circular import before "utilities" is initialised
import {observable, runInAction} from "mobx";

import {RegionId} from "enums";
import {type WorkspaceIdReader, type WorkspaceIdWriter} from "models";
import {AppStore} from "stores";

import {HistogramWidgetStore} from "./HistogramWidgetStore/HistogramWidgetStore";
import {ACTIVE_FILE_ID} from "./RegionWidgetStore/RegionWidgetStore";
import {RenderConfigWidgetStore} from "./RenderConfigWidgetStore/RenderConfigWidgetStore";
import {SpatialProfileWidgetStore} from "./SpatialProfileWidgetStore/SpatialProfileWidgetStore";
import {StatsWidgetStore} from "./StatsWidgetStore/StatsWidgetStore";
import {StokesAnalysisWidgetStore} from "./StokesAnalysisWidgetStore/StokesAnalysisWidgetStore";

/** A session holding two images with Stokes I and Q, the first of them in front. */
function createSession() {
    const createFrame = (fileId: number) => ({
        frameInfo: {fileId},
        hasStokes: true,
        coordinateOptions: [{value: "I"}, {value: "Q"}],
        regionSet: {focusedRegion: undefined},
        getRegion: () => undefined,
        renderConfig: {histogramMin: 0, histogramMax: 1}
    });
    const frames = [createFrame(3), createFrame(7)];
    const session = observable({activeFrame: frames[0], frames}, {activeFrame: observable.ref, frames: observable.ref});
    jest.spyOn(AppStore, "Instance", "get").mockReturnValue({
        get activeFrame() {
            return session.activeFrame;
        },
        get frames() {
            return session.frames;
        },
        getFrame: (fileId: number) => session.frames.find(frame => frame.frameInfo.fileId === fileId)
    } as any);
    return session;
}

/** A workspace being saved that carries the image with file ID 3 as image 2, and no other. */
const WRITER: WorkspaceIdWriter = {imageIdOf: fileId => (fileId === 3 ? 2 : undefined)};

/** A workspace being restored in which image 2 came back as file ID 7, with its region 5 as region 15. */
const READER: WorkspaceIdReader = {
    fileIdOf: imageId => (imageId === 2 ? 7 : undefined),
    regionIdOf: (imageId, regionId) => (regionId <= RegionId.CURSOR ? regionId : imageId === 2 && regionId === 5 ? 15 : undefined)
};

describe("which image and region a widget shows, in a workspace", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("names the image and regions by the IDs the workspace saves them with", () => {
        createSession();
        const store = new StatsWidgetStore();
        store.setFileId(3);
        store.setRegionId(3, 5);
        store.setRegionId(ACTIVE_FILE_ID, RegionId.ACTIVE);

        expect(store.toWorkspaceConfig(WRITER)).toEqual({
            imageId: 2,
            regions: [{imageId: 2, regionId: 5}, {regionId: RegionId.ACTIVE}],
            coordinate: "z"
        });
    });

    test("leaves out an image the workspace does not carry, and the regions chosen of it", () => {
        createSession();
        const store = new StatsWidgetStore();
        store.setFileId(9);
        store.setRegionId(9, 5);

        expect(store.toWorkspaceConfig(WRITER)).toEqual({coordinate: "z"});
    });

    test("shows the image and regions it was saved showing, by the IDs they have now", () => {
        createSession();
        const store = new StatsWidgetStore();

        const problems = store.applyWorkspaceBinding({imageId: 2, regions: [{imageId: 2, regionId: 5}, {regionId: RegionId.ACTIVE}]}, READER);

        expect(problems).toEqual([]);
        expect(store.fileId).toBe(7);
        expect(Array.from(store.regionIdMap.entries())).toEqual([
            [7, 15],
            [ACTIVE_FILE_ID, RegionId.ACTIVE]
        ]);
    });

    test("shows the active image and region in place of ones that were not restored, and says so", () => {
        createSession();
        const store = new StatsWidgetStore();

        expect(store.applyWorkspaceBinding({imageId: 4}, READER)).toEqual(["the image it showed was not restored, so it shows the active image"]);
        expect(store.fileId).toBe(ACTIVE_FILE_ID);

        expect(store.applyWorkspaceBinding({imageId: 2, regions: [{imageId: 2, regionId: 6}]}, READER)).toEqual(["the region it showed was not restored, so it shows the active region"]);
        expect(store.regionIdMap.size).toBe(0);
    });
});

describe("what a widget shows of its image, in a workspace", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("a spatial profiler keeps the Stokes it was saved in, though pointing it at another image resets it", () => {
        createSession();
        const store = new SpatialProfileWidgetStore();
        store.setSelectedStokes("Q");
        const config = store.toWorkspaceConfig(WRITER);

        const restored = new SpatialProfileWidgetStore();
        runInAction(() => restored.applyWorkspaceBinding({...config, imageId: 2}, READER));
        runInAction(() => restored.applyWorkspaceConfig(config));

        expect(config.stokes).toBe("Q");
        expect(restored.selectedStokes).toBe("Q");
    });

    test("a spatial profiler says so when the image it shows has no such Stokes", () => {
        createSession();
        const store = new SpatialProfileWidgetStore();

        expect(store.applyWorkspaceConfig({stokes: "V"})).toEqual(["the image it shows has no Stokes V, so it shows the current one"]);
    });

    test("a histogram is taken in the Stokes it was saved in", () => {
        createSession();
        const store = new HistogramWidgetStore();
        store.setCoordinate("Qz");
        const config = store.toWorkspaceConfig(WRITER);

        const restored = new HistogramWidgetStore();

        expect(restored.applyWorkspaceConfig(config)).toEqual([]);
        expect(restored.coordinate).toBe("Qz");
        expect(restored.applyWorkspaceConfig({coordinate: "Wz"})).toEqual(["it cannot be taken in the Stokes Wz"]);
    });
});

describe("the range a widget was zoomed to, in a workspace", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("a spatial profiler is zoomed back to the range it was saved at, on each axis that was zoomed", () => {
        createSession();
        const store = new SpatialProfileWidgetStore();
        store.setXBounds(1, 2);
        const config = store.toWorkspaceConfig(WRITER);

        const restored = new SpatialProfileWidgetStore();
        restored.applyWorkspaceBinding(config, READER);
        restored.applyWorkspaceConfig(config);

        expect(config).toEqual(expect.objectContaining({minX: 1, maxX: 2}));
        expect(config).not.toHaveProperty("minY");
        expect([restored.minX, restored.maxX, restored.minY, restored.maxY]).toEqual([1, 2, undefined, undefined]);
    });

    test("a widget that could not be pointed at the image it was saved showing is not zoomed to that image's range", () => {
        createSession();
        const store = new SpatialProfileWidgetStore();

        store.applyWorkspaceBinding({imageId: 4, minX: 1, maxX: 2}, READER);
        store.applyWorkspaceConfig({imageId: 4, minX: 1, maxX: 2});

        expect([store.minX, store.maxX]).toEqual([undefined, undefined]);
    });

    test("a histogram is computed between the pixel values it was saved with", () => {
        createSession();
        const store = new HistogramWidgetStore();
        store.setAutoBounds(false);
        store.setMinPix(-1);
        store.setMaxPix(5);
        const config = store.toWorkspaceConfig(WRITER);

        const restored = new HistogramWidgetStore();
        restored.applyWorkspaceConfig(config);

        expect(config.pixelBounds).toEqual({min: -1, max: 5});
        expect([restored.isCurrentAutoBounds, restored.currentMinPix, restored.currentMaxPix]).toEqual([false, -1, 5]);
    });

    test("a Stokes analysis widget's plots are zoomed back to the bounds they were saved at", () => {
        createSession();
        const store = new StokesAnalysisWidgetStore();
        store.setSharedXBounds(1, 2);
        store.setPolAngleYBounds(-90, 90);
        const config = store.toWorkspaceConfig(WRITER);

        const restored = new StokesAnalysisWidgetStore();
        restored.applyWorkspaceConfig(config);

        expect(config.ranges).toEqual({sharedMinX: 1, sharedMaxX: 2, polAngleMinY: -90, polAngleMaxY: 90});
        expect([restored.sharedMinX, restored.sharedMaxX, restored.polAngleMinY, restored.polAngleMaxY, restored.quMinY]).toEqual([1, 2, -90, 90, undefined]);
    });

    test("a render config widget's histogram is zoomed back to the range it was saved at", () => {
        createSession();
        const store = new RenderConfigWidgetStore();
        store.setXBounds(0, 10);
        store.setYBounds(1, 100);

        const restored = new RenderConfigWidgetStore();
        restored.applyWorkspaceConfig(store.toWorkspaceConfig());

        expect([restored.minX, restored.maxX, restored.minY, restored.maxY]).toEqual([0, 10, 1, 100]);
    });
});
