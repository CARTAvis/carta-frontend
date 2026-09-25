import axios, {type AxiosInstance} from "axios";

import {CatalogDatabase, CatalogSystemType, CatalogType, RadiusUnits} from "enums";
import {type WorkspaceCatalogQuerySource} from "models";
import {AppStore, CatalogOnlineQueryConfigStore, CatalogOnlineQueryProfileStore, MirrorSiteStore} from "stores";
import {CatalogApiProcessing} from "utilities";

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

describe("CatalogApiService VizieR loading", () => {
    test("gives a catalog's ID back when its table cannot be read", async () => {
        const service = new CatalogApiService();
        const releaseCatalogFileId = jest.fn();
        Object.assign(AppStore.Instance, {activeFrame: {frameInfo: {fileId: 4}}, reserveCatalogFileId: jest.fn(() => 7), releaseCatalogFileId});
        (CatalogApiProcessing as any).processVizierTableData = jest.fn(() => {
            throw new Error("malformed VOTable");
        });
        const resources = new Map([["a", {table: {tableElement: {}, name: "t"}, coosys: {system: "ICRS"}} as any]]);
        jest.spyOn(service, "queryVizierSource").mockResolvedValue(resources);
        const source: WorkspaceCatalogQuerySource = {type: "vizier", center: {x: 1, y: 2}, system: CatalogSystemType.ICRS, radius: 1, radiusUnits: RadiusUnits.DEGREES, maxObjects: 100, table: "t"};

        await expect(service.loadVizierCatalogs(source, ["t"])).rejects.toThrow("malformed VOTable");

        // Held only while the catalog is on its way: a table that could not be read never was.
        expect(releaseCatalogFileId).toHaveBeenCalledWith(7);
    });
});

describe("CatalogApiService source-driven loading", () => {
    const simbadSource: WorkspaceCatalogQuerySource = {type: "simbad", center: {x: 12.5, y: -30.25}, system: CatalogSystemType.ICRS, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 500};
    const vizierSource: WorkspaceCatalogQuerySource = {type: "vizier", center: {x: 12.5, y: -30.25}, system: CatalogSystemType.FK5, radius: 2, radiusUnits: RadiusUnits.ARCMINUTES, maxObjects: 500, keywords: "gaia"};

    function configureSession() {
        const frame = {frameInfo: {fileId: 4}};
        const appStore = AppStore.Instance as any;
        Object.assign(appStore, {
            activeFrame: frame,
            getFrame: jest.fn((fileId: number) => (fileId === 4 ? frame : undefined)),
            reserveCatalogFileId: jest.fn(() => 7),
            releaseCatalogFileId: jest.fn(),
            updateCatalogProfile: jest.fn(() => "catalog-overlay-0"),
            catalogStore: {addCatalog: jest.fn(), catalogProfileStores: new Map(), plotBindings: {validateColumns: jest.fn()}},
            fileBrowserStore: {hideFileBrowser: jest.fn()},
            dialogStore: {hideDialog: jest.fn()}
        });
        jest.mocked(CatalogOnlineQueryProfileStore).mockClear();
        return {appStore, frame};
    }

    test("queries SIMBAD in ICRS degrees and pins the image selected at dispatch", async () => {
        const service = new CatalogApiService();
        const {appStore, frame} = configureSession();
        const getSimbadCatalog = jest.spyOn(service, "getSimbadCatalog").mockResolvedValue({status: 200, data: {metadata: [], data: [["source"]]}} as any);
        (CatalogApiProcessing as any).processSimbadMetaData = jest.fn(() => []);
        (CatalogApiProcessing as any).processSimbadData = jest.fn(() => new Map());

        const loading = service.loadSimbadCatalog(simbadSource);
        appStore.activeFrame = {frameInfo: {fileId: 8}};
        const result = await loading;

        expect(result).toEqual({dataSize: 1, fileId: 7});
        expect(getSimbadCatalog).toHaveBeenCalledWith(expect.stringContaining("CIRCLE('ICRS',12.5,-30.25,0.0333333)"));
        expect(appStore.updateCatalogProfile).toHaveBeenCalledWith(7, frame);
        expect(jest.mocked(CatalogOnlineQueryProfileStore)).toHaveBeenCalledWith(
            expect.objectContaining({fileInfo: expect.objectContaining({name: "SIMBAD_ICRS_12.5_-30.25_2arcmin"}), query: simbadSource}),
            [],
            expect.any(Map),
            CatalogType.SIMBAD
        );
        expect(appStore.releaseCatalogFileId).toHaveBeenCalledWith(7);
    });

    test("keeps VizieR query, name and target image fixed while the dialog changes", async () => {
        const service = new CatalogApiService();
        const {appStore, frame} = configureSession();
        appStore.reserveCatalogFileId = jest.fn(() => 9);
        const resource = {table: {name: "I/355/gaiadr3", tableElement: {}}, coosys: {system: CatalogSystemType.ICRS}} as any;
        let finishQuery!: (resources: Map<string, any>) => void;
        const query = jest.spyOn(service, "queryVizierSource").mockReturnValue(new Promise(resolve => (finishQuery = resolve)));
        (CatalogApiProcessing as any).processVizierTableData = jest.fn(() => ({headers: [], dataMap: new Map(), size: 1}));

        const loading = service.loadVizierCatalogs(vizierSource, ["I/355/gaiadr3"]);
        appStore.activeFrame = {frameInfo: {fileId: 8}};
        Object.assign(CatalogOnlineQueryConfigStore.Instance, {catalogDB: CatalogDatabase.SIMBAD, searchRadius: 99, radiusUnits: RadiusUnits.DEGREES});
        finishQuery(new Map([["I/355/gaiadr3", resource]]));
        const fileIds = await loading;

        expect(fileIds).toEqual([9]);
        expect(query).toHaveBeenCalledWith({x: "12.5", y: "-30.25"}, 2, RadiusUnits.ARCMINUTES, 500, ["I/355/gaiadr3"]);
        expect(appStore.updateCatalogProfile).toHaveBeenCalledWith(9, frame);
        expect(jest.mocked(CatalogOnlineQueryProfileStore)).toHaveBeenCalledWith(
            expect.objectContaining({fileInfo: expect.objectContaining({name: "VizieR_ICRS_I/355/gaiadr3_2arcmin"}), query: expect.objectContaining({center: vizierSource.center, radius: 2, table: "I/355/gaiadr3"})}),
            [],
            expect.any(Map),
            CatalogType.VIZIER
        );
        expect(appStore.releaseCatalogFileId).toHaveBeenCalledWith(9);
    });

    test("does not query from an invalid saved source", async () => {
        const service = new CatalogApiService();
        const query = jest.spyOn(service, "queryVizierSource");

        await expect(service.loadVizierCatalogs({...vizierSource, center: {x: NaN, y: 1}}, ["I/355/gaiadr3"], 4)).resolves.toEqual([]);
        await expect(service.loadVizierCatalogs(vizierSource, [""], 4)).resolves.toEqual([]);
        await expect(service.loadSimbadCatalog({...simbadSource, center: {x: NaN, y: 1}}, 4)).resolves.toEqual({dataSize: 0});
        expect(query).not.toHaveBeenCalled();
    });

    test("releases a SIMBAD catalog ID when its source query is cancelled", async () => {
        const service = new CatalogApiService();
        const {appStore} = configureSession();
        jest.spyOn(service, "getSimbadCatalog").mockRejectedValue(new axios.CanceledError("query cancelled"));

        await expect(service.loadSimbadCatalog(simbadSource)).resolves.toEqual({dataSize: 0, fileId: undefined});
        expect(appStore.releaseCatalogFileId).toHaveBeenCalledWith(7);
        expect(appStore.updateCatalogProfile).not.toHaveBeenCalled();
    });
});
