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
            // In Simbad, the coordinate system parameter is never interpreted. All coordinates MUST be expressed in the ICRS coordinate system
            const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.ICRS, CatalogOnlineQueryConfigStore.QUERY_DEG_PRECISION);
            const query = CatalogOnlineQueryConfigStore.simbadQuery({x: Number(centerCoord.x), y: Number(centerCoord.y)}, configStore.radiusAsDeg, configStore.maxObject);
            this.setIsQuerying(true);
            try {
                const {dataSize} = await CatalogApiService.Instance.appendSimbadCatalog(query);
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
        const sources = configStore.selectedVizierSource.filter(source => source !== undefined);
        const centerCoord = configStore.convertToDeg(configStore.centerPixelCoordAsPoint2D, SystemType.FK5, CatalogOnlineQueryConfigStore.QUERY_DEG_PRECISION);
        if (centerCoord.x && centerCoord.y) {
            const querySource = CatalogApiService.captureQuery("vizier");
            this.setIsQuerying(true);
            try {
                const resources = await CatalogApiService.Instance.queryVizierSource(centerCoord as WCSPoint2D, configStore.searchRadius, configStore.radiusUnits, configStore.maxObject, sources);
                CatalogApiService.Instance.appendVizierCatalog(resources, {querySource});
            } finally {
                this.setIsQuerying(false);
            }
        }
    };
}
