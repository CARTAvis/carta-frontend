import {CARTA} from "carta-protobuf";
import {action, makeObservable, observable} from "mobx";

import {CatalogUpdateMode} from "enums";
import {type ControlHeader} from "stores";
import {filterProcessedColumnData, getInitIndexMap, getSortedIndexMap, type ProcessedColumnData} from "utilities";

import {type CatalogActiveQuery, type CatalogRowFilters, type CatalogRowSource, NO_ACTIVE_QUERY} from "./CatalogRowSource";

/** What an in-memory source reads from the catalog's table to filter and sort its rows. */
export interface InMemoryRowTable {
    readonly catalogControlHeader: Map<string, ControlHeader>;
    /** Whether any filter text in the table would filter rows. */
    readonly hasFilter: boolean;
}

/**
 * The rows of a catalog from an online query, all held here since the query returned them.
 * Filtering and sorting happen here too, so nothing is asked of the backend.
 */
export class InMemoryRowSource implements CatalogRowSource {
    @observable.shallow private rows: Map<number, ProcessedColumnData>;
    @observable visibleRowCount: number;
    /** The rows that pass the Active Query's filters, as indices into every row held. */
    @observable filterIndexMap: number[];
    /** The order the table shows the rows that pass in, as indices into them. */
    @observable sortedIndexMap: number[];
    @observable mode: CatalogUpdateMode = CatalogUpdateMode.TableUpdate;
    @observable.ref activeQuery: CatalogActiveQuery = NO_ACTIVE_QUERY;

    readonly filteredRowCount = undefined;
    readonly progress = undefined;
    readonly isLoading = false;
    readonly isStreaming = false;
    readonly isFetchingColumns = false;
    readonly canLoadMore = false;

    constructor(
        private readonly dataSize: number,
        data: Map<number, ProcessedColumnData>,
        private readonly table: InMemoryRowTable
    ) {
        this.rows = data;
        this.visibleRowCount = dataSize;
        this.sortedIndexMap = getInitIndexMap(this.visibleRowCount);
        this.filterIndexMap = getInitIndexMap(dataSize);
        makeObservable(this);
    }

    /** The rows that pass the Active Query's filters. */
    get data(): Map<number, ProcessedColumnData> {
        if (this.filterIndexMap.length !== this.dataSize) {
            const filteredData = new Map<number, ProcessedColumnData>();
            this.rows.forEach((columnData, i) => {
                filteredData.set(i, filterProcessedColumnData(columnData, this.filterIndexMap));
            });
            return filteredData;
        }
        return this.rows;
    }

    get originalData(): Map<number, ProcessedColumnData> {
        return this.rows;
    }

    /** Every row is held, so the table can show as many as it is told to. */
    get rowLimit(): number {
        return this.visibleRowCount;
    }

    get matchingRowCount(): number {
        return this.visibleRowCount;
    }

    get isLoadingForOverlay(): boolean {
        return this.mode === CatalogUpdateMode.ViewUpdate;
    }

    get tableOrder(): number[] {
        return this.sortedIndexMap;
    }

    getSortedIndices(tableRows: number[]): number[] {
        if (!this.sortedIndexMap.length || !tableRows.length) {
            return tableRows;
        }
        return tableRows.map(i => this.sortedIndexMap[i]);
    }

    getOriginIndices(dataRows: number[]): number[] {
        if (!this.sortedIndexMap.length || !dataRows.length) {
            return dataRows;
        }
        const indices = new Array<number>(dataRows.length);
        dataRows.forEach((i, index) => {
            const j = this.sortedIndexMap.indexOf(i);
            if (j > -1) {
                indices[index] = j;
            }
        });
        return indices;
    }

    @action setRowLimit(rowLimit: number) {
        this.visibleRowCount = rowLimit;
    }

    setColumns() {
        // Every column is held already.
    }

    @action setActiveQuery(filters: CatalogRowFilters, sortColumn: string | null, sortingType: CARTA.SortingType | null) {
        this.sortBy(sortColumn, sortingType);
        this.applyFilters(filters);
    }

    @action applyFilters(filters: CatalogRowFilters): undefined {
        this.activeQuery = {...this.activeQuery, filters};
        this.filterRows(filters.configs);
        return undefined;
    }

    fetchColumns(): undefined {
        // Every column is held already.
        return undefined;
    }

    @action sortBy(columnName: string | null, sortingType: CARTA.SortingType | null): undefined {
        this.activeQuery = {...this.activeQuery, sortColumn: columnName, sortingType};
        this.sortRows();
        return undefined;
    }

    loadMore(): undefined {
        return undefined;
    }

    loadForPlot(): undefined {
        return undefined;
    }

    @action loadForOverlay(): undefined {
        this.mode = CatalogUpdateMode.ViewUpdate;
        return undefined;
    }

    @action reset(): undefined {
        this.visibleRowCount = this.dataSize;
        this.sortedIndexMap = getInitIndexMap(this.visibleRowCount);
        this.filterIndexMap = getInitIndexMap(this.dataSize);
        this.activeQuery = NO_ACTIVE_QUERY;
        return undefined;
    }

    accept(): Map<number, ProcessedColumnData> {
        return new Map();
    }

    abandon() {
        // Nothing is ever on its way.
    }

    /** Keep the rows that pass every filter, and sort them again. */
    private filterRows(filterConfigs: CARTA.FilterConfig[]) {
        this.filterIndexMap = getInitIndexMap(this.dataSize);
        filterConfigs.forEach(filterConfig => {
            const header = this.table.catalogControlHeader.get(filterConfig.columnName);
            const dataIndex = header?.dataIndex;
            if (dataIndex === undefined || dataIndex <= -1 || !header?.display) {
                return;
            }
            const column = this.rows.get(dataIndex);
            if (column?.dataType === CARTA.ColumnType.String) {
                const values = column.data as string[];
                if (filterConfig.subString !== "") {
                    this.filterIndexMap = this.filterIndexMap.filter(i => values[i]?.includes(filterConfig.subString));
                }
            } else {
                this.filterIndexMap = this.filterNumbers(column?.data as [], filterConfig);
            }
        });
        this.visibleRowCount = this.filterIndexMap.length;
        if (this.activeQuery.sortColumn !== null && this.activeQuery.sortingType !== null) {
            this.sortRows();
        }
    }

    private sortRows() {
        const {sortColumn, sortingType} = this.activeQuery;
        this.sortedIndexMap = getSortedIndexMap(this.table.catalogControlHeader, {columnName: sortColumn, sortingType}, this.sortedIndexMap, this.table.hasFilter, this.visibleRowCount, this.data);
    }

    private filterNumbers(values: [], filterConfig: CARTA.FilterConfig): number[] {
        const {value, secondaryValue} = filterConfig;
        switch (filterConfig.comparisonOperator) {
            case CARTA.ComparisonOperator.Equal:
                return this.filterIndexMap.filter(i => values[i] === value);
            case CARTA.ComparisonOperator.NotEqual:
                return this.filterIndexMap.filter(i => values[i] !== value);
            case CARTA.ComparisonOperator.Lesser:
                return this.filterIndexMap.filter(i => values[i] < value);
            case CARTA.ComparisonOperator.LessorOrEqual:
                return this.filterIndexMap.filter(i => values[i] <= value);
            case CARTA.ComparisonOperator.Greater:
                return this.filterIndexMap.filter(i => values[i] > value);
            case CARTA.ComparisonOperator.GreaterOrEqual:
                return this.filterIndexMap.filter(i => values[i] >= value);
            case CARTA.ComparisonOperator.RangeOpen:
                return this.filterIndexMap.filter(i => values[i] > value && values[i] < secondaryValue);
            case CARTA.ComparisonOperator.RangeClosed:
                return this.filterIndexMap.filter(i => values[i] >= value && values[i] <= secondaryValue);
            default:
                return [];
        }
    }
}
