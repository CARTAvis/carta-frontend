import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {CatalogSystemType, CatalogType, CatalogUpdateMode} from "enums";
import {AbstractCatalogProfileStore, type CatalogInfo} from "models";
import {PreferenceStore} from "stores";
import {CatalogAxisEligibility, getAutoSelectedCatalogAxisColumn, getCatalogAxisEligibility, type ProcessedColumnData} from "utilities";

export type ControlHeader = {columnIndex: number | undefined; dataIndex: number | undefined; display: boolean | undefined; filter: string; columnWidth: number | null | undefined};

export class CatalogProfileStore extends AbstractCatalogProfileStore {
    public static readonly INIT_TABLE_ROWS = 50;
    private static readonly DataChunkSize = 50;

    @observable catalogInfo: CatalogInfo;
    @observable catalogControlHeader: Map<string, ControlHeader>;
    @observable catalogHeader: Array<CARTA.CatalogHeader>;
    @observable numVisibleRows: number;
    @observable subsetEndIndex: number;
    @observable maxRows: number;

    constructor(catalogInfo: CatalogInfo, catalogHeader: Array<CARTA.CatalogHeader>, catalogData: Map<number, ProcessedColumnData>, catalogType: CatalogType = CatalogType.FILE) {
        super(catalogType, catalogData);
        this.catalogInfo = catalogInfo;
        this.catalogHeader = catalogHeader.sort((a, b) => a.columnIndex - b.columnIndex);
        this.catalogControlHeader = this.initCatalogControlHeader;
        this.catalogFilterRequest = this.initCatalogFilterRequest;
        this.isUpdatingDataStream = false;
        this.updateMode = CatalogUpdateMode.TableUpdate;
        this.selectedPointIndices = [];
        this.filterDataSize = undefined;
        this.maxRows = catalogInfo.dataSize;
        const coordinateSystem = catalogInfo.fileInfo.coosys?.[0];
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
        const initTableRows = CatalogProfileStore.INIT_TABLE_ROWS;
        if (catalogInfo.dataSize < initTableRows) {
            this.numVisibleRows = catalogInfo.dataSize;
            this.subsetEndIndex = catalogInfo.dataSize;
        } else {
            this.numVisibleRows = initTableRows;
            this.subsetEndIndex = initTableRows;
        }
        makeObservable(this);
    }

    @action setUserFilter(catalogFilterRequest: CARTA.CatalogFilterRequest) {
        this.catalogFilterRequest = catalogFilterRequest;
    }

    @action setCatalogHeader(catalogHeader: Array<CARTA.CatalogHeader>) {
        this.catalogHeader = catalogHeader;
    }

    private static fillAllocatedArray<T>(existingArray: Array<T>, newArray: Array<T>, insertionIndex: number, allocationSize: number): Array<T> {
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

    @action updateCatalogData(catalogFilter: CARTA.CatalogFilterResponse, catalogData: Map<number, ProcessedColumnData>) {
        const subsetDataSize = catalogFilter.subsetDataSize;
        const subsetEndIndex = catalogFilter.subsetEndIndex;
        const startIndex = subsetEndIndex - subsetDataSize;

        const totalDataSize = catalogFilter.requestEndIndex;
        this.filterDataSize = catalogFilter.filterDataSize;

        if (this.subsetEndIndex <= this.filterDataSize) {
            const numVisibleRows = this.isUpdateColumnMode ? this.numVisibleRows : this.numVisibleRows + subsetDataSize;
            catalogData.forEach((newData, key) => {
                const currentData = this.catalogData.get(key);
                if (!currentData) {
                    this.catalogData.set(key, newData);
                } else {
                    if (currentData.dataType === CARTA.ColumnType.String) {
                        const currentArr = currentData.data as Array<string>;
                        const newArr = newData.data as Array<string>;
                        currentData.data = CatalogProfileStore.fillAllocatedArray<string>(currentArr, newArr, startIndex, totalDataSize);
                    } else if (currentData.dataType === CARTA.ColumnType.Bool) {
                        const currentArr = currentData.data as Array<boolean>;
                        const newArr = newData.data as Array<boolean>;
                        currentData.data = CatalogProfileStore.fillAllocatedArray<boolean>(currentArr, newArr, startIndex, totalDataSize);
                    } else if (currentData.dataType === CARTA.ColumnType.UnsupportedType) {
                        return;
                    } else {
                        const currentArr = currentData.data as Array<number>;
                        const newArr = newData.data as Array<number>;
                        currentData.data = CatalogProfileStore.fillAllocatedArray<number>(currentArr, newArr, startIndex, totalDataSize);
                    }
                }
            });
            this.setNumVisibleRows(numVisibleRows);
            this.subsetEndIndex = subsetEndIndex;
        }

        // Reset column update mode flag after processing the filter response
        if (this.isUpdateColumnMode) {
            this.setIsUpdateColumn(false);
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
        this.isLoadingData = false;
        this.catalogFilterRequest = this.initCatalogFilterRequest;
        this.isUpdatingDataStream = false;
        this.sortingInfo.columnName = null;
        this.sortingInfo.sortingType = null;
        this.maxRows = this.catalogInfo.dataSize;
    };

    @action resetFilterRequest() {
        if (!this.isUpdateColumnMode) {
            this.setUpdateMode(CatalogUpdateMode.TableUpdate);
            this.clearData();
            this.setNumVisibleRows(0);
            this.setSubsetEndIndex(0);
        }
        this.setLoadingDataStatus(true);
    }

    @action setSortingInfo(columnName: string, sortingType: CARTA.SortingType | null) {
        this.sortingInfo = {columnName, sortingType};
    }

    @computed get isLoadingOntoImage() {
        return this.isLoadingData || this.isUpdatingDataStream;
    }

    @computed get initCatalogControlHeader() {
        const controlHeaders = new Map<string, ControlHeader>();
        const catalogHeader = this.catalogHeader;

        if (catalogHeader.length) {
            // Which columns land in the first N is an accident of their order in the file, so the
            // ones the image overlay is going to need are displayed alongside them. Their values
            // then arrive with the first data request, which is what lets a string coordinate
            // column that declares no units be recognized at all.
            const coordinateColumnNames = this.initialCoordinateColumnNames;
            for (let index = 0; index < catalogHeader.length; index++) {
                const header = catalogHeader[index];
                const shouldDisplay = index < PreferenceStore.Instance.catalogDisplayedColumnSize || coordinateColumnNames.has(header.name);
                const controlHeader: ControlHeader = {columnIndex: header.columnIndex, dataIndex: index, display: shouldDisplay, filter: "", columnWidth: null};
                controlHeaders.set(header.name, controlHeader);
            }
        }
        return controlHeaders;
    }

    /**
     * The best-named candidate for each of the image overlay axes this catalog's coordinate system
     * uses. Names only nominate here: whether a column is actually usable is still decided from its
     * units or its values, once there are values to look at.
     */
    @computed private get initialCoordinateColumnNames(): Set<string> {
        const system = AbstractCatalogProfileStore.getCatalogSystem(this.catalogInfo.fileInfo.coosys?.[0]?.system);
        const axes = this.systemCoordinateMap.get(system);
        if (!axes) {
            return new Set<string>();
        }

        // A column that could never hold a number is not worth a slot, however it is named.
        const candidates = this.catalogHeader.filter(header => getCatalogAxisEligibility(header.dataType, header.units).status !== CatalogAxisEligibility.Ineligible).map(header => header.name);

        const nominated = [getAutoSelectedCatalogAxisColumn(axes.x, candidates, system), getAutoSelectedCatalogAxisColumn(axes.y, candidates, system)];
        return new Set<string>(nominated.filter((name): name is string => name !== undefined));
    }

    @action setMaxRows(maxRows: number) {
        this.updateTableStatus(true);
        this.maxRows = maxRows;
    }

    @computed get initCatalogFilterRequest(): CARTA.CatalogFilterRequest.$Properties {
        const catalogFilter: CARTA.CatalogFilterRequest.$Properties = new CARTA.CatalogFilterRequest();
        const imageBounds: CARTA.CatalogImageBounds = new CARTA.CatalogImageBounds();
        let previewDatasize = CatalogProfileStore.INIT_TABLE_ROWS;
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
        if (this.maxRows <= this.numVisibleRows || this.isUpdateColumnMode) {
            this.catalogFilterRequest.subsetStartIndex = 0;
            this.catalogFilterRequest.subsetDataSize = this.isUpdateColumnMode ? this.subsetEndIndex : this.maxRows;
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
        if (this.filterDataSize !== undefined && isFinite(this.filterDataSize)) {
            return this.subsetEndIndex < this.filterDataSize && this.subsetEndIndex < this.maxRows;
        } else {
            return this.subsetEndIndex < this.catalogInfo.dataSize && this.subsetEndIndex < this.maxRows;
        }
    }

    @computed get columnIndices(): Array<number> {
        const indices: number[] = [];
        this.catalogControlHeader.forEach((value, key) => {
            if (value.display && value.columnIndex !== undefined) {
                indices.push(value.columnIndex);
            }
        });
        return indices;
    }
}
