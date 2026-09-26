import axios, {type AxiosInstance, type AxiosResponse, type CancelTokenSource} from "axios";
import {CARTA} from "carta-protobuf";

import {AppToaster, ErrorToast, WarningToast} from "components/Shared";
import {CatalogDatabase, type CatalogSystemType, CatalogType, DialogId, RadiusUnits, SystemType, TelemetryAction} from "enums";
import {type CatalogInfo, type WCSPoint2D, type WorkspaceCatalogQuerySource} from "models";
import {AppStore, CatalogOnlineQueryConfigStore, CatalogOnlineQueryProfileStore, CatalogStore, MirrorSiteStore} from "stores";
import {CatalogApiProcessing, type VizierResource} from "utilities";

import {TelemetryService} from "./TelemetryService";

export class CatalogApiService {
    public static readonly SIMBAD_HYPER_LINK: {bibcode: string; mainId: string} = {bibcode: "https://ui.adsabs.harvard.edu/abs/", mainId: "https://simbad.u-strasbg.fr/simbad/sim-id?Ident="};

    private static staticInstance: CatalogApiService;
    private axiosInstanceSimbad: AxiosInstance;
    private axiosInstanceVizier: AxiosInstance;
    private cancelTokenSourceSimbad: CancelTokenSource;
    private cancelTokenSourceVizier: CancelTokenSource;

    public static get Instance() {
        if (!CatalogApiService.staticInstance) {
            CatalogApiService.staticInstance = new CatalogApiService();
        }
        return CatalogApiService.staticInstance;
    }

    constructor() {
        this.cancelTokenSourceSimbad = axios.CancelToken.source();
        this.cancelTokenSourceVizier = axios.CancelToken.source();
        this.axiosInstanceSimbad = axios.create({
            cancelToken: this.cancelTokenSourceSimbad.token
        });
        this.axiosInstanceVizier = axios.create({
            cancelToken: this.cancelTokenSourceVizier.token
        });
    }

    /**
     * The query the dialog currently describes. Capture this before sending a request: the dialog
     * can be closed and the image changed while one is in flight, and the parameters read afterwards
     * would then describe a different query than the one that returned the data.
     *
     * @returns undefined when the centre cannot be worked out, so that a query is left undescribed
     * rather than described with a number that is not one.
     */
    public static captureQuery(type: "simbad" | "vizier"): WorkspaceCatalogQuerySource | undefined {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, type === "simbad" ? SystemType.ICRS : SystemType.FK5, CatalogOnlineQueryConfigStore.QUERY_DEG_PRECISION);
        const center = {x: Number(centerCoord.x), y: Number(centerCoord.y)};
        if (!Number.isFinite(center.x) || !Number.isFinite(center.y)) {
            return undefined;
        }

        return {
            type,
            center,
            system: configStore.coordsType,
            radius: configStore.searchRadius,
            radiusUnits: configStore.radiusUnits,
            maxObjects: configStore.maxObject,
            keywords: type === "vizier" ? configStore.vizierKeyWords : undefined
        };
    }

    /** A saved source contains degree coordinates; no dialog or current image is needed to build the query. */
    private static hasValidSource(source: WorkspaceCatalogQuerySource, type: WorkspaceCatalogQuerySource["type"]): boolean {
        return (
            source?.type === type &&
            Number.isFinite(source.center?.x) &&
            Number.isFinite(source.center?.y) &&
            Number.isFinite(source.radius) &&
            source.radius >= 0 &&
            Object.values(RadiusUnits).includes(source.radiusUnits) &&
            Number.isInteger(source.maxObjects) &&
            source.maxObjects > 0
        );
    }

    private static simbadRadiusInDegrees(radius: number, units: RadiusUnits): number {
        const degrees = units === RadiusUnits.ARCMINUTES ? radius / 60 : units === RadiusUnits.ARCSECONDS ? radius / 3600 : radius;
        return Number(degrees.toPrecision(6));
    }

    private static simbadQuery(source: WorkspaceCatalogQuerySource): string {
        const {center, maxObjects} = source;
        const radius = CatalogApiService.simbadRadiusInDegrees(source.radius, source.radiusUnits);
        return `SELECT Top ${maxObjects} *, DISTANCE(POINT('ICRS', ${center.x},${center.y}), POINT('ICRS', ra, dec)) as dist FROM basic WHERE CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${center.x},${center.y},${radius}))=1 AND ra IS NOT NULL AND dec IS NOT NULL order by dist`;
    }

    /** Load a SIMBAD catalog from the parameters captured when the request was made. */
    public loadSimbadCatalog = async (source: WorkspaceCatalogQuerySource, targetFrameId?: number): Promise<{dataSize: number; fileId?: number}> => {
        if (!CatalogApiService.hasValidSource(source, "simbad")) {
            return {dataSize: 0};
        }
        const frameId = targetFrameId ?? AppStore.Instance.activeFrame?.frameInfo.fileId;
        if (frameId === undefined) {
            AppToaster.show(ErrorToast("Please load an image file"));
            throw new Error("No image file");
        }
        return this.appendSimbadCatalog(CatalogApiService.simbadQuery(source), source, frameId);
    };

    /** Load selected VizieR tables without reading mutable query-dialog state after dispatch. */
    public loadVizierCatalogs = async (source: WorkspaceCatalogQuerySource, tableNames: string[], targetFrameId?: number): Promise<number[]> => {
        if (!CatalogApiService.hasValidSource(source, "vizier") || !tableNames?.length || tableNames.some(name => !name?.trim())) {
            return [];
        }
        const frameId = targetFrameId ?? AppStore.Instance.activeFrame?.frameInfo.fileId;
        if (frameId === undefined) {
            AppToaster.show(ErrorToast("Please load an image file"));
            throw new Error("No image file");
        }
        const point: WCSPoint2D = {x: String(source.center.x), y: String(source.center.y)};
        const resources = await this.queryVizierSource(point, source.radius, source.radiusUnits, source.maxObjects, tableNames);
        return this.appendVizierCatalog(resources, source, frameId);
    };

    public getSimbadCatalog = (query: string): Promise<AxiosResponse<any>> => {
        const encoded = encodeURIComponent(query);
        return this.getFromActiveMirror(this.axiosInstanceSimbad, CatalogDatabase.SIMBAD, `sync?request=doQuery&lang=adql&format=json&query=${encoded}`);
    };

    public cancelQuery(type: CatalogDatabase, reason?: string) {
        if (type === CatalogDatabase.SIMBAD) {
            this.cancelTokenSourceSimbad.cancel(reason ?? "Simbad query canceled by the user.");
        } else if (type === CatalogDatabase.VIZIER) {
            this.cancelTokenSourceVizier.cancel(reason ?? "VizieR query canceled by the user.");
        }
    }

    /**
     * Give up on every online query in flight, for a session that is not the one that asked.
     *
     * An online catalog arrives over HTTP rather than from the backend, so nothing about opening a
     * workspace stops one that is already on its way: it would be loaded onto whichever image is
     * active by the time it lands, which by then belongs to the workspace being restored.
     *
     * Each database is given a fresh token as it is cancelled, so that the queries the restore runs
     * for its own catalogs are not issued against a token that has already been cancelled.
     */
    public cancelPendingQueries(reason: string) {
        for (const database of [CatalogDatabase.SIMBAD, CatalogDatabase.VIZIER]) {
            this.cancelQuery(database, reason);
            this.resetCancelTokenSource(database);
        }
    }

    public benchmarkMirror = async (database: CatalogDatabase, mirrorUrl: string, timeoutMs: number = 10000, signal?: AbortSignal): Promise<number | null> => {
        if (MirrorSiteStore.Instance.isMirrorUnavailable(database, mirrorUrl)) {
            return null;
        }
        const normalized = this.normalizeMirrorUrl(database, mirrorUrl);
        if (!normalized) {
            return null;
        }
        const path = this.getBenchmarkPath(database);
        const requestUrl = this.joinUrl(normalized, this.appendCacheBuster(path));
        const startTime = performance.now();
        try {
            await axios.get(requestUrl, {timeout: timeoutMs, signal});
            return performance.now() - startTime;
        } catch {
            return null;
        }
    };

    private getFromActiveMirror = (instance: AxiosInstance, database: CatalogDatabase, path: string): Promise<AxiosResponse<any>> => {
        try {
            const activeMirrorUrl = this.getActiveMirrorUrl(database);
            return instance.get(this.joinUrl(activeMirrorUrl, path)).catch(error => {
                if (axios.isCancel(error)) {
                    throw error;
                }
                throw this.createMirrorRequestError(activeMirrorUrl, error);
            });
        } catch (error) {
            return Promise.reject(error);
        }
    };

    private createMirrorRequestError = (mirrorUrl: string, error: any): Error => {
        let mirrorLabel = mirrorUrl;
        try {
            mirrorLabel = new URL(mirrorUrl).host;
        } catch {
            // Use the full URL when it cannot be parsed.
        }
        const details = error?.message ? ` Details: ${error.message}` : "";
        return new Error(`Request to mirror ${mirrorLabel} failed. The mirror may be unavailable. Select another mirror site and retry.${details}`);
    };

    private getActiveMirrorUrl = (database: CatalogDatabase): string => {
        const activeMirrorUrl = MirrorSiteStore.Instance.getActiveMirror(database);
        const normalizedMirrorUrl = this.normalizeMirrorUrl(database, activeMirrorUrl);
        if (!normalizedMirrorUrl) {
            throw new Error("All mirror sites are unavailable. Enable at least one mirror site and retry.");
        }
        return normalizedMirrorUrl;
    };

    private getBenchmarkPath = (database: CatalogDatabase): string => {
        if (database === CatalogDatabase.SIMBAD) {
            const query = encodeURIComponent("select top 1 * from basic");
            return `sync?request=doQuery&lang=adql&format=json&maxrec=1&query=${query}`;
        }
        return "votable?-source=I/239/hip_main&-out.max=1";
    };

    private appendCacheBuster = (path: string): string => {
        const cacheBuster = `_=${Date.now()}`;
        return path.includes("?") ? `${path}&${cacheBuster}` : `${path}?${cacheBuster}`;
    };

    private normalizeMirrorUrl = (database: CatalogDatabase, url?: string): string | null => {
        if (!url || typeof url !== "string") {
            return null;
        }
        try {
            const parsed = new URL(url.trim());
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                return null;
            }

            const path = parsed.pathname.replace(/\/+$/, "");
            if (database === CatalogDatabase.VIZIER) {
                const vizierBase = path.replace(/\/(?:vizier|viz-bin)$/i, "");
                parsed.pathname = `${vizierBase}/viz-bin/`;
            } else if (/sim-tap$/i.test(path)) {
                parsed.pathname = `${path}/`;
            } else {
                const simbadBase = /\/simbad(\/|$)/i.test(path) ? path : `${path}/simbad`;
                parsed.pathname = `${simbadBase}/sim-tap/`;
            }
            return parsed.toString();
        } catch {
            return null;
        }
    };

    private joinUrl = (baseUrl: string, path: string): string => {
        if (!baseUrl) {
            return path;
        }
        const base = new URL(baseUrl);
        const request = new URL(path, base);
        const baseQuery = new URLSearchParams(base.search);
        const requestQuery = new URLSearchParams(request.search);
        baseQuery.forEach((value, key) => {
            if (!requestQuery.has(key)) {
                requestQuery.append(key, value);
            }
        });
        request.search = requestQuery.toString();
        request.hash = "";
        return request.toString();
    };

    public queryVizierTableName = async (point: WCSPoint2D, radius: number, unit: RadiusUnits, keyWords: string): Promise<Map<string, VizierResource>> => {
        let resources: Map<string, VizierResource> = new Map();
        const radiusUnits = this.getRadiusUnits(unit);
        // http://cdsarc.u-strasbg.fr/doc/asu-summary.htx
        // _RA, _DE are a shorthand for _RA(J2000,J2000), _DE(J2000,J2000)
        // -meta.max = 100000, use a large number to get all tables(same number as vizier use for their websit). default is 500.
        // when use -meta.max to limit the return data size, the API will not return the correct result.
        let query = `votable?-c=${point.x} ${point.y}&-c.eq=J2000&-c.${radiusUnits}=${radius}&-corr=pos&-out.meta=hud&-meta.all=1&-meta.max=100000`;
        if (keyWords) {
            query = `${query}&-words=${keyWords}`;
        }

        try {
            const response = await this.getFromActiveMirror(this.axiosInstanceVizier, CatalogDatabase.VIZIER, query);
            if (response?.status === 200 && response?.data) {
                resources = CatalogApiProcessing.processVizierData(response.data);
            }
        } catch (error) {
            if (axios.isCancel(error)) {
                if (error?.message) {
                    AppToaster.show(WarningToast(error?.message));
                }
                CatalogApiService.Instance.resetCancelTokenSource(CatalogDatabase.VIZIER);
            } else if (error?.message) {
                AppToaster.show(ErrorToast(error.message));
            } else {
                console.log("Vizier Resource Error: " + error);
            }
        }
        return resources;
    };

    public queryVizierSource = async (point: WCSPoint2D, radius: number, unit: RadiusUnits, max: number, tableNames: string[]): Promise<Map<string, VizierResource>> => {
        let resources: Map<string, VizierResource> = new Map();
        const radiusUnits = this.getRadiusUnits(unit);
        let sourceString = "-source=";
        tableNames.forEach(name => {
            sourceString += `${name},`;
        });

        // _RA, _DE are a shorthand for _RA(J2000,J2000), _DE(J2000,J2000)
        const query = `votable?${sourceString}&-c=${point.x} ${point.y}&-c.eq=J2000&-c.${radiusUnits}=${radius}&-out.max=${max}&-sort=_r&-corr=pos&-out.all&-out.add=_r,_RA,_DE&-oc.form=d&-out.meta=hud`;

        try {
            const response = await this.getFromActiveMirror(this.axiosInstanceVizier, CatalogDatabase.VIZIER, query);
            if (response?.status === 200 && response?.data) {
                resources = CatalogApiProcessing.processVizierData(response.data);
            }
        } catch (error) {
            if (axios.isCancel(error)) {
                if (error?.message) {
                    AppToaster.show(WarningToast(error?.message));
                }
                CatalogApiService.Instance.resetCancelTokenSource(CatalogDatabase.VIZIER);
            } else if (error?.message) {
                AppToaster.show(ErrorToast(error.message));
            } else {
                console.log("VizieR Table Error: " + error);
            }
        }
        return resources;
    };

    /** @returns the file id of every catalog that was loaded. */
    private appendVizierCatalog = async (resources: Map<string, VizierResource>, source: WorkspaceCatalogQuerySource, targetFrameId: number): Promise<number[]> => {
        const frame = AppStore.Instance.getFrame(targetFrameId);
        if (!frame) {
            AppToaster.show(ErrorToast("Please load an image file"));
            return [];
        }
        const fileIds: number[] = [];
        for (const element of resources.values()) {
            const fileId = await CatalogStore.Instance.open(frame, async catalogFileId => {
                const {headers, dataMap, size} = CatalogApiProcessing.processVizierTableData(element.table.tableElement);
                const coosy: CARTA.Coosys.$Properties = {system: element.coosys.system};
                const fileName = `${CatalogDatabase.VIZIER}_${element.coosys.system}_${element.table.name}_${source.radius}${source.radiusUnits}`;
                const catalogFileInfo: CARTA.CatalogFileInfo.$Properties = {
                    name: fileName,
                    type: CARTA.CatalogFileType.VOTable,
                    description: "Online VizieR Catalog",
                    coosys: [coosy]
                };
                const catalogInfo: CatalogInfo = {
                    fileId: catalogFileId,
                    fileInfo: catalogFileInfo,
                    dataSize: size,
                    directory: "",
                    query: {...source, system: element.coosys.system as CatalogSystemType, table: element.table.name ?? undefined}
                };
                return new CatalogOnlineQueryProfileStore(catalogInfo, headers, dataMap, CatalogType.VIZIER);
            });
            if (fileId !== undefined) {
                this.onCatalogLoaded(fileId);
                fileIds.push(fileId);
            }
        }
        return fileIds;
    };

    /** What the online query dialog does once one of its catalogs has been opened. */
    private onCatalogLoaded(fileId: number): void {
        const profileStore = CatalogStore.Instance.catalogProfileStores.get(fileId);
        TelemetryService.Instance.addTelemetryEntry(TelemetryAction.CatalogLoading, {column: profileStore?.catalogHeader.length, row: profileStore?.catalogInfo.dataSize, remote: true});
        AppStore.Instance.dialogStore.hideDialog(DialogId.OnlineDataQuery);
    }

    public resetCancelTokenSource(type: CatalogDatabase) {
        if (type === CatalogDatabase.SIMBAD) {
            this.cancelTokenSourceSimbad = axios.CancelToken.source();
            this.axiosInstanceSimbad.defaults.cancelToken = this.cancelTokenSourceSimbad.token;
        } else if (type === CatalogDatabase.VIZIER) {
            this.cancelTokenSourceVizier = axios.CancelToken.source();
            this.axiosInstanceVizier.defaults.cancelToken = this.cancelTokenSourceVizier.token;
        }
    }

    /** @returns how many rows the query returned, and the file id of the catalog it was loaded as. */
    private appendSimbadCatalog = async (query: string, source: WorkspaceCatalogQuerySource, targetFrameId: number): Promise<{dataSize: number; fileId?: number}> => {
        const frame = AppStore.Instance.getFrame(targetFrameId);
        if (!frame) {
            AppToaster.show(ErrorToast("Please load an image file"));
            throw new Error("No image file");
        }

        let loadedFileId: number | undefined;
        let dataSize = 0;
        try {
            loadedFileId = await CatalogStore.Instance.open(frame, async catalogFileId => {
                const response = await this.getSimbadCatalog(query);
                dataSize = response?.data?.data?.length;
                if (response?.status !== 200 || !response?.data?.data?.length) {
                    return undefined;
                }
                const headers = CatalogApiProcessing.processSimbadMetaData(response.data?.metadata);
                const columnData = CatalogApiProcessing.processSimbadData(response.data?.data, headers);
                const coosys: CARTA.Coosys.$Properties = {system: source.system};
                const fileName = `${CatalogDatabase.SIMBAD}_${source.system}_${source.center.x}_${source.center.y}_${source.radius}${source.radiusUnits}`;
                const catalogFileInfo: CARTA.CatalogFileInfo.$Properties = {
                    name: fileName,
                    type: CARTA.CatalogFileType.VOTable,
                    description: "Online Simbad Catalog",
                    coosys: [coosys]
                };
                const catalogInfo: CatalogInfo = {
                    fileId: catalogFileId,
                    fileInfo: catalogFileInfo,
                    dataSize: response.data?.data?.length ?? 0,
                    directory: "",
                    query: source
                };
                return new CatalogOnlineQueryProfileStore(catalogInfo, headers, columnData, CatalogType.SIMBAD);
            });
            if (loadedFileId !== undefined) {
                this.onCatalogLoaded(loadedFileId);
            }
        } catch (error) {
            if (axios.isCancel(error)) {
                if (error?.message) {
                    AppToaster.show(WarningToast(error?.message));
                }
                CatalogApiService.Instance.resetCancelTokenSource(CatalogDatabase.SIMBAD);
            } else if (error?.message) {
                AppToaster.show(ErrorToast(error.message));
            } else {
                console.log("Append Simbad Error: " + error);
            }
        }
        return {dataSize, fileId: loadedFileId};
    };

    private getRadiusUnits(unit: RadiusUnits): string {
        let radiusUnits: string;
        switch (unit) {
            case RadiusUnits.ARCMINUTES:
                radiusUnits = "rm";
                break;
            case RadiusUnits.ARCSECONDS:
                radiusUnits = "rs";
                break;
            default:
                radiusUnits = "rd";
                break;
        }
        return radiusUnits;
    }
}
