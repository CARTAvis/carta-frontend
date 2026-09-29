import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {AppToaster} from "components/Shared";
import {CatalogOverlay, CatalogSystemType, CatalogType, ImageType, WorkspaceItemKind} from "enums";
import {AppStore, CatalogOnlineQueryStore, CatalogProfileStore, scaleZoomForImageRatio, WorkspaceSnapshotter} from "stores";
import {CatalogAxisEligibility} from "utilities";

describe("AppStore.handleCatalogFilterStream", () => {
    const appStore = AppStore.Instance;
    const catalogStore = appStore.catalogStore;
    const widgetsStore = appStore.widgetsStore;

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogDisplayStores.forEach(displayStore => displayStore.dispose?.());
        catalogStore.catalogDisplayStores.clear();
        catalogStore.widgetBindings.componentIds().forEach(id => catalogStore.widgetBindings.closeComponent(id));
        catalogStore.catalogImageIds.clear();
        widgetsStore.catalogWidgets.clear();
        widgetsStore.catalogPlotWidgets.clear();
        catalogStore.catalogRequests.forget(1);
        // The responses below all answer request 1 for catalog 1, which is what sending the filter
        // would have recorded.
        catalogStore.catalogRequests.attach(1, 1);
    });

    test("skips coordinate conversion when the selected x axis is CatalogOverlay.NONE", () => {
        const processedData = new Map<number, unknown>();
        const profileStore = {
            catalogCoordinateSystem: {system: CatalogSystemType.ICRS},
            get2DCoordinateData: jest.fn(),
            rows: {
                isLoadingForOverlay: true,
                accept: jest.fn(() => processedData)
            }
        };
        const widgetStore = {
            setPlottedImageOverlayState: jest.fn(),
            xAxis: CatalogOverlay.NONE,
            yAxis: "dec"
        };

        catalogStore.catalogProfileStores.set(1, profileStore as any);
        catalogStore.catalogDisplayStores.set(1, widgetStore as any);

        jest.spyOn(appStore, "getFrame").mockReturnValue({isValidWcs: true, wcsInfo: "wcs"} as any);
        jest.spyOn(catalogStore, "imageIdOf").mockReturnValue(10);
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

        expect(profileStore.rows.accept).toHaveBeenCalledWith(expect.objectContaining({fileId: 1}));
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
            rows: {
                isLoadingForOverlay: true,
                accept: jest.fn(() => processedData)
            }
        };
        const widgetStore = {
            setPlottedImageOverlayState: jest.fn(),
            xAxis: "_RAJ2000",
            yAxis: "_DEJ2000"
        };
        const frame = {isValidWcs: true, wcsInfo: "wcs"} as any;

        catalogStore.catalogProfileStores.set(1, profileStore as any);
        catalogStore.catalogDisplayStores.set(1, widgetStore as any);

        jest.spyOn(appStore, "getFrame").mockReturnValue(frame);
        jest.spyOn(catalogStore, "imageIdOf").mockReturnValue(10);
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

        expect(profileStore.get2DCoordinateData).toHaveBeenCalledWith("_RAJ2000", "_DEJ2000", processedData, CatalogSystemType.FK5);
        expect(convertSpy).toHaveBeenCalledWith(1, [1.1], [2.2], "wcs", "deg", "deg", expect.objectContaining({system: CatalogSystemType.FK5}), 1, 1, undefined);
        expect(widgetStore.setPlottedImageOverlayState).toHaveBeenCalledWith("_RAJ2000", "_DEJ2000", CatalogSystemType.FK5);
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
            rows: {
                isLoadingForOverlay: true,
                accept: jest.fn(() => processedData)
            }
        };
        const widgetStore = {
            setPlottedImageOverlayState: jest.fn(),
            xAxis: "GLON1",
            yAxis: "GLAT1"
        };

        catalogStore.catalogProfileStores.set(1, profileStore as any);
        catalogStore.catalogDisplayStores.set(1, widgetStore as any);

        jest.spyOn(appStore, "getFrame").mockReturnValue({isValidWcs: true, wcsInfo: "wcs"} as any);
        jest.spyOn(catalogStore, "imageIdOf").mockReturnValue(10);
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

        expect(convertSpy).toHaveBeenCalledWith(1, [150], [2.476567], "wcs", "", "", expect.objectContaining({system: CatalogSystemType.Galactic}), 1, 1, undefined);
        expect(widgetStore.setPlottedImageOverlayState).toHaveBeenCalledWith("GLON1", "GLAT1", CatalogSystemType.Galactic);
    });

    test("plots streamed rows on the overlay that is drawn, not the plot controls it has been left on", () => {
        const processedData = new Map<number, unknown>();
        const profileStore = {
            catalogCoordinateSystem: {system: CatalogSystemType.Galactic},
            get2DCoordinateData: jest.fn(() => ({
                wcsX: [1.1],
                wcsY: [2.2],
                xHeaderInfo: {units: "deg"},
                yHeaderInfo: {units: "deg"}
            })),
            getCoordinateEligibility: jest.fn(() => ({status: CatalogAxisEligibility.Eligible})),
            rows: {
                isLoadingForOverlay: true,
                accept: jest.fn(() => processedData)
            }
        };
        // The widget has been moved on to other columns since the overlay was drawn, which does not
        // take the overlay down.
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

        jest.spyOn(appStore, "getFrame").mockReturnValue({isValidWcs: true, wcsInfo: "wcs"} as any);
        jest.spyOn(catalogStore, "imageIdOf").mockReturnValue(10);
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

        // The rows are read in the system the overlay is drawn in, not the one the control is on.
        expect(profileStore.get2DCoordinateData).toHaveBeenCalledWith("_RAJ2000", "_DEJ2000", processedData, CatalogSystemType.ICRS);
        // Both the axes and the system come from the overlay that is drawn, not from the controls:
        // converting ICRS positions as Galactic would put every source somewhere else.
        expect(convertSpy).toHaveBeenCalledWith(1, [1.1], [2.2], "wcs", "deg", "deg", expect.objectContaining({system: CatalogSystemType.ICRS}), 1, 1, 1);
        expect(widgetStore.setPlottedImageOverlayState).toHaveBeenCalledWith("_RAJ2000", "_DEJ2000", CatalogSystemType.ICRS);
    });

    test("ignores a superseded request's rows even when nothing is waiting for an answer", () => {
        // Ordinary filtering does not start a tracked wait, but its responses still have to be
        // checked: the user changed the filter, and the first request's rows arrive afterwards.
        const profileStore = {
            get2DCoordinateData: jest.fn(),
            rows: {
                isLoadingForOverlay: false,
                accept: jest.fn(() => new Map())
            }
        };
        catalogStore.catalogProfileStores.set(1, profileStore as any);
        catalogStore.catalogRequests.attach(1, 2);
        expect(catalogStore.catalogRequests.isPending(1)).toBe(false);

        appStore.handleCatalogFilterStream({
            requestId: 1,
            message: {columns: [], fileId: 1, progress: 1, subsetDataSize: 1, subsetEndIndex: 1} as unknown as CARTA.CatalogFilterResponse
        });

        expect(profileStore.rows.accept).not.toHaveBeenCalled();
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
            rows: {
                isLoadingForOverlay: false,
                accept: jest.fn(() => processedData)
            }
        };
        const widgetStore = {
            setPlottedImageOverlayState: jest.fn(),
            xAxis: "RAJ2000",
            yAxis: "_DEJ2000"
        };

        catalogStore.catalogProfileStores.set(1, profileStore as any);
        catalogStore.catalogDisplayStores.set(1, widgetStore as any);

        jest.spyOn(appStore, "getFrame").mockReturnValue({isValidWcs: true, wcsInfo: "wcs"} as any);
        jest.spyOn(catalogStore, "imageIdOf").mockReturnValue(10);
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

        expect(profileStore.rows.accept).toHaveBeenCalledWith(expect.objectContaining({fileId: 1}));
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
            get2DCoordinateData: jest
                .fn()
                .mockReturnValueOnce({wcsX: [3], wcsY: [4], xHeaderInfo: {units: "deg"}, yHeaderInfo: {units: "deg"}})
                .mockReturnValueOnce({wcsX: [1, 2, 3], wcsY: [4, 5, 6], xHeaderInfo: {units: "deg"}, yHeaderInfo: {units: "deg"}}),
            getCoordinateEligibility: jest.fn(() => ({status: isFormatKnown ? CatalogAxisEligibility.Eligible : CatalogAxisEligibility.Unknown})),
            rows: {
                isLoadingForOverlay: true,
                data: accumulatedData,
                accept: jest.fn(() => {
                    isFormatKnown = true;
                    return processedData;
                })
            }
        };
        const widgetStore = {
            setPlottedImageOverlayState: jest.fn(),
            xAxis: "elon",
            yAxis: "elat"
        };

        catalogStore.catalogProfileStores.set(1, profileStore as any);
        catalogStore.catalogDisplayStores.set(1, widgetStore as any);

        jest.spyOn(appStore, "getFrame").mockReturnValue({isValidWcs: true, wcsInfo: "wcs"} as any);
        jest.spyOn(catalogStore, "imageIdOf").mockReturnValue(10);
        const clearSpy = jest.spyOn(catalogStore, "clearImageCoordsData").mockImplementation(jest.fn());
        const convertSpy = jest.spyOn(catalogStore, "convertToImageCoordinate").mockImplementation(jest.fn());

        appStore.handleCatalogFilterStream({
            requestId: 1,
            message: {
                columns: [],
                fileId: 1,
                progress: 1,
                subsetDataSize: 1,
                subsetEndIndex: 3
            } as unknown as CARTA.CatalogFilterResponse
        });

        expect(clearSpy).toHaveBeenCalledWith(1);
        expect(profileStore.get2DCoordinateData).toHaveBeenNthCalledWith(2, "elon", "elat", accumulatedData, CatalogSystemType.Ecliptic, 3);
        expect(convertSpy).toHaveBeenCalledWith(1, [1, 2, 3], [4, 5, 6], "wcs", "deg", "deg", expect.objectContaining({system: CatalogSystemType.Ecliptic, equinox: "B1950.0", epoch: "B1950.0"}), 0, 0, undefined);
    });

    test("completes a request when its profile store was removed before the final response", () => {
        catalogStore.catalogRequests.start(7);
        catalogStore.catalogRequests.attach(7, 42);

        appStore.handleCatalogFilterStream({
            requestId: 42,
            message: {
                columns: [],
                fileId: 7,
                progress: 1,
                subsetDataSize: 0,
                subsetEndIndex: 0
            } as unknown as CARTA.CatalogFilterResponse
        });

        expect(catalogStore.catalogRequests.accepts(7, 42)).toBe(false);
    });
});

describe("AppStore.handleErrorStream", () => {
    const appStore = AppStore.Instance;
    const catalogStore = appStore.catalogStore;

    const image = {frameInfo: {fileId: 10, fileInfo: {}}, restFreqStore: {customRestFreq: {}}, isValidWcs: false, wcsInfo: 0};

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogImageIds.clear();
        appStore.setActiveImage({type: ImageType.FRAME, store: image} as any);
        jest.spyOn(appStore, "getFrame").mockImplementation(fileId => (fileId === image.frameInfo.fileId ? image : undefined) as any);
        jest.spyOn(appStore.backendService, "setCatalogFilterRequest").mockReturnValue(1);
    });

    afterEach(() => {
        appStore.setActiveImage(null);
        catalogStore.catalogImageIds.clear();
    });

    function addProfileStore(catalogFileId: number) {
        const profileStore = new CatalogProfileStore({dataSize: 10, directory: "", fileId: catalogFileId, fileInfo: new CARTA.CatalogFileInfo({name: "test-catalog"})}, [], new Map(), CatalogType.FILE);
        catalogStore.catalogProfileStores.set(catalogFileId, profileStore);
        // Rows are only asked for a catalog on an image.
        catalogStore.catalogImageIds.set(catalogFileId, image.frameInfo.fileId);
        return profileStore;
    }

    function startPendingRestore(catalogFileId: number) {
        addProfileStore(catalogFileId);
        return catalogStore.restoreCatalogFromWorkspace(catalogFileId);
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

        await expect(firstCompletion).resolves.toEqual({success: false, didStart: true, message: "catalog request failed"});
        expect(catalogStore.catalogRequests.isPending(8)).toBe(true);
        catalogStore.catalogRequests.failAll("test cleanup");
    });

    test("stops a catalog reading as still loading when a request nothing waited for fails", () => {
        // A table or overlay request is sent without a wait, so an error on it used to leave the
        // catalog marked as loading for good: the responses that would have cleared the mark are
        // not read once the request has been given up on.
        const profileStore = addProfileStore(3);
        catalogStore.catalogRequests.attach(3, 12);
        runInAction(() => (profileStore.rows.isStreaming = true));

        appStore.handleErrorStream({severity: 3, tags: ["catalog_filter"], data: "3", message: "catalog request failed"} as any);

        expect(profileStore.isLoadingOntoImage).toBe(false);
        // Which is what saving a workspace looks at before it refuses.
        expect(catalogStore.streamingCatalogNames).toEqual([]);
    });

    test("ignores a response from a restore request that has already failed", async () => {
        const completion = startPendingRestore(9);
        const profileStore = catalogStore.catalogProfileStores.get(9)!;
        catalogStore.catalogRequests.attach(9, 1);
        catalogStore.catalogRequests.finish(9, false, "restore timed out");
        await expect(completion).resolves.toEqual({success: false, didStart: true, message: "restore timed out"});

        const updateSpy = jest.spyOn(profileStore.rows, "accept");
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

describe("AppStore.isOpenFileDisabled", () => {
    const appStore = AppStore.Instance;

    afterEach(() => {
        appStore.isLoadingWorkspace = false;
        appStore.isResumingSession = false;
    });

    test("turns the file actions off while a workspace is being restored", () => {
        // The keyboard reaches past the progress dialog, so the actions themselves have to refuse:
        // a restore does its own opening and closing and cannot have the user joining in.
        appStore.isLoadingWorkspace = true;

        expect(appStore.isOpenFileDisabled).toBe(true);
        expect(appStore.isAppendFileDisabled).toBe(true);
    });

    test("turns them off while a session is being resumed", () => {
        appStore.isResumingSession = true;

        expect(appStore.isOpenFileDisabled).toBe(true);
    });
});

describe("AppStore.saveWorkspace", () => {
    const appStore = AppStore.Instance;
    const catalogStore = appStore.catalogStore;

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        CatalogOnlineQueryStore.Instance.setIsQuerying(false);
        appStore.endFileLoading();
    });

    function addCatalog(catalogFileId: number, name: string): CatalogProfileStore {
        const profileStore = new CatalogProfileStore({dataSize: 10, directory: "", fileId: catalogFileId, fileInfo: new CARTA.CatalogFileInfo({name})}, [], new Map(), CatalogType.FILE);
        catalogStore.catalogProfileStores.set(catalogFileId, profileStore);
        return profileStore;
    }

    test("refuses to save while a catalog is still streaming", async () => {
        const streaming = addCatalog(1, "streaming.vot");
        runInAction(() => (streaming.rows.isLoading = true));
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

    test("refuses to save while a workspace is still being restored", async () => {
        // A restore opens its images and catalogs one after another, so part of it may already be
        // in the session while the rest is still on its way.
        runInAction(() => (appStore.isLoadingWorkspace = true));
        const saveSpy = jest.spyOn(appStore.apiService, "setWorkspace").mockResolvedValue(undefined as any);

        await expect(appStore.saveWorkspace("test-workspace")).resolves.toBe(false);

        expect(saveSpy).not.toHaveBeenCalled();
        expect(appStore.alertStore.alertText).toContain("workspace is still loading");
        appStore.alertStore.dismissAlert();
        runInAction(() => (appStore.isLoadingWorkspace = false));
    });

    test("refuses to save while a file is still being opened", async () => {
        // The image is not a frame yet and the catalog has no profile store yet, so nothing the
        // other two gates look at is holding the save up -- it would just be saved without them.
        appStore.startFileLoading();
        const saveSpy = jest.spyOn(appStore.apiService, "setWorkspace").mockResolvedValue(undefined as any);

        await expect(appStore.saveWorkspace("test-workspace")).resolves.toBe(false);

        expect(saveSpy).not.toHaveBeenCalled();
        expect(appStore.alertStore.alertText).toContain("still loading");
        appStore.alertStore.dismissAlert();
        appStore.endFileLoading();
    });

    test("refuses to save while a catalog is still being opened, after another load has cleared the shared loading flag", async () => {
        let finishOpening!: (profileStore: undefined) => void;
        const opening = catalogStore.open({} as any, () => new Promise(resolve => (finishOpening = resolve)));
        // Some other load or generator, finishing first, clears the flag for everything.
        appStore.endFileLoading();
        const saveSpy = jest.spyOn(appStore.apiService, "setWorkspace").mockResolvedValue(undefined as any);

        await expect(appStore.saveWorkspace("test-workspace")).resolves.toBe(false);

        expect(saveSpy).not.toHaveBeenCalled();
        expect(appStore.alertStore.alertText).toContain("still loading");
        appStore.alertStore.dismissAlert();
        finishOpening(undefined);
        await expect(opening).resolves.toBeUndefined();
        expect(catalogStore.isOpeningCatalog).toBe(false);
    });

    test("refuses to save while an image is still being opened, after another load has cleared the shared loading flag", async () => {
        let failOpening!: (error: Error) => void;
        jest.spyOn(appStore.backendService, "loadFile").mockReturnValue(new Promise((_resolve, reject) => (failOpening = reject)) as any);
        const opening = appStore.loadFile("", "image.fits", "", false);
        appStore.endFileLoading();
        const saveSpy = jest.spyOn(appStore.apiService, "setWorkspace").mockResolvedValue(undefined as any);

        await expect(appStore.saveWorkspace("test-workspace")).resolves.toBe(false);

        expect(saveSpy).not.toHaveBeenCalled();
        expect(appStore.alertStore.alertText).toContain("still loading");
        appStore.alertStore.dismissAlert();
        failOpening(new Error("unreadable image"));
        await expect(opening).rejects.toThrow("unreadable image");
        appStore.alertStore.dismissAlert();
    });

    test("refuses to save while an online catalog query is still running", async () => {
        // The catalog is not in the session yet, so nothing is streaming: the query itself is what
        // the save has to wait for.
        CatalogOnlineQueryStore.Instance.setIsQuerying(true);
        const saveSpy = jest.spyOn(appStore.apiService, "setWorkspace").mockResolvedValue(undefined as any);

        await expect(appStore.saveWorkspace("test-workspace")).resolves.toBe(false);

        expect(saveSpy).not.toHaveBeenCalled();
        expect(appStore.alertStore.alertText).toContain("online catalog query");
        appStore.alertStore.dismissAlert();
    });

    test("shows one toast for everything the workspace could not be saved with, and logs each", async () => {
        const issues = [
            {kind: WorkspaceItemKind.Catalog, subject: "a.vot", message: "Could not save the catalog a.vot"},
            {kind: WorkspaceItemKind.Catalog, subject: "b.vot", message: "Could not save the catalog b.vot"}
        ];
        jest.spyOn(WorkspaceSnapshotter.prototype, "capture").mockReturnValue({workspace: {workspaceVersion: 2, frontendVersion: "5.0.0"} as any, issues});
        const addWarning = jest.spyOn(appStore.logStore, "addWarning");
        const showToast = jest.spyOn(AppToaster, "show").mockResolvedValue();
        jest.spyOn(appStore.apiService, "setWorkspace").mockResolvedValue(undefined as any);

        await appStore.saveWorkspace("test-workspace");

        expect(addWarning.mock.calls.map(([message]) => message)).toEqual(issues.map(issue => issue.message));
        expect(showToast).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(showToast.mock.calls[0][0])).toContain("2 item(s) could not be saved");
    });

    test("does not report a catalog whose rows have all arrived", () => {
        const profileStore = addCatalog(1, "loaded.vot");
        runInAction(() => (profileStore.rows.isLoading = true));
        runInAction(() => (profileStore.rows.isStreaming = true));
        expect(catalogStore.streamingCatalogNames).toEqual(["loaded.vot"]);

        runInAction(() => (profileStore.rows.isLoading = false));
        runInAction(() => (profileStore.rows.isStreaming = false));

        expect(catalogStore.streamingCatalogNames).toEqual([]);
    });
});

describe("scaleZoomForImageRatio", () => {
    test("preserves independent axis zoom while scaling for image export", () => {
        expect(scaleZoomForImageRatio({effectiveZoomLevel: {x: 2, y: 4}, isAxisZoomable: true, zoomLevel: 4} as any, 2)).toEqual({x: 4, y: 8});
    });
});
