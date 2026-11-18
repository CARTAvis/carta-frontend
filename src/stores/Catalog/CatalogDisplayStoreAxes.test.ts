import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {CatalogOverlay, CatalogPlotType, CatalogSystemType, CatalogType, CatalogUpdateMode, PreferenceKeys} from "enums";
import {AppStore, CatalogDisplayStore, CatalogProfileStore, CatalogStore, PreferenceStore} from "stores";
import {CatalogAxisEligibility, type CatalogAxisEligibilityResult, COORDINATE_SNIFF_SCAN_LIMIT, getCatalogAxisEligibility, getCoordinateDescriptorFromUnits, isCatalogNumericDataType} from "utilities";

type MockColumn = {
    display?: boolean;
    dataType?: CARTA.ColumnType;
    name: string;
    units?: string;
    /** Sample values. A unitless string column without them is Unknown, not eligible. */
    data?: Array<string | number | null>;
};

type MockProfileStore = {
    activedSystem: {x: CatalogOverlay; y: CatalogOverlay} | undefined;
    catalogControlHeader: Map<string, {dataIndex: number; display: boolean; filter: string}>;
    catalogCoordinateSystem: {system: CatalogSystemType};
    catalogData: Map<number, {dataType: CARTA.ColumnType; data: Array<string | number | null>}>;
    catalogHeader: Array<{columnIndex: number; dataType: CARTA.ColumnType; name: string; units?: string}>;
    displayedNumericColumnNames: string[];
    isNumericColumn: (columnName: string) => boolean;
    isFileBasedCatalog: boolean;
    shouldUpdateData?: boolean;
    getCoordinateEligibility: jest.Mock<CatalogAxisEligibilityResult, [string]>;
    setCatalogCoordinateSystem: jest.Mock<void, [CatalogSystemType]>;
    setIsUpdateColumn: jest.Mock<void, [boolean]>;
    setHeaderDisplay: jest.Mock<void, [boolean, string]>;
    setUpdateMode: jest.Mock<void, [CatalogUpdateMode]>;
};

const SYSTEM_OVERLAY_MAP = new Map<CatalogSystemType, {x: CatalogOverlay; y: CatalogOverlay}>([
    [CatalogSystemType.FK4, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
    [CatalogSystemType.FK5, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
    [CatalogSystemType.ICRS, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
    [CatalogSystemType.Galactic, {x: CatalogOverlay.GLON, y: CatalogOverlay.GLAT}],
    [CatalogSystemType.Ecliptic, {x: CatalogOverlay.ELON, y: CatalogOverlay.ELAT}],
    [CatalogSystemType.Pixel0, {x: CatalogOverlay.X0, y: CatalogOverlay.Y0}],
    [CatalogSystemType.Pixel1, {x: CatalogOverlay.X1, y: CatalogOverlay.Y1}]
]);

/** A profile store whose every field can be set by hand, for rules that do not need MobX to fire. */
function createMockProfileStore(system: CatalogSystemType, columns: MockColumn[]): MockProfileStore {
    const catalogControlHeader = new Map<string, {dataIndex: number; display: boolean; filter: string}>();
    const catalogData = new Map<number, {dataType: CARTA.ColumnType; data: Array<string | number | null>}>();
    const catalogHeader = columns.map((column, index) => {
        catalogControlHeader.set(column.name, {dataIndex: index, display: column.display ?? true, filter: ""});
        const dataType = column.dataType ?? CARTA.ColumnType.Double;
        if (column.data) {
            catalogData.set(index, {dataType, data: column.data});
        }
        return {columnIndex: index, dataType, name: column.name, units: column.units};
    });

    const isNumericColumn = (columnName: string): boolean => {
        const controlHeader = catalogControlHeader.get(columnName);
        return controlHeader !== undefined && isCatalogNumericDataType(catalogHeader[controlHeader.dataIndex]?.dataType);
    };

    const profileStore = {
        activedSystem: SYSTEM_OVERLAY_MAP.get(system),
        catalogControlHeader,
        catalogCoordinateSystem: {system},
        catalogData,
        catalogHeader,
        get displayedNumericColumnNames(): string[] {
            return Array.from(catalogControlHeader)
                .filter(([columnName, header]) => header.display && isNumericColumn(columnName))
                .map(([columnName]) => columnName);
        },
        isNumericColumn,
        isFileBasedCatalog: false,
        getCoordinateEligibility: jest.fn(),
        setCatalogCoordinateSystem: jest.fn(),
        setIsUpdateColumn: jest.fn(),
        setHeaderDisplay: jest.fn(),
        setUpdateMode: jest.fn()
    } as MockProfileStore;

    profileStore.getCoordinateEligibility.mockImplementation((columnName: string) => {
        const controlHeader = profileStore.catalogControlHeader.get(columnName);
        const headerInfo = controlHeader ? profileStore.catalogHeader[controlHeader.dataIndex] : undefined;
        const column = profileStore.catalogData.get(headerInfo?.columnIndex ?? NaN);
        const sampleData = column?.dataType === CARTA.ColumnType.String ? (column.data as Array<string | null | undefined>) : undefined;
        const eligibility = getCatalogAxisEligibility(headerInfo?.dataType, headerInfo?.units, sampleData);
        const isUnresolvedString = headerInfo?.dataType === CARTA.ColumnType.String && !getCoordinateDescriptorFromUnits(headerInfo?.units);
        if (eligibility.status === CatalogAxisEligibility.Ineligible && isUnresolvedString && profileStore.isFileBasedCatalog && profileStore.shouldUpdateData) {
            return {status: CatalogAxisEligibility.Unknown, reason: "Column coordinate format is still being determined from streamed values."};
        }
        return eligibility;
    });
    profileStore.setCatalogCoordinateSystem.mockImplementation((nextSystem: CatalogSystemType) => {
        profileStore.catalogCoordinateSystem.system = nextSystem;
        profileStore.activedSystem = SYSTEM_OVERLAY_MAP.get(nextSystem);
    });
    profileStore.setHeaderDisplay.mockImplementation((shouldDisplay: boolean, columnName: string) => {
        const header = profileStore.catalogControlHeader.get(columnName);
        if (header) {
            header.display = shouldDisplay;
        }
    });

    // A class instance, so that the observable map holding profile stores keeps this object rather
    // than an observable copy the mocks above would not see.
    return Object.setPrototypeOf(profileStore, MockProfile.prototype);
}

class MockProfile {}

/** A real profile store, for rules that wait on MobX to tell them new rows arrived. */
function createProfileStore(catalogFileId: number, system: CatalogSystemType, columns: MockColumn[], dataSize = 0): CatalogProfileStore {
    const catalogHeader = columns.map((column, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: column.dataType ?? CARTA.ColumnType.Double, name: column.name, units: column.units}));
    const profileStore = new CatalogProfileStore({dataSize, directory: "", fileId: catalogFileId, fileInfo: new CARTA.CatalogFileInfo({name: "test-catalog"})}, catalogHeader, new Map(), CatalogType.FILE);
    profileStore.setCatalogCoordinateSystem(system);
    columns.forEach(column => {
        if (column.display !== undefined) {
            profileStore.setHeaderDisplay(column.display, column.name);
        }
    });
    return profileStore;
}

let nextCatalogFileId = 20_000;
const OPENED: number[] = [];

/**
 * Open a catalog the way CatalogStore does: its display store first, with the axes it starts on,
 * and then its data. Axis auto-selection runs as soon as the data is there.
 */
function openCatalog<P>(makeProfileStore: (catalogFileId: number) => P, options: {xAxis?: string; yAxis?: string; catalogPlotType?: CatalogPlotType} = {}) {
    const catalogFileId = nextCatalogFileId++;
    const profileStore = makeProfileStore(catalogFileId);
    const displayStore = new CatalogDisplayStore(catalogFileId);
    OPENED.push(catalogFileId);
    runInAction(() => {
        displayStore.setxAxis(options.xAxis ?? CatalogOverlay.NONE);
        displayStore.setyAxis(options.yAxis ?? CatalogOverlay.NONE);
        if (options.catalogPlotType !== undefined) {
            displayStore.setCatalogPlotType(options.catalogPlotType);
        }
        CatalogStore.Instance.catalogDisplayStores.set(catalogFileId, displayStore);
        CatalogStore.Instance.catalogProfileStores.set(catalogFileId, profileStore as any);
    });
    return {catalogFileId, profileStore, displayStore};
}

function openMockCatalog(system: CatalogSystemType, columns: MockColumn[], options: {xAxis?: string; yAxis?: string; catalogPlotType?: CatalogPlotType; configure?: (profileStore: MockProfileStore) => void} = {}) {
    return openCatalog(() => {
        const profileStore = createMockProfileStore(system, columns);
        options.configure?.(profileStore);
        return profileStore;
    }, options);
}

function setAutoSelect(isEnabled: boolean) {
    PreferenceStore.Instance.setPreference(PreferenceKeys.CATALOG_AUTO_SELECT_IMAGE_OVERLAY_COLUMNS, isEnabled);
}

describe("CatalogDisplayStore overlay axes", () => {
    let shouldAutoSelectOriginally: boolean;

    beforeAll(() => {
        shouldAutoSelectOriginally = PreferenceStore.Instance.shouldAutoSelectImageOverlayCoordinateColumns;
    });

    beforeEach(() => {
        setAutoSelect(true);
    });

    afterEach(() => {
        runInAction(() => {
            OPENED.forEach(catalogFileId => {
                CatalogStore.Instance.catalogDisplayStores.get(catalogFileId)?.dispose();
                CatalogStore.Instance.catalogDisplayStores.delete(catalogFileId);
                CatalogStore.Instance.catalogProfileStores.delete(catalogFileId);
            });
            AppStore.Instance.isLoadingWorkspace = false;
        });
        OPENED.length = 0;
        jest.restoreAllMocks();
    });

    afterAll(() => {
        setAutoSelect(shouldAutoSelectOriginally);
    });

    describe("auto-selection when a catalog opens", () => {
        test.each([
            ["FK5", CatalogSystemType.FK5, [{name: "flux"}, {name: "_RAJ2000"}, {name: "_DEJ2000"}], "_RAJ2000", "_DEJ2000"],
            ["FK4", CatalogSystemType.FK4, [{name: "flux"}, {name: "ra"}, {name: "dec"}], "ra", "dec"],
            ["ICRS", CatalogSystemType.ICRS, [{name: "flux"}, {name: "RAJ2000"}, {name: "DEJ2000"}], "RAJ2000", "DEJ2000"],
            ["ICRS explicit", CatalogSystemType.ICRS, [{name: "flux"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}], "RA_ICRS", "DE_ICRS"],
            ["Galactic", CatalogSystemType.Galactic, [{name: "flux"}, {name: "GLON"}, {name: "GLAT"}], "GLON", "GLAT"],
            ["Ecliptic", CatalogSystemType.Ecliptic, [{name: "flux"}, {name: "ecl_lon"}, {name: "ecl_lat"}], "ecl_lon", "ecl_lat"],
            ["Pixel0 centroid", CatalogSystemType.Pixel0, [{name: "id"}, {name: "xcentroid"}, {name: "ycentroid"}], "xcentroid", "ycentroid"],
            ["Pixel0 peak", CatalogSystemType.Pixel0, [{name: "id"}, {name: "xpeak"}, {name: "ypeak"}], "xpeak", "ypeak"],
            ["Pixel1 image", CatalogSystemType.Pixel1, [{name: "id"}, {name: "X_IMAGE"}, {name: "Y_IMAGE"}], "X_IMAGE", "Y_IMAGE"],
            ["Pixel1 windowed image", CatalogSystemType.Pixel1, [{name: "id"}, {name: "XWIN_IMAGE"}, {name: "YWIN_IMAGE"}], "XWIN_IMAGE", "YWIN_IMAGE"]
        ])("picks %s aliases from catalog columns", (_label, system, columns, expectedX, expectedY) => {
            const {displayStore} = openMockCatalog(system, columns);

            expect(displayStore.xAxis).toBe(expectedX);
            expect(displayStore.yAxis).toBe(expectedY);
        });

        test.each([
            ["X-axis", [{name: "ra"}], "ra", CatalogOverlay.NONE],
            ["Y-axis", [{name: "dec"}], CatalogOverlay.NONE, "dec"]
        ])("selects only the available %s candidate", (_label, columns, expectedX, expectedY) => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, columns);

            expect(displayStore.xAxis).toBe(expectedX);
            expect(displayStore.yAxis).toBe(expectedY);
        });

        test("skips excluded coordinate-like error columns", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [{name: "e_ra"}, {name: "pmdec"}, {name: "ra"}, {name: "dec"}]);

            expect(displayStore.xAxis).toBe("ra");
            expect(displayStore.yAxis).toBe("dec");
        });

        test("skips columns when data type metadata is missing", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}], {configure: profileStore => (profileStore.catalogHeader = [])});

            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("auto-selects hms and dms coordinate columns", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [
                {name: "RA1", dataType: CARTA.ColumnType.String, units: "hms"},
                {name: "DEC1", dataType: CARTA.ColumnType.String, units: "dms"}
            ]);

            expect(displayStore.xAxis).toBe("RA1");
            expect(displayStore.yAxis).toBe("DEC1");
        });

        test("auto-selects a unitless string column once its values can be sniffed", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [
                {name: "RA1", dataType: CARTA.ColumnType.String, data: ["12:30:00", "10:15:30"]},
                {name: "DEC1", dataType: CARTA.ColumnType.String, data: ["-21:57:15", "+02:28:35"]}
            ]);

            expect(displayStore.xAxis).toBe("RA1");
            expect(displayStore.yAxis).toBe("DEC1");
        });

        test("falls back to a string column whose values have not been loaded", () => {
            // Nothing but the name says these are coordinates. Selecting them costs a round trip
            // and may be wrong, so it happens only once every better-evidenced option is exhausted.
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [
                {name: "RA1", dataType: CARTA.ColumnType.String},
                {name: "DEC1", dataType: CARTA.ColumnType.String}
            ]);

            expect(displayStore.xAxis).toBe("RA1");
            expect(displayStore.yAxis).toBe("DEC1");
        });

        test("prefers a column identified by its values over one identified only by its name", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [
                {name: "RAJ2000", dataType: CARTA.ColumnType.String},
                {name: "DEJ2000", dataType: CARTA.ColumnType.String},
                {name: "ra", dataType: CARTA.ColumnType.String, data: ["12:30:00"]},
                {name: "dec", dataType: CARTA.ColumnType.String, data: ["-21:57:15"]}
            ]);

            // "RAJ2000" ranks above "ra", but it is Unknown, so the eligible pair wins the pass.
            expect(displayStore.xAxis).toBe("ra");
            expect(displayStore.yAxis).toBe("dec");
        });

        test("does not fall back to a column whose values rule it out", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [
                {name: "RA1", dataType: CARTA.ColumnType.String, data: ["NGC 1333", "NGC 2264"]},
                {name: "DEC1", dataType: CARTA.ColumnType.String, data: ["Taurus", "Monoceros"]}
            ]);

            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test.each([
            ["Galactic", CatalogSystemType.Galactic, "GLON1", "GLAT1"],
            ["Ecliptic", CatalogSystemType.Ecliptic, "ELON1", "ELAT1"],
            ["Pixel0", CatalogSystemType.Pixel0, "xcentroid", "ycentroid"],
            ["Pixel1", CatalogSystemType.Pixel1, "X_IMAGE", "Y_IMAGE"]
        ])("includes and auto-selects string %s coordinate columns", (_label, system, xColumn, yColumn) => {
            const {displayStore} = openMockCatalog(system, [
                {name: xColumn, dataType: CARTA.ColumnType.String, data: ["12:30:00"]},
                {name: yColumn, dataType: CARTA.ColumnType.String, data: ["-21:57:15"]}
            ]);

            expect(displayStore.xAxisOptions).toEqual([CatalogOverlay.NONE, xColumn, yColumn]);
            expect(displayStore.yAxisOptions).toEqual([CatalogOverlay.NONE, yColumn, xColumn]);
            expect(displayStore.xAxis).toBe(xColumn);
            expect(displayStore.yAxis).toBe(yColumn);
        });

        test("prefers FK4 columns over explicit J2000 or ICRS columns", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.FK4, [{name: "RAJ2000"}, {name: "DEJ2000"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}, {name: "RAB1950"}, {name: "DEB1950"}]);

            expect(displayStore.xAxis).toBe("RAB1950");
            expect(displayStore.yAxis).toBe("DEB1950");
        });

        test("prefers FK5 columns over explicit B1950 or ICRS columns", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.FK5, [{name: "RAB1950"}, {name: "DEB1950"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}, {name: "RAJ2000"}, {name: "DEJ2000"}]);

            expect(displayStore.xAxis).toBe("RAJ2000");
            expect(displayStore.yAxis).toBe("DEJ2000");
        });

        test("prefers ICRS columns and excludes explicit B1950 columns", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [{name: "RAB1950"}, {name: "DEB1950"}, {name: "RAJ2000"}, {name: "DEJ2000"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}]);

            expect(displayStore.xAxis).toBe("RA_ICRS");
            expect(displayStore.yAxis).toBe("DE_ICRS");
        });

        test("only treats J2000 FK5 columns as ICRS-compatible", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [{name: "RAJ2021"}, {name: "DEJ2021"}, {name: "RAJ2000"}, {name: "DEJ2000"}]);

            expect(displayStore.xAxis).toBe("RAJ2000");
            expect(displayStore.yAxis).toBe("DEJ2000");
        });

        test.each([
            ["FK4", CatalogSystemType.FK4, "RAJ2015", "DEJ2015", "RAB1975", "DEB1975", "RAB1975", "DEB1975"],
            ["FK5", CatalogSystemType.FK5, "RAB1975", "DEB1975", "RAJ2015", "DEJ2015", "RAJ2015", "DEJ2015"],
            ["ICRS", CatalogSystemType.ICRS, "RAB1975", "DEB1975", "RA_ICRS", "DE_ICRS", "RA_ICRS", "DE_ICRS"]
        ])("filters generic epoch-specific equatorial columns for %s", (_label, system, incompatibleX, incompatibleY, compatibleX, compatibleY, expectedX, expectedY) => {
            const {displayStore} = openMockCatalog(system, [{name: incompatibleX}, {name: incompatibleY}, {name: compatibleX}, {name: compatibleY}]);

            expect(displayStore.xAxis).toBe(expectedX);
            expect(displayStore.yAxis).toBe(expectedY);
        });

        test("enables hidden matching columns when no visible coordinate columns are available", () => {
            const requestFilteredRows = jest.spyOn(CatalogStore.Instance, "requestFilteredRows").mockImplementation(jest.fn());
            const {catalogFileId, profileStore, displayStore} = openMockCatalog(CatalogSystemType.Pixel0, [{name: "flux"}, {name: "xcentroid", display: false}, {name: "ycentroid", display: false}], {
                configure: profileStore => (profileStore.isFileBasedCatalog = true)
            });

            expect(displayStore.xAxis).toBe("xcentroid");
            expect(displayStore.yAxis).toBe("ycentroid");
            expect(profileStore.setHeaderDisplay).toHaveBeenCalledWith(true, "xcentroid");
            expect(profileStore.setHeaderDisplay).toHaveBeenCalledWith(true, "ycentroid");
            expect(profileStore.setUpdateMode).toHaveBeenCalledWith(CatalogUpdateMode.TableUpdate);
            expect(profileStore.setIsUpdateColumn).toHaveBeenCalledWith(true);
            expect(requestFilteredRows).toHaveBeenCalledWith(catalogFileId);
        });

        test("does nothing when preference is disabled", () => {
            setAutoSelect(false);
            const requestFilteredRows = jest.spyOn(CatalogStore.Instance, "requestFilteredRows").mockImplementation(jest.fn());
            const {profileStore, displayStore} = openMockCatalog(CatalogSystemType.Pixel0, [{name: "flux"}, {name: "xcentroid", display: false}, {name: "ycentroid", display: false}], {
                configure: profileStore => (profileStore.isFileBasedCatalog = true)
            });

            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);
            expect(profileStore.setHeaderDisplay).not.toHaveBeenCalled();
            expect(requestFilteredRows).not.toHaveBeenCalled();
        });
    });

    describe("streamed coordinate formats", () => {
        const configureStreaming = (profileStore: MockProfileStore) => Object.assign(profileStore, {isFileBasedCatalog: true, isLoadingData: false, shouldUpdateData: true, updateMode: CatalogUpdateMode.TableUpdate});

        test("requests another streamed chunk while coordinate formats are unknown", () => {
            const requestMoreRows = jest.spyOn(CatalogStore.Instance, "requestMoreRows").mockImplementation(jest.fn());
            const {catalogFileId, displayStore} = openMockCatalog(
                CatalogSystemType.ICRS,
                [
                    {name: "ra", dataType: CARTA.ColumnType.String},
                    {name: "dec", dataType: CARTA.ColumnType.String}
                ],
                {configure: configureStreaming}
            );

            expect(requestMoreRows).toHaveBeenCalledWith(catalogFileId);
            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(false);
        });

        test("stops streaming once the coordinate sniff scan limit is loaded", () => {
            const requestMoreRows = jest.spyOn(CatalogStore.Instance, "requestMoreRows").mockImplementation(jest.fn());
            const sample = new Array<string>(COORDINATE_SNIFF_SCAN_LIMIT).fill("not a coordinate");
            const {displayStore} = openMockCatalog(
                CatalogSystemType.ICRS,
                [
                    {name: "ra", dataType: CARTA.ColumnType.String, data: sample},
                    {name: "dec", dataType: CARTA.ColumnType.String, data: sample}
                ],
                {configure: configureStreaming}
            );

            expect(requestMoreRows).not.toHaveBeenCalled();
            expect(displayStore.xAxis).toBe("ra");
            expect(displayStore.yAxis).toBe("dec");
        });

        test("does not stream ordinary string columns while looking for axes", () => {
            const requestMoreRows = jest.spyOn(CatalogStore.Instance, "requestMoreRows").mockImplementation(jest.fn());
            const {displayStore} = openMockCatalog(
                CatalogSystemType.ICRS,
                [
                    {name: "object_name", dataType: CARTA.ColumnType.String, data: ["NGC 1333", "NGC 2264"]},
                    {name: "description", dataType: CARTA.ColumnType.String, data: ["Taurus", "Monoceros"]}
                ],
                {configure: configureStreaming}
            );

            expect(requestMoreRows).not.toHaveBeenCalled();
            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("retries after a noisy streamed coordinate chunk becomes established", () => {
            const {profileStore, displayStore} = openCatalog(catalogFileId => {
                const profileStore = createProfileStore(
                    catalogFileId,
                    CatalogSystemType.ICRS,
                    [
                        {name: "ra", dataType: CARTA.ColumnType.String},
                        {name: "dec", dataType: CARTA.ColumnType.String}
                    ],
                    200
                );
                profileStore.setSubsetEndIndex(2);
                jest.spyOn(CatalogStore.Instance, "requestMoreRows").mockImplementation(() => profileStore.setLoadingDataStatus(true));
                return profileStore;
            });

            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(false);

            runInAction(() => {
                profileStore.catalogOriginalData.set(0, {dataType: CARTA.ColumnType.String, data: ["12:30:00", "--"]});
                profileStore.catalogOriginalData.set(1, {dataType: CARTA.ColumnType.String, data: ["-21:57:15", "--"]});
            });

            // The first chunk is deliberately inconclusive: one coordinate and one placeholder
            // must not consume the one-shot auto-selection attempt.
            expect(displayStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(false);

            runInAction(() => {
                profileStore.catalogOriginalData.set(0, {dataType: CARTA.ColumnType.String, data: ["12:30:00", "--", "13:00:00", ...new Array(197).fill("14:00:00")]});
                profileStore.catalogOriginalData.set(1, {dataType: CARTA.ColumnType.String, data: ["-21:57:15", "--", "-22:00:00", ...new Array(197).fill("-23:00:00")]});
                profileStore.setSubsetEndIndex(200);
            });

            expect(displayStore.xAxis).toBe("ra");
            expect(displayStore.yAxis).toBe("dec");
            expect(displayStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(true);
        });

        test("refreshes column eligibility when catalog values arrive", () => {
            const {profileStore, displayStore} = openCatalog(catalogFileId => createProfileStore(catalogFileId, CatalogSystemType.ICRS, [{name: "RA1", dataType: CARTA.ColumnType.String}]));

            expect(displayStore.axisColumnEligibility.get("RA1")?.status).toBe(CatalogAxisEligibility.Unknown);

            runInAction(() => profileStore.catalogOriginalData.set(0, {dataType: CARTA.ColumnType.String, data: ["12:30:00"]}));

            expect(displayStore.axisColumnEligibility.get("RA1")?.status).toBe(CatalogAxisEligibility.Eligible);
        });

        test("refreshes column eligibility when a streamed update replaces an existing array", () => {
            const {profileStore, displayStore} = openCatalog(catalogFileId => createProfileStore(catalogFileId, CatalogSystemType.ICRS, [{name: "RA1", dataType: CARTA.ColumnType.String}], 2));

            runInAction(() => profileStore.catalogOriginalData.set(0, {dataType: CARTA.ColumnType.String, data: ["", ""]}));
            expect(displayStore.axisColumnEligibility.get("RA1")?.status).toBe(CatalogAxisEligibility.Unknown);

            profileStore.updateCatalogData({filterDataSize: 2, requestEndIndex: 2, subsetDataSize: 2, subsetEndIndex: 2} as CARTA.CatalogFilterResponse, new Map([[0, {dataType: CARTA.ColumnType.String, data: ["12:30:00", "13:00:00"]}]]));

            expect(displayStore.axisColumnEligibility.get("RA1")?.status).toBe(CatalogAxisEligibility.Eligible);
        });
    });

    describe("once per catalog", () => {
        test("only attempts auto-selection once", () => {
            const {displayStore} = openCatalog(catalogFileId => createProfileStore(catalogFileId, CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]));

            expect(displayStore.xAxis).toBe("ra");
            expect(displayStore.yAxis).toBe("dec");
            expect(displayStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(true);

            displayStore.setxAxis(CatalogOverlay.NONE);
            displayStore.setyAxis(CatalogOverlay.NONE);
            displayStore.setCatalogPlotType(CatalogPlotType.Histogram);
            displayStore.setCatalogPlotType(CatalogPlotType.ImageOverlay);

            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("defers attempt tracking until ImageOverlay mode is active", () => {
            const {displayStore} = openCatalog(catalogFileId => createProfileStore(catalogFileId, CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]), {catalogPlotType: CatalogPlotType.Histogram});

            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(false);

            displayStore.setCatalogPlotType(CatalogPlotType.ImageOverlay);

            expect(displayStore.xAxis).toBe("ra");
            expect(displayStore.yAxis).toBe("dec");
            expect(displayStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(true);
        });

        test("keeps the axes a Workspace applied, None included, once the restore is over", () => {
            runInAction(() => (AppStore.Instance.isLoadingWorkspace = true));
            const {displayStore} = openCatalog(catalogFileId => createProfileStore(catalogFileId, CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]));
            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);

            expect(displayStore.applyConfig({xAxis: CatalogOverlay.NONE, yAxis: CatalogOverlay.NONE}).success).toBe(true);
            runInAction(() => (AppStore.Instance.isLoadingWorkspace = false));

            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("chooses axes after a restore that applied none to the catalog", () => {
            runInAction(() => (AppStore.Instance.isLoadingWorkspace = true));
            const {displayStore} = openCatalog(catalogFileId => createProfileStore(catalogFileId, CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]));
            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);

            runInAction(() => (AppStore.Instance.isLoadingWorkspace = false));

            expect(displayStore.xAxis).toBe("ra");
            expect(displayStore.yAxis).toBe("dec");
        });
    });

    describe("axis options", () => {
        test("ranks ecliptic longitude and latitude candidates onto their semantic axes", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.Ecliptic, [
                {name: "ELON1", dataType: CARTA.ColumnType.String, data: ["12:30:00"]},
                {name: "ELAT1", dataType: CARTA.ColumnType.String, data: ["-21:57:15"]},
                {name: "ELON2", dataType: CARTA.ColumnType.String, units: "dms"},
                {name: "ELAT2", dataType: CARTA.ColumnType.String, units: "dms"}
            ]);

            // Every column stays reachable; only the order differs between the two axes.
            expect(displayStore.xAxisOptions).toEqual([CatalogOverlay.NONE, "ELON1", "ELON2", "ELAT1", "ELAT2"]);
            expect(displayStore.yAxisOptions).toEqual([CatalogOverlay.NONE, "ELAT1", "ELAT2", "ELON1", "ELON2"]);
        });

        test("drops string columns whose values are not coordinates", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [
                {name: "RA1", dataType: CARTA.ColumnType.String, units: "hms"},
                {name: "DEC1", dataType: CARTA.ColumnType.String, units: "dms"},
                {name: "label", dataType: CARTA.ColumnType.String, data: ["NGC 1333", "NGC 2264"]}
            ]);

            expect(displayStore.xAxisOptions).toEqual([CatalogOverlay.NONE, "RA1", "DEC1"]);
            expect(displayStore.yAxisOptions).toEqual([CatalogOverlay.NONE, "DEC1", "RA1"]);
        });

        test("offers a unitless string column but marks it unknown until its values are loaded", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [
                {name: "RA1", dataType: CARTA.ColumnType.String, units: "hms"},
                {name: "note", dataType: CARTA.ColumnType.String}
            ]);

            expect(displayStore.xAxisOptions).toContain("note");
            expect(displayStore.axisColumnEligibility.get("note")?.status).toBe(CatalogAxisEligibility.Unknown);
            expect(displayStore.axisColumnEligibility.get("note")?.reason).toBeTruthy();
        });

        test("ranks an angular column below the pixel candidates without hiding it", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.Pixel0, [
                {name: "GLON", dataType: CARTA.ColumnType.Double, units: "deg"},
                {name: "xcentroid", dataType: CARTA.ColumnType.String, data: ["512.25"]},
                {name: "ycentroid", dataType: CARTA.ColumnType.String, data: ["256.75"]}
            ]);

            expect(displayStore.xAxisOptions).toEqual([CatalogOverlay.NONE, "xcentroid", "GLON", "ycentroid"]);
            expect(displayStore.yAxisOptions).toEqual([CatalogOverlay.NONE, "ycentroid", "GLON", "xcentroid"]);
        });

        test.each([CatalogPlotType.Histogram, CatalogPlotType.D2Scatter])("keeps numeric coordinate columns available for %s plots", catalogPlotType => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "flux"}], {catalogPlotType});

            const expectedOptions = [CatalogOverlay.NONE, "ra", "dec", "flux"];
            expect(displayStore.xAxisOptions).toEqual(expectedOptions);
            expect(displayStore.yAxisOptions).toEqual(expectedOptions);
        });

        test("offers a hidden coordinate column once the user displays it by hand", () => {
            // With auto-select off, nothing nominates a coordinate column that sits past the
            // display cut, so displaying it by hand is the only way in. It has to reach the menu
            // from there, both before its values arrive and after.
            setAutoSelect(false);
            const {profileStore, displayStore} = openCatalog(catalogFileId =>
                createProfileStore(catalogFileId, CatalogSystemType.FK5, [{name: "flux"}, {name: "RAJ2000", dataType: CARTA.ColumnType.String, display: false}, {name: "DEJ2000", dataType: CARTA.ColumnType.String, display: false}])
            );

            expect(displayStore.xAxisOptions).toEqual([CatalogOverlay.NONE, "flux"]);

            profileStore.setHeaderDisplay(true, "RAJ2000");
            profileStore.setHeaderDisplay(true, "DEJ2000");

            // Still unreadable -- no values have arrived yet -- but Unknown is not a verdict, so
            // the columns must be selectable rather than hidden. RAJ2000 leads on the RA axis by
            // name; the other two match nothing and keep their column order.
            expect(displayStore.xAxisOptions).toEqual([CatalogOverlay.NONE, "RAJ2000", "flux", "DEJ2000"]);
            expect(displayStore.yAxisOptions).toEqual([CatalogOverlay.NONE, "DEJ2000", "flux", "RAJ2000"]);
            expect(displayStore.axisColumnEligibility.get("RAJ2000")?.status).toBe(CatalogAxisEligibility.Unknown);

            runInAction(() => profileStore.catalogOriginalData.set(1, {dataType: CARTA.ColumnType.String, data: ["12:30:00"]}));
            expect(displayStore.axisColumnEligibility.get("RAJ2000")?.status).toBe(CatalogAxisEligibility.Eligible);
        });

        test("uses safe defaults when the catalog has no data yet", () => {
            const displayStore = new CatalogDisplayStore(nextCatalogFileId++);
            displayStore.setxAxis("ra");
            displayStore.setyAxis("dec");

            expect(displayStore.xAxisOptions).toEqual([CatalogOverlay.NONE]);
            expect(displayStore.yAxisOptions).toEqual([CatalogOverlay.NONE]);
            expect(displayStore.xAxis).toBe("ra");
            expect(displayStore.yAxis).toBe("dec");
            displayStore.dispose();
        });
    });

    describe("setColumnDisplayed", () => {
        test("uses table update mode for file-based column display updates", () => {
            const requestFilteredRows = jest.spyOn(CatalogStore.Instance, "requestFilteredRows").mockImplementation(jest.fn());
            const {catalogFileId, profileStore, displayStore} = openMockCatalog(CatalogSystemType.FK5, [{name: "_RAJ2000", display: false}, {name: "_DEJ2000"}], {
                xAxis: "RAJ2000",
                yAxis: "_DEJ2000",
                configure: profileStore => (profileStore.isFileBasedCatalog = true)
            });

            displayStore.setColumnDisplayed("_RAJ2000", true);

            expect(profileStore.setUpdateMode).toHaveBeenCalledWith(CatalogUpdateMode.TableUpdate);
            expect(profileStore.setIsUpdateColumn).toHaveBeenCalledWith(true);
            expect(requestFilteredRows).toHaveBeenCalledWith(catalogFileId);
        });

        test("reselects visible coordinate axes when columns are shown again from None", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]);
            displayStore.setColumnDisplayed("ra", false);
            displayStore.setColumnDisplayed("dec", false);
            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);

            displayStore.setColumnDisplayed("ra", true);
            expect(displayStore.xAxis).toBe("ra");
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);

            displayStore.setColumnDisplayed("dec", true);
            expect(displayStore.xAxis).toBe("ra");
            expect(displayStore.yAxis).toBe("dec");
        });

        test("does not reselect visible coordinate axes when preference is disabled", () => {
            setAutoSelect(false);
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [
                {name: "ra", display: false},
                {name: "dec", display: false}
            ]);

            displayStore.setColumnDisplayed("ra", true);
            displayStore.setColumnDisplayed("dec", true);

            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("reselects a hidden xAxis without drawing the overlay again", () => {
            const plotImageOverlay = jest.spyOn(CatalogStore.Instance, "plotImageOverlay").mockImplementation(jest.fn(() => true));
            const {displayStore} = openMockCatalog(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}, {name: "xcentroid"}, {name: "ycentroid"}], {xAxis: "x", yAxis: "y"});

            displayStore.setColumnDisplayed("x", false);

            expect(displayStore.xAxis).toBe("xcentroid");
            expect(displayStore.yAxis).toBe("y");
            expect(plotImageOverlay).not.toHaveBeenCalled();
        });

        test("only reselects the hidden yAxis", () => {
            const {displayStore} = openMockCatalog(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}, {name: "ycentroid"}], {xAxis: "x", yAxis: "y"});

            displayStore.setColumnDisplayed("y", false);

            expect(displayStore.xAxis).toBe("x");
            expect(displayStore.yAxis).toBe("ycentroid");
        });

        test("does not choose a replacement axis when preference is disabled", () => {
            setAutoSelect(false);
            const {displayStore} = openMockCatalog(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}, {name: "xcentroid"}], {xAxis: "x", yAxis: "y"});

            displayStore.setColumnDisplayed("x", false);

            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe("y");
        });
    });

    describe("changeCoordinateSystem", () => {
        test("chooses the axes again for the new system", () => {
            const {profileStore, displayStore} = openMockCatalog(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "X_IMAGE"}, {name: "Y_IMAGE"}]);
            expect(displayStore.xAxis).toBe("ra");

            displayStore.changeCoordinateSystem(CatalogSystemType.Pixel1);

            expect(profileStore.setCatalogCoordinateSystem).toHaveBeenCalledWith(CatalogSystemType.Pixel1);
            expect(displayStore.xAxis).toBe("X_IMAGE");
            expect(displayStore.yAxis).toBe("Y_IMAGE");
        });

        test("retries after a coordinate-system change leaves string axes unresolved", () => {
            const {profileStore, displayStore} = openCatalog(catalogFileId => {
                jest.spyOn(CatalogStore.Instance, "requestMoreRows").mockImplementation(jest.fn());
                return createProfileStore(catalogFileId, CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "GLON", dataType: CARTA.ColumnType.String}, {name: "GLAT", dataType: CARTA.ColumnType.String}], 200);
            });
            expect(displayStore.xAxis).toBe("ra");
            expect(displayStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(true);

            displayStore.changeCoordinateSystem(CatalogSystemType.Galactic);

            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(false);

            runInAction(() => {
                profileStore.catalogOriginalData.set(2, {dataType: CARTA.ColumnType.String, data: new Array(200).fill("12:30:00")});
                profileStore.catalogOriginalData.set(3, {dataType: CARTA.ColumnType.String, data: new Array(200).fill("-21:57:15")});
                profileStore.setSubsetEndIndex(200);
            });

            expect(displayStore.xAxis).toBe("GLON");
            expect(displayStore.yAxis).toBe("GLAT");
            expect(displayStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(true);
        });

        test("clears image overlay axes when preference is disabled and the axis labels change", () => {
            setAutoSelect(false);
            const {displayStore} = openMockCatalog(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "X_IMAGE"}, {name: "Y_IMAGE"}], {xAxis: "ra", yAxis: "dec"});

            displayStore.changeCoordinateSystem(CatalogSystemType.Pixel1);

            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("preserves image overlay axes when preference is disabled and the axis labels stay compatible", () => {
            setAutoSelect(false);
            const {displayStore} = openMockCatalog(CatalogSystemType.FK5, [{name: "_RAJ2000"}, {name: "_DEJ2000"}], {xAxis: "_RAJ2000", yAxis: "_DEJ2000"});

            displayStore.changeCoordinateSystem(CatalogSystemType.ICRS);

            expect(displayStore.xAxis).toBe("_RAJ2000");
            expect(displayStore.yAxis).toBe("_DEJ2000");
        });
    });

    describe("changePlotType", () => {
        test.each([CatalogPlotType.Histogram, CatalogPlotType.D2Scatter])("clears string coordinate axes when changing from an image overlay to %s", plotType => {
            const {displayStore} = openCatalog(catalogFileId => {
                const profileStore = createProfileStore(catalogFileId, CatalogSystemType.ICRS, [{name: "ra", dataType: CARTA.ColumnType.String, units: "hms"}, {name: "dec", dataType: CARTA.ColumnType.String, units: "dms"}, {name: "flux"}]);
                return profileStore;
            });
            expect(displayStore.xAxis).toBe("ra");

            displayStore.changePlotType(plotType);

            expect(displayStore.catalogPlotType).toBe(plotType);
            expect(displayStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(displayStore.yAxis).toBe(CatalogOverlay.NONE);
        });
    });
});
