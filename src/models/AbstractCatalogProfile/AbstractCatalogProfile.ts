import {type Region, Regions} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {CatalogOverlay, CatalogSystemType, CatalogTextureType, CatalogType, CatalogUpdateMode} from "enums";
import {CatalogWebGLService} from "services";
import {AppStore, CatalogStore, type ControlHeader} from "stores";
import {
    CatalogAxisEligibility,
    type CatalogAxisEligibilityResult,
    type CatalogCoordinateSystem,
    filterProcessedColumnData,
    getCatalogAxisEligibility,
    getComparisonOperatorAndValue,
    getCoordinateDescriptorFromUnits,
    getDegreesPerCatalogUnit,
    getHasFilter,
    isCatalogLatitudeAxis,
    isCatalogNumericDataType,
    minMaxArray,
    parseCoordinateValue,
    type ProcessedColumnData,
    rejectOutOfRangeLatitude,
    resolveDescriptorForAxis,
    transformPoint,
    type TypedArray
} from "utilities";

import {type WorkspaceCatalogQuerySource, type WorkspaceCatalogTableConfig} from "../Workspace";

export interface CatalogInfo {
    fileId: number;
    fileInfo: CARTA.CatalogFileInfo.$Properties;
    dataSize: number;
    directory: string;
    query?: WorkspaceCatalogQuerySource;
}

/**
 * Converts a column to numeric coordinates for the axis it has been bound to. This is the one
 * place where an ambiguous format (a bare "12:30:00", which is hours on RA and degrees elsewhere)
 * is resolved, because it is the first point at which the axis is known.
 *
 * Values come back in the column's declared units, not in degrees: the sky transform scales them
 * on its way into AST, and converting here as well would apply that scaling twice.
 */
function getCatalogCoordinateData(column: ProcessedColumnData | undefined, eligibility: CatalogAxisEligibilityResult, units: string | null | undefined, axis: CatalogOverlay, rowCount?: number): Array<number> | undefined {
    if (!column) {
        return undefined;
    }

    const data = rowCount === undefined ? column.data : column.data?.slice(0, rowCount);

    // An unknown string format is not a reason to omit this chunk: the overlay buffer is written
    // at absolute row offsets, and omitting it would leave zero-filled vertices at the origin while
    // later chunks are written past the count. Keep the row slots occupied until a later chunk
    // provides enough evidence to settle the descriptor.
    if (eligibility.status === CatalogAxisEligibility.Unknown) {
        return new Array<number>(data?.length ?? 0).fill(NaN);
    }
    if (eligibility.status !== CatalogAxisEligibility.Eligible) {
        return undefined;
    }

    // Applied to numeric columns too: a declination of -91 breaks the transform the same way
    // whether it arrived as a number or as a string.
    const isLatitude = isCatalogLatitudeAxis(axis);
    const degreesPerUnit = getDegreesPerCatalogUnit(units);

    if (!eligibility.descriptor) {
        const numericData = data as ArrayLike<number>;
        return isLatitude ? rejectOutOfRangeLatitudes(numericData, degreesPerUnit) : (numericData as Array<number>);
    }

    const descriptor = resolveDescriptorForAxis(eligibility.descriptor, axis);
    // Parsed values are in the column's units too, so one scale covers both paths: the parser
    // resolves only what the units cannot express as a multiplier, which is the sexagesimal
    // notation, and getDegreesPerCatalogUnit reports 1 for exactly those units.
    const parsedData = (data as Array<string | null | undefined>).map(value => parseCoordinateValue(value, descriptor));
    return isLatitude ? rejectOutOfRangeLatitudes(parsedData, degreesPerUnit) : parsedData;
}

/**
 * Drops the latitudes that lie beyond a pole, leaving the values that survive in their original
 * units. The bound is a number of degrees, so each value is scaled for the comparison only.
 */
function rejectOutOfRangeLatitudes(values: ArrayLike<number>, degreesPerUnit: number): Array<number> {
    // Built element by element rather than with `values.map`: a numeric column arrives as a typed
    // array, and mapping an integer one writes the result back through its own element type, which
    // turns a rejected NaN into a source at latitude zero.
    const checked = new Array<number>(values.length);
    for (let index = 0; index < values.length; index++) {
        const value = values[index];
        checked[index] = isNaN(rejectOutOfRangeLatitude(value * degreesPerUnit)) ? NaN : value;
    }
    return checked;
}

function getNumericPlotData(column: ProcessedColumnData | undefined): Array<number> | undefined {
    return column && isCatalogNumericDataType(column.dataType) ? (column.data as Array<number>) : undefined;
}

export abstract class AbstractCatalogProfileStore {
    private static readonly NegativeInfinity = -1.7976931348623157e308;
    private static readonly PositiveInfinity = 1.7976931348623157e308;
    private static readonly TrueRegex = /^[tTyY].*$/;
    private static readonly FalseRegex = /^[fFnN].*$/;

    abstract catalogInfo: CatalogInfo;
    abstract catalogHeader: Array<CARTA.CatalogHeader>;
    abstract catalogControlHeader: Map<string, ControlHeader>;
    abstract numVisibleRows: number;

    abstract get initCatalogControlHeader(): Map<string, ControlHeader>;
    abstract resetFilterRequest(filterConfigs?: CARTA.FilterConfig[]): void;
    abstract get updateRequestDataSize(): any;
    abstract get shouldUpdateData(): boolean;
    abstract resetCatalogFilterRequest(): void;
    abstract get isLoadingOntoImage(): boolean;
    abstract get maxRows(): number;
    abstract setMaxRows(maxRows: number): void;
    abstract setSortingInfo(columnName: string, sortingType: CARTA.SortingType, columnIndex?: number): void;

    @observable isLoadingData: boolean = false;
    @observable catalogType: CatalogType = CatalogType.SIMBAD;
    @observable catalogFilterRequest: CARTA.CatalogFilterRequest.$Properties = {};
    @observable catalogCoordinateSystem: CatalogCoordinateSystem = {
        system: CatalogSystemType.ICRS,
        equinox: null,
        epoch: null
    };
    @observable filterDataSize: number | undefined = undefined;
    @observable progress: number;
    @observable isUpdatingDataStream: boolean = false;
    @observable shouldUpdateTableView: boolean = false;
    @observable updateMode: CatalogUpdateMode = CatalogUpdateMode.TableUpdate;
    @observable selectedPointIndices: number[] = [];
    @observable sortingInfo: {columnName: string | null; sortingType: CARTA.SortingType | null} = {columnName: null, sortingType: null};
    @observable sortedIndexMap: number[] = [];
    @observable filterIndexMap: number[] = [];
    @observable isUpdateColumnMode: boolean = false;

    /**
     * Shallow so that replacing a column marks the data as changed. Rows stream in a batch at a
     * time, and anything computed from a column has to see them; the column arrays themselves stay
     * plain, since they can hold millions of values.
     */
    @observable.shallow private _catalogData: Map<number, ProcessedColumnData>;
    /** Changes when a column object is updated without changing the shallow map itself. */
    @observable protected catalogDataVersion = 0;
    /** Backing store for {@link getCoordinateEligibility}, by column name. */
    private _coordinateEligibility = new Map<string, CatalogAxisEligibilityResult>();
    public static readonly COORDINATE_SYSTEM_NAME = new Map<CatalogSystemType, string>([
        [CatalogSystemType.FK5, "FK5"],
        [CatalogSystemType.FK4, "FK4"],
        [CatalogSystemType.Galactic, "GALACTIC"],
        [CatalogSystemType.Ecliptic, "ECLIPTIC"],
        [CatalogSystemType.ICRS, "ICRS"],
        [CatalogSystemType.Pixel0, "PIX0"],
        [CatalogSystemType.Pixel1, "PIX1"]
    ]);
    private _systemCoordinateMap = new Map<CatalogSystemType, {x: CatalogOverlay; y: CatalogOverlay}>([
        [CatalogSystemType.FK4, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
        [CatalogSystemType.FK5, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
        [CatalogSystemType.ICRS, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
        [CatalogSystemType.Galactic, {x: CatalogOverlay.GLON, y: CatalogOverlay.GLAT}],
        [CatalogSystemType.Ecliptic, {x: CatalogOverlay.ELON, y: CatalogOverlay.ELAT}],
        [CatalogSystemType.Pixel0, {x: CatalogOverlay.X0, y: CatalogOverlay.Y0}],
        [CatalogSystemType.Pixel1, {x: CatalogOverlay.X1, y: CatalogOverlay.Y1}]
    ]);

    constructor(catalogType: CatalogType, catalogData: Map<number, ProcessedColumnData>) {
        this._catalogData = catalogData;
        this.catalogType = catalogType;
        makeObservable(this);
    }

    get catalogData(): Map<number, ProcessedColumnData> {
        void this.catalogDataVersion;
        if (!this.isFileBasedCatalog && this.filterIndexMap.length !== this.catalogInfo.dataSize) {
            const filteredData = new Map<number, ProcessedColumnData>();
            this._catalogData.forEach((columnData, i) => {
                filteredData.set(i, filterProcessedColumnData(columnData, this.filterIndexMap));
            });
            return filteredData;
        }
        return this._catalogData;
    }

    get catalogOriginalData(): Map<number, ProcessedColumnData> {
        void this.catalogDataVersion;
        return this._catalogData;
    }

    get systemCoordinateMap(): Map<CatalogSystemType, {x: CatalogOverlay; y: CatalogOverlay}> {
        return this._systemCoordinateMap;
    }

    clearData() {
        this.catalogData.clear();
    }

    /**
     * The values VOTable 1.4 section 3.4 allows for COOSYS/\@system. Matched exactly, because the
     * ecliptic spellings contain the equatorial ones: a substring test reads "ecl_FK5" as FK5,
     * which silently turns an ecliptic longitude into a right ascension and scales it by fifteen.
     */
    private static readonly VotableCoordinateSystems = new Map<string, CatalogSystemType>([
        ["icrs", CatalogSystemType.ICRS],
        ["eq_fk5", CatalogSystemType.FK5],
        ["eq_fk4", CatalogSystemType.FK4],
        ["ecl_fk5", CatalogSystemType.Ecliptic],
        ["ecl_fk4", CatalogSystemType.Ecliptic],
        ["galactic", CatalogSystemType.Galactic]
    ]);

    /**
     * Looser spellings, for files that do not follow the enumeration and for CARTA's own pixel
     * systems. Ordered most specific first and matched on the first hit, so "ecl_" cannot fall
     * through to the equatorial keywords.
     *
     * "supergalactic" is a standard VOTable value that CARTA has no system for; it lands on
     * Galactic here, as it always has.
     */
    private static readonly CoordinateSystemKeywords: ReadonlyArray<[string, CatalogSystemType]> = [
        ["ecl", CatalogSystemType.Ecliptic],
        ["galactic", CatalogSystemType.Galactic],
        ["icrs", CatalogSystemType.ICRS],
        ["fk5", CatalogSystemType.FK5],
        ["fk4", CatalogSystemType.FK4],
        ["pix0", CatalogSystemType.Pixel0],
        ["pix1", CatalogSystemType.Pixel1]
    ];

    /**
     * Maps a catalog's declared coordinate system onto the system CARTA transforms with.
     *
     * The VOTable enumeration is matched exactly before any looser spelling is tried, so the
     * ecliptic values cannot fall through to the equatorial keywords they contain.
     *
     * @param system - the `COOSYS/@system` value as declared by the file
     * @returns the matching system, or `CatalogSystemType.ICRS` when nothing matches
     */
    public static getCatalogSystem(system: string | null | undefined): CatalogSystemType {
        const normalizedSystem = system?.trim().toLowerCase();
        if (!normalizedSystem) {
            return CatalogSystemType.ICRS;
        }

        const declaredSystem = AbstractCatalogProfileStore.VotableCoordinateSystems.get(normalizedSystem);
        if (declaredSystem !== undefined) {
            return declaredSystem;
        }

        return AbstractCatalogProfileStore.CoordinateSystemKeywords.find(([keyword]) => normalizedSystem.includes(keyword))?.[1] ?? CatalogSystemType.ICRS;
    }

    /**
     * The equinox and epoch a coordinate system implies, used when the file declares neither.
     *
     * Takes the declared string rather than a {@link CatalogSystemType}, because `ecl_FK4` implies
     * B1950 and is indistinguishable from `ecl_FK5` once both have been mapped to `Ecliptic`.
     *
     * @param system - the `COOSYS/@system` value as declared by the file
     * @returns the equinox and epoch in the Besselian/Julian year form AST accepts, or nulls for a
     * system that has neither
     */
    public static getCatalogCoordinateDefaults(system: string | null | undefined): {equinox: string | null; epoch: string | null} {
        const normalizedSystem = system?.trim().toLowerCase();
        const catalogSystem = AbstractCatalogProfileStore.getCatalogSystem(system);

        if (catalogSystem === CatalogSystemType.Pixel0 || catalogSystem === CatalogSystemType.Pixel1) {
            return {equinox: null, epoch: null};
        }

        if (catalogSystem === CatalogSystemType.FK4 || normalizedSystem === "ecl_fk4") {
            return {equinox: "B1950.0", epoch: "B1950.0"};
        }

        return {equinox: "J2000.0", epoch: "J2000.0"};
    }

    /** The header of one column, or undefined when this catalog does not have that column. */
    public getColumnHeader(columnName: string): CARTA.CatalogHeader | undefined {
        const dataIndex = this.catalogControlHeader.get(columnName)?.dataIndex;
        return dataIndex !== undefined ? this.catalogHeader[dataIndex] : undefined;
    }

    /**
     * Values for a scatter plot of any two columns. The axes carry no coordinate meaning here --
     * a flux against a velocity is as valid a pair as a longitude against a latitude -- so the
     * values are read as plain numbers, with none of the parsing or range checks that
     * {@link get2DCoordinateData} applies.
     */
    public get2DPlotData(
        xColumnName: string,
        yColumnName: string,
        columnsData: Map<number, ProcessedColumnData>
    ): {wcsX?: Array<number>; wcsY?: Array<number>; xHeaderInfo: CARTA.CatalogHeader.$Properties; yHeaderInfo: CARTA.CatalogHeader.$Properties} {
        const {xColumn, yColumn, xHeaderInfo, yHeaderInfo} = this.getPlotColumns(xColumnName, yColumnName, columnsData);
        const wcsX = getNumericPlotData(xColumn);
        const wcsY = getNumericPlotData(yColumn);

        return wcsX && wcsY ? {wcsX, wcsY, xHeaderInfo, yHeaderInfo} : {xHeaderInfo, yHeaderInfo};
    }

    /**
     * Values for the image overlay, read as coordinates of the active system: string formats are
     * parsed, and a latitude beyond a pole is dropped. Only here, where the columns are known to
     * be feeding a sky transform, is that interpretation warranted.
     */
    public get2DCoordinateData(
        xColumnName: string,
        yColumnName: string,
        columnsData: Map<number, ProcessedColumnData>,
        rowCount?: number
    ): {wcsX?: Array<number>; wcsY?: Array<number>; xHeaderInfo: CARTA.CatalogHeader.$Properties; yHeaderInfo: CARTA.CatalogHeader.$Properties} {
        const {xColumn, yColumn, xHeaderInfo, yHeaderInfo} = this.getPlotColumns(xColumnName, yColumnName, columnsData);
        const wcsX = getCatalogCoordinateData(xColumn, this.getCoordinateEligibility(xColumnName), xHeaderInfo.units, this.activedSystem?.x ?? CatalogOverlay.X, rowCount);
        const wcsY = getCatalogCoordinateData(yColumn, this.getCoordinateEligibility(yColumnName), yHeaderInfo.units, this.activedSystem?.y ?? CatalogOverlay.Y, rowCount);

        return wcsX && wcsY ? {wcsX, wcsY, xHeaderInfo, yHeaderInfo} : {xHeaderInfo, yHeaderInfo};
    }

    /**
     * Whether a column can be read as a coordinate, and how. Settled once and then reused for the
     * life of the store.
     *
     * A filter response carries only its own chunk of rows, so deciding this afresh on every call
     * lets a chunk of blanks -- or one stray unparseable value -- declare the whole column
     * unreadable. That is not just a chunk of missing sources: the overlay is written at absolute
     * row offsets, so a skipped chunk leaves its slots at the image origin and counts every later
     * chunk short. A column's format is a property of the column, not of the rows that happen to
     * have arrived, so once it is known the rows that do not fit it are read as NaN and dropped
     * individually.
     *
     * The evidence is the store's current data view rather than the rows passed in. For a file
     * stream that is the accumulated prefix; for an online catalog it is the filtered view used
     * by the overlay, so eligibility cannot disagree with the UI's sample.
     */
    public getCoordinateEligibility(columnName: string): CatalogAxisEligibilityResult {
        const settled = this._coordinateEligibility.get(columnName);
        if (settled) {
            return settled;
        }

        const controlHeader = this.catalogControlHeader.get(columnName);
        const headerInfo = controlHeader?.dataIndex === undefined ? undefined : this.catalogHeader[controlHeader.dataIndex];
        const column = this.catalogData.get(headerInfo?.columnIndex ?? NaN);
        const sampleData = column?.dataType === CARTA.ColumnType.String ? (column.data as Array<string | null | undefined>) : undefined;
        const eligibility = getCatalogAxisEligibility(headerInfo?.dataType, headerInfo?.units, sampleData);
        const isUnresolvedString = headerInfo?.dataType === CARTA.ColumnType.String && !getCoordinateDescriptorFromUnits(headerInfo.units);
        // A partial file stream can contain too many placeholders for the current sample to reach
        // the majority threshold. Keep that result Unknown until the requested rows are exhausted;
        // unlike a settled Ineligible result, it must reserve its absolute row slots in the GL
        // buffer because a later chunk can still establish the column's format.
        if (eligibility.status === CatalogAxisEligibility.Ineligible && isUnresolvedString && this.isFileBasedCatalog && this.shouldUpdateData) {
            return {status: CatalogAxisEligibility.Unknown, reason: "Column coordinate format is still being determined from streamed values."};
        }
        // Only an answer counts as settled: a column with nothing readable in it yet is a question
        // the rows still to arrive may well answer.
        if (eligibility.status === CatalogAxisEligibility.Eligible) {
            this._coordinateEligibility.set(columnName, eligibility);
        }
        return eligibility;
    }

    private getPlotColumns(
        xColumnName: string,
        yColumnName: string,
        columnsData: Map<number, ProcessedColumnData>
    ): {xColumn?: ProcessedColumnData; yColumn?: ProcessedColumnData; xHeaderInfo: CARTA.CatalogHeader.$Properties; yHeaderInfo: CARTA.CatalogHeader.$Properties} {
        const controlHeader = this.catalogControlHeader;
        const xHeader = controlHeader.get(xColumnName);
        const yHeader = controlHeader.get(yColumnName);
        const xHeaderInfo = this.catalogHeader[xHeader?.dataIndex ?? NaN];
        const yHeaderInfo = this.catalogHeader[yHeader?.dataIndex ?? NaN];

        // A restored plot can name a column the catalog no longer has, which leaves its header
        // undefined. String columns are no longer filtered out here: a coordinate column may hold
        // sexagesimal or degree text, which the caller resolves through its header.
        const xColumn = xHeaderInfo ? columnsData.get(xHeaderInfo.columnIndex) : undefined;
        const yColumn = yHeaderInfo ? columnsData.get(yHeaderInfo.columnIndex) : undefined;
        return {xColumn, yColumn, xHeaderInfo: xHeaderInfo ?? {}, yHeaderInfo: yHeaderInfo ?? {}};
    }

    public get1DPlotData(column: string): {wcsData?: TypedArray; headerInfo: CARTA.CatalogHeader.$Properties} {
        const controlHeader = this.catalogControlHeader;
        const header = controlHeader.get(column);
        const headerInfo = this.catalogHeader[header?.dataIndex ?? NaN];
        const xColumn = headerInfo ? this.catalogData.get(headerInfo.columnIndex) : undefined;
        if (xColumn && xColumn.dataType !== CARTA.ColumnType.String && xColumn.dataType !== CARTA.ColumnType.Bool) {
            const wcsData = xColumn.data as TypedArray;
            return {wcsData, headerInfo};
        } else {
            return {headerInfo: headerInfo ?? {}};
        }
    }

    public getUserFilters(): CARTA.FilterConfig[] {
        const userFilters: CARTA.FilterConfig[] = [];
        this.catalogControlHeader.forEach((value, key) => {
            if (value.filter !== undefined && value.display && value.dataIndex !== undefined) {
                const filter = new CARTA.FilterConfig();
                const dataType = this.catalogHeader[value.dataIndex].dataType;
                filter.columnName = key;
                if (dataType === CARTA.ColumnType.String) {
                    if (value.filter !== "") {
                        filter.subString = value.filter;
                        userFilters.push(filter);
                    }
                } else if (dataType === CARTA.ColumnType.Bool) {
                    if (value.filter) {
                        filter.comparisonOperator = CARTA.ComparisonOperator.Equal;
                        if (value.filter.match(AbstractCatalogProfileStore.TrueRegex)) {
                            filter.value = 1;
                            userFilters.push(filter);
                        } else if (value.filter.match(AbstractCatalogProfileStore.FalseRegex)) {
                            filter.value = 0;
                            userFilters.push(filter);
                        }
                    }
                } else {
                    const result = getComparisonOperatorAndValue(value.filter);
                    if (result.operator !== undefined && result.values.length > 0) {
                        filter.comparisonOperator = result.operator;
                        if (result.values.length > 1) {
                            filter.value = Math.min(result.values[0], result.values[1]);
                            filter.secondaryValue = Math.max(result.values[0], result.values[1]);
                        } else {
                            filter.value = result.values[0];
                        }
                        userFilters.push(filter);
                    }
                }
            }
        });
        return userFilters;
    }

    @computed get catalogFileId(): number {
        return this.catalogInfo.fileId;
    }

    @computed get activedSystem(): {x: CatalogOverlay; y: CatalogOverlay} | undefined {
        return this.systemCoordinateMap.get(this.catalogCoordinateSystem.system);
    }

    @computed get regionSelected(): number {
        return this.selectedPointIndices.length;
    }

    /**
     * Columns the backend is asked for although the table does not show them.
     *
     * Which columns are asked for and which are shown are two different questions, and a column can
     * be the answer to one and not the other: an overlay maps columns that the user may have hidden
     * from the table, and the rows have to carry them all the same.
     */
    private readonly requestedHiddenColumns = observable.set<string>();

    @computed get columnIndices(): Array<number> {
        const indices: number[] = [];
        this.catalogControlHeader.forEach((header, columnName) => {
            if ((header.display || this.requestedHiddenColumns.has(columnName)) && header.columnIndex !== undefined) {
                indices.push(header.columnIndex);
            }
        });
        return indices;
    }

    /**
     * Make sure the given columns are among the ones the backend is asked for. Rows that stream in
     * later only carry the requested columns, so a column that is mapped but not displayed leaves
     * those rows unusable.
     *
     * The table is left as it was. A column the user hid stays hidden, and a workspace that saved
     * it hidden comes back that way: being needed by the overlay is not a reason to show it.
     *
     * @returns whether any column had to be added.
     */
    @action ensureColumnsRequested(columnNames: string[]): boolean {
        let hasChanged = false;
        for (const columnName of columnNames) {
            const header = this.catalogControlHeader.get(columnName);
            if (header && !header.display && !this.requestedHiddenColumns.has(columnName)) {
                this.requestedHiddenColumns.add(columnName);
                hasChanged = true;
            }
        }
        if (hasChanged) {
            this.catalogFilterRequest.columnIndices = this.columnIndices;
        }
        return hasChanged;
    }

    @computed get displayedColumnHeaders(): Array<CARTA.CatalogHeader> {
        const displayedColumnHeaders: CARTA.CatalogHeader[] = [];
        this.catalogControlHeader.forEach((value, key) => {
            if (value.display && this.catalogHeader && value.dataIndex !== undefined) {
                displayedColumnHeaders.push(this.catalogHeader[value.dataIndex]);
            }
        });
        return displayedColumnHeaders;
    }

    /**
     * Whether a column's declared type is already numeric, so plotting it needs no parsing.
     *
     * @param columnName - the column's name, as it appears in the catalog header
     * @returns true when the column's values can be read as numbers directly
     */
    public isNumericColumn(columnName: string): boolean {
        const controlHeader = this.catalogControlHeader.get(columnName);
        return controlHeader?.dataIndex !== undefined && isCatalogNumericDataType(this.catalogHeader[controlHeader.dataIndex]?.dataType);
    }

    /**
     * The displayed columns a scatter plot or histogram can read directly, in table order.
     *
     * Image overlays are not limited to these: a string column can be a coordinate too, which
     * {@link getCoordinateEligibility} decides from its units or its values.
     */
    @computed get displayedNumericColumnNames(): Array<string> {
        const columnNames: string[] = [];
        this.catalogControlHeader.forEach((header, columnName) => {
            if (header.display && this.isNumericColumn(columnName)) {
                columnNames.push(columnName);
            }
        });
        return columnNames;
    }

    @computed get selectedData(): Map<number, ProcessedColumnData> {
        const catalogColumnsData = this.catalogData;
        const selectedPointIndices = this.selectedPointIndices;
        const displayed = this.displayedColumnHeaders.map(catalogHeader => {
            return catalogHeader.columnIndex;
        });

        if (selectedPointIndices.length > 0) {
            const selectedData = new Map<number, ProcessedColumnData>();
            this.catalogData.forEach((data, i) => {
                if (displayed.includes(i)) {
                    selectedData.set(i, filterProcessedColumnData(data, selectedPointIndices));
                }
            });

            return selectedData;
        }
        return catalogColumnsData;
    }

    @computed get autoScrollRowNumber(): Region {
        let singleRowRegion: Region = Regions.row(0);
        if (this.selectedPointIndices.length > 0) {
            singleRowRegion = Regions.row(minMaxArray(this.selectedPointIndices).minVal);
        }
        return singleRowRegion;
    }

    @computed get isFileBasedCatalog(): boolean {
        return this.catalogType === CatalogType.FILE;
    }

    @computed get tableColumnWidths(): Array<number | null | undefined> {
        const columnWidths: (number | null | undefined)[] = [];
        this.catalogControlHeader.forEach((value, key) => {
            if (value.display) {
                columnWidths.push(value.columnWidth);
            }
        });
        return columnWidths;
    }

    @computed get hasFilter(): boolean {
        return getHasFilter(this.catalogControlHeader, this.catalogData);
    }

    @action updateTableStatus(isEnabled: boolean) {
        this.shouldUpdateTableView = isEnabled;
    }

    @action setColumnFilter = (filter: string, columnName: string) => {
        const current = this.catalogControlHeader.get(columnName);
        const newHeader: ControlHeader = {
            columnIndex: current?.columnIndex ?? NaN,
            dataIndex: current?.dataIndex ?? NaN,
            display: current?.display ?? false,
            filter: filter,
            columnWidth: current?.columnWidth ?? null
        };
        this.catalogControlHeader.set(columnName, newHeader);
        this.updateTableStatus(true);
    };

    @action.bound setTableColumnWidth(width: number, columnName: string) {
        const header = this.catalogControlHeader.get(columnName);
        if (header) {
            header.columnWidth = width;
        }
    }

    @action setHeaderDisplay(isVisible: boolean, columnName: string) {
        const header = this.catalogControlHeader.get(columnName);
        if (header) {
            header.display = isVisible;
        }
    }

    /** Restore the columns shown in the catalog table from a workspace config. */
    @action setDisplayedColumns(columnNames: string[]) {
        const displayedColumns = new Set(columnNames);
        this.catalogControlHeader.forEach((header, columnName) => {
            header.display = displayedColumns.has(columnName);
        });
        this.catalogFilterRequest.columnIndices = this.columnIndices;
    }

    /** The table state a workspace saves: which rows and columns the catalog holds, and how its
     * table shows them. */
    public toTableConfig(): WorkspaceCatalogTableConfig {
        const columnSettings: NonNullable<WorkspaceCatalogTableConfig["columnSettings"]> = {};
        for (const [columnName, header] of this.catalogControlHeader) {
            if (header.filter || Number.isFinite(header.columnWidth)) {
                columnSettings[columnName] = {
                    filter: header.filter || undefined,
                    width: Number.isFinite(header.columnWidth) ? (header.columnWidth as number) : undefined
                };
            }
        }

        return {
            displayedColumns: this.displayedColumnHeaders.map(header => header.name),
            maxRows: this.isFileBasedCatalog ? this.maxRows : undefined,
            columnSettings: Object.keys(columnSettings).length ? columnSettings : undefined,
            sorting: this.sortingInfo.columnName && this.sortingInfo.sortingType !== null ? {columnName: this.sortingInfo.columnName, sortingType: this.sortingInfo.sortingType} : undefined
        };
    }

    /**
     * Put a saved table state back.
     *
     * This records what the table and the query behind it should be. A file-based catalog's rows
     * then have to be asked for again, which is the restore flow's job; an online catalog holds all
     * of its rows already, so applying the query means filtering them here and now.
     */
    @action applyTableConfig(config: WorkspaceCatalogTableConfig | undefined | null): void {
        if (config?.displayedColumns) {
            this.setDisplayedColumns(config.displayedColumns);
        }
        if (this.isFileBasedCatalog && typeof config?.maxRows === "number" && Number.isFinite(config.maxRows)) {
            this.setMaxRows(Math.max(0, Math.min(this.catalogInfo.dataSize, config.maxRows)));
        }
        if (config?.columnSettings) {
            Object.entries(config.columnSettings).forEach(([columnName, columnConfig]) => {
                if (typeof columnConfig?.filter === "string") {
                    this.setColumnFilter(columnConfig.filter, columnName);
                }
                if (Number.isFinite(columnConfig?.width)) {
                    this.setTableColumnWidth(columnConfig.width as number, columnName);
                }
            });
        }
        if (config?.sorting && this.catalogControlHeader.has(config.sorting.columnName)) {
            this.setSortingInfo(config.sorting.columnName, config.sorting.sortingType);
        }

        this.catalogFilterRequest.filterConfigs = this.getUserFilters();
        this.catalogFilterRequest.sortColumn = this.sortingInfo.columnName;
        this.catalogFilterRequest.sortingType = this.sortingInfo.sortingType;
        this.catalogFilterRequest.columnIndices = this.columnIndices;

        if (!this.isFileBasedCatalog) {
            this.resetFilterRequest(this.getUserFilters());
        }
    }

    @action setUpdateMode(mode: CatalogUpdateMode) {
        this.updateMode = mode;
    }

    @action setLoadingDataStatus(isLoading: boolean) {
        this.isLoadingData = isLoading;
    }

    @action setUpdatingDataStream(isUpdating: boolean) {
        this.isUpdatingDataStream = isUpdating;
    }

    @action setCatalogCoordinateSystem(catalogSystem: CatalogSystemType) {
        if (this.catalogCoordinateSystem.system === catalogSystem) {
            return;
        }

        const defaults = AbstractCatalogProfileStore.getCatalogCoordinateDefaults(catalogSystem);
        this.catalogCoordinateSystem = {
            system: catalogSystem,
            equinox: defaults.equinox,
            epoch: defaults.epoch
        };
    }

    @action setProgress(val: number) {
        this.progress = val;
    }

    @action setIsUpdateColumn(isUpdateColumn: boolean) {
        this.isUpdateColumnMode = isUpdateColumn;
    }

    getSortedIndices(selectedPointIndices: number[]): number[] {
        const indices = new Array(selectedPointIndices.length);
        if (this.sortedIndexMap.length && selectedPointIndices.length && !this.isFileBasedCatalog) {
            for (let index = 0; index < selectedPointIndices.length; index++) {
                const i = selectedPointIndices[index];
                indices[index] = this.sortedIndexMap[i];
            }
        } else {
            return selectedPointIndices;
        }
        return indices;
    }

    getOriginIndices(selectedPointIndices: number[]): number[] {
        const indices = new Array(selectedPointIndices.length);
        if (this.sortedIndexMap.length && selectedPointIndices.length && !this.isFileBasedCatalog) {
            for (let index = 0; index < selectedPointIndices.length; index++) {
                const i = selectedPointIndices[index];
                const j = this.sortedIndexMap.indexOf(i);
                if (j > -1) {
                    indices[index] = j;
                }
            }
        } else {
            return selectedPointIndices;
        }
        return indices;
    }

    @action setSelectedPointIndices = (pointIndices: Array<number>, shouldAutoPanZoom: boolean) => {
        this.selectedPointIndices = pointIndices;
        const catalogStore = CatalogStore.Instance;
        const coordsArray = CatalogStore.Instance.catalogGLData.get(this.catalogFileId);
        if (coordsArray?.x?.length) {
            const selectedX: number[] = [];
            const selectedY: number[] = [];
            const selectedData = new Uint8Array(coordsArray.x.length);
            const matchedIndices = this.getSortedIndices(pointIndices);
            for (let index = 0; index < matchedIndices.length; index++) {
                const i = matchedIndices[index];
                const x = coordsArray.x[i];
                const y = coordsArray.y[i];

                if (!this.isInfinite(x) && !this.isInfinite(y)) {
                    selectedX.push(x);
                    selectedY.push(y);
                }
                selectedData[i] = 1.0;
            }
            CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, selectedData, CatalogTextureType.SelectedSource);
            if (shouldAutoPanZoom && this.updateMode === CatalogUpdateMode.ViewUpdate) {
                const appStore = AppStore.Instance;
                const frame = appStore.getFrame(catalogStore.getFrameIdByCatalogId(this.catalogFileId));
                const activeFrame = appStore.activeFrame;
                const selectedDataLength = selectedX.length;
                let positionImageSpace = {x: selectedX[0], y: selectedY[0]};
                if (activeFrame) {
                    if (selectedDataLength > 1) {
                        const minMaxX = minMaxArray(selectedX);
                        const minMaxY = minMaxArray(selectedY);
                        const width = minMaxX.maxVal - minMaxX.minVal;
                        const height = minMaxY.maxVal - minMaxY.minVal;
                        positionImageSpace = {x: width / 2 + minMaxX.minVal, y: height / 2 + minMaxY.minVal};
                        const zoomLevel = Math.min(activeFrame.renderWidth / width, activeFrame.renderHeight / height);
                        activeFrame.setZoom(zoomLevel);
                    }

                    if (frame?.spatialReference && frame !== activeFrame && frame.spatialTransformAST) {
                        positionImageSpace = transformPoint(frame.spatialTransformAST, positionImageSpace, true);
                    }

                    if (activeFrame.spatialReference && frame && !frame.spatialReference) {
                        activeFrame.setCenter(positionImageSpace.x, positionImageSpace.y, false);
                    } else {
                        activeFrame.setCenter(positionImageSpace.x, positionImageSpace.y);
                    }
                }
            }
        }
    };

    @action resetUserFilters() {
        const controlHeaders = this.catalogControlHeader;
        controlHeaders.forEach((value, key) => {
            value.filter = "";
        });
        this.filterDataSize = undefined;
    }

    private isInfinite(value: number) {
        return !isFinite(value) || value === AbstractCatalogProfileStore.NegativeInfinity || value === AbstractCatalogProfileStore.PositiveInfinity;
    }
}
