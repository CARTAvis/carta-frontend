import {rs} from "@rstest/core";
import type {AxiosInstance} from "axios";

import {CatalogDatabase} from "enums";
import {MirrorSiteStore} from "stores";

import {CatalogApiService} from "./CatalogApiService";

rs.mock("components/Shared", () => ({
    AppToaster: {show: rs.fn()},
    ErrorToast: rs.fn(),
    WarningToast: rs.fn()
}));
rs.mock("stores", () => ({
    AppStore: {Instance: {}},
    CatalogOnlineQueryConfigStore: {Instance: {}},
    CatalogOnlineQueryProfileStore: rs.fn(),
    MirrorSiteStore: {
        Instance: {
            getMirrorSites: rs.fn(() => ["https://active.example/", "https://unused.example/"]),
            getActiveMirror: rs.fn(() => "https://active.example/"),
            isMirrorUnavailable: rs.fn(() => false)
        }
    }
}));
rs.mock("utilities", () => ({CatalogApiProcessing: {}}));
rs.mock("./TelemetryService", () => ({TelemetryService: {Instance: {addTelemetryEntry: rs.fn()}}}));

interface TestableCatalogApiService {
    axiosInstanceSimbad: AxiosInstance;
    getSimbadCatalog: (query: string) => Promise<unknown>;
    getSimbadObjectBaseUrl: () => string;
    normalizeMirrorUrl: (database: CatalogDatabase, url?: string) => string | null;
    joinUrl: (baseUrl: string, path: string) => string;
}

describe("CatalogApiService active mirror", () => {
    test("identifies the active mirror and does not try another mirror when the request fails", async () => {
        const service = new CatalogApiService() as unknown as TestableCatalogApiService;
        const get = rs.fn().mockRejectedValue(new Error("Network Error"));
        service.axiosInstanceSimbad = {get} as unknown as AxiosInstance;

        await expect(service.getSimbadCatalog("test")).rejects.toThrow("Request to mirror active.example failed. The mirror may be unavailable. Select another mirror site and retry. Details: Network Error");

        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith("https://active.example/simbad/sim-tap/sync?request=doQuery&lang=adql&format=json&query=test");
    });

    test("preserves user cancellation without reporting a mirror failure", async () => {
        const service = new CatalogApiService() as unknown as TestableCatalogApiService;
        const cancellation = {__CANCEL__: true, message: "Simbad query canceled by the user."};
        const get = rs.fn().mockRejectedValue(cancellation);
        service.axiosInstanceSimbad = {get} as unknown as AxiosInstance;

        await expect(service.getSimbadCatalog("test")).rejects.toBe(cancellation);
    });

    test("reports an actionable error when all mirrors are unavailable", async () => {
        const service = new CatalogApiService() as unknown as TestableCatalogApiService;
        const get = rs.fn();
        service.axiosInstanceSimbad = {get} as unknown as AxiosInstance;
        const unavailable = rs.mocked(MirrorSiteStore.Instance.isMirrorUnavailable);
        const activeMirror = rs.mocked(MirrorSiteStore.Instance.getActiveMirror);
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

    test("links SIMBAD objects to the active mirror", () => {
        const service = new CatalogApiService() as unknown as TestableCatalogApiService;
        rs.mocked(MirrorSiteStore.Instance.getActiveMirror).mockReturnValueOnce("https://simbad.idia.ac.za/simbad/sim-tap/");

        expect(service.getSimbadObjectBaseUrl()).toBe("https://simbad.idia.ac.za/simbad/sim-id?Ident=");
    });

    test("links SIMBAD objects to the first SIMBAD mirror when no mirror is available", () => {
        const service = new CatalogApiService() as unknown as TestableCatalogApiService;
        rs.mocked(MirrorSiteStore.Instance.getActiveMirror).mockReturnValueOnce(undefined);

        expect(service.getSimbadObjectBaseUrl()).toBe("https://simbad.u-strasbg.fr/simbad/sim-id?Ident=");
    });

    test.each([
        ["BD+40 4124", "BD%2B40%204124"],
        ["* alf Cen", "*%20alf%20Cen"],
        ["NAME A&B #1", "NAME%20A%26B%20%231"],
        ["NAME Mönch", "NAME%20M%C3%B6nch"]
    ])("encodes the SIMBAD identifier %s in the object link", (mainId, encoded) => {
        expect(CatalogApiService.getSimbadObjectUrl("https://simbad.idia.ac.za/simbad/sim-id?Ident=", mainId)).toBe(`https://simbad.idia.ac.za/simbad/sim-id?Ident=${encoded}`);
    });
});
