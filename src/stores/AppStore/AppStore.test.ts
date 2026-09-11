import type {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogPlotType, CatalogSystemType, CatalogUpdateMode} from "enums";
import {AppStore, CatalogStore, scaleZoomForImageRatio} from "stores";
import {ProtobufProcessing} from "utilities";

describe("AppStore.handleCatalogFilterStream", () => {
    const appStore = AppStore.Instance;
    const catalogStore = appStore.catalogStore;
    const widgetsStore = appStore.widgetsStore;

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogDisplayStores.clear();
        catalogStore.catalogProfiles.clear();
        catalogStore.catalogPlots.clear();
        catalogStore.imageAssociatedCatalogId.clear();
        widgetsStore.catalogWidgets.clear();
        widgetsStore.catalogPlotWidgets.clear();
    });

    test("updates an existing panel when loading a catalog after the panel store exists", () => {
        const panel = widgetsStore.getCatalogWidgetStore("catalog-overlay-component-0", 1);
        catalogStore.imageAssociatedCatalogId.set(100, [1]);

        jest.spyOn(widgetsStore, "createFloatingCatalogWidget");

        const componentId = appStore.updateCatalogProfile(2, {frameInfo: {fileId: 100}} as any);

        expect(componentId).toBe("catalog-overlay-component-0");
        expect(widgetsStore.createFloatingCatalogWidget).not.toHaveBeenCalled();
        expect(panel.selectedCatalogId).toBe(2);
    });

    test("updates every panel when the first catalog is loaded for a new image", () => {
        const firstPanel = widgetsStore.getCatalogWidgetStore("catalog-overlay-component-0", 1);
        const secondPanel = widgetsStore.getCatalogWidgetStore("catalog-overlay-component-1", 1);
        catalogStore.imageAssociatedCatalogId.set(101, []);

        const componentId = appStore.updateCatalogProfile(3, {frameInfo: {fileId: 101}} as any);

        expect(componentId).toBe("catalog-overlay-component-0");
        expect(firstPanel.selectedCatalogId).toBe(3);
        expect(secondPanel.selectedCatalogId).toBe(3);
    });

    test("binds restored catalog plots when this session loads its first catalog", () => {
        const widgetStoreId = widgetsStore.addCatalogPlotWidget({plotType: CatalogPlotType.D2Scatter, xColumnName: "Fmag", yColumnName: "Bmag"});
        catalogStore.setCatalogPlots("catalog-plot-component-0", CatalogStore.PENDING_CATALOG_FILE_ID, widgetStoreId!);
        catalogStore.imageAssociatedCatalogId.set(102, []);

        appStore.updateCatalogProfile(4, {frameInfo: {fileId: 102}} as any);

        expect(catalogStore.getAssociatedIdByWidgetId(widgetStoreId!).catalogFileId).toBe(4);
    });

    test("skips coordinate conversion when the selected x axis is CatalogOverlay.NONE", () => {
        const processedData = new Map<number, unknown>();
        const profileStore = {
            catalogCoordinateSystem: {system: CatalogSystemType.ICRS},
            get2DPlotData: jest.fn(),
            setLoadingDataStatus: jest.fn(),
            setProgress: jest.fn(),
            setUpdatingDataStream: jest.fn(),
            updateCatalogData: jest.fn(),
            updateMode: CatalogUpdateMode.ViewUpdate
        };
        const widgetStore = {
            setPlottedImageOverlayState: jest.fn(),
            xAxis: CatalogOverlay.NONE,
            yAxis: "dec"
        };

        catalogStore.catalogProfileStores.set(1, profileStore as any);
        catalogStore.catalogDisplayStores.set(1, widgetStore as any);

        jest.spyOn(ProtobufProcessing, "processCatalogData").mockReturnValue(processedData as any);
        jest.spyOn(appStore, "getFrame").mockReturnValue({isValidWcs: true, wcsInfo: "wcs"} as any);
        jest.spyOn(catalogStore, "getFrameIdByCatalogId").mockReturnValue(10);
        const convertSpy = jest.spyOn(catalogStore, "convertToImageCoordinate").mockImplementation(jest.fn());

        appStore.handleCatalogFilterStream({
            columns: [],
            fileId: 1,
            progress: 1,
            subsetDataSize: 0,
            subsetEndIndex: 0
        } as unknown as CARTA.CatalogFilterResponse);

        expect(profileStore.updateCatalogData).toHaveBeenCalledWith(expect.objectContaining({fileId: 1}), processedData);
        expect(profileStore.get2DPlotData).not.toHaveBeenCalled();
        expect(convertSpy).not.toHaveBeenCalled();
        expect(widgetStore.setPlottedImageOverlayState).not.toHaveBeenCalled();
    });

    test("updates the plotted overlay state after converting view-update coordinates", () => {
        const processedData = new Map<number, unknown>();
        const profileStore = {
            catalogCoordinateSystem: {system: CatalogSystemType.FK5},
            get2DPlotData: jest.fn(() => ({
                wcsX: [1.1],
                wcsY: [2.2],
                xHeaderInfo: {units: "deg"},
                yHeaderInfo: {units: "deg"}
            })),
            setLoadingDataStatus: jest.fn(),
            setProgress: jest.fn(),
            setUpdatingDataStream: jest.fn(),
            updateCatalogData: jest.fn(),
            updateMode: CatalogUpdateMode.ViewUpdate
        };
        const widgetStore = {
            setPlottedImageOverlayState: jest.fn(),
            xAxis: "_RAJ2000",
            yAxis: "_DEJ2000"
        };
        const frame = {isValidWcs: true, wcsInfo: "wcs"} as any;

        catalogStore.catalogProfileStores.set(1, profileStore as any);
        catalogStore.catalogDisplayStores.set(1, widgetStore as any);

        jest.spyOn(ProtobufProcessing, "processCatalogData").mockReturnValue(processedData as any);
        jest.spyOn(appStore, "getFrame").mockReturnValue(frame);
        jest.spyOn(catalogStore, "getFrameIdByCatalogId").mockReturnValue(10);
        const convertSpy = jest.spyOn(catalogStore, "convertToImageCoordinate").mockImplementation(jest.fn());

        appStore.handleCatalogFilterStream({
            columns: [],
            fileId: 1,
            progress: 1,
            subsetDataSize: 1,
            subsetEndIndex: 1
        } as unknown as CARTA.CatalogFilterResponse);

        expect(profileStore.get2DPlotData).toHaveBeenCalledWith("_RAJ2000", "_DEJ2000", processedData);
        expect(convertSpy).toHaveBeenCalledWith(1, [1.1], [2.2], "wcs", "deg", "deg", CatalogSystemType.FK5, 1, 1);
        expect(widgetStore.setPlottedImageOverlayState).toHaveBeenCalledWith("_RAJ2000", "_DEJ2000", CatalogSystemType.FK5);
        expect(profileStore.setLoadingDataStatus).toHaveBeenCalledWith(false);
        expect(profileStore.setUpdatingDataStream).toHaveBeenCalledWith(false);
    });

    test("does not replot for column-update responses", () => {
        const processedData = new Map<number, unknown>();
        const profileStore = {
            catalogCoordinateSystem: {system: CatalogSystemType.FK5},
            get2DPlotData: jest.fn(() => ({
                wcsX: [1.1],
                wcsY: [2.2],
                xHeaderInfo: {units: "deg"},
                yHeaderInfo: {units: "deg"}
            })),
            isUpdateColumnMode: true,
            setLoadingDataStatus: jest.fn(),
            setProgress: jest.fn(),
            setUpdatingDataStream: jest.fn(),
            updateCatalogData: jest.fn(() => {
                profileStore.isUpdateColumnMode = false;
            }),
            updateMode: CatalogUpdateMode.ViewUpdate
        };
        const widgetStore = {
            setPlottedImageOverlayState: jest.fn(),
            xAxis: "RAJ2000",
            yAxis: "_DEJ2000"
        };

        catalogStore.catalogProfileStores.set(1, profileStore as any);
        catalogStore.catalogDisplayStores.set(1, widgetStore as any);

        jest.spyOn(ProtobufProcessing, "processCatalogData").mockReturnValue(processedData as any);
        jest.spyOn(appStore, "getFrame").mockReturnValue({isValidWcs: true, wcsInfo: "wcs"} as any);
        jest.spyOn(catalogStore, "getFrameIdByCatalogId").mockReturnValue(10);
        const convertSpy = jest.spyOn(catalogStore, "convertToImageCoordinate").mockImplementation(jest.fn());

        appStore.handleCatalogFilterStream({
            columns: [],
            fileId: 1,
            progress: 1,
            subsetDataSize: 1,
            subsetEndIndex: 1
        } as unknown as CARTA.CatalogFilterResponse);

        expect(profileStore.updateCatalogData).toHaveBeenCalledWith(expect.objectContaining({fileId: 1}), processedData);
        expect(profileStore.get2DPlotData).not.toHaveBeenCalled();
        expect(convertSpy).not.toHaveBeenCalled();
        expect(widgetStore.setPlottedImageOverlayState).not.toHaveBeenCalled();
    });

    test("completes a request when its profile store was removed before the final response", () => {
        catalogStore.registerCatalogRequest(7, 42);

        appStore.handleCatalogFilterStream({
            columns: [],
            eventId: 42,
            fileId: 7,
            progress: 1,
            subsetDataSize: 0,
            subsetEndIndex: 0
        } as unknown as CARTA.CatalogFilterResponse);

        expect(catalogStore.acceptsCatalogResponse(7, 42)).toBe(false);
    });
});

describe("scaleZoomForImageRatio", () => {
    test("preserves independent axis zoom while scaling for image export", () => {
        expect(scaleZoomForImageRatio({effectiveZoomLevel: {x: 2, y: 4}, isAxisZoomable: true, zoomLevel: 4} as any, 2)).toEqual({x: 4, y: 8});
    });
});
