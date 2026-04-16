import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {CatalogOverlay, CatalogPlotType, CatalogSystemType, CatalogType, CatalogUpdateMode} from "enums";
import {CatalogProfileStore, CatalogStore, WidgetsStore} from "stores";
import {CatalogWidgetStore} from "stores/Widgets";

import {CatalogOverlayComponent} from "./CatalogOverlayComponent";

type MockColumn = {
    display?: boolean;
    name: string;
};

type MockWidgetStore = {
    plottedImageOverlayMaxRows?: number;
    plottedImageOverlaySystem?: CatalogSystemType;
    plottedImageOverlayXAxis: string;
    plottedImageOverlayYAxis: string;
    autoSelectImageOverlayAxesAttempted: boolean;
    catalogPlotType: CatalogPlotType;
    hasPlottedImageOverlay: boolean;
    setAutoSelectImageOverlayAxesAttempted: jest.Mock<void, [boolean]>;
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
    maxRows: number;
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
        autoSelectImageOverlayAxesAttempted: false,
        plottedImageOverlayMaxRows: undefined,
        plottedImageOverlayXAxis: CatalogOverlay.NONE,
        plottedImageOverlayYAxis: CatalogOverlay.NONE,
        catalogPlotType: CatalogPlotType.ImageOverlay,
        hasPlottedImageOverlay: false,
        xAxis,
        yAxis
    } as MockWidgetStore;

    widgetStore.setxAxis = jest.fn((nextXAxis: string) => {
        widgetStore.xAxis = nextXAxis;
    });
    widgetStore.setyAxis = jest.fn((nextYAxis: string) => {
        widgetStore.yAxis = nextYAxis;
    });
    widgetStore.setAutoSelectImageOverlayAxesAttempted = jest.fn((attempted: boolean) => {
        widgetStore.autoSelectImageOverlayAxesAttempted = attempted;
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
        maxRows: 100,
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

const createCatalogProfileStore = (catalogFileId: number, system: CatalogSystemType, columns: MockColumn[]): CatalogProfileStore => {
    const catalogHeader = columns.map((column, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: CARTA.ColumnType.Double, name: column.name}));
    const profileStore = new CatalogProfileStore(
        {
            dataSize: 0,
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
const constructedComponents: Array<{catalogFileId: number; catalogWidgetId: string; component: CatalogOverlayComponent; componentId: string; widgetStore: CatalogWidgetStore}> = [];

const createComponentHarness = (system: CatalogSystemType, columns: MockColumn[], xAxis: string = CatalogOverlay.NONE, yAxis: string = CatalogOverlay.NONE, options: {autoSelectEnabled?: boolean; widgetStore?: MockWidgetStore} = {}) => {
    // These unit tests exercise isolated instance methods, so we bypass the real constructor
    // and manually seed any constructor-initialized fields that the methods may touch.
    harnessId += 1;
    const component = Object.create(CatalogOverlayComponent.prototype) as CatalogOverlayComponent & Record<string, any>;
    const profileStore = createProfileStore(system, columns);
    const widgetStore = options.widgetStore ?? createWidgetStore(xAxis, yAxis);
    const autoSelectEnabled = options.autoSelectEnabled ?? true;
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

const createComponentWithoutProfileStore = (xAxis: string = CatalogOverlay.NONE, yAxis: string = CatalogOverlay.NONE) => {
    harnessId += 1;
    const component = Object.create(CatalogOverlayComponent.prototype) as CatalogOverlayComponent & Record<string, any>;
    const widgetStore = createWidgetStore(xAxis, yAxis);
    component["catalogFileNames"] = new Map<number, string>();
    component["widgetId"] = `catalog-overlay-test-${harnessId}`;

    Object.defineProperty(component, "profileStore", {
        configurable: true,
        get: () => undefined
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
        get: () => true
    });

    return {component, widgetStore};
};

const createConstructedComponentHarness = (
    system: CatalogSystemType,
    columns: MockColumn[],
    options: {catalogFileId?: number; catalogPlotType?: CatalogPlotType; catalogWidgetId?: string; componentId?: string; profileStore?: CatalogProfileStore; widgetStore?: CatalogWidgetStore} = {}
) => {
    harnessId += 1;
    const catalogFileId = options.catalogFileId ?? 10_000 + harnessId;
    const componentId = options.componentId ?? `catalog-overlay-reaction-test-${harnessId}`;
    const catalogWidgetId = options.catalogWidgetId ?? `catalog-widget-reaction-test-${harnessId}`;
    const profileStore = options.profileStore ?? createCatalogProfileStore(catalogFileId, system, columns);
    const widgetStore = options.widgetStore ?? new CatalogWidgetStore(catalogFileId);

    if (options.catalogPlotType !== undefined) {
        widgetStore.setCatalogPlotType(options.catalogPlotType);
    }

    runInAction(() => {
        CatalogStore.Instance.catalogProfiles.set(componentId, catalogFileId);
        CatalogStore.Instance.catalogProfileStores.set(catalogFileId, profileStore);
        CatalogStore.Instance.catalogWidgets.set(catalogFileId, catalogWidgetId);
        WidgetsStore.Instance.catalogWidgets.set(catalogWidgetId, widgetStore);
    });

    const component = new CatalogOverlayComponent({id: componentId, docked: false});
    constructedComponents.push({catalogFileId, catalogWidgetId, component, componentId, widgetStore});

    return {catalogFileId, catalogWidgetId, component, componentId, profileStore, widgetStore};
};

afterEach(() => {
    constructedComponents.forEach(({catalogFileId, catalogWidgetId, component, componentId, widgetStore}) => {
        component.componentWillUnmount();
        widgetStore.dispose();
        runInAction(() => {
            CatalogStore.Instance.catalogProfiles.delete(componentId);
            CatalogStore.Instance.catalogProfileStores.delete(catalogFileId);
            CatalogStore.Instance.catalogWidgets.delete(catalogFileId);
            WidgetsStore.Instance.catalogWidgets.delete(catalogWidgetId);
        });
    });
    constructedComponents.length = 0;
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
            const {component, widgetStore} = createComponentHarness(system, columns);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe(expectedX);
            expect(widgetStore.yAxis).toBe(expectedY);
        });

        test.each([
            ["X-axis", [{name: "ra"}], "ra", CatalogOverlay.NONE],
            ["Y-axis", [{name: "dec"}], CatalogOverlay.NONE, "dec"]
        ])("selects only the available %s candidate", (_label, columns, expectedX, expectedY) => {
            const {component, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, columns);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe(expectedX);
            expect(widgetStore.yAxis).toBe(expectedY);
        });

        test("skips excluded coordinate-like error columns", () => {
            const {component, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "e_ra"}, {name: "pmdec"}, {name: "ra"}, {name: "dec"}]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe("dec");
        });

        test("skips columns when data type metadata is missing", () => {
            const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]);
            profileStore.catalogHeader = [];

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.setxAxis).not.toHaveBeenCalled();
            expect(widgetStore.setyAxis).not.toHaveBeenCalled();
        });

        test("uses safe defaults when profile store is unavailable", () => {
            const {component, widgetStore} = createComponentWithoutProfileStore("ra", "dec");

            expect(component.axisOption).toEqual([CatalogOverlay.NONE]);
            expect(component["getAutoSelectableAxisOptions"]()).toEqual([]);
            expect(() => component["autoSelectAxes"]()).not.toThrow();
            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe("dec");
            expect(widgetStore.setxAxis).not.toHaveBeenCalled();
            expect(widgetStore.setyAxis).not.toHaveBeenCalled();
        });

        test("prefers FK4 columns over explicit J2000 or ICRS columns", () => {
            const {component, widgetStore} = createComponentHarness(CatalogSystemType.FK4, [{name: "RAJ2000"}, {name: "DEJ2000"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}, {name: "RAB1950"}, {name: "DEB1950"}]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("RAB1950");
            expect(widgetStore.yAxis).toBe("DEB1950");
        });

        test("prefers FK5 columns over explicit B1950 or ICRS columns", () => {
            const {component, widgetStore} = createComponentHarness(CatalogSystemType.FK5, [{name: "RAB1950"}, {name: "DEB1950"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}, {name: "RAJ2000"}, {name: "DEJ2000"}]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("RAJ2000");
            expect(widgetStore.yAxis).toBe("DEJ2000");
        });

        test("prefers ICRS columns and excludes explicit B1950 columns", () => {
            const {component, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "RAB1950"}, {name: "DEB1950"}, {name: "RAJ2000"}, {name: "DEJ2000"}, {name: "RA_ICRS"}, {name: "DE_ICRS"}]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe("RA_ICRS");
            expect(widgetStore.yAxis).toBe("DE_ICRS");
        });

        test.each([
            ["FK4", CatalogSystemType.FK4, "RAJ2015", "DEJ2015", "RAB1975", "DEB1975", "RAB1975", "DEB1975"],
            ["FK5", CatalogSystemType.FK5, "RAB1975", "DEB1975", "RAJ2015", "DEJ2015", "RAJ2015", "DEJ2015"],
            ["ICRS", CatalogSystemType.ICRS, "RAB1975", "DEB1975", "RA_ICRS", "DE_ICRS", "RA_ICRS", "DE_ICRS"]
        ])("filters generic epoch-specific equatorial columns for %s", (_label, system, incompatibleX, incompatibleY, compatibleX, compatibleY, expectedX, expectedY) => {
            const {component, widgetStore} = createComponentHarness(system, [{name: incompatibleX}, {name: incompatibleY}, {name: compatibleX}, {name: compatibleY}]);

            component["autoSelectAxes"]();

            expect(widgetStore.xAxis).toBe(expectedX);
            expect(widgetStore.yAxis).toBe(expectedY);
        });

        test("enables hidden matching columns when no visible coordinate columns are available", () => {
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

        test("does nothing when preference is disabled", () => {
            const {component, profileStore, widgetStore} = createComponentHarness(
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
            const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "X_IMAGE"}, {name: "Y_IMAGE"}], "ra", "dec");

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
        test("only attempts auto-selection once per catalog", () => {
            const {widgetStore} = createConstructedComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]);

            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe("dec");
            expect(widgetStore.autoSelectImageOverlayAxesAttempted).toBe(true);

            widgetStore.setxAxis(CatalogOverlay.NONE);
            widgetStore.setyAxis(CatalogOverlay.NONE);
            widgetStore.setCatalogPlotType(CatalogPlotType.Histogram);
            widgetStore.setCatalogPlotType(CatalogPlotType.ImageOverlay);

            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("defers attempt tracking until ImageOverlay mode is active", () => {
            const {widgetStore} = createConstructedComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}], {catalogPlotType: CatalogPlotType.Histogram});

            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.autoSelectImageOverlayAxesAttempted).toBe(false);

            widgetStore.setCatalogPlotType(CatalogPlotType.ImageOverlay);

            expect(widgetStore.xAxis).toBe("ra");
            expect(widgetStore.yAxis).toBe("dec");
            expect(widgetStore.autoSelectImageOverlayAxesAttempted).toBe(true);
        });

        test("does not retry auto-selection when another component uses the same widget store", () => {
            const firstHarness = createConstructedComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]);

            expect(firstHarness.widgetStore.xAxis).toBe("ra");
            expect(firstHarness.widgetStore.yAxis).toBe("dec");

            firstHarness.widgetStore.setxAxis(CatalogOverlay.NONE);
            firstHarness.widgetStore.setyAxis(CatalogOverlay.NONE);

            createConstructedComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}], {
                catalogFileId: firstHarness.catalogFileId,
                catalogWidgetId: firstHarness.catalogWidgetId,
                profileStore: firstHarness.profileStore,
                widgetStore: firstHarness.widgetStore
            });

            expect(firstHarness.widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(firstHarness.widgetStore.yAxis).toBe(CatalogOverlay.NONE);
            expect(firstHarness.widgetStore.autoSelectImageOverlayAxesAttempted).toBe(true);
        });
    });

    describe("handleHeaderDisplayChange", () => {
        test("reselects visible coordinate axes when columns are toggled back on from None", () => {
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

        test("does not auto-reselect visible coordinate axes when preference is disabled", () => {
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
    });

    describe("handleHeaderDisplayChange reselects removed axes", () => {
        test("reselects xAxis without auto-applying the image overlay", () => {
            const {component, widgetStore} = createComponentHarness(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}, {name: "xcentroid"}, {name: "ycentroid"}], "x", "y");

            component["applyImageOverlayPlot"] = jest.fn();

            component["handleHeaderDisplayChange"]({target: {checked: false}}, "x");

            expect(widgetStore.xAxis).toBe("xcentroid");
            expect(widgetStore.yAxis).toBe("y");
            expect(component["applyImageOverlayPlot"]).not.toHaveBeenCalled();
        });

        test("only reselects the removed xAxis", () => {
            const {component, widgetStore} = createComponentHarness(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}, {name: "xcentroid"}], "x", "y");

            component["handleHeaderDisplayChange"]({target: {checked: false}}, "x");

            expect(widgetStore.xAxis).toBe("xcentroid");
            expect(widgetStore.yAxis).toBe("y");
            expect(widgetStore.setyAxis).not.toHaveBeenCalled();
        });

        test("only reselects the removed yAxis", () => {
            const {component, widgetStore} = createComponentHarness(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}, {name: "ycentroid"}], "x", "y");

            component["handleHeaderDisplayChange"]({target: {checked: false}}, "y");

            expect(widgetStore.xAxis).toBe("x");
            expect(widgetStore.yAxis).toBe("ycentroid");
            expect(widgetStore.setxAxis).not.toHaveBeenCalled();
        });

        test("does not auto-select replacement axes when preference is disabled", () => {
            const {component, widgetStore} = createComponentHarness(CatalogSystemType.Pixel0, [{name: "x"}, {name: "y"}, {name: "xcentroid"}], "x", "y", {
                autoSelectEnabled: false
            });

            component["handleHeaderDisplayChange"]({target: {checked: false}}, "x");

            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe("y");
        });
    });

    describe("handleCatalogSystemChange", () => {
        test("clears image overlay axes when preference is disabled and the axis labels change", () => {
            const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "X_IMAGE"}, {name: "Y_IMAGE"}], "ra", "dec", {autoSelectEnabled: false});

            component["handleCatalogSystemChange"](CatalogSystemType.Pixel1);

            expect(profileStore.setCatalogCoordinateSystem).toHaveBeenCalledWith(CatalogSystemType.Pixel1);
            expect(widgetStore.xAxis).toBe(CatalogOverlay.NONE);
            expect(widgetStore.yAxis).toBe(CatalogOverlay.NONE);
        });

        test("preserves image overlay axes when preference is disabled and the axis labels stay compatible", () => {
            const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.FK5, [{name: "_RAJ2000"}, {name: "_DEJ2000"}], "_RAJ2000", "_DEJ2000", {autoSelectEnabled: false});

            component["handleCatalogSystemChange"](CatalogSystemType.ICRS);

            expect(profileStore.setCatalogCoordinateSystem).toHaveBeenCalledWith(CatalogSystemType.ICRS);
            expect(widgetStore.xAxis).toBe("_RAJ2000");
            expect(widgetStore.yAxis).toBe("_DEJ2000");
        });
    });

    describe("isImageOverlaySelectionDirty", () => {
        test("reports pending plot changes when current axes differ from the applied overlay", () => {
            const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "ra_alt"}], "ra_alt", "dec");

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
            const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.FK5, [{name: "_RAJ2000"}, {name: "_DEJ2000"}], "_RAJ2000", "_DEJ2000");

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
            const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}], "ra", "dec");

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
            const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}], "ra", "dec");

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
