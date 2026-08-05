import axios, {type AxiosInstance, type AxiosResponse, type CancelTokenSource} from "axios";
import {CARTA} from "carta-protobuf";
import {action, makeObservable} from "mobx";

import {AppToaster, ErrorToast, WarningToast} from "components/Shared";
import {CatalogDatabase, CatalogType, DialogId, PreferenceKeys, RadiusUnits, SystemType, TelemetryAction} from "enums";
import {type CatalogInfo, type WCSPoint2D} from "models";
import {AppStore, CatalogOnlineQueryConfigStore, CatalogOnlineQueryProfileStore, PreferenceStore} from "stores";
import {CatalogApiProcessing, type ProcessedColumnData, type VizierResource} from "utilities";

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
        makeObservable(this);
        this.cancelTokenSourceSimbad = axios.CancelToken.source();
        this.cancelTokenSourceVizier = axios.CancelToken.source();
        this.axiosInstanceSimbad = axios.create({
            cancelToken: this.cancelTokenSourceSimbad.token
        });
        this.axiosInstanceVizier = axios.create({
            cancelToken: this.cancelTokenSourceVizier.token
        });
    }

    public getSimbadCatalog = (query: string): Promise<AxiosResponse<any>> => {
        return this.getWithFallback(this.axiosInstanceSimbad, CatalogDatabase.SIMBAD, `sync?request=doQuery&lang=adql&format=json&query=${query}`);
    };

    public cancelQuery(type: CatalogDatabase) {
        if (type === CatalogDatabase.SIMBAD) {
            this.cancelTokenSourceSimbad.cancel("Simbad query canceled by the user.");
        } else if (type === CatalogDatabase.VIZIER) {
            this.cancelTokenSourceVizier.cancel("VizieR query canceled by the user.");
        }
    }

    public benchmarkMirror = async (database: CatalogDatabase, mirrorUrl: string, timeoutMs: number = 10000, signal?: AbortSignal): Promise<number | null> => {
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

    private getWithFallback = async (instance: AxiosInstance, database: CatalogDatabase, path: string): Promise<AxiosResponse<any>> => {
        const mirrorUrls = this.getMirrorUrls(database);
        const fallbackTimeoutMs = 5000;
        let lastError: any;
        for (let index = 0; index < mirrorUrls.length; index++) {
            const baseUrl = mirrorUrls[index];
            const requestUrl = this.joinUrl(baseUrl, path);
            try {
                const response = await instance.get(requestUrl, index === 0 ? undefined : {timeout: fallbackTimeoutMs});
                if (index > 0) {
                    this.promoteMirror(database, baseUrl);
                }
                return response;
            } catch (error) {
                if (axios.isCancel(error)) {
                    throw error;
                }
                lastError = error;
                if (!this.shouldTryNextMirror(error)) {
                    throw error;
                }
            }
        }
        throw lastError;
    };

    private shouldTryNextMirror = (error: any): boolean => {
        const status = error?.response?.status;
        if (!status) {
            return true;
        }
        return status >= 500 || status === 429 || status === 408;
    };

    private getMirrorUrls = (database: CatalogDatabase): string[] => {
        const preferences = PreferenceStore.Instance;
        const rawUrls = database === CatalogDatabase.SIMBAD ? preferences.catalogQuerySimbadMirrors : preferences.catalogQueryVizierMirrors;
        const normalized = this.normalizeMirrorUrls(database, rawUrls);
        if (normalized.length > 0) {
            return normalized;
        }
        return database === CatalogDatabase.SIMBAD ? ["https://simbad.u-strasbg.fr/simbad/sim-tap/"] : ["https://vizier.cds.unistra.fr/viz-bin/"];
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

    private promoteMirror = (database: CatalogDatabase, normalizedBaseUrl: string) => {
        const preferences = PreferenceStore.Instance;
        const rawList = database === CatalogDatabase.SIMBAD ? preferences.catalogQuerySimbadMirrors : preferences.catalogQueryVizierMirrors;
        if (!Array.isArray(rawList) || rawList.length === 0) {
            return;
        }
        const normalizedList = rawList.map(url => this.normalizeMirrorUrl(database, url));
        const targetIndex = normalizedList.findIndex(url => url === normalizedBaseUrl);
        if (targetIndex <= 0) {
            return;
        }
        const nextList = [...rawList];
        const [moved] = nextList.splice(targetIndex, 1);
        nextList.unshift(moved);
        const key = database === CatalogDatabase.SIMBAD ? PreferenceKeys.CATALOG_QUERY_SIMBAD_MIRRORS : PreferenceKeys.CATALOG_QUERY_VIZIER_MIRRORS;
        preferences.setPreference(key, nextList);
    };

    private normalizeMirrorUrls = (database: CatalogDatabase, urls: string[]): string[] => {
        const normalized: string[] = [];
        if (!Array.isArray(urls)) {
            return normalized;
        }
        urls.forEach(url => {
            const candidate = this.normalizeMirrorUrl(database, url);
            if (candidate && !normalized.includes(candidate)) {
                normalized.push(candidate);
            }
        });
        return normalized;
    };

    private normalizeMirrorUrl = (database: CatalogDatabase, url: string): string | null => {
        if (!url || typeof url !== "string") {
            return null;
        }
        let normalized = url.trim();
        if (!normalized) {
            return null;
        }

        normalized = normalized.replace(/\/+$/, "");

        if (database === CatalogDatabase.VIZIER) {
            normalized = normalized.replace(/\/(VizieR|vizier)$/i, "");
            normalized = normalized.replace(/\/viz-bin$/i, "/viz-bin");
            if (!/\/viz-bin$/i.test(normalized)) {
                normalized = `${normalized}/viz-bin`;
            }
        } else if (!/sim-tap$/i.test(normalized)) {
            const hasSimbadPath = /\/simbad(\/|$)/i.test(normalized);
            normalized = hasSimbadPath ? `${normalized}/sim-tap` : `${normalized}/simbad/sim-tap`;
        }

        return `${normalized}/`;
    };

    private joinUrl = (baseUrl: string, path: string): string => {
        if (!baseUrl) {
            return path;
        }
        const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
        const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
        return `${normalizedBase}${normalizedPath}`;
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
            const response = await this.getWithFallback(this.axiosInstanceVizier, CatalogDatabase.VIZIER, query);
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

    public queryVizierSource = async (point: WCSPoint2D, radius: number, unit: RadiusUnits, max: number, sources: VizierResource[]): Promise<Map<string, VizierResource>> => {
        let resources: Map<string, VizierResource> = new Map();
        const radiusUnits = this.getRadiusUnits(unit);
        let sourceString = "-source=";
        sources.forEach(element => {
            sourceString += `${element.table.name},`;
        });

        // _RA, _DE are a shorthand for _RA(J2000,J2000), _DE(J2000,J2000)
        const query = `votable?${sourceString}&-c=${point.x} ${point.y}&-c.eq=J2000&-c.${radiusUnits}=${radius}&-out.max=${max}&-sort=_r&-corr=pos&-out.all&-out.add=_r,_RA,_DE&-oc.form=d&-out.meta=hud`;

        try {
            const response = await this.getWithFallback(this.axiosInstanceVizier, CatalogDatabase.VIZIER, query);
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

    public appendVizierCatalog = (resources: Map<string, VizierResource>) => {
        const appStore = AppStore.Instance;
        resources.forEach(element => {
            const fileId = appStore.catalogNextFileId;
            const {headers, dataMap, size} = CatalogApiProcessing.processVizierTableData(element.table.tableElement);
            const configStore = CatalogOnlineQueryConfigStore.Instance;
            const coosy: CARTA.Coosys.$Properties = {system: element.coosys.system};
            const fileName = `${configStore.catalogDB}_${element.coosys.system}_${element.table.name}_${configStore.searchRadius}${configStore.radiusUnits}`;
            const catalogFileInfo: CARTA.CatalogFileInfo.$Properties = {
                name: fileName,
                type: CARTA.CatalogFileType.VOTable,
                description: "Online VizieR Catalog",
                coosys: [coosy]
            };
            const catalogInfo: CatalogInfo = {
                fileId,
                fileInfo: catalogFileInfo,
                dataSize: size,
                directory: ""
            };
            this.loadCatalog(fileId, catalogInfo, headers, dataMap, CatalogType.VIZIER);
        });
    };

    @action loadCatalog = (fileId: number, catalogInfo: CatalogInfo, headers: CARTA.CatalogHeader[], columnData: Map<number, ProcessedColumnData>, type: CatalogType) => {
        const appStore = AppStore.Instance;
        if (!appStore.activeFrame) {
            AppToaster.show(ErrorToast("Please load an image file"));
            return;
        }
        const catalogWidgetId = appStore.updateCatalogProfile(fileId, appStore.activeFrame);
        if (catalogWidgetId) {
            TelemetryService.Instance.addTelemetryEntry(TelemetryAction.CatalogLoading, {column: headers.length, row: catalogInfo.dataSize, remote: true});
            appStore.catalogStore.catalogWidgets.set(fileId, catalogWidgetId);
            appStore.catalogStore.addCatalog(fileId, catalogInfo.dataSize);
            appStore.fileBrowserStore.hideFileBrowser();
            const catalogProfileStore = new CatalogOnlineQueryProfileStore(catalogInfo, headers, columnData, type);
            appStore.catalogStore.catalogProfileStores.set(fileId, catalogProfileStore);
            appStore.dialogStore.hideDialog(DialogId.OnlineDataQuery);
        }
    };

    public resetCancelTokenSource(type: CatalogDatabase) {
        if (type === CatalogDatabase.SIMBAD) {
            this.cancelTokenSourceSimbad = axios.CancelToken.source();
            this.axiosInstanceSimbad.defaults.cancelToken = this.cancelTokenSourceSimbad.token;
        } else if (type === CatalogDatabase.VIZIER) {
            this.cancelTokenSourceVizier = axios.CancelToken.source();
            this.axiosInstanceVizier.defaults.cancelToken = this.cancelTokenSourceVizier.token;
        }
    }

    public appendSimbadCatalog = async (query: string): Promise<number> => {
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        if (!frame) {
            AppToaster.show(ErrorToast("Please load an image file"));
            throw new Error("No image file");
        }

        const fileId = appStore.catalogNextFileId;
        let dataSize: number = 0;
        try {
            const response = await this.getSimbadCatalog(query);
            if (frame && response?.status === 200 && response?.data?.data?.length) {
                const configStore = CatalogOnlineQueryConfigStore.Instance;
                const headers = CatalogApiProcessing.processSimbadMetaData(response.data?.metadata);
                const columnData = CatalogApiProcessing.processSimbadData(response.data?.data, headers);
                const coosys: CARTA.Coosys.$Properties = {system: configStore.coordsType};
                const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.ICRS, CatalogOnlineQueryConfigStore.QUERY_DEG_PRECISION);
                const fileName = `${configStore.catalogDB}_${configStore.coordsType}_${centerCoord.x}_${centerCoord.y}_${configStore.searchRadius}${configStore.radiusUnits}`;
                const catalogFileInfo: CARTA.CatalogFileInfo.$Properties = {
                    name: fileName,
                    type: CARTA.CatalogFileType.VOTable,
                    description: "Online Simbad Catalog",
                    coosys: [coosys]
                };
                const catalogInfo: CatalogInfo = {
                    fileId,
                    fileInfo: catalogFileInfo,
                    dataSize: response.data?.data?.length ?? 0,
                    directory: ""
                };
                this.loadCatalog(fileId, catalogInfo, headers, columnData, CatalogType.SIMBAD);
            }
            dataSize = response?.data?.data?.length;
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
        return dataSize;
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
