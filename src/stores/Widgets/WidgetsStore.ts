import * as GoldenLayout from "golden-layout";
import $ from "jquery";
import {action, computed, makeObservable, observable} from "mobx";

import {
    AnimatorComponent,
    CatalogOverlayComponent,
    CatalogOverlayPlotSettingsPanelComponent,
    CatalogPlotComponent,
    CursorInfoComponent,
    HistogramComponent,
    HistogramSettingsPanelComponent,
    ImageViewComponent,
    ImageViewSettingsPanelComponent,
    LayerListComponent,
    LayerListSettingsPanelComponent,
    LogComponent,
    PlaceholderComponent,
    PvGeneratorComponent,
    PvPreviewComponent,
    RegionListComponent,
    RenderConfigComponent,
    RenderConfigSettingsPanelComponent,
    SpatialProfilerComponent,
    SpatialProfilerSettingsPanelComponent,
    SpectralLineQueryComponent,
    SpectralProfilerComponent,
    SpectralProfilerSettingsPanelComponent,
    StatsComponent,
    StokesAnalysisComponent,
    // setting Panel
    StokesAnalysisSettingsPanelComponent
} from "components";
import {ImagePanelMode} from "models";
import {AppStore, CatalogStore, HelpStore, HelpType, LayoutStore, PreferenceKeys, PreferenceStore} from "stores";
import {
    ACTIVE_FILE_ID,
    CatalogPlotType,
    CatalogPlotWidgetStore,
    CatalogPlotWidgetStoreProps,
    CatalogWidgetStore,
    EmptyWidgetStore,
    HistogramWidgetStore,
    LayerListWidgetStore,
    PvGeneratorWidgetStore,
    RegionWidgetStore,
    RenderConfigWidgetStore,
    SpatialProfileWidgetStore,
    SpectralLineQueryWidgetStore,
    SpectralProfileWidgetStore,
    StatsWidgetStore,
    StokesAnalysisWidgetStore
} from "stores/Widgets";

export enum WidgetType {
    Region = "Region List Widget",
    Log = "Log Widget",
    SpatialProfiler = "Spatial Profiler",
    SpectralProfiler = "Spectral Profiler",
    Statistics = "Statistics Widget",
    Histogram = "Histogram Widget",
    Animator = "Animator Widget",
    RenderConfig = "Render Configuration Widget",
    StokesAnalysis = "Stokes Analysis Widget",
    ImageList = "Image List Widget",
    Catalog = "Catalog Widget",
    SpectralLineQuery = "Spectral Line Query Widget",
    CursorInfo = "Cursor Info Widget",
    PvGenerator = "PV Generator"
}

export interface DefaultWidgetConfig {
    id: string;
    type: string;
    minWidth: number;
    minHeight: number;
    defaultWidth: number;
    defaultHeight: number;
    defaultX?: number;
    defaultY?: number;
    isCloseable: boolean;
    title: string;
    parentId?: string;
    parentType?: string;
    helpType?: HelpType | HelpType[];
    componentId?: string;
}

export class WidgetConfig implements DefaultWidgetConfig {
    id: string;
    readonly type: string;
    readonly minWidth: number;
    readonly minHeight: number;
    @observable defaultWidth: number;
    @observable defaultHeight: number;
    @observable defaultX?: number;
    @observable defaultY?: number;
    readonly isCloseable: boolean;
    @observable title: string;
    parentId?: string;
    parentType?: string;
    helpType?: HelpType | HelpType[];
    componentId?: string;

    @action setDefaultPosition = (x: number, y: number) => {
        this.defaultX = x;
        this.defaultY = y;
    };

    @action setDefaultSize = (w: number, h: number) => {
        this.defaultWidth = w;
        this.defaultHeight = h;
    };

    constructor(id: string, defaultConfig: DefaultWidgetConfig) {
        makeObservable(this);

        this.id = id;
        this.type = defaultConfig.type;
        this.minWidth = defaultConfig.minWidth;
        this.minHeight = defaultConfig.minHeight;
        this.defaultWidth = defaultConfig.defaultWidth || defaultConfig.minWidth;
        this.defaultHeight = defaultConfig.defaultHeight || defaultConfig.minHeight;
        this.defaultX = defaultConfig.defaultX;
        this.defaultY = defaultConfig.defaultY;
        this.isCloseable = defaultConfig.isCloseable;
        this.title = defaultConfig.title;
        this.parentId = defaultConfig.parentId;
        this.parentType = defaultConfig.parentType;
        this.helpType = defaultConfig.helpType;
        this.componentId = defaultConfig.componentId;
    }
}

export class WidgetProps {
    id: string;
    docked: boolean;
    floatingSettingsId?: string;
}

export class WidgetsStore {
    private static staticInstance: WidgetsStore;

    static get Instance() {
        if (!WidgetsStore.staticInstance) {
            WidgetsStore.staticInstance = new WidgetsStore();
        }
        return WidgetsStore.staticInstance;
    }

    // Floating widgets
    @observable floatingWidgets: WidgetConfig[];
    // Widget Stores
    @observable renderConfigWidgets: Map<string, RenderConfigWidgetStore>;
    @observable spatialProfileWidgets: Map<string, SpatialProfileWidgetStore>;
    @observable spectralProfileWidgets: Map<string, SpectralProfileWidgetStore>;
    @observable statsWidgets: Map<string, StatsWidgetStore>;
    @observable histogramWidgets: Map<string, HistogramWidgetStore>;
    @observable layerListWidgets: Map<string, LayerListWidgetStore>;
    @observable logWidgets: Map<string, EmptyWidgetStore>;
    @observable regionListWidgets: Map<string, EmptyWidgetStore>;
    @observable animatorWidgets: Map<string, EmptyWidgetStore>;
    @observable stokesAnalysisWidgets: Map<string, StokesAnalysisWidgetStore>;
    @observable floatingSettingsWidgets: Map<string, string>;
    @observable catalogWidgets: Map<string, CatalogWidgetStore>;
    @observable catalogPlotWidgets: Map<string, CatalogPlotWidgetStore>;
    @observable spectralLineQueryWidgets: Map<string, SpectralLineQueryWidgetStore>;
    @observable cursorInfoWidgets: Map<string, EmptyWidgetStore>;
    @observable pvGeneratorWidgets: Map<string, PvGeneratorWidgetStore>;

    private widgetsMap: Map<string, Map<string, any>>;
    private defaultFloatingWidgetOffset: number;

    public readonly CARTAWidgets = new Map<WidgetType, {isCustomIcon: boolean; icon: string; onClick: () => void; widgetConfig: DefaultWidgetConfig}>([
        [
            WidgetType.Region,
            {
                isCustomIcon: true,
                icon: "regionList",
                onClick: () => WidgetsStore.Instance.createFloatingRegionListWidget(),
                widgetConfig: RegionListComponent.WIDGET_CONFIG
            }
        ],
        [WidgetType.Log, {isCustomIcon: false, icon: "application", onClick: () => WidgetsStore.Instance.createFloatingLogWidget(), widgetConfig: LogComponent.WIDGET_CONFIG}],
        [
            WidgetType.SpatialProfiler,
            {
                isCustomIcon: true,
                icon: "spatialProfiler",
                onClick: () => WidgetsStore.Instance.createFloatingSpatialProfilerWidget(),
                widgetConfig: SpatialProfilerComponent.WIDGET_CONFIG
            }
        ],
        [
            WidgetType.SpectralProfiler,
            {
                isCustomIcon: true,
                icon: "spectralProfiler",
                onClick: () => WidgetsStore.Instance.createFloatingSpectralProfilerWidget(),
                widgetConfig: SpectralProfilerComponent.WIDGET_CONFIG
            }
        ],
        [
            WidgetType.Statistics,
            {
                isCustomIcon: false,
                icon: "calculator",
                onClick: () => WidgetsStore.Instance.createFloatingStatsWidget(),
                widgetConfig: StatsComponent.WIDGET_CONFIG
            }
        ],
        [
            WidgetType.Histogram,
            {
                isCustomIcon: false,
                icon: "timeline-bar-chart",
                onClick: () => WidgetsStore.Instance.createFloatingHistogramWidget(),
                widgetConfig: HistogramComponent.WIDGET_CONFIG
            }
        ],
        [
            WidgetType.Animator,
            {
                isCustomIcon: false,
                icon: "video",
                onClick: () => WidgetsStore.Instance.createFloatingAnimatorWidget(),
                widgetConfig: AnimatorComponent.WIDGET_CONFIG
            }
        ],
        [
            WidgetType.RenderConfig,
            {
                isCustomIcon: false,
                icon: "style",
                onClick: () => WidgetsStore.Instance.createFloatingRenderWidget(),
                widgetConfig: RenderConfigComponent.WIDGET_CONFIG
            }
        ],
        [
            WidgetType.StokesAnalysis,
            {
                isCustomIcon: true,
                icon: "stokes",
                onClick: () => WidgetsStore.Instance.createFloatingStokesWidget(),
                widgetConfig: StokesAnalysisComponent.WIDGET_CONFIG
            }
        ],
        [
            WidgetType.ImageList,
            {
                isCustomIcon: false,
                icon: "layers",
                onClick: () => WidgetsStore.Instance.createFloatingLayerListWidget(),
                widgetConfig: LayerListComponent.WIDGET_CONFIG
            }
        ],
        [
            WidgetType.Catalog,
            {
                isCustomIcon: false,
                icon: "heatmap",
                onClick: () => WidgetsStore.Instance.reloadFloatingCatalogWidget(),
                widgetConfig: CatalogOverlayComponent.WIDGET_CONFIG
            }
        ],
        [
            WidgetType.SpectralLineQuery,
            {
                isCustomIcon: true,
                icon: "spectralLineQuery",
                onClick: () => WidgetsStore.Instance.createFloatingSpectralLineQueryWidget(),
                widgetConfig: SpectralLineQueryComponent.WIDGET_CONFIG
            }
        ],
        [
            WidgetType.CursorInfo,
            {
                isCustomIcon: true,
                icon: "cursor",
                onClick: () => WidgetsStore.Instance.createFloatingCursorInfoWidget(),
                widgetConfig: CursorInfoComponent.WIDGET_CONFIG
            }
        ],
        [
            WidgetType.PvGenerator,
            {
                isCustomIcon: true,
                icon: "pv",
                onClick: () => WidgetsStore.Instance.createFloatingPvGeneratorWidget(),
                widgetConfig: PvGeneratorComponent.WIDGET_CONFIG
            }
        ]
    ]);

    @action public removeFrameFromRegionWidgets(fileId: number = ACTIVE_FILE_ID) {
        this.widgetsMap.forEach(widgets => {
            widgets.forEach(widgetStore => {
                if (widgetStore instanceof RegionWidgetStore) {
                    if (fileId === ACTIVE_FILE_ID) {
                        widgetStore.clearRegionMap();
                        widgetStore.setFileId(ACTIVE_FILE_ID);
                    } else {
                        widgetStore.clearFrameEntry(fileId);
                        if (widgetStore.fileId === fileId) {
                            widgetStore.setFileId(ACTIVE_FILE_ID);
                        }
                    }
                }
            });
        });
    }

    @action public removeRegionFromRegionWidgets = (fileId: number, regionId: number) => {
        this.widgetsMap.forEach(widgets => {
            widgets.forEach(widgetStore => {
                if (widgetStore instanceof RegionWidgetStore) {
                    const selectedRegionId = widgetStore.regionIdMap.get(fileId);
                    // remove entry from map if it matches the deleted region
                    if (isFinite(selectedRegionId) && selectedRegionId === regionId) {
                        widgetStore.clearFrameEntry(fileId);
                    }
                }
            });
        });
    };

    @action public removeRegionsFromRegionWidgetsByFrame = (fileId: number) => {
        this.widgetsMap.forEach(widgets => {
            widgets.forEach(widgetStore => {
                if (widgetStore instanceof RegionWidgetStore) {
                    if (widgetStore.regionIdMap.has(fileId)) {
                        widgetStore.clearFrameEntry(fileId);
                    }
                }
            });
        });
    };

    public static ResetWidgetPlotXYBounds(storeMap: Map<string, SpatialProfileWidgetStore | SpectralProfileWidgetStore | HistogramWidgetStore | StokesAnalysisWidgetStore>, fileId: number = ACTIVE_FILE_ID) {
        if (fileId === ACTIVE_FILE_ID) {
            storeMap.forEach(widgetStore => {
                widgetStore.clearXYBounds();
            });
        } else {
            storeMap.forEach(widgetStore => {
                if (widgetStore.fileId === fileId) {
                    widgetStore.clearXYBounds();
                }
            });
        }
    }

    private constructor() {
        makeObservable(this);
        this.spatialProfileWidgets = new Map<string, SpatialProfileWidgetStore>();
        this.spectralProfileWidgets = new Map<string, SpectralProfileWidgetStore>();
        this.statsWidgets = new Map<string, StatsWidgetStore>();
        this.histogramWidgets = new Map<string, HistogramWidgetStore>();
        this.renderConfigWidgets = new Map<string, RenderConfigWidgetStore>();
        this.animatorWidgets = new Map<string, EmptyWidgetStore>();
        this.layerListWidgets = new Map<string, LayerListWidgetStore>();
        this.logWidgets = new Map<string, EmptyWidgetStore>();
        this.regionListWidgets = new Map<string, EmptyWidgetStore>();
        this.stokesAnalysisWidgets = new Map<string, StokesAnalysisWidgetStore>();
        this.catalogWidgets = new Map<string, CatalogWidgetStore>();
        this.floatingSettingsWidgets = new Map<string, string>();
        this.catalogPlotWidgets = new Map<string, CatalogPlotWidgetStore>();
        this.spectralLineQueryWidgets = new Map<string, SpectralLineQueryWidgetStore>();
        this.cursorInfoWidgets = new Map<string, EmptyWidgetStore>();
        this.pvGeneratorWidgets = new Map<string, PvGeneratorWidgetStore>();

        this.widgetsMap = new Map<string, Map<string, any>>([
            [SpatialProfilerComponent.WIDGET_CONFIG.type, this.spatialProfileWidgets],
            [SpectralProfilerComponent.WIDGET_CONFIG.type, this.spectralProfileWidgets],
            [StatsComponent.WIDGET_CONFIG.type, this.statsWidgets],
            [HistogramComponent.WIDGET_CONFIG.type, this.histogramWidgets],
            [RenderConfigComponent.WIDGET_CONFIG.type, this.renderConfigWidgets],
            [AnimatorComponent.WIDGET_CONFIG.type, this.animatorWidgets],
            [LayerListComponent.WIDGET_CONFIG.type, this.layerListWidgets],
            [LogComponent.WIDGET_CONFIG.type, this.logWidgets],
            [RegionListComponent.WIDGET_CONFIG.type, this.regionListWidgets],
            [StokesAnalysisComponent.WIDGET_CONFIG.type, this.stokesAnalysisWidgets],
            [CatalogOverlayComponent.WIDGET_CONFIG.type, this.catalogWidgets],
            [CatalogPlotComponent.WIDGET_CONFIG.type, this.catalogPlotWidgets],
            [SpectralLineQueryComponent.WIDGET_CONFIG.type, this.spectralLineQueryWidgets],
            [CursorInfoComponent.WIDGET_CONFIG.type, this.cursorInfoWidgets],
            [PvGeneratorComponent.WIDGET_CONFIG.type, this.pvGeneratorWidgets]
        ]);

        this.floatingWidgets = [];
        this.defaultFloatingWidgetOffset = 100;
    }

    private static GetDefaultWidgetConfig(type: string): DefaultWidgetConfig {
        switch (type) {
            case ImageViewComponent.WIDGET_CONFIG.type:
                return ImageViewComponent.WIDGET_CONFIG;
            case RenderConfigComponent.WIDGET_CONFIG.type:
                return RenderConfigComponent.WIDGET_CONFIG;
            case LayerListComponent.WIDGET_CONFIG.type:
                return LayerListComponent.WIDGET_CONFIG;
            case LogComponent.WIDGET_CONFIG.type:
                return LogComponent.WIDGET_CONFIG;
            case AnimatorComponent.WIDGET_CONFIG.type:
                return AnimatorComponent.WIDGET_CONFIG;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                return SpatialProfilerComponent.WIDGET_CONFIG;
            case SpectralProfilerComponent.WIDGET_CONFIG.type:
                return SpectralProfilerComponent.WIDGET_CONFIG;
            case StatsComponent.WIDGET_CONFIG.type:
                return StatsComponent.WIDGET_CONFIG;
            case HistogramComponent.WIDGET_CONFIG.type:
                return HistogramComponent.WIDGET_CONFIG;
            case RegionListComponent.WIDGET_CONFIG.type:
                return RegionListComponent.WIDGET_CONFIG;
            case StokesAnalysisComponent.WIDGET_CONFIG.type:
                return StokesAnalysisComponent.WIDGET_CONFIG;
            case CatalogOverlayComponent.WIDGET_CONFIG.type:
                return CatalogOverlayComponent.WIDGET_CONFIG;
            case CatalogPlotComponent.WIDGET_CONFIG.type:
                return CatalogPlotComponent.WIDGET_CONFIG;
            case SpectralLineQueryComponent.WIDGET_CONFIG.type:
                return SpectralLineQueryComponent.WIDGET_CONFIG;
            case CursorInfoComponent.WIDGET_CONFIG.type:
                return CursorInfoComponent.WIDGET_CONFIG;
            case PvGeneratorComponent.WIDGET_CONFIG.type:
                return PvGeneratorComponent.WIDGET_CONFIG;
            case PvPreviewComponent.WIDGET_CONFIG.type:
                return PvPreviewComponent.WIDGET_CONFIG;
            default:
                return PlaceholderComponent.WIDGET_CONFIG;
        }
    }

    private static GetDefaultWidgetSettingsConfig(type: string): DefaultWidgetConfig {
        switch (type) {
            case ImageViewComponent.WIDGET_CONFIG.type:
                return ImageViewSettingsPanelComponent.WIDGET_CONFIG;
            case StokesAnalysisComponent.WIDGET_CONFIG.type:
                return StokesAnalysisSettingsPanelComponent.WIDGET_CONFIG;
            case SpectralProfilerComponent.WIDGET_CONFIG.type:
                return SpectralProfilerSettingsPanelComponent.WIDGET_CONFIG;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                return SpatialProfilerSettingsPanelComponent.WIDGET_CONFIG;
            case RenderConfigComponent.WIDGET_CONFIG.type:
                return RenderConfigSettingsPanelComponent.WIDGET_CONFIG;
            case HistogramComponent.WIDGET_CONFIG.type:
                return HistogramSettingsPanelComponent.WIDGET_CONFIG;
            case CatalogOverlayComponent.WIDGET_CONFIG.type:
                return CatalogOverlayPlotSettingsPanelComponent.WIDGET_CONFIG;
            case LayerListComponent.WIDGET_CONFIG.type:
                return LayerListSettingsPanelComponent.WIDGET_CONFIG;
            case PvGeneratorComponent.WIDGET_CONFIG.type:
                return PvPreviewComponent.WIDGET_CONFIG;
            default:
                return PlaceholderComponent.WIDGET_CONFIG;
        }
    }

    // create drag source for ToolbarMenuComponent
    private static CreateDragSource(layout: GoldenLayout, widgetConfig: DefaultWidgetConfig, elementId: string) {
        const glConfig: GoldenLayout.ReactComponentConfig = {
            type: "react-component",
            component: widgetConfig.type,
            title: widgetConfig.title,
            id: widgetConfig.id,
            isClosable: widgetConfig.isCloseable,
            props: {appStore: AppStore.Instance, id: widgetConfig.id, docked: true}
        };

        const widgetElement = document.getElementById(elementId);
        if (widgetElement) {
            layout.createDragSource(widgetElement, glConfig);
        }
    }

    private getNextId = (defaultId: string) => {
        const widgets = this.widgetsMap.get(defaultId);
        if (!widgets) {
            return null;
        }

        // Find the next appropriate ID
        let nextIndex = 0;
        while (true) {
            const nextId = `${defaultId}-${nextIndex}`;
            if (!widgets.has(nextId)) {
                return nextId;
            }
            nextIndex++;
        }
    };

    // Find the next appropriate ID in array
    private getNextSettingId = (defaultId: string, parentId: string) => {
        const floatingSettingsWidgets = this.floatingSettingsWidgets;
        if (!floatingSettingsWidgets) {
            return null;
        }
        let settingShowed = false;
        floatingSettingsWidgets.forEach(value => {
            if (value === parentId) {
                settingShowed = true;
            }
        });
        if (settingShowed) {
            return null;
        }
        let nextIndex = 0;
        while (true) {
            const nextId = `${parentId}-${defaultId}-${nextIndex}`;
            if (!floatingSettingsWidgets.has(nextId)) {
                return nextId;
            }
            nextIndex++;
        }
    };

    private getFloatingWidgetOffset = (): number => {
        this.defaultFloatingWidgetOffset += 25;
        this.defaultFloatingWidgetOffset = ((this.defaultFloatingWidgetOffset - 100) % 300) + 100;
        return this.defaultFloatingWidgetOffset;
    };

    public removeWidget = (widgetId: string, widgetType: string) => {
        const widgets = this.widgetsMap.get(widgetType);
        if (widgets) {
            // remove associated floating settings according current widgetId
            this.removeAssociatedFloatingSetting(widgetId);
            widgets.delete(widgetId);
        }
        // remove floating settings according floating settings Id
        const floatingSettings = this.floatingSettingsWidgets.has(widgetId);
        if (floatingSettings) {
            this.floatingSettingsWidgets.delete(widgetId);
        }
    };

    private addWidgetByType = (widgetType: string, widgetSettings: object = null): string => {
        let itemId;
        switch (widgetType) {
            case ImageViewComponent.WIDGET_CONFIG.type:
                itemId = ImageViewComponent.WIDGET_CONFIG.id;
                break;
            case RenderConfigComponent.WIDGET_CONFIG.type:
                itemId = this.addRenderConfigWidget(null, widgetSettings);
                break;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                itemId = this.addSpatialProfileWidget(null, widgetSettings);
                break;
            case SpectralProfilerComponent.WIDGET_CONFIG.type:
                itemId = this.addSpectralProfileWidget(null, widgetSettings);
                break;
            case StatsComponent.WIDGET_CONFIG.type:
                itemId = this.addStatsWidget();
                break;
            case HistogramComponent.WIDGET_CONFIG.type:
                itemId = this.addHistogramWidget(null, widgetSettings);
                break;
            case AnimatorComponent.WIDGET_CONFIG.type:
                itemId = this.addAnimatorWidget();
                break;
            case LayerListComponent.WIDGET_CONFIG.type:
                itemId = this.addLayerListWidget();
                break;
            case LogComponent.WIDGET_CONFIG.type:
                itemId = this.addLogWidget();
                break;
            case RegionListComponent.WIDGET_CONFIG.type:
                itemId = this.addRegionListWidget();
                break;
            case StokesAnalysisComponent.WIDGET_CONFIG.type:
                itemId = this.addStokesWidget(null, widgetSettings);
                break;
            case SpectralLineQueryComponent.WIDGET_CONFIG.type:
                itemId = this.addSpectralLineQueryWidget();
                break;
            case CursorInfoComponent.WIDGET_CONFIG.type:
                itemId = this.addCursorInfoWidget();
                break;
            case PvGeneratorComponent.WIDGET_CONFIG.type:
                itemId = this.addPvGeneratorWidget();
                break;
            case CatalogOverlayComponent.WIDGET_CONFIG.type:
                itemId = this.getNextComponentId(CatalogOverlayComponent.WIDGET_CONFIG);
                CatalogStore.Instance.catalogProfiles.set(itemId, 1);
                if (widgetSettings) {
                    this.addCatalogWidget(widgetSettings["catalogFileId"], null, widgetSettings);
                }
                break;
            case CatalogPlotType.D2Scatter:
                const scatterProps: CatalogPlotWidgetStoreProps = {
                    xColumnName: "None",
                    yColumnName: "None",
                    plotType: CatalogPlotType.D2Scatter
                };
                itemId = this.addCatalogPlotWidget(scatterProps);
                const scatterComponentId = this.getNextComponentId(CatalogPlotComponent.WIDGET_CONFIG);
                CatalogStore.Instance.setCatalogPlots(scatterComponentId, 1, itemId);
                break;
            case CatalogPlotType.Histogram:
                const histogramProps: CatalogPlotWidgetStoreProps = {
                    xColumnName: "None",
                    yColumnName: undefined,
                    plotType: CatalogPlotType.Histogram
                };
                itemId = this.addCatalogPlotWidget(histogramProps);
                const histogramComponentId = this.getNextComponentId(CatalogPlotComponent.WIDGET_CONFIG);
                CatalogStore.Instance.setCatalogPlots(histogramComponentId, 1, itemId);
                break;
            default:
                // Remove it from the floating widget array, while preserving its store
                if (this.floatingWidgets.find(w => w.id === widgetType)) {
                    this.removeFloatingWidget(widgetType, true);
                }
                itemId = null;
                break;
        }
        return itemId;
    };

    public removeFloatingWidgets = () => {
        if (this.floatingWidgets) {
            this.floatingWidgets.forEach(widgetConfig => this.removeFloatingWidget(widgetConfig.id));
        }
    };

    createFloatingWidget = savedConfig => {
        if (savedConfig.id) {
            let savedConfigId = savedConfig.id;
            if (savedConfig.plotType) {
                savedConfigId = savedConfig.plotType;
            }
            const id = this.addWidgetByType(savedConfigId, savedConfig.widgetSettings);
            let config = new WidgetConfig(id, WidgetsStore.GetDefaultWidgetConfig(savedConfig.id));
            config.setDefaultSize(savedConfig.defaultWidth || config.defaultWidth, savedConfig.defaultHeight || config.defaultHeight);
            if (config.componentId) {
                config.componentId = config.id;
            }
            if (savedConfig.defaultX > 0 && savedConfig.defaultY > 0) {
                config.setDefaultPosition(savedConfig.defaultX, savedConfig.defaultY);
            } else {
                const offset = this.getFloatingWidgetOffset();
                config.setDefaultPosition(offset, offset);
            }
            this.floatingWidgets.push(config);
        }
    };

    public initWidgets = (componentConfigs: any[], floating: any[]) => {
        // init docked widgets
        componentConfigs.forEach(componentConfig => {
            if (componentConfig.id && componentConfig.props) {
                let componentConfigId = componentConfig.id;
                if ("plotType" in componentConfig) {
                    componentConfigId = componentConfig.plotType;
                }
                const itemId = this.addWidgetByType(componentConfigId, "widgetSettings" in componentConfig ? componentConfig.widgetSettings : null);
                if (itemId) {
                    componentConfig.id = itemId;
                    componentConfig.props.id = itemId;
                }
            }
        });

        // init floating widgets
        floating.forEach(savedConfig => this.createFloatingWidget(savedConfig));
    };

    public initLayoutWithWidgets = (layout: GoldenLayout) => {
        if (!layout) {
            console.log("Invalid parameters!");
            return;
        }

        layout.registerComponent("placeholder", PlaceholderComponent);
        layout.registerComponent("image-view", ImageViewComponent);
        layout.registerComponent("spatial-profiler", SpatialProfilerComponent);
        layout.registerComponent("spectral-profiler", SpectralProfilerComponent);
        layout.registerComponent("spectral-line-query", SpectralLineQueryComponent);
        layout.registerComponent("stats", StatsComponent);
        layout.registerComponent("histogram", HistogramComponent);
        layout.registerComponent("render-config", RenderConfigComponent);
        layout.registerComponent("region-list", RegionListComponent);
        layout.registerComponent("layer-list", LayerListComponent);
        layout.registerComponent("cursor-info", CursorInfoComponent);
        layout.registerComponent("pv-generator", PvGeneratorComponent);
        layout.registerComponent("pv-preview", PvPreviewComponent);
        layout.registerComponent("log", LogComponent);
        layout.registerComponent("animator", AnimatorComponent);
        layout.registerComponent("stokes", StokesAnalysisComponent);
        layout.registerComponent("catalog-overlay", CatalogOverlayComponent);
        layout.registerComponent("catalog-plot", CatalogPlotComponent);

        const showCogWidgets = ["image-view", "spatial-profiler", "spectral-profiler", "histogram", "render-config", "stokes", "catalog-overlay", "layer-list"];
        const hideHelpButtonWidgets = ["pv-preview"];
        // add drag source buttons for ToolbarMenuComponent
        this.CARTAWidgets.forEach((props, widgetType) => {
            const widgetButtonID = widgetType.replace(/\s+/g, "") + "Button";
            WidgetsStore.CreateDragSource(layout, props.widgetConfig, widgetButtonID);
        });

        layout.on("stackCreated", stack => {
            const unpinButton = this.getControlButton("lm-pin", "detach", "unpin").on("click", () => this.unpinWidget(stack.getActiveContentItem()));
            const helpButton = this.getControlButton("lm-help", "help", "help").on("click", ev => this.onHelpPinedClick(ev, stack.getActiveContentItem()));
            const cogPinedButton = this.getControlButton("lm_settings", "settings", "cog").on("click", ev => WidgetsStore.Instance.onCogPinedClick(stack.getActiveContentItem()));
            const nextPageButton = this.getControlButton("lm-image-panel-next", "next image", "step-forward").on("click", this.onNextPageClick);
            const imagePanelButton = this.getControlButton("lm-image-panel", "switch to multi-panel", "square").on("click", this.onImagePanelButtonClick);
            this.updateImagePanelButton();
            const previousPageButton = this.getControlButton("lm-image-panel-previous", "previous image", "step-backward").on("click", this.onPreviousPageClick);
            stack.header.controlsContainer.prepend([previousPageButton, imagePanelButton, nextPageButton, cogPinedButton, helpButton, unpinButton]);

            stack.on("activeContentItemChanged", (contentItem: any) => {
                if (stack && stack.config && stack.header.controlsContainer && stack.config.content.length) {
                    const component = stack.getActiveContentItem().config.component;
                    const stackHeaderControlButtons = stack.header.controlsContainer[0];

                    // show/hide help button
                    $(stackHeaderControlButtons)
                        ?.find("li.lm-help")
                        ?.attr("style", hideHelpButtonWidgets.includes(component) ? "display:none;" : "");

                    // show/hide cog button
                    $(stackHeaderControlButtons)
                        ?.find("li.lm_settings")
                        ?.attr("style", showCogWidgets.includes(component) ? "" : "display:none;");

                    // show/hide image panel buttons
                    $(stackHeaderControlButtons)
                        ?.find("li.lm-image-panel-next, li.lm-image-panel, li.lm-image-panel-previous")
                        ?.attr("style", component === "image-view" ? "" : "display:none;");

                    // disable unpin button when active tab is image-view
                    $(stackHeaderControlButtons)
                        ?.find("li.lm-pin")
                        ?.attr("style", component === "image-view" ? "display:none;" : "");

                    if (component === "image-view") {
                        this.updateImagePanelPageButtons();
                    }
                }
            });
        });
        layout.on("componentCreated", this.handleItemCreation);
        layout.on("itemDestroyed", this.handleItemRemoval);
        layout.on("stateChanged", this.handleStateUpdates);
    };

    private getControlButton = (className: string, title: string, icon: string) => {
        return $(`<li class="${className}" title="${title}"><span class="bp3-icon-standard bp3-icon-${icon}" style/></li>`);
    };

    public toWidgetSettingsConfig = (widgetType: string, widgetID: string) => {
        if (!widgetType || !widgetID) {
            return null;
        }

        let widgetStore = null;
        switch (widgetType) {
            case RenderConfigComponent.WIDGET_CONFIG.type:
                widgetStore = this.renderConfigWidgets.get(widgetID);
                break;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                widgetStore = this.spatialProfileWidgets.get(widgetID);
                break;
            case SpectralProfilerComponent.WIDGET_CONFIG.type:
                widgetStore = this.spectralProfileWidgets.get(widgetID);
                break;
            case HistogramComponent.WIDGET_CONFIG.type:
                widgetStore = this.histogramWidgets.get(widgetID);
                break;
            case StokesAnalysisComponent.WIDGET_CONFIG.type:
                widgetStore = this.stokesAnalysisWidgets.get(widgetID);
                break;
            case CatalogOverlayComponent.WIDGET_CONFIG.type:
                widgetStore = this.catalogWidgets.get(widgetID);
                break;
            default:
                break;
        }

        return widgetStore?.toConfig?.();
    };

    @action onCogPinedClick = (item: GoldenLayout.ContentItem) => {
        const parentItemConfig = item.config as GoldenLayout.ReactComponentConfig;
        const parentId = parentItemConfig.id as string;
        const parentType = parentItemConfig.component;
        const parentTitle = parentItemConfig.title;

        // apply for image viewer, stokes, spectral profiler, spatial profiler, Render Config, Histogram, Catalog Overlay, Layer List
        const floatingSettingsAppliedWidgets = [
            ImageViewComponent.WIDGET_CONFIG.type,
            StokesAnalysisComponent.WIDGET_CONFIG.type,
            SpectralProfilerComponent.WIDGET_CONFIG.type,
            SpatialProfilerComponent.WIDGET_CONFIG.type,
            RenderConfigComponent.WIDGET_CONFIG.type,
            HistogramComponent.WIDGET_CONFIG.type,
            CatalogOverlayComponent.WIDGET_CONFIG.type,
            LayerListComponent.WIDGET_CONFIG.type
        ];
        if (floatingSettingsAppliedWidgets.indexOf(parentType) === -1) {
            return;
        }
        // Get floating settings config
        const defaultConfig = WidgetsStore.GetDefaultWidgetSettingsConfig(parentType);
        let widgetConfig = new WidgetConfig(this.addFloatingSettingsWidget(null, parentId, defaultConfig.type), defaultConfig);
        widgetConfig.title = parentType === "image-view" ? "Image View Settings" : parentTitle + " Settings";
        widgetConfig.parentId = parentId;
        widgetConfig.parentType = parentType;
        if (widgetConfig.id) {
            this.addFloatingWidget(widgetConfig);
        }
    };

    @action unpinWidget = (item: GoldenLayout.ContentItem) => {
        const itemConfig = item.config as GoldenLayout.ReactComponentConfig;
        const id = itemConfig.id as string;
        const type = itemConfig.component;
        const title = itemConfig.title;

        // Avoid floating ImageViewComponent
        if (type === ImageViewComponent.WIDGET_CONFIG.type) {
            return;
        }

        // Get widget type from config
        let widgetConfig = new WidgetConfig(id, WidgetsStore.GetDefaultWidgetConfig(type));
        widgetConfig.title = title;

        if (type === CatalogOverlayComponent.WIDGET_CONFIG.type) {
            widgetConfig.componentId = id;
        }

        if (type === PvPreviewComponent.WIDGET_CONFIG.type) {
            widgetConfig.parentId = itemConfig.props.id;
            widgetConfig.parentType = PvPreviewComponent.WIDGET_CONFIG.parentType;
        }

        const catalogPlotWidgetStore = this.catalogPlotWidgets.get(id);
        if (catalogPlotWidgetStore) {
            widgetConfig.helpType = catalogPlotWidgetStore.plotType === CatalogPlotType.Histogram ? HelpType.CATALOG_HISTOGRAM_PLOT : HelpType.CATALOG_SCATTER_PLOT;
        }

        // Set default size and position from the existing item
        const container = item["container"] as GoldenLayout.Container;
        if (container && container.width && container.height) {
            // Snap size to grid
            widgetConfig.setDefaultSize(Math.round(container.width / 25.0) * 25, Math.round(container.height / 25.0) * 25);
            const el = container["_element"][0] as HTMLElement;
            // Snap position to grid and adjust for title and container offset
            widgetConfig.setDefaultPosition(Math.round(el.offsetLeft / 25.0) * 25 + 5, Math.round(el.offsetTop / 25.0) * 25 - 25);
        }

        this.addFloatingWidget(widgetConfig);
        const config = item.config as GoldenLayout.ReactComponentConfig;
        config.component = "floated";
        item.remove();
    };

    @action onHelpPinedClick = (ev: JQuery.ClickEvent<HTMLElement>, item: GoldenLayout.ContentItem) => {
        const itemConfig = item.config as GoldenLayout.ReactComponentConfig;
        const type = itemConfig.component;
        // Get widget config from type
        let widgetConfig = WidgetsStore.GetDefaultWidgetConfig(type);
        const container = item["container"] as GoldenLayout.Container;
        let centerX = 0;
        if (container && container.width) {
            centerX = ev.target.getBoundingClientRect().right + 36 - container.width * 0.5; // 36(px) is the length between help button and right border of widget
        }

        if (widgetConfig.helpType && !Array.isArray(widgetConfig.helpType)) {
            HelpStore.Instance.showHelpDrawer(widgetConfig.helpType, centerX);
        } else {
            const id = itemConfig.id as string;
            const catalogPlotWidgetStore = this.catalogPlotWidgets.get(id);
            if (catalogPlotWidgetStore) {
                HelpStore.Instance.showHelpDrawer(catalogPlotWidgetStore.plotType === CatalogPlotType.Histogram ? HelpType.CATALOG_HISTOGRAM_PLOT : HelpType.CATALOG_SCATTER_PLOT, centerX);
            }
        }
    };

    onImagePanelButtonClick = () => {
        this.setImageMultiPanelEnabled(!PreferenceStore.Instance.imageMultiPanelEnabled);
    };

    setImageMultiPanelEnabled = (multiPanelEnabled: boolean) => {
        PreferenceStore.Instance.setPreference(PreferenceKeys.IMAGE_MULTI_PANEL_ENABLED, multiPanelEnabled);
        this.updateImagePanelButton();
    };

    private updateImagePanelButton = () => {
        const imagePanelMode = AppStore.Instance.imagePanelMode;
        const imagePanelButton = $(".lm_goldenlayout")?.find("li.lm-image-panel[style!='display:none;']");
        if (imagePanelButton) {
            imagePanelButton.attr("title", this.getImagePanelButtonTooltip(imagePanelMode));
            imagePanelButton.find(".bp3-icon-standard")?.attr("class", `bp3-icon-standard ${this.getImagePanelButtonIcon(imagePanelMode)}`);
        }
    };

    private getImagePanelButtonTooltip = (imagePanelMode: ImagePanelMode) => {
        return imagePanelMode === ImagePanelMode.None ? "switch to multi-panel" : "switch to single panel";
    };

    private getImagePanelButtonIcon = (imagePanelMode: ImagePanelMode) => {
        return imagePanelMode === ImagePanelMode.None ? "bp3-icon-square" : "bp3-icon-grid-view";
    };

    onNextPageClick = () => {
        const appStore = AppStore.Instance;
        const firstIndexInNextPage = (appStore.currentImagePage + 1) * appStore.imagesPerPage;
        if (appStore.frames?.length > firstIndexInNextPage) {
            appStore.setActiveFrameByIndex(firstIndexInNextPage);
        }
    };

    onPreviousPageClick = () => {
        const appStore = AppStore.Instance;
        if (appStore.currentImagePage > 0) {
            const firstIndexInPreviousPage = (appStore.currentImagePage - 1) * appStore.imagesPerPage;
            appStore.setActiveFrameByIndex(firstIndexInPreviousPage);
        }
    };

    updateImagePanelPageButtons = () => {
        const appStore = AppStore.Instance;
        const nextPageButton = $(".lm_goldenlayout")?.find("li.lm-image-panel-next[style!='display:none;']");
        if (nextPageButton) {
            const firstIndexInNextPage = (appStore.currentImagePage + 1) * appStore.imagesPerPage;
            nextPageButton.attr("style", appStore.frames?.length > firstIndexInNextPage ? "" : "cursor: not-allowed; opacity: 0.2");
            nextPageButton.attr("title", appStore.imagePanelMode === ImagePanelMode.None ? "next image" : "next page");
        }

        const previousPageButton = $(".lm_goldenlayout")?.find("li.lm-image-panel-previous[style!='display:none;']");
        if (previousPageButton) {
            previousPageButton.attr("style", appStore.currentImagePage > 0 ? "" : "cursor: not-allowed; opacity: 0.2");
            previousPageButton.attr("title", appStore.imagePanelMode === ImagePanelMode.None ? "previous image" : "previous page");
        }
    };

    @action handleItemCreation = (item: GoldenLayout.ContentItem) => {
        const config = item.config as GoldenLayout.ReactComponentConfig;
        const id = config.id as string;
        const itemId = this.addWidgetByType(id);

        if (itemId) {
            config.id = itemId;
            config.props.id = itemId;
        }
    };

    @action handleItemRemoval = (item: GoldenLayout.ContentItem) => {
        if (item.config.type === "component") {
            const config = item.config as GoldenLayout.ReactComponentConfig;
            const isCatalogTable = config.component === CatalogOverlayComponent.WIDGET_CONFIG.type;
            const isCatalogPlot = config.component === CatalogPlotComponent.WIDGET_CONFIG.type;
            const isPvPreview = config.component === PvPreviewComponent.WIDGET_CONFIG.type;
            // Clean up removed widget's store (ignoring items that have been floated)
            const id = config.id as string;
            if (config.component !== "floated" && !isCatalogTable && !isCatalogPlot) {
                this.removeWidget(id, config.component);
            }

            // close UI, keep catalog file alive
            if (isCatalogTable) {
                CatalogStore.Instance.catalogProfiles.delete(id);
                this.removeAssociatedFloatingSetting(id);
            }

            // remove all catalog plots associated to current catalog plot widget
            if (isCatalogPlot) {
                CatalogStore.Instance.clearCatalogPlotsByWidgetId(id);
            }

            // remove preview frame for current pv preview widget
            if (isPvPreview) {
                const regexPattern = /pv-generator-(\d+)/;
                const pvGeneratorId = id.match(regexPattern);
                this.pvGeneratorWidgets.get(pvGeneratorId[0])?.removePreviewFrame(parseInt(id.split("-")[2]));
            }
        }
    };

    @action handleStateUpdates = (event: any) => {
        if (event && event.origin && event.origin.isMaximised && event.origin.header) {
            const header = event.origin.header as GoldenLayout.Header;
            if (header.controlsContainer && header.controlsContainer.length) {
                const controlsElement = header.controlsContainer[0];
                if (controlsElement.children && controlsElement.children.length) {
                    const maximiseElement = controlsElement.children[controlsElement.children.length - 1];
                    if (maximiseElement) {
                        maximiseElement.setAttribute("title", "restore");
                    }
                }
            }
        }
    };

    // endregion

    @action updateImageWidgetTitle(layout: GoldenLayout) {
        const appStore = AppStore.Instance;
        let newTitle;
        if (appStore.activeFrame) {
            newTitle = appStore.activeFrame.filename;
        } else {
            newTitle = "No image loaded";
        }

        // Update GL title by searching for image-view components
        if (layout?.root) {
            const imageViewComponents = layout.root.getItemsByFilter((item: any) => item.config.component === ImageViewComponent.WIDGET_CONFIG.type);
            if (imageViewComponents.length) {
                if (imageViewComponents[0].config && imageViewComponents[0].config.title !== newTitle) {
                    imageViewComponents[0].setTitle(newTitle);
                }
            }
        }

        // Update floating window title
        const imageViewWidget = this.floatingWidgets.find(w => w.type === ImageViewComponent.WIDGET_CONFIG.type);
        if (imageViewWidget && imageViewWidget.title !== newTitle) {
            this.setWidgetTitle(imageViewWidget.id, newTitle);
        }
    }

    @action setWidgetTitle(id: string, title: string) {
        const layoutStore = LayoutStore.Instance;
        if (layoutStore.dockedLayout && layoutStore.dockedLayout.root) {
            const matchingComponents = layoutStore.dockedLayout.root.getItemsByFilter(item => item.config.id === id);
            if (matchingComponents.length) {
                matchingComponents[0].setTitle(title);
            }
        }

        const widget = this.floatingWidgets.find(w => w.id === id);
        if (widget) {
            widget.title = title;
        }
    }

    @action setWidgetComponentTitle(componentId: string, title: string) {
        const layoutStore = LayoutStore.Instance;
        if (layoutStore.dockedLayout && layoutStore.dockedLayout.root) {
            const matchingComponents = layoutStore.dockedLayout.root.getItemsById(componentId);
            if (matchingComponents.length) {
                matchingComponents[0].setTitle(title);
            }
        }

        const widgetComponent = this.floatingWidgets.find(w => w.componentId === componentId);
        if (widgetComponent) {
            widgetComponent.title = title;
        }
    }

    @action changeWidgetId(id: string, newId: string) {
        const widget = this.floatingWidgets.find(w => w.id === id);
        if (widget) {
            widget.id = newId;
        }
    }

    // region Spatial Profile Widgets
    createFloatingSpatialProfilerWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addSpatialProfileWidget(), SpatialProfilerComponent.WIDGET_CONFIG));
    };

    @action addSpatialProfileWidget(id: string = null, widgetSettings: object = null) {
        if (!id) {
            id = this.getNextId(SpatialProfilerComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            const widgetStore = new SpatialProfileWidgetStore();
            if (widgetSettings) {
                widgetStore.init(widgetSettings);
            }
            this.spatialProfileWidgets.set(id, widgetStore);
        }
        return id;
    }

    // endregion

    // region Spectral Profile Widgets
    createFloatingSpectralProfilerWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addSpectralProfileWidget(), SpectralProfilerComponent.WIDGET_CONFIG));
    };

    @action addSpectralProfileWidget(id: string = null, widgetSettings: object = null) {
        if (!id) {
            id = this.getNextId(SpectralProfilerComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            const widgetStore = new SpectralProfileWidgetStore();
            if (widgetSettings) {
                widgetStore.init(widgetSettings);
            }
            this.spectralProfileWidgets.set(id, widgetStore);
        }
        return id;
    }

    @computed get spectralProfilerList(): string[] {
        return Array.from(this.spectralProfileWidgets.keys());
    }

    @computed get hasSpectralProfiler(): boolean {
        return this.spectralProfileWidgets && this.spectralProfileWidgets.size > 0;
    }

    // check whether any spectral widget is streaming data
    @computed get isSpectralWidgetStreamingData(): boolean {
        let result = false;
        this.spectralProfileWidgets.forEach(widgetStore => {
            result = result || widgetStore.isStreamingData;
        });
        return result;
    }

    public getSpectralWidgetStoreByID = (id: string): SpectralProfileWidgetStore => {
        return this.spectralProfileWidgets.get(id);
    };

    // endregion

    // region Stokes Profile Widgets
    createFloatingStokesWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addStokesWidget(), StokesAnalysisComponent.WIDGET_CONFIG));
    };

    @action addStokesWidget(id: string = null, widgetSettings: object = null) {
        if (!id) {
            id = this.getNextId(StokesAnalysisComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            const widgetStore = new StokesAnalysisWidgetStore();
            if (widgetSettings) {
                widgetStore.init(widgetSettings);
            }
            this.stokesAnalysisWidgets.set(id, widgetStore);
        }
        return id;
    }

    // endregion

    // region Catalog Overlay Widgets
    private getNextComponentId = (config: DefaultWidgetConfig) => {
        // Find the next appropriate ID
        let nextIndex = 0;
        let componentIds = [];

        if (config.type === CatalogPlotComponent.WIDGET_CONFIG.type) {
            CatalogStore.Instance.catalogPlots.forEach((catalogWidgetMap, componentId) => {
                componentIds.push(componentId);
            });
        } else if (config.type === CatalogOverlayComponent.WIDGET_CONFIG.type) {
            CatalogStore.Instance.catalogProfiles.forEach((value, componentId) => {
                componentIds.push(componentId);
            });
        }

        while (true) {
            const nextId = `${config.componentId}-${nextIndex}`;
            if (!componentIds.includes(nextId)) {
                return nextId;
            }
            nextIndex++;
        }
    };

    createFloatingCatalogWidget = (catalogFileId: number): {widgetStoreId: string; widgetComponentId: string} => {
        const widgetStoreId = this.addCatalogWidget(catalogFileId);
        const widgetComponentId = this.getNextComponentId(CatalogOverlayComponent.WIDGET_CONFIG);
        let config = new WidgetConfig(widgetComponentId, CatalogOverlayComponent.WIDGET_CONFIG);
        config.componentId = widgetComponentId;
        this.addFloatingWidget(config);
        return {widgetStoreId: widgetStoreId, widgetComponentId: widgetComponentId};
    };

    reloadFloatingCatalogWidget = () => {
        const appStore = AppStore.Instance;
        const catalogFileNum = appStore.catalogNum;
        const componentId = this.getNextComponentId(CatalogOverlayComponent.WIDGET_CONFIG);
        let config = new WidgetConfig(componentId, CatalogOverlayComponent.WIDGET_CONFIG);
        config.componentId = componentId;
        if (catalogFileNum) {
            CatalogStore.Instance.catalogProfiles.set(componentId, catalogFileNum);
        }
        this.addFloatingWidget(config);
    };

    // add catalog widget store
    @action addCatalogWidget(catalogFileId: number, id: string = null, widgetSettings: object = null) {
        // return widget id if store already exsit
        const catalogStore = CatalogStore.Instance;
        const catalogWidgetId = catalogStore.catalogWidgets.get(catalogFileId);
        if (catalogWidgetId) {
            return catalogWidgetId;
        }

        // Generate new id if none passed in
        if (!id) {
            id = this.getNextId(CatalogOverlayComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            const catalogWidgetStore = new CatalogWidgetStore(catalogFileId);
            if (widgetSettings) {
                catalogWidgetStore.init(widgetSettings);
            }
            this.catalogWidgets.set(id, catalogWidgetStore);
        }
        catalogStore.catalogWidgets.set(catalogFileId, id);
        return id;
    }

    // endregion

    // region Catalog Plot Widgets
    createFloatingCatalogPlotWidget = (props: CatalogPlotWidgetStoreProps): {widgetStoreId: string; widgetComponentId: string} => {
        const defaultConfig = CatalogPlotComponent.WIDGET_CONFIG;
        const widgetStoreId = this.addCatalogPlotWidget(props);
        const widgetComponentId = this.getNextComponentId(defaultConfig);
        const config = new WidgetConfig(widgetStoreId, defaultConfig);
        config.id = widgetStoreId;
        config.componentId = widgetComponentId;
        config.helpType = props.plotType === CatalogPlotType.Histogram ? HelpType.CATALOG_HISTOGRAM_PLOT : HelpType.CATALOG_SCATTER_PLOT;
        this.addFloatingWidget(config);
        return {widgetStoreId: widgetStoreId, widgetComponentId: widgetComponentId};
    };

    @action addCatalogPlotWidget(props: CatalogPlotWidgetStoreProps, id: string = null) {
        // Generate new id if none passed in
        if (!id) {
            id = this.getNextId(CatalogPlotComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.catalogPlotWidgets.set(id, new CatalogPlotWidgetStore(props));
        }
        return id;
    }

    // endregion

    // region Spectral Line Query Widgets
    createFloatingSpectralLineQueryWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addSpectralLineQueryWidget(), SpectralLineQueryComponent.WIDGET_CONFIG));
    };

    // add spectral line query widget store
    @action addSpectralLineQueryWidget(id: string = null) {
        // Generate new id if none passed in
        if (!id) {
            id = this.getNextId(SpectralLineQueryComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.spectralLineQueryWidgets.set(id, new SpectralLineQueryWidgetStore());
        }
        return id;
    }

    // endregion

    // region Floating Settings
    createFloatingSettingsWidget = (title: string, parentId: string, parentType: string) => {
        const defaultConfig = WidgetsStore.GetDefaultWidgetSettingsConfig(parentType);
        const config = new WidgetConfig(this.addFloatingSettingsWidget(null, parentId, defaultConfig.type), defaultConfig);
        config.title = parentType === PvGeneratorComponent.WIDGET_CONFIG.type ? title : title + " Settings";
        config.parentId = parentId;
        config.parentType = parentType;
        if (config.id) {
            this.addFloatingWidget(config);
        } else {
            const settingWidgetId = parentId + "-floating-settings-0";
            AppStore.Instance.zIndexManager.updateIndexOnSelect(settingWidgetId);
        }
    };

    @action addFloatingSettingsWidget(id: string = null, parentId: string, type: string) {
        // Generate new id if none passed in
        if (!id) {
            id = this.getNextSettingId(type, parentId);
        }
        if (id) {
            this.floatingSettingsWidgets.set(id, parentId);
        }
        return id;
    }

    // endregion

    // region Stats Widgets
    createFloatingStatsWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addStatsWidget(), StatsComponent.WIDGET_CONFIG));
    };

    @action addStatsWidget(id: string = null) {
        // Generate new id if none passed in
        if (!id) {
            id = this.getNextId(StatsComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.statsWidgets.set(id, new StatsWidgetStore());
        }
        return id;
    }

    // endregion

    // region Histogram Widgets
    createFloatingHistogramWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addHistogramWidget(), HistogramComponent.WIDGET_CONFIG));
    };

    @action addHistogramWidget(id: string = null, widgetSettings: object = null) {
        if (!id) {
            id = this.getNextId(HistogramComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            const widgetStore = new HistogramWidgetStore();
            if (widgetSettings) {
                widgetStore.init(widgetSettings);
            }
            this.histogramWidgets.set(id, widgetStore);
        }
        return id;
    }

    // endregion

    // region Render Config Widgets
    createFloatingRenderWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addRenderConfigWidget(), RenderConfigComponent.WIDGET_CONFIG));
    };

    @action addRenderConfigWidget(id: string = null, widgetSettings: object = null) {
        if (!id) {
            id = this.getNextId(RenderConfigComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            const widgetStore = new RenderConfigWidgetStore();
            if (widgetSettings) {
                widgetStore.init(widgetSettings);
            }
            this.renderConfigWidgets.set(id, widgetStore);
        }
        return id;
    }

    // endregion

    // region Basic widget types (log, animator, region list, layer list, cursor info)

    createFloatingLogWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addLogWidget(), LogComponent.WIDGET_CONFIG));
    };

    @action addLogWidget(id: string = null) {
        if (!id) {
            id = this.getNextId(LogComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.logWidgets.set(id, new EmptyWidgetStore());
        }
        return id;
    }

    createFloatingAnimatorWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addAnimatorWidget(), AnimatorComponent.WIDGET_CONFIG));
    };

    @action addAnimatorWidget(id: string = null) {
        if (!id) {
            id = this.getNextId(AnimatorComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.animatorWidgets.set(id, new EmptyWidgetStore());
        }
        return id;
    }

    createFloatingRegionListWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addRegionListWidget(), RegionListComponent.WIDGET_CONFIG));
    };

    @action addRegionListWidget(id: string = null) {
        if (!id) {
            id = this.getNextId(RegionListComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.regionListWidgets.set(id, new EmptyWidgetStore());
        }
        return id;
    }

    createFloatingLayerListWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addLayerListWidget(), LayerListComponent.WIDGET_CONFIG));
    };

    @action addLayerListWidget(id: string = null) {
        if (!id) {
            id = this.getNextId(LayerListComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.layerListWidgets.set(id, new LayerListWidgetStore());
        }
        return id;
    }

    createFloatingCursorInfoWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addCursorInfoWidget(), CursorInfoComponent.WIDGET_CONFIG));
    };

    @action addCursorInfoWidget(id: string = null) {
        if (!id) {
            id = this.getNextId(CursorInfoComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.cursorInfoWidgets.set(id, new EmptyWidgetStore());
        }
        return id;
    }

    createFloatingPvGeneratorWidget = () => {
        this.addFloatingWidget(new WidgetConfig(this.addPvGeneratorWidget(), PvGeneratorComponent.WIDGET_CONFIG));
    };

    @action addPvGeneratorWidget(id: string = null) {
        if (!id) {
            id = this.getNextId(PvGeneratorComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.pvGeneratorWidgets.set(id, new PvGeneratorWidgetStore());
        }
        return id;
    }
    // endregion

    // region Floating Widgets
    @action selectFloatingWidget = (id: string) => {
        const selectedWidgetIndex = this.floatingWidgets.findIndex(w => w.id === id);
        const N = this.floatingWidgets.length;
        // Only rearrange floatingWidgets if the id is found and the widget isn't already selected.
        if (N > 1 && selectedWidgetIndex >= 0 && selectedWidgetIndex < N - 1) {
            const selectedWidget = this.floatingWidgets[selectedWidgetIndex];
            for (let i = 0; i < N - 1; i++) {
                if (i >= selectedWidgetIndex) {
                    this.floatingWidgets[i] = this.floatingWidgets[i + 1];
                }
            }
            this.floatingWidgets[N - 1] = selectedWidget;
        }
    };

    @action addFloatingWidget = (widget: WidgetConfig) => {
        if (!(widget?.defaultX > 0 && widget?.defaultY > 0)) {
            const offset = this.getFloatingWidgetOffset();
            widget.setDefaultPosition(offset, offset);
        }
        this.floatingWidgets.push(widget);

        const zIndexManager = AppStore.Instance.zIndexManager;
        const id = widget.componentId ? widget.componentId : widget.id;
        zIndexManager.assignIndex(id);
    };

    // Removes a widget from the floating widget array, optionally removing the widget's associated store
    @action removeFloatingWidget = (id: string, preserveStore: boolean = false) => {
        const widget = this.floatingWidgets.find(w => w.id === id);
        const zIndexManager = AppStore.Instance.zIndexManager;

        if (widget) {
            zIndexManager.updateIndexOnRemove(id);
            zIndexManager.removeIndex(id);
            this.floatingWidgets = this.floatingWidgets.filter(w => w.id !== id);
            if (preserveStore) {
                return;
            }

            this.removeWidget(id, widget.type);
        }
    };
    // endregion

    // remove a widget component by componentId
    @action removeFloatingWidgetComponent = (componentId: string) => {
        const widget = this.floatingWidgets.find(w => w.componentId === componentId);
        const zIndexManager = AppStore.Instance.zIndexManager;

        if (widget) {
            zIndexManager.updateIndexOnRemove(componentId);
            zIndexManager.removeIndex(componentId);
            this.floatingWidgets = this.floatingWidgets.filter(w => w.componentId !== componentId);
            this.removeAssociatedFloatingSetting(componentId);
        }
    };

    private removeAssociatedFloatingSetting = (widgetId: string) => {
        if (this.floatingSettingsWidgets?.size) {
            let associatedFloatingSettingsId = null;
            this.floatingSettingsWidgets.forEach((value, key) => {
                if (value === widgetId) {
                    associatedFloatingSettingsId = key;
                }
            });

            const layoutStore = LayoutStore.Instance;
            if (layoutStore.dockedLayout && layoutStore.dockedLayout.root) {
                const matchingComponents = layoutStore.dockedLayout.root.getItemsByFilter(item => item.config.id === associatedFloatingSettingsId);
                if (matchingComponents.length) {
                    matchingComponents[0].remove();
                }
            }

            if (associatedFloatingSettingsId) {
                this.removeFloatingWidget(associatedFloatingSettingsId, true);
                this.floatingSettingsWidgets.delete(associatedFloatingSettingsId);
            }
        }
    };
}
