import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogSystemType, CatalogType, ImageType, PreferenceKeys} from "enums";
import {AppStore, CatalogOnlineQueryProfileStore, CatalogProfileStore, CatalogStore, PreferenceStore} from "stores";
import {type ProcessedColumnData} from "utilities";

/*
 * What each catalog operation asks the backend for, and the rows the table ends up with.
 *
 * These record how catalog rows are requested and held as they are, so that reworking it can be
 * checked against them. A payload is read as it goes over the wire, when it is sent, so a later
 * request cannot change what an earlier one is recorded as. `tableOf` is the one place that knows
 * where a catalog keeps its rows.
 */

const CATALOG_FILE_ID = 40_001;
const IMAGE_FILE_ID = 10;
const DATA_SIZE = 200;
const COLUMN_NAMES = ["RA", "DEC", "FLUX", "MAG"];
const CATALOG_HEADER = COLUMN_NAMES.map((name, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: CARTA.ColumnType.Double, name, units: index < 2 ? "deg" : ""}));
const IMAGE = {frameInfo: {fileId: IMAGE_FILE_ID, fileInfo: {}}, restFreqStore: {customRestFreq: {}}, isValidWcs: false, wcsInfo: 0};

/** The value a fake backend gives row `row` of column `column`, so where a value lands says which row it came from. */
const ValueAt = (row: number, column: number) => row * 10 + column;

let sent: {requestId: number; payload: CARTA.CatalogFilterRequest.$Properties}[];
let sendFilter: jest.SpyInstance;
let shouldAutoSelectOriginally: boolean;
let displayedColumnSizeOriginally: number;

beforeAll(() => {
    shouldAutoSelectOriginally = PreferenceStore.Instance.shouldAutoSelectImageOverlayCoordinateColumns;
    displayedColumnSizeOriginally = PreferenceStore.Instance.catalogDisplayedColumnSize;
    PreferenceStore.Instance.setPreference(PreferenceKeys.CATALOG_AUTO_SELECT_IMAGE_OVERLAY_COLUMNS, false);
    // RA, DEC and FLUX are shown to begin with; MAG is not.
    PreferenceStore.Instance.setPreference(PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE, 3);
});

afterAll(() => {
    PreferenceStore.Instance.setPreference(PreferenceKeys.CATALOG_AUTO_SELECT_IMAGE_OVERLAY_COLUMNS, shouldAutoSelectOriginally);
    PreferenceStore.Instance.setPreference(PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE, displayedColumnSizeOriginally);
});

beforeEach(() => {
    jest.restoreAllMocks();
    CatalogStore.Instance.resetRequests("test setup");
    CatalogStore.Instance.catalogProfileStores.clear();
    CatalogStore.Instance.catalogImageIds.clear();
    CatalogStore.Instance.catalogDisplayStores.forEach(displayStore => displayStore.dispose());
    CatalogStore.Instance.catalogDisplayStores.clear();
    AppStore.Instance.setActiveImage({type: ImageType.FRAME, store: IMAGE} as any);
    jest.spyOn(AppStore.Instance, "getFrame").mockImplementation(fileId => (fileId === IMAGE_FILE_ID ? IMAGE : undefined) as any);
    jest.spyOn(CatalogStore.Instance, "convertToImageCoordinate").mockImplementation(jest.fn());

    sent = [];
    let nextRequestId = 100;
    sendFilter = jest.spyOn(AppStore.Instance.backendService, "setCatalogFilterRequest").mockImplementation(filter => {
        const wire = CARTA.CatalogFilterRequest.encode(filter).finish();
        const requestId = nextRequestId++;
        sent.push({requestId, payload: CARTA.CatalogFilterRequest.toObject(CARTA.CatalogFilterRequest.decode(wire)) as CARTA.CatalogFilterRequest.$Properties});
        return requestId;
    });
});

afterEach(() => {
    CatalogStore.Instance.resetRequests("test cleanup");
    CatalogStore.Instance.catalogImageIds.clear();
    AppStore.Instance.setActiveImage(null);
});

/** A file catalog as it is once opened: its first 50 rows of every column, as the backend previews them. */
function openFileCatalog(): CatalogProfileStore {
    const preview = new Map<number, ProcessedColumnData>(COLUMN_NAMES.map((_, column) => [column, {dataType: CARTA.ColumnType.Double, data: Array.from({length: 50}, (_, row) => ValueAt(row, column))}]));
    const profileStore = new CatalogProfileStore({dataSize: DATA_SIZE, directory: "", fileId: CATALOG_FILE_ID, fileInfo: new CARTA.CatalogFileInfo({name: "sources.vot"})}, CATALOG_HEADER, preview, CatalogType.FILE);
    CatalogStore.Instance.catalogProfileStores.set(CATALOG_FILE_ID, profileStore);
    CatalogStore.Instance.catalogImageIds.set(CATALOG_FILE_ID, IMAGE_FILE_ID);
    CatalogStore.Instance.getOrCreateCatalogDisplayStore(CATALOG_FILE_ID);
    return profileStore;
}

/** An online catalog: all of its rows held, FLUX being 3, 1, 4, 1, 5. A VizieR catalog shows RA, DEC and FLUX to begin with. */
function openOnlineCatalog(): CatalogOnlineQueryProfileStore {
    const flux = [3, 1, 4, 1, 5];
    const data = new Map<number, ProcessedColumnData>(COLUMN_NAMES.map((_, column) => [column, {dataType: CARTA.ColumnType.Double, data: column === 2 ? flux : flux.map((_flux, row) => ValueAt(row, column))}]));
    const profileStore = new CatalogOnlineQueryProfileStore({dataSize: flux.length, directory: "", fileId: CATALOG_FILE_ID, fileInfo: new CARTA.CatalogFileInfo({name: "simbad"})}, CATALOG_HEADER, data, CatalogType.VIZIER);
    CatalogStore.Instance.catalogProfileStores.set(CATALOG_FILE_ID, profileStore);
    CatalogStore.Instance.catalogImageIds.set(CATALOG_FILE_ID, IMAGE_FILE_ID);
    CatalogStore.Instance.getOrCreateCatalogDisplayStore(CATALOG_FILE_ID);
    return profileStore;
}

/**
 * Answer the latest request as the backend would, in one response: the rows it asked for, of the
 * columns it asked for, out of `filterDataSize` rows that pass its filter.
 */
function respond(filterDataSize = DATA_SIZE) {
    const {requestId, payload} = sent[sent.length - 1];
    const start = payload.subsetStartIndex ?? 0;
    const count = Math.max(0, Math.min(payload.subsetDataSize ?? 0, filterDataSize - start));
    const columns: {[column: number]: CARTA.ColumnData.$Properties} = {};
    for (const column of payload.columnIndices ?? []) {
        const values = new Float64Array(Array.from({length: count}, (_, i) => ValueAt(start + i, column)));
        columns[column] = {dataType: CARTA.ColumnType.Double, binaryData: new Uint8Array(values.buffer)};
    }
    const message = new CARTA.CatalogFilterResponse({fileId: CATALOG_FILE_ID, filterDataSize, requestEndIndex: start + count, subsetDataSize: count, subsetEndIndex: start + count, progress: 1, columns});
    CatalogStore.Instance.handleFilterStream({requestId, message});
}

/** Which rows a column holds, as ranges of row numbers; "?" marks a value that is not the column's own. */
function rowRanges(data: ArrayLike<unknown> | undefined, column: number, length: number): string {
    const ranges: string[] = [];
    let first: number | undefined;
    let last: number | undefined;
    const close = () => {
        if (first !== undefined) {
            ranges.push(first === last ? `${first}` : `${first}-${last}`);
        }
        first = last = undefined;
    };
    for (let i = 0; i < length; i++) {
        const value = data?.[i];
        if (typeof value !== "number" || !Number.isFinite(value) || value % 10 !== column) {
            close();
            const mark = typeof value === "number" && Number.isFinite(value) ? "?" : "-";
            if (ranges[ranges.length - 1] !== mark) {
                ranges.push(mark);
            }
            continue;
        }
        const row = Math.floor(value / 10);
        if (last !== undefined && row === last + 1) {
            last = row;
        } else {
            close();
            first = last = row;
        }
    }
    close();
    return ranges.join(",");
}

/** The rows a file catalog's table shows, per column, and how far its loading has got. */
function tableOf(profileStore: CatalogProfileStore) {
    const columns: {[name: string]: string} = {};
    COLUMN_NAMES.forEach((name, column) => {
        const data = profileStore.rows.data.get(column)?.data as ArrayLike<unknown> | undefined;
        columns[name] = rowRanges(data, column, profileStore.rows.visibleRowCount);
    });
    return {
        visibleRows: profileStore.rows.visibleRowCount,
        loadedRows: profileStore.rows.loadedRowCount,
        filteredRows: profileStore.rows.filteredRowCount,
        progress: profileStore.rows.progress,
        isLoading: profileStore.rows.isLoading,
        isStreaming: profileStore.rows.isStreaming,
        columns
    };
}

/** Which of an online catalog's rows pass its filter, and the FLUX its table shows, row by row. */
function onlineTableOf(profileStore: CatalogOnlineQueryProfileStore) {
    const flux = profileStore.rows.data.get(2)?.data as number[];
    return {
        visibleRows: profileStore.rows.visibleRowCount,
        rows: [...profileStore.rows.filterIndexMap],
        fluxShown: profileStore.rows.tableOrder.slice(0, profileStore.rows.visibleRowCount).map(i => flux[i])
    };
}

/** The request a file catalog starts from, before anything is applied. A zero, such as the first row or an ascending sort, is not sent at all. */
const INITIAL_REQUEST = {fileId: CATALOG_FILE_ID, columnIndices: [0, 1, 2], subsetDataSize: 50, imageBounds: {}};
/** The overlay axes a filter is sent with when none have been chosen. */
const NO_OVERLAY_AXES = {xColumnName: CatalogOverlay.NONE, yColumnName: CatalogOverlay.NONE};
const FLUX_ABOVE_ONE = {columnName: "FLUX", comparisonOperator: CARTA.ComparisonOperator.Greater, value: 1};

describe("file catalog rows", () => {
    test("applying a filter asks for the first rows that pass it, and shows only those", () => {
        const profileStore = openFileCatalog();
        const displayStore = CatalogStore.Instance.getCatalogDisplayStore(CATALOG_FILE_ID)!;
        displayStore.setxAxis("RA");
        displayStore.setyAxis("DEC");
        profileStore.setColumnFilter("> 1", "FLUX");

        CatalogStore.Instance.requestFilteredRows(CATALOG_FILE_ID);

        expect(sent.map(request => request.payload)).toEqual([{...INITIAL_REQUEST, filterConfigs: [FLUX_ABOVE_ONE], imageBounds: {xColumnName: "RA", yColumnName: "DEC"}}]);
        expect(tableOf(profileStore)).toEqual({visibleRows: 0, loadedRows: 0, filteredRows: undefined, progress: undefined, isLoading: true, isStreaming: false, columns: {RA: "", DEC: "", FLUX: "", MAG: ""}});

        respond(120);

        expect(tableOf(profileStore)).toEqual({visibleRows: 50, loadedRows: 50, filteredRows: 120, progress: 1, isLoading: false, isStreaming: false, columns: {RA: "0-49", DEC: "0-49", FLUX: "0-49", MAG: "-"}});
    });

    test("sorting asks for the first rows again in the new order", () => {
        const profileStore = openFileCatalog();

        CatalogStore.Instance.requestSortedRows(CATALOG_FILE_ID, "FLUX", CARTA.SortingType.Descending);
        respond();

        expect(sent.map(request => request.payload)).toEqual([{...INITIAL_REQUEST, sortColumn: "FLUX", sortingType: CARTA.SortingType.Descending}]);
        expect(tableOf(profileStore)).toMatchObject({visibleRows: 50, loadedRows: 50, filteredRows: 200, isLoading: false});
    });

    test("scrolling asks for the next chunk with the filter and sort last applied, not filter text still being edited", () => {
        const profileStore = openFileCatalog();
        profileStore.setColumnFilter("> 1", "FLUX");
        CatalogStore.Instance.requestFilteredRows(CATALOG_FILE_ID);
        respond(120);
        CatalogStore.Instance.requestSortedRows(CATALOG_FILE_ID, "RA", CARTA.SortingType.Descending);
        respond(120);
        profileStore.setColumnFilter("< 5", "FLUX");

        CatalogStore.Instance.requestMoreRows(CATALOG_FILE_ID);
        respond(120);
        CatalogStore.Instance.requestMoreRows(CATALOG_FILE_ID);
        respond(120);
        // Every row that passes the filter is in.
        CatalogStore.Instance.requestMoreRows(CATALOG_FILE_ID);

        const applied = {...INITIAL_REQUEST, filterConfigs: [FLUX_ABOVE_ONE], imageBounds: NO_OVERLAY_AXES};
        const sorted = {...applied, sortColumn: "RA", sortingType: CARTA.SortingType.Descending};
        // The last chunk asks for a full chunk, though only 20 rows are left to pass the filter.
        expect(sent.map(request => request.payload)).toEqual([applied, sorted, {...sorted, subsetStartIndex: 50}, {...sorted, subsetStartIndex: 100}]);
        expect(tableOf(profileStore)).toEqual({visibleRows: 120, loadedRows: 120, filteredRows: 120, progress: 1, isLoading: false, isStreaming: false, columns: {RA: "0-119", DEC: "0-119", FLUX: "0-119", MAG: "-"}});
    });

    test("scrolling reads a row limit that has been set but not applied", () => {
        const profileStore = openFileCatalog();
        profileStore.setMaxRows(60);

        CatalogStore.Instance.requestMoreRows(CATALOG_FILE_ID);
        respond();

        expect(sent.map(request => request.payload)).toEqual([{...INITIAL_REQUEST, subsetStartIndex: 50, subsetDataSize: 10}]);
        expect(tableOf(profileStore)).toMatchObject({visibleRows: 60, loadedRows: 60});
    });

    test("showing a column asks again for every row loaded so far, with the filter text as it stands, and keeps the rows shown", () => {
        const profileStore = openFileCatalog();
        CatalogStore.Instance.requestMoreRows(CATALOG_FILE_ID);
        respond();
        profileStore.setColumnFilter("> 1", "FLUX");
        const displayStore = CatalogStore.Instance.getCatalogDisplayStore(CATALOG_FILE_ID)!;

        displayStore.setColumnDisplayed("MAG", true);
        expect(tableOf(profileStore)).toMatchObject({visibleRows: 100, loadedRows: 100, isLoading: true});
        respond();

        expect(sent.map(request => request.payload)).toEqual([
            {...INITIAL_REQUEST, subsetStartIndex: 50},
            {...INITIAL_REQUEST, columnIndices: [0, 1, 2, 3], subsetDataSize: 100, filterConfigs: [FLUX_ABOVE_ONE], imageBounds: NO_OVERLAY_AXES}
        ]);
        expect(tableOf(profileStore)).toEqual({visibleRows: 100, loadedRows: 100, filteredRows: 200, progress: 1, isLoading: false, isStreaming: false, columns: {RA: "0-99", DEC: "0-99", FLUX: "0-99", MAG: "0-99"}});
        expect(profileStore.rows.isFetchingColumns).toBe(false);
    });

    test("a plot asks for every row it does not hold yet, and no chunk is asked for after it", () => {
        const profileStore = openFileCatalog();

        CatalogStore.Instance.requestPlotRows(CATALOG_FILE_ID);
        expect(tableOf(profileStore)).toMatchObject({isLoading: false, isStreaming: true});
        respond();
        CatalogStore.Instance.requestMoreRows(CATALOG_FILE_ID);

        expect(sent.map(request => request.payload)).toEqual([{...INITIAL_REQUEST, subsetStartIndex: 50, subsetDataSize: 150}]);
        expect(tableOf(profileStore)).toEqual({visibleRows: 200, loadedRows: 200, filteredRows: 200, progress: 1, isLoading: false, isStreaming: false, columns: {RA: "0-199", DEC: "0-199", FLUX: "0-199", MAG: "0-49,-"}});
    });

    test("resetting asks for the first rows with nothing applied", () => {
        const profileStore = openFileCatalog();
        profileStore.setColumnFilter("> 1", "FLUX");
        CatalogStore.Instance.requestFilteredRows(CATALOG_FILE_ID);
        respond(120);
        CatalogStore.Instance.requestSortedRows(CATALOG_FILE_ID, "RA", CARTA.SortingType.Descending);
        respond(120);
        profileStore.setMaxRows(80);

        CatalogStore.Instance.resetCatalogRows(CATALOG_FILE_ID);
        respond();

        expect(sent[sent.length - 1].payload).toEqual(INITIAL_REQUEST);
        expect(tableOf(profileStore)).toEqual({visibleRows: 50, loadedRows: 50, filteredRows: 200, progress: 1, isLoading: false, isStreaming: false, columns: {RA: "0-49", DEC: "0-49", FLUX: "0-49", MAG: "-"}});
        expect(profileStore.rows.rowLimit).toBe(DATA_SIZE);
    });

    test("drawing an overlay asks for every row not yet loaded, and no chunk is asked for after it", () => {
        const profileStore = openFileCatalog();
        const displayStore = CatalogStore.Instance.getCatalogDisplayStore(CATALOG_FILE_ID)!;
        displayStore.setxAxis("RA");
        displayStore.setyAxis("DEC");

        expect(CatalogStore.Instance.plotImageOverlay(CATALOG_FILE_ID)).toBe(true);
        expect(tableOf(profileStore)).toMatchObject({isLoading: false, isStreaming: true});
        respond();
        CatalogStore.Instance.requestMoreRows(CATALOG_FILE_ID);

        expect(sent.map(request => request.payload)).toEqual([{...INITIAL_REQUEST, subsetStartIndex: 50, subsetDataSize: 150}]);
        expect(tableOf(profileStore)).toEqual({visibleRows: 200, loadedRows: 200, filteredRows: 200, progress: 1, isLoading: false, isStreaming: false, columns: {RA: "0-199", DEC: "0-199", FLUX: "0-199", MAG: "0-49,-"}});
        expect(CatalogStore.Instance.convertToImageCoordinate).toHaveBeenCalledTimes(2);
    });

    test("a send the backend refuses leaves the table cleared and not loading", () => {
        const profileStore = openFileCatalog();
        profileStore.setColumnFilter("> 1", "FLUX");
        sendFilter.mockReturnValue(false);

        CatalogStore.Instance.requestFilteredRows(CATALOG_FILE_ID);

        expect(tableOf(profileStore)).toEqual({visibleRows: 0, loadedRows: 0, filteredRows: undefined, progress: undefined, isLoading: false, isStreaming: false, columns: {RA: "", DEC: "", FLUX: "", MAG: ""}});
    });
});

describe("file catalog rows on restore", () => {
    const overlay = {xAxis: "RA", yAxis: "DEC", system: CatalogSystemType.ICRS};

    beforeEach(() => {
        jest.spyOn(CatalogStore.Instance, "imageIdOf").mockReturnValue(IMAGE_FILE_ID);
    });

    /** A catalog whose saved table config has been applied: a FLUX filter, sorted on RA, 150 rows at most. */
    function openConfiguredCatalog(): CatalogProfileStore {
        const profileStore = openFileCatalog();
        profileStore.applyTableConfig({maxRows: 150, sorting: {columnName: "RA", sortingType: CARTA.SortingType.Descending}, columnSettings: {FLUX: {filter: "> 1"}}});
        return profileStore;
    }

    const configured = {...INITIAL_REQUEST, filterConfigs: [FLUX_ABOVE_ONE], sortColumn: "RA", sortingType: CARTA.SortingType.Descending};

    test("with an overlay, asks for as many rows as it was drawn with and draws them", async () => {
        const profileStore = openConfiguredCatalog();

        const outcome = CatalogStore.Instance.restoreCatalogFromWorkspace(CATALOG_FILE_ID, {overlay: {...overlay, maxRows: 180}});
        respond(190);

        await expect(outcome).resolves.toMatchObject({success: true, didStart: true});
        expect(sent.map(request => request.payload)).toEqual([{...configured, subsetDataSize: 180}]);
        expect(tableOf(profileStore)).toEqual({visibleRows: 150, loadedRows: 180, filteredRows: 190, progress: 1, isLoading: false, isStreaming: false, columns: {RA: "0-149", DEC: "0-149", FLUX: "0-149", MAG: "-"}});
        expect(CatalogStore.Instance.convertToImageCoordinate).toHaveBeenCalledTimes(1);
    });

    test("with a selection, asks for its identity columns and every row it may be among", async () => {
        const profileStore = openConfiguredCatalog();

        const outcome = CatalogStore.Instance.restoreCatalogFromWorkspace(CATALOG_FILE_ID, {selection: {columns: ["MAG"], rowHashes: [], searchRows: 120}});
        respond(190);

        await expect(outcome).resolves.toMatchObject({didStart: true});
        expect(sent.map(request => request.payload)).toEqual([{...configured, columnIndices: [0, 1, 2, 3], subsetDataSize: 120}]);
        expect(tableOf(profileStore)).toMatchObject({visibleRows: 120, loadedRows: 120, filteredRows: 190, isLoading: false, isStreaming: false});
    });

    test("with the rows it had loaded, asks for them again", async () => {
        const profileStore = openConfiguredCatalog();

        const outcome = CatalogStore.Instance.restoreCatalogFromWorkspace(CATALOG_FILE_ID, {loadedRows: 110});
        respond(190);

        await expect(outcome).resolves.toMatchObject({success: true});
        expect(sent.map(request => request.payload)).toEqual([{...configured, subsetDataSize: 110}]);
        expect(tableOf(profileStore)).toMatchObject({visibleRows: 110, loadedRows: 110});
    });

    test("then scrolls on from where it got to, with what was restored", () => {
        const profileStore = openConfiguredCatalog();
        CatalogStore.Instance.restoreCatalogFromWorkspace(CATALOG_FILE_ID, {loadedRows: 60});
        respond(190);

        CatalogStore.Instance.requestMoreRows(CATALOG_FILE_ID);
        respond(190);

        expect(sent.map(request => request.payload)).toEqual([
            {...configured, subsetDataSize: 60},
            {...configured, subsetStartIndex: 60, subsetDataSize: 50}
        ]);
        expect(tableOf(profileStore)).toMatchObject({visibleRows: 110, loadedRows: 110});
    });
});

describe("online catalog rows", () => {
    test("filtering and sorting happen here, asking the backend for nothing", () => {
        const profileStore = openOnlineCatalog();

        profileStore.setColumnFilter("> 1", "FLUX");
        CatalogStore.Instance.requestFilteredRows(CATALOG_FILE_ID);
        expect(onlineTableOf(profileStore)).toEqual({visibleRows: 3, rows: [0, 2, 4], fluxShown: [3, 4, 5]});

        CatalogStore.Instance.requestSortedRows(CATALOG_FILE_ID, "FLUX", CARTA.SortingType.Descending);
        expect(onlineTableOf(profileStore)).toEqual({visibleRows: 3, rows: [0, 2, 4], fluxShown: [5, 4, 3]});

        CatalogStore.Instance.requestMoreRows(CATALOG_FILE_ID);
        CatalogStore.Instance.requestPlotRows(CATALOG_FILE_ID);
        expect(sent).toEqual([]);
    });

    test("resetting shows every row in its first order", () => {
        const profileStore = openOnlineCatalog();
        profileStore.setColumnFilter("> 1", "FLUX");
        CatalogStore.Instance.requestFilteredRows(CATALOG_FILE_ID);
        CatalogStore.Instance.requestSortedRows(CATALOG_FILE_ID, "FLUX", CARTA.SortingType.Descending);

        CatalogStore.Instance.resetCatalogRows(CATALOG_FILE_ID);

        expect(onlineTableOf(profileStore)).toEqual({visibleRows: 5, rows: [0, 1, 2, 3, 4], fluxShown: [3, 1, 4, 1, 5]});
        expect(sent).toEqual([]);
    });

    test("drawing an overlay asks the backend for nothing", () => {
        openOnlineCatalog();
        const displayStore = CatalogStore.Instance.getCatalogDisplayStore(CATALOG_FILE_ID)!;
        displayStore.setxAxis("RA");
        displayStore.setyAxis("DEC");

        expect(CatalogStore.Instance.plotImageOverlay(CATALOG_FILE_ID)).toBe(true);
        expect(sent).toEqual([]);
    });
});
