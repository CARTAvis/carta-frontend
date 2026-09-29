import {CARTA} from "carta-protobuf";

import {CatalogUpdateMode} from "enums";
import {type CatalogRowFilters, StreamingRowSource} from "stores";
import {type ProcessedColumnData} from "utilities";

const FILE_ID = 7;
const DATA_SIZE = 200;
const COLUMNS = [0, 1, 2];
const FLUX_ABOVE_ONE: CatalogRowFilters = {texts: new Map([["FLUX", "> 1"]]), configs: [new CARTA.FilterConfig({columnName: "FLUX", comparisonOperator: CARTA.ComparisonOperator.Greater, value: 1})]};
const NO_FILTERS: CatalogRowFilters = {texts: new Map(), configs: []};
const AXES = {xColumnName: "RA", yColumnName: "DEC"};

/** The value row `row` of column `column` holds, so where a value lands says which row it came from. */
const ValueAt = (row: number, column: number) => row * 10 + column;

/** A file catalog's rows as it opens: the first 50 of each column. */
function openSource(dataSize = DATA_SIZE): StreamingRowSource {
    const preview = new Map<number, ProcessedColumnData>(COLUMNS.map(column => [column, {dataType: CARTA.ColumnType.Double, data: Array.from({length: Math.min(dataSize, 50)}, (_, row) => ValueAt(row, column))}]));
    return new StreamingRowSource(FILE_ID, dataSize, preview, COLUMNS);
}

/** A request as it goes over the wire. */
function wire(request: CARTA.CatalogFilterRequest | undefined) {
    return request && CARTA.CatalogFilterRequest.toObject(CARTA.CatalogFilterRequest.decode(CARTA.CatalogFilterRequest.encode(request).finish()));
}

/** Answer a request in one response, out of `filterDataSize` rows that pass its filter. */
function respond(source: StreamingRowSource, request: CARTA.CatalogFilterRequest | undefined, filterDataSize = DATA_SIZE) {
    const start = request?.subsetStartIndex ?? 0;
    const count = Math.max(0, Math.min(request?.subsetDataSize ?? 0, filterDataSize - start));
    const columns: {[column: number]: CARTA.ColumnData.$Properties} = {};
    for (const column of request?.columnIndices ?? []) {
        columns[column] = {dataType: CARTA.ColumnType.Double, binaryData: new Uint8Array(new Float64Array(Array.from({length: count}, (_, i) => ValueAt(start + i, column))).buffer)};
    }
    return source.accept(new CARTA.CatalogFilterResponse({fileId: FILE_ID, filterDataSize, requestEndIndex: start + count, subsetDataSize: count, subsetEndIndex: start + count, progress: 1, columns}));
}

/** The rows a column shows, first and last. */
function shownRows(source: StreamingRowSource, column: number) {
    const data = source.data.get(column)?.data as ArrayLike<number> | undefined;
    return source.visibleRowCount ? [data?.[0], data?.[source.visibleRowCount - 1]].map(value => (value === undefined ? undefined : (value - column) / 10)) : [];
}

describe("StreamingRowSource", () => {
    test("shows the preview it opened with, and asks for the next chunk from where it ends", () => {
        const source = openSource();
        expect(source.visibleRowCount).toBe(50);

        const request = source.loadMore(COLUMNS);

        expect(wire(request)).toEqual({fileId: FILE_ID, columnIndices: COLUMNS, subsetStartIndex: 50, subsetDataSize: 50, imageBounds: {}});
        expect(source.isLoading).toBe(true);
        expect(source.loadMore(COLUMNS)).toBeUndefined();

        respond(source, request);

        expect(source.isLoading).toBe(false);
        expect(shownRows(source, 1)).toEqual([0, 99]);
    });

    test("asks for no more rows than the row limit leaves", () => {
        const source = openSource();
        source.setRowLimit(60);

        expect(source.loadMore(COLUMNS)?.subsetDataSize).toBe(10);
    });

    test("asks for nothing once every row that passes the filter, or the row limit, is in", () => {
        const source = openSource();
        respond(source, source.applyFilters(FLUX_ABOVE_ONE, AXES, COLUMNS), 50);

        expect(source.canLoadMore).toBe(false);
        expect(source.loadMore(COLUMNS)).toBeUndefined();
        expect(source.loadForPlot()).toBeUndefined();
    });

    test("drops its rows to apply filters, and keeps asking with them until they change", () => {
        const source = openSource();

        const applied = source.applyFilters(FLUX_ABOVE_ONE, AXES, COLUMNS);
        expect(source.visibleRowCount).toBe(0);
        expect(source.isLoading).toBe(true);
        respond(source, applied, 120);
        const sorted = source.sortBy("RA", CARTA.SortingType.Descending);
        respond(source, sorted, 120);
        const more = source.loadMore(COLUMNS);

        const withFilters = {fileId: FILE_ID, columnIndices: COLUMNS, subsetDataSize: 50, filterConfigs: [{columnName: "FLUX", comparisonOperator: CARTA.ComparisonOperator.Greater, value: 1}], imageBounds: AXES};
        expect([applied, sorted, more].map(wire)).toEqual([
            withFilters,
            {...withFilters, sortColumn: "RA", sortingType: CARTA.SortingType.Descending},
            {...withFilters, sortColumn: "RA", sortingType: CARTA.SortingType.Descending, subsetStartIndex: 50}
        ]);
        expect(source.activeQuery.filters.texts).toEqual(new Map([["FLUX", "> 1"]]));
    });

    test("fetches columns for every row loaded so far, keeping the rows shown", () => {
        const source = openSource();
        respond(source, source.loadMore(COLUMNS));

        const request = source.fetchColumns(FLUX_ABOVE_ONE, AXES, [0, 1, 2, 3]);
        expect(source.isFetchingColumns).toBe(true);
        expect(source.visibleRowCount).toBe(100);
        respond(source, request);

        expect(wire(request)).toMatchObject({columnIndices: [0, 1, 2, 3], subsetDataSize: 100});
        expect(wire(request)?.subsetStartIndex).toBeUndefined();
        expect(source.isFetchingColumns).toBe(false);
        expect(source.visibleRowCount).toBe(100);
        expect(shownRows(source, 3)).toEqual([0, 99]);
    });

    test("keeps fetching columns after a send that failed, until a final response comes", () => {
        const source = openSource();
        source.fetchColumns(NO_FILTERS, AXES, COLUMNS);

        source.abandon();

        expect(source.isLoading).toBe(false);
        expect(source.isFetchingColumns).toBe(true);
    });

    test.each([
        ["a plot", (source: StreamingRowSource) => source.loadForPlot(), CatalogUpdateMode.PlotsUpdate],
        ["an overlay", (source: StreamingRowSource) => source.loadForOverlay(), CatalogUpdateMode.ViewUpdate]
    ])("asks for every row up to the row limit for %s, and no table chunk after it", (_, load, mode) => {
        const source = openSource();

        const request = load(source);
        expect(source.isStreaming).toBe(true);
        expect(source.isLoading).toBe(false);
        respond(source, request);

        expect(wire(request)).toMatchObject({subsetStartIndex: 50, subsetDataSize: 150});
        expect(source.mode).toBe(mode);
        expect(source.isStreaming).toBe(false);
        expect(source.visibleRowCount).toBe(200);
    });

    test("marks rows as wanted for an overlay even when it holds them all", () => {
        const source = openSource(30);

        expect(source.loadForOverlay()).toBeUndefined();
        expect(source.mode).toBe(CatalogUpdateMode.ViewUpdate);
        expect(source.isLoadingForOverlay).toBe(true);
    });

    test("restores from the first row, asking for at least as many rows as it is told", () => {
        const source = openSource();
        source.setActiveQuery(FLUX_ABOVE_ONE, "RA", CARTA.SortingType.Descending, COLUMNS);

        const request = source.restore({filterConfigs: FLUX_ABOVE_ONE.configs, columnIndices: [0, 1, 2, 3], minRows: 120, isForOverlay: false});

        expect(wire(request)).toMatchObject({columnIndices: [0, 1, 2, 3], subsetDataSize: 120, sortColumn: "RA", filterConfigs: [{columnName: "FLUX"}]});
        expect(source.visibleRowCount).toBe(0);
        expect(source.isLoading && source.isStreaming).toBe(true);
        expect(source.isLoadingForOverlay).toBe(false);
        // Rows for an overlay are every row up to the row limit, which is more than that.
        expect(source.restore({filterConfigs: [], columnIndices: COLUMNS, minRows: 120, isForOverlay: true})?.subsetDataSize).toBe(DATA_SIZE);
    });

    test("resets to the first rows with nothing applied, sized by the row limit it had", () => {
        const source = openSource();
        respond(source, source.applyFilters(FLUX_ABOVE_ONE, AXES, COLUMNS), 120);
        source.setRowLimit(30);

        const request = source.reset(COLUMNS);

        expect(wire(request)).toEqual({fileId: FILE_ID, columnIndices: COLUMNS, subsetDataSize: 30, imageBounds: {}});
        expect(source.rowLimit).toBe(DATA_SIZE);
        expect(source.activeQuery).toEqual({filters: NO_FILTERS, sortColumn: null, sortingType: null, overlayAxes: undefined});
        expect(source.filteredRowCount).toBeUndefined();
        expect(source.isLoading).toBe(false);
    });

    test("places each chunk at the rows it holds", () => {
        const source = openSource();
        source.applyFilters(FLUX_ABOVE_ONE, AXES, COLUMNS);

        respond(source, {subsetStartIndex: 0, subsetDataSize: 50, columnIndices: COLUMNS} as CARTA.CatalogFilterRequest, 120);
        respond(source, {subsetStartIndex: 50, subsetDataSize: 50, columnIndices: COLUMNS} as CARTA.CatalogFilterRequest, 120);

        expect(source.loadedRowCount).toBe(100);
        expect(source.filteredRowCount).toBe(120);
        expect(shownRows(source, 2)).toEqual([0, 99]);
    });
});
