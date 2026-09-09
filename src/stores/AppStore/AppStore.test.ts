import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogSystemType, CatalogType, CatalogUpdateMode} from "enums";
import {AppStore, CatalogOnlineQueryConfigStore, CatalogProfileStore, scaleZoomForImageRatio} from "stores";
import {ProtobufProcessing} from "utilities";

describe("AppStore.handleCatalogFilterStream", () => {
    const appStore = AppStore.Instance;
    const catalogStore = appStore.catalogStore;

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogDisplayStores.forEach(displayStore => displayStore.dispose?.());
        catalogStore.catalogDisplayStores.clear();
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
            requestId: 1,
            message: {
                columns: [],
                fileId: 1,
                progress: 1,
                subsetDataSize: 0,
                subsetEndIndex: 0
            } as unknown as CARTA.CatalogFilterResponse
        });

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
            requestId: 1,
            message: {
                columns: [],
                fileId: 1,
                progress: 1,
                subsetDataSize: 1,
                subsetEndIndex: 1
            } as unknown as CARTA.CatalogFilterResponse
        });

        expect(profileStore.get2DPlotData).toHaveBeenCalledWith("_RAJ2000", "_DEJ2000", processedData);
        expect(convertSpy).toHaveBeenCalledWith(1, [1.1], [2.2], "wcs", "deg", "deg", CatalogSystemType.FK5, 1, 1);
        expect(widgetStore.setPlottedImageOverlayState).toHaveBeenCalledWith("_RAJ2000", "_DEJ2000", CatalogSystemType.FK5);
        expect(profileStore.setLoadingDataStatus).toHaveBeenCalledWith(false);
        expect(profileStore.setUpdatingDataStream).toHaveBeenCalledWith(false);
    });

    test("plots streamed rows on the overlay that is drawn, not the plot controls it has been left on", () => {
        const processedData = new Map<number, unknown>();
        const profileStore = {
            catalogCoordinateSystem: {system: CatalogSystemType.Galactic},
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
        // The panel has been moved on to other columns and another system since the overlay was
        // drawn, which does not take the overlay down.
        const widgetStore = {
            hasPlottedImageOverlay: true,
            plottedImageOverlaySystem: CatalogSystemType.ICRS,
            plottedImageOverlayXAxis: "_RAJ2000",
            plottedImageOverlayYAxis: "_DEJ2000",
            plottedImageOverlayMaxRows: 1,
            setPlottedImageOverlayState: jest.fn(),
            xAxis: "Fmag",
            yAxis: "Bmag"
        };

        catalogStore.catalogProfileStores.set(1, profileStore as any);
        catalogStore.catalogDisplayStores.set(1, widgetStore as any);

        jest.spyOn(ProtobufProcessing, "processCatalogData").mockReturnValue(processedData as any);
        jest.spyOn(appStore, "getFrame").mockReturnValue({isValidWcs: true, wcsInfo: "wcs"} as any);
        jest.spyOn(catalogStore, "getFrameIdByCatalogId").mockReturnValue(10);
        const convertSpy = jest.spyOn(catalogStore, "convertToImageCoordinate").mockImplementation(jest.fn());

        appStore.handleCatalogFilterStream({
            requestId: 1,
            message: {
                columns: [],
                fileId: 1,
                progress: 1,
                subsetDataSize: 1,
                subsetEndIndex: 1
            } as unknown as CARTA.CatalogFilterResponse
        });

        expect(profileStore.get2DPlotData).toHaveBeenCalledWith("_RAJ2000", "_DEJ2000", processedData);
        expect(convertSpy).toHaveBeenCalledWith(1, [1.1], [2.2], "wcs", "deg", "deg", CatalogSystemType.ICRS, 1, 1, 1);
        expect(widgetStore.setPlottedImageOverlayState).toHaveBeenCalledWith("_RAJ2000", "_DEJ2000", CatalogSystemType.ICRS);
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
            requestId: 1,
            message: {
                columns: [],
                fileId: 1,
                progress: 1,
                subsetDataSize: 1,
                subsetEndIndex: 1
            } as unknown as CARTA.CatalogFilterResponse
        });

        expect(profileStore.updateCatalogData).toHaveBeenCalledWith(expect.objectContaining({fileId: 1}), processedData);
        expect(profileStore.get2DPlotData).not.toHaveBeenCalled();
        expect(convertSpy).not.toHaveBeenCalled();
        expect(widgetStore.setPlottedImageOverlayState).not.toHaveBeenCalled();
    });
});

describe("AppStore.handleErrorStream", () => {
    const appStore = AppStore.Instance;
    const catalogStore = appStore.catalogStore;

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        jest.spyOn(appStore, "sendCatalogFilter").mockReturnValue(1);
    });

    function startPendingRestore(catalogFileId: number) {
        const profileStore = new CatalogProfileStore({dataSize: 10, directory: "", fileId: catalogFileId, fileInfo: new CARTA.CatalogFileInfo({name: "test-catalog"})}, [], new Map(), CatalogType.FILE);
        catalogStore.catalogProfileStores.set(catalogFileId, profileStore);
        catalogStore.restoreCatalogFromWorkspace(catalogFileId, undefined, true);
        return catalogStore.catalogRequests.wait(catalogFileId);
    }

    test("does not fail catalog restores for unrelated or non-fatal errors", async () => {
        startPendingRestore(1);

        appStore.handleErrorStream({severity: 2, tags: ["image"], data: "1", message: "image warning"} as any);
        appStore.handleErrorStream({severity: 3, tags: ["image"], data: "1", message: "image error"} as any);
        appStore.handleErrorStream({severity: 3, tags: ["catalog_filter"], data: "", message: "catalog error without an ID"} as any);

        expect(catalogStore.catalogRequests.isPending(1)).toBe(true);
        catalogStore.catalogRequests.failAll("test cleanup");
    });

    test("fails only the identified catalog restore for a fatal catalog error", async () => {
        const firstCompletion = startPendingRestore(7);
        startPendingRestore(8);

        appStore.handleErrorStream({severity: 3, tags: ["catalog_filter"], data: "7", message: "catalog request failed"} as any);

        await expect(firstCompletion).resolves.toEqual({success: false, message: "catalog request failed"});
        expect(catalogStore.catalogRequests.isPending(8)).toBe(true);
        catalogStore.catalogRequests.failAll("test cleanup");
    });

    test("ignores a response from a restore request that has already failed", async () => {
        const completion = startPendingRestore(9);
        const profileStore = catalogStore.catalogProfileStores.get(9)!;
        catalogStore.catalogRequests.attach(9, 1);
        catalogStore.catalogRequests.finish(9, false, "restore timed out");
        await expect(completion).resolves.toEqual({success: false, message: "restore timed out"});

        const updateSpy = jest.spyOn(profileStore, "updateCatalogData");
        appStore.handleCatalogFilterStream({
            requestId: 1,
            message: {
                columns: [],
                fileId: 9,
                progress: 1,
                subsetDataSize: 1,
                subsetEndIndex: 1
            }
        } as any);

        expect(updateSpy).not.toHaveBeenCalled();
    });
});

describe("AppStore.updateCatalogProfile", () => {
    const appStore = AppStore.Instance;
    const catalogStore = appStore.catalogStore;

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogDisplayStores.forEach(displayStore => displayStore.dispose?.());
        catalogStore.catalogDisplayStores.clear();
        appStore.widgetsStore.catalogPanelWidgets.clear();
        catalogStore.imageAssociatedCatalogId.clear();
    });

    test("associates the catalog with the image it was given rather than the active one", () => {
        // No image is active here, which is what restoring a workspace onto a background image
        // looks like: the association has to come from the frame that was passed in.
        expect(appStore.activeFrame).toBeFalsy();

        appStore.updateCatalogProfile(3, {frameInfo: {fileId: 7}} as any);

        expect(catalogStore.imageAssociatedCatalogId.get(7)).toContain(3);
    });
});

describe("AppStore.saveWorkspace", () => {
    const appStore = AppStore.Instance;
    const catalogStore = appStore.catalogStore;

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        CatalogOnlineQueryConfigStore.Instance.setQueryStatus(false);
    });

    function addCatalog(catalogFileId: number, name: string): CatalogProfileStore {
        const profileStore = new CatalogProfileStore({dataSize: 10, directory: "", fileId: catalogFileId, fileInfo: new CARTA.CatalogFileInfo({name})}, [], new Map(), CatalogType.FILE);
        catalogStore.catalogProfileStores.set(catalogFileId, profileStore);
        return profileStore;
    }

    test("refuses to save while a catalog is still streaming", async () => {
        addCatalog(1, "streaming.vot").setLoadingDataStatus(true);
        addCatalog(2, "loaded.vot");
        const saveSpy = jest.spyOn(appStore.apiService, "setWorkspace").mockResolvedValue(undefined as any);

        await expect(appStore.saveWorkspace("test-workspace")).resolves.toBe(false);

        expect(saveSpy).not.toHaveBeenCalled();
        expect(appStore.alertStore.isAlertVisible).toBe(true);
        // The alert names the catalog that is holding the save up, and only that one.
        expect(appStore.alertStore.alertText).toContain("streaming.vot");
        expect(appStore.alertStore.alertText).not.toContain("loaded.vot");
        appStore.alertStore.dismissAlert();
    });

    test("refuses to save while an online catalog query is still running", async () => {
        // The catalog is not in the session yet, so nothing is streaming: the query itself is what
        // the save has to wait for.
        CatalogOnlineQueryConfigStore.Instance.setQueryStatus(true);
        const saveSpy = jest.spyOn(appStore.apiService, "setWorkspace").mockResolvedValue(undefined as any);

        await expect(appStore.saveWorkspace("test-workspace")).resolves.toBe(false);

        expect(saveSpy).not.toHaveBeenCalled();
        expect(appStore.alertStore.alertText).toContain("online catalog query");
        appStore.alertStore.dismissAlert();
    });

    test("does not report a catalog whose rows have all arrived", () => {
        const profileStore = addCatalog(1, "loaded.vot");
        profileStore.setLoadingDataStatus(true);
        profileStore.setUpdatingDataStream(true);
        expect(catalogStore.streamingCatalogNames).toEqual(["loaded.vot"]);

        profileStore.setLoadingDataStatus(false);
        profileStore.setUpdatingDataStream(false);

        expect(catalogStore.streamingCatalogNames).toEqual([]);
    });
});

describe("scaleZoomForImageRatio", () => {
    test("preserves independent axis zoom while scaling for image export", () => {
        expect(scaleZoomForImageRatio({effectiveZoomLevel: {x: 2, y: 4}, isAxisZoomable: true, zoomLevel: 4} as any, 2)).toEqual({x: 4, y: 8});
    });
});
