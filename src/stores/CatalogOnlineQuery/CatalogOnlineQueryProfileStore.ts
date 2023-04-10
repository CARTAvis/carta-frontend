import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {AbstractCatalogProfileStore, CatalogInfo, CatalogType} from "models";
import {ControlHeader, PreferenceStore} from "stores";
import {ProcessedColumnData} from "utilities";

export class CatalogOnlineQueryProfileStore extends AbstractCatalogProfileStore {
    private static readonly SimbadInitialedColumnsKeyWords = ["ra", "dec", "main_id", "coo_bibcode", "dist", "otype_txt"];
    private static readonly VizierInitialedColumnsKeyWords = ["_r", "_RAJ2000", "_DEJ2000"];

    @observable catalogInfo: CatalogInfo;
    @observable catalogHeader: Array<CARTA.ICatalogHeader>;
    @observable catalogControlHeader: Map<string, ControlHeader>;
    @observable numVisibleRows: number;

    constructor(catalogInfo: CatalogInfo, catalogHeader: Array<CARTA.ICatalogHeader>, catalogData: Map<number, ProcessedColumnData>, catalogType: CatalogType) {
        super(catalogType, catalogData);
        makeObservable(this);
        this.catalogInfo = catalogInfo;
        this.catalogHeader = catalogHeader.sort((a, b) => {
            return a.columnIndex - b.columnIndex;
        });
        this.catalogControlHeader = this.initCatalogControlHeader;
        this.numVisibleRows = catalogInfo.dataSize;

        const coordinateSystem = catalogInfo.fileInfo.coosys[0];
        const system = AbstractCatalogProfileStore.getCatalogSystem(coordinateSystem.system);
        this.catalogCoordinateSystem = {
            system: system,
            equinox: null,
            epoch: null,
            coordinate: this.systemCoordinateMap.get(system)
        };
        this.initSortedIndexMap();
        this.initFilterIndexMap();
    }

    get updateRequestDataSize() {
        return this.catalogFilterRequest;
    }

    // do not need infinite scroll for API data
    get shouldUpdateData() {
        return false;
    }

    get loadOntoImage() {
        return this.loadingData;
    }

    get maxRows() {
        return this.numVisibleRows;
    }

    @computed get initCatalogControlHeader() {
        const controlHeaders = new Map<string, ControlHeader>();
        const catalogHeader = this.catalogHeader;

        if (catalogHeader.length) {
            for (let index = 0; index < catalogHeader.length; index++) {
                const header = catalogHeader[index];
                let display = false;
                if (this.catalogType === CatalogType.SIMBAD && CatalogOnlineQueryProfileStore.SimbadInitialedColumnsKeyWords.includes(header.name)) {
                    display = true;
                } else if (this.catalogType === CatalogType.VIZIER && (CatalogOnlineQueryProfileStore.VizierInitialedColumnsKeyWords.includes(header.name) || index < PreferenceStore.Instance.catalogDisplayedColumnSize)) {
                    display = true;
                }
                let controlHeader: ControlHeader = {columnIndex: header.columnIndex, dataIndex: index, display: display, filter: "", columnWidth: null};
                controlHeaders.set(header.name, controlHeader);
            }
        }
        return controlHeaders;
    }

    @action setSortingInfo(columnName: string, sortingType: CARTA.SortingType) {
        this.sortingInfo = {columnName, sortingType};
        this.updateSortedIndexMap();
    }

    @action updateSortedIndexMap() {
        const dataIndex = this.catalogControlHeader.get(this.sortingInfo.columnName)?.dataIndex;
        if (dataIndex >= 0) {
            let direction = 0;
            const sortingType = this.sortingInfo.sortingType;
            if (sortingType === 0) {
                direction = 1;
            } else if (sortingType === 1) {
                direction = -1;
            }
            if (direction === 0 && this.getUserFilters().length === 0) {
                this.initSortedIndexMap();
                return;
            }
            let catalogColumn = this.catalogData.get(dataIndex);
            if (this.hasFilter) {
                this.initSortedIndexMap();
            }
            switch (catalogColumn?.dataType) {
                case CARTA.ColumnType.String:
                    this.sortedIndexMap.sort((a: number, b: number) => {
                        const aString = String(catalogColumn.data[a]);
                        const bString = String(catalogColumn.data[b]);
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
                        const aNumber = Number(catalogColumn.data[a]);
                        const bNumber = Number(catalogColumn.data[b]);
                        return direction * (aNumber < bNumber ? -1 : 1);
                    });
                    break;
            }
        }
    }

    @action initSortedIndexMap() {
        this.sortedIndexMap = [];
        for (let index = 0; index < this.numVisibleRows; index++) {
            this.sortedIndexMap.push(index);
        }
    }

    @action initFilterIndexMap() {
        this.filterIndexMap = [];
        for (let index = 0; index < this.catalogInfo.dataSize; index++) {
            this.filterIndexMap.push(index);
        }
    }

    @action resetFilterRequest(filterConfigs?: CARTA.FilterConfig[]) {
        this.initFilterIndexMap();
        filterConfigs.forEach(filterConfig => {
            const header = this.catalogControlHeader.get(filterConfig.columnName);
            const dataIndex = header.dataIndex;
            if (dataIndex > -1 && header.display) {
                const catalogColumn = this.catalogOriginalData.get(dataIndex);
                switch (catalogColumn.dataType) {
                    case CARTA.ColumnType.String:
                        const columnDataString = catalogColumn.data as string[];
                        if (filterConfig.subString !== "") {
                            this.filterIndexMap = this.filterIndexMap.filter(i => {
                                return columnDataString[i]?.includes(filterConfig.subString);
                            });
                        }
                        break;

                    default:
                        const columnDataNumber = catalogColumn.data as [];
                        this.filterIndexMap = this.filterColumnData(columnDataNumber, filterConfig);
                        break;
                }
            }
        });
        this.numVisibleRows = this.filterIndexMap.length;
        if (this.sortingInfo.columnName !== null && this.sortingInfo.sortingType !== null) {
            this.updateSortedIndexMap();
        }
    }

    @action filterColumnData = (catalogColumn: [], filterConfig: CARTA.FilterConfig): number[] => {
        switch (filterConfig.comparisonOperator) {
            case CARTA.ComparisonOperator.Equal:
                return this.filterIndexMap.filter(i => {
                    return catalogColumn[i] === filterConfig.value;
                });
            case CARTA.ComparisonOperator.NotEqual:
                return this.filterIndexMap.filter(i => {
                    return catalogColumn[i] !== filterConfig.value;
                });
            case CARTA.ComparisonOperator.Lesser:
                return this.filterIndexMap.filter(i => {
                    return catalogColumn[i] < filterConfig.value;
                });
            case CARTA.ComparisonOperator.LessorOrEqual:
                return this.filterIndexMap.filter(i => {
                    return catalogColumn[i] <= filterConfig.value;
                });
            case CARTA.ComparisonOperator.Greater:
                return this.filterIndexMap.filter(i => {
                    return catalogColumn[i] > filterConfig.value;
                });
            case CARTA.ComparisonOperator.GreaterOrEqual:
                return this.filterIndexMap.filter(i => {
                    return catalogColumn[i] >= filterConfig.value;
                });
            case CARTA.ComparisonOperator.RangeOpen:
                return this.filterIndexMap.filter(i => {
                    return catalogColumn[i] > filterConfig.value && catalogColumn[i] < filterConfig.secondaryValue;
                });
            case CARTA.ComparisonOperator.RangeClosed:
                return this.filterIndexMap.filter(i => {
                    return catalogColumn[i] >= filterConfig.value && catalogColumn[i] <= filterConfig.secondaryValue;
                });
            default:
                return [];
        }
    };

    @action resetCatalogFilterRequest = () => {
        this.numVisibleRows = this.catalogInfo.dataSize;
        this.initSortedIndexMap();
        this.initFilterIndexMap();
        this.resetUserFilters();
        this.sortingInfo.columnName = null;
        this.sortingInfo.sortingType = null;
    };

    @action setMaxRows(maxRows: number) {
        this.numVisibleRows = maxRows;
    }

    updateCatalogData(catalogFilter: CARTA.CatalogFilterResponse, catalogData: Map<number, ProcessedColumnData>) {
        console.log(catalogFilter, catalogData);
    }
}
