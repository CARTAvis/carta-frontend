import {action, computed, observable, makeObservable} from "mobx";
import {CARTA} from "carta-protobuf";
import {ControlHeader} from "stores";
import {AbstractCatalogProfileStore, CatalogType, CatalogSystemType, CatalogInfo, ProcessedColumnData} from "models";

export class CatalogOnlineQueryProfileStore extends AbstractCatalogProfileStore {
    private static readonly SimbadInitialedColumnsKeyWords = ["ra", "dec", "main_id", "coo_bibcode"];

    @observable catalogInfo: CatalogInfo;
    @observable catalogHeader: Array<CARTA.ICatalogHeader>;
    @observable catalogControlHeader: Map<string, ControlHeader>;
    @observable numVisibleRows: number;
    @observable loadingData: boolean;

    constructor(catalogInfo: CatalogInfo, catalogHeader: Array<CARTA.ICatalogHeader>, catalogData: Map<number, ProcessedColumnData>, dataSize: number, catalogType: CatalogType = CatalogType.FILE) {
        super(catalogType, catalogData);
        makeObservable(this);
        this.catalogInfo = catalogInfo;
        this.catalogHeader = catalogHeader.sort((a, b) => {
            return a.columnIndex - b.columnIndex;
        });
        // this._catalogData = catalogData;
        this.catalogControlHeader = this.initCatalogControlHeader;
        this.numVisibleRows = dataSize;
        this.loadingData = false;

        this.catalogCoordinateSystem = {
            system: CatalogSystemType.ICRS,
            equinox: null,
            epoch: null,
            coordinate: this.systemCoordinateMap.get(CatalogSystemType.ICRS)
        };
    }

    @computed get initCatalogControlHeader() {
        const controlHeaders = new Map<string, ControlHeader>();
        const catalogHeader = this.catalogHeader;

        if (catalogHeader.length) {
            for (let index = 0; index < catalogHeader.length; index++) {
                const header = catalogHeader[index];
                let display = false;
                if (CatalogOnlineQueryProfileStore.SimbadInitialedColumnsKeyWords.includes(header.name)) {
                    display = true;
                }
                let controlHeader: ControlHeader = {columnIndex: header.columnIndex, dataIndex: index, display: display, filter: "", columnWidth: null};
                controlHeaders.set(header.name, controlHeader);
            }
        }
        return controlHeaders;
    }

    // handel filter
    @computed get updateRequestDataSize() {
        return this.catalogFilterRequest;
    }

    // do not need infinite scroll for API data
    @computed get shouldUpdateData(): boolean {
        return false;
    }

    @computed get loadOntoImage() {
        return this.loadingData;
    }

    @computed get maxRows(): number {
        return this.numVisibleRows;
    }

    @action resetFilterRequestControlParams() {
        console.log("reset clicked")
    }

    @action resetCatalogFilterRequest = () => {
        this.resetFilterRequestControlParams();
    };

    @action setMaxRows(maxRows: number) {
        this.numVisibleRows = maxRows;
    }

    updateCatalogData(catalogFilter: CARTA.CatalogFilterResponse, catalogData: Map<number, ProcessedColumnData>) {
        console.log(catalogFilter, catalogData)
    }
}