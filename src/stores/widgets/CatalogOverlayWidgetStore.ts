import * as AST from "ast_wrapper";
import {action, computed, observable, values} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {RegionWidgetStore} from "./RegionWidgetStore";
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
    NULL = "Null"
}

export enum CatalogOverlayShape {
    Circle = "Circle",
    Square = "Square"
}

export enum CatalogUpdateMode {
    TableUpdate = "TableUpdate",
    ViewUpdate = "ViewUpdate"
}

export type ControlHeader = { columnIndex: number, dataIndex: number, display: boolean, representAs: CatalogOverlay, filter: string };

export class CatalogOverlayWidgetStore extends RegionWidgetStore {

    public static readonly InitTableRows = 50;
    private static readonly DataChunkSize = 100;
    private wcs = 0;
    private initDatasize = 0;
    
    @observable imageCoordinates: Float32Array[];
    
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
    @observable offset: number;
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
        this.userFilters = this.initUserFilters;
        this.plotingData = false;
        this.imageCoordinates = [];
        this.updateMode = CatalogUpdateMode.TableUpdate;
        this.offset = 0;

        const initTableRows = CatalogOverlayWidgetStore.InitTableRows;
        if (catalogInfo.dataSize < initTableRows) {
            this.numVisibleRows = catalogInfo.dataSize;
            this.subsetEndIndex = catalogInfo.dataSize;
        } else {
            this.numVisibleRows = initTableRows;
            this.subsetEndIndex = initTableRows;
        }
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
            let numVisibleRows = this.numVisibleRows + subsetDataSize - this.offset;
            this.addSubsetBoolData(this.catalogData.boolColumn, catalogData.boolColumn, this.offset);
            this.addSubsetDoubleData(this.catalogData.doubleColumn, catalogData.doubleColumn, this.offset);
            this.addSubsetFloatData(this.catalogData.floatColumn, catalogData.floatColumn, this.offset);
            this.addSubsetIntData(this.catalogData.intColumn, catalogData.intColumn, this.offset);
            this.addSubsetLLData(this.catalogData.llColumn, catalogData.llColumn, this.offset);
            this.addSubsetStringData(this.catalogData.stringColumn, catalogData.stringColumn, this.offset);
            this.setNumVisibleRows(numVisibleRows);
            if (this.xColumnRepresentation && this.yColumnRepresentation && this.plotingData) {
                this.imageCoordinates.push(Float32Array.from(this.transformCatalogData(this.wcs, this.offset + this.initDatasize)));    
            }  
            this.subsetEndIndex = subsetEndIndex;
            this.offset = subsetDataSize;
        }
    }

    @action setOffset(val: number) {
        this.offset = val;
    }

    @action initWebGLData(wcsInfo: number) {
        this.wcs = wcsInfo;
        const data = Float32Array.from(this.transformCatalogData(wcsInfo, 0));
        this.initDatasize = data.length / 2;
        this.imageCoordinates.push(data);
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
                        this.catalogControlHeader.get(currentX).representAs = CatalogOverlay.NULL;
                    }
                    break;
                case CatalogOverlay.Y:
                    const currentY = this.yColumnRepresentation;
                    if (currentY) {
                        this.catalogControlHeader.get(currentY).representAs = CatalogOverlay.NULL;
                    }
                    break;
                case CatalogOverlay.PlotSize:
                    const currentSize = this.sizeColumnRepresentation;
                    if (currentSize) {
                        this.catalogControlHeader.get(currentSize).representAs = CatalogOverlay.NULL;
                    }
                    break;
                case CatalogOverlay.PlotShape:
                    const currentShape = this.shapeColumnRepresentation;
                    if (currentShape) {
                        this.catalogControlHeader.get(currentShape).representAs = CatalogOverlay.NULL;
                    }
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

    @action setPlotingData(val: boolean) {
        this.plotingData = val;
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
        this.userFilters = this.initUserFilters;
        this.updateMode = CatalogUpdateMode.TableUpdate;
        this.offset = 0;
        this.plotingData = false;
        this.imageCoordinates = [];
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
        const previewDatasize = CatalogOverlayWidgetStore.InitTableRows;
        catalogFilter.fileId = this.catalogInfo.fileId;
        catalogFilter.filterConfigs = null;
        catalogFilter.hidedHeaders = null;
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
        } else if (this.updateMode === CatalogUpdateMode.ViewUpdate) {
            this.userFilters.subsetDataSize = dataSize;
        }
        return this.userFilters;
    }

    @computed get shouldUpdateTableData(): boolean {
        if (this.subsetEndIndex < this.catalogInfo.dataSize) {
            return true;
        }
        return false;
    }

    @computed get enableLoadButton(): boolean {
        return (this.xColumnRepresentation !== null && this.yColumnRepresentation !== null && !this.loadingData && !this.plotingData && this.catalogInfo.dataSize !== this.subsetEndIndex);
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

    private addSubsetDoubleData(initData: Array<CARTA.IDoubleColumn>, sourceData:  Array<CARTA.IDoubleColumn>, start: number) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            init.doubleColumn.push(...source.doubleColumn.slice(start));
        }
    }

    private addSubsetBoolData(initData: Array<CARTA.IBoolColumn>, sourceData:  Array<CARTA.IBoolColumn>, start: number) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            init.boolColumn.push(...source.boolColumn.slice(start));
        }
    }

    private addSubsetFloatData(initData: Array<CARTA.IFloatColumn>, sourceData:  Array<CARTA.IFloatColumn>, start: number) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            init.floatColumn.push(...source.floatColumn.slice(start));
        }
    }

    private addSubsetStringData(initData: Array<CARTA.IStringColumn>, sourceData:  Array<CARTA.IStringColumn>, start: number) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            init.stringColumn.push(...source.stringColumn.slice(start));
        }
    }

    private addSubsetIntData(initData: Array<CARTA.IIntColumn>, sourceData:  Array<CARTA.IIntColumn>, start: number) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            init.intColumn.push(...source.intColumn.slice(start));
        }
    }

    private addSubsetLLData(initData: Array<CARTA.ILLColumn>, sourceData:  Array<CARTA.ILLColumn>, start: number) {
        for (let index = 0; index < initData.length; index++) {
            const init = initData[index];
            const source = sourceData[index];
            init.llColumn.push(...source.llColumn.slice(start));
        }
    }

    private transformCatalogData(wcsInfo: number, startIndex: number) {
        const webGlData = [];
        const controlHeader = this.catalogControlHeader;
        const xHeader = controlHeader.get(this.xColumnRepresentation);
        const yHeader = controlHeader.get(this.yColumnRepresentation);
        const xHeaderData = this.catalogHeader[xHeader.dataIndex];
        const yHeaderData = this.catalogHeader[yHeader.dataIndex];
        const pixelCoordsX = getTableDataByType(this.catalogData, xHeaderData.dataType, xHeaderData.dataTypeIndex).slice(startIndex);
        const pixelCoordsY = getTableDataByType(this.catalogData, yHeaderData.dataType, yHeaderData.dataTypeIndex).slice(startIndex);

        if (pixelCoordsX.length === pixelCoordsY.length) {
            for (let index = 0; index < pixelCoordsX.length; index++) {
                const xPixelValue = pixelCoordsX[index];
                const yPixelValue = pixelCoordsY[index];
                const pointWCS = AST.transformPoint(wcsInfo, xPixelValue, yPixelValue);
                const normVals = AST.normalizeCoordinates(wcsInfo, pointWCS.x, pointWCS.y);
                // x1, y1, x2, y2 ...
                webGlData.push(normVals.x);
                webGlData.push(normVals.y);
            }
        }
        return webGlData;
    }
}