import {action, computed, observable, makeObservable} from "mobx";
import {Regions, IRegion} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {AppStore, CatalogStore, PreferenceStore} from "stores";
import {filterProcessedColumnData, minMaxArray} from "utilities";
import {ProcessedColumnData, TypedArray} from "models";

export interface CatalogInfo {
    fileId: number;
    fileInfo: CARTA.ICatalogFileInfo;
    dataSize: number;
    directory: string;
}

export enum CatalogCoordinate {
    X = "X",
    Y = "Y",
    PlotSize = "Size",
    PlotShape = "Shape",
    NONE = "None",
}

export enum CatalogOverlay {
    X = "X",
    Y = "Y",
    NONE = "None",
    RA = "RA",
    DEC = "DEC",
    GLAT = "GLAT",
    GLON = "GLON",
    ELON = "ELON",
    ELAT = "ELAT",
    X0 = "X0",
    Y0 = "Y0",
    X1 = "X1",
    Y1 = "Y1",
}

export enum CatalogUpdateMode {
    TableUpdate = "TableUpdate",
    ViewUpdate = "ViewUpdate",
    PlotsUpdate = "PlotsUpdate"
}

export enum CatalogSystemType {
    Ecliptic = "ECLIPTIC",
    FK4 = "FK4",
    FK5 = "FK5",
    Galactic = "GALACTIC",
    ICRS = "ICRS",
    Pixel0 = "Pixel0",
    Pixel1 = "Pixel1",
}

export type ControlHeader = { columnIndex: number, dataIndex: number, display: boolean, filter: string, columnWidth: number };

export class CatalogProfileStore {
    public static readonly InitTableRows = 50;
    public readonly CoordinateSystemName = new Map<CatalogSystemType, string>([
        [CatalogSystemType.FK5, "FK5"],
        [CatalogSystemType.FK4, "FK4"],
        [CatalogSystemType.Galactic, "GAL"],
        [CatalogSystemType.Ecliptic, "ECL"],
        [CatalogSystemType.ICRS, "ICRS"],
        [CatalogSystemType.Pixel0, "PIX0"],
        [CatalogSystemType.Pixel1, "PIX1"]
    ]);
    private static readonly DataChunkSize = 50;
    // Number.NEGATIVE_INFINITY -1.797693134862316E+308
    private static readonly NEGATIVE_INFINITY = -1.7976931348623157e+308;
    private static readonly POSITIVE_INFINITY = 1.7976931348623157e+308;
    private systemCoordinateMap = new Map<CatalogSystemType, { x: CatalogOverlay, y: CatalogOverlay }>([
        [CatalogSystemType.FK4, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
        [CatalogSystemType.FK5, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
        [CatalogSystemType.ICRS, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
        [CatalogSystemType.Galactic, {x: CatalogOverlay.GLON, y: CatalogOverlay.GLAT}],
        [CatalogSystemType.Ecliptic, {x: CatalogOverlay.ELON, y: CatalogOverlay.ELAT}],
        [CatalogSystemType.Pixel0, {x: CatalogOverlay.X0, y: CatalogOverlay.Y0}],
        [CatalogSystemType.Pixel1, {x: CatalogOverlay.X1, y: CatalogOverlay.Y1}],
    ]);

    private readonly InitialedColumnsKeyWords = [
        "ANGULAR DISTANCE",
        "MAIN IDENTIFIER",
        "RADIAL VELOCITY",
        "REDSHIFT"];
    private readonly InitialedExcludeColumnsKeyWords = [
        "PROPER MOTION",
        "SIGMA"
    ];
    private InitialedRAColumnsKeyWords = [
        "RIGHT ASCENSION", "RA", "R.A"
    ];
    private InitialedDECColumnsKeyWords = [
        "DECLINATION", "DEC", "Dec."
    ];

    @observable progress: number;
    @observable catalogInfo: CatalogInfo;
    @observable catalogControlHeader: Map<string, ControlHeader>;
    @observable catalogHeader: Array<CARTA.ICatalogHeader>;
    @observable catalogData: Map<number, ProcessedColumnData>;
    @observable loadingData: boolean;
    @observable numVisibleRows: number;
    @observable subsetEndIndex: number;
    @observable updatingDataStream: boolean;
    @observable updateMode: CatalogUpdateMode;
    @observable catalogFilterRequest: CARTA.CatalogFilterRequest;
    @observable catalogCoordinateSystem: { system: CatalogSystemType, equinox: string, epoch: string, coordinate: { x: CatalogOverlay, y: CatalogOverlay } };
    @observable selectedPointIndices: number[];
    @observable filterDataSize: number;
    @observable updateTableView: boolean;
    @observable sortingInfo: {columnName: string, sortingType: CARTA.SortingType};
    @observable maxRows: number;

    constructor(catalogInfo: CatalogInfo, catalogHeader: Array<CARTA.ICatalogHeader>, catalogData: Map<number, ProcessedColumnData>) {
        makeObservable(this);
        this.catalogInfo = catalogInfo;
        this.catalogHeader = catalogHeader.sort((a, b) => {
            return (a.columnIndex - b.columnIndex);
        });
        this.catalogData = catalogData;
        this.catalogControlHeader = this.initCatalogControlHeader;
        this.loadingData = false;
        this.catalogFilterRequest = this.initCatalogFilterRequest;
        this.updatingDataStream = false;
        this.updateMode = CatalogUpdateMode.TableUpdate;
        this.selectedPointIndices = [];
        this.filterDataSize = undefined;

        this.updateTableView = false;
        this.sortingInfo = {columnName: null, sortingType: null};
        this.maxRows = catalogInfo.dataSize;

        const coordinateSystem = catalogInfo.fileInfo.coosys[0];

        if (coordinateSystem) {
            const system = this.getCatalogSystem(coordinateSystem.system);
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

    @action setCatalogCoordinateSystem(catalogSystem: CatalogSystemType) {
        const current = this.catalogCoordinateSystem;
        this.catalogCoordinateSystem = {
            system: catalogSystem,
            equinox: current.equinox,
            epoch: current.epoch,
            coordinate: this.systemCoordinateMap.get(catalogSystem)
        };
    }

    @computed get activedSystem(): {x: CatalogOverlay, y: CatalogOverlay} {
        return this.systemCoordinateMap.get(this.catalogCoordinateSystem.system);
    }

    @action setUserFilter(catalogFilterRequest: CARTA.CatalogFilterRequest) {
        this.catalogFilterRequest = catalogFilterRequest;
    }

    @action setProgress(val: number) {
        this.progress = val;
    }

    @action setCatalogHeader(catalogHeader: Array<CARTA.CatalogHeader>) {
        this.catalogHeader = catalogHeader;
    }

    @action setUpdateMode(mode: CatalogUpdateMode) {
        this.updateMode = mode;
    }

    @action setSortingInfo(columnName: string, sortingType: CARTA.SortingType) {
        this.sortingInfo = {columnName, sortingType};
    }

    private static  FillAllocatedArray<T>(existingArray: Array<T>, newArray: Array<T>, insertionIndex: number, allocationSize: number): Array<T> {
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
        let subsetDataSize = catalogFilter.subsetDataSize;
        const subsetEndIndex = catalogFilter.subsetEndIndex;
        const startIndex = subsetEndIndex - subsetDataSize;

        const totalDataSize = catalogFilter.requestEndIndex;
        this.filterDataSize = catalogFilter.filterDataSize;

        if (this.subsetEndIndex <= this.filterDataSize) {
            let numVisibleRows = this.numVisibleRows + subsetDataSize;
            catalogData.forEach(((newData, key) => {
                let currentData = this.catalogData.get(key);
                if (!currentData) {
                    this.catalogData.set(key, newData);
                } else {
                    if (currentData.dataType === CARTA.ColumnType.String) {
                        const currentArr = currentData.data as Array<string>;
                        const newArr = newData.data as Array<string>;
                        currentData.data = CatalogProfileStore.FillAllocatedArray<string>(currentArr, newArr, startIndex, totalDataSize);
                    } else if (currentData.dataType === CARTA.ColumnType.Bool) {
                        const currentArr = currentData.data as Array<boolean>;
                        const newArr = newData.data as Array<boolean>;
                        currentData.data = CatalogProfileStore.FillAllocatedArray<boolean>(currentArr, newArr, startIndex, totalDataSize);
                    } else if (currentData.dataType === CARTA.ColumnType.UnsupportedType) {
                        return;
                    } else {
                        const currentArr = currentData.data as Array<number>;
                        const newArr = newData.data as Array<number>;
                        currentData.data = CatalogProfileStore.FillAllocatedArray<number>(currentArr, newArr, startIndex, totalDataSize);
                    }

                }
            }));
            this.setNumVisibleRows(numVisibleRows);
            this.subsetEndIndex = subsetEndIndex;
        }
    }

    @action clearData() {
        this.catalogData.clear();
    }

    @action setHeaderDisplay(val: boolean, columnName: string) {
        this.catalogControlHeader.get(columnName).display = val;
    }

    @action.bound setTableColumnWidth(width: number, columnName: string) {
        this.catalogControlHeader.get(columnName).columnWidth = width;
    }

    @action setColumnFilter = (filter: string, columnName: string) => {
        const current = this.catalogControlHeader.get(columnName);
        const newHeader: ControlHeader = {
            columnIndex: current.columnIndex,
            dataIndex: current.dataIndex,
            display: current.display,
            filter: filter,
            columnWidth: current.columnWidth
        };
        this.catalogControlHeader.set(columnName, newHeader);
        this.updateTableStatus(true);
    }

    @action updateTableStatus(val: boolean) {
        this.updateTableView = val;
    }

    @action.bound setNumVisibleRows(val: number) {
        this.numVisibleRows = val;
    }

    @action setSubsetEndIndex(val: number) {
        this.subsetEndIndex = val;
    }

    @action setLoadingDataStatus(val: boolean) {
        this.loadingData = val;
    }

    @action setUpdatingDataStream(val: boolean) {
        this.updatingDataStream = val;
    }

    @action resetCatalogFilterRequest = () => {
        this.resetFilterRequestControlParams();
        this.resetUserFilters();
        this.loadingData = false;
        this.catalogFilterRequest = this.initCatalogFilterRequest;
        this.updatingDataStream = false;
        this.sortingInfo.columnName = null;
        this.sortingInfo.sortingType = null;
        this.maxRows = this.catalogInfo.dataSize;
    }

    @action resetFilterRequestControlParams() {
        this.setUpdateMode(CatalogUpdateMode.TableUpdate);
        this.clearData();
        this.setNumVisibleRows(0);
        this.setSubsetEndIndex(0);
        this.setLoadingDataStatus(true);
    }

    @computed get loadOntoImage() {
        return (this.loadingData || this.updatingDataStream);
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

    @action resetUserFilters() {
        const controlHeaders = this.catalogControlHeader;
        controlHeaders.forEach((value, key) => {
            value.filter = "";
        });
        this.filterDataSize = undefined;
    }

    @action setSelectedPointIndices = (pointIndices: Array<number>, autoPanZoom: boolean) => {
        this.selectedPointIndices = pointIndices;
        const coordsArray = CatalogStore.Instance.catalogGLData.get(this.catalogFileId);
        if (coordsArray?.dataPoints?.length) {
            let selectedX = [];
            let selectedY = [];
            const selectedData = new Float32Array(pointIndices.length * 4)
            for (let index = 0; index < pointIndices.length; index++) {
                const pointIndex = pointIndices[index];
                const x = coordsArray.dataPoints[pointIndex * 4];
                const y = coordsArray.dataPoints[pointIndex * 4 + 1];
                const size = coordsArray.dataPoints[pointIndex * 4 + 2];
                if (!this.isInfinite(x) && !this.isInfinite(y)) {
                    selectedX.push(x);
                    selectedY.push(y);
                }
                selectedData[index * 4] = x;
                selectedData[index * 4 + 1] = y;
                selectedData[index * 4 + 2] = size;
                // selectedData[index * 4 + 3] = 0.5; 
            }
            CatalogStore.Instance.updateSelectedPoints(this.catalogFileId, selectedData);

            if (autoPanZoom) {
                const selectedDataLength = selectedX.length;
                if (selectedDataLength === 1) {
                    const x = selectedX[0];
                    const y = selectedY[0];
                    AppStore.Instance.activeFrame.setCenter(x, y);      
                }

                if (selectedDataLength > 1) {
                    const minMaxX = minMaxArray(selectedX);
                    const minMaxY = minMaxArray(selectedY);
                    const width = minMaxX.maxVal - minMaxX.minVal;
                    const height = minMaxY.maxVal - minMaxY.minVal;
                    AppStore.Instance.activeFrame.setCenter(width / 2 + minMaxX.minVal, height / 2 + minMaxY.minVal);
                    const zoomLevel = Math.min(AppStore.Instance.activeFrame.renderWidth / width, AppStore.Instance.activeFrame.renderHeight / height);
                    AppStore.Instance.activeFrame.setZoom(zoomLevel);   
                }

            }
        }
    }

    @action setMaxRows(maxRows: number) {
        this.updateTableStatus(true);   
        this.maxRows = maxRows;
    }

    @computed get displayedColumnHeaders(): Array<CARTA.CatalogHeader> {
        let displayedColumnHeaders = [];
        this.catalogControlHeader.forEach((value, key) => {
            if (value.display && this.catalogHeader) {
                displayedColumnHeaders.push(this.catalogHeader[value.dataIndex]);
            }
        });
        return displayedColumnHeaders;
    }

    @computed get tableColumnWidts(): Array<number> {
        const columnWidts = [];
        this.catalogControlHeader.forEach((value, key) => {
            if (value.display) {
                columnWidts.push(value.columnWidth);
            }
        });
        return columnWidts;
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

    @computed get hasFilter(): boolean {
        let filters = [];
        this.catalogControlHeader.forEach((value, key) => {
            if (value.filter) {
                filters.push(value);
            }
        });
        return filters.length > 0;
    }

    @computed get selectedData(): Map<number, ProcessedColumnData> {
        let catalogColumnsData = this.catalogData;
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

    @computed get regionSelected(): number {
        return this.selectedPointIndices.length;
    }

    @computed get autoScrollRowNumber(): IRegion {
        let singleRowRegion: IRegion = Regions.row(0);
        if (this.selectedPointIndices.length > 0) {
            singleRowRegion = Regions.row(this.selectedPointIndices[0]);
        }
        return singleRowRegion;
    }

    @computed get catalogFileId(): number {
        return this.catalogInfo.fileId;
    }

    public get2DPlotData(xColumnName: string, yColumnName: string, columnsData: Map<number, ProcessedColumnData>): { wcsX?: Array<number>, wcsY?: Array<number>, xHeaderInfo: CARTA.ICatalogHeader, yHeaderInfo: CARTA.ICatalogHeader } {
        const controlHeader = this.catalogControlHeader;
        const xHeader = controlHeader.get(xColumnName);
        const yHeader = controlHeader.get(yColumnName);
        const xHeaderInfo = this.catalogHeader[xHeader.dataIndex];
        const yHeaderInfo = this.catalogHeader[yHeader.dataIndex];

        const xColumn = columnsData.get(xHeaderInfo.columnIndex);
        const yColumn = columnsData.get(yHeaderInfo.columnIndex);

        if (xColumn && xColumn.dataType !== CARTA.ColumnType.String && xColumn.dataType !== CARTA.ColumnType.Bool &&
            yColumn && yColumn.dataType !== CARTA.ColumnType.String && yColumn.dataType !== CARTA.ColumnType.Bool) {
            const wcsX = xColumn.data as Array<number>;
            const wcsY = yColumn.data as Array<number>;
            return {wcsX, wcsY, xHeaderInfo, yHeaderInfo};
        } else {
            return {xHeaderInfo, yHeaderInfo};
        }
    }

    public get1DPlotData(column: string): { wcsData?: TypedArray, headerInfo: CARTA.ICatalogHeader } {
        const controlHeader = this.catalogControlHeader;
        const header = controlHeader.get(column);
        const headerInfo = this.catalogHeader[header.dataIndex];
        const xColumn = this.catalogData.get(headerInfo.columnIndex);
        if (xColumn && xColumn.dataType !== CARTA.ColumnType.String && xColumn.dataType !== CARTA.ColumnType.Bool) {
            const wcsData = xColumn.data as TypedArray;
            return {wcsData, headerInfo};
        } else {
            return {headerInfo};
        }
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

    private getCatalogSystem(system: string): CatalogSystemType {
        let catalogSystem = CatalogSystemType.ICRS;
        const systemMap = this.CoordinateSystemName;
        systemMap.forEach((value, key) => {
            if (system.toUpperCase().includes(value.toUpperCase())) {
                catalogSystem = key;
            }
        });
        return catalogSystem;
    }

    private isInfinite(value: number) {
        return (
            !isFinite(value) || 
            value === CatalogProfileStore.NEGATIVE_INFINITY || 
            value === CatalogProfileStore.POSITIVE_INFINITY
        );
    }
}