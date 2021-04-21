import * as AST from "ast_wrapper";
import {action, observable, ObservableMap, computed,makeObservable} from "mobx";
import {AppStore, CatalogProfileStore, CatalogSystemType, WidgetsStore} from "stores";
import {CatalogWebGLService, CatalogTextureType} from "services";
import {CatalogWidgetStore} from "stores/widgets";

type CatalogOverlayCoords = {
    dataPoints: Float32Array,
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

    @observable catalogGLData: ObservableMap<number, CatalogOverlayCoords>;
    // map image file id with catalog file Id
    @observable imageAssociatedCatalogId: Map<number, Array<number>>;
    // map catalog component Id with catalog file Id
    @observable catalogProfiles: Map<string, number>;
    // map catalog plot component Id with catalog file Id and associated catalog plot widget id
    @observable catalogPlots: Map<string, ObservableMap<number, string>>;
    // catalog Profile store with catalog file Id
    @observable catalogProfileStores: Map<number, CatalogProfileStore>;
    // catalog file Id with catalog widget storeId
    @observable catalogWidgets: Map<number, string>;

    private constructor() {
        makeObservable(this);
        this.catalogGLData = new ObservableMap();
        this.imageAssociatedCatalogId = new Map<number, Array<number>>();
        this.catalogProfiles = new Map<string, number>();
        this.catalogPlots = new Map<string, ObservableMap<number, string>>();
        this.catalogProfileStores = new Map<number, CatalogProfileStore>();
        this.catalogWidgets = new Map<number, string>();
    }

    @action addCatalog(fileId: number) {
        this.catalogGLData.set(fileId, {
            dataPoints:new Float32Array(0),
            displayed: true
        });
    }

    @action updateCatalogData(fileId: number, xData: Array<number>, yData: Array<number>, wcsInfo: number, xUnit: string, yUnit: string, catalogFrame: CatalogSystemType) {
        const catalog = this.catalogGLData.get(fileId);
        if (catalog) {
            const dataSize = catalog.dataPoints.length;
            let dataPoints = new Float32Array(dataSize + xData.length * 2);
            dataPoints.set(catalog.dataPoints);
            switch (catalogFrame) {
                case CatalogSystemType.Pixel0:
                    for (let i = 0; i < xData.length; i++) {
                        dataPoints[dataSize + i * 2] = xData[i];
                        dataPoints[dataSize + i * 2 + 1] = yData[i];
                    }
                    break;
                case CatalogSystemType.Pixel1:
                    for (let i = 0; i < xData.length; i++) {
                        dataPoints[dataSize + i * 2] = xData[i] - 1;
                        dataPoints[dataSize + i * 2 + 1] = yData[i] - 1;
                    }
                    break;
                default:
                    const pixelData = CatalogStore.TransformCatalogData(xData, yData, wcsInfo, xUnit, yUnit, catalogFrame);
                    for (let i = 0; i < pixelData.xImageCoords.length; i++) {
                        dataPoints[dataSize + i * 2] = pixelData.xImageCoords[i];
                        dataPoints[dataSize + i * 2 + 1] = pixelData.yImageCoords[i];
                    }
                    break;
            }
            catalog.dataPoints = dataPoints;
            CatalogWebGLService.Instance.updateDataTexture(fileId, dataPoints, CatalogTextureType.Position);
        }
    }

    @action clearImageCoordsData(fileId: number) {
        const catalog = this.catalogGLData.get(fileId);
        if (catalog) {
            catalog.dataPoints = new Float32Array(0);
        }
    }

    @action removeCatalog(fileId: number) {
        this.catalogGLData.delete(fileId);
        CatalogWebGLService.Instance.clearTexture(fileId);
    }

    @action updateImageAssociatedCatalogId(activeFrameIndex: number, associatedCatalogFiles: number[]) {
        this.imageAssociatedCatalogId.set(activeFrameIndex, associatedCatalogFiles);
    }

    @action resetActiveCatalogFile(imageFileId: number) {
        const fileIds = this.imageAssociatedCatalogId.get(imageFileId);
        const activeCatalogFileIds = fileIds ? fileIds : [];
        if (this.catalogProfiles.size && activeCatalogFileIds?.length) {
            this.catalogProfiles.forEach((value , componentId) => {
                this.catalogProfiles.set(componentId, activeCatalogFileIds[0]);
            });  
        }
        this.resetDisplayedData(activeCatalogFileIds);
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

    @action resetDisplayedData(associatedCatalogFileId: Array<number>) {
        if (associatedCatalogFileId.length) {
            this.catalogGLData.forEach((catalog, fileId) => {
                let displayed = true;
                if (!associatedCatalogFileId.includes(fileId)) {
                    displayed = false;
                }
                catalog.displayed = displayed;
            });
        } else {
            this.catalogGLData.forEach((catalog) => {
                catalog.displayed = false;
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

    @action closeAssociatedCatalog(imageFileId: number) {
        const catalogFileIds = this.imageAssociatedCatalogId.get(imageFileId);
        if (catalogFileIds?.length) {
            catalogFileIds.forEach((catalogFileId) => {
                const widgetId = this.catalogWidgets.get(catalogFileId);
                if (widgetId) {
                    AppStore.Instance.removeCatalog(catalogFileId, widgetId);   
                }
            });
            this.imageAssociatedCatalogId.delete(imageFileId);
        }
    }

    @computed get activeCatalogFiles() {
        const activeFrame = AppStore.Instance.activeFrame;
        if (activeFrame) {
            const imageId = activeFrame.frameInfo.fileId;
            let associatedCatalogIds = [...this.imageAssociatedCatalogId.get(imageId)];
            const spatialMatchedImageId = activeFrame?.spatialReference?.frameInfo?.fileId;
            if (spatialMatchedImageId >= 0) {
                const spatialReferencedCatalogs = this.imageAssociatedCatalogId.get(spatialMatchedImageId);
                associatedCatalogIds = [...new Set([].concat(...[associatedCatalogIds, spatialReferencedCatalogs]))];
            }

            activeFrame.secondarySpatialImages?.forEach(frame => {
                const secondarySpatialReferencedCatalogs = this.imageAssociatedCatalogId.get(frame.frameInfo.fileId);
                associatedCatalogIds = [...new Set([].concat(...[associatedCatalogIds, secondarySpatialReferencedCatalogs]))];
            });
            
            console.log(associatedCatalogIds)
            // console.log(this.imageAssociatedCatalogId)
            return associatedCatalogIds;
        } else {
            return [];
        }
    }

    getFramIdByCatalogId(catalogId: number): number {
        let frameId = -1;
        this.imageAssociatedCatalogId.forEach((catalogIds, imageId) => {
            if (catalogIds.includes(catalogId)) {
                frameId = imageId;
            }
        });
        return frameId;
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

    getCatalogFileNames(fileIds: Array<number>) {
        let fileList = new Map<number, string>();
        fileIds.forEach(catalogFileId => {
            const catalogProfileStore = this.catalogProfileStores.get(catalogFileId);
            if (catalogProfileStore) {
                const catalogFile = catalogProfileStore.catalogInfo;
                fileList.set(catalogFile.fileId, catalogFile.fileInfo.name);
            }
        });
        return fileList;
    }

    // catalog widget store
    getCatalogWidgetStore(fileId: number): CatalogWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (this.catalogWidgets.has(fileId)) {
            const widgetStoreId = this.catalogWidgets.get(fileId);
            return widgetsStore.catalogWidgets.get(widgetStoreId);     
        } else {
            const widgetId = widgetsStore.addCatalogWidget(fileId);
            return widgetsStore.catalogWidgets.get(widgetId);
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