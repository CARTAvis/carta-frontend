import {Regions} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {CatalogOverlay, CatalogPlotType, CatalogSettingsTabs, CatalogSystemType, CatalogType} from "enums";
import {CatalogDisplayStore, CatalogProfileStore, CatalogStore, WidgetsStore} from "stores";
import {CatalogAxisEligibility, type CatalogAxisEligibilityResult, getCatalogAxisEligibility, getCoordinateDescriptorFromUnits, isCatalogNumericDataType} from "utilities";

import {CatalogOverlayComponent} from "./CatalogOverlayComponent";

type MockColumn = {
    display?: boolean;
    dataType?: CARTA.ColumnType;
    name: string;
    units?: string;
    /** Sample values. A unitless string column without them is Unknown, not eligible. */
    data?: Array<string | number | null>;
};

type MockDisplayStore = {
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
    rows: {data: Map<number, {dataType: CARTA.ColumnType; data: Array<string | number | null>}>; rowLimit: number; canLoadMore: boolean};
    catalogHeader: Array<{columnIndex: number; dataType: CARTA.ColumnType; name: string; units?: string}>;
    displayedNumericColumnNames: string[];
    isNumericColumn: (columnName: string) => boolean;
    isFileBasedCatalog: boolean;
    getCoordinateEligibility: jest.Mock<CatalogAxisEligibilityResult, [string]>;
    setCatalogCoordinateSystem: jest.Mock<void, [CatalogSystemType]>;
    setHeaderDisplay: jest.Mock<void, [boolean, string]>;
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

const CreateDisplayStore = (xAxis: string = CatalogOverlay.NONE, yAxis: string = CatalogOverlay.NONE): MockDisplayStore => {
    const displayStore = {
        hasAttemptedAutoSelectImageOverlayAxes: false,
        plottedImageOverlayMaxRows: undefined,
        plottedImageOverlayXAxis: CatalogOverlay.NONE,
        plottedImageOverlayYAxis: CatalogOverlay.NONE,
        catalogPlotType: CatalogPlotType.ImageOverlay,
        hasPlottedImageOverlay: false,
        xAxis,
        yAxis
    } as MockDisplayStore;

    displayStore.setCatalogPlotType = jest.fn((nextPlotType: CatalogPlotType) => {
        displayStore.catalogPlotType = nextPlotType;
    });
    displayStore.setxAxis = jest.fn((nextXAxis: string) => {
        displayStore.xAxis = nextXAxis;
    });
    displayStore.setyAxis = jest.fn((nextYAxis: string) => {
        displayStore.yAxis = nextYAxis;
    });
    displayStore.setAutoSelectImageOverlayAxesAttempted = jest.fn((isAttempted: boolean) => {
        displayStore.hasAttemptedAutoSelectImageOverlayAxes = isAttempted;
    });

    return displayStore;
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

    const isNumericColumn = (columnName: string): boolean => {
        const controlHeader = catalogControlHeader.get(columnName);
        return controlHeader !== undefined && isCatalogNumericDataType(catalogHeader[controlHeader.dataIndex]?.dataType);
    };

    const profileStore = {
        activedSystem: SYSTEM_OVERLAY_MAP.get(system),
        catalogControlHeader,
        catalogCoordinateSystem: {system},
        rows: {data: catalogData, rowLimit: 100, canLoadMore: false},
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
        setHeaderDisplay: jest.fn()
    } as MockProfileStore;

    profileStore.getCoordinateEligibility.mockImplementation((columnName: string) => {
        const controlHeader = profileStore.catalogControlHeader.get(columnName);
        const headerInfo = controlHeader ? profileStore.catalogHeader[controlHeader.dataIndex] : undefined;
        const column = profileStore.rows.data.get(headerInfo?.columnIndex ?? NaN);
        const sampleData = column?.dataType === CARTA.ColumnType.String ? (column.data as Array<string | null | undefined>) : undefined;
        const eligibility = getCatalogAxisEligibility(headerInfo?.dataType, headerInfo?.units, sampleData);
        const isUnresolvedString = headerInfo?.dataType === CARTA.ColumnType.String && !getCoordinateDescriptorFromUnits(headerInfo?.units);
        if (eligibility.status === CatalogAxisEligibility.Ineligible && isUnresolvedString && profileStore.rows.canLoadMore) {
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
const CONSTRUCTED_COMPONENTS: Array<{catalogFileId: number; component: CatalogOverlayComponent; componentId: string; displayStore: CatalogDisplayStore}> = [];

const CreateComponentHarness = (system: CatalogSystemType, columns: MockColumn[], xAxis: string = CatalogOverlay.NONE, yAxis: string = CatalogOverlay.NONE, options: {displayStore?: MockDisplayStore} = {}) => {
    // These unit tests exercise isolated instance methods, so we bypass the real constructor
    // and manually seed any constructor-initialized fields that the methods may touch.
    harnessId += 1;
    const component = Object.create(CatalogOverlayComponent.prototype) as CatalogOverlayComponent & Record<string, any>;
    const profileStore = CreateProfileStore(system, columns);
    const displayStore = options.displayStore ?? CreateDisplayStore(xAxis, yAxis);
    component["catalogFileNames"] = new Map<number, string>();
    component["widgetId"] = `catalog-overlay-test-${harnessId}`;

    Object.defineProperty(component, "profileStore", {
        configurable: true,
        get: () => profileStore
    });
    Object.defineProperty(component, "displayStore", {
        configurable: true,
        get: () => displayStore
    });
    Object.defineProperty(component, "catalogFileId", {
        configurable: true,
        get: () => 1
    });

    return {component, profileStore, displayStore};
};

const CreateConstructedComponentHarness = (
    system: CatalogSystemType,
    columns: MockColumn[],
    options: {catalogFileId?: number; catalogPlotType?: CatalogPlotType; componentId?: string; profileStore?: CatalogProfileStore; displayStore?: CatalogDisplayStore} = {}
) => {
    harnessId += 1;
    const catalogFileId = options.catalogFileId ?? 10_000 + harnessId;
    const componentId = options.componentId ?? `catalog-overlay-reaction-test-${harnessId}`;
    const profileStore = options.profileStore ?? CreateCatalogProfileStore(catalogFileId, system, columns);
    const displayStore = options.displayStore ?? new CatalogDisplayStore(catalogFileId);

    if (options.catalogPlotType !== undefined) {
        displayStore.setCatalogPlotType(options.catalogPlotType);
    }

    runInAction(() => {
        WidgetsStore.Instance.getCatalogWidgetStore(componentId, catalogFileId);
        CatalogStore.Instance.catalogProfileStores.set(catalogFileId, profileStore);
        CatalogStore.Instance.catalogDisplayStores.set(catalogFileId, displayStore);
    });

    const component = new CatalogOverlayComponent({id: componentId, docked: false});
    CONSTRUCTED_COMPONENTS.push({catalogFileId, component, componentId, displayStore});

    return {catalogFileId, component, componentId, profileStore, displayStore};
};

afterEach(() => {
    CONSTRUCTED_COMPONENTS.forEach(({catalogFileId, component, componentId, displayStore}) => {
        component.componentWillUnmount();
        displayStore.dispose();
        runInAction(() => {
            WidgetsStore.Instance.catalogWidgets.delete(componentId);
            CatalogStore.Instance.catalogProfileStores.delete(catalogFileId);
            CatalogStore.Instance.catalogDisplayStores.delete(catalogFileId);
        });
    });
    CONSTRUCTED_COMPONENTS.length = 0;
    jest.restoreAllMocks();
});

describe("CatalogOverlayComponent", () => {
    test("restores the workspace table scroll position once without an auto-scroll request", () => {
        const {component, profileStore} = CreateConstructedComponentHarness(CatalogSystemType.ICRS, []);
        const scrollToPosition = jest.fn();
        component["catalogTableRef"] = {quadrantStackInstance: {scrollToPosition}} as any;
        profileStore.applyTableConfig({scrollPosition: {left: 12.5, top: 437}});
        runInAction(() => {
            profileStore.rows.visibleRowCount = 150;
            profileStore.rows.isLoading = false;
        });
        runInAction(() => {
            profileStore.selectedPointIndices = [100];
        });
        const scrollToRegion = jest.spyOn(component, "scrollToRegion").mockImplementation(() => undefined);

        component["onCompleteRender"]();
        component["onCompleteRender"]();

        expect(scrollToPosition).toHaveBeenCalledTimes(1);
        expect(scrollToPosition).toHaveBeenCalledWith(12.5, 437);
        expect(scrollToRegion).not.toHaveBeenCalled();
    });

    test("a newly opened table ignores previous scroll requests", () => {
        const first = CreateConstructedComponentHarness(CatalogSystemType.ICRS, []);
        runInAction(() => {
            first.profileStore.selectedPointIndices = [100];
        });
        first.displayStore.requestCatalogTableAutoScroll();
        const second = CreateConstructedComponentHarness(CatalogSystemType.ICRS, [], {
            catalogFileId: first.catalogFileId,
            profileStore: first.profileStore,
            displayStore: first.displayStore
        });
        const scrollToRegion = jest.spyOn(second.component, "scrollToRegion").mockImplementation(() => undefined);

        second.component["onCompleteRender"]();

        expect(scrollToRegion).not.toHaveBeenCalled();
        expect(second.component["hasPendingAutoScroll"](first.displayStore)).toBe(false);
        expect(first.component["hasPendingAutoScroll"](first.displayStore)).toBe(true);
    });

    test.each([false, true])("catalog switches ignore old requests and preserve a fresh request: %s", shouldRequestScroll => {
        const first = CreateConstructedComponentHarness(CatalogSystemType.ICRS, []);
        const second = CreateConstructedComponentHarness(CatalogSystemType.ICRS, []);
        runInAction(() => {
            second.profileStore.selectedPointIndices = [100];
        });
        second.displayStore.requestCatalogTableAutoScroll();
        const scrollToRegion = jest.spyOn(first.component, "scrollToRegion").mockImplementation(() => undefined);

        // Adoption and the selection request can happen within the same MobX action.
        runInAction(() => {
            CatalogStore.Instance.widgetBindings.show(first.componentId, second.catalogFileId);
            if (shouldRequestScroll) {
                second.displayStore.requestCatalogTableAutoScroll();
            }
        });
        first.component["onCompleteRender"]();

        if (shouldRequestScroll) {
            expect(scrollToRegion).toHaveBeenCalledWith(undefined, Regions.row(100));
        } else {
            expect(scrollToRegion).not.toHaveBeenCalled();
        }
    });

    test.each([false, true])("a late display store ignores old requests and preserves a fresh request: %s", shouldRequestScroll => {
        const {component, catalogFileId, profileStore, displayStore} = CreateConstructedComponentHarness(CatalogSystemType.ICRS, []);
        runInAction(() => {
            profileStore.selectedPointIndices = [100];
            CatalogStore.Instance.catalogDisplayStores.delete(catalogFileId);
        });
        displayStore.requestCatalogTableAutoScroll();
        const scrollToRegion = jest.spyOn(component, "scrollToRegion").mockImplementation(() => undefined);

        runInAction(() => {
            CatalogStore.Instance.catalogDisplayStores.set(catalogFileId, displayStore);
            if (shouldRequestScroll) {
                displayStore.requestCatalogTableAutoScroll();
            }
        });
        component["onCompleteRender"]();

        if (shouldRequestScroll) {
            expect(scrollToRegion).toHaveBeenCalledWith(undefined, Regions.row(100));
        } else {
            expect(scrollToRegion).not.toHaveBeenCalled();
        }
    });

    test("changing selected rows without a scroll request preserves the viewport", () => {
        const {component, profileStore, displayStore} = CreateConstructedComponentHarness(CatalogSystemType.ICRS, []);
        displayStore.setShowSelectedData(true);
        runInAction(() => {
            profileStore.selectedPointIndices = [100];
        });
        const scrollToRegion = jest.spyOn(component, "scrollToRegion").mockImplementation(() => undefined);

        component["onCompleteRender"]();

        expect(scrollToRegion).not.toHaveBeenCalled();
    });

    test("scrolls each catalog table when selected-only mode changes", () => {
        const first = CreateConstructedComponentHarness(CatalogSystemType.ICRS, []);
        const second = CreateConstructedComponentHarness(CatalogSystemType.ICRS, [], {
            catalogFileId: first.catalogFileId,
            profileStore: first.profileStore,
            displayStore: first.displayStore
        });
        runInAction(() => {
            first.profileStore.selectedPointIndices = Array.from({length: 50}, (_, index) => index + 100);
        });
        const displayStore = first.displayStore;
        displayStore.setShowSelectedData(false);
        first.component["onCompleteRender"]();
        second.component["onCompleteRender"]();

        displayStore.setShowSelectedData(true);
        displayStore.requestCatalogTableAutoScroll();
        const firstScroll = jest.spyOn(first.component, "scrollToRegion").mockImplementation(() => undefined);
        const secondScroll = jest.spyOn(second.component, "scrollToRegion").mockImplementation(() => undefined);

        first.component["onCompleteRender"]();
        second.component["onCompleteRender"]();

        expect(firstScroll).toHaveBeenCalledWith(undefined, Regions.row(0));
        expect(secondScroll).toHaveBeenCalledWith(undefined, Regions.row(0));
    });

    test.each([true, false])("scrolls once per request when selected-only mode is %s", isShowingSelectedData => {
        const {component, profileStore, displayStore} = CreateConstructedComponentHarness(CatalogSystemType.ICRS, []);
        runInAction(() => {
            profileStore.selectedPointIndices = Array.from({length: 50}, (_, index) => index + 100);
        });
        displayStore.setShowSelectedData(false);
        const scrollToRegion = jest.spyOn(component, "scrollToRegion").mockImplementation(() => undefined);

        component["onCompleteRender"]();
        expect(scrollToRegion).not.toHaveBeenCalled();

        displayStore.setShowSelectedData(isShowingSelectedData);
        displayStore.requestCatalogTableAutoScroll();
        component["onCompleteRender"]();
        expect(scrollToRegion).toHaveBeenCalledTimes(1);
        expect(scrollToRegion).toHaveBeenLastCalledWith(undefined, Regions.row(isShowingSelectedData ? 0 : 100));
        expect(component["hasPendingAutoScroll"](displayStore)).toBe(false);

        // Scrolling the virtualized table renders more rows without requesting another auto-scroll.
        component["onCompleteRender"]();
        expect(scrollToRegion).toHaveBeenCalledTimes(1);

        displayStore.requestCatalogTableAutoScroll();
        component["onCompleteRender"]();
        expect(scrollToRegion).toHaveBeenCalledTimes(2);
        expect(component["hasPendingAutoScroll"](displayStore)).toBe(false);
    });

    test("resets the size-axis tab when a settings shortcut is opened", () => {
        const {component, componentId, displayStore} = CreateConstructedComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}]);
        const widgetStore = WidgetsStore.Instance.catalogWidgets.get(componentId);
        displayStore.setSizeAxisTab(CatalogSettingsTabs.SIZE_MINOR);
        jest.spyOn(WidgetsStore.Instance, "createFloatingSettingsWidget").mockImplementation(jest.fn());

        component["shortcutoOnClick"](CatalogSettingsTabs.COLOR);

        expect(widgetStore?.settingsTabFor(component.catalogFileId)).toBe(CatalogSettingsTabs.COLOR);
        expect(displayStore.sizeAxisTabId).toBe(CatalogSettingsTabs.SIZE_MAJOR);
    });

    describe("isImageOverlaySelectionDirty", () => {
        test("reports pending plot changes when current axes differ from the applied overlay", () => {
            const {component, profileStore, displayStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}, {name: "ra_alt"}], "ra_alt", "dec");

            displayStore.hasPlottedImageOverlay = true;
            displayStore.plottedImageOverlayMaxRows = profileStore.rows.rowLimit;
            displayStore.plottedImageOverlayXAxis = "ra";
            displayStore.plottedImageOverlayYAxis = "dec";
            displayStore.plottedImageOverlaySystem = CatalogSystemType.ICRS;

            expect(component.isImageOverlaySelectionDirty).toBe(true);

            displayStore.xAxis = "ra";
            expect(component.isImageOverlaySelectionDirty).toBe(false);
        });

        test("reports pending plot changes when only the coordinate system differs", () => {
            const {component, profileStore, displayStore} = CreateComponentHarness(CatalogSystemType.FK5, [{name: "_RAJ2000"}, {name: "_DEJ2000"}], "_RAJ2000", "_DEJ2000");

            displayStore.hasPlottedImageOverlay = true;
            displayStore.plottedImageOverlayMaxRows = profileStore.rows.rowLimit;
            displayStore.plottedImageOverlayXAxis = "_RAJ2000";
            displayStore.plottedImageOverlayYAxis = "_DEJ2000";
            displayStore.plottedImageOverlaySystem = CatalogSystemType.ICRS;

            expect(component.isImageOverlaySelectionDirty).toBe(true);

            profileStore.catalogCoordinateSystem.system = CatalogSystemType.ICRS;
            expect(component.isImageOverlaySelectionDirty).toBe(false);
        });

        test("reports pending plot changes when max rows increases past plotted rows", () => {
            const {component, profileStore, displayStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}], "ra", "dec");

            displayStore.hasPlottedImageOverlay = true;
            displayStore.plottedImageOverlayMaxRows = 100;
            displayStore.plottedImageOverlayXAxis = "ra";
            displayStore.plottedImageOverlayYAxis = "dec";
            displayStore.plottedImageOverlaySystem = CatalogSystemType.ICRS;
            profileStore.rows.rowLimit = 200;

            expect(component.isImageOverlaySelectionDirty).toBe(true);

            profileStore.rows.rowLimit = 100;
            expect(component.isImageOverlaySelectionDirty).toBe(false);
        });

        test("does not report pending plot changes when max rows is reduced below plotted rows", () => {
            const {component, profileStore, displayStore} = CreateComponentHarness(CatalogSystemType.ICRS, [{name: "ra"}, {name: "dec"}], "ra", "dec");

            displayStore.hasPlottedImageOverlay = true;
            displayStore.plottedImageOverlayMaxRows = 1500;
            displayStore.plottedImageOverlayXAxis = "ra";
            displayStore.plottedImageOverlayYAxis = "dec";
            displayStore.plottedImageOverlaySystem = CatalogSystemType.ICRS;
            profileStore.rows.rowLimit = 200;

            expect(component.isImageOverlaySelectionDirty).toBe(false);
        });
    });
});
