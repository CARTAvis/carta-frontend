import * as AST from "ast_wrapper";
import {action, observable, ObservableMap} from "mobx";
import {Colors} from "@blueprintjs/core";
import {SystemType} from "stores";
import {CatalogOverlayShape} from "stores/widgets";

type CatalogSettings = {
    color: string,
    size: number,
    shape: CatalogOverlayShape,
    xImageCoords: Array<number>[],
    yImageCoords: Array<number>[],
};

export class CatalogStore {
    private readonly degreeUnits = ["deg", "degrees"];
    private readonly arcsecUnits = ["arcsec", "arcsecond"];
    private readonly arcminUnits = ["arcmin", "arcminute"];

    // catalogOverlayWidget Id: settings
    @observable catalogs: ObservableMap<string, CatalogSettings>;

    constructor() {
        this.catalogs = new ObservableMap();
    }

    @action addCatalogs(widgetId: string) {
        this.catalogs.set(widgetId, { color: Colors.RED2, size: 5, shape: CatalogOverlayShape.Circle, xImageCoords: [], yImageCoords: [] });
    }

    @action updateCatalogData(widgetId: string, xWcsData: Array<any>, yWcsData: Array<any>, wcsInfo: number, xUnit: string, yUnit: string, catalogFrame: SystemType) {
        const pixelData = this.transformCatalogData(xWcsData, yWcsData, wcsInfo, xUnit, yUnit, catalogFrame);
        this.catalogs.get(widgetId).xImageCoords.push(pixelData.xImageCoords);
        this.catalogs.get(widgetId).yImageCoords.push(pixelData.yImageCoords);
    }

    @action updateCatalogSize(widgetId: string, size: number) {
        this.catalogs.get(widgetId).size = size;
    }

    @action updateCatalogColor(widgetId: string, color: string) {
        this.catalogs.get(widgetId).color = color;
    }

    @action updateCatalogShape(widgetId: string, shape: CatalogOverlayShape) {
        this.catalogs.get(widgetId).shape = shape;
    }

    @action clearData(widgetId: string) {
        this.catalogs.get(widgetId).xImageCoords = [];
        this.catalogs.get(widgetId).yImageCoords = [];
    }

    @action removeCatalog(widgetId: string) {
        this.catalogs.delete(widgetId);
    }

    private transformCatalogData(xWcsData: Array<any>, yWcsData: Array<any>, wcsInfo: number, xUnit: string, yUnit: string, catalogFrame: SystemType): {xImageCoords: Array<number>, yImageCoords: Array<number>} {
        const xImageCoords = [];
        const yImageCoords = [];
        if (xWcsData.length === yWcsData.length) {
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
            }

            if (this.degreeUnits.indexOf(yUnitLowerCase) !== -1) {
                yFraction = Math.PI / 180.0;
            } else if (this.arcminUnits.indexOf(yUnitLowerCase) !== -1) {
                yFraction = Math.PI / 10800.0;
            } else if (this.arcsecUnits.indexOf(yUnitLowerCase) !== -1) {
                yFraction = Math.PI / 648000.0;
            }
            for (let index = 0; index < xWcsData.length; index++) {
                const xWCSValue = xWcsData[index] * xFraction;
                const yWCSValue = yWcsData[index] * yFraction;
                const pixelValue = AST.transformPoint(wcsCopy, xWCSValue, yWCSValue, false);
                xImageCoords.push(pixelValue.x);
                yImageCoords.push(pixelValue.y);
            }
            AST.delete(wcsCopy);
        }
        return {xImageCoords: xImageCoords, yImageCoords: yImageCoords};
    }
}