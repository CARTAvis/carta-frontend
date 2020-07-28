import {action, observable, computed} from "mobx";
import {CatalogOverlayWidgetStore} from "./CatalogOverlayWidgetStore";
import {Point2D} from "models";
import {minMaxArray} from "utilities";

export interface CatalogScatterWidgetStoreProps {
    x: Array<number>;
    y: Array<number>;
    catalogOverlayWidgetStore: CatalogOverlayWidgetStore;
}

export type Border = { xMin: number, xMax: number, yMin: number, yMax: number };
export type DragMode = "zoom" | "pan" | "select" | "lasso" | "orbit" | "turntable" | false;

export class CatalogScatterWidgetStore {
    private rangeOffset = 0.01;
    @observable xDataset: Array<number>;
    @observable yDataset: Array<number>;
    @observable catalogOverlayWidgetStore: CatalogOverlayWidgetStore;
    @observable columnsName: {x: string, y: string};
    @observable indicatorInfo: Point2D;
    @observable border: Border;
    @observable dragmode: DragMode;

    constructor(props: CatalogScatterWidgetStoreProps) {
        this.xDataset = props.x;
        this.yDataset = props.y;
        this.catalogOverlayWidgetStore = props.catalogOverlayWidgetStore;
        this.columnsName = { 
            x: this.catalogOverlayWidgetStore.xColumnRepresentation, 
            y: this.catalogOverlayWidgetStore.yColumnRepresentation 
        };
        this.indicatorInfo = undefined;
        this.border = this.initBorder;
        this.dragmode = "select";
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
            this.border = this.initBorder;
        }
    }

    @action setIndicator(val: Point2D) {
        this.indicatorInfo = val;
    }

    @action setBorder(border: Border) {
        this.border = border;
    }

    @action setDragmode(mode: DragMode) {
        this.dragmode = mode;
    }

    @computed get initBorder(): Border {
        const xBounds = minMaxArray(this.xDataset);
        const yBounds = minMaxArray(this.yDataset);
        return {
            xMin: xBounds.minVal,
            xMax: xBounds.maxVal,
            yMin: yBounds.minVal,
            yMax: yBounds.maxVal
        };
    }

    @computed get enablePlotButton(): boolean {
        return (this.columnsName.x !== null && this.columnsName.y !== null && !this.catalogOverlayWidgetStore.loadingData && !this.catalogOverlayWidgetStore.updatingDataStream);
    }
}