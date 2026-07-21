import type {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogSystemType, CatalogUpdateMode} from "enums";
import {AppStore} from "stores";
import {ProtobufProcessing} from "utilities";

describe("AppStore.handleCatalogFilterStream", () => {
    const appStore = AppStore.Instance;
    const catalogStore = appStore.catalogStore;
    const widgetsStore = appStore.widgetsStore;

    beforeEach(() => {
        jest.restoreAllMocks();
        catalogStore.catalogProfileStores.clear();
        catalogStore.catalogWidgets.clear();
        widgetsStore.catalogWidgets.clear();
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
        catalogStore.catalogWidgets.set(1, "widget-1");
        widgetsStore.catalogWidgets.set("widget-1", widgetStore as any);

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
        catalogStore.catalogWidgets.set(1, "widget-1");
        widgetsStore.catalogWidgets.set("widget-1", widgetStore as any);

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
        catalogStore.catalogWidgets.set(1, "widget-1");
        widgetsStore.catalogWidgets.set("widget-1", widgetStore as any);

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
});

describe("AppStore.updateHistogram", () => {
    const appStore = AppStore.Instance;
    const pendingChannelHistograms = (appStore as unknown as {pendingChannelHistograms: Map<string, CARTA.RegionHistogramData.$Properties>}).pendingChannelHistograms;

    afterEach(() => {
        jest.restoreAllMocks();
        pendingChannelHistograms.clear();
        appStore.channelMapStore.setChannelMapEnabled(false);
    });

    test("ignores non-active channel-map histograms", () => {
        const frame = {
            channel: 0,
            stokes: 0,
            polarizations: [],
            renderConfig: {
                setStokesIndex: jest.fn(),
                setHistChannel: jest.fn(),
                updateChannelHistogram: jest.fn()
            }
        };
        jest.spyOn(appStore, "getFrame").mockReturnValue(frame as any);
        appStore.channelMapStore.setChannelMapEnabled(true);
        pendingChannelHistograms.set("1_0_1", {fileId: 1, stokes: 0, channel: 1, histograms: {}});

        appStore.updateHistogram(1, 0, 1);

        expect(frame.channel).toBe(0);
        expect(frame.stokes).toBe(0);
        expect(frame.renderConfig.updateChannelHistogram).not.toHaveBeenCalled();
    });

    test("applies the active channel-map histogram", () => {
        const frame = {
            channel: 0,
            stokes: 0,
            polarizations: [],
            renderConfig: {
                setStokesIndex: jest.fn(),
                setHistChannel: jest.fn(),
                updateChannelHistogram: jest.fn()
            }
        };
        jest.spyOn(appStore, "getFrame").mockReturnValue(frame as any);
        appStore.channelMapStore.setChannelMapEnabled(true);
        pendingChannelHistograms.set("1_0_0", {fileId: 1, stokes: 0, channel: 0, histograms: {}});

        appStore.updateHistogram(1, 0, 0);

        expect(frame.renderConfig.setHistChannel).toHaveBeenCalledWith(0);
        expect(frame.renderConfig.updateChannelHistogram).toHaveBeenCalled();
    });

    test("applies the current normal-view histogram without waiting for new tiles", () => {
        const frame = {channel: 1, stokes: 0};
        jest.spyOn(appStore, "getFrame").mockReturnValue(frame as any);
        const updateHistogram = jest.spyOn(appStore, "updateHistogram").mockImplementation();

        appStore.handleRegionHistogramStream({fileId: 1, regionId: -1, channel: 1, stokes: 0, histograms: {}} as CARTA.RegionHistogramData);

        expect(updateHistogram).toHaveBeenCalledWith(1, 0, 1);
    });
});

describe("AppStore channel-map data streams", () => {
    const appStore = AppStore.Instance;
    const frame = {frameInfo: {fileId: 1}, channel: 0, stokes: 0, setCursorValue: jest.fn()};

    beforeEach(() => {
        jest.spyOn(appStore, "getFrame").mockReturnValue(frame as any);
        frame.setCursorValue.mockClear();
        appStore.channelMapStore.setChannelMapEnabled(true);
        appStore.spatialProfiles.clear();
        appStore.regionStats.clear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        appStore.channelMapStore.setChannelMapEnabled(false);
    });

    test("ignores spatial profiles from a non-active channel", () => {
        appStore.handleSpatialProfileStream({fileId: 1, regionId: 0, channel: 1, stokes: 0});

        expect(appStore.spatialProfiles.size).toBe(0);
        expect(frame.setCursorValue).not.toHaveBeenCalled();
    });

    test("ignores statistics from a non-active channel", () => {
        appStore.handleRegionStatsStream({fileId: 1, regionId: -1, channel: 1, stokes: 0, statistics: []} as CARTA.RegionStatsData);

        expect(appStore.regionStats.size).toBe(0);
    });

    test("ignores region histograms from a non-active channel", () => {
        appStore.regionHistograms.clear();

        appStore.handleRegionHistogramStream({fileId: 1, regionId: -1, channel: 1, stokes: 0, histograms: {}} as CARTA.RegionHistogramData);

        expect(appStore.regionHistograms.size).toBe(0);
    });
});
