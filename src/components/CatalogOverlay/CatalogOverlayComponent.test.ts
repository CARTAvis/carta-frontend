import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogPlotType, CatalogSystemType} from "enums";

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
    activedSystem: {x: CatalogOverlay; y: CatalogOverlay};
    catalogControlHeader: Map<string, {dataIndex: number; display: boolean; filter: string}>;
    catalogCoordinateSystem: {system: CatalogSystemType};
    catalogHeader: Array<{columnIndex: number; dataType: CARTA.ColumnType; name: string}>;
    isFileBasedCatalog: boolean;
    setIsUpdateColumn: jest.Mock<void, [boolean]>;
    setHeaderDisplay: jest.Mock<void, [boolean, string]>;
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

    return {
        activedSystem: systemOverlayMap.get(system),
        catalogControlHeader,
        catalogCoordinateSystem: {system},
        catalogHeader,
        isFileBasedCatalog: false,
        setIsUpdateColumn: jest.fn(),
        setHeaderDisplay: jest.fn()
    };
};

const createComponentHarness = (system: CatalogSystemType, columns: MockColumn[], xAxis: string = CatalogOverlay.NONE, yAxis: string = CatalogOverlay.NONE) => {
    const component = Object.create(CatalogOverlayComponent.prototype) as CatalogOverlayComponent & Record<string, any>;
    const profileStore = createProfileStore(system, columns);
    const widgetStore = createWidgetStore(xAxis, yAxis);

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

    return {component, profileStore, widgetStore};
};

describe("CatalogOverlayComponent auto-select coordinates", () => {
    test.each([
        ["FK5", CatalogSystemType.FK5, [{name: "flux"}, {name: "_RAJ2000"}, {name: "_DEJ2000"}], "_RAJ2000", "_DEJ2000"],
        ["FK4", CatalogSystemType.FK4, [{name: "flux"}, {name: "ra"}, {name: "dec"}], "ra", "dec"],
        ["ICRS", CatalogSystemType.ICRS, [{name: "flux"}, {name: "RAJ2000"}, {name: "DEJ2000"}], "RAJ2000", "DEJ2000"],
        ["Galactic", CatalogSystemType.Galactic, [{name: "flux"}, {name: "GLON"}, {name: "GLAT"}], "GLON", "GLAT"],
        ["Ecliptic", CatalogSystemType.Ecliptic, [{name: "flux"}, {name: "ecl_lon"}, {name: "ecl_lat"}], "ecl_lon", "ecl_lat"],
        ["Pixel0", CatalogSystemType.Pixel0, [{name: "id"}, {name: "xcentroid"}, {name: "ycentroid"}], "xcentroid", "ycentroid"],
        ["Pixel1", CatalogSystemType.Pixel1, [{name: "id"}, {name: "X_IMAGE"}, {name: "Y_IMAGE"}], "X_IMAGE", "Y_IMAGE"]
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

    test("autoSelectAxes enables hidden matching columns when no visible coordinate columns are available", () => {
        const {component, profileStore, widgetStore} = createComponentHarness(CatalogSystemType.Pixel0, [{name: "flux"}, {name: "xcentroid", display: false}, {name: "ycentroid", display: false}]);

        profileStore.isFileBasedCatalog = true;
        component["handleFilterRequest"] = jest.fn();

        component["autoSelectAxes"]();

        expect(widgetStore.xAxis).toBe("xcentroid");
        expect(widgetStore.yAxis).toBe("ycentroid");
        expect(profileStore.setHeaderDisplay).toHaveBeenCalledWith(true, "xcentroid");
        expect(profileStore.setHeaderDisplay).toHaveBeenCalledWith(true, "ycentroid");
        expect(profileStore.setIsUpdateColumn).toHaveBeenCalledWith(true);
        expect(component["handleFilterRequest"]).toHaveBeenCalled();
    });
});

describe("CatalogOverlayComponent image overlay state", () => {
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
