import {action, computed, observable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {Table, Regions, IRegion} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {RegionWidgetStore, RegionsType} from "./RegionWidgetStore";
import {AppStore, SystemType} from "stores";
import {getTableDataByType} from "utilities";

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
    private static readonly initDisplayedColumnSize = 10;
    private readonly CoordinateSystemName = new Map<SystemType, string>([
        [SystemType.FK5, "FK5"],
        [SystemType.FK4, "FK4"],
        [SystemType.Galactic, "GAL"],
        [SystemType.Ecliptic, "ECL"],
        [SystemType.ICRS, "ICRS"],
    ]);
    private systemCoordinateMap = new Map<SystemType, {x: CatalogOverlay, y: CatalogOverlay}>([
        [SystemType.FK4, {x : CatalogOverlay.RA, y : CatalogOverlay.DEC}],
        [SystemType.FK5, {x : CatalogOverlay.RA, y : CatalogOverlay.DEC}],
        [SystemType.ICRS, {x : CatalogOverlay.RA, y : CatalogOverlay.DEC}],
        [SystemType.Galactic, {x : CatalogOverlay.GLON, y : CatalogOverlay.GLAT}],
        [SystemType.Ecliptic, {x : CatalogOverlay.ELON, y : CatalogOverlay.ELAT}],
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
    @observable catalogData: CARTA.ICatalogColumnsData;
    @observable loadingData: boolean;
    @observable numVisibleRows: number;
    @observable headerTableColumnWidts: Array<number>;
    @observable dataTableColumnWidts: Array<number>;
    @observable catalogSize: number;
    @observable catalogColor: string;
    @observable catalogShape: CatalogOverlayShape;
    @observable subsetEndIndex: number;
    @observable plotingData: boolean;
    @observable updateMode: CatalogUpdateMode;
    @observable userFilters: CARTA.CatalogFilterRequest;
    @observable catalogCoordinateSystem: {system: SystemType, equinox: string, epoch: string, coordinate: {x: CatalogOverlay, y: CatalogOverlay}};
    @observable catalogPlotType: CatalogPlotType;
    @observable catalogScatterWidgetsId: string[];
    @observable selectedPointIndexs: number[];
    @observable filterDataSize: number;
    @observable showSelectedData: boolean;
    @observable catalogTableRef: Table;

    constructor(catalogInfo: CatalogInfo, catalogHeader: Array<CARTA.ICatalogHeader>, catalogData: CARTA.ICatalogColumnsData, id: string) {
        super(RegionsType.CLOSED_AND_POINT);
        this.storeId = id;
        this.catalogInfo = catalogInfo;
        this.catalogHeader = catalogHeader.sort((a, b) => { return (a.columnIndex - b.columnIndex); });
        this.catalogData = catalogData;
        this.catalogControlHeader = this.initCatalogControlHeader;
        this.loadingData = false;
        this.catalogColor = Colors.TURQUOISE3;
        this.catalogSize = 5;
        this.catalogShape = CatalogOverlayShape.Circle;
        this.userFilters = this.initUserFilters;
        this.plotingData = false;
        this.updateMode = CatalogUpdateMode.TableUpdate;
        this.headerTableColumnWidts = [75, 75, 65, 100, null];
        this.catalogScatterWidgetsId = [];
        this.selectedPointIndexs = [];
        this.filterDataSize = undefined;
        this.showSelectedData = false;
        this.catalogTableRef = undefined;

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

    @action setUserFilter(userFilters: CARTA.CatalogFilterRequest) {
        this.userFilters = userFilters;
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

    @action updateCatalogData(catalogFilter: CARTA.CatalogFilterResponse) {
        const catalogData = catalogFilter.columnsData;
        let subsetDataSize = catalogFilter.subsetDataSize;
        const subsetEndIndex = catalogFilter.subsetEndIndex;
        if (this.subsetEndIndex <= this.catalogInfo.dataSize) {
            let numVisibleRows = this.numVisibleRows + subsetDataSize;
            this.addSubsetBoolData(this.catalogData.boolColumn, catalogData.boolColumn);
            this.addSubsetDoubleData(this.catalogData.doubleColumn, catalogData.doubleColumn);
            this.addSubsetFloatData(this.catalogData.floatColumn, catalogData.floatColumn);
            this.addSubsetIntData(this.catalogData.intColumn, catalogData.intColumn);
            this.addSubsetLLData(this.catalogData.llColumn, catalogData.llColumn);
            this.addSubsetStringData(this.catalogData.stringColumn, catalogData.stringColumn);
            this.setNumVisibleRows(numVisibleRows); 
            this.subsetEndIndex = subsetEndIndex;
            this.filterDataSize = catalogFilter.filterDataSize;
        }
    }

    @action clearData() {
        this.catalogData.boolColumn.forEach(data => (data.boolColumn = []));
        this.catalogData.doubleColumn.forEach(data => (data.doubleColumn = []));
        this.catalogData.floatColumn.forEach(data => (data.floatColumn = []));
        this.catalogData.intColumn.forEach(data => (data.intColumn = []));
        this.catalogData.llColumn.forEach(data => (data.llColumn = []));
        this.catalogData.stringColumn.forEach(data => (data.stringColumn = []));
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

    @action.bound setColumnFilter(filter: string, columnName: string) {
        this.catalogControlHeader.get(columnName).filter = filter;
    }

    @action.bound setNumVisibleRows(val: number) {
        this.numVisibleRows = val;
    }

    @action setSubsetEndIndex(val: number)  {
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

    @action setPlotingData(val: boolean) {
        this.plotingData = val;
    }

    @action.bound reset() {
        this.clearData();
        this.setNumVisibleRows(0);
        this.setLoadingDataStatus(true);
        this.resetFilter();
        this.loadingData = false;
        this.userFilters = this.initUserFilters;
        this.updateMode = CatalogUpdateMode.TableUpdate;
        this.plotingData = false;
    }

    @computed get loadOntoImage() {
        return (this.loadingData || this.plotingData);
    }

    @computed get initCatalogControlHeader() {
        const controlHeaders = new Map<string, ControlHeader>();
        const catalogHeader = this.catalogHeader;

        if (catalogHeader.length) {
            for (let index = 0; index < catalogHeader.length; index++) {
                const header = catalogHeader[index];
                let display = false;
                // this.findKeywords(header.description) init displayed according discription
                if (index < CatalogOverlayWidgetStore.initDisplayedColumnSize) {
                    display = true;
                }
                let controlHeader: ControlHeader = {columnIndex: header.columnIndex, dataIndex: index, display: display, representAs: CatalogOverlay.NONE, filter: undefined, columnWidth: null};
                controlHeaders.set(header.name, controlHeader);
            }
        }
        return controlHeaders;
    }

    @action resetFilter() {
        const controlHeaders = this.catalogControlHeader;
        controlHeaders.forEach((value, key) => {
            value.filter = undefined;
        });
        this.filterDataSize = undefined;
    }

    @action setselectedPointIndexs = (pointIndexs: Array<number>, autoScroll: boolean = false) => {
        this.selectedPointIndexs = pointIndexs;
        if (pointIndexs.length > 0 && this.catalogTableRef && autoScroll) {
            this.catalogTableRef.scrollToRegion(this.autoScrollRowNumber);   
        }
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

    @computed get initUserFilters(): CARTA.CatalogFilterRequest {
        let catalogFilter: CARTA.CatalogFilterRequest = new CARTA.CatalogFilterRequest();
        let imageBounds: CARTA.CatalogImageBounds = new CARTA.CatalogImageBounds();
        const previewDatasize = CatalogOverlayWidgetStore.InitTableRows;
        catalogFilter.fileId = this.catalogInfo.fileId;
        catalogFilter.filterConfigs = null;
        catalogFilter.hidedHeaders = this.hidedHeaders;
        catalogFilter.subsetStartIndex = 0;
        catalogFilter.imageBounds = imageBounds;
        catalogFilter.regionId = null;

        if (this.catalogInfo.dataSize < previewDatasize) {
            catalogFilter.subsetDataSize = this.catalogInfo.dataSize;
        } else {
            catalogFilter.subsetDataSize = previewDatasize;
        }

        return catalogFilter;
    }

    @computed get updateRequestDataSize() {
        this.userFilters.subsetStartIndex = this.subsetEndIndex;
        const dataSize = this.catalogInfo.dataSize - this.numVisibleRows;
        if (this.updateMode === CatalogUpdateMode.TableUpdate) {
            let subsetDataSize = CatalogOverlayWidgetStore.DataChunkSize; 
            if ( dataSize < subsetDataSize && dataSize > 0) {
                subsetDataSize = dataSize;
            }
            this.userFilters.subsetDataSize = subsetDataSize;
        } else {
            this.userFilters.subsetDataSize = dataSize;
        }
        return this.userFilters;
    }

    @computed get shouldUpdateData(): boolean {
        if (this.subsetEndIndex < this.catalogInfo.dataSize) {
            return true;
        }
        return false;
    }

    @computed get enableLoadButton(): boolean {
        return (this.xColumnRepresentation !== null && this.yColumnRepresentation !== null && !this.loadingData && !this.plotingData);
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

    @computed get hidedHeaders(): Array<string> {
        let header = [];
        this.catalogControlHeader.forEach((value, key) => {
            if (!value.display) {
                header.push(key);
            }
        });
        return header;
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

    @computed get selectedData(): CARTA.ICatalogColumnsData {
        let catalogColumnsData = this.catalogData;
        const selectedPointIndexs = this.selectedPointIndexs;

        if (selectedPointIndexs.length > 0) {
            let datas: CARTA.ICatalogColumnsData = new CARTA.CatalogColumnsData();

            for (let index = 0; index < catalogColumnsData.boolColumn.length; index++) {
                const data = catalogColumnsData.boolColumn[index];
                datas.boolColumn[index] = new CARTA.BoolColumn();
                datas.boolColumn[index].boolColumn = this.filterBySelectedDataIndexs(selectedPointIndexs, data.boolColumn);
            }

            for (let index = 0; index < catalogColumnsData.doubleColumn.length; index++) {
                const data = catalogColumnsData.doubleColumn[index];
                datas.doubleColumn[index] = new CARTA.DoubleColumn();
                datas.doubleColumn[index].doubleColumn = this.filterBySelectedDataIndexs(selectedPointIndexs, data.doubleColumn);
            }

            for (let index = 0; index < catalogColumnsData.floatColumn.length; index++) {
                const data = catalogColumnsData.floatColumn[index];
                datas.floatColumn[index] = new CARTA.FloatColumn();
                datas.floatColumn[index].floatColumn = this.filterBySelectedDataIndexs(selectedPointIndexs, data.floatColumn);
            }

            for (let index = 0; index < catalogColumnsData.intColumn.length; index++) {
                const data = catalogColumnsData.intColumn[index];
                datas.intColumn[index] = new CARTA.IntColumn();
                datas.intColumn[index].intColumn = this.filterBySelectedDataIndexs(selectedPointIndexs, data.intColumn);
            }

            for (let index = 0; index < catalogColumnsData.llColumn.length; index++) {
                const data = catalogColumnsData.llColumn[index];
                datas.llColumn[index] = new CARTA.LLColumn();
                datas.llColumn[index].llColumn = this.filterBySelectedDataIndexs(selectedPointIndexs, data.llColumn);
            }

            for (let index = 0; index < catalogColumnsData.stringColumn.length; index++) {
                const data = catalogColumnsData.stringColumn[index];
                datas.stringColumn[index] = new CARTA.StringColumn();
                datas.stringColumn[index].stringColumn = this.filterBySelectedDataIndexs(selectedPointIndexs, data.stringColumn);
            }
            return datas;
        }
        return catalogColumnsData;
    }

    @computed get regionSelected(): number {
        return this.selectedPointIndexs.length;
    }

    @computed get autoScrollRowNumber(): IRegion {
        let singleRowRegion: IRegion = null;
        const selectedPointIndex = this.selectedPointIndexs;
        if (selectedPointIndex.length > 0) {
            singleRowRegion = Regions.row(selectedPointIndex[0]);   
        }
        return singleRowRegion;
    }

    public get2DPlotData(xColumn: string, yColumn: string, columnsData: CARTA.ICatalogColumnsData): {wcsX: Array<any>, wcsY: Array<any>, xHeaderInfo: CARTA.ICatalogHeader, yHeaderInfo: CARTA.ICatalogHeader} {
        const controlHeader = this.catalogControlHeader;
        const xHeader = controlHeader.get(xColumn);
        const yHeader = controlHeader.get(yColumn);
        const xHeaderInfo = this.catalogHeader[xHeader.dataIndex];
        const yHeaderInfo = this.catalogHeader[yHeader.dataIndex];
        const wcsX = getTableDataByType(columnsData, xHeaderInfo.dataType, xHeaderInfo.dataTypeIndex);
        const wcsY = getTableDataByType(columnsData, yHeaderInfo.dataType, yHeaderInfo.dataTypeIndex);
        return {wcsX: wcsX, wcsY: wcsY, xHeaderInfo: xHeaderInfo, yHeaderInfo: yHeaderInfo};
    }

    public get1DPlotData(column: string): {wcsData: Array<any>, headerInfo: CARTA.ICatalogHeader} {
        const controlHeader = this.catalogControlHeader;
        const header = controlHeader.get(column);
        const headerInfo = this.catalogHeader[header.dataIndex];
        const wcsData = getTableDataByType(this.catalogData, headerInfo.dataType, headerInfo.dataTypeIndex);
        return {wcsData: wcsData, headerInfo: headerInfo};
    }

    private filterBySelectedDataIndexs(selectedPointIndexs: Array<number>, dataArray: any) {
        let data = [];
        for (let index = 0; index < selectedPointIndexs.length; index++) {
            const dataIndex = selectedPointIndexs[index];
            data.push(dataArray[dataIndex]);
        }
        return data;
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

    private addSubsetDoubleData(initData: Array<CARTA.IDoubleColumn>, sourceData:  Array<CARTA.IDoubleColumn>) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            if (init && source) {
                init.doubleColumn.push(...source.doubleColumn);
            }
        }
    }

    private addSubsetBoolData(initData: Array<CARTA.IBoolColumn>, sourceData:  Array<CARTA.IBoolColumn>) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            if (init && source) {
                init.boolColumn.push(...source.boolColumn);
            }
        }
    }

    private addSubsetFloatData(initData: Array<CARTA.IFloatColumn>, sourceData:  Array<CARTA.IFloatColumn>) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            if (init && source) {
                init.floatColumn.push(...source.floatColumn);
            }
        }
    }

    private addSubsetStringData(initData: Array<CARTA.IStringColumn>, sourceData:  Array<CARTA.IStringColumn>) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            if (init && source) {
                init.stringColumn.push(...source.stringColumn);
            }
        }
    }

    private addSubsetIntData(initData: Array<CARTA.IIntColumn>, sourceData:  Array<CARTA.IIntColumn>) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            if (init && source) {
                init.intColumn.push(...source.intColumn);
            }
        }
    }

    private addSubsetLLData(initData: Array<CARTA.ILLColumn>, sourceData:  Array<CARTA.ILLColumn>) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            if (init && source) {
                init.llColumn.push(...source.llColumn);   
            }
        }
    }
}