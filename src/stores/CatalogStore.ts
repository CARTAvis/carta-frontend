import * as AST from "ast_wrapper";
import {action, observable, ObservableMap} from "mobx";
import {Colors} from "@blueprintjs/core";
import {SystemType} from "stores";
import {CatalogOverlayShape} from "stores/widgets";

type CatalogDataInfo = {
    fileId: number,
    xImageCoords: Array<number>,
    yImageCoords: Array<number>,
    showSelectedData: boolean;
};

export class CatalogStore {
    private static staticInstance: CatalogStore;

    static get Instance() {
        if (!CatalogStore.staticInstance) {
            CatalogStore.staticInstance = new CatalogStore();
        }
        return CatalogStore.staticInstance;
    }

    private readonly degreeUnits = ["deg", "degrees"];
    private readonly arcsecUnits = ["arcsec", "arcsecond"];
    private readonly arcminUnits = ["arcmin", "arcminute"];

    @observable catalogData: ObservableMap<string, CatalogDataInfo>;
    @observable catalogColor: ObservableMap<string, string>;
    @observable catalogSize: ObservableMap<string, number>;
    @observable catalogShape: ObservableMap<string, CatalogOverlayShape>;
    @observable selectedPointIndexs: ObservableMap<string, number[]>;

    private constructor() {
        this.catalogData = new ObservableMap();
        this.catalogColor = new ObservableMap();
        this.catalogSize = new ObservableMap();
        this.catalogShape = new ObservableMap();
        this.selectedPointIndexs = new ObservableMap();
    }

    @action addCatalog(widgetId: string, fileId: number) {
        // init catalog data
        this.catalogData.set(widgetId, {
            fileId: fileId,
            xImageCoords: new Array(),
            yImageCoords: new Array(),
            showSelectedData: false
        });
        this.catalogColor.set(widgetId, Colors.TURQUOISE3);
        this.catalogSize.set(widgetId, 5);
        this.catalogShape.set(widgetId, CatalogOverlayShape.Circle);
    }

    @action updateCatalogData(widgetId: string, xWcsData: Array<any>, yWcsData: Array<any>, wcsInfo: number, xUnit: string, yUnit: string, catalogFrame: SystemType) {
        const pixelData = this.transformCatalogData(xWcsData, yWcsData, wcsInfo, xUnit, yUnit, catalogFrame);
        const catalogDataInfo = this.catalogData.get(widgetId);
        if (catalogDataInfo) {
            for (let i = 0; i < pixelData.xImageCoords.length; i++) {
                catalogDataInfo.xImageCoords.push(pixelData.xImageCoords[i]);
                catalogDataInfo.yImageCoords.push(pixelData.yImageCoords[i]);
            }
            this.catalogData.set(widgetId, 
                {
                    fileId: catalogDataInfo.fileId, 
                    xImageCoords: catalogDataInfo.xImageCoords, 
                    yImageCoords: catalogDataInfo.yImageCoords,
                    showSelectedData: catalogDataInfo.showSelectedData
                });
        }
    }

    @action updateCatalogSize(widgetId: string, size: number) {
        this.catalogSize.set(widgetId, size);
    }

    @action updateCatalogColor(widgetId: string, color: string) {
        this.catalogColor.set(widgetId, color);
    }

    @action updateCatalogShape(widgetId: string, shape: CatalogOverlayShape) {
        this.catalogShape.set(widgetId, shape);
    }

    @action clearData(widgetId: string) {
        const catalogData = this.catalogData.get(widgetId);
        if (catalogData) {
            catalogData.xImageCoords = [];
            catalogData.yImageCoords = [];
            catalogData.showSelectedData = false;
        }
    }

    @action removeCatalog(widgetId: string) {
        this.catalogData.delete(widgetId);
        this.catalogColor.delete(widgetId);
        this.catalogSize.delete(widgetId);
        this.catalogShape.delete(widgetId);
        this.selectedPointIndexs.delete(widgetId);
    }

    @action updateSelectedPoints(widgetId: string, selectedPointIndexs: number[]) {
        this.selectedPointIndexs.set(widgetId, selectedPointIndexs);
    }

    @action unSelectedAll() {
        if (this.catalogData.size > 0) {
            this.selectedPointIndexs.forEach((selectedPointIndexs, widgetId) => {
                this.selectedPointIndexs.set(widgetId, []);
            });
        }
    }

    @action updateShowSelectedData(widgetId: string, val: boolean) {
        const catalog = this.catalogData.get(widgetId);
        if (catalog) {
            catalog.showSelectedData = val;   
        }
    }

    private transformCatalogData(xWcsData: Array<any>, yWcsData: Array<any>, wcsInfo: number, xUnit: string, yUnit: string, catalogFrame: SystemType): {xImageCoords: Float64Array, yImageCoords: Float64Array} {
        if (xWcsData.length === yWcsData.length) {
            const N = xWcsData.length;

            const xUnitLowerCase = xUnit.toLocaleLowerCase();
            const yUnitLowerCase = yUnit.toLocaleLowerCase();
            let xFraction = 1;
            let yFraction = 1;

            let wcsCopy = AST.copy(wcsInfo);
            let system = "System=" + catalogFrame;
            AST.set(wcsCopy, system);
            if (catalogFrame === SystemType.FK4) {
                AST.set(wcsCopy, "Epoch=B1950");
                AST.set(wcsCopy, "Equinox=1950");
            }

            if (catalogFrame === SystemType.FK5) {
                AST.set(wcsCopy, "Epoch=J2000");
                AST.set(wcsCopy, "Equinox=2000");
            }

            if (this.degreeUnits.indexOf(xUnitLowerCase) !== -1) {
                xFraction = Math.PI / 180.0;
            } else if (this.arcminUnits.indexOf(xUnitLowerCase) !== -1) {
                xFraction = Math.PI / 10800.0;
            } else if (this.arcsecUnits.indexOf(xUnitLowerCase) !== -1) {
                xFraction = Math.PI / 648000.0;
            } else {
                // if unit is null, using deg as default
                xFraction = Math.PI / 180.0;
            }

            if (this.degreeUnits.indexOf(yUnitLowerCase) !== -1) {
                yFraction = Math.PI / 180.0;
            } else if (this.arcminUnits.indexOf(yUnitLowerCase) !== -1) {
                yFraction = Math.PI / 10800.0;
            } else if (this.arcsecUnits.indexOf(yUnitLowerCase) !== -1) {
                yFraction = Math.PI / 648000.0;
            } else {
                yFraction = Math.PI / 180.0;
            }

            const xWCSValues = new Float64Array(N);
            const yWCSValues = new Float64Array(N);

            for (let i = 0; i < N; i++) {
                xWCSValues[i] = xWcsData[i] * xFraction;
                yWCSValues[i] = yWcsData[i] * yFraction;
            }

            const results = AST.transformPointArrays(wcsCopy, xWCSValues, yWCSValues, 0);
            AST.delete(wcsCopy);
            return {xImageCoords: results.x, yImageCoords: results.y};
        }
        return {xImageCoords: new Float64Array(0), yImageCoords: new Float64Array(0)};
    }
}