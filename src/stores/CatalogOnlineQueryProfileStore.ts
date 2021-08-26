import {action, computed, observable, makeObservable} from "mobx";
import {CARTA} from "carta-protobuf";
import {ControlHeader} from "stores";
import {AbstractCatalogProfileStore, CatalogType, CatalogInfo, ProcessedColumnData} from "models";

export class CatalogOnlineQueryProfileStore extends AbstractCatalogProfileStore {
    private static readonly SimbadInitialedColumnsKeyWords = ["ra", "dec", "main_id", "coo_bibcode"];
    private readonly _dataSize;

    @observable catalogInfo: CatalogInfo;
    @observable catalogHeader: Array<CARTA.ICatalogHeader>;
    @observable catalogControlHeader: Map<string, ControlHeader>;
    @observable numVisibleRows: number;
    @observable loadingData: boolean;

    constructor(catalogInfo: CatalogInfo, catalogHeader: Array<CARTA.ICatalogHeader>, catalogData: Map<number, ProcessedColumnData>, dataSize: number, catalogType: CatalogType) {
        super(catalogType, catalogData);
        this._dataSize = dataSize;
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
        this.initIndexMap();
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
        this.updateSortedIndexMap();
    }

    @action updateSortedIndexMap() {
        let direction = 0;
        const dataIndex = this.catalogControlHeader.get(this.sortingInfo.columnName)?.dataIndex;
        const sortingType = this.sortingInfo.sortingType;
        if (sortingType == 0) {
            direction = 1;
        } else if (sortingType == 1) {
            direction = -1;
        }
        if (direction === 0 && this.getUserFilters().length === 0) {
            this.initIndexMap();
            return;
        }
        const catalogColumn = this.catalogData.get(dataIndex);
        switch (catalogColumn?.dataType) {
            case CARTA.ColumnType.String:
                this.indexMap.sort((a: number, b: number) => {
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
                this.indexMap.sort((a: number, b: number) => {
                    const aNumber = catalogColumn.data[a] as number;
                    const bNumber = catalogColumn.data[b] as number;
                    return direction * (aNumber < bNumber ? -1 : 1);
                });
                break;
        }
    }

    @action initIndexMap() {
        const currentMap = this.indexMap;
        this.indexMap = [];
        if (currentMap.length || this.numVisibleRows === 0) {
            for (let index = 0; index < this._dataSize; index++) {
                this.indexMap.push(index);
            }
        } else {
            for (let index = 0; index < this.numVisibleRows; index++) {
                this.indexMap.push(index);
            }
        }
        if (this.sortingInfo.columnName !== null && this.sortingInfo.sortingType !== null) {
            this.updateSortedIndexMap();
        }
    }

    @action resetFilterRequest(filterConfigs?: CARTA.FilterConfig[]) {
        this.initIndexMap();
        filterConfigs.forEach(filterConfig => {
            const header = this.catalogControlHeader.get(filterConfig.columnName);
            const dataIndex = header.dataIndex;
            if (dataIndex > -1 && header.display) {
                const catalogColumn = this.catalogData.get(dataIndex);
                switch (catalogColumn.dataType) {
                    case CARTA.ColumnType.String:
                        const columnDataString = catalogColumn.data as string[];
                        if (filterConfig.subString !== "") {
                            this.indexMap = this.indexMap.filter((i) => {
                                return columnDataString[i]?.includes(filterConfig.subString); 
                            });   
                        }
                        break;
                
                    default:
                        const columnDataNumber = catalogColumn.data as [];
                        this.indexMap = this.filterColumnData(columnDataNumber, filterConfig);
                        break;
                }
            }
        });
        this.numVisibleRows = this.indexMap.length;
    }

    @action filterColumnData = (catalogColumn: [], filterConfig: CARTA.FilterConfig): number[] => {
        switch (filterConfig.comparisonOperator) {
            case CARTA.ComparisonOperator.Equal:
                return this.indexMap.filter((i) => {
                    return catalogColumn[i] === filterConfig.value; 
                });
            case CARTA.ComparisonOperator.NotEqual:
                return this.indexMap.filter((i) => {
                    return catalogColumn[i] !== filterConfig.value; 
                });
            case CARTA.ComparisonOperator.Lesser:
                return this.indexMap.filter((i) => {
                    return catalogColumn[i] < filterConfig.value; 
                });
            case CARTA.ComparisonOperator.LessorOrEqual:
                return this.indexMap.filter((i) => {
                    return catalogColumn[i] <= filterConfig.value; 
                });
            case CARTA.ComparisonOperator.Greater:
                return this.indexMap.filter((i) => {
                    return catalogColumn[i] > filterConfig.value; 
                });
            case CARTA.ComparisonOperator.GreaterOrEqual:
                return this.indexMap.filter((i) => {
                    return catalogColumn[i] >= filterConfig.value; 
                });
            case CARTA.ComparisonOperator.RangeOpen:
                return this.indexMap.filter((i) => {
                    return catalogColumn[i] > filterConfig.value && catalogColumn[i] < filterConfig.secondaryValue; 
                });
            case CARTA.ComparisonOperator.RangeClosed:
                return this.indexMap.filter((i) => {
                    return catalogColumn[i] >= filterConfig.value && catalogColumn[i] <= filterConfig.secondaryValue; 
                });
            default:
                return [];
        }
    }

    @action resetCatalogFilterRequest = () => {
        this.numVisibleRows = this._dataSize;
        this.initIndexMap();
        this.resetUserFilters();
        this.updatingDataStream = false;
        this.sortingInfo.columnName = null;
        this.sortingInfo.sortingType = null;
    };

    @action setMaxRows(maxRows: number) {
        this.numVisibleRows = maxRows;
    }

    updateCatalogData(catalogFilter: CARTA.CatalogFilterResponse, catalogData: Map<number, ProcessedColumnData>) {
        console.log(catalogFilter, catalogData)
    }

    private 
}