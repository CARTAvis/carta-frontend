import {action, computed, observable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {RegionWidgetStore} from "./RegionWidgetStore";

export enum CatalogOverlay {
    X = "X",
    Y = "Y",
    PlotSize = "Size",
    // PlotColor = "Color",
    PlotShape = "Shape",
    NULL = "Null"
}

export enum CatalogOverlayShape {
    Circle = "Circle",
    Square = "Square"
}

export type ControlHeader = { columnIndex: number, dataIndex: number, display: boolean, representAs: CatalogOverlay, filter: string };

const DEFAULTS = {
    numVisibleRows : 50,
    loadingData : true,
    catalogColor: Colors.RED2,
    catalogSize: 1
};

export class CatalogOverlayWidgetStore extends RegionWidgetStore {
    // @observable channel: number;
    // @observable progress: number;

    // private vertexData: Float32Array[];
    // private vertexBuffers: WebGLBuffer[];
    // @observable catalogControlHeader: Array<ControlHeader>;

    private xColumn: string;
    private yColumn: string;
    private sizeColumn: string;
    private shapeColumn: string;

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

    constructor(catalogHeader: Array<CARTA.ICatalogHeader>, catalogData: CARTA.ICatalogColumnsData) {
        super();
        this.catalogHeader = catalogHeader.sort((a, b) => { return a.columnIndex - b.columnIndex});
        this.catalogData = catalogData;
        this.catalogControlHeader = this.initCatalogControlHeader;
        this.numVisibleRows = DEFAULTS.numVisibleRows;
        this.loadingData = DEFAULTS.loadingData;
        this.catalogColor = DEFAULTS.catalogColor;
        this.catalogSize = DEFAULTS.catalogSize;
        this.maxRow = 50;
        this.xColumn = undefined;
        this.yColumn = undefined;
        this.sizeColumn = undefined;
        this.shapeColumn = undefined;
    }

    // private gl: WebGLRenderingContext;
    // Number of vertex data "float" values (normals are actually int16, so both coordinates count as one 32-bit value)
    // Each vertex is repeated twice
    // private static VertexDataElements = 8;
    // settings 

    // @action setChannel = (channel: number) => {
    //     this.channel = channel;
    // };

    @action setCatalogHeader(catalogHeader: Array<CARTA.CatalogHeader>) {
        this.catalogHeader = catalogHeader;
    }

    @action setCatalogData(catalogData: CARTA.CatalogColumnsData) {
        this.catalogData = catalogData;
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
        if (val <= 900) {
            this.numVisibleRows = val;
        }
    }

    @action setLoadingData(val: boolean) {
        this.loadingData = val;
    }

    @action setRegionId = (fileId: number, regionId: number) => {
        this.regionIdMap.set(fileId, regionId);
    };

    @action setMaxRow (val: number) {
        this.maxRow = val;
    }

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

    @computed get initCatalogControlHeader() {
        const controlHeaders = new Map<string, ControlHeader>();
        const catalogHeader = this.catalogHeader;
        if (catalogHeader.length) {
            for (let index = 0; index < catalogHeader.length; index++) {
                const header = catalogHeader[index];
                let controlHeader: ControlHeader = {columnIndex: header.columnIndex, dataIndex: index, display: true, representAs: CatalogOverlay.NULL, filter: "Filter"};
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

    private setXColumn(columnName: string) {
        if (this.xColumn) {
            let representAs = this.catalogControlHeader.get(this.xColumn).representAs;
            if (representAs === CatalogOverlay.X) {
                this.catalogControlHeader.get(this.xColumn).representAs = CatalogOverlay.NULL;
            }
        }
        this.xColumn = columnName; 
    }

    private setYColumn(columnName: string) {
        if (this.yColumn) {
            let representAs = this.catalogControlHeader.get(this.yColumn).representAs;
            if (representAs === CatalogOverlay.Y) {
                this.catalogControlHeader.get(this.yColumn).representAs = CatalogOverlay.NULL;
            }
        }
        this.yColumn = columnName; 
    }

    private setSizeColumn(columnName: string) {
        if (this.sizeColumn) {
            let representAs = this.catalogControlHeader.get(this.sizeColumn).representAs;
            if (representAs === CatalogOverlay.PlotSize) {
                this.catalogControlHeader.get(this.sizeColumn).representAs = CatalogOverlay.NULL;
            }
        }
        this.sizeColumn = columnName; 
    }

    private setShapColumn(columnName: string) {
        if (this.shapeColumn) {
            let representAs = this.catalogControlHeader.get(this.shapeColumn).representAs;
            if (representAs === CatalogOverlay.PlotShape) {
                this.catalogControlHeader.get(this.shapeColumn).representAs = CatalogOverlay.NULL;
            }
        }
        this.shapeColumn = columnName; 
    }
}