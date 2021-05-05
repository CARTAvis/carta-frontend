import * as AST from "ast_wrapper";
import {action, observable, ObservableMap, computed,makeObservable} from "mobx";
import {AppStore, CatalogProfileStore, CatalogSystemType, CatalogOverlay, WidgetsStore} from "stores";
import {CatalogWebGLService, CatalogTextureType} from "services";
import {CatalogWidgetStore} from "stores/widgets";

type CatalogOverlayCoords = {
    x: Float32Array,
    y: Float32Array
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
    // image file id : catalog file Id
    @observable imageAssociatedCatalogId: Map<number, Array<number>>;
    // catalog component Id : catalog file Id
    @observable catalogProfiles: Map<string, number>;
    // catalog plot component Id : catalog file Id and associated catalog plot widget id
    @observable catalogPlots: Map<string, ObservableMap<number, string>>;
    // catalog file Id : catalog Profile store
    @observable catalogProfileStores: Map<number, CatalogProfileStore>;
    // catalog file Id : catalog widget storeId
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
            x: new Float32Array(0),
            y: new Float32Array(0)
        });
    }

    @action updateCatalogData(fileId: number, xData: Array<number>, yData: Array<number>, wcsInfo: AST.FrameSet, xUnit: string, yUnit: string, catalogFrame: CatalogSystemType) {
        const catalog = this.catalogGLData.get(fileId);
        if (catalog && xData && yData) {
            const dataSize = catalog.x.length;
            let xPoints = new Float32Array(dataSize + xData.length);
            let yPoints = new Float32Array(dataSize + yData.length);
            xPoints.set(catalog.x);
            yPoints.set(catalog.y);
            switch (catalogFrame) {
                case CatalogSystemType.Pixel0:
                    for (let i = 0; i < xData.length; i++) {
                        xPoints[dataSize + i] = xData[i];
                        yPoints[dataSize + i] = yData[i];
                    }
                    break;
                case CatalogSystemType.Pixel1:
                    for (let i = 0; i < xData.length; i++) {
                        xPoints[dataSize + i] = xData[i] - 1;
                        yPoints[dataSize + i] = yData[i] - 1;
                    }
                    break;
                default:
                    const pixelData = CatalogStore.TransformCatalogData(xData, yData, wcsInfo, xUnit, yUnit, catalogFrame);
                    for (let i = 0; i < pixelData.xImageCoords.length; i++) {
                        xPoints[dataSize + i] = pixelData.xImageCoords[i];
                        yPoints[dataSize + i] = pixelData.yImageCoords[i];
                    }
                    break;
            }
            catalog.x = xPoints;
            catalog.y = yPoints;
            CatalogWebGLService.Instance.updateDataTexture(fileId, xPoints, CatalogTextureType.X);
            CatalogWebGLService.Instance.updateDataTexture(fileId, yPoints, CatalogTextureType.Y);
        }
    }

    @action updateSpatialMatchedCatalog(imageMapId: string, catalogFileId: number) {
            const activeFrame = AppStore.Instance.activeFrame;
            const catalogWidgetStore = this.getCatalogWidgetStore(catalogFileId);
            const xColumn = catalogWidgetStore.xAxis;
            const yColumn = catalogWidgetStore.yAxis;
            if (xColumn !== CatalogOverlay.NONE && yColumn !== CatalogOverlay.NONE) {
                const catalogProfileStore = this.catalogProfileStores.get(catalogFileId);
                const coords = catalogProfileStore.get2DPlotData(xColumn, yColumn, catalogProfileStore.catalogData);
                const wcs = activeFrame.validWcs ? activeFrame.wcsInfo : 0;
                let xPoints = new Float32Array(coords.wcsX.length);
                let yPoints = new Float32Array(coords.wcsX.length);
                const catalogSystem = catalogProfileStore.catalogCoordinateSystem.system;
                switch (catalogSystem) {
                    case CatalogSystemType.Pixel0:
                        for (let i = 0; i < coords.wcsX.length; i++) {
                            xPoints[i] = coords.wcsX[i];
                            yPoints[i] = coords.wcsY[i];
                        }
                        break;
                    case CatalogSystemType.Pixel1:
                        for (let i = 0; i < coords.wcsX.length; i++) {
                            xPoints[i] = coords.wcsX[i] - 1;
                            yPoints[i] = coords.wcsY[i] - 1;
                        }
                        break;
                    default:
                        const pixelData = CatalogStore.TransformCatalogData(coords.wcsX, coords.wcsY, wcs, coords.xHeaderInfo.units, coords.yHeaderInfo.units, catalogSystem);
                        for (let i = 0; i < pixelData.xImageCoords.length; i++) {
                            xPoints[i] = pixelData.xImageCoords[i];
                            yPoints[i] = pixelData.yImageCoords[i];
                        }
                        break;
                }
                CatalogWebGLService.Instance.updateSpatialMatchedTexture(imageMapId, catalogFileId, xPoints, yPoints);
            }
    }

    // only recalculate position when source image and destination image have different projection types
    // takes about 3s to recalculate and update 1M points
    // TODO: use control maps to perform approximate transformation on the GPU
    convertSpatialMatchedData() {
        const activeFrame = AppStore.Instance.activeFrame;
        const destinationFrameId = activeFrame?.frameInfo?.fileId;
        activeFrame.spatialSiblings?.forEach(frame => {
            const sourceFrameId = frame.frameInfo.fileId;
            if (sourceFrameId !== destinationFrameId) {
                const imageMapId = `${sourceFrameId}-${destinationFrameId}`;
                this.imageAssociatedCatalogId.get(sourceFrameId)?.forEach(catalogFileId => {
                    this.updateSpatialMatchedCatalog(imageMapId, catalogFileId);   
                });   
            }
        });
    }

    @action clearImageCoordsData(fileId: number) {
        const catalog = this.catalogGLData.get(fileId);
        if (catalog) {
            catalog.x = new Float32Array(0);
            catalog.y = new Float32Array(0);
        }
    }

    @action removeCatalog(fileId: number, catalogComponentId?: string) {
        this.catalogGLData.delete(fileId);
        CatalogWebGLService.Instance.clearTexture(fileId);
        // update associated image
        const frame = AppStore.Instance.getFrame(this.getFrameIdByCatalogId(fileId));
        const fileIds = this.imageAssociatedCatalogId.get(frame?.frameInfo.fileId);
        let associatedCatalogId = [];
        if (fileIds) {
            associatedCatalogId = fileIds.filter(catalogFileId => {
                return catalogFileId !== fileId;
            });
            this.updateImageAssociatedCatalogId(frame.frameInfo.fileId, associatedCatalogId);
        }

        // update catalogProfiles fileId            
        if (catalogComponentId && associatedCatalogId.length) {
            this.catalogProfiles.forEach((catalogFileId, componentId) => {
                if (catalogFileId === fileId) {
                    this.catalogProfiles.set(componentId, associatedCatalogId[0]);
                }
            });
        }
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

    getImageIdByCatalog(catalogFileId: number) {
        let imageFileId = undefined;
        this.imageAssociatedCatalogId.forEach((catalogFileList, imageId) => {
            if (catalogFileList.includes(catalogFileId)) {
                imageFileId = imageId;
            }
        });
        return imageFileId;
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
        this.catalogPlots.forEach((catalogWidgetMap, _componentId) => {
            const widgetId = catalogWidgetMap.get(fileId);
            WidgetsStore.Instance.catalogPlotWidgets.delete(widgetId);
            catalogWidgetMap.delete(fileId);
        });
    }

    @action clearCatalogPlotsByComponentId(componentId: string) {
        const catalogWidgetMap = this.catalogPlots.get(componentId);
        if (catalogWidgetMap) {
            catalogWidgetMap.forEach((widgetId, _catalogFileId) => {
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
        const appStore = AppStore.Instance;
        const catalogFileIds = this.imageAssociatedCatalogId.get(imageFileId);
        if (catalogFileIds?.length) {
            catalogFileIds.forEach((catalogFileId) => {
                const widgetId = this.catalogWidgets.get(catalogFileId);
                if (widgetId) {
                    appStore.widgetsStore.catalogWidgets.get(widgetId)?.resetMaps();
                    appStore.removeCatalog(catalogFileId, widgetId);   
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
            activeFrame.spatialSiblings?.forEach(frame => {
                const catalogs = [...this.imageAssociatedCatalogId.get(frame.frameInfo.fileId)];
                associatedCatalogIds = [...new Set([].concat(...[associatedCatalogIds, catalogs]))].filter(catalogFileId => {
                    return this.catalogGLData.get(catalogFileId) !== undefined;
                });
            });
            return associatedCatalogIds.sort((a, b) => a - b);
        } else {
            return [];
        }
    }

    getFrameIdByCatalogId(catalogId: number): number {
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

    private static TransformCatalogData(xWcsData: Array<number>, yWcsData: Array<number>, wcsInfo: AST.FrameSet, xUnit: string, yUnit: string, catalogFrame: CatalogSystemType): { xImageCoords: Float64Array, yImageCoords: Float64Array } {
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

            const results = AST.transformPointArrays(wcsCopy, xWCSValues, yWCSValues, false);
            AST.deleteObject(wcsCopy);
            return {xImageCoords: results.x, yImageCoords: results.y};
        }
        return {xImageCoords: new Float64Array(0), yImageCoords: new Float64Array(0)};
    }
}