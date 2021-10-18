import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";
import axios, {AxiosInstance, AxiosResponse, CancelTokenSource} from "axios";
import {AppToaster, ErrorToast, WarningToast} from "components/Shared";
import {CatalogInfo, CatalogType} from "models";
import {AppStore, CatalogOnlineQueryConfigStore, CatalogOnlineQueryProfileStore, SystemType} from "stores";
import {CatalogApiProcessing} from "utilities";

export enum CatalogDatabase {
    SIMBAD = "SIMBAD"
}

export class CatalogApiService {
    public static readonly SimbadHyperLink: {bibcode: string; mainId: string} = {bibcode: "https://ui.adsabs.harvard.edu/abs/", mainId: "https://simbad.u-strasbg.fr/simbad/sim-id?Ident="};

    private static staticInstance: CatalogApiService;
    private static readonly DBMap = new Map<CatalogDatabase, {baseURL: string}>([[CatalogDatabase.SIMBAD, {baseURL: "https://simbad.u-strasbg.fr/simbad/sim-tap/"}]]);
    private axiosInstanceSimbad: AxiosInstance;
    private cancelTokenSource: CancelTokenSource;

    static get Instance() {
        if (!CatalogApiService.staticInstance) {
            CatalogApiService.staticInstance = new CatalogApiService();
        }
        return CatalogApiService.staticInstance;
    }

    constructor() {
        this.cancelTokenSource = axios.CancelToken.source();
        this.axiosInstanceSimbad = axios.create({
            baseURL: CatalogApiService.DBMap.get(CatalogDatabase.SIMBAD).baseURL,
            cancelToken: this.cancelTokenSource.token
        });
    }

    public getSimbadCatalog = (query: string): Promise<AxiosResponse<any>> => {
        return this.axiosInstanceSimbad.get(`sync?request=doQuery&lang=adql&format=json&query=${query}`);
    };

    public cancleSimbadQuery() {
        this.cancelTokenSource.cancel("Query canceled by the user.");
    }

    public resetCancelTokenSource(error: any) {
        if (axios.isCancel(error)) {
            this.cancelTokenSource = axios.CancelToken.source();
            this.axiosInstanceSimbad.defaults.cancelToken = this.cancelTokenSource.token;
        }
    }

    // Online Catalog Query
    public appendOnlineCatalog = async (query: string): Promise<number> => {
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
                runInAction(() => {
                    const configStore = CatalogOnlineQueryConfigStore.Instance;
                    const headers = CatalogApiProcessing.ProcessSimbadMetaData(response.data?.metadata);
                    const columnData = CatalogApiProcessing.ProcessSimbadData(response.data?.data, headers);
                    const coosys: CARTA.ICoosys = {system: configStore.coordsType};
                    const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.ICRS);
                    const fileName = `${configStore.catalogDB}_${configStore.coordsType}_${centerCoord.x}_${centerCoord.y}_${configStore.searchRadius}${configStore.radiusUnits}`;
                    const catalogFileInfo: CARTA.ICatalogFileInfo = {
                        name: fileName,
                        type: CARTA.CatalogFileType.VOTable,
                        description: "Online Catalog",
                        coosys: [coosys]
                    };
                    let catalogInfo: CatalogInfo = {
                        fileId,
                        fileInfo: catalogFileInfo,
                        dataSize: response.data?.data?.length ?? 0,
                        directory: ""
                    };
                    let catalogWidgetId = appStore.updateCatalogProfile(fileId, frame);
                    if (catalogWidgetId) {
                        appStore.catalogStore.catalogWidgets.set(fileId, catalogWidgetId);
                        appStore.catalogStore.addCatalog(fileId, catalogInfo.dataSize);
                        appStore.fileBrowserStore.hideFileBrowser();
                        const catalogProfileStore = new CatalogOnlineQueryProfileStore(catalogInfo, headers, columnData, CatalogType.SIMBAD);
                        appStore.catalogStore.catalogProfileStores.set(fileId, catalogProfileStore);
                        appStore.dialogStore.hideCatalogQueryDialog();
                    }
                });
            }
            dataSize = response?.data?.data?.length;
        } catch (error) {
            if (axios.isCancel(error)) {
                AppToaster.show(WarningToast(error?.message));
                CatalogApiService.Instance.resetCancelTokenSource(error);
            } else if (error?.message) {
                AppToaster.show(ErrorToast(error.message));
            } else {
                console.log("Append Catalog Error: " + error);
            }
        }
        return dataSize;
    };
}
