import type {AxiosInstance} from "axios";

import {CatalogDatabase, CatalogSystemType, RadiusUnits} from "enums";
import {CatalogOnlineQueryConfigStore, MirrorSiteStore} from "stores";

import {CatalogApiService} from "./CatalogApiService";

jest.mock("components/Shared", () => ({
    AppToaster: {show: jest.fn()},
    ErrorToast: jest.fn(),
    WarningToast: jest.fn()
}));
jest.mock("stores", () => ({
    AppStore: {Instance: {}},
    CatalogOnlineQueryConfigStore: {Instance: {}},
    CatalogOnlineQueryProfileStore: jest.fn(),
    MirrorSiteStore: {
        Instance: {
            getMirrorSites: jest.fn(() => ["https://active.example/", "https://unused.example/"]),
            getActiveMirror: jest.fn(() => "https://active.example/"),
            isMirrorUnavailable: jest.fn(() => false)
        }
    }
}));
jest.mock("utilities", () => ({CatalogApiProcessing: {}}));
jest.mock("./TelemetryService", () => ({TelemetryService: {Instance: {addTelemetryEntry: jest.fn()}}}));

interface TestableCatalogApiService {
    axiosInstanceSimbad: AxiosInstance;
    getSimbadCatalog: (query: string) => Promise<unknown>;
    normalizeMirrorUrl: (database: CatalogDatabase, url?: string) => string | null;
    joinUrl: (baseUrl: string, path: string) => string;
}

describe("CatalogApiService active mirror", () => {
    test("identifies the active mirror and does not try another mirror when the request fails", async () => {
        const service = new CatalogApiService() as unknown as TestableCatalogApiService;
        const get = jest.fn().mockRejectedValue(new Error("Network Error"));
        service.axiosInstanceSimbad = {get} as unknown as AxiosInstance;

        await expect(service.getSimbadCatalog("test")).rejects.toThrow("Request to mirror active.example failed. The mirror may be unavailable. Select another mirror site and retry. Details: Network Error");

        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith("https://active.example/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=test");
    });

    test("preserves user cancellation without reporting a mirror failure", async () => {
        const service = new CatalogApiService() as unknown as TestableCatalogApiService;
        const cancellation = {__CANCEL__: true, message: "Simbad query canceled by the user."};
        const get = jest.fn().mockRejectedValue(cancellation);
        service.axiosInstanceSimbad = {get} as unknown as AxiosInstance;

        await expect(service.getSimbadCatalog("test")).rejects.toBe(cancellation);
    });

    test("reports an actionable error when all mirrors are unavailable", async () => {
        const service = new CatalogApiService() as unknown as TestableCatalogApiService;
        const get = jest.fn();
        service.axiosInstanceSimbad = {get} as unknown as AxiosInstance;
        const unavailable = jest.mocked(MirrorSiteStore.Instance.isMirrorUnavailable);
        const activeMirror = jest.mocked(MirrorSiteStore.Instance.getActiveMirror);
        unavailable.mockImplementation(() => true);
        activeMirror.mockImplementation(() => undefined);

        await expect(service.getSimbadCatalog("test")).rejects.toThrow("All mirror sites are unavailable. Enable at least one mirror site and retry.");
        expect(get).not.toHaveBeenCalled();

        unavailable.mockImplementation(() => false);
        activeMirror.mockImplementation(() => "https://active.example/");
    });

    test("normalizes mirror paths before query strings and preserves base query parameters", () => {
        const service = new CatalogApiService() as unknown as TestableCatalogApiService;
        const normalized = service.normalizeMirrorUrl(CatalogDatabase.VIZIER, "https://active.example/vizier/?tenant=one#section");

        expect(normalized).toBe("https://active.example/viz-bin/?tenant=one#section");
        expect(service.joinUrl(normalized as string, "votable?-out.max=1")).toBe("https://active.example/viz-bin/votable?-out.max=1&tenant=one");
    });
});

describe("CatalogApiService.captureQuery", () => {
    function configureDialog(center: {x: string | undefined; y: string | undefined}) {
        const configStore = CatalogOnlineQueryConfigStore.Instance as any;
        configStore.centerPixelCoordAsPoint2D = {x: 100, y: 200};
        configStore.convertToDeg = jest.fn(() => center);
        configStore.coordsType = CatalogSystemType.ICRS;
        configStore.searchRadius = 2;
        configStore.radiusUnits = RadiusUnits.ARCMINUTES;
        configStore.maxObject = 500;
        configStore.vizierKeyWords = "gaia";
        return configStore;
    }

    test("takes a snapshot that later dialog changes cannot alter", () => {
        const configStore = configureDialog({x: "12.5", y: "-30.25"});

        const captured = CatalogApiService.captureQuery("simbad");

        expect(captured).toEqual({
            type: "simbad",
            center: {x: 12.5, y: -30.25},
            system: CatalogSystemType.ICRS,
            radius: 2,
            radiusUnits: RadiusUnits.ARCMINUTES,
            maxObjects: 500,
            keywords: undefined
        });

        // What the dialog says next belongs to the next query, not to this one.
        configStore.searchRadius = 99;
        configStore.convertToDeg = jest.fn(() => ({x: "0", y: "0"}));

        expect(captured?.radius).toBe(2);
        expect(captured?.center).toEqual({x: 12.5, y: -30.25});
    });

    test("describes nothing when the centre cannot be worked out", () => {
        configureDialog({x: undefined, y: undefined});

        expect(CatalogApiService.captureQuery("simbad")).toBeUndefined();
    });

    test("keeps the keywords a VizieR search was narrowed by", () => {
        configureDialog({x: "12.5", y: "-30.25"});

        expect(CatalogApiService.captureQuery("vizier")?.keywords).toBe("gaia");
    });
});
