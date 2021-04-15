import * as AST from "ast_wrapper";
import {action, observable, ObservableMap, computed,makeObservable} from "mobx";
import {AppStore, CatalogProfileStore, CatalogSystemType, WidgetsStore} from "stores";
import {CatalogWidgetStore} from "stores/widgets";

type CatalogOverlayDataInfo = {
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

    @observable catalogData: ObservableMap<number, CatalogOverlayDataInfo>;
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
        this.catalogData = new ObservableMap();
        this.imageAssociatedCatalogId = new Map<number, Array<number>>();
        this.catalogProfiles = new Map<string, number>();
        this.catalogPlots = new Map<string, ObservableMap<number, string>>();
        this.catalogProfileStores = new Map<number, CatalogProfileStore>();
        this.catalogWidgets = new Map<number, string>();
    }

    @action addCatalog(fileId: number) {
        // init catalog overlay data
        this.catalogData.set(fileId, {
            xImageCoords: [],
            yImageCoords: [],
            xSelectedCoords: [],
            ySelectedCoords: [],
            showSelectedData: false,
            displayed: true
        });
    }

    @action updateCatalogData(fileId: number, xData: Array<number>, yData: Array<number>, wcsInfo: AST.FrameSet, xUnit: string, yUnit: string, catalogFrame: CatalogSystemType) {
        const catalogDataInfo = this.catalogData.get(fileId);
        if (catalogDataInfo) {
            switch (catalogFrame) {
                case CatalogSystemType.Pixel0:
                    for (let i = 0; i < xData.length; i++) {
                        catalogDataInfo.xImageCoords.push(xData[i]);
                        catalogDataInfo.yImageCoords.push(yData[i]);
                    }
                    break;
                case CatalogSystemType.Pixel1:
                    for (let i = 0; i < xData.length; i++) {
                        catalogDataInfo.xImageCoords.push(xData[i] - 1);
                        catalogDataInfo.yImageCoords.push(yData[i] - 1);
                    }
                    break;
                default:
                    const pixelData = CatalogStore.TransformCatalogData(xData, yData, wcsInfo, xUnit, yUnit, catalogFrame);
                    for (let i = 0; i < pixelData.xImageCoords.length; i++) {
                        catalogDataInfo.xImageCoords.push(pixelData.xImageCoords[i]);
                        catalogDataInfo.yImageCoords.push(pixelData.yImageCoords[i]);
                    }
                    break;
            }
            this.catalogData.set(fileId,
                {
                    xImageCoords: catalogDataInfo.xImageCoords,
                    yImageCoords: catalogDataInfo.yImageCoords,
                    xSelectedCoords: catalogDataInfo.xSelectedCoords,
                    ySelectedCoords: catalogDataInfo.ySelectedCoords,
                    showSelectedData: catalogDataInfo.showSelectedData,
                    displayed: catalogDataInfo.displayed
                });
        }
    }

    @action updateSelectedPoints(fileId: number, xSelectedCoords: Array<number>, ySelectedCoords: Array<number>) {
        const catalogDataInfo = this.catalogData.get(fileId);
        if (catalogDataInfo) {
            this.catalogData.set(fileId,
                {
                    xImageCoords: catalogDataInfo.xImageCoords,
                    yImageCoords: catalogDataInfo.yImageCoords,
                    xSelectedCoords: xSelectedCoords,
                    ySelectedCoords: ySelectedCoords,
                    showSelectedData: catalogDataInfo.showSelectedData,
                    displayed: catalogDataInfo.displayed
                });
        }
    }

    @action clearImageCoordsData(fileId: number) {
        const catalogData = this.catalogData.get(fileId);
        if (catalogData) {
            catalogData.xImageCoords = [];
            catalogData.yImageCoords = [];
            catalogData.showSelectedData = false;
        }
    }

    @action removeCatalog(fileId: number) {
        this.catalogData.delete(fileId);
    }

    @action updateShowSelectedData(fileId: number, val: boolean) {
        const catalog = this.catalogData.get(fileId);
        if (catalog) {
            catalog.showSelectedData = val;
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
            this.catalogData.forEach((catalogDataInfo, fileId) => {
                let displayed = true;
                if (!associatedCatalogFileId.includes(fileId)) {
                    displayed = false;
                }
                this.catalogData.set(fileId,
                    {
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
            this.catalogData.forEach((catalogDataInfo, fileId) => {
                this.catalogData.set(fileId,
                    {
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
            return this.imageAssociatedCatalogId.get(imageId);
        } else {
            return [];
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