import type {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogSystemType, CatalogUpdateMode} from "enums";
import {AppStore, scaleZoomForImageRatio} from "stores";
import {CatalogAxisEligibility, ProtobufProcessing} from "utilities";

describe("AppStore.handleCatalogFilterStream", () => {
    const appStore = AppStore.Instance;
    const catalogStore = appStore.catalogStore;

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogDisplayStores.clear();
    });

    test("skips coordinate conversion when the selected x axis is CatalogOverlay.NONE", () => {
        const processedData = new Map<number, unknown>();
        const profileStore = {
            catalogCoordinateSystem: {system: CatalogSystemType.ICRS},
            get2DCoordinateData: jest.fn(),
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
        expect(profileStore.get2DCoordinateData).not.toHaveBeenCalled();
        expect(convertSpy).not.toHaveBeenCalled();
        expect(widgetStore.setPlottedImageOverlayState).not.toHaveBeenCalled();
    });

    test("updates the plotted overlay state after converting view-update coordinates", () => {
        const processedData = new Map<number, unknown>();
        const profileStore = {
            catalogCoordinateSystem: {system: CatalogSystemType.FK5},
            get2DCoordinateData: jest.fn(() => ({
                wcsX: [1.1],
                wcsY: [2.2],
                xHeaderInfo: {units: "deg"},
                yHeaderInfo: {units: "deg"}
            })),
            getCoordinateEligibility: jest.fn(() => ({status: CatalogAxisEligibility.Eligible})),
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

        expect(profileStore.get2DCoordinateData).toHaveBeenCalledWith("_RAJ2000", "_DEJ2000", processedData);
        expect(convertSpy).toHaveBeenCalledWith(1, [1.1], [2.2], "wcs", "deg", "deg", expect.objectContaining({system: CatalogSystemType.FK5}), 1, 1);
        expect(widgetStore.setPlottedImageOverlayState).toHaveBeenCalledWith("_RAJ2000", "_DEJ2000", CatalogSystemType.FK5);
        expect(profileStore.setLoadingDataStatus).toHaveBeenCalledWith(false);
        expect(profileStore.setUpdatingDataStream).toHaveBeenCalledWith(false);
    });

    test("updates Galactic overlays when coordinate columns have no units", () => {
        const processedData = new Map<number, unknown>();
        const profileStore = {
            catalogCoordinateSystem: {system: CatalogSystemType.Galactic},
            get2DCoordinateData: jest.fn(() => ({
                wcsX: [150],
                wcsY: [2.476567],
                xHeaderInfo: {units: ""},
                yHeaderInfo: {units: ""}
            })),
            getCoordinateEligibility: jest.fn(() => ({status: CatalogAxisEligibility.Eligible})),
            setLoadingDataStatus: jest.fn(),
            setProgress: jest.fn(),
            setUpdatingDataStream: jest.fn(),
            updateCatalogData: jest.fn(),
            updateMode: CatalogUpdateMode.ViewUpdate
        };
        const widgetStore = {
            setPlottedImageOverlayState: jest.fn(),
            xAxis: "GLON1",
            yAxis: "GLAT1"
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

        expect(convertSpy).toHaveBeenCalledWith(1, [150], [2.476567], "wcs", "", "", expect.objectContaining({system: CatalogSystemType.Galactic}), 1, 1);
        expect(widgetStore.setPlottedImageOverlayState).toHaveBeenCalledWith("GLON1", "GLAT1", CatalogSystemType.Galactic);
    });

    test("does not replot for column-update responses", () => {
        const processedData = new Map<number, unknown>();
        const profileStore = {
            catalogCoordinateSystem: {system: CatalogSystemType.FK5},
            get2DCoordinateData: jest.fn(() => ({
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
        expect(profileStore.get2DCoordinateData).not.toHaveBeenCalled();
        expect(convertSpy).not.toHaveBeenCalled();
        expect(widgetStore.setPlottedImageOverlayState).not.toHaveBeenCalled();
    });

    test("backfills the accumulated prefix when a streamed coordinate format becomes known", () => {
        const processedData = new Map<number, unknown>();
        let isFormatKnown = false;
        const accumulatedData = {prefix: "all rows"};
        const profileStore = {
            catalogCoordinateSystem: {system: CatalogSystemType.Ecliptic, equinox: "B1950.0", epoch: "B1950.0"},
            catalogData: accumulatedData,
            get2DCoordinateData: jest
                .fn()
                .mockReturnValueOnce({wcsX: [3], wcsY: [4], xHeaderInfo: {units: "deg"}, yHeaderInfo: {units: "deg"}})
                .mockReturnValueOnce({wcsX: [1, 2, 3], wcsY: [4, 5, 6], xHeaderInfo: {units: "deg"}, yHeaderInfo: {units: "deg"}}),
            getCoordinateEligibility: jest.fn(() => ({status: isFormatKnown ? CatalogAxisEligibility.Eligible : CatalogAxisEligibility.Unknown})),
            setLoadingDataStatus: jest.fn(),
            setProgress: jest.fn(),
            setUpdatingDataStream: jest.fn(),
            updateCatalogData: jest.fn(() => {
                isFormatKnown = true;
            }),
            updateMode: CatalogUpdateMode.ViewUpdate
        };
        const widgetStore = {
            setPlottedImageOverlayState: jest.fn(),
            xAxis: "elon",
            yAxis: "elat"
        };

        catalogStore.catalogProfileStores.set(1, profileStore as any);
        catalogStore.catalogDisplayStores.set(1, widgetStore as any);

        jest.spyOn(ProtobufProcessing, "processCatalogData").mockReturnValue(processedData as any);
        jest.spyOn(appStore, "getFrame").mockReturnValue({isValidWcs: true, wcsInfo: "wcs"} as any);
        jest.spyOn(catalogStore, "getFrameIdByCatalogId").mockReturnValue(10);
        const clearSpy = jest.spyOn(catalogStore, "clearImageCoordsData").mockImplementation(jest.fn());
        const convertSpy = jest.spyOn(catalogStore, "convertToImageCoordinate").mockImplementation(jest.fn());

        appStore.handleCatalogFilterStream({
            columns: [],
            fileId: 1,
            progress: 1,
            subsetDataSize: 1,
            subsetEndIndex: 3
        } as unknown as CARTA.CatalogFilterResponse);

        expect(clearSpy).toHaveBeenCalledWith(1);
        expect(profileStore.get2DCoordinateData).toHaveBeenNthCalledWith(2, "elon", "elat", accumulatedData, 3);
        expect(convertSpy).toHaveBeenCalledWith(1, [1, 2, 3], [4, 5, 6], "wcs", "deg", "deg", expect.objectContaining({system: CatalogSystemType.Ecliptic, equinox: "B1950.0", epoch: "B1950.0"}), 0, 0);
    });
});

describe("scaleZoomForImageRatio", () => {
    test("preserves independent axis zoom while scaling for image export", () => {
        expect(scaleZoomForImageRatio({effectiveZoomLevel: {x: 2, y: 4}, isAxisZoomable: true, zoomLevel: 4} as any, 2)).toEqual({x: 4, y: 8});
    });
});
