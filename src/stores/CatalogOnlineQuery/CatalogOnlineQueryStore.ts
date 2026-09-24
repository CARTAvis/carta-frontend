import {action, makeObservable, observable} from "mobx";

import {CatalogDatabase, SystemType} from "enums";
import {type WCSPoint2D} from "models";
import {CatalogApiService} from "services";

import {CatalogOnlineQueryConfigStore} from "./CatalogOnlineQueryConfigStore";

export class CatalogOnlineQueryStore {
    private static staticInstance: CatalogOnlineQueryStore;

    @observable isQuerying: boolean = false;
    @observable resultSize: number | undefined = undefined;

    constructor() {
        makeObservable(this);
    }

    public static get Instance() {
        if (!CatalogOnlineQueryStore.staticInstance) {
            CatalogOnlineQueryStore.staticInstance = new CatalogOnlineQueryStore();
        }
        return CatalogOnlineQueryStore.staticInstance;
    }

    @action setIsQuerying(isQuerying: boolean) {
        this.isQuerying = isQuerying;
    }

    @action setResultSize(resultSize: number | undefined) {
        this.resultSize = resultSize;
    }

    @action resetResultSize() {
        this.resultSize = undefined;
    }

    public queryCatalogs = async () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        if (configStore.catalogDB === CatalogDatabase.SIMBAD) {
            const source = CatalogApiService.captureQuery("simbad");
            if (!source) {
                this.setResultSize(0);
                return;
            }
            this.setIsQuerying(true);
            try {
                const {dataSize} = await CatalogApiService.Instance.loadSimbadCatalog(source);
                this.setResultSize(dataSize);
            } finally {
                this.setIsQuerying(false);
            }
        } else if (configStore.catalogDB === CatalogDatabase.VIZIER) {
            this.setIsQuerying(true);
            try {
                configStore.resetVizier();
                const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.FK5, CatalogOnlineQueryConfigStore.QUERY_DEG_PRECISION);
                if (centerCoord.x && centerCoord.y) {
                    const resources = await CatalogApiService.Instance.queryVizierTableName(centerCoord as WCSPoint2D, configStore.searchRadius, configStore.radiusUnits, configStore.vizierKeyWords);
                    configStore.setVizierQueryResult(resources);
                    this.setResultSize(resources.size);
                } else {
                    this.setResultSize(0);
                }
            } finally {
                this.setIsQuerying(false);
            }
        }
    };

    public loadSelectedVizierCatalogs = async () => {
        const configStore = CatalogOnlineQueryConfigStore.Instance;
        const tableNames = configStore.selectedVizierSource.map(source => source?.table.name).filter((name): name is string => typeof name === "string" && name.length > 0);
        const source = CatalogApiService.captureQuery("vizier");
        if (source && tableNames.length) {
            this.setIsQuerying(true);
            try {
                await CatalogApiService.Instance.loadVizierCatalogs(source, tableNames);
            } finally {
                this.setIsQuerying(false);
            }
        }
    };
}
