import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {AbstractCatalogProfileStore, CatalogInfo, CatalogSystemType, CatalogType} from "models";
import {PreferenceStore} from "stores";
import {ProcessedColumnData} from "utilities";

export enum CatalogCoordinate {
    X = "X",
    Y = "Y",
    PlotSize = "Size",
    PlotShape = "Shape",
    NONE = "None"
}

export enum CatalogUpdateMode {
    TableUpdate = "TableUpdate",
    ViewUpdate = "ViewUpdate",
    PlotsUpdate = "PlotsUpdate"
}

export type ControlHeader = {columnIndex: number; dataIndex: number; display: boolean; filter: string; columnWidth: number};

export class CatalogProfileStore extends AbstractCatalogProfileStore {
    public static readonly InitTableRows = 50;
    private static readonly DataChunkSize = 50;
    private readonly InitialedColumnsKeyWords = ["ANGULAR DISTANCE", "MAIN IDENTIFIER", "RADIAL VELOCITY", "REDSHIFT"];
    private readonly InitialedExcludeColumnsKeyWords = ["PROPER MOTION", "SIGMA"];
    private InitialedRAColumnsKeyWords = ["RIGHT ASCENSION", "RA", "R.A"];
    private InitialedDECColumnsKeyWords = ["DECLINATION", "DEC", "Dec."];

    @observable catalogInfo: CatalogInfo;
    @observable catalogControlHeader: Map<string, ControlHeader>;
    @observable catalogHeader: Array<CARTA.ICatalogHeader>;
    @observable numVisibleRows: number;
    @observable subsetEndIndex: number;
    @observable maxRows: number;

    constructor(catalogInfo: CatalogInfo, catalogHeader: Array<CARTA.ICatalogHeader>, catalogData: Map<number, ProcessedColumnData>, catalogType: CatalogType = CatalogType.FILE) {
        super(catalogType, catalogData);
        makeObservable(this);
        this.catalogInfo = catalogInfo;
        this.catalogHeader = catalogHeader.sort((a, b) => {
            return a.columnIndex - b.columnIndex;
        });
        this.catalogControlHeader = this.initCatalogControlHeader;
        this.catalogFilterRequest = this.initCatalogFilterRequest;
        this.updatingDataStream = false;
        this.updateMode = CatalogUpdateMode.TableUpdate;
        this.selectedPointIndices = [];
        this.filterDataSize = undefined;
        this.maxRows = catalogInfo.dataSize;

        const coordinateSystem = catalogInfo.fileInfo.coosys[0];

        if (coordinateSystem) {
            const system = AbstractCatalogProfileStore.getCatalogSystem(coordinateSystem.system);
            this.catalogCoordinateSystem = {
                system: system,
                equinox: coordinateSystem.equinox,
                epoch: coordinateSystem.epoch,
                coordinate: this.systemCoordinateMap.get(CatalogSystemType.ICRS)
            };
        } else {
            this.catalogCoordinateSystem = {
                system: CatalogSystemType.ICRS,
                equinox: null,
                epoch: null,
                coordinate: this.systemCoordinateMap.get(CatalogSystemType.ICRS)
            };
        }

        const initTableRows = CatalogProfileStore.InitTableRows;
        if (catalogInfo.dataSize < initTableRows) {
            this.numVisibleRows = catalogInfo.dataSize;
            this.subsetEndIndex = catalogInfo.dataSize;
        } else {
            this.numVisibleRows = initTableRows;
            this.subsetEndIndex = initTableRows;
        }
    }

    @action setUserFilter(catalogFilterRequest: CARTA.CatalogFilterRequest) {
        this.catalogFilterRequest = catalogFilterRequest;
    }

    @action setCatalogHeader(catalogHeader: Array<CARTA.CatalogHeader>) {
        this.catalogHeader = catalogHeader;
    }

    private static FillAllocatedArray<T>(existingArray: Array<T>, newArray: Array<T>, insertionIndex: number, allocationSize: number): Array<T> {
        const newDataSize = newArray.length;
        let destArr: Array<T>;
        // fill in-place
        if (existingArray.length === allocationSize) {
            destArr = existingArray;
            for (let i = 0; i < newDataSize; i++) {
                destArr[i + insertionIndex] = newArray[i];
            }
        } else {
            // Create a new array and copy across up to the insertion index
            destArr = new Array<T>(allocationSize);
            for (let i = 0; i < insertionIndex; i++) {
                destArr[i] = existingArray[i];
            }

            for (let i = 0; i < newDataSize; i++) {
                destArr[i + insertionIndex] = newArray[i];
            }
        }
        return destArr;
    }

    updateCatalogData(catalogFilter: CARTA.CatalogFilterResponse, catalogData: Map<number, ProcessedColumnData>) {
        let subsetDataSize = catalogFilter.subsetDataSize;
        const subsetEndIndex = catalogFilter.subsetEndIndex;
        const startIndex = subsetEndIndex - subsetDataSize;

        this.filterDataSize = catalogFilter.filterDataSize;

        if (this.subsetEndIndex <= this.filterDataSize) {
            let numVisibleRows = this.numVisibleRows + subsetDataSize;
            catalogData.forEach((newData, key) => {
                let currentData = this.catalogData.get(key);
                if (!currentData) {
                    this.catalogData.set(key, newData);
                } else {
                    if (currentData.dataType === CARTA.ColumnType.String) {
                        const currentArr = currentData.data as Array<string>;
                        const newArr = newData.data as Array<string>;
                        currentData.data = CatalogProfileStore.FillAllocatedArray<string>(currentArr, newArr, startIndex, subsetEndIndex);
                    } else if (currentData.dataType === CARTA.ColumnType.Bool) {
                        const currentArr = currentData.data as Array<boolean>;
                        const newArr = newData.data as Array<boolean>;
                        currentData.data = CatalogProfileStore.FillAllocatedArray<boolean>(currentArr, newArr, startIndex, subsetEndIndex);
                    } else if (currentData.dataType === CARTA.ColumnType.UnsupportedType) {
                        return;
                    } else {
                        const currentArr = currentData.data as Array<number>;
                        const newArr = newData.data as Array<number>;
                        currentData.data = CatalogProfileStore.FillAllocatedArray<number>(currentArr, newArr, startIndex, subsetEndIndex);
                    }
                }
            });
            this.setNumVisibleRows(numVisibleRows);
            this.subsetEndIndex = subsetEndIndex;
        }
    }

    @action.bound setNumVisibleRows(val: number) {
        this.numVisibleRows = val;
    }

    @action setSubsetEndIndex(val: number) {
        this.subsetEndIndex = val;
    }

    @action resetCatalogFilterRequest = () => {
        this.resetFilterRequest();
        this.resetUserFilters();
        this.loadingData = false;
        this.catalogFilterRequest = this.initCatalogFilterRequest;
        this.updatingDataStream = false;
        this.sortingInfo.columnName = null;
        this.sortingInfo.sortingType = null;
        this.maxRows = this.catalogInfo.dataSize;
    };

    @action resetFilterRequest() {
        this.setUpdateMode(CatalogUpdateMode.TableUpdate);
        this.clearData();
        this.setNumVisibleRows(0);
        this.setSubsetEndIndex(0);
        this.setLoadingDataStatus(true);
    }

    @action setSortingInfo(columnName: string, sortingType: CARTA.SortingType) {
        this.sortingInfo = {columnName, sortingType};
    }

    @computed get loadOntoImage() {
        return this.loadingData || this.updatingDataStream;
    }

    @computed get initCatalogControlHeader() {
        const controlHeaders = new Map<string, ControlHeader>();
        const catalogHeader = this.catalogHeader;

        if (catalogHeader.length) {
            for (let index = 0; index < catalogHeader.length; index++) {
                const header = catalogHeader[index];
                let display = false;
                if (index < PreferenceStore.Instance.catalogDisplayedColumnSize) {
                    display = true;
                }
                let controlHeader: ControlHeader = {columnIndex: header.columnIndex, dataIndex: index, display: display, filter: "", columnWidth: null};
                controlHeaders.set(header.name, controlHeader);
            }
        }
        return controlHeaders;
    }

    @action setMaxRows(maxRows: number) {
        this.updateTableStatus(true);
        this.maxRows = maxRows;
    }

    @computed get initCatalogFilterRequest(): CARTA.CatalogFilterRequest {
        let catalogFilter: CARTA.CatalogFilterRequest = new CARTA.CatalogFilterRequest();
        let imageBounds: CARTA.CatalogImageBounds = new CARTA.CatalogImageBounds();
        let previewDatasize = CatalogProfileStore.InitTableRows;
        catalogFilter.fileId = this.catalogInfo.fileId;
        catalogFilter.filterConfigs = null;
        catalogFilter.columnIndices = this.columnIndices;
        catalogFilter.subsetStartIndex = 0;
        catalogFilter.imageBounds = imageBounds;
        catalogFilter.regionId = null;
        catalogFilter.sortColumn = null;
        catalogFilter.sortingType = null;

        if (previewDatasize > this.maxRows) {
            previewDatasize = this.maxRows;
        }

        if (this.catalogInfo.dataSize < previewDatasize) {
            catalogFilter.subsetDataSize = this.catalogInfo.dataSize;
        } else {
            catalogFilter.subsetDataSize = previewDatasize;
        }

        return catalogFilter;
    }

    @computed get updateRequestDataSize() {
        this.catalogFilterRequest.subsetStartIndex = this.subsetEndIndex;
        if (this.maxRows <= this.numVisibleRows) {
            this.catalogFilterRequest.subsetStartIndex = 0;
            this.catalogFilterRequest.subsetDataSize = this.maxRows;
            return this.catalogFilterRequest;
        }
        const dataSize = this.maxRows - this.numVisibleRows;
        if (this.updateMode === CatalogUpdateMode.TableUpdate) {
            let subsetDataSize = CatalogProfileStore.DataChunkSize;
            if (dataSize < subsetDataSize && dataSize > 0) {
                subsetDataSize = dataSize;
            }
            this.catalogFilterRequest.subsetDataSize = subsetDataSize;
        } else {
            this.catalogFilterRequest.subsetDataSize = dataSize;
        }
        return this.catalogFilterRequest;
    }

    @computed get shouldUpdateData(): boolean {
        if (isFinite(this.filterDataSize)) {
            return this.subsetEndIndex < this.filterDataSize && this.subsetEndIndex < this.maxRows;
        } else {
            return this.subsetEndIndex < this.catalogInfo.dataSize && this.subsetEndIndex < this.maxRows;
        }
    }

    @computed get columnIndices(): Array<number> {
        let indices = [];
        this.catalogControlHeader.forEach((value, key) => {
            if (value.display) {
                indices.push(value.columnIndex);
            }
        });
        return indices;
    }

    private findKeywords(val: string): boolean {
        const keyWords = this.InitialedColumnsKeyWords;
        const raKeywords = this.InitialedRAColumnsKeyWords;
        const decKeywords = this.InitialedDECColumnsKeyWords;
        const excludeKeywords = this.InitialedExcludeColumnsKeyWords;
        const description = val.toUpperCase();
        for (let index = 0; index < keyWords.length; index++) {
            const subString = keyWords[index];
            if (description.includes(subString)) {
                return true;
            }
        }
        if (description.includes(excludeKeywords[0]) || description.includes(excludeKeywords[1])) {
            return false;
        }
        for (let index = 0; index < raKeywords.length; index++) {
            const ra = raKeywords[index];
            if (description.includes(ra)) {
                return true;
            }
        }
        for (let index = 0; index < decKeywords.length; index++) {
            const dec = decKeywords[index];
            if (description.includes(dec)) {
                return true;
            }
        }
        return false;
    }
}
