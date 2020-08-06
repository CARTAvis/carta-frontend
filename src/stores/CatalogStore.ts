import * as AST from "ast_wrapper";
import {action, observable, ObservableMap, computed} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CatalogOverlayShape, CatalogSystemType} from "stores/widgets";
import {AppStore} from "./AppStore";
import {WidgetsStore} from "./WidgetsStore";

type CatalogDataInfo = {
    fileId: number,
    xImageCoords: Array<number>,
    yImageCoords: Array<number>,
    xSelectedCoords: Array<number>,
    ySelectedCoords: Array<number>,
    showSelectedData: boolean;
    displayed: boolean;
};

export class CatalogStore {
    private static staticInstance: CatalogStore;

    static get Instance() {
        if (!CatalogStore.staticInstance) {
            CatalogStore.staticInstance = new CatalogStore();
        }
        return CatalogStore.staticInstance;
    }

    private static readonly DegreeUnits = ["deg", "degrees"];
    private static readonly ArcsecUnits = ["arcsec", "arcsecond"];
    private static readonly ArcminUnits = ["arcmin", "arcminute"];

    @observable catalogData: ObservableMap<string, CatalogDataInfo>;
    @observable catalogColor: ObservableMap<string, string>;
    @observable catalogSize: ObservableMap<string, number>;
    @observable catalogShape: ObservableMap<string, CatalogOverlayShape>;
    // map image file id with catalog file Id
    @observable imageAssociatedCatalogId: Map<number, Array<number>>;
    // map catalog component Id with catalog file Id
    @observable catalogProfiles: Map<string, number>;
    // map catalog plot component Id with catalog file Id and associated catalog plot widget id
    @observable catalogPlots: Map<string, ObservableMap<number, string>>;

    private constructor() {
        this.catalogData = new ObservableMap();
        this.catalogColor = new ObservableMap();
        this.catalogSize = new ObservableMap();
        this.catalogShape = new ObservableMap();
        this.imageAssociatedCatalogId = new Map<number, Array<number>>();
        this.catalogProfiles = new Map<string, number>();
        this.catalogPlots = new Map<string, ObservableMap<number, string>>();
    }

    @action addCatalog(widgetId: string, fileId: number) {
        // init catalog data
        this.catalogData.set(widgetId, {
            fileId: fileId,
            xImageCoords: [],
            yImageCoords: [],
            xSelectedCoords: [],
            ySelectedCoords: [],
            showSelectedData: false,
            displayed: true
        });
        this.catalogColor.set(widgetId, Colors.TURQUOISE3);
        this.catalogSize.set(widgetId, 5);
        this.catalogShape.set(widgetId, CatalogOverlayShape.Circle);
    }

    @action updateCatalogData(widgetId: string, xData: Array<number>, yData: Array<number>, wcsInfo: number, xUnit: string, yUnit: string, catalogFrame: CatalogSystemType) {
        const catalogDataInfo = this.catalogData.get(widgetId);
        if (catalogDataInfo) {
            switch (catalogFrame) {
                case CatalogSystemType.Pixel0:
                    for (let i = 0; i < xData.length; i++) {
                        catalogDataInfo.xImageCoords.push(xData[i] + 1);
                        catalogDataInfo.yImageCoords.push(yData[i] + 1);
                    }
                    break;
                case CatalogSystemType.Pixel1:
                    for (let i = 0; i < xData.length; i++) {
                        catalogDataInfo.xImageCoords.push(xData[i]);
                        catalogDataInfo.yImageCoords.push(yData[i]);
                    }
                    break;
                default:
                    const pixelData = CatalogStore.TransformCatalogData(xData, yData, wcsInfo, xUnit, yUnit, catalogFrame);
                    console.time(`updatePixelCoordsArray_${xData?.length}`);
                    for (let i = 0; i < pixelData.xImageCoords.length; i++) {
                        catalogDataInfo.xImageCoords.push(pixelData.xImageCoords[i]);
                        catalogDataInfo.yImageCoords.push(pixelData.yImageCoords[i]);
                    }
                    console.timeEnd(`updatePixelCoordsArray_${xData?.length}`);
                    break;
            }
            this.catalogData.set(widgetId,
                {
                    fileId: catalogDataInfo.fileId,
                    xImageCoords: catalogDataInfo.xImageCoords,
                    yImageCoords: catalogDataInfo.yImageCoords,
                    xSelectedCoords: catalogDataInfo.xSelectedCoords,
                    ySelectedCoords: catalogDataInfo.ySelectedCoords,
                    showSelectedData: catalogDataInfo.showSelectedData,
                    displayed: catalogDataInfo.displayed
                });
        }
    }

    @action updateSelectedPoints(widgetId: string, xSelectedCoords: Array<number>, ySelectedCoords: Array<number>) {
        const catalogDataInfo = this.catalogData.get(widgetId);
        if (catalogDataInfo) {
            this.catalogData.set(widgetId,
                {
                    fileId: catalogDataInfo.fileId,
                    xImageCoords: catalogDataInfo.xImageCoords,
                    yImageCoords: catalogDataInfo.yImageCoords,
                    xSelectedCoords: xSelectedCoords,
                    ySelectedCoords: ySelectedCoords,
                    showSelectedData: catalogDataInfo.showSelectedData,
                    displayed: catalogDataInfo.displayed
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

    @action clearImageCoordsData(widgetId: string) {
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
    }

    @action updateShowSelectedData(widgetId: string, val: boolean) {
        const catalog = this.catalogData.get(widgetId);
        if (catalog) {
            catalog.showSelectedData = val;
        }
    }

    @action updateImageAssociatedCatalogId(activeFrameIndex: number, associatedCatalogFiles: number[]) {
        this.imageAssociatedCatalogId.set(activeFrameIndex, associatedCatalogFiles);
    }

    @action resetActivedCatalogFile(imageFileId: number) {
        const appStore = AppStore.Instance;
        const activedCatalog = this.imageAssociatedCatalogId.get(imageFileId);
        if (this.catalogProfiles.size && activedCatalog?.length) {
            this.catalogProfiles.forEach((value , componentId) => {
                this.catalogProfiles.set(componentId, activedCatalog[0]);
            });  
        }
        let associatedWidgetsId = [];
        activedCatalog?.forEach(fileId => {
            appStore.catalogs.forEach((value, key) => {
                if (value === fileId) {
                    associatedWidgetsId.push(key);
                }
            });
        });
        this.resetDisplayedData(associatedWidgetsId); 
    }

    // update associated catalogProfile fileId
    @action updateCatalogProfiles = (catalogFileId: number) => {
        if (this.catalogProfiles.size > 0) {
            const componentIds = Array.from(this.catalogProfiles.keys());
            const fileIds = Array.from(this.catalogProfiles.values());
            if (!fileIds.includes(catalogFileId)) {
                this.catalogProfiles.set(componentIds[0], catalogFileId);
            }
        }
    };

    getImageIdbyCatalog(catalogFileId: number) {
        let imagefileId = undefined;
        this.imageAssociatedCatalogId.forEach((catalogFileList, imageId) => {
            if (catalogFileList.includes(catalogFileId)) {
                imagefileId = imageId;
            }
        });
        return imagefileId;
    }

    getAssociatedWidgetsId(catalogFileId: number) {
        let widget = undefined;
        AppStore.Instance.catalogs.forEach((fileId, widgetId) => {
            if (fileId === catalogFileId) {
                widget = widgetId;
            }
        });
        return widget;
    }

    @action resetDisplayedData(associatedWidgetId: Array<string>) {
        if (associatedWidgetId.length) {
            this.catalogData.forEach((catalogDataInfo, widgetId) => {
                let displayed = true;
                if (!associatedWidgetId.includes(widgetId)) {
                    displayed = false;
                }
                this.catalogData.set(widgetId,
                    {
                        fileId: catalogDataInfo.fileId,
                        xImageCoords: catalogDataInfo.xImageCoords,
                        yImageCoords: catalogDataInfo.yImageCoords,
                        xSelectedCoords: catalogDataInfo.xSelectedCoords,
                        ySelectedCoords: catalogDataInfo.ySelectedCoords,
                        showSelectedData: catalogDataInfo.showSelectedData,
                        displayed: displayed
                    }
                );
            });
        } else {
            this.catalogData.forEach((catalogDataInfo, widgetId) => {
                this.catalogData.set(widgetId,
                    {
                        fileId: catalogDataInfo.fileId,
                        xImageCoords: catalogDataInfo.xImageCoords,
                        yImageCoords: catalogDataInfo.yImageCoords,
                        xSelectedCoords: catalogDataInfo.xSelectedCoords,
                        ySelectedCoords: catalogDataInfo.ySelectedCoords,
                        showSelectedData: catalogDataInfo.showSelectedData,
                        displayed: false
                    });
            });
        }
    }

    @action setCatalogPlots(componentId: string, fileId: number, widgetId: string) {
        let catalogWidgetMap = this.catalogPlots.get(componentId);
        if (catalogWidgetMap) {
            catalogWidgetMap.set(fileId, widgetId);
        } else {
            catalogWidgetMap = new ObservableMap<number, string>();
            catalogWidgetMap.set(fileId, widgetId);
            this.catalogPlots.set(componentId, catalogWidgetMap);
        }
    }

    // remove catalog plot widget, keep placeholder
    @action clearCatalogPlotsByFileId(fileId: number) {
        this.catalogPlots.forEach((catalogWidgetMap, componentId) => {
            const widgetId = catalogWidgetMap.get(fileId);
            WidgetsStore.Instance.catalogPlotWidgets.delete(widgetId);
            catalogWidgetMap.delete(fileId);
        });
    }

    @action clearCatalogPlotsByComponentId(componentId: string) {
        const catalogWidgetMap = this.catalogPlots.get(componentId);
        if (catalogWidgetMap) {
            catalogWidgetMap.forEach((widgetId, catalogFileId) => {
                WidgetsStore.Instance.catalogPlotWidgets.delete(widgetId);
            });
            this.catalogPlots.delete(componentId);
        }
    }

    @action clearCatalogPlotsByWidgetId(widgetId: string) {
        const catalogs = this.getAssociatedIdByWidgetId(widgetId);
        if (catalogs.catalogPlotComponentId) {
            this.clearCatalogPlotsByComponentId(catalogs.catalogPlotComponentId);
        }
    }

    getAssociatedIdByWidgetId(catalogPlotWidgetId: string): {catalogPlotComponentId: string, catalogFileId: number} {
        let catalogPlotComponentId;
        let catalogFileId;
        this.catalogPlots.forEach((catalogWidgetMap, componentId) => {
            catalogWidgetMap.forEach((widgetId, fileId) => {
                if (widgetId === catalogPlotWidgetId) {
                    catalogPlotComponentId = componentId;
                    catalogFileId = fileId;
                }
            });
        });
        return {catalogPlotComponentId: catalogPlotComponentId, catalogFileId: catalogFileId};
    }

    @action closeAssociatedCatalog(imageFileId: number) {
        const catalogFileIds = this.imageAssociatedCatalogId.get(imageFileId);
        if (catalogFileIds?.length) {
            catalogFileIds.forEach((catalogFileId) => {
                const widgetId = this.getAssociatedWidgetsId(catalogFileId);
                if (widgetId) {
                    AppStore.Instance.removeCatalog(widgetId);   
                }
            });
            this.imageAssociatedCatalogId.delete(imageFileId);
        }
    }

    @computed get activedCatalogFiles() {
        const activeFrame = AppStore.Instance.activeFrame;
        if (activeFrame) {
            const imageId = activeFrame.frameInfo.fileId;
            return this.imageAssociatedCatalogId.get(imageId);
        } else {
            return [];
        }
    }

    private static GetFractionFromUnit(unit: string): number {
        if (CatalogStore.ArcminUnits.includes(unit)) {
            return Math.PI / 10800.0;
        } else if (CatalogStore.ArcsecUnits.includes(unit)) {
            return Math.PI / 648000.0;
        } else {
            // if unit is null, using deg as default
            return Math.PI / 180.0;
        }
    }

    private static TransformCatalogData(xWcsData: Array<number>, yWcsData: Array<number>, wcsInfo: number, xUnit: string, yUnit: string, catalogFrame: CatalogSystemType): { xImageCoords: Float64Array, yImageCoords: Float64Array } {
        if (xWcsData?.length === yWcsData?.length && xWcsData?.length > 0) {
            const N = xWcsData.length;

            let xFraction = CatalogStore.GetFractionFromUnit(xUnit.toLocaleLowerCase());
            let yFraction = CatalogStore.GetFractionFromUnit(yUnit.toLocaleLowerCase());

            let wcsCopy = AST.copy(wcsInfo);
            let system = "System=" + catalogFrame;
            AST.set(wcsCopy, system);
            if (catalogFrame === CatalogSystemType.FK4) {
                AST.set(wcsCopy, "Epoch=B1950");
                AST.set(wcsCopy, "Equinox=1950");
            }

            if (catalogFrame === CatalogSystemType.FK5) {
                AST.set(wcsCopy, "Epoch=J2000");
                AST.set(wcsCopy, "Equinox=2000");
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