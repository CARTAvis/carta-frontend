import {CARTA} from "carta-protobuf";
import {action, observable, computed} from "mobx";
import {Regions, IRegion} from "@blueprintjs/table";
import {ProcessedColumnData, TypedArray} from "models";
import {AppStore, CatalogStore, ControlHeader, CatalogUpdateMode} from "stores";
import {CatalogWebGLService, CatalogTextureType} from "services";
import {filterProcessedColumnData, minMaxArray, transformPoint} from "utilities";

export interface CatalogInfo {
    fileId: number;
    fileInfo: CARTA.ICatalogFileInfo;
    dataSize: number;
    directory: string;
}

export enum CatalogType {
    SIMBAD,
    FILE
}

export enum CatalogSystemType {
    Ecliptic = "ECLIPTIC",
    FK4 = "FK4",
    FK5 = "FK5",
    Galactic = "GALACTIC",
    ICRS = "ICRS",
    Pixel0 = "Pixel0",
    Pixel1 = "Pixel1"
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
    Y1 = "Y1"
}

export abstract class AbstractCatalogProfileStore {

    private static readonly NEGATIVE_INFINITY = -1.7976931348623157e308;
    private static readonly POSITIVE_INFINITY = 1.7976931348623157e308;

    abstract catalogInfo: CatalogInfo;
    abstract catalogHeader: Array<CARTA.ICatalogHeader>;
    abstract catalogControlHeader: Map<string, ControlHeader>;
    abstract numVisibleRows: number;
    abstract loadingData: boolean;

    abstract get initCatalogControlHeader(): Map<string, ControlHeader>;
    abstract resetFilterRequestControlParams(): void;
    abstract get updateRequestDataSize(): any;
    abstract get shouldUpdateData(): boolean;
    abstract resetCatalogFilterRequest(): void;
    abstract get loadOntoImage(): boolean;
    abstract setMaxRows(maxRows: number): void;

    @observable catalogType: CatalogType;
    @observable catalogFilterRequest: CARTA.CatalogFilterRequest;
    @observable catalogCoordinateSystem: {system: CatalogSystemType; equinox: string; epoch: string; coordinate: {x: CatalogOverlay; y: CatalogOverlay}};
    @observable filterDataSize: number;
    @observable progress: number;
    @observable updatingDataStream: boolean;
    @observable updateTableView: boolean;
    @observable updateMode: CatalogUpdateMode;
    @observable selectedPointIndices: number[];
    @observable sortingInfo: {columnName: string; sortingType: CARTA.SortingType};

    private _catalogData: Map<number, ProcessedColumnData>;
    public static readonly CoordinateSystemName = new Map<CatalogSystemType, string>([
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
        this.updatingDataStream = false;
        this.updateTableView = false;
        this.filterDataSize = undefined;
        this.selectedPointIndices = [];
        // remove this ???
        this.updateMode = CatalogUpdateMode.TableUpdate;

        this.sortingInfo = {columnName: null, sortingType: null};
    }

    get catalogData(): Map<number, ProcessedColumnData> {
        return this._catalogData;
    }

    get systemCoordinateMap(): Map<CatalogSystemType, {x: CatalogOverlay; y: CatalogOverlay}> {
        return this._systemCoordinateMap;
    }

    public get2DPlotData(xColumnName: string, yColumnName: string, columnsData: Map<number, ProcessedColumnData>): {wcsX?: Array<number>; wcsY?: Array<number>; xHeaderInfo: CARTA.ICatalogHeader; yHeaderInfo: CARTA.ICatalogHeader} {
        const controlHeader = this.catalogControlHeader;
        const xHeader = controlHeader.get(xColumnName);
        const yHeader = controlHeader.get(yColumnName);
        const xHeaderInfo = this.catalogHeader[xHeader.dataIndex];
        const yHeaderInfo = this.catalogHeader[yHeader.dataIndex];

        const xColumn = columnsData.get(xHeaderInfo.columnIndex);
        const yColumn = columnsData.get(yHeaderInfo.columnIndex);

        if (xColumn && xColumn.dataType !== CARTA.ColumnType.String && xColumn.dataType !== CARTA.ColumnType.Bool && yColumn && yColumn.dataType !== CARTA.ColumnType.String && yColumn.dataType !== CARTA.ColumnType.Bool) {
            const wcsX = xColumn.data as Array<number>;
            const wcsY = yColumn.data as Array<number>;
            return {wcsX, wcsY, xHeaderInfo, yHeaderInfo};
        } else {
            return {xHeaderInfo, yHeaderInfo};
        }
    }

    public get1DPlotData(column: string): {wcsData?: TypedArray; headerInfo: CARTA.ICatalogHeader} {
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

    public static getCatalogSystem(system: string): CatalogSystemType {
        let catalogSystem = CatalogSystemType.ICRS;
        console.log(system)
        const systemMap = AbstractCatalogProfileStore.CoordinateSystemName;
        systemMap.forEach((value, key) => {
            if (system.toUpperCase().includes(value.toUpperCase())) {
                catalogSystem = key;
            }
        });
        console.log(catalogSystem)
        return catalogSystem;
    }

    @computed get catalogFileId(): number {
        return this.catalogInfo.fileId;
    }

    @computed get activedSystem(): {x: CatalogOverlay; y: CatalogOverlay} {
        return this.systemCoordinateMap.get(this.catalogCoordinateSystem.system);
    }

    @computed get regionSelected(): number {
        return this.selectedPointIndices.length;
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

    @computed get autoScrollRowNumber(): IRegion {
        let singleRowRegion: IRegion = Regions.row(0);
        if (this.selectedPointIndices.length > 0) {
            singleRowRegion = Regions.row(this.selectedPointIndices[0]);
        }
        return singleRowRegion;
    }

    @computed get isFileBasedCatalog(): boolean {
        return this.catalogType === CatalogType.FILE;
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

    @computed get hasFilter(): boolean {
        let filters = [];
        this.catalogControlHeader.forEach((value, key) => {
            if (value.filter) {
                filters.push(value);
            }
        });
        return filters.length > 0;
    }

    @action updateTableStatus(val: boolean) {
        this.updateTableView = val;
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
    };

    @action.bound setTableColumnWidth(width: number, columnName: string) {
        this.catalogControlHeader.get(columnName).columnWidth = width;
    }


    @action setHeaderDisplay(val: boolean, columnName: string) {
        this.catalogControlHeader.get(columnName).display = val;
    }

    @action setSortingInfo(columnName: string, sortingType: CARTA.SortingType) {
        this.sortingInfo = {columnName, sortingType};
    }

    @action setUpdateMode(mode: CatalogUpdateMode) {
        this.updateMode = mode;
    }

    @action setLoadingDataStatus(val: boolean) {
        this.loadingData = val;
    }

    // ????
    @action setUpdatingDataStream(val: boolean) {
        this.updatingDataStream = val;
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

    @action setSelectedPointIndices = (pointIndices: Array<number>, autoPanZoom: boolean) => {
        this.selectedPointIndices = pointIndices;
        const catalogStore = CatalogStore.Instance;
        const coordsArray = CatalogStore.Instance.catalogGLData.get(this.catalogFileId);
        if (coordsArray?.x?.length) {
            let selectedX = [];
            let selectedY = [];
            const selectedData = new Uint8Array(coordsArray.x.length);
            for (let index = 0; index < pointIndices.length; index++) {
                const i = pointIndices[index];
                const x = coordsArray.x[i];
                const y = coordsArray.y[i];

                if (!this.isInfinite(x) && !this.isInfinite(y)) {
                    selectedX.push(x);
                    selectedY.push(y);
                }
                selectedData[i] = 1.0;
            }
            CatalogWebGLService.Instance.updateDataTexture(this.catalogFileId, selectedData, CatalogTextureType.SelectedSource);
            if (autoPanZoom) {
                const appStore = AppStore.Instance;
                const frame = appStore.getFrame(catalogStore.getFrameIdByCatalogId(this.catalogFileId));
                const selectedDataLength = selectedX.length;
                let positionImageSpace = {x: selectedX[0], y: selectedY[0]};
                if (selectedDataLength > 1) {
                    const minMaxX = minMaxArray(selectedX);
                    const minMaxY = minMaxArray(selectedY);
                    const width = minMaxX.maxVal - minMaxX.minVal;
                    const height = minMaxY.maxVal - minMaxY.minVal;
                    positionImageSpace = {x: width / 2 + minMaxX.minVal, y: height / 2 + minMaxY.minVal};
                    const zoomLevel = Math.min(appStore.activeFrame.renderWidth / width, appStore.activeFrame.renderHeight / height);
                    appStore.activeFrame.setZoom(zoomLevel);
                }

                if (frame.spatialReference && frame !== appStore.activeFrame) {
                    positionImageSpace = transformPoint(frame.spatialTransformAST, positionImageSpace, true);
                }

                if (appStore.activeFrame.spatialReference && !frame.spatialReference) {
                    appStore.activeFrame.setCenter(positionImageSpace.x, positionImageSpace.y, false);
                } else {
                    appStore.activeFrame.setCenter(positionImageSpace.x, positionImageSpace.y);
                }
            }
        }
    }

    private isInfinite(value: number) {
        return !isFinite(value) || value === AbstractCatalogProfileStore.NEGATIVE_INFINITY || value === AbstractCatalogProfileStore.POSITIVE_INFINITY;
    }

}