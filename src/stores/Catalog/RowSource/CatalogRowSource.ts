import {type CARTA} from "carta-protobuf";

import {type CatalogUpdateMode} from "enums";
import {type ProcessedColumnData} from "utilities";

/** The filters a catalog's rows are asked for with, as the table showed them and as they are sent. */
export interface CatalogRowFilters {
    /** Each column's filter text, by column name. */
    texts: ReadonlyMap<string, string>;
    configs: CARTA.FilterConfig[];
}

/** The overlay axes a filter is applied with. The backend does not read them. */
export interface CatalogOverlayAxes {
    xColumnName: string;
    yColumnName: string;
}

/**
 * The filters and sort order a catalog's rows currently reflect. Filter text still being edited in
 * the table is not part of it.
 */
export interface CatalogActiveQuery {
    readonly filters: CatalogRowFilters;
    readonly sortColumn: string | null;
    readonly sortingType: CARTA.SortingType | null;
    readonly overlayAxes: CatalogOverlayAxes | undefined;
}

/** The Active Query of a catalog whose rows no filter or sort has been applied to. */
export const NO_ACTIVE_QUERY: CatalogActiveQuery = {filters: {texts: new Map(), configs: []}, sortColumn: null, sortingType: null, overlayAxes: undefined};

/** How far a restore has to reach, beyond the rows a table would show on its own. */
export interface CatalogRowRestore {
    /** The columns to ask for, including any the table does not show. */
    columnIndices: number[];
    /** The fewest rows to ask for. */
    minRows: number;
    /** Whether the rows are to be drawn over an image as well as shown in the table. */
    isForOverlay: boolean;
}

/**
 * A catalog's rows: what it holds, what it was asked for with, and the request to send to get more.
 *
 * Each method that changes which rows are wanted returns the request to send, or undefined when
 * there is nothing to ask the backend for. The source does not send it. What the rows are being
 * loaded for is kept here, set by the method called, and decides how the next request is sized and
 * how its response is taken.
 */
export interface CatalogRowSource {
    /** The rows the table shows, by column index. */
    readonly data: Map<number, ProcessedColumnData>;
    /** Every row held, before any filter is applied here. */
    readonly originalData: Map<number, ProcessedColumnData>;
    /** How many rows the table shows. */
    readonly visibleRowCount: number;
    /** How many rows pass the Active Query, once the backend has said. */
    readonly filteredRowCount: number | undefined;
    /** How many rows there are to look among: those known to pass the Active Query, or every row until that is known. */
    readonly matchingRowCount: number;
    /** How far the rows on their way have got, from 0 to 1, once any have arrived. */
    readonly progress: number | undefined;
    /** The most rows the table is to show. */
    readonly rowLimit: number;
    /** Whether rows that pass the Active Query are still to be loaded. */
    readonly canLoadMore: boolean;
    /** Whether rows for the table are on their way. */
    readonly isLoading: boolean;
    /** Whether rows for an overlay, a plot or a restore are on their way. */
    readonly isStreaming: boolean;
    /** What rows were last asked for, which a new chunk and a selection's pan and zoom follow. */
    readonly mode: CatalogUpdateMode;
    /** Whether the rows on their way only add columns to the rows the table already shows. */
    readonly isFetchingColumns: boolean;
    /** Whether the rows on their way are to be drawn over an image. */
    readonly isLoadingForOverlay: boolean;
    readonly activeQuery: CatalogActiveQuery;
    /**
     * The order the table shows rows in, as indices into {@link data}, when the rows are sorted
     * here. Undefined when they arrive in the order they are shown.
     */
    readonly tableOrder: number[] | undefined;

    /** The rows of {@link data} that these table rows show. */
    getSortedIndices(tableRows: number[]): number[];
    /** The table rows that show these rows of {@link data}. */
    getOriginIndices(dataRows: number[]): number[];

    setRowLimit(rowLimit: number): void;
    /** Set the columns later requests ask for, until one is given its own. */
    setColumns(columnIndices: number[]): void;
    /** Take a saved table's filters, sort and columns as the Active Query, asking for nothing. */
    setActiveQuery(filters: CatalogRowFilters, sortColumn: string | null, sortingType: CARTA.SortingType | null, columnIndices: number[]): void;

    /** Drop the rows held and ask for the first rows that pass these filters. */
    applyFilters(filters: CatalogRowFilters, overlayAxes: CatalogOverlayAxes, columnIndices: number[]): CARTA.CatalogFilterRequest | undefined;
    /** Ask again for every row the table shows, with these columns, keeping the rows shown. */
    fetchColumns(filters: CatalogRowFilters, overlayAxes: CatalogOverlayAxes, columnIndices: number[]): CARTA.CatalogFilterRequest | undefined;
    /** Drop the rows held and ask for the first rows in this order. */
    sortBy(columnName: string | null, sortingType: CARTA.SortingType | null): CARTA.CatalogFilterRequest | undefined;
    /** Ask for the next chunk of the table, unless a chunk is on its way or other rows were last asked for. */
    loadMore(columnIndices: number[]): CARTA.CatalogFilterRequest | undefined;
    /** Ask for every row up to the row limit, for a plot. */
    loadForPlot(): CARTA.CatalogFilterRequest | undefined;
    /**
     * Ask for every row up to the row limit, to draw over an image: those not held yet, or, from
     * the first row, every one when the rows held lack a column the overlay maps.
     */
    loadForOverlay(shouldStartFromFirstRow?: boolean): CARTA.CatalogFilterRequest | undefined;
    /** Drop the rows held and ask again, with the Active Query, for the rows a saved catalog had. */
    restore(restore: CatalogRowRestore): CARTA.CatalogFilterRequest | undefined;
    /** Drop the Active Query and the row limit, and ask for the first rows. */
    reset(columnIndices: number[]): CARTA.CatalogFilterRequest | undefined;

    /** Take in one response to the latest request. */
    accept(response: CARTA.CatalogFilterResponse): Map<number, ProcessedColumnData>;
    /** Stop waiting for rows that are not coming. */
    abandon(): void;
}
