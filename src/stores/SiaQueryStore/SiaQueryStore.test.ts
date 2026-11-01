import {type CARTA} from "carta-protobuf";

import {SIA_BAND_GROUPS, SIA_BANDS, SIA_TIME_RANGES, SiaDataProductType} from "enums";

const MockLoadRemoteFile = jest.fn();
const MOCK_FRAME = {
    isValidWcs: true,
    center: {x: 256, y: 256},
    regionSet: {focusedRegion: null as any}
};
const MockConvertToDeg = jest.fn();
jest.mock("stores", () => ({
    AppStore: {
        Instance: {
            loadRemoteFile: x => MockLoadRemoteFile(x)
        }
    },
    CatalogOnlineQueryConfigStore: {
        Instance: {
            get activeFrame() {
                return MOCK_FRAME;
            },
            convertToDeg: point => MockConvertToDeg(point),
            searchRadiusInDegree: 0.25
        }
    }
}));

const MockSiaQuery = jest.fn();
const MockResolveObject = jest.fn();
const MOCK_SERVICES = [
    {name: "GAVO", queryUrl: "https://example.org/sia2"},
    {name: "CADC", queryUrl: "https://example.org/v2query"}
];
let mockConfiguredServices: any = MOCK_SERVICES;
jest.mock("services", () => ({
    ApiService: {
        runtimeConfig: {
            get siaServices() {
                return mockConfiguredServices;
            }
        }
    },
    BackendService: {
        Instance: {
            siaQuery: message => MockSiaQuery(message)
        }
    },
    CatalogApiService: {
        Instance: {
            resolveObjectCoordinates: name => MockResolveObject(name)
        }
    }
}));

import {SiaQueryStore} from "./SiaQueryStore";

const FITS_RECORD: CARTA.SiaRecord.$Properties = {
    index: 1,
    obsId: "obs-1",
    targetName: "M31",
    accessUrl: "https://example.org/data/obs-1.fits",
    accessFormat: "application/fits"
};

const DATALINK_RECORD: CARTA.SiaRecord.$Properties = {
    index: 2,
    obsId: "obs-2",
    targetName: "M31",
    accessUrl: "https://example.org/datalink?ID=obs-2",
    accessFormat: "application/x-votable+xml;content=datalink"
};

describe("SiaQueryStore", () => {
    const store = SiaQueryStore.Instance;

    beforeEach(() => {
        store.clear();
        MOCK_FRAME.isValidWcs = true;
        MOCK_FRAME.regionSet.focusedRegion = null;
        MockConvertToDeg.mockReset();
    });

    it("offers no services when an operator has disabled SIA", () => {
        mockConfiguredServices = [];
        expect(store.services).toEqual([]);
        store.clear();
        expect(store.serviceUrl).toBe("");
        expect(store.isValid).toBe(false);
        mockConfiguredServices = MOCK_SERVICES;
    });

    it("falls back to built-in services when no backend config was served", () => {
        mockConfiguredServices = undefined;
        expect(store.services.length).toBeGreaterThan(0);
        mockConfiguredServices = MOCK_SERVICES;
    });

    it("takes its service list from the backend", () => {
        expect(store.services).toEqual(MOCK_SERVICES);
        expect(store.serviceUrl).toBe(MOCK_SERVICES[0].queryUrl);
        expect(store.object).toBe("");
        expect(store.center).toEqual({x: NaN, y: NaN});
        expect(store.radius).toBe(SiaQueryStore.DEFAULT_RADIUS);
        expect(store.maxrec).toBe(100);
        expect(store.dpType).toBe(SiaDataProductType.Any);
        expect(store.records).toEqual([]);
        expect(store.isQuerying).toBe(false);
    });

    it("requires a service URL and a valid position to query", () => {
        expect(store.isValid).toBe(false);
        store.setCenter(10.68, 41.27);
        expect(store.isValid).toBe(true);
        store.setRadius(0);
        expect(store.isValid).toBe(false);
        store.setRadius(0.5);
        store.setServiceUrl("");
        expect(store.isValid).toBe(false);
    });

    it("builds a query request from set filters only", () => {
        store.setCenter(10.68, 41.27);
        store.setRadius(0.5);
        store.setBandMin(2.1e-7);
        store.setCollection("SURVEY");
        store.setPol(["I", "Q"]);
        store.setCalibLevels([2, 3]);
        const request = store.queryRequest;
        expect(request.serviceUrl).toBe(store.serviceUrl);
        expect(request.ra).toBe(10.68);
        expect(request.dec).toBe(41.27);
        expect(request.radius).toBe(0.5);
        expect(request.filters).toEqual([
            {key: "BAND", value: "2.1e-7 +Inf"},
            {key: "POL", value: "I"},
            {key: "POL", value: "Q"},
            {key: "COLLECTION", value: "SURVEY"},
            {key: "CALIB", value: "2"},
            {key: "CALIB", value: "3"},
            {key: "MAXREC", value: "100"}
        ]);
    });

    it("includes a target name filter when set", () => {
        store.setCenter(1, 2);
        store.setTarget("M81");
        expect(store.queryRequest.filters).toContainEqual({key: "TARGET", value: "M81"});
    });

    it("includes the product type and time range when set", () => {
        store.setCenter(1, 2);
        store.setRadius(0.5);
        store.setDpType(SiaDataProductType.Cube);
        store.setTimeMax(55001);
        const filters = store.queryRequest.filters;
        expect(filters).toContainEqual({key: "TIME", value: "-Inf 55001"});
        expect(filters).toContainEqual({key: "DPTYPE", value: "cube"});
    });

    it("stores records from a successful query", async () => {
        store.setCenter(10.68, 41.27);
        store.setRadius(0.5);
        MockSiaQuery.mockResolvedValueOnce({success: true, records: [FITS_RECORD]});
        await store.query();
        expect(MockSiaQuery).toHaveBeenCalledWith(expect.objectContaining({ra: 10.68, dec: 41.27, radius: 0.5}));
        expect(store.records).toEqual([FITS_RECORD]);
        expect(store.queryError).toBe("");
        expect(store.isQuerying).toBe(false);
    });

    it("stores the error message from a failed query", async () => {
        store.setCenter(10.68, 41.27);
        store.setRadius(0.5);
        MockSiaQuery.mockResolvedValueOnce({success: false, message: "UsageFault: invalid POS value"});
        await store.query();
        expect(store.records).toEqual([]);
        expect(store.queryError).toContain("UsageFault");
        expect(store.isQuerying).toBe(false);
    });

    it("loads a record by its cached index", async () => {
        await store.loadRecord(FITS_RECORD);
        expect(MockLoadRemoteFile).toHaveBeenCalledWith(expect.objectContaining({siaRecordIndex: 1, filename: "obs-1"}));
    });

    it("loads DataLink records the same way", async () => {
        await store.loadRecord(DATALINK_RECORD);
        expect(MockLoadRemoteFile).toHaveBeenCalledWith(expect.objectContaining({siaRecordIndex: 2, filename: "obs-2"}));
    });

    it("identifies DataLink records for display", () => {
        expect(SiaQueryStore.isDataLinkRecord(FITS_RECORD)).toBe(false);
        expect(SiaQueryStore.isDataLinkRecord(DATALINK_RECORD)).toBe(true);
    });

    it("resolves an object name to center coordinates via SIMBAD", async () => {
        MockResolveObject.mockResolvedValueOnce({x: 10.68, y: 41.27});
        store.setObject("M31");
        await store.resolveObject();
        expect(MockResolveObject).toHaveBeenCalledWith("M31");
        expect(store.center).toEqual({x: 10.68, y: 41.27});
    });

    it("reports an unresolved object rather than moving the centre", async () => {
        MockResolveObject.mockResolvedValueOnce(undefined);
        store.setObject("not an object");
        await store.resolveObject();
        expect(store.center).toEqual({x: NaN, y: NaN});
        expect(store.queryError).toContain("not found");
    });

    it("clears results and filters", () => {
        store.setCollection("SURVEY");
        store.setCenter(1, 2);
        store.setRadius(3);
        store.clear();
        expect(store.collection).toBe("");
        expect(store.center).toEqual({x: NaN, y: NaN});
        expect(store.radius).toBe(SiaQueryStore.DEFAULT_RADIUS);
        expect(store.records).toEqual([]);
    });

    describe("result columns", () => {
        it("omits columns which are empty for every record", () => {
            store.setRecords([
                {index: 1, obsId: "obs-1", collection: "SURVEY"},
                {index: 2, obsId: "obs-2", collection: "SURVEY"}
            ]);
            const keys = store.columns.map(column => column.key);
            expect(keys).toContain("obsId");
            expect(keys).toContain("collection");
            expect(keys).not.toContain("targetName");
            expect(keys).not.toContain("instrument");
        });

        it("keeps a column when a single record has a value for it", () => {
            store.setRecords([
                {index: 1, obsId: "obs-1"},
                {index: 2, obsId: "obs-2", targetName: "M31"}
            ]);
            expect(store.columns.map(column => column.key)).toContain("targetName");
        });

        it("does not report an estimated size for DataLink records", () => {
            expect(SiaQueryStore.formatValue({...DATALINK_RECORD, accessEstsize: 10}, "accessEstsize")).toBe("");
            expect(SiaQueryStore.formatValue({...FITS_RECORD, accessEstsize: 1400}, "accessEstsize")).toBe("1.4 MB");
        });

        it("reports the access format rather than assuming FITS", () => {
            expect(SiaQueryStore.formatValue(FITS_RECORD, "accessFormat")).toBe("FITS");
            expect(SiaQueryStore.formatValue(DATALINK_RECORD, "accessFormat")).toBe("DataLink");
            expect(SiaQueryStore.formatValue({index: 3, accessFormat: "plain/text"}, "accessFormat")).toBe("plain/text");
        });

        it("omits the size column when only DataLink records report a size", () => {
            store.setRecords([{...DATALINK_RECORD, accessEstsize: 10}]);
            expect(store.columns.map(column => column.key)).not.toContain("accessEstsize");
        });
    });

    describe("filtering results", () => {
        const filterRecords: CARTA.SiaRecord.$Properties[] = [
            {index: 1, obsId: "obs-1", obsTitle: "Byurakan plate", instrument: "Cam1"},
            {index: 2, obsId: "obs-2", proposalTitle: "The Hubble Constant", instrument: "IRAC"},
            {index: 3, obsId: "obs-3", instrument: "MegaPrime"}
        ];

        beforeEach(() => store.setRecords(filterRecords));

        it("shows every record until a filter is typed", () => {
            expect(store.displayedRecords.length).toBe(3);
        });

        it("matches any displayed column, case insensitively", () => {
            store.setResultFilter("hubble");
            expect(store.displayedRecords.map(record => record.index)).toEqual([2]);
            store.setResultFilter("MEGA");
            expect(store.displayedRecords.map(record => record.index)).toEqual([3]);
        });

        it("reports when a filter hides everything", () => {
            store.setResultFilter("nothing matches this");
            expect(store.displayedRecords).toEqual([]);
        });

        it("clears the selection when the selected record is filtered out", () => {
            store.setSelectedRecord(filterRecords[0]);
            store.setResultFilter("hubble");
            expect(store.selectedRecord).toBeUndefined();
        });

        it("forgets the filter when the results are replaced", () => {
            store.setResultFilter("hubble");
            store.setRecords(filterRecords);
            expect(store.resultFilter).toBe("");
        });
    });

    describe("sorting", () => {
        const testRecords: CARTA.SiaRecord.$Properties[] = [
            {index: 1, obsId: "beta", accessEstsize: 300},
            {index: 2, obsId: "alpha", accessEstsize: 1000},
            {index: 3, obsId: "gamma", accessEstsize: 20}
        ];

        beforeEach(() => store.setRecords(testRecords));

        it("leaves records in service order until a column is sorted", () => {
            expect(store.displayedRecords.map(record => record.index)).toEqual([1, 2, 3]);
        });

        it("sorts strings ascending on the first click and descending on the second", () => {
            store.setSorting("obsId");
            expect(store.displayedRecords.map(record => record.obsId)).toEqual(["alpha", "beta", "gamma"]);
            store.setSorting("obsId");
            expect(store.displayedRecords.map(record => record.obsId)).toEqual(["gamma", "beta", "alpha"]);
        });

        it("sorts numeric columns by value rather than by their formatted text", () => {
            store.setSorting("accessEstsize");
            expect(store.displayedRecords.map(record => record.accessEstsize)).toEqual([20, 300, 1000]);
        });

        it("restarts ascending when a different column is sorted", () => {
            store.setSorting("obsId");
            store.setSorting("obsId");
            store.setSorting("accessEstsize");
            expect(store.isSortAscending).toBe(true);
        });

        it("keeps the selected record when the sort order changes", () => {
            store.setSelectedRecord(testRecords[2]);
            store.setSorting("obsId");
            expect(store.selectedRecord?.index).toBe(3);
            expect(store.selectedRow).toBe(2);
        });
    });

    describe("spectral bands", () => {
        const band = (name: string) => SIA_BANDS.find(item => item.name === name);

        it("sets the wavelength range from a named band", () => {
            store.setCenter(1, 2);
            store.setBand(band("Visible"));
            expect(store.bandMin).toBe(3.8e-7);
            expect(store.bandMax).toBe(7e-7);
            expect(store.queryRequest.filters).toContainEqual({key: "BAND", value: "3.8e-7 7e-7"});
        });

        it("converts bands the source defines by frequency or by energy", () => {
            // ELF is 3-30 Hz, and soft X-rays 0.124-12.4 keV
            expect(band("Extremely low frequency (ELF)")?.max).toBeCloseTo(299792458 / 3, 0);
            expect(band("Super high frequency (SHF)")?.min).toBeCloseTo(0.01, 4);
            expect(band("Soft X-ray")?.max).toBeCloseTo(1e-8, 10);
            expect(band("Hard X-ray")?.min).toBeCloseTo(1e-11, 13);
        });

        it("leaves the open end of the spectrum unbounded", () => {
            store.setCenter(1, 2);
            store.setBand(band("Gamma ray"));
            expect(store.bandMin).toBeNaN();
            expect(store.bandMax).toBeCloseTo(1e-11, 13);
            expect(store.queryRequest.filters?.find(filter => filter.key === "BAND")?.value).toContain("-Inf ");
        });

        it("lists every band well formed and ordered from long to short wavelength", () => {
            // The composite heading each group overlaps its sub-bands, and some groups overlap each other
            SIA_BAND_GROUPS.forEach(group => {
                expect(group.bands[0].name).toContain(group.name.split(" ")[0]);
                const subBands = group.bands.slice(1);
                subBands.forEach(item => expect(isNaN(item.min) ? -Infinity : item.min).toBeLessThan(item.max));
                subBands.slice(1).forEach((item, index) => expect(item.max).toBeLessThanOrEqual(subBands[index].max));
            });
        });

        it("reports no band once a wavelength is edited by hand", () => {
            store.setBand(band("Visible"));
            store.setBandMax(6.5e-7);
            expect(store.selectedBand).toBeUndefined();
        });

        it("reports no band when no wavelength range is set", () => {
            expect(store.selectedBand).toBeUndefined();
        });

        it("clears the wavelength range", () => {
            store.setBand(band("Visible"));
            store.setBand(undefined);
            expect(store.bandMin).toBeNaN();
            expect(store.bandMax).toBeNaN();
            expect(store.selectedBand).toBeUndefined();
        });
    });

    describe("relative time ranges", () => {
        // The unix epoch is MJD 40587, so 2000-01-01T00:00:00Z is MJD 51544
        const now = Date.UTC(2000, 0, 1);

        it("converts a span of days before a given moment to MJD", () => {
            expect(SiaQueryStore.relativeMjdRange(7, now)).toEqual({min: 51537, max: 51544});
            // Whole days: the range covers every observation of the first and last day
            const midMorning = now + 9 * 3600 * 1000;
            expect(SiaQueryStore.relativeMjdRange(7, midMorning)).toEqual({min: 51537, max: 51545});
            expect(SiaQueryStore.relativeMjdRange(30, midMorning)).toEqual({min: 51514, max: 51545});
        });

        it("sets the time filter from a relative range", () => {
            store.setCenter(1, 2);
            store.setRelativeTimeRange(SIA_TIME_RANGES.find(range => range.name === "Last year")?.days, now);
            expect(store.timeMax).toBe(51544);
            expect(store.timeMin).toBe(51179);
            expect(store.queryRequest.filters).toContainEqual({key: "TIME", value: "51179 51544"});
        });

        it("offers ranges which grow from a week to a decade", () => {
            expect(SIA_TIME_RANGES.map(range => range.days)).toEqual([...SIA_TIME_RANGES.map(range => range.days)].sort((a, b) => a - b));
            SIA_TIME_RANGES.forEach(range => expect(range.days).toBeGreaterThan(0));
        });

        it("clears the time range", () => {
            store.setCenter(1, 2);
            store.setRelativeTimeRange(30, now);
            store.setRelativeTimeRange(0, now);
            expect(store.timeMin).toBeNaN();
            expect(store.timeMax).toBeNaN();
            expect(store.queryRequest.filters).not.toContainEqual(expect.objectContaining({key: "TIME"}));
        });
    });

    describe("position from the image", () => {
        it("sets the center and radius from the current view", () => {
            MockConvertToDeg.mockReturnValueOnce({x: "148.888", y: "69.065"});
            store.setFromView();
            expect(MockConvertToDeg).toHaveBeenCalledWith(MOCK_FRAME.center);
            expect(store.center).toEqual({x: 148.888, y: 69.065});
            expect(store.radius).toBe(0.25);
        });

        it("ignores the view when the frame has no valid WCS", () => {
            MOCK_FRAME.isValidWcs = false;
            store.setFromView();
            expect(store.center).toEqual({x: NaN, y: NaN});
        });

        it("sets the center and radius from the focused region", () => {
            MOCK_FRAME.regionSet.focusedRegion = {isClosedRegion: true, center: {x: 100, y: 100}, boundingBox: {x: 40, y: 40}};
            MockConvertToDeg.mockReturnValueOnce({x: "10", y: "0"}).mockReturnValueOnce({x: "10.1", y: "0.1"});
            store.setFromRegion();
            expect(store.center).toEqual({x: 10, y: 0});
            expect(store.radius).toBe(Number(Math.sqrt(0.02).toPrecision(6)));
        });

        it("explains why the view and region buttons are unavailable", () => {
            MOCK_FRAME.isValidWcs = false;
            expect(store.setFromViewTooltip).toContain("no valid WCS");
            expect(store.setFromRegionTooltip).toContain("no valid WCS");

            MOCK_FRAME.isValidWcs = true;
            expect(store.setFromRegionTooltip).toContain("Select a closed region");

            MOCK_FRAME.regionSet.focusedRegion = {isClosedRegion: true, center: {x: 1, y: 1}, boundingBox: {x: 4, y: 4}, nameString: "Region 1"};
            expect(store.setFromRegionTooltip).toContain("Region 1");
        });

        it("ignores regions which enclose no area", () => {
            MOCK_FRAME.regionSet.focusedRegion = {isClosedRegion: false, center: {x: 100, y: 100}, boundingBox: {x: 0, y: 0}};
            store.setFromRegion();
            expect(store.canSetFromRegion).toBe(false);
            expect(store.center).toEqual({x: NaN, y: NaN});
        });
    });
});
