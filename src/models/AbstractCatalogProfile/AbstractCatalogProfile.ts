import {type Region, Regions} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {CatalogOverlay, CatalogSystemType, CatalogTextureType, CatalogType, CatalogUpdateMode} from "enums";
import {CatalogWebGLService} from "services";
import {AppStore, CatalogStore, type ControlHeader} from "stores";
import {
    CatalogAxisEligibility,
    filterProcessedColumnData,
    getCatalogAxisEligibility,
    getComparisonOperatorAndValue,
    getHasFilter,
    isCatalogLatitudeAxis,
    minMaxArray,
    parseCoordinateValue,
    type ProcessedColumnData,
    rejectOutOfRangeLatitude,
    resolveDescriptorForAxis,
    transformPoint,
    type TypedArray
} from "utilities";

export interface CatalogInfo {
    fileId: number;
    fileInfo: CARTA.CatalogFileInfo.$Properties;
    dataSize: number;
    directory: string;
}

/**
 * Converts a column to numeric coordinates for the axis it has been bound to. This is the one
 * place where an ambiguous format (a bare "12:30:00", which is hours on RA and degrees elsewhere)
 * is resolved, because it is the first point at which the axis is known.
 */
function getCatalogCoordinateData(column: ProcessedColumnData | undefined, units: string | null | undefined, axis: CatalogOverlay): Array<number> | undefined {
    if (!column) {
        return undefined;
    }

    const eligibility = getCatalogAxisEligibility(column.dataType, units, column.dataType === CARTA.ColumnType.String ? (column.data as Array<string | null | undefined>) : undefined);
    if (eligibility.status !== CatalogAxisEligibility.Eligible) {
        return undefined;
    }

    // Applied to numeric columns too: a declination of -91 breaks the transform the same way
    // whether it arrived as a number or as a string.
    const isLatitude = isCatalogLatitudeAxis(axis);

    if (!eligibility.descriptor) {
        const numericData = column.data as Array<number>;
        return isLatitude ? numericData.map(rejectOutOfRangeLatitude) : numericData;
    }

    const descriptor = resolveDescriptorForAxis(eligibility.descriptor, axis);
    return (column.data as Array<string | null | undefined>).map(value => {
        const degrees = parseCoordinateValue(value, descriptor);
        return isLatitude ? rejectOutOfRangeLatitude(degrees) : degrees;
    });
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
    abstract setMaxRows(maxRows: number): void;
    abstract setSortingInfo(columnName: string, sortingType: CARTA.SortingType, columnIndex?: number): void;

    @observable isLoadingData: boolean = false;
    @observable catalogType: CatalogType = CatalogType.SIMBAD;
    @observable catalogFilterRequest: CARTA.CatalogFilterRequest.$Properties = {};
    @observable catalogCoordinateSystem: {system: CatalogSystemType; equinox: string | null | undefined; epoch: string | null | undefined; coordinate: {x: CatalogOverlay; y: CatalogOverlay} | undefined} = {
        system: CatalogSystemType.ICRS,
        equinox: null,
        epoch: null,
        coordinate: {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}
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

    private _catalogData: Map<number, ProcessedColumnData>;
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
        return this._catalogData;
    }

    get systemCoordinateMap(): Map<CatalogSystemType, {x: CatalogOverlay; y: CatalogOverlay}> {
        return this._systemCoordinateMap;
    }

    clearData() {
        this.catalogData.clear();
    }

    public static getCatalogSystem(system: string | null | undefined): CatalogSystemType {
        let catalogSystem = CatalogSystemType.ICRS;
        const systemMap = AbstractCatalogProfileStore.COORDINATE_SYSTEM_NAME;
        systemMap.forEach((value, key) => {
            if (system?.toUpperCase().includes(value.toUpperCase())) {
                catalogSystem = key;
            }
        });
        return catalogSystem;
    }

    public get2DPlotData(
        xColumnName: string,
        yColumnName: string,
        columnsData: Map<number, ProcessedColumnData>
    ): {wcsX?: Array<number>; wcsY?: Array<number>; xHeaderInfo: CARTA.CatalogHeader.$Properties; yHeaderInfo: CARTA.CatalogHeader.$Properties} {
        const controlHeader = this.catalogControlHeader;
        const xHeader = controlHeader.get(xColumnName);
        const yHeader = controlHeader.get(yColumnName);
        const xHeaderInfo = this.catalogHeader[xHeader?.dataIndex ?? NaN];
        const yHeaderInfo = this.catalogHeader[yHeader?.dataIndex ?? NaN];

        const xColumn = columnsData.get(xHeaderInfo.columnIndex);
        const yColumn = columnsData.get(yHeaderInfo.columnIndex);
        const wcsX = getCatalogCoordinateData(xColumn, xHeaderInfo.units, this.activedSystem?.x ?? CatalogOverlay.X);
        const wcsY = getCatalogCoordinateData(yColumn, yHeaderInfo.units, this.activedSystem?.y ?? CatalogOverlay.Y);

        if (wcsX && wcsY) {
            return {wcsX, wcsY, xHeaderInfo, yHeaderInfo};
        } else {
            return {xHeaderInfo, yHeaderInfo};
        }
    }

    public get1DPlotData(column: string): {wcsData?: TypedArray; headerInfo: CARTA.CatalogHeader.$Properties} {
        const controlHeader = this.catalogControlHeader;
        const header = controlHeader.get(column);
        const headerInfo = this.catalogHeader[header?.dataIndex ?? NaN];
        const xColumn = this.catalogData.get(headerInfo.columnIndex);
        if (xColumn && xColumn.dataType !== CARTA.ColumnType.String && xColumn.dataType !== CARTA.ColumnType.Bool) {
            const wcsData = xColumn.data as TypedArray;
            return {wcsData, headerInfo};
        } else {
            return {headerInfo};
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

    @computed get displayedColumnHeaders(): Array<CARTA.CatalogHeader> {
        const displayedColumnHeaders: CARTA.CatalogHeader[] = [];
        this.catalogControlHeader.forEach((value, key) => {
            if (value.display && this.catalogHeader && value.dataIndex !== undefined) {
                displayedColumnHeaders.push(this.catalogHeader[value.dataIndex]);
            }
        });
        return displayedColumnHeaders;
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
        const current = this.catalogCoordinateSystem;
        this.catalogCoordinateSystem = {
            system: catalogSystem,
            equinox: current.equinox,
            epoch: current.epoch,
            coordinate: this.systemCoordinateMap.get(catalogSystem)
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
