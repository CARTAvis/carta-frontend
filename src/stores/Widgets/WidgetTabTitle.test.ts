import {CARTA} from "carta-protobuf";

// "stores" loads before the widget stores. A widget store alone reaches ColormapComponent through a circular import before "utilities" is initialised.
import {AppStore} from "stores";

import {HistogramWidgetStore} from "./HistogramWidgetStore/HistogramWidgetStore";
import {ACTIVE_FILE_ID} from "./RegionWidgetStore/RegionWidgetStore";
import {SpatialProfileWidgetStore} from "./SpatialProfileWidgetStore/SpatialProfileWidgetStore";
import {StatsWidgetStore} from "./StatsWidgetStore/StatsWidgetStore";
import {StokesAnalysisWidgetStore} from "./StokesAnalysisWidgetStore/StokesAnalysisWidgetStore";

describe("the tab title of a region widget", () => {
    const line = {regionId: 1, regionType: CARTA.RegionType.LINE, nameString: "Region 1"};
    const rectangle = {regionId: 2, regionType: CARTA.RegionType.RECTANGLE, isClosedRegion: true, nameString: "Region 2"};
    const regions = [line, rectangle];
    const frame = {frameInfo: {fileId: 0}, renderConfig: {}, regionSet: {regions, focusedRegion: undefined}, getRegion: (regionId: number) => regions.find(region => region.regionId === regionId)};
    let appStoreMock: {activeFrame: unknown; frames: unknown[]; focusedRegion: unknown};

    beforeEach(() => {
        appStoreMock = {activeFrame: frame, frames: [frame], focusedRegion: {regionId: 0}};
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue(appStoreMock as any);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("names the region that a spatial profiler shows, without the coordinate for a line", () => {
        const store = new SpatialProfileWidgetStore();
        expect(store.tabTitle).toBe("X Profile: Cursor");

        store.setCoordinate("y");
        store.setRegionId(ACTIVE_FILE_ID, 1);
        expect(store.tabTitle).toBe(" Profile: Region #1");
    });

    test("names the region that a statistics widget or a histogram shows", () => {
        const stats = new StatsWidgetStore();
        const histogram = new HistogramWidgetStore();
        expect(stats.tabTitle).toBe("Statistics: Image (Active)");
        expect(histogram.tabTitle).toBe("Histogram: Image (Active)");

        stats.setRegionId(ACTIVE_FILE_ID, 2);
        histogram.setRegionId(ACTIVE_FILE_ID, 2);
        expect(stats.tabTitle).toBe("Statistics: Region 2 ");
        expect(histogram.tabTitle).toBe("Histogram: Region 2 ");

        appStoreMock.activeFrame = null;
        expect(stats.tabTitle).toBe("Statistics");
        expect(histogram.tabTitle).toBe("Histogram");
    });

    test("names the region that a Stokes analysis widget shows, with the progress", () => {
        const store = new StokesAnalysisWidgetStore();
        store.setRegionId(ACTIVE_FILE_ID, 2);
        expect(store.tabTitle).toBe("Stokes Analysis : Region #2  ");
        expect(store.tabTitleWith("[50% complete]")).toBe("Stokes Analysis : Region #2  [50% complete]");

        appStoreMock.activeFrame = null;
        expect(store.tabTitle).toBeUndefined();
    });
});
