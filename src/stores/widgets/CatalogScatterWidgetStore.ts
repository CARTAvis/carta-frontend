import {action, observable, computed} from "mobx";
import {CatalogOverlayWidgetStore, CatalogPlotType} from "./CatalogOverlayWidgetStore";
import {Point2D} from "models";
import {minMaxArray} from "utilities";

export interface CatalogScatterWidgetStoreProps {
    x: Array<number>;
    y?: Array<number>;
    catalogOverlayWidgetStore: CatalogOverlayWidgetStore;
    plotType: CatalogPlotType;
}

export type Border = { xMin: number, xMax: number, yMin: number, yMax: number };
export type XBorder = { xMin: number, xMax: number };
export type DragMode = "zoom" | "pan" | "select" | "lasso" | "orbit" | "turntable" | false;

export class CatalogScatterWidgetStore {
    @observable xDataset: Array<number>;
    @observable yDataset: Array<number>;
    @observable catalogOverlayWidgetStore: CatalogOverlayWidgetStore;
    @observable columnsName: {x: string, y: string};
    @observable indicatorInfo: Point2D;
    @observable scatterborder: Border;
    @observable dragmode: DragMode;
    @observable plotType: CatalogPlotType;
    @observable histogramBorder: XBorder;
    @observable logScaleY: boolean;

    constructor(props: CatalogScatterWidgetStoreProps) {
        this.xDataset = props.x;
        this.catalogOverlayWidgetStore = props.catalogOverlayWidgetStore;
        this.columnsName = { 
            x: this.catalogOverlayWidgetStore.xColumnRepresentation, 
            y: this.catalogOverlayWidgetStore.yColumnRepresentation 
        };
        this.indicatorInfo = undefined;
        this.dragmode = "select";
        this.plotType = props.plotType;
        this.logScaleY = true;

        if (props.plotType === CatalogPlotType.D2Scatter) {
            this.scatterborder = this.initScatterBorder;
            this.yDataset = props.y;   
        } else {
            this.histogramBorder = this.initHistogramXBorder;
            this.yDataset = undefined;
        }
    }

    @action setColumnX(columnName: string) {
        this.columnsName.x = columnName;
        this.xDataset = this.catalogOverlayWidgetStore.get1DPlotData(columnName).wcsData;
    }

    @action setColumnY(columnName: string) {
        this.columnsName.y = columnName;
        this.yDataset = this.catalogOverlayWidgetStore.get1DPlotData(columnName).wcsData;
    }

    @action setXDataset(x: Array<number>) {
        this.xDataset = x;
    }

    @action setYDataset(y: Array<number>) {
        this.yDataset = y;
    }

    @action updateScatterData() {
        const catalogOverlayWidgetStore = this.catalogOverlayWidgetStore;
        const columnsName = this.columnsName;
        if (columnsName.x && columnsName.y) {
            const coords = catalogOverlayWidgetStore.get2DPlotData(columnsName.x, columnsName.y, catalogOverlayWidgetStore.catalogData);
            this.setXDataset(coords.wcsX.slice(0));
            this.setYDataset(coords.wcsY.slice(0));
            this.scatterborder = this.initScatterBorder;
        }
    }

    @action updateHistogramData() {
        const catalogOverlayWidgetStore = this.catalogOverlayWidgetStore;
        const columnsName = this.columnsName;
        if (columnsName.x) {
            const coords = catalogOverlayWidgetStore.get1DPlotData(columnsName.x);
            this.setXDataset(coords.wcsData.slice(0));
            this.histogramBorder = this.initHistogramXBorder;
        }
    }

    @action setIndicator(val: Point2D) {
        this.indicatorInfo = val;
    }

    @action setScatterborder(border: Border) {
        this.scatterborder = border;
    }

    @action setHistogramXBorder(xborder: XBorder) {
        this.histogramBorder = xborder;
    }

    @action setDragmode(mode: DragMode) {
        this.dragmode = mode;
    }

    @action setLogScaleY(val: boolean) {
        this.logScaleY = val;
    }

    @computed get initScatterBorder(): Border {
        const xBounds = minMaxArray(this.xDataset);
        const yBounds = minMaxArray(this.yDataset);
        return {
            xMin: xBounds.minVal,
            xMax: xBounds.maxVal,
            yMin: yBounds.minVal,
            yMax: yBounds.maxVal
        };
    }

    @computed get initHistogramXBorder(): XBorder {
        const xBounds = minMaxArray(this.xDataset);
        return {
            xMin: xBounds.minVal,
            xMax: xBounds.maxVal
        };
    }

    @computed get binSize(): number {
        return  Math.ceil(Math.sqrt(this.xDataset.length));
    }

    @computed get enablePlotButton(): boolean {
        if (this.plotType === CatalogPlotType.Histogram) {
            return (this.columnsName.x !== null && !this.catalogOverlayWidgetStore.loadingData && !this.catalogOverlayWidgetStore.updatingDataStream);
        }
        return (this.columnsName.x !== null && this.columnsName.y !== null && !this.catalogOverlayWidgetStore.loadingData && !this.catalogOverlayWidgetStore.updatingDataStream);
    }
}