import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {CatalogUpdateMode} from "enums";
import {type ProcessedColumnData, ProtobufProcessing} from "utilities";

import {type CatalogActiveQuery, type CatalogOverlayAxes, type CatalogRowFilters, type CatalogRowRestore, type CatalogRowSource} from "./CatalogRowSource";

const NO_FILTERS: CatalogRowFilters = {texts: new Map(), configs: []};

/**
 * The rows of a catalog read from a file, which stay with the backend and stream in a chunk at a
 * time. Filtering and sorting are the backend's, so changing either drops the rows held and asks
 * for them again.
 */
export class StreamingRowSource implements CatalogRowSource {
    /** The rows a catalog shows before any are asked for, and the size of each chunk after. */
    public static readonly INIT_TABLE_ROWS = 50;
    private static readonly DataChunkSize = 50;

    /**
     * Shallow so that replacing a column marks the data as changed. Rows stream in a chunk at a
     * time, and anything computed from a column has to see them; the column arrays themselves stay
     * plain, since they can hold millions of values.
     */
    @observable.shallow private rows: Map<number, ProcessedColumnData>;
    /** Changes when a column object is updated without changing the shallow map itself. */
    @observable private dataVersion = 0;
    @observable visibleRowCount: number;
    /** How many rows of the Active Query's result have been loaded, which the next chunk starts from. */
    @observable loadedRowCount: number;
    /** How many rows pass the Active Query, once the backend has said. */
    @observable filteredRowCount: number | undefined = undefined;
    @observable progress: number | undefined = undefined;
    @observable rowLimit: number;
    @observable mode: CatalogUpdateMode = CatalogUpdateMode.TableUpdate;
    @observable isLoading = false;
    @observable isStreaming = false;
    @observable isFetchingColumns = false;
    @observable.ref activeQuery: CatalogActiveQuery = {filters: NO_FILTERS, sortColumn: null, sortingType: null, overlayAxes: undefined};
    /** The columns a request asks for when it is not given its own. */
    private columnIndices: number[];

    constructor(
        private readonly fileId: number,
        private readonly dataSize: number,
        preview: Map<number, ProcessedColumnData>,
        columnIndices: number[]
    ) {
        this.rows = preview;
        this.columnIndices = columnIndices;
        this.rowLimit = dataSize;
        this.visibleRowCount = this.loadedRowCount = Math.min(dataSize, StreamingRowSource.INIT_TABLE_ROWS);
        makeObservable(this);
    }

    get data(): Map<number, ProcessedColumnData> {
        void this.dataVersion;
        return this.rows;
    }

    get originalData(): Map<number, ProcessedColumnData> {
        return this.data;
    }

    @computed get canLoadMore(): boolean {
        const available = this.filteredRowCount !== undefined && isFinite(this.filteredRowCount) ? this.filteredRowCount : this.dataSize;
        return this.loadedRowCount < available && this.loadedRowCount < this.rowLimit;
    }

    get tableOrder(): undefined {
        return undefined;
    }

    getSortedIndices(tableRows: number[]): number[] {
        return tableRows;
    }

    getOriginIndices(dataRows: number[]): number[] {
        return dataRows;
    }

    @computed get isLoadingForOverlay(): boolean {
        return !this.isFetchingColumns && this.mode === CatalogUpdateMode.ViewUpdate;
    }

    @action setRowLimit(rowLimit: number) {
        this.rowLimit = rowLimit;
    }

    @action setColumns(columnIndices: number[]) {
        this.columnIndices = columnIndices;
    }

    @action setActiveQuery(filters: CatalogRowFilters, sortColumn: string | null, sortingType: CARTA.SortingType | null, columnIndices: number[]) {
        this.activeQuery = {...this.activeQuery, filters, sortColumn, sortingType};
        this.columnIndices = columnIndices;
    }

    @action applyFilters(filters: CatalogRowFilters, overlayAxes: CatalogOverlayAxes, columnIndices: number[]): CARTA.CatalogFilterRequest {
        this.activeQuery = {...this.activeQuery, filters, overlayAxes};
        this.dropRows();
        this.columnIndices = columnIndices;
        return this.buildRequest(this.nextRange());
    }

    @action fetchColumns(filters: CatalogRowFilters, overlayAxes: CatalogOverlayAxes, columnIndices: number[]): CARTA.CatalogFilterRequest {
        this.mode = CatalogUpdateMode.TableUpdate;
        this.isFetchingColumns = true;
        return this.applyFilters(filters, overlayAxes, columnIndices);
    }

    @action sortBy(columnName: string | null, sortingType: CARTA.SortingType | null): CARTA.CatalogFilterRequest {
        this.activeQuery = {...this.activeQuery, sortColumn: columnName, sortingType};
        this.dropRows();
        return this.buildRequest(this.nextRange());
    }

    @action loadMore(columnIndices: number[]): CARTA.CatalogFilterRequest | undefined {
        if (this.isLoading || this.mode !== CatalogUpdateMode.TableUpdate || !this.canLoadMore) {
            return undefined;
        }
        const range = this.nextRange();
        this.columnIndices = columnIndices;
        this.isLoading = true;
        return this.buildRequest(range);
    }

    @action loadForPlot(): CARTA.CatalogFilterRequest | undefined {
        if (!this.canLoadMore) {
            return undefined;
        }
        this.mode = CatalogUpdateMode.PlotsUpdate;
        this.isStreaming = true;
        return this.buildRequest(this.nextRange());
    }

    @action loadForOverlay(): CARTA.CatalogFilterRequest | undefined {
        this.mode = CatalogUpdateMode.ViewUpdate;
        if (!this.canLoadMore) {
            return undefined;
        }
        this.isStreaming = true;
        return this.buildRequest(this.nextRange());
    }

    @action restore({filterConfigs, columnIndices, minRows, isForOverlay}: CatalogRowRestore): CARTA.CatalogFilterRequest {
        this.dropRows();
        this.mode = isForOverlay ? CatalogUpdateMode.ViewUpdate : CatalogUpdateMode.TableUpdate;
        const range = this.nextRange();
        this.activeQuery = {...this.activeQuery, filters: {...this.activeQuery.filters, configs: filterConfigs}};
        this.columnIndices = columnIndices;
        this.isStreaming = true;
        return this.buildRequest({start: range.start, size: Math.max(range.size, minRows)});
    }

    @action reset(columnIndices: number[]): CARTA.CatalogFilterRequest {
        this.dropRows();
        this.filteredRowCount = undefined;
        this.isLoading = false;
        this.isStreaming = false;
        this.activeQuery = {filters: NO_FILTERS, sortColumn: null, sortingType: null, overlayAxes: undefined};
        this.columnIndices = columnIndices;
        // The first rows are sized by the row limit being reset, not the one it is reset to.
        const request = this.buildRequest({start: 0, size: Math.min(StreamingRowSource.INIT_TABLE_ROWS, this.rowLimit, this.dataSize)});
        this.rowLimit = this.dataSize;
        return request;
    }

    @action accept(response: CARTA.CatalogFilterResponse): Map<number, ProcessedColumnData> {
        const chunk = ProtobufProcessing.processCatalogData(response.columns);
        const chunkSize = response.subsetDataSize;
        const startIndex = response.subsetEndIndex - chunkSize;
        const allocationSize = response.requestEndIndex;
        this.filteredRowCount = response.filterDataSize;

        if (this.loadedRowCount <= this.filteredRowCount) {
            const visibleRowCount = this.isFetchingColumns ? this.visibleRowCount : Math.min(this.rowLimit, this.visibleRowCount + chunkSize);
            chunk.forEach((newColumn, key) => {
                const column = this.rows.get(key);
                if (!column) {
                    this.rows.set(key, newColumn);
                } else if (column.dataType !== CARTA.ColumnType.UnsupportedType) {
                    this.rows.set(key, {...column, data: StreamingRowSource.fillAllocatedArray(column.data as Array<unknown>, newColumn.data as Array<unknown>, startIndex, allocationSize) as ProcessedColumnData["data"]});
                }
            });
            this.visibleRowCount = visibleRowCount;
            this.loadedRowCount = response.subsetEndIndex;
        }
        this.dataVersion++;

        // A column fetch lasts until its final response, whichever request that answers.
        if (this.isFetchingColumns && response.progress >= 1) {
            this.isFetchingColumns = false;
        }
        this.progress = response.progress;
        if (response.progress === 1) {
            this.isLoading = false;
            this.isStreaming = false;
        }
        return chunk;
    }

    @action abandon() {
        this.isLoading = false;
        this.isStreaming = false;
    }

    /** Clear the rows held for a new query, unless the rows on their way only add columns to them. */
    private dropRows() {
        if (!this.isFetchingColumns) {
            this.mode = CatalogUpdateMode.TableUpdate;
            this.rows.clear();
            this.visibleRowCount = 0;
            this.loadedRowCount = 0;
        }
        this.isLoading = true;
    }

    /** Where the next request starts and how many rows it asks for, from the rows held and what they are wanted for. */
    private nextRange(): {start: number; size: number} {
        if (this.rowLimit <= this.visibleRowCount || this.isFetchingColumns) {
            return {start: 0, size: this.isFetchingColumns ? this.loadedRowCount : this.rowLimit};
        }
        const remaining = this.rowLimit - this.visibleRowCount;
        if (this.mode === CatalogUpdateMode.TableUpdate) {
            return {start: this.loadedRowCount, size: remaining < StreamingRowSource.DataChunkSize && remaining > 0 ? remaining : StreamingRowSource.DataChunkSize};
        }
        return {start: this.loadedRowCount, size: remaining};
    }

    private buildRequest({start, size}: {start: number; size: number}): CARTA.CatalogFilterRequest {
        const {filters, sortColumn, sortingType, overlayAxes} = this.activeQuery;
        return new CARTA.CatalogFilterRequest({
            fileId: this.fileId,
            filterConfigs: filters.configs,
            columnIndices: this.columnIndices,
            subsetStartIndex: start,
            subsetDataSize: size,
            imageBounds: new CARTA.CatalogImageBounds(overlayAxes),
            sortColumn,
            sortingType
        });
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
}
