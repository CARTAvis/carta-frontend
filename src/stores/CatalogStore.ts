import * as AST from "ast_wrapper";
import {action, observable, ObservableMap} from "mobx";
import {Colors} from "@blueprintjs/core";
import {Point2D} from "models";

type CatalogSettings = {
    color: string,
    size: number,
    pixelData: Array<Point2D>[]
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

    @action initCatalogs(widgetId: string) {
        this.catalogs.set(widgetId, { color: Colors.RED2, size: 1, pixelData: [] });
    }

    @action updateCatalogData(widgetId: string, xWcsData: Array<any>, yWcsData: Array<any>, wcsInfo: number, xUnit: string, yUnit: string) {
        const pixelData = this.transformCatalogData(xWcsData, yWcsData, wcsInfo, xUnit, yUnit);
        this.catalogs.get(widgetId).pixelData.push(pixelData);
    }

    @action updateCatalogSize(widgetId: string, size: number) {
        this.catalogs.get(widgetId).size = size;
    }

    @action updateCatalogColor(widgetId: string, color: string) {
        this.catalogs.get(widgetId).color = color;
    }

    @action clearData(widgetId: string) {
        this.catalogs.get(widgetId).pixelData = [];
    }

    @action removeCatalog(widgetId: string) {
        this.catalogs.delete(widgetId);
    }

    private transformCatalogData(xWcsData: Array<any>, yWcsData: Array<any>, wcsInfo: number, xUnit: string, yUnit: string): Array<Point2D> {
        const pixelData = [];
        // Todo: add offset accoring coordinate system
        if (xWcsData.length === yWcsData.length) {
            const xUnitLowerCase = xUnit.toLocaleLowerCase();
            const yUnitLowerCase = yUnit.toLocaleLowerCase();
            let xFraction = 1;
            let yFraction = 1;
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
                const pixelValue = AST.transformPoint(wcsInfo, xWCSValue, yWCSValue, false);
                pixelData.push(pixelValue);
            }
        }
        return pixelData;
    }
}