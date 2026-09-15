import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {CatalogOverlay, CatalogPlotType, CatalogSystemType, CatalogType, CatalogUpdateMode} from "enums";
import {CatalogDisplayStore, CatalogProfileStore, CatalogStore} from "stores";
import {CatalogAxisEligibility, type CatalogAxisEligibilityResult, COORDINATE_SNIFF_SCAN_LIMIT, getCatalogAxisEligibility, getCoordinateDescriptorFromUnits} from "utilities";

import {CatalogOverlayComponent} from "./CatalogOverlayComponent";

type MockColumn = {
    display?: boolean;
    dataType?: CARTA.ColumnType;
    name: string;
    units?: string;
    /** Sample values. A unitless string column without them is Unknown, not eligible. */
    data?: Array<string | number | null>;
};

type MockWidgetStore = {
    plottedImageOverlayMaxRows?: number;
    plottedImageOverlaySystem?: CatalogSystemType;
    plottedImageOverlayXAxis: string;
    plottedImageOverlayYAxis: string;
    hasAttemptedAutoSelectImageOverlayAxes: boolean;
    catalogPlotType: CatalogPlotType;
    hasPlottedImageOverlay: boolean;
    setAutoSelectImageOverlayAxesAttempted: jest.Mock<void, [boolean]>;
    setCatalogPlotType: jest.Mock<void, [CatalogPlotType]>;
    setxAxis: jest.Mock<void, [string]>;
    setyAxis: jest.Mock<void, [string]>;
    xAxis: string;
    yAxis: string;
};

type MockProfileStore = {
    activedSystem: {x: CatalogOverlay; y: CatalogOverlay} | undefined;
    catalogControlHeader: Map<string, {dataIndex: number; display: boolean; filter: string}>;
    catalogCoordinateSystem: {system: CatalogSystemType};
    catalogData: Map<number, {dataType: CARTA.ColumnType; data: Array<string | number | null>}>;
    catalogHeader: Array<{columnIndex: number; dataType: CARTA.ColumnType; name: string; units?: string}>;
    isFileBasedCatalog: boolean;
    maxRows: number;
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

const CreateWidgetStore = (xAxis: string = CatalogOverlay.NONE, yAxis: string = CatalogOverlay.NONE): MockWidgetStore => {
    const widgetStore = {
        hasAttemptedAutoSelectImageOverlayAxes: false,
        plottedImageOverlayMaxRows: undefined,
        plottedImageOverlayXAxis: CatalogOverlay.NONE,
        plottedImageOverlayYAxis: CatalogOverlay.NONE,
        catalogPlotType: CatalogPlotType.ImageOverlay,
        hasPlottedImageOverlay: false,
        xAxis,
        yAxis
    } as MockWidgetStore;

    widgetStore.setCatalogPlotType = jest.fn((nextPlotType: CatalogPlotType) => {
        widgetStore.catalogPlotType = nextPlotType;
    });
    widgetStore.setxAxis = jest.fn((nextXAxis: string) => {
        widgetStore.xAxis = nextXAxis;
    });
    widgetStore.setyAxis = jest.fn((nextYAxis: string) => {
        widgetStore.yAxis = nextYAxis;
    });
    widgetStore.setAutoSelectImageOverlayAxesAttempted = jest.fn((isAttempted: boolean) => {
        widgetStore.hasAttemptedAutoSelectImageOverlayAxes = isAttempted;
    });

    return widgetStore;
};

const CreateProfileStore = (system: CatalogSystemType, columns: MockColumn[]): MockProfileStore => {
    const catalogControlHeader = new Map<string, {dataIndex: number; display: boolean; filter: string}>();
    const catalogData = new Map<number, {dataType: CARTA.ColumnType; data: Array<string | number | null>}>();
    const catalogHeader = columns.map((column, index) => {
        catalogControlHeader.set(column.name, {
            dataIndex: index,
            display: column.display ?? true,
            filter: ""
        });

        const dataType = column.dataType ?? CARTA.ColumnType.Double;
        if (column.data) {
            catalogData.set(index, {dataType, data: column.data});
        }

        return {
            columnIndex: index,
            dataType,
            name: column.name,
            units: column.units
        };
    });

    const profileStore = {
        activedSystem: SYSTEM_OVERLAY_MAP.get(system),
        catalogControlHeader,
        catalogCoordinateSystem: {system},
        catalogData,
        catalogHeader,
        isFileBasedCatalog: false,
        maxRows: 100,
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

    return profileStore;
};

const CreateCatalogProfileStore = (catalogFileId: number, system: CatalogSystemType, columns: MockColumn[], dataSize = 0): CatalogProfileStore => {
    const catalogHeader = columns.map((column, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: column.dataType ?? CARTA.ColumnType.Double, name: column.name, units: column.units}));
    const profileStore = new CatalogProfileStore(
        {
            dataSize,
            directory: "",
            fileId: catalogFileId,
            fileInfo: new CARTA.CatalogFileInfo({name: "test-catalog"})
        },
        catalogHeader,
        new Map(),
        CatalogType.FILE
    );

    profileStore.setCatalogCoordinateSystem(system);
    columns.forEach(column => {
        if (column.display !== undefined) {
            profileStore.setHeaderDisplay(column.display, column.name);
        }
    });

    return profileStore;
};

let harnessId = 0;
const CONSTRUCTED_COMPONENTS: Array<{catalogFileId: number; component: CatalogOverlayComponent; componentId: string; widgetStore: CatalogDisplayStore}> = [];

const CreateComponentHarness = (system: CatalogSystemType, columns: MockColumn[], xAxis: string = CatalogOverlay.NONE, yAxis: string = CatalogOverlay.NONE, options: {autoSelectEnabled?: boolean; widgetStore?: MockWidgetStore} = {}) => {
    // These unit tests exercise isolated instance methods, so we bypass the real constructor
    // and manually seed any constructor-initialized fields that the methods may touch.
    harnessId += 1;
    const component = Object.create(CatalogOverlayComponent.prototype) as CatalogOverlayComponent & Record<string, any>;
    const profileStore = CreateProfileStore(system, columns);
    const widgetStore = options.widgetStore ?? CreateWidgetStore(xAxis, yAxis);
    const isAutoSelectEnabled = options.autoSelectEnabled ?? true;
    component["catalogFileNames"] = new Map<number, string>();
    component["widgetId"] = `catalog-overlay-test-${harnessId}`;

    Object.defineProperty(component, "profileStore", {
        configurable: true,
        get: () => profileStore
    });
    Object.defineProperty(component, "displayStore", {
        configurable: true,
        get: () => widgetStore
    });
    Object.defineProperty(component, "catalogFileId", {
        configurable: true,
        get: () => 1
    });
    Object.defineProperty(component, "shouldAutoSelectImageOverlayColumns", {
        configurable: true,
        get: () => isAutoSelectEnabled
    });

    return {component, profileStore, widgetStore};
};

const CreateComponentWithoutProfileStore = (xAxis: string = CatalogOverlay.NONE, yAxis: string = CatalogOverlay.NONE) => {
    harnessId += 1;
    const component = Object.create(CatalogOverlayComponent.prototype) as CatalogOverlayComponent & Record<string, any>;
    const widgetStore = CreateWidgetStore(xAxis, yAxis);
    component["catalogFileNames"] = new Map<number, string>();
    component["widgetId"] = `catalog-overlay-test-${harnessId}`;

    Object.defineProperty(component, "profileStore", {
        configurable: true,
        get: () => undefined
    });
    Object.defineProperty(component, "displayStore", {
        configurable: true,
        get: () => widgetStore
    });
    Object.defineProperty(component, "catalogFileId", {
        configurable: true,
        get: () => 1
    });
    Object.defineProperty(component, "shouldAutoSelectImageOverlayColumns", {
        configurable: true,
        get: () => true
    });

    return {component, widgetStore};
};

const CreateConstructedComponentHarness = (
    system: CatalogSystemType,
    columns: MockColumn[],
    options: {catalogFileId?: number; catalogPlotType?: CatalogPlotType; componentId?: string; profileStore?: CatalogProfileStore; widgetStore?: CatalogDisplayStore} = {}
) => {
    harnessId += 1;
    const catalogFileId = options.catalogFileId ?? 10_000 + harnessId;
    const componentId = options.componentId ?? `catalog-overlay-reaction-test-${harnessId}`;
    const profileStore = options.profileStore ?? CreateCatalogProfileStore(catalogFileId, system, columns);
    const widgetStore = options.widgetStore ?? new CatalogDisplayStore(catalogFileId);

    if (options.catalogPlotType !== undefined) {
        widgetStore.setCatalogPlotType(options.catalogPlotType);
    }

    runInAction(() => {
        CatalogStore.Instance.catalogProfiles.set(componentId, catalogFileId);
        CatalogStore.Instance.catalogProfileStores.set(catalogFileId, profileStore);
        CatalogStore.Instance.catalogDisplayStores.set(catalogFileId, widgetStore);
    });

    const component = new CatalogOverlayComponent({id: componentId, docked: false});
    CONSTRUCTED_COMPONENTS.push({catalogFileId, component, componentId, widgetStore});

    return {catalogFileId, component, componentId, profileStore, widgetStore};
};

afterEach(() => {
    CONSTRUCTED_COMPONENTS.forEach(({catalogFileId, component, componentId, widgetStore}) => {
        component.componentWillUnmount();
        widgetStore.dispose();
        runInAction(() => {
            CatalogStore.Instance.catalogProfiles.delete(componentId);
            CatalogStore.Instance.catalogProfileStores.delete(catalogFileId);
            CatalogStore.Instance.catalogDisplayStores.delete(catalogFileId);
        });
    });
    CONSTRUCTED_COMPONENTS.length = 0;
    jest.restoreAllMocks();
});

describe("CatalogOverlayComponent", () => {
    describe("autoSelectAxes", () => {
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
            const {component, widgetStore} = CreateComponentHarness(system, columns);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe(expectedX);
            expect(widgetStore.yAxis).toBe(expectedY);
        });

        test.each([
            ["X-axis", [{name: "ra"}], "ra", CatalogOverlay.NONE],
            ["Y-axis", [{name: "dec"}], CatalogOverlay.NONE, "dec"]
        ])("selects only the available %s candidate", (_label, columns, expectedX, expectedY) => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, columns);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe(expectedX);
            expect(widgetStore.yAxis).toBe(expectedY);
        });

        test("skips excluded coordinate-like error columns", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "e_ra"}, {name: "pmdec"}, {name: "ra"}, {name: "dec"}]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe("dec");
        });

        test("skips columns when data type metadata is missing", () => {
            const {component, profileStore, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]);
            profileStore.catalogHeader = [];

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.setxAxis).not.toHaveBeenCalled();
            expect(widgetStore.setyAxis).not.toHaveBeenCalled();
        });

        test("ranks ecliptic longitude and latitude candidates onto their semantic axes", () => {
            const {component} = CreateComponentHarness(CatalogSystemType.Ecliptic, [
                {name: "ELON1", dataType: CARTA.ColumnType.String, data: ["12:30:00"]},
                {name: "ELAT1", dataType: CARTA.ColumnType.String, data: ["-21:57:15"]},
                {name: "ELON2", dataType: CARTA.ColumnType.String, units: "dms"},
                {name: "ELAT2", dataType: CARTA.ColumnType.String, units: "dms"}
            ]);

            // Every column stays reachable; only the order differs between the two axes.
            expect(component["xAxisOption"]).toEqual([CatalogOverlay.NONE, "ELON1", "ELON2", "ELAT1", "ELAT2"]);
            expect(component["yAxisOption"]).toEqual([CatalogOverlay.NONE, "ELAT1", "ELAT2", "ELON1", "ELON2"]);
        });

        test("drops string columns whose values are not coordinates", () => {
            const {component} = CreateComponentHarness(CatalogSystemType.ICRS, [
                {name: "RA1", dataType: CARTA.ColumnType.String, units: "hms"},
                {name: "DEC1", dataType: CARTA.ColumnType.String, units: "dms"},
                {name: "label", dataType: CARTA.ColumnType.String, data: ["NGC 1333", "NGC 2264"]}
            ]);

            expect(component["xAxisOption"]).toEqual([CatalogOverlay.NONE, "RA1", "DEC1"]);
            expect(component["yAxisOption"]).toEqual([CatalogOverlay.NONE, "DEC1", "RA1"]);
        });

        test("offers a unitless string column but marks it unknown until its values are loaded", () => {
            const {component} = CreateComponentHarness(CatalogSystemType.ICRS, [
                {name: "RA1", dataType: CARTA.ColumnType.String, units: "hms"},
                {name: "note", dataType: CARTA.ColumnType.String}
            ]);

            expect(component["xAxisOption"]).toContain("note");
            expect(component["axisColumnEligibility"].get("note")?.status).toBe("unknown");
            expect(component["axisColumnEligibility"].get("note")?.reason).toBeTruthy();
        });

        test("requests another streamed chunk while coordinate formats are unknown", () => {
            const {component, profileStore, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [
                {name: "ra", dataType: CARTA.ColumnType.String},
                {name: "dec", dataType: CARTA.ColumnType.String}
            ]);
            Object.assign(profileStore, {
                isFileBasedCatalog: true,
                isLoadingData: false,
                shouldUpdateData: true,
                updateMode: CatalogUpdateMode.TableUpdate
            });
            component["updateByInfiniteScroll"] = jest.fn();

            expect(component["autoSelectAxes"]()).toBe(true);
            expect(component["updateByInfiniteScroll"]).toHaveBeenCalledTimes(1);
            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("stops streaming once the coordinate sniff scan limit is loaded", () => {
            const sample = new Array<string>(COORDINATE_SNIFF_SCAN_LIMIT).fill("not a coordinate");
            const {component, profileStore, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [
                {name: "ra", dataType: CARTA.ColumnType.String, data: sample},
                {name: "dec", dataType: CARTA.ColumnType.String, data: sample}
            ]);
            Object.assign(profileStore, {
                isFileBasedCatalog: true,
                isLoadingData: false,
                shouldUpdateData: true,
                updateMode: CatalogUpdateMode.TableUpdate
            });
            component["updateByInfiniteScroll"] = jest.fn();

            expect(component["autoSelectAxes"]()).toBe(false);
            expect(component["updateByInfiniteScroll"]).not.toHaveBeenCalled();
            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe("dec");
        });

        test("does not stream ordinary string columns while looking for axes", () => {
            const {component, profileStore, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [
                {name: "object_name", dataType: CARTA.ColumnType.String, data: ["NGC 1333", "NGC 2264"]},
                {name: "description", dataType: CARTA.ColumnType.String, data: ["Taurus", "Monoceros"]}
            ]);
            Object.assign(profileStore, {
                isFileBasedCatalog: true,
                isLoadingData: false,
                shouldUpdateData: true,
                updateMode: CatalogUpdateMode.TableUpdate
            });
            component["updateByInfiniteScroll"] = jest.fn();

            expect(component["autoSelectAxes"]()).toBe(false);
            expect(component["updateByInfiniteScroll"]).not.toHaveBeenCalled();
            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("refreshes column eligibility when catalog values arrive", () => {
            const profileStore = CreateCatalogProfileStore(12345, CatalogSystemType.ICRS, [{name: "RA1", dataType: CARTA.ColumnType.String}]);
            const {component} = CreateConstructedComponentHarness(CatalogSystemType.ICRS, [], {profileStore});

            expect(component["axisColumnEligibility"].get("RA1")?.status).toBe("unknown");

            runInAction(() => {
                profileStore.catalogOriginalData.set(0, {dataType: CARTA.ColumnType.String, data: ["12:30:00"]});
            });

            expect(component["axisColumnEligibility"].get("RA1")?.status).toBe("eligible");
        });

        test("refreshes column eligibility when a streamed update replaces an existing array", () => {
            const profileStore = CreateCatalogProfileStore(12346, CatalogSystemType.ICRS, [{name: "RA1", dataType: CARTA.ColumnType.String}], 2);
            const {component} = CreateConstructedComponentHarness(CatalogSystemType.ICRS, [], {profileStore});

            runInAction(() => {
                profileStore.catalogOriginalData.set(0, {dataType: CARTA.ColumnType.String, data: ["", ""]});
            });
            expect(component["axisColumnEligibility"].get("RA1")?.status).toBe("unknown");

            profileStore.updateCatalogData({filterDataSize: 2, requestEndIndex: 2, subsetDataSize: 2, subsetEndIndex: 2} as CARTA.CatalogFilterResponse, new Map([[0, {dataType: CARTA.ColumnType.String, data: ["12:30:00", "13:00:00"]}]]));

            expect(component["axisColumnEligibility"].get("RA1")?.status).toBe("eligible");
        });

        test("auto-selects hms and dms coordinate columns", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [
                {name: "RA1", dataType: CARTA.ColumnType.String, units: "hms"},
                {name: "DEC1", dataType: CARTA.ColumnType.String, units: "dms"}
            ]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("RA1");
            expect(widgetStore.yAxis).toBe("DEC1");
        });

        test("auto-selects a unitless string column once its values can be sniffed", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [
                {name: "RA1", dataType: CARTA.ColumnType.String, data: ["12:30:00", "10:15:30"]},
                {name: "DEC1", dataType: CARTA.ColumnType.String, data: ["-21:57:15", "+02:28:35"]}
            ]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("RA1");
            expect(widgetStore.yAxis).toBe("DEC1");
        });

        test("falls back to a string column whose values have not been loaded", () => {
            // Nothing but the name says these are coordinates. Selecting them costs a round trip
            // and may be wrong, so it happens only once every better-evidenced option is exhausted.
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [
                {name: "RA1", dataType: CARTA.ColumnType.String},
                {name: "DEC1", dataType: CARTA.ColumnType.String}
            ]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("RA1");
            expect(widgetStore.yAxis).toBe("DEC1");
        });

        test("prefers a column identified by its values over one identified only by its name", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [
                {name: "RAJ2000", dataType: CARTA.ColumnType.String},
                {name: "DEJ2000", dataType: CARTA.ColumnType.String},
                {name: "ra", dataType: CARTA.ColumnType.String, data: ["12:30:00"]},
                {name: "dec", dataType: CARTA.ColumnType.String, data: ["-21:57:15"]}
            ]);

            // "RAJ2000" ranks above "ra", but it is Unknown, so the eligible pair wins the pass.
            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe("dec");
        });

        test("does not fall back to a column whose values rule it out", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [
                {name: "RA1", dataType: CARTA.ColumnType.String, data: ["NGC 1333", "NGC 2264"]},
                {name: "DEC1", dataType: CARTA.ColumnType.String, data: ["Taurus", "Monoceros"]}
            ]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test.each([
            ["Galactic", CatalogSystemType.Galactic, "GLON1", "GLAT1"],
            ["Ecliptic", CatalogSystemType.Ecliptic, "ELON1", "ELAT1"],
            ["Pixel0", CatalogSystemType.Pixel0, "xcentroid", "ycentroid"],
            ["Pixel1", CatalogSystemType.Pixel1, "X_IMAGE", "Y_IMAGE"]
        ])("includes and auto-selects string %s coordinate columns", (_label, system, xColumn, yColumn) => {
            const {component, widgetStore} = CreateComponentHarness(system, [
                {name: xColumn, dataType: CARTA.ColumnType.String, data: ["12:30:00"]},
                {name: yColumn, dataType: CARTA.ColumnType.String, data: ["-21:57:15"]}
            ]);

            expect(component["xAxisOption"]).toEqual([CatalogOverlay.NONE, xColumn, yColumn]);
            expect(component["yAxisOption"]).toEqual([CatalogOverlay.NONE, yColumn, xColumn]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe(xColumn);
            expect(widgetStore.yAxis).toBe(yColumn);
        });

        test("ranks an angular column below the pixel candidates without hiding it", () => {
            const {component} = CreateComponentHarness(CatalogSystemType.Pixel0, [
                {name: "GLON", dataType: CARTA.ColumnType.Double, units: "deg"},
                {name: "xcentroid", dataType: CARTA.ColumnType.String, data: ["512.25"]},
                {name: "ycentroid", dataType: CARTA.ColumnType.String, data: ["256.75"]}
            ]);

            expect(component["xAxisOption"]).toEqual([CatalogOverlay.NONE, "xcentroid", "GLON", "ycentroid"]);
            expect(component["yAxisOption"]).toEqual([CatalogOverlay.NONE, "ycentroid", "GLON", "xcentroid"]);
        });

        test.each([CatalogPlotType.Histogram, CatalogPlotType.D2Scatter])("keeps numeric coordinate columns available for %s plots", catalogPlotType => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "flux"}]);
            widgetStore.catalogPlotType = catalogPlotType;

            const expectedOptions = [CatalogOverlay.NONE, "ra", "dec", "flux"];
            expect(component["xAxisOption"]).toEqual(expectedOptions);
            expect(component["yAxisOption"]).toEqual(expectedOptions);
        });

        test.each([CatalogPlotType.Histogram, CatalogPlotType.D2Scatter])("clears string coordinate axes when changing from an image overlay to %s", plotType => {
            const {component, widgetStore} = CreateConstructedComponentHarness(CatalogSystemType.ICRS, [
                {name: "ra", dataType: CARTA.ColumnType.String, units: "hms", data: ["12:30:00"]},
                {name: "dec", dataType: CARTA.ColumnType.String, units: "dms", data: ["-21:57:15"]},
                {name: "flux"}
            ]);
            widgetStore.setxAxis("ra");
            widgetStore.setyAxis("dec");

            component["handlePlotTypeChange"](plotType);

            expect(widgetStore.catalogPlotType).toBe(plotType);
            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("uses safe defaults when profile store is unavailable", () => {
            const {component, widgetStore} = CreateComponentWithoutProfileStore("ra", "dec");

            expect(component["xAxisOption"]).toEqual([CatalogOverlay.NONE]);
            expect(component["yAxisOption"]).toEqual([CatalogOverlay.NONE]);
            expect(component["getAutoSelectableAxisOptions"]()).toEqual([]);
            expect(() => component["autoSelectAxes"]()).not.toThrow();
            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe("dec");
            expect(widgetStore.setxAxis).not.toHaveBeenCalled();
            expect(widgetStore.setyAxis).not.toHaveBeenCalled();
        });

        test("prefers FK4 columns over explicit J2000 or ICRS columns", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.FK4, [{name: "RAJ2000"}, {name: "DEJ2000"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}, {name: "RAB1950"}, {name: "DEB1950"}]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("RAB1950");
            expect(widgetStore.yAxis).toBe("DEB1950");
        });

        test("prefers FK5 columns over explicit B1950 or ICRS columns", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.FK5, [{name: "RAB1950"}, {name: "DEB1950"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}, {name: "RAJ2000"}, {name: "DEJ2000"}]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("RAJ2000");
            expect(widgetStore.yAxis).toBe("DEJ2000");
        });

        test("prefers ICRS columns and excludes explicit B1950 columns", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "RAB1950"}, {name: "DEB1950"}, {name: "RAJ2000"}, {name: "DEJ2000"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("RA_ICRS");
            expect(widgetStore.yAxis).toBe("DE_ICRS");
        });

        test("only treats J2000 FK5 columns as ICRS-compatible", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "RAJ2021"}, {name: "DEJ2021"}, {name: "RAJ2000"}, {name: "DEJ2000"}]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("RAJ2000");
            expect(widgetStore.yAxis).toBe("DEJ2000");
        });

        test.each([
            ["FK4", CatalogSystemType.FK4, "RAJ2015", "DEJ2015", "RAB1975", "DEB1975", "RAB1975", "DEB1975"],
            ["FK5", CatalogSystemType.FK5, "RAB1975", "DEB1975", "RAJ2015", "DEJ2015", "RAJ2015", "DEJ2015"],
            ["ICRS", CatalogSystemType.ICRS, "RAB1975", "DEB1975", "RA_ICRS", "DE_ICRS", "RA_ICRS", "DE_ICRS"]
        ])("filters generic epoch-specific equatorial columns for %s", (_label, system, incompatibleX, incompatibleY, compatibleX, compatibleY, expectedX, expectedY) => {
            const {component, widgetStore} = CreateComponentHarness(system, [{name: incompatibleX}, {name: incompatibleY}, {name: compatibleX}, {name: compatibleY}]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe(expectedX);
            expect(widgetStore.yAxis).toBe(expectedY);
        });

        test("enables hidden matching columns when no visible coordinate columns are available", () => {
            const {component, profileStore, widgetStore} = CreateComponentHarness(CatalogSystemType.Pixel0, [{name: "flux"}, {name: "xcentroid", display: false}, {name: "ycentroid", display: false}]);

            profileStore.isFileBasedCatalog = true;
            component["handleFilterRequest"] = jest.fn();

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("xcentroid");
            expect(widgetStore.yAxis).toBe("ycentroid");
            expect(profileStore.setHeaderDisplay).toHaveBeenCalledWith(true, "xcentroid");
            expect(profileStore.setHeaderDisplay).toHaveBeenCalledWith(true, "ycentroid");
            expect(profileStore.setUpdateMode).toHaveBeenCalledWith(CatalogUpdateMode.TableUpdate);
            expect(profileStore.setIsUpdateColumn).toHaveBeenCalledWith(true);
            expect(component["handleFilterRequest"]).toHaveBeenCalled();
        });

        test("does nothing when preference is disabled", () => {
            const {component, profileStore, widgetStore} = CreateComponentHarness(
                CatalogSystemType.Pixel0,
                [{name: "flux"}, {name: "xcentroid", display: false}, {name: "ycentroid", display: false}],
                CatalogOverlay.NONE,
                CatalogOverlay.NONE,
                {
                    autoSelectEnabled: false
                }
            );

            profileStore.isFileBasedCatalog = true;
            component["handleFilterRequest"] = jest.fn();

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
            expect(profileStore.setHeaderDisplay).not.toHaveBeenCalled();
            expect(profileStore.setUpdateMode).not.toHaveBeenCalled();
            expect(profileStore.setIsUpdateColumn).not.toHaveBeenCalled();
            expect(component["handleFilterRequest"]).not.toHaveBeenCalled();
        });

        test("force-reset path reselects columns for the new system", () => {
            const {component, profileStore, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "X_IMAGE"}, {name: "Y_IMAGE"}], "ra", "dec");

            profileStore.setCatalogCoordinateSystem(CatalogSystemType.Pixel1);
            component["autoSelectAxes"](true);

            expect(profileStore.setCatalogCoordinateSystem).toHaveBeenCalledWith(CatalogSystemType.Pixel1);
            expect(widgetStore.setxAxis).toHaveBeenNthCalledWith(1, CatalogOverlay.NONE);
            expect(widgetStore.setyAxis).toHaveBeenNthCalledWith(1, CatalogOverlay.NONE);
            expect(widgetStore.xAxis).toBe("X_IMAGE");
            expect(widgetStore.yAxis).toBe("Y_IMAGE");
        });
    });

    describe("auto-select axes reaction", () => {
        test("retries after a noisy streamed coordinate chunk becomes established", () => {
            const profileStore = CreateCatalogProfileStore(
                12346,
                CatalogSystemType.ICRS,
                [
                    {name: "ra", dataType: CARTA.ColumnType.String},
                    {name: "dec", dataType: CARTA.ColumnType.String}
                ],
                200
            );
            profileStore.setSubsetEndIndex(2);
            const {widgetStore} = CreateConstructedComponentHarness(CatalogSystemType.ICRS, [], {profileStore});

            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(false);

            runInAction(() => {
                profileStore.catalogOriginalData.set(0, {dataType: CARTA.ColumnType.String, data: ["12:30:00", "--"]});
                profileStore.catalogOriginalData.set(1, {dataType: CARTA.ColumnType.String, data: ["-21:57:15", "--"]});
            });

            // The first chunk is deliberately inconclusive: one coordinate and one placeholder
            // must not consume the one-shot auto-selection attempt.
            expect(widgetStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(false);

            runInAction(() => {
                profileStore.catalogOriginalData.set(0, {dataType: CARTA.ColumnType.String, data: ["12:30:00", "--", "13:00:00", ...new Array(197).fill("14:00:00")]});
                profileStore.catalogOriginalData.set(1, {dataType: CARTA.ColumnType.String, data: ["-21:57:15", "--", "-22:00:00", ...new Array(197).fill("-23:00:00")]});
                profileStore.setSubsetEndIndex(200);
            });

            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe("dec");
            expect(widgetStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(true);
        });

        test("only attempts auto-selection once per catalog", () => {
            const {widgetStore} = CreateConstructedComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]);

            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe("dec");
            expect(widgetStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(true);

            widgetStore.setxAxis(CatalogOverlay.NONE);
            widgetStore.setyAxis(CatalogOverlay.NONE);
            widgetStore.setCatalogPlotType(CatalogPlotType.Histogram);
            widgetStore.setCatalogPlotType(CatalogPlotType.ImageOverlay);

            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("defers attempt tracking until ImageOverlay mode is active", () => {
            const {widgetStore} = CreateConstructedComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}], {catalogPlotType: CatalogPlotType.Histogram});

            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(false);

            widgetStore.setCatalogPlotType(CatalogPlotType.ImageOverlay);

            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe("dec");
            expect(widgetStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(true);
        });

        test("does not retry auto-selection when another component uses the same widget store", () => {
            const firstHarness = CreateConstructedComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]);

            expect(firstHarness.widgetStore.xAxis).toBe("ra");
            expect(firstHarness.widgetStore.yAxis).toBe("dec");

            firstHarness.widgetStore.setxAxis(CatalogOverlay.NONE);
            firstHarness.widgetStore.setyAxis(CatalogOverlay.NONE);

            CreateConstructedComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}], {
                catalogFileId: firstHarness.catalogFileId,
                profileStore: firstHarness.profileStore,
                widgetStore: firstHarness.widgetStore
            });

            expect(firstHarness.widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(firstHarness.widgetStore.yAxis).toBe(CatalogOverlay.NONE);
            expect(firstHarness.widgetStore.hasAttemptedAutoSelectImageOverlayAxes).toBe(true);
        });
    });

    describe("handleHeaderDisplayChange", () => {
        test("uses table update mode for file-based column display updates", () => {
            const {component, profileStore} = CreateComponentHarness(CatalogSystemType.FK5, [{name: "_RAJ2000", display: false}, {name: "_DEJ2000"}], "RAJ2000", "_DEJ2000");
            profileStore.isFileBasedCatalog = true;
            component["handleFilterRequest"] = jest.fn();

            component["handleHeaderDisplayChange"]({target: {checked: true}}, "_RAJ2000");

            expect(profileStore.setUpdateMode).toHaveBeenCalledWith(CatalogUpdateMode.TableUpdate);
            expect(profileStore.setIsUpdateColumn).toHaveBeenCalledWith(true);
            expect(component["handleFilterRequest"]).toHaveBeenCalled();
        });

        test("reselects visible coordinate axes when columns are toggled back on from None", () => {
            const {component, widgetStore} = CreateComponentHarness(
                CatalogSystemType.ICRS,
                [
                    {name: "ra", display: false},
                    {name: "dec", display: false}
                ],
                CatalogOverlay.NONE,
                CatalogOverlay.NONE
            );

            component["handleHeaderDisplayChange"]({target: {checked: true}}, "ra");
            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);

            component["handleHeaderDisplayChange"]({target: {checked: true}}, "dec");
            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe("dec");
        });

        test("does not auto-reselect visible coordinate axes when preference is disabled", () => {
            const {component, widgetStore} = CreateComponentHarness(
                CatalogSystemType.ICRS,
                [
                    {name: "ra", display: false},
                    {name: "dec", display: false}
                ],
                CatalogOverlay.NONE,
                CatalogOverlay.NONE,
                {autoSelectEnabled: false}
            );

            component["handleHeaderDisplayChange"]({target: {checked: true}}, "ra");
            component["handleHeaderDisplayChange"]({target: {checked: true}}, "dec");

            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
        });
    });

    describe("handleHeaderDisplayChange reselects removed axes", () => {
        test("reselects xAxis without auto-applying the image overlay", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}, {name: "xcentroid"}, {name: "ycentroid"}], "x", "y");

            component["applyImageOverlayPlot"] = jest.fn();

            component["handleHeaderDisplayChange"]({target: {checked: false}}, "x");

            expect(widgetStore.xAxis).toBe("xcentroid");
            expect(widgetStore.yAxis).toBe("y");
            expect(component["applyImageOverlayPlot"]).not.toHaveBeenCalled();
        });

        test("only reselects the removed xAxis", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}, {name: "xcentroid"}], "x", "y");

            component["handleHeaderDisplayChange"]({target: {checked: false}}, "x");

            expect(widgetStore.xAxis).toBe("xcentroid");
            expect(widgetStore.yAxis).toBe("y");
            expect(widgetStore.setyAxis).not.toHaveBeenCalled();
        });

        test("only reselects the removed yAxis", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}, {name: "ycentroid"}], "x", "y");

            component["handleHeaderDisplayChange"]({target: {checked: false}}, "y");

            expect(widgetStore.xAxis).toBe("x");
            expect(widgetStore.yAxis).toBe("ycentroid");
            expect(widgetStore.setxAxis).not.toHaveBeenCalled();
        });

        test("does not auto-select replacement axes when preference is disabled", () => {
            const {component, widgetStore} = CreateComponentHarness(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}, {name: "xcentroid"}], "x", "y", {
                autoSelectEnabled: false
            });

            component["handleHeaderDisplayChange"]({target: {checked: false}}, "x");

            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe("y");
        });
    });

    describe("handleCatalogSystemChange", () => {
        test("clears image overlay axes when preference is disabled and the axis labels change", () => {
            const {component, profileStore, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "X_IMAGE"}, {name: "Y_IMAGE"}], "ra", "dec", {autoSelectEnabled: false});

            component["handleCatalogSystemChange"](CatalogSystemType.Pixel1);

            expect(profileStore.setCatalogCoordinateSystem).toHaveBeenCalledWith(CatalogSystemType.Pixel1);
            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("preserves image overlay axes when preference is disabled and the axis labels stay compatible", () => {
            const {component, profileStore, widgetStore} = CreateComponentHarness(CatalogSystemType.FK5, [{name: "_RAJ2000"}, {name: "_DEJ2000"}], "_RAJ2000", "_DEJ2000", {autoSelectEnabled: false});

            component["handleCatalogSystemChange"](CatalogSystemType.ICRS);

            expect(profileStore.setCatalogCoordinateSystem).toHaveBeenCalledWith(CatalogSystemType.ICRS);
            expect(widgetStore.xAxis).toBe("_RAJ2000");
            expect(widgetStore.yAxis).toBe("_DEJ2000");
        });
    });

    describe("isImageOverlaySelectionDirty", () => {
        test("reports pending plot changes when current axes differ from the applied overlay", () => {
            const {component, profileStore, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "ra_alt"}], "ra_alt", "dec");

            widgetStore.hasPlottedImageOverlay = true;
            widgetStore.plottedImageOverlayMaxRows = profileStore.maxRows;
            widgetStore.plottedImageOverlayXAxis = "ra";
            widgetStore.plottedImageOverlayYAxis = "dec";
            widgetStore.plottedImageOverlaySystem = CatalogSystemType.ICRS;

            expect(component.isImageOverlaySelectionDirty).toBe(true);

            widgetStore.xAxis = "ra";
            expect(component.isImageOverlaySelectionDirty).toBe(false);
        });

        test("reports pending plot changes when only the coordinate system differs", () => {
            const {component, profileStore, widgetStore} = CreateComponentHarness(CatalogSystemType.FK5, [{name: "_RAJ2000"}, {name: "_DEJ2000"}], "_RAJ2000", "_DEJ2000");

            widgetStore.hasPlottedImageOverlay = true;
            widgetStore.plottedImageOverlayMaxRows = profileStore.maxRows;
            widgetStore.plottedImageOverlayXAxis = "_RAJ2000";
            widgetStore.plottedImageOverlayYAxis = "_DEJ2000";
            widgetStore.plottedImageOverlaySystem = CatalogSystemType.ICRS;

            expect(component.isImageOverlaySelectionDirty).toBe(true);

            profileStore.catalogCoordinateSystem.system = CatalogSystemType.ICRS;
            expect(component.isImageOverlaySelectionDirty).toBe(false);
        });

        test("reports pending plot changes when max rows increases past plotted rows", () => {
            const {component, profileStore, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}], "ra", "dec");

            widgetStore.hasPlottedImageOverlay = true;
            widgetStore.plottedImageOverlayMaxRows = 100;
            widgetStore.plottedImageOverlayXAxis = "ra";
            widgetStore.plottedImageOverlayYAxis = "dec";
            widgetStore.plottedImageOverlaySystem = CatalogSystemType.ICRS;
            profileStore.maxRows = 200;

            expect(component.isImageOverlaySelectionDirty).toBe(true);

            profileStore.maxRows = 100;
            expect(component.isImageOverlaySelectionDirty).toBe(false);
        });

        test("does not report pending plot changes when max rows is reduced below plotted rows", () => {
            const {component, profileStore, widgetStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}], "ra", "dec");

            widgetStore.hasPlottedImageOverlay = true;
            widgetStore.plottedImageOverlayMaxRows = 1500;
            widgetStore.plottedImageOverlayXAxis = "ra";
            widgetStore.plottedImageOverlayYAxis = "dec";
            widgetStore.plottedImageOverlaySystem = CatalogSystemType.ICRS;
            profileStore.maxRows = 200;

            expect(component.isImageOverlaySelectionDirty).toBe(false);
        });
    });
});
