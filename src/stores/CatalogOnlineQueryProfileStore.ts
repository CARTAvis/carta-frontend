import {action, computed, observable, makeObservable} from "mobx";
import {CARTA} from "carta-protobuf";
import {ControlHeader} from "stores";
import {AbstractCatalogProfileStore, CatalogType, CatalogInfo, ProcessedColumnData} from "models";

export class CatalogOnlineQueryProfileStore extends AbstractCatalogProfileStore {
    private static readonly SimbadInitialedColumnsKeyWords = ["ra", "dec", "main_id", "coo_bibcode"];

    @observable catalogInfo: CatalogInfo;
    @observable catalogHeader: Array<CARTA.ICatalogHeader>;
    @observable catalogControlHeader: Map<string, ControlHeader>;
    @observable numVisibleRows: number;
    @observable loadingData: boolean;
    @observable sortedIndexMap: number[];

    constructor(catalogInfo: CatalogInfo, catalogHeader: Array<CARTA.ICatalogHeader>, catalogData: Map<number, ProcessedColumnData>, dataSize: number, catalogType: CatalogType) {
        super(catalogType, catalogData);
        makeObservable(this);
        this.catalogInfo = catalogInfo;
        this.catalogHeader = catalogHeader.sort((a, b) => {
            return a.columnIndex - b.columnIndex;
        });

        this.catalogControlHeader = this.initCatalogControlHeader;
        this.numVisibleRows = dataSize;
        this.loadingData = false;

        const coordinateSystem = catalogInfo.fileInfo.coosys[0];
        const system = AbstractCatalogProfileStore.getCatalogSystem(coordinateSystem.system);
        this.catalogCoordinateSystem = {
            system: system,
            equinox: null,
            epoch: null,
            coordinate: this.systemCoordinateMap.get(system)
        };
        this.initSortedIndexMap();
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

    @action setSortingInfo(columnName: string, sortingType: CARTA.SortingType, columnIndex?: number) {
        this.sortingInfo = {columnName, sortingType};
        let direction = 0;
        if (sortingType == 0) {
            direction = 1;
        } else if (sortingType == 1) {
            direction = -1;
        }
        if (direction === 0) {
            this.initSortedIndexMap();
            return;
        }
        const catalogColumn = this.catalogData.get(columnIndex);
        switch (catalogColumn.dataType) {
            case CARTA.ColumnType.String:
                this.sortedIndexMap.sort((a: number, b: number) => {
                    const aString = catalogColumn.data[a] as string;
                    const bString = catalogColumn.data[b] as string;
                    if (!aString) {
                        return direction * -1;
                     }
                 
                     if (!bString) {
                        return direction * 1;
                     }
                    return direction * aString.localeCompare(bString);
                });
                break;
            case CARTA.ColumnType.UnsupportedType:
                console.log("Data type is not supported");
                break;
            default:
                this.sortedIndexMap.sort((a: number, b: number) => {
                    const aNumber = catalogColumn.data[a] as number;
                    const bNumber = catalogColumn.data[b] as number;
                    return direction * (aNumber < bNumber ? -1 : 1);
                });
                break;
        }
    }

    @action initSortedIndexMap() {
        this.sortedIndexMap = new Array(this.numVisibleRows);
        for (let index = 0; index < this.numVisibleRows; index++) {
            this.sortedIndexMap[index] = index;
        }
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

    private 
}