import {action, computed, observable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {Table, Regions, IRegion} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {RegionWidgetStore, RegionsType} from "./RegionWidgetStore";
import {AppStore, CatalogStore, SystemType} from "stores";
import {filterProcessedColumnData, minMaxArray} from "utilities";
import {ProcessedColumnData} from "models";

export interface CatalogInfo {
    fileId: number;
    fileInfo: CARTA.ICatalogFileInfo;
    dataSize: number;
}

export enum CatalogOverlay {
    X = "X",
    Y = "Y",
    PlotSize = "Size",
    PlotShape = "Shape",
    NONE = "None",
    RA = "RA",
    DEC = "DEC",
    GLAT = "GLAT",
    GLON = "GLON",
    ELON = "ELON",
    ELAT = "ELAT"
}

export enum CatalogOverlayShape {
    Circle = "circle-open",
    FullCircle = "circle",
    Star = "star-open",
    FullStar = "star",
    Square = "square-open",
    Plus = "cross-thin-open",
    Cross = "x-thin-open",
    TriangleUp = "triangle-up-open",
    TriangleDown = "triangle-down-open",
    Diamond = "diamond-open",
    hexagon2 = "hexagon2-open",
    hexagon = "hexagon-open",
}

export enum CatalogUpdateMode {
    TableUpdate = "TableUpdate",
    ViewUpdate = "ViewUpdate",
    PlotsUpdate = "PlotsUpdate"
}

export enum CatalogPlotType {
    ImageOverlay = "as image overlay",
    // 1DHistogram = "as 1D histogram",
    D2Scatter = "as 2D scatter",
    // D3Scatter = "as 3D scatter",
}

export type ControlHeader = { columnIndex: number, dataIndex: number, display: boolean, representAs: CatalogOverlay, filter: string, columnWidth: number };

export class CatalogOverlayWidgetStore extends RegionWidgetStore {

    public static readonly InitTableRows = 50;
    private static readonly DataChunkSize = 50;
    private static readonly InitDisplayedColumnSize = 10;
    // Number.NEGATIVE_INFINITY -1.797693134862316E+308
    private static readonly NEGATIVE_INFINITY = -1.7976931348623157e+308;
    private static readonly POSITIVE_INFINITY = 1.7976931348623157e+308;
    private readonly CoordinateSystemName = new Map<SystemType, string>([
        [SystemType.FK5, "FK5"],
        [SystemType.FK4, "FK4"],
        [SystemType.Galactic, "GAL"],
        [SystemType.Ecliptic, "ECL"],
        [SystemType.ICRS, "ICRS"],
    ]);
    private systemCoordinateMap = new Map<SystemType, { x: CatalogOverlay, y: CatalogOverlay }>([
        [SystemType.FK4, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
        [SystemType.FK5, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
        [SystemType.ICRS, {x: CatalogOverlay.RA, y: CatalogOverlay.DEC}],
        [SystemType.Galactic, {x: CatalogOverlay.GLON, y: CatalogOverlay.GLAT}],
        [SystemType.Ecliptic, {x: CatalogOverlay.ELON, y: CatalogOverlay.ELAT}],
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

    @observable storeId: string;
    @observable progress: number;
    @observable catalogInfo: CatalogInfo;
    @observable catalogControlHeader: Map<string, ControlHeader>;
    @observable catalogHeader: Array<CARTA.ICatalogHeader>;
    @observable catalogData: Map<number, ProcessedColumnData>;
    @observable loadingData: boolean;
    @observable numVisibleRows: number;
    @observable headerTableColumnWidts: Array<number>;
    @observable dataTableColumnWidts: Array<number>;
    @observable catalogSize: number;
    @observable catalogColor: string;
    @observable catalogShape: CatalogOverlayShape;
    @observable subsetEndIndex: number;
    @observable updatingDataStream: boolean;
    @observable updateMode: CatalogUpdateMode;
    @observable catalogFilterRequest: CARTA.CatalogFilterRequest;
    @observable catalogCoordinateSystem: { system: SystemType, equinox: string, epoch: string, coordinate: { x: CatalogOverlay, y: CatalogOverlay } };
    @observable catalogPlotType: CatalogPlotType;
    @observable catalogScatterWidgetsId: string[];
    @observable selectedPointIndices: number[];
    @observable filterDataSize: number;
    @observable showSelectedData: boolean;
    @observable catalogTableRef: Table;
    @observable updateTableView: boolean;
    @observable sortingInfo: {columnName: string, sortingType: CARTA.SortingType};
    @observable maxRows: number;

    constructor(catalogInfo: CatalogInfo, catalogHeader: Array<CARTA.ICatalogHeader>, catalogData: Map<number, ProcessedColumnData>, id: string) {
        super(RegionsType.CLOSED_AND_POINT);
        this.storeId = id;
        this.catalogInfo = catalogInfo;
        this.catalogHeader = catalogHeader.sort((a, b) => {
            return (a.columnIndex - b.columnIndex);
        });
        this.catalogData = catalogData;
        this.catalogControlHeader = this.initCatalogControlHeader;
        this.loadingData = false;
        this.catalogColor = Colors.TURQUOISE3;
        this.catalogSize = 5;
        this.catalogShape = CatalogOverlayShape.Circle;
        this.catalogFilterRequest = this.initCatalogFilterRequest;
        this.updatingDataStream = false;
        this.updateMode = CatalogUpdateMode.TableUpdate;
        this.headerTableColumnWidts = [75, 75, 65, 100, null];
        this.catalogScatterWidgetsId = [];
        this.selectedPointIndices = [];
        this.filterDataSize = undefined;
        this.showSelectedData = false;
        this.catalogTableRef = undefined;
        this.updateTableView = false;
        this.sortingInfo = {columnName: null, sortingType: null};
        this.maxRows = catalogInfo.dataSize;

        this.catalogPlotType = CatalogPlotType.ImageOverlay;
        const coordinateSystem = catalogInfo.fileInfo.coosys[0];

        if (coordinateSystem) {
            const system = this.getCatalogSystem(coordinateSystem.system);
            this.catalogCoordinateSystem = {
                system: system,
                equinox: coordinateSystem.equinox,
                epoch: coordinateSystem.epoch,
                coordinate: this.systemCoordinateMap.get(SystemType.ICRS)
            };
        } else {
            this.catalogCoordinateSystem = {
                system: SystemType.ICRS,
                equinox: null,
                epoch: null,
                coordinate: this.systemCoordinateMap.get(SystemType.ICRS)
            };
        }

        const initTableRows = CatalogOverlayWidgetStore.InitTableRows;
        if (catalogInfo.dataSize < initTableRows) {
            this.numVisibleRows = catalogInfo.dataSize;
            this.subsetEndIndex = catalogInfo.dataSize;
        } else {
            this.numVisibleRows = initTableRows;
            this.subsetEndIndex = initTableRows;
        }
    }

    @action setCatalogTableRef(ref: Table) {
        this.catalogTableRef = ref;
    }

    @action setShowSelectedData(val: boolean) {
        this.showSelectedData = val;
    }

    @action setCatalogScatterWidget(id: string) {
        this.catalogScatterWidgetsId.push(id);
    }

    @action updateCatalogScatterWidget(id: string) {
        this.catalogScatterWidgetsId = this.catalogScatterWidgetsId.filter(scatterWidgetsId => scatterWidgetsId !== id);
    }

    @action setCatalogPlotType(type: CatalogPlotType) {
        this.catalogPlotType = type;
    }

    @action setCatalogCoordinateSystem(catalogSystem: SystemType) {
        this.catalogCoordinateSystem.system = catalogSystem;
        const x = this.xColumnRepresentation;
        const y = this.yColumnRepresentation;
        if (x) {
            this.catalogControlHeader.get(x).representAs = CatalogOverlay.NONE;
        }
        if (y) {
            this.catalogControlHeader.get(y).representAs = CatalogOverlay.NONE;
        }
        this.catalogCoordinateSystem.coordinate = this.systemCoordinateMap.get(catalogSystem);
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
        console.time(`updateCatalogData_${subsetDataSize}`);
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
                        currentData.data = CatalogOverlayWidgetStore.FillAllocatedArray<string>(currentArr, newArr, startIndex, totalDataSize);
                    } else if (currentData.dataType === CARTA.ColumnType.Bool) {
                        const currentArr = currentData.data as Array<boolean>;
                        const newArr = newData.data as Array<boolean>;
                        currentData.data = CatalogOverlayWidgetStore.FillAllocatedArray<boolean>(currentArr, newArr, startIndex, totalDataSize);
                    } else if (currentData.dataType === CARTA.ColumnType.UnsupportedType) {
                        return;
                    } else {
                        const currentArr = currentData.data as Array<number>;
                        const newArr = newData.data as Array<number>;
                        currentData.data = CatalogOverlayWidgetStore.FillAllocatedArray<number>(currentArr, newArr, startIndex, totalDataSize);
                    }

                }
            }));
            this.setNumVisibleRows(numVisibleRows);
            this.subsetEndIndex = subsetEndIndex;
        }
        console.timeEnd(`updateCatalogData_${subsetDataSize}`);
    }

    @action clearData() {
        this.catalogData.clear();
    }

    @action setHeaderDisplay(val: boolean, columnName: string) {
        this.catalogControlHeader.get(columnName).display = val;
    }

    @action setHeaderRepresentation(val: CatalogOverlay, columnName: string) {
        const current = this.catalogControlHeader.get(columnName);
        if (val !== current.representAs) {
            switch (val) {
                case CatalogOverlay.X:
                    const currentX = this.xColumnRepresentation;
                    if (currentX) {
                        this.catalogControlHeader.get(currentX).representAs = CatalogOverlay.NONE;
                    }
                    break;
                case CatalogOverlay.Y:
                    const currentY = this.yColumnRepresentation;
                    if (currentY) {
                        this.catalogControlHeader.get(currentY).representAs = CatalogOverlay.NONE;
                    }
                    break;
                case CatalogOverlay.PlotSize:
                    const currentSize = this.sizeColumnRepresentation;
                    if (currentSize) {
                        this.catalogControlHeader.get(currentSize).representAs = CatalogOverlay.NONE;
                    }
                    break;
                case CatalogOverlay.PlotShape:
                    const currentShape = this.shapeColumnRepresentation;
                    if (currentShape) {
                        this.catalogControlHeader.get(currentShape).representAs = CatalogOverlay.NONE;
                    }
                    break;
                default:
                    break;
            }
            const newHeader: ControlHeader = {
                columnIndex: current.columnIndex,
                dataIndex: current.dataIndex,
                display: current.display,
                representAs: val,
                filter: current.filter,
                columnWidth: current.columnWidth
            };
            this.catalogControlHeader.set(columnName, newHeader);
        }
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
            representAs: current.representAs,
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

    @action setRegionId = (fileId: number, regionId: number) => {
        this.regionIdMap.set(fileId, regionId);
    };

    @action setHeaderTableColumnWidts(vals: Array<number>) {
        this.headerTableColumnWidts = vals;
    }

    @action setDataTableColumnWidts(vals: Array<number>) {
        this.dataTableColumnWidts = vals;
    }

    @action setCatalogSize(szie: number) {
        this.catalogSize = szie;
    }

    @action setCatalogColor(color: string) {
        this.catalogColor = color;
    }

    @action setCatalogShape(shape: CatalogOverlayShape) {
        this.catalogShape = shape;
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

    @action resetSelectedPointIndices () {
        this.setSelectedPointIndices([], false, false);
        this.setShowSelectedData(false);
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
                // this.findKeywords(header.description) init displayed according discription
                if (index < CatalogOverlayWidgetStore.InitDisplayedColumnSize) {
                    display = true;
                }
                let controlHeader: ControlHeader = {columnIndex: header.columnIndex, dataIndex: index, display: display, representAs: CatalogOverlay.NONE, filter: "", columnWidth: null};
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

    @action setSelectedPointIndices = (pointIndices: Array<number>, autoScroll: boolean, autoPanZoom: boolean) => {
        this.selectedPointIndices = pointIndices;
        const catalogComponentSize = AppStore.Instance.widgetsStore.catalogComponentSize();
        if (pointIndices.length > 0 && this.catalogTableRef && autoScroll && catalogComponentSize) {
            this.catalogTableRef.scrollToRegion(this.autoScrollRowNumber);
        }

        const coords = CatalogStore.Instance.catalogData.get(this.storeId);
        if (coords?.xImageCoords?.length) {
            let selectedX = [];
            let selectedY = [];
            for (let index = 0; index < pointIndices.length; index++) {
                const pointIndex = pointIndices[index];
                const x = coords.xImageCoords[pointIndex];
                const y = coords.yImageCoords[pointIndex];
                if (!this.isInfinite(x) && !this.isInfinite(y)) {
                    selectedX.push(x);
                    selectedY.push(y);
                }
            }
            CatalogStore.Instance.updateSelectedPoints(this.storeId, selectedX, selectedY);

            if (autoPanZoom) {
                if (pointIndices.length === 1) {
                    const pointIndex = pointIndices[0];
                    const x = coords.xImageCoords[pointIndex];
                    const y = coords.yImageCoords[pointIndex];
                    if (!this.isInfinite(x) && !this.isInfinite(y)) {
                        AppStore.Instance.activeFrame.setCenter(x, y);      
                    } 
                }

                if (pointIndices.length > 1) {
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
    };

    @action setMaxRows(maxRows: number) {
        if (this.maxRows > maxRows) {
            this.updateTableStatus(true);   
        }
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
        let previewDatasize = CatalogOverlayWidgetStore.InitTableRows;
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
            let subsetDataSize = CatalogOverlayWidgetStore.DataChunkSize;
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

    @computed get enableLoadButton(): boolean {
        return (this.xColumnRepresentation !== null && this.yColumnRepresentation !== null && !this.loadingData && !this.updatingDataStream);
    }

    @computed get xColumnRepresentation(): string {
        let xColumn = null;
        this.catalogControlHeader.forEach((value, key) => {
            if (value.representAs === CatalogOverlay.X) {
                xColumn = key;
            }
        });
        return xColumn;
    }

    @computed get yColumnRepresentation(): string {
        let yColumn = null;
        this.catalogControlHeader.forEach((value, key) => {
            if (value.representAs === CatalogOverlay.Y) {
                yColumn = key;
            }
        });
        return yColumn;
    }

    @computed get sizeColumnRepresentation(): string {
        let sizeColumn = null;
        this.catalogControlHeader.forEach((value, key) => {
            if (value.representAs === CatalogOverlay.PlotSize) {
                sizeColumn = key;
            }
        });
        return sizeColumn;
    }

    @computed get shapeColumnRepresentation(): string {
        let shapeColumn = null;
        this.catalogControlHeader.forEach((value, key) => {
            if (value.representAs === CatalogOverlay.PlotShape) {
                shapeColumn = key;
            }
        });
        return shapeColumn;
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
            if (value.filter !== undefined) {
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
        let singleRowRegion: IRegion = null;
        if (this.selectedPointIndices.length > 0) {
            singleRowRegion = Regions.row(this.selectedPointIndices[0]);
        }
        return singleRowRegion;
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

    public get1DPlotData(column: string): { wcsData?: Array<number>, headerInfo: CARTA.ICatalogHeader } {
        const controlHeader = this.catalogControlHeader;
        const header = controlHeader.get(column);
        const headerInfo = this.catalogHeader[header.dataIndex];
        const xColumn = this.catalogData.get(headerInfo.columnIndex);

        if (xColumn && xColumn.dataType !== CARTA.ColumnType.String && xColumn.dataType !== CARTA.ColumnType.Bool) {
            const wcsData = xColumn.data as Array<number>;
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

    private getCatalogSystem(system: string): SystemType {
        let catalogSystem = SystemType.ICRS;
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
            value === CatalogOverlayWidgetStore.NEGATIVE_INFINITY || 
            value === CatalogOverlayWidgetStore.POSITIVE_INFINITY
        );
    }
}