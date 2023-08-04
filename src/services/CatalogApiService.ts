import axios, {AxiosInstance, AxiosResponse, CancelTokenSource} from "axios";
import {CARTA} from "carta-protobuf";
import {action} from "mobx";

import {AppToaster, ErrorToast, WarningToast} from "components/Shared";
import {CatalogInfo, CatalogType, WCSPoint2D} from "models";
import {AppStore, CatalogOnlineQueryConfigStore, CatalogOnlineQueryProfileStore, RadiusUnits, SystemType} from "stores";
import {CatalogApiProcessing, ProcessedColumnData, VizierResource} from "utilities";

import {TelemetryAction, TelemetryService} from "./TelemetryService";

export enum CatalogDatabase {
    SIMBAD = "SIMBAD",
    VIZIER = "VizieR"
}

export class CatalogApiService {
    public static readonly SimbadHyperLink: {bibcode: string; mainId: string} = {bibcode: "https://ui.adsabs.harvard.edu/abs/", mainId: "https://simbad.u-strasbg.fr/simbad/sim-id?Ident="};

    private static staticInstance: CatalogApiService;
    private static readonly DBMap = new Map<CatalogDatabase, {baseURL: string}>([
        [CatalogDatabase.SIMBAD, {baseURL: "https://simbad.u-strasbg.fr/simbad/sim-tap/"}],
        [CatalogDatabase.VIZIER, {baseURL: "https://vizier.u-strasbg.fr/viz-bin/"}]
    ]);
    private axiosInstanceSimbad: AxiosInstance;
    private axiosInstanceVizier: AxiosInstance;
    private cancelTokenSourceSimbad: CancelTokenSource;
    private cancelTokenSourceVizier: CancelTokenSource;

    static get Instance() {
        if (!CatalogApiService.staticInstance) {
            CatalogApiService.staticInstance = new CatalogApiService();
        }
        return CatalogApiService.staticInstance;
    }

    constructor() {
        this.cancelTokenSourceSimbad = axios.CancelToken.source();
        this.cancelTokenSourceVizier = axios.CancelToken.source();
        this.axiosInstanceSimbad = axios.create({
            baseURL: CatalogApiService.DBMap.get(CatalogDatabase.SIMBAD).baseURL,
            cancelToken: this.cancelTokenSourceSimbad.token
        });
        this.axiosInstanceVizier = axios.create({
            baseURL: CatalogApiService.DBMap.get(CatalogDatabase.VIZIER).baseURL,
            cancelToken: this.cancelTokenSourceVizier.token
        });
    }

    public getSimbadCatalog = (query: string): Promise<AxiosResponse<any>> => {
        return this.axiosInstanceSimbad.get(`sync?request=doQuery&lang=adql&format=json&query=${query}`);
    };

    public cancelQuery(type: CatalogDatabase) {
        if (type === CatalogDatabase.SIMBAD) {
            this.cancelTokenSourceSimbad.cancel("Simbad query canceled by the user.");
        } else if (type === CatalogDatabase.VIZIER) {
            this.cancelTokenSourceVizier.cancel("VizieR query canceled by the user.");
        }
    }

    public queryVizierTableName = async (point: WCSPoint2D, radius: number, unit: RadiusUnits, keyWords: string): Promise<Map<string, VizierResource>> => {
        let resources: Map<string, VizierResource> = new Map();
        let radiusUnits = this.getRadiusUnits(unit);
        // http://cdsarc.u-strasbg.fr/doc/asu-summary.htx
        // _RA, _DE are a shorthand for _RA(J2000,J2000), _DE(J2000,J2000)
        // -meta.max = 100000, use a large number to get all tables(same number as vizier use for their websit). default is 500.
        // when use -meta.max to limit the return data size, the API will not return the correct result.
        let query = `votable?-c=${point.x} ${point.y}&-c.eq=J2000&-c.${radiusUnits}=${radius}&-corr=pos&-out.meta=hud&-meta.all=1&-meta.max=100000`;
        if (keyWords) {
            query = `${query}&-words=${keyWords}`;
        }

        try {
            const response = await this.axiosInstanceVizier.get(query);
            if (response?.status === 200 && response?.data) {
                resources = CatalogApiProcessing.ProcessVizierData(response.data);
            }
        } catch (error) {
            if (axios.isCancel(error)) {
                AppToaster.show(WarningToast(error?.message));
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
        let radiusUnits = this.getRadiusUnits(unit);
        let sourceString = "-source=";
        sources.forEach(element => {
            sourceString += `${element.table.name},`;
        });

        // _RA, _DE are a shorthand for _RA(J2000,J2000), _DE(J2000,J2000)
        let query = `votable?${sourceString}&-c=${point.x} ${point.y}&-c.eq=J2000&-c.${radiusUnits}=${radius}&-out.max=${max}&-sort=_r&-corr=pos&-out.add=_r,_RA,_DE&-oc.form=d&-out.meta=hud`;

        try {
            const response = await this.axiosInstanceVizier.get(query);
            if (response?.status === 200 && response?.data) {
                resources = CatalogApiProcessing.ProcessVizierData(response.data);
            }
        } catch (error) {
            if (axios.isCancel(error)) {
                AppToaster.show(WarningToast(error?.message));
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
            const {headers, dataMap, size} = CatalogApiProcessing.ProcessVizierTableData(element.table.tableElement);
            const configStore = CatalogOnlineQueryConfigStore.Instance;
            const coosy: CARTA.ICoosys = {system: element.coosys.system};
            const fileName = `${configStore.catalogDB}_${element.coosys.system}_${element.table.name}_${configStore.searchRadius}${configStore.radiusUnits}`;
            const catalogFileInfo: CARTA.ICatalogFileInfo = {
                name: fileName,
                type: CARTA.CatalogFileType.VOTable,
                description: "Online VizieR Catalog",
                coosys: [coosy]
            };
            let catalogInfo: CatalogInfo = {
                fileId,
                fileInfo: catalogFileInfo,
                dataSize: size,
                directory: ""
            };
            this.loadCatalog(fileId, catalogInfo, headers, dataMap, CatalogType.VIZIER);
        });
    };

    @action loadCatalog = (fileId: number, catalogInfo: CatalogInfo, headers: CARTA.ICatalogHeader[], columnData: Map<number, ProcessedColumnData>, type: CatalogType) => {
        const appStore = AppStore.Instance;
        const catalogWidgetId = appStore.updateCatalogProfile(fileId, appStore.activeFrame);
        if (catalogWidgetId) {
            if (process.env.REACT_APP_SKIP_TELEMETRY === "false") {
                console.log(catalogInfo, headers);
                TelemetryService.Instance.addTelemetryEntry(TelemetryAction.CatalogLoading, {column: headers.length, row: catalogInfo.dataSize, remote: true});
            }
            appStore.catalogStore.catalogWidgets.set(fileId, catalogWidgetId);
            appStore.catalogStore.addCatalog(fileId, catalogInfo.dataSize);
            appStore.fileBrowserStore.hideFileBrowser();
            const catalogProfileStore = new CatalogOnlineQueryProfileStore(catalogInfo, headers, columnData, type);
            appStore.catalogStore.catalogProfileStores.set(fileId, catalogProfileStore);
            appStore.dialogStore.hideCatalogQueryDialog();
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
            AppToaster.show(ErrorToast("Please load the image file"));
            throw new Error("No image file");
        }

        const fileId = appStore.catalogNextFileId;
        let dataSize: number = 0;
        try {
            const response = await this.getSimbadCatalog(query);
            if (frame && response?.status === 200 && response?.data?.data?.length) {
                const configStore = CatalogOnlineQueryConfigStore.Instance;
                const headers = CatalogApiProcessing.ProcessSimbadMetaData(response.data?.metadata);
                const columnData = CatalogApiProcessing.ProcessSimbadData(response.data?.data, headers);
                const coosys: CARTA.ICoosys = {system: configStore.coordsType};
                const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.ICRS);
                const fileName = `${configStore.catalogDB}_${configStore.coordsType}_${centerCoord.x}_${centerCoord.y}_${configStore.searchRadius}${configStore.radiusUnits}`;
                const catalogFileInfo: CARTA.ICatalogFileInfo = {
                    name: fileName,
                    type: CARTA.CatalogFileType.VOTable,
                    description: "Online Simbad Catalog",
                    coosys: [coosys]
                };
                let catalogInfo: CatalogInfo = {
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
                AppToaster.show(WarningToast(error?.message));
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
