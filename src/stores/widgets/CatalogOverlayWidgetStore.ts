import {action, computed, observable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {RegionWidgetStore} from "./RegionWidgetStore";

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
    NULL = "Null"
}

export enum CatalogOverlayShape {
    Circle = "Circle",
    Square = "Square"
}

export type ControlHeader = { columnIndex: number, dataIndex: number, display: boolean, representAs: CatalogOverlay, filter: string };

export class CatalogOverlayWidgetStore extends RegionWidgetStore {

    public static readonly InitTableRows = 50;
    private static readonly DataChunkSize = 100;

    @observable xColumn: string;
    @observable yColumn: string;
    @observable sizeColumn: string;
    @observable shapeColumn: string;
    
    @observable progress: number;
    @observable catalogInfo: CatalogInfo;
    @observable catalogControlHeader: Map<string, ControlHeader>;
    @observable catalogHeader: Array<CARTA.ICatalogHeader>;
    @observable catalogData: CARTA.ICatalogColumnsData;
    @observable loadingData: boolean;
    @observable numVisibleRows: number;
    @observable maxRow: number;
    @observable headerTableColumnWidts: Array<number>;
    @observable dataTableColumnWidts: Array<number>;
    @observable catalogSize: number;
    @observable catalogColor: string;
    @observable catalogShape: CatalogOverlayShape;
    @observable subsetEndIndex: number;

    // Todo send same filter to backend when user click load
    @observable userFilters: CARTA.CatalogFilterRequest; 

    constructor(catalogInfo: CatalogInfo, catalogHeader: Array<CARTA.ICatalogHeader>, catalogData: CARTA.ICatalogColumnsData) {
        super();
        this.catalogInfo = catalogInfo;
        this.catalogHeader = catalogHeader.sort((a, b) => { return (a.columnIndex - b.columnIndex); });
        this.catalogData = catalogData;
        this.catalogControlHeader = this.initCatalogControlHeader;
        this.loadingData = false;
        this.catalogColor = Colors.RED2;
        this.catalogSize = 1;
        this.xColumn = undefined;
        this.yColumn = undefined;
        this.sizeColumn = undefined;
        this.shapeColumn = undefined;
        this.userFilters = this.initUserFilters;

        const initTableRows = CatalogOverlayWidgetStore.InitTableRows;
        if (catalogInfo.dataSize < initTableRows) {
            this.numVisibleRows = catalogInfo.dataSize;
            this.maxRow = catalogInfo.dataSize;
            this.subsetEndIndex = catalogInfo.dataSize;
        } else {
            this.numVisibleRows = initTableRows;
            this.maxRow = initTableRows;
            this.subsetEndIndex = initTableRows;
        }
    }

    @action setUserFilter(userFilters: CARTA.CatalogFilterRequest) {
        this.userFilters = userFilters;
    }

    @action setProgress(val: number) {
        this.progress = val;
    }

    @action setMaxRow(val: number) {
        this.maxRow = val;
    }

    @action setCatalogHeader(catalogHeader: Array<CARTA.CatalogHeader>) {
        this.catalogHeader = catalogHeader;
    }

    @action setCatalogData(catalogData: CARTA.ICatalogColumnsData, subsetDataSize: number, subsetEndIndex: number) {
        if (this.maxRow >= this.numVisibleRows && this.subsetEndIndex <= this.catalogInfo.dataSize) {
            this.addSubsetBoolData(this.catalogData.boolColumn, catalogData.boolColumn);
            this.addSubsetDoubleData(this.catalogData.doubleColumn, catalogData.doubleColumn);
            this.addSubsetFloatData(this.catalogData.floatColumn, catalogData.floatColumn);
            this.addSubsetIntData(this.catalogData.intColumn, catalogData.intColumn);
            this.addSubsetLLData(this.catalogData.llColumn, catalogData.llColumn);
            this.addSubsetStringData(this.catalogData.stringColumn, catalogData.stringColumn);
            this.setNumVisibleRows(this.numVisibleRows + subsetDataSize);
            this.subsetEndIndex = subsetEndIndex;
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
                    this.setXColumn(columnName);
                    break;
                case CatalogOverlay.Y:
                    this.setYColumn(columnName);
                    break;
                case CatalogOverlay.PlotSize:
                    this.setSizeColumn(columnName);
                    break;
                case CatalogOverlay.PlotShape:
                    this.setShapColumn(columnName);
                    break;     
                default:
                    break;
            }
            const newHeader: ControlHeader = {columnIndex: current.columnIndex, dataIndex: current.dataIndex, display: current.display, representAs: val, filter: current.filter };
            this.catalogControlHeader.set(columnName, newHeader); 
        }
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

    @action.bound reset(dataTableColumnWidts: number[]) {
        this.clearData();
        this.setNumVisibleRows(0);
        this.setLoadingDataStatus(true);
        this.catalogControlHeader = this.initCatalogControlHeader;
        this.dataTableColumnWidts = dataTableColumnWidts;
        this.loadingData = false;
        this.catalogColor = Colors.RED2;
        this.catalogSize = 1;
        this.xColumn = undefined;
        this.yColumn = undefined;
        this.sizeColumn = undefined;
        this.shapeColumn = undefined;
        this.userFilters = this.initUserFilters;

        const initTableRows = CatalogOverlayWidgetStore.InitTableRows;
        if (this.catalogInfo.dataSize < initTableRows) {
            this.maxRow = this.catalogInfo.dataSize;
            this.subsetEndIndex = this.catalogInfo.dataSize;
        } else {
            this.maxRow = initTableRows;
            this.subsetEndIndex = initTableRows;
        }
    }

    @computed get initCatalogControlHeader() {
        const controlHeaders = new Map<string, ControlHeader>();
        const catalogHeader = this.catalogHeader;
        if (catalogHeader.length) {
            for (let index = 0; index < catalogHeader.length; index++) {
                const header = catalogHeader[index];
                let controlHeader: ControlHeader = {columnIndex: header.columnIndex, dataIndex: index, display: true, representAs: CatalogOverlay.NULL, filter: undefined};
                controlHeaders.set(header.name, controlHeader);
            }
        }
        return controlHeaders;
    }

    @computed get numOfDisplayedColumn() {
        let numOfColumn = 0;
        this.catalogControlHeader.forEach((value, key) => {
            if (value.display) {
                numOfColumn += 1;
            }
        });
        return numOfColumn;
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

    @computed get initUserFilters(): CARTA.CatalogFilterRequest {
        let catalogFilter: CARTA.CatalogFilterRequest = new CARTA.CatalogFilterRequest();
        let imageBounds: CARTA.CatalogImageBounds = new CARTA.CatalogImageBounds();
        catalogFilter.fileId = this.catalogInfo.fileId;
        catalogFilter.filterConfigs = null;
        catalogFilter.hidedHeaders = null;
        catalogFilter.subsetDataSize = CatalogOverlayWidgetStore.InitTableRows;
        catalogFilter.subsetStartIndex = 0;
        catalogFilter.imageBounds = imageBounds;
        catalogFilter.regionId = null;
        return catalogFilter;
    }

    @computed get updateSubsetDataSize() {
        const dataChunkSize = CatalogOverlayWidgetStore.DataChunkSize;
        if (this.maxRow > this.numVisibleRows) {
            this.userFilters.subsetStartIndex = this.subsetEndIndex;
            let subsetDataSize = 0; 
            if (this.maxRow - this.numVisibleRows < dataChunkSize) {
                subsetDataSize = this.maxRow - this.numVisibleRows;
            } else {
                subsetDataSize = dataChunkSize;
            }
            this.userFilters.subsetDataSize = subsetDataSize;
            return this.userFilters;   
        } else if (this.maxRow < this.numVisibleRows) {
            this.userFilters.subsetStartIndex = 0;
            let subsetDataSize = CatalogOverlayWidgetStore.InitTableRows; 
            if (this.maxRow < CatalogOverlayWidgetStore.InitTableRows) {
                subsetDataSize = this.maxRow;
            }
            this.userFilters.subsetDataSize = subsetDataSize;
            return this.userFilters;
        }
        return this.userFilters;
    }

    @computed get shouldUpdateTableData(): boolean {
        if (this.subsetEndIndex < this.catalogInfo.dataSize) {
            return true;
        }
        return false;
    }

    @action setXColumn(columnName: string) {
        if (this.xColumn) {
            let representAs = this.catalogControlHeader.get(this.xColumn).representAs;
            if (representAs === CatalogOverlay.X) {
                this.catalogControlHeader.get(this.xColumn).representAs = CatalogOverlay.NULL;
            }
        }
        this.xColumn = columnName; 
    }

    @action setYColumn(columnName: string) {
        if (this.yColumn) {
            let representAs = this.catalogControlHeader.get(this.yColumn).representAs;
            if (representAs === CatalogOverlay.Y) {
                this.catalogControlHeader.get(this.yColumn).representAs = CatalogOverlay.NULL;
            }
        }
        this.yColumn = columnName; 
    }

    @action setSizeColumn(columnName: string) {
        if (this.sizeColumn) {
            let representAs = this.catalogControlHeader.get(this.sizeColumn).representAs;
            if (representAs === CatalogOverlay.PlotSize) {
                this.catalogControlHeader.get(this.sizeColumn).representAs = CatalogOverlay.NULL;
            }
        }
        this.sizeColumn = columnName; 
    }

    @action setShapColumn(columnName: string) {
        if (this.shapeColumn) {
            let representAs = this.catalogControlHeader.get(this.shapeColumn).representAs;
            if (representAs === CatalogOverlay.PlotShape) {
                this.catalogControlHeader.get(this.shapeColumn).representAs = CatalogOverlay.NULL;
            }
        }
        this.shapeColumn = columnName; 
    }

    private addSubsetDoubleData(initData: Array<CARTA.IDoubleColumn>, sourceData:  Array<CARTA.IDoubleColumn>) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            init.doubleColumn.push(...source.doubleColumn);
        }
    }

    private addSubsetBoolData(initData: Array<CARTA.IBoolColumn>, sourceData:  Array<CARTA.IBoolColumn>) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            init.boolColumn.push(...source.boolColumn);
        }
    }

    private addSubsetFloatData(initData: Array<CARTA.IFloatColumn>, sourceData:  Array<CARTA.IFloatColumn>) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            init.floatColumn.push(...source.floatColumn);
        }
    }

    private addSubsetStringData(initData: Array<CARTA.IStringColumn>, sourceData:  Array<CARTA.IStringColumn>) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            init.stringColumn.push(...source.stringColumn);
        }
    }

    private addSubsetIntData(initData: Array<CARTA.IIntColumn>, sourceData:  Array<CARTA.IIntColumn>) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            init.intColumn.push(...source.intColumn);
        }
    }

    private addSubsetLLData(initData: Array<CARTA.ILLColumn>, sourceData:  Array<CARTA.ILLColumn>) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            init.llColumn.push(...source.llColumn);
        }
    }
}