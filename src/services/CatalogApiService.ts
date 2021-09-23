import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";
import axios, {AxiosInstance, AxiosResponse, CancelTokenSource} from "axios";
import {AppToaster, ErrorToast, WarningToast} from "components/Shared";
import {APIProcessing, CatalogInfo, CatalogType, ProcessedColumnData, VizieResource, WCSPoint2D} from "models";
import {AppStore, CatalogOnlineQueryConfigStore, CatalogOnlineQueryProfileStore, FrameStore, RadiusUnits, SystemType} from "stores";

export enum CatalogDatabase {
    SIMBAD = "SIMBAD",
    VIZIER = "VizieR"
}

export class CatalogApiService {
    private static staticInstance: CatalogApiService;
    private static readonly DBMap = new Map<CatalogDatabase, {baseURL: string}>([
        [CatalogDatabase.SIMBAD, {baseURL: "https://simbad.u-strasbg.fr/simbad/sim-tap/"}],
        [CatalogDatabase.VIZIER, {baseURL: "https://vizier.u-strasbg.fr/viz-bin/"}]
    ]);
    private axiosInstanceSimbad: AxiosInstance;
    private axiosInstanceVizieR: AxiosInstance;
    private cancelTokenSourceSimbad: CancelTokenSource;
    private cancelTokenSourceVizieR: CancelTokenSource;

    static get Instance() {
        if (!CatalogApiService.staticInstance) {
            CatalogApiService.staticInstance = new CatalogApiService();
        }
        return CatalogApiService.staticInstance;
    }

    constructor() {
        // makeObservable(this);
        this.cancelTokenSourceSimbad = axios.CancelToken.source();
        this.cancelTokenSourceVizieR = axios.CancelToken.source();
        this.axiosInstanceSimbad = axios.create({
            baseURL: CatalogApiService.DBMap.get(CatalogDatabase.SIMBAD).baseURL,
            cancelToken: this.cancelTokenSourceSimbad.token
        });
        this.axiosInstanceVizieR = axios.create({
            baseURL: CatalogApiService.DBMap.get(CatalogDatabase.VIZIER).baseURL,
            cancelToken: this.cancelTokenSourceVizieR.token
        });
    }

    public getSimbad = (query: string): Promise<AxiosResponse<any>> => {
        return this.axiosInstanceSimbad.get(`sync?request=doQuery&lang=adql&format=json&query=${query}`);
    };

    public cancleQuery(type: CatalogDatabase) {
        if (type === CatalogDatabase.SIMBAD) {
            this.cancelTokenSourceSimbad.cancel("Simbad query canceled by the user.");   
        } else if (type === CatalogDatabase.VIZIER) {
            this.cancelTokenSourceVizieR.cancel("VizieR query canceled by the user.")
        }
    }

    public queryVizier = async(point: WCSPoint2D, radius: number, unit: RadiusUnits, max: number): Promise<Map<string, VizieResource>>  => {
        let resources: Map<string, VizieResource> = new Map();
        let radiusUnits: string;
        switch (unit) {
            case RadiusUnits.ARCMINUTES:
                radiusUnits = "rm"
                break;
            case RadiusUnits.ARCSECONDS:
                radiusUnits = "rs"
                break;
            default:
                radiusUnits = "rd"
                break;
        }

        // _RA, _DE are a shorthand for _RA(J2000,J2000), _DE(J2000,J2000)
        await this.axiosInstanceVizieR.get(`votable?-c=${point.x} ${point.y}&-c.eq=J2000&-c.${radiusUnits}=${radius}&-sort=_r&-out.max=${max}&-corr=pos&-out.add=_r,_RA,_DE&-oc.form=d&-out.meta=hud`)
        .then(response => {
            if (response?.status === 200 && response?.data) {
                const data = APIProcessing.ProcessVizieRData(response.data);
                resources = data.resources; 
            }
        })
        .catch(error => {
            if (axios.isCancel(error)) {
                AppToaster.show(WarningToast(error?.message));
                CatalogApiService.Instance.resetCancelTokenSource(CatalogDatabase.VIZIER);
            } else if (error?.message) {
                AppToaster.show(ErrorToast(error.message));
            } else {
                console.log("Append Catalog Error: " + error);
            }
            return 0;
        });
        return resources;
    };

    public appendVizieRCatalog = (resources: VizieResource[]) => {
        for (let index = 0; index < resources.length; index++) {
            const element = resources[index];
            const fileId = AppStore.Instance.catalogNextFileId;
            const {headers, dataMap, size} = APIProcessing.ProcessVizieRTableData(element.table.tableElement);
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
            this.loadCatalog(fileId, AppStore.Instance.activeFrame, catalogInfo, headers, dataMap, CatalogType.VIZIER);
        }
    }

    public loadCatalog = (fileId: number, frame: FrameStore, catalogInfo: CatalogInfo, headers: CARTA.ICatalogHeader[], columnData: Map<number, ProcessedColumnData>, type: CatalogType) => {
        runInAction(() => {
            let catalogWidgetId = AppStore.Instance.updateCatalogProfile(fileId, frame);
            if (catalogWidgetId) {
                AppStore.Instance.catalogStore.catalogWidgets.set(fileId, catalogWidgetId);
                AppStore.Instance.catalogStore.addCatalog(fileId);
                AppStore.Instance.fileBrowserStore.hideFileBrowser();
                const catalogProfileStore = new CatalogOnlineQueryProfileStore(catalogInfo, headers, columnData, type);
                AppStore.Instance.catalogStore.catalogProfileStores.set(fileId, catalogProfileStore);
                AppStore.Instance.dialogStore.hideCatalogQueryDialog();
            }
        });
    }

    public resetCancelTokenSource(type: CatalogDatabase) {
        if (type === CatalogDatabase.SIMBAD) {
            this.cancelTokenSourceSimbad = axios.CancelToken.source();
            this.axiosInstanceSimbad.defaults.cancelToken = this.cancelTokenSourceSimbad.token;   
        } else if (type === CatalogDatabase.VIZIER) {
            this.cancelTokenSourceVizieR = axios.CancelToken.source();
            this.axiosInstanceVizieR.defaults.cancelToken = this.cancelTokenSourceVizieR.token;
        }
    }

    // Online Catalog Query
    public appendOnlineCatalog = async (query: string): Promise<number> => {
        const frame = AppStore.Instance.activeFrame;
        if (!frame) {
            AppToaster.show(ErrorToast("Please load the image file"));
            throw new Error("No image file");
        }

        const fileId = AppStore.Instance.catalogNextFileId;
        const dataSize = await this.getSimbad(query)
            .then(response => {
                if (frame && response?.status === 200 && response?.data?.data?.length) {
                    const configStore = CatalogOnlineQueryConfigStore.Instance;
                    const headers = APIProcessing.ProcessSimbadMetaData(response.data?.metadata);
                    const columnData = APIProcessing.ProcessSimbadData(response.data?.data, headers);
                    const coosy: CARTA.ICoosys = {system: configStore.coordsType};
                    const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.ICRS);
                    const fileName = `${configStore.catalogDB}_${configStore.coordsType}_${centerCoord.x}_${centerCoord.y}_${configStore.searchRadius}${configStore.radiusUnits}`;
                    const catalogFileInfo: CARTA.ICatalogFileInfo = {
                        name: fileName,
                        type: CARTA.CatalogFileType.VOTable,
                        description: "Online Simbad Catalog",
                        coosys: [coosy]
                    };
                    let catalogInfo: CatalogInfo = {
                        fileId,
                        fileInfo: catalogFileInfo,
                        dataSize: response.data?.data?.length,
                        directory: ""
                    };
                    this.loadCatalog(fileId, AppStore.Instance.activeFrame, catalogInfo, headers, columnData, CatalogType.SIMBAD);
                }
                return response?.data?.data?.length;
            })
            .catch(error => {
                if (axios.isCancel(error)) {
                    AppToaster.show(WarningToast(error?.message));
                    CatalogApiService.Instance.resetCancelTokenSource(CatalogDatabase.SIMBAD);
                } else if (error?.message) {
                    AppToaster.show(ErrorToast(error.message));
                } else {
                    console.log("Append Catalog Error: " + error);
                }
                return 0;
            });
        return dataSize;
    };
}
