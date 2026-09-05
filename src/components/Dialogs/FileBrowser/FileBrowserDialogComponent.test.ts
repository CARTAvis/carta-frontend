import {AppStore} from "stores";
import {type FrameStore} from "stores/Frame";

import {FileBrowserDialogComponent} from "./FileBrowserDialogComponent";

interface TestableFileBrowserDialogComponent {
    loadSelectedFiles: jest.Mock<Promise<FrameStore[]>>;
    loadAsTimeSeries: () => Promise<void>;
}

describe("FileBrowserDialogComponent", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("loadAsTimeSeries spatially matches only the newly loaded frames in append mode", async () => {
        const spatialReference = {filename: "reference.fits"} as FrameStore;
        const existingFrame = {filename: "existing.fits"} as FrameStore;
        const loadedFrameA = {filename: "loaded-a.fits"} as FrameStore;
        const loadedFrameB = {filename: "loaded-b.fits"} as FrameStore;
        const loadedFrames = [loadedFrameA, loadedFrameB];
        const setSpatialMatchingEnabled = jest.fn(async (frame: FrameStore) => {
            frame.spatialReference = spatialReference;
        });
        const setTimeSeriesMember = jest.fn();

        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({
            frames: [spatialReference, existingFrame, ...loadedFrames],
            spatialReference,
            setSpatialMatchingEnabled,
            setTimeSeriesMember,
            timeSeriesStore: {
                elements: [{frame: loadedFrameA}, {frame: loadedFrameB}],
                first: jest.fn()
            },
            animatorStore: {setAnimationMode: jest.fn()},
            widgetsStore: {selectDockedWidgetTab: jest.fn()}
        } as unknown as AppStore);

        const component = new FileBrowserDialogComponent({}) as unknown as TestableFileBrowserDialogComponent;
        component.loadSelectedFiles = jest.fn().mockResolvedValue(loadedFrames);

        await component.loadAsTimeSeries();

        expect(setSpatialMatchingEnabled.mock.calls.map(([frame]) => frame)).toEqual(loadedFrames);
        expect(setSpatialMatchingEnabled).not.toHaveBeenCalledWith(spatialReference, true);
        expect(setSpatialMatchingEnabled).not.toHaveBeenCalledWith(existingFrame, true);
        expect(setTimeSeriesMember.mock.calls.map(([frame]) => frame)).toEqual(loadedFrames);
    });
});
