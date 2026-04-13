import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogPlotType, CatalogSystemType, CatalogUpdateMode} from "enums";

import {CatalogOverlayComponent} from "./CatalogOverlayComponent";

type MockColumn = {
    display?: boolean;
    name: string;
};

type MockWidgetStore = {
    appliedImageOverlaySystem?: CatalogSystemType;
    appliedImageOverlayXAxis: string;
    appliedImageOverlayYAxis: string;
    catalogPlotType: CatalogPlotType;
    hasAppliedImageOverlay: boolean;
    setxAxis: jest.Mock<void, [string]>;
    setyAxis: jest.Mock<void, [string]>;
    xAxis: string;
    yAxis: string;
};

type MockProfileStore = {
    activedSystem: {x: CatalogOverlay; y: CatalogOverlay} | undefined;
    catalogControlHeader: Map<string, {dataIndex: number; display: boolean; filter: string}>;
    catalogCoordinateSystem: {system: CatalogSystemType};
    catalogHeader: Array<{columnIndex: number; dataType: CARTA.ColumnType; name: string}>;
    isFileBasedCatalog: boolean;
    setCatalogCoordinateSystem: jest.Mock<void, [CatalogSystemType]>;
    setIsUpdateColumn: jest.Mock<void, [boolean]>;
    setHeaderDisplay: jest.Mock<void, [boolean, string]>;
    setUpdateMode: jest.Mock<void, [CatalogUpdateMode]>;
};

const systemOverlayMap = new Map<CatalogSystemType, {x: CatalogOverlay; y: CatalogOverlay}>([
    [CatalogSystemType.FK4, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
    [CatalogSystemType.FK5, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
    [CatalogSystemType.ICRS, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
    [CatalogSystemType.Galactic, {x: CatalogOverlay.GLON, y: CatalogOverlay.GLAT}],
    [CatalogSystemType.Ecliptic, {x: CatalogOverlay.ELON, y: CatalogOverlay.ELAT}],
    [CatalogSystemType.Pixel0, {x: CatalogOverlay.X0, y: CatalogOverlay.Y0}],
    [CatalogSystemType.Pixel1, {x: CatalogOverlay.X1, y: CatalogOverlay.Y1}]
]);

const createWidgetStore = (xAxis: string = CatalogOverlay.NONE, yAxis: string = CatalogOverlay.NONE): MockWidgetStore => {
    const widgetStore = {
        appliedImageOverlayXAxis: CatalogOverlay.NONE,
        appliedImageOverlayYAxis: CatalogOverlay.NONE,
        catalogPlotType: CatalogPlotType.ImageOverlay,
        hasAppliedImageOverlay: false,
        xAxis,
        yAxis
    } as MockWidgetStore;

    widgetStore.setxAxis = jest.fn((nextXAxis: string) => {
        widgetStore.xAxis = nextXAxis;
    });
    widgetStore.setyAxis = jest.fn((nextYAxis: string) => {
        widgetStore.yAxis = nextYAxis;
    });

    return widgetStore;
};

const createProfileStore = (system: CatalogSystemType, columns: MockColumn[]): MockProfileStore => {
    const catalogControlHeader = new Map<string, {dataIndex: number; display: boolean; filter: string}>();
    const catalogHeader = columns.map((column, index) => {
        catalogControlHeader.set(column.name, {
            dataIndex: index,
            display: column.display ?? true,
            filter: ""
        });

        return {
            columnIndex: index,
            dataType: CARTA.ColumnType.Double,
            name: column.name
        };
    });

    const profileStore = {
        activedSystem: systemOverlayMap.get(system),
        catalogControlHeader,
        catalogCoordinateSystem: {system},
        catalogHeader,
        isFileBasedCatalog: false,
        setCatalogCoordinateSystem: jest.fn(),
        setIsUpdateColumn: jest.fn(),
        setHeaderDisplay: jest.fn(),
        setUpdateMode: jest.fn()
    } as MockProfileStore;

    profileStore.setCatalogCoordinateSystem.mockImplementation((nextSystem: CatalogSystemType) => {
        profileStore.catalogCoordinateSystem.system = nextSystem;
        profileStore.activedSystem = systemOverlayMap.get(nextSystem);
    });
    profileStore.setHeaderDisplay.mockImplementation((display: boolean, columnName: string) => {
        const header = profileStore.catalogControlHeader.get(columnName);
        if (header) {
            header.display = display;
        }
    });

    return profileStore;
};

let harnessId = 0;

const createComponentHarness = (system: CatalogSystemType, columns: MockColumn[], xAxis: string = CatalogOverlay.NONE, yAxis: string = CatalogOverlay.NONE, options: {autoSelectEnabled?: boolean} = {}) => {
    // These unit tests exercise isolated instance methods, so we bypass the real constructor
    // and manually seed any constructor-initialized fields that the methods may touch.
    harnessId += 1;
    const component = Object.create(CatalogOverlayComponent.prototype) as CatalogOverlayComponent & Record<string, any>;
    const profileStore = createProfileStore(system, columns);
    const widgetStore = createWidgetStore(xAxis, yAxis);
    const autoSelectEnabled = options.autoSelectEnabled ?? true;
    component["autoSelectAttemptedCatalogIds"] = new Set<number>();
    component["catalogFileNames"] = new Map<number, string>();
    component["widgetId"] = `catalog-overlay-test-${harnessId}`;

    Object.defineProperty(component, "profileStore", {
        configurable: true,
        get: () => profileStore
    });
    Object.defineProperty(component, "widgetStore", {
        configurable: true,
        get: () => widgetStore
    });
    Object.defineProperty(component, "catalogFileId", {
        configurable: true,
        get: () => 1
    });
    Object.defineProperty(component, "shouldAutoSelectImageOverlayColumns", {
        configurable: true,
        get: () => autoSelectEnabled
    });

    return {component, profileStore, widgetStore};
};

afterEach(() => {
    jest.restoreAllMocks();
});

describe("CatalogOverlayComponent auto-select coordinates", () => {
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
    ])("autoSelectAxes picks %s aliases from catalog columns", (_label, system, columns, expectedX, expectedY) => {
        const {component, widgetStore} = createComponentHarness(system, columns);

        component["autoSelectAxes"]();

        expect(widgetStore.xAxis).toBe(expectedX);
        expect(widgetStore.yAxis).toBe(expectedY);
    });

    test("autoSelectAxes skips excluded coordinate-like error columns", () => {
        const {component, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "e_ra"}, {name: "pmdec"}, {name: "ra"}, {name: "dec"}]);

        component["autoSelectAxes"]();

        expect(widgetStore.xAxis).toBe("ra");
        expect(widgetStore.yAxis).toBe("dec");
    });

    test("autoSelectAxes prefers FK4 columns over explicit J2000 or ICRS columns", () => {
        const {component, widgetStore} = createComponentHarness(CatalogSystemType.FK4, [{name: "RAJ2000"}, {name: "DEJ2000"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}, {name: "RAB1950"}, {name: "DEB1950"}]);

        component["autoSelectAxes"]();

        expect(widgetStore.xAxis).toBe("RAB1950");
        expect(widgetStore.yAxis).toBe("DEB1950");
    });

    test("autoSelectAxes prefers FK5 columns over explicit B1950 or ICRS columns", () => {
        const {component, widgetStore} = createComponentHarness(CatalogSystemType.FK5, [{name: "RAB1950"}, {name: "DEB1950"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}, {name: "RAJ2000"}, {name: "DEJ2000"}]);

        component["autoSelectAxes"]();

        expect(widgetStore.xAxis).toBe("RAJ2000");
        expect(widgetStore.yAxis).toBe("DEJ2000");
    });

    test("autoSelectAxes prefers ICRS columns and excludes explicit B1950 columns", () => {
        const {component, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "RAB1950"}, {name: "DEB1950"}, {name: "RAJ2000"}, {name: "DEJ2000"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}]);

        component["autoSelectAxes"]();

        expect(widgetStore.xAxis).toBe("RA_ICRS");
        expect(widgetStore.yAxis).toBe("DE_ICRS");
    });

    test.each([
        ["FK4", CatalogSystemType.FK4, "RAJ2015", "DEJ2015", "RAB1975", "DEB1975", "RAB1975", "DEB1975"],
        ["FK5", CatalogSystemType.FK5, "RAB1975", "DEB1975", "RAJ2015", "DEJ2015", "RAJ2015", "DEJ2015"],
        ["ICRS", CatalogSystemType.ICRS, "RAB1975", "DEB1975", "RA_ICRS", "DE_ICRS", "RA_ICRS", "DE_ICRS"]
    ])("autoSelectAxes filters generic epoch-specific equatorial columns for %s", (_label, system, incompatibleX, incompatibleY, compatibleX, compatibleY, expectedX, expectedY) => {
        const {component, widgetStore} = createComponentHarness(system, [{name: incompatibleX}, {name: incompatibleY}, {name: compatibleX}, {name: compatibleY}]);

        component["autoSelectAxes"]();

        expect(widgetStore.xAxis).toBe(expectedX);
        expect(widgetStore.yAxis).toBe(expectedY);
    });

    test("isExcludedCoordinateName only excludes coordinate-error tokens", () => {
        const {component} = createComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]);

        expect(component["isExcludedCoordinateName"]("deterrence")).toBe(false);
        expect(component["isExcludedCoordinateName"]("design")).toBe(false);
        expect(component["isExcludedCoordinateName"]("ra_error")).toBe(true);
        expect(component["isExcludedCoordinateName"]("sigma_ra")).toBe(true);
        expect(component["isExcludedCoordinateName"]("pmdec")).toBe(true);
        expect(component["isExcludedCoordinateName"]("raOffset")).toBe(true);
    });

    test("autoSelectAxes enables hidden matching columns when no visible coordinate columns are available", () => {
        const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.Pixel0, [{name: "flux"}, {name: "xcentroid", display: false}, {name: "ycentroid", display: false}]);

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

    test("autoSelectAxes does nothing when preference is disabled", () => {
        const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.Pixel0, [{name: "flux"}, {name: "xcentroid", display: false}, {name: "ycentroid", display: false}], CatalogOverlay.NONE, CatalogOverlay.NONE, {
            autoSelectEnabled: false
        });

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

    test("handleHeaderDisplayChange reselects visible coordinate axes when columns are toggled back on from None", () => {
        const {component, widgetStore} = createComponentHarness(
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

    test("handleHeaderDisplayChange does not auto-reselect visible coordinate axes when preference is disabled", () => {
        const {component, widgetStore} = createComponentHarness(
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

    test("tryAutoSelectAxes only attempts auto-selection once per catalog", () => {
        const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]);
        const autoSelectSpy = jest.spyOn(component as any, "autoSelectAxes");

        component["tryAutoSelectAxes"](profileStore as any, widgetStore as any, 1, CatalogPlotType.ImageOverlay, true);
        component["tryAutoSelectAxes"](profileStore as any, widgetStore as any, 1, CatalogPlotType.ImageOverlay, true);

        expect(autoSelectSpy).toHaveBeenCalledTimes(1);
        expect(component["autoSelectAttemptedCatalogIds"].has(1)).toBe(true);
    });

    test("tryAutoSelectAxes skips selection and does not mark the catalog when preference is disabled", () => {
        const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]);
        const autoSelectSpy = jest.spyOn(component as any, "autoSelectAxes");

        component["tryAutoSelectAxes"](profileStore as any, widgetStore as any, 1, CatalogPlotType.ImageOverlay, false);

        expect(autoSelectSpy).not.toHaveBeenCalled();
        expect(component["autoSelectAttemptedCatalogIds"].has(1)).toBe(false);
    });
});

describe("CatalogOverlayComponent image overlay state", () => {
    test("autoSelectAxes force-reset path reselects columns for the new system", () => {
        const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "X_IMAGE"}, {name: "Y_IMAGE"}], "ra", "dec");

        profileStore.setCatalogCoordinateSystem(CatalogSystemType.Pixel1);
        component["autoSelectAxes"](true);

        expect(profileStore.setCatalogCoordinateSystem).toHaveBeenCalledWith(CatalogSystemType.Pixel1);
        expect(widgetStore.setxAxis).toHaveBeenNthCalledWith(1, CatalogOverlay.NONE);
        expect(widgetStore.setyAxis).toHaveBeenNthCalledWith(1, CatalogOverlay.NONE);
        expect(widgetStore.xAxis).toBe("X_IMAGE");
        expect(widgetStore.yAxis).toBe("Y_IMAGE");
    });

    test("reselectRemovedAxes updates axes without auto-applying the image overlay", () => {
        const {component, widgetStore} = createComponentHarness(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}]);

        component["applyImageOverlayPlot"] = jest.fn();

        component["reselectRemovedAxes"](true, true);

        expect(widgetStore.xAxis).toBe("x");
        expect(widgetStore.yAxis).toBe("y");
        expect(component["applyImageOverlayPlot"]).not.toHaveBeenCalled();
    });

    test("reselectRemovedAxes only updates the requested x axis", () => {
        const {component, widgetStore} = createComponentHarness(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}], CatalogOverlay.NONE, "y");

        component["reselectRemovedAxes"](true, false);

        expect(widgetStore.xAxis).toBe("x");
        expect(widgetStore.yAxis).toBe("y");
        expect(widgetStore.setyAxis).not.toHaveBeenCalled();
    });

    test("reselectRemovedAxes only updates the requested y axis", () => {
        const {component, widgetStore} = createComponentHarness(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}], "x", CatalogOverlay.NONE);

        component["reselectRemovedAxes"](false, true);

        expect(widgetStore.xAxis).toBe("x");
        expect(widgetStore.yAxis).toBe("y");
        expect(widgetStore.setxAxis).not.toHaveBeenCalled();
    });

    test("reselectRemovedAxes does not auto-select replacement axes when preference is disabled", () => {
        const {component, widgetStore} = createComponentHarness(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}], CatalogOverlay.NONE, CatalogOverlay.NONE, {
            autoSelectEnabled: false
        });

        component["reselectRemovedAxes"](true, true);

        expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
        expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
    });

    test("handleCatalogSystemChange clears image overlay axes when preference is disabled and the axis labels change", () => {
        const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "X_IMAGE"}, {name: "Y_IMAGE"}], "ra", "dec", {autoSelectEnabled: false});

        component["handleCatalogSystemChange"](CatalogSystemType.Pixel1);

        expect(profileStore.setCatalogCoordinateSystem).toHaveBeenCalledWith(CatalogSystemType.Pixel1);
        expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
        expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
    });

    test("handleCatalogSystemChange preserves image overlay axes when preference is disabled and the axis labels stay compatible", () => {
        const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.FK5, [{name: "_RAJ2000"}, {name: "_DEJ2000"}], "_RAJ2000", "_DEJ2000", {autoSelectEnabled: false});

        component["handleCatalogSystemChange"](CatalogSystemType.ICRS);

        expect(profileStore.setCatalogCoordinateSystem).toHaveBeenCalledWith(CatalogSystemType.ICRS);
        expect(widgetStore.xAxis).toBe("_RAJ2000");
        expect(widgetStore.yAxis).toBe("_DEJ2000");
    });

    test("isImageOverlaySelectionDirty reports pending plot changes when current axes differ from the applied overlay", () => {
        const {component, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "ra_alt"}], "ra_alt", "dec");

        widgetStore.hasAppliedImageOverlay = true;
        widgetStore.appliedImageOverlayXAxis = "ra";
        widgetStore.appliedImageOverlayYAxis = "dec";
        widgetStore.appliedImageOverlaySystem = CatalogSystemType.ICRS;

        expect(component.isImageOverlaySelectionDirty).toBe(true);

        widgetStore.xAxis = "ra";
        expect(component.isImageOverlaySelectionDirty).toBe(false);
    });

    test("isImageOverlaySelectionDirty reports pending plot changes when only the coordinate system differs", () => {
        const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.FK5, [{name: "_RAJ2000"}, {name: "_DEJ2000"}], "_RAJ2000", "_DEJ2000");

        widgetStore.hasAppliedImageOverlay = true;
        widgetStore.appliedImageOverlayXAxis = "_RAJ2000";
        widgetStore.appliedImageOverlayYAxis = "_DEJ2000";
        widgetStore.appliedImageOverlaySystem = CatalogSystemType.ICRS;

        expect(component.isImageOverlaySelectionDirty).toBe(true);

        profileStore.catalogCoordinateSystem.system = CatalogSystemType.ICRS;
        expect(component.isImageOverlaySelectionDirty).toBe(false);
    });
});
