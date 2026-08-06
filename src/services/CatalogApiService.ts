import axios, {type AxiosInstance, type AxiosResponse, type CancelTokenSource} from "axios";
import {CARTA} from "carta-protobuf";
import {action, makeObservable} from "mobx";

import {AppToaster, ErrorToast, WarningToast} from "components/Shared";
import {CatalogDatabase, CatalogType, DialogId, RadiusUnits, SystemType, TelemetryAction} from "enums";
import {type CatalogInfo, type WCSPoint2D} from "models";
import {AppStore, CatalogOnlineQueryConfigStore, CatalogOnlineQueryProfileStore, PreferenceStore} from "stores";
import {CatalogApiProcessing, type ProcessedColumnData, type VizierResource} from "utilities";

import {TelemetryService} from "./TelemetryService";

const DEFAULT_MIRROR_URLS = {
    [CatalogDatabase.SIMBAD]: "https://simbad.u-strasbg.fr/simbad/sim-tap/",
    [CatalogDatabase.VIZIER]: "https://vizier.cds.unistra.fr/viz-bin/"
};

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
        const encoded = encodeURIComponent(query);
        return this.getFromActiveMirror(this.axiosInstanceSimbad, CatalogDatabase.SIMBAD, `sync?request=doQuery&lang=adql&format=json&query=${encoded}`);
    };

    public cancelQuery(type: CatalogDatabase) {
        if (type === CatalogDatabase.SIMBAD) {
            this.cancelTokenSourceSimbad.cancel("Simbad query canceled by the user.");
        } else if (type === CatalogDatabase.VIZIER) {
            this.cancelTokenSourceVizier.cancel("VizieR query canceled by the user.");
        }
    }

    public benchmarkMirror = async (database: CatalogDatabase, mirrorUrl: string, timeoutMs: number = 10000, signal?: AbortSignal): Promise<number | null> => {
        if (PreferenceStore.Instance.isCatalogQueryMirrorDisabled(mirrorUrl)) {
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
        const activeMirrorUrl = this.getActiveMirrorUrl(database);
        return instance.get(this.joinUrl(activeMirrorUrl, path)).catch(error => {
            if (axios.isCancel(error)) {
                throw error;
            }
            throw this.createMirrorRequestError(activeMirrorUrl, error);
        });
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
        const preferenceStore = PreferenceStore.Instance;
        const activeMirrorUrl = preferenceStore.getCatalogQueryMirrors(database).find(mirror => !preferenceStore.isCatalogQueryMirrorDisabled(mirror));
        return this.normalizeMirrorUrl(database, activeMirrorUrl) ?? DEFAULT_MIRROR_URLS[database];
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
        let normalized = url.trim();
        if (!normalized) {
            return null;
        }

        normalized = normalized.replace(/\/+$/, "");

        if (database === CatalogDatabase.VIZIER) {
            normalized = normalized.replace(/\/(?:vizier|viz-bin)$/i, "");
            normalized = `${normalized}/viz-bin`;
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
