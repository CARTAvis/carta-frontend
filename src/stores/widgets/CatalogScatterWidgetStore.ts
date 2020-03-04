import {action, observable, computed} from "mobx";
import {CARTA} from "carta-protobuf";
import {CatalogOverlayWidgetStore} from "./CatalogOverlayWidgetStore";

export interface CatalogScatterWidgetStoreProps {
    x: Array<any>;
    y: Array<any>;
    catalogOverlayWidgetStore: CatalogOverlayWidgetStore;
}

export class CatalogScatterWidgetStore {
    @observable xDataset: Array<any>;
    @observable yDataset: Array<any>;
    @observable catalogOverlayWidgetStore: CatalogOverlayWidgetStore;
    @observable columnsName: {x: string, y: string};

    constructor(props: CatalogScatterWidgetStoreProps) {
        this.xDataset = props.x;
        this.yDataset = props.y;
        this.catalogOverlayWidgetStore = props.catalogOverlayWidgetStore;
        this.columnsName = { 
            x: this.catalogOverlayWidgetStore.xColumnRepresentation, 
            y: this.catalogOverlayWidgetStore.yColumnRepresentation 
        };
    }

    @action setColumnX(columnName: string) {
        this.columnsName.x = columnName;
        this.xDataset = this.catalogOverlayWidgetStore.get1DPlotData(columnName).wcsData;
    }

    @action setColumnY(columnName: string) {
        this.columnsName.y = columnName;
        this.yDataset = this.catalogOverlayWidgetStore.get1DPlotData(columnName).wcsData;
    }

    @action setXDataset(x: Array<any>) {
        this.xDataset.push(...x);
    }

    @action setYDataset(y: Array<any>) {
        this.yDataset.push(...y);
    }

    @action updateScatterData(columnsData: CARTA.ICatalogColumnsData) {
        const catalogOverlayWidgetStore = this.catalogOverlayWidgetStore;
        const columnsName = this.columnsName;
        if (columnsName.x && columnsName.y) {
            const coords = catalogOverlayWidgetStore.get2DPlotData(columnsName.x, columnsName.y, columnsData);
            this.setXDataset(coords.wcsX);
            this.setYDataset(coords.wcsY);
        }
    }
}