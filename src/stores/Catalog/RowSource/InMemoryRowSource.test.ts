import {CARTA} from "carta-protobuf";

import {CatalogUpdateMode} from "enums";
import {type CatalogRowFilters, type ControlHeader, InMemoryRowSource, type InMemoryRowTable} from "stores";
import {type ProcessedColumnData} from "utilities";

const NAMES = ["NAME", "FLUX", "MAG"];
const FLUX = [3, 1, 4, 1, 5];
const NAME = ["alpha", "beta", "gamma", "delta", "epsilon"];

/** A query's rows, with MAG hidden from the table. */
function openSource(): {source: InMemoryRowSource; table: InMemoryRowTable} {
    const catalogControlHeader = new Map<string, ControlHeader>(NAMES.map((name, index) => [name, {columnIndex: index, dataIndex: index, display: name !== "MAG", filter: "", columnWidth: null}]));
    const table = {catalogControlHeader, hasFilter: false};
    const data = new Map<number, ProcessedColumnData>([
        [0, {dataType: CARTA.ColumnType.String, data: NAME}],
        [1, {dataType: CARTA.ColumnType.Double, data: FLUX}],
        [2, {dataType: CARTA.ColumnType.Double, data: FLUX.map(flux => -flux)}]
    ]);
    return {source: new InMemoryRowSource(FLUX.length, data, table), table};
}

function filters(columnName: string, config: Partial<CARTA.FilterConfig.$Properties>, text = "?"): CatalogRowFilters {
    return {texts: new Map([[columnName, text]]), configs: [new CARTA.FilterConfig({columnName, ...config})]};
}

/** FLUX as the table shows it, row by row. */
function fluxShown(source: InMemoryRowSource): number[] {
    const flux = source.data.get(1)?.data as number[];
    return (source.tableOrder ?? []).slice(0, source.visibleRowCount).map(i => flux[i]);
}

describe("InMemoryRowSource", () => {
    test("shows every row it holds, and never asks the backend for any", () => {
        const {source} = openSource();

        expect(source.visibleRowCount).toBe(5);
        expect(source.rowLimit).toBe(5);
        expect(source.canLoadMore).toBe(false);
        expect([source.loadMore(), source.loadForPlot(), source.loadForOverlay(), source.restore(), source.sortBy("FLUX", CARTA.SortingType.Ascending), source.reset()]).toEqual([
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined
        ]);
        expect(source.isLoading || source.isStreaming).toBe(false);
    });

    test("keeps the rows that pass a filter", () => {
        const {source} = openSource();
        const aboveOne = filters("FLUX", {comparisonOperator: CARTA.ComparisonOperator.Greater, value: 1}, "> 1");

        expect(source.applyFilters(aboveOne)).toBeUndefined();

        expect(source.visibleRowCount).toBe(3);
        expect(source.filterIndexMap).toEqual([0, 2, 4]);
        expect(source.data.get(0)?.data).toEqual(["alpha", "gamma", "epsilon"]);
        expect(source.originalData.get(0)?.data).toBe(NAME);
        expect(source.activeQuery.filters).toBe(aboveOne);
    });

    test("filters text by what it contains", () => {
        const {source} = openSource();

        source.applyFilters(filters("NAME", {subString: "ta"}));

        expect(source.data.get(0)?.data).toEqual(["beta", "delta"]);
    });

    test("ignores a filter on a column the table hides", () => {
        const {source} = openSource();

        source.applyFilters(filters("MAG", {comparisonOperator: CARTA.ComparisonOperator.Lesser, value: -2}));

        expect(source.visibleRowCount).toBe(5);
    });

    test("sorts the rows that pass, and keeps sorting them as the filter changes", () => {
        const {source, table} = openSource();

        source.sortBy("FLUX", CARTA.SortingType.Descending);
        expect(fluxShown(source)).toEqual([5, 4, 3, 1, 1]);

        (table as {hasFilter: boolean}).hasFilter = true;
        source.applyFilters(filters("FLUX", {comparisonOperator: CARTA.ComparisonOperator.Greater, value: 1}));

        expect(fluxShown(source)).toEqual([5, 4, 3]);
        expect(source.activeQuery).toMatchObject({sortColumn: "FLUX", sortingType: CARTA.SortingType.Descending});
    });

    test("maps selected table rows to the rows they show, and back", () => {
        const {source} = openSource();
        source.sortBy("FLUX", CARTA.SortingType.Descending);

        expect(source.getSortedIndices([0, 1])).toEqual([4, 2]);
        expect(source.getOriginIndices([4, 2])).toEqual([0, 1]);
    });

    test("takes a saved query, sorting and filtering by it", () => {
        const {source, table} = openSource();
        // The saved filter text is in the table by then.
        (table as {hasFilter: boolean}).hasFilter = true;

        source.setActiveQuery(filters("FLUX", {comparisonOperator: CARTA.ComparisonOperator.Greater, value: 1}), "FLUX", CARTA.SortingType.Ascending);

        expect(fluxShown(source)).toEqual([3, 4, 5]);
    });

    test("resets to every row in its first order, with nothing applied", () => {
        const {source} = openSource();
        source.sortBy("FLUX", CARTA.SortingType.Descending);
        source.applyFilters(filters("FLUX", {comparisonOperator: CARTA.ComparisonOperator.Greater, value: 1}));

        source.reset();

        expect(fluxShown(source)).toEqual(FLUX);
        expect(source.activeQuery).toEqual({filters: {texts: new Map(), configs: []}, sortColumn: null, sortingType: null, overlayAxes: undefined});
    });

    test("marks rows as wanted for an overlay, and keeps them so", () => {
        const {source} = openSource();

        source.loadForOverlay();
        source.reset();

        expect(source.mode).toBe(CatalogUpdateMode.ViewUpdate);
        expect(source.isLoadingForOverlay).toBe(true);
    });

    test("shows as many rows as it is told to", () => {
        const {source} = openSource();

        source.setRowLimit(2);

        expect(source.visibleRowCount).toBe(2);
        expect(source.rowLimit).toBe(2);
    });
});
