import * as GoldenLayout from "golden-layout";
import * as $ from "jquery";
import {CARTA} from "carta-protobuf";
import {action, observable, computed} from "mobx";
import {
    AnimatorComponent,
    HistogramComponent,
    ImageViewComponent,
    LayerListComponent,
    LogComponent,
    PlaceholderComponent,
    RegionListComponent,
    RenderConfigComponent,
    SpatialProfilerComponent,
    SpectralLineQueryComponent,
    SpectralProfilerComponent,
    StatsComponent,
    ToolbarMenuComponent,
    StokesAnalysisComponent,
    CatalogOverlayComponent,
    CatalogPlotComponent,
    // setting Panel
    StokesAnalysisSettingsPanelComponent,
    SpectralProfilerSettingsPanelComponent,
    SpatialProfilerSettingsPanelComponent,
    RenderConfigSettingsPanelComponent,
    HistogramSettingsPanelComponent,
    ImageViewSettingsPanelComponent
} from "components";
import {AppStore, HelpStore, HelpType, LayoutStore, CatalogStore} from "stores";
import {
    EmptyWidgetStore, 
    HistogramWidgetStore, 
    RegionWidgetStore, 
    RenderConfigWidgetStore, 
    SpatialProfileWidgetStore,
    SpectralLineQueryWidgetStore,
    SpectralProfileWidgetStore,
    StatsWidgetStore, 
    StokesAnalysisWidgetStore, 
    CatalogWidgetStore, CatalogPlotWidgetStore, CatalogPlotWidgetStoreProps,
    ACTIVE_FILE_ID
} from "./widgets";
import {ProcessedColumnData} from "../models";

export class WidgetConfig {
    id: string;
    type: string;
    minWidth: number;
    minHeight: number;
    defaultWidth: number;
    defaultHeight: number;
    defaultX?: number;
    defaultY?: number;
    isCloseable: boolean;
    @observable title: string;
    parentId?: string;
    parentType?: string;
    helpType?: HelpType;
    tabsHelpTypes?: HelpType[];
    componentId?: string;
    zIndex?: number = 0;
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
    @observable layerListWidgets: Map<string, EmptyWidgetStore>;
    @observable logWidgets: Map<string, EmptyWidgetStore>;
    @observable regionListWidgets: Map<string, EmptyWidgetStore>;
    @observable animatorWidgets: Map<string, EmptyWidgetStore>;
    @observable stokesAnalysisWidgets: Map<string, StokesAnalysisWidgetStore>;
    @observable floatingSettingsWidgets: Map<string, string>;
    @observable catalogWidgets: Map<string, CatalogWidgetStore>;
    @observable catalogPlotWidgets: Map<string, CatalogPlotWidgetStore>;
    @observable spectralLineQueryWidgets: Map<string, SpectralLineQueryWidgetStore>;

    private widgetsMap: Map<string, Map<string, any>>;
    private defaultFloatingWidgetOffset: number;

    public static RemoveFrameFromRegionWidgets(storeMap: Map<string, RegionWidgetStore>, fileId: number = ACTIVE_FILE_ID) {
        if (fileId === ACTIVE_FILE_ID) {
            storeMap.forEach(widgetStore => {
                widgetStore.clearRegionMap();
            });
        } else {
            storeMap.forEach(widgetStore => {
                widgetStore.clearFrameEntry(fileId);
                if (widgetStore.fileId === fileId) {
                    widgetStore.setFileId(ACTIVE_FILE_ID);
                }
            });
        }
    }

    public static RemoveRegionFromRegionWidgets = (storeMap: Map<string, RegionWidgetStore>, fileId, regionId: number) => {
        storeMap.forEach(widgetStore => {
            const selectedRegionId = widgetStore.regionIdMap.get(fileId);
            // remove entry from map if it matches the deleted region
            if (isFinite(selectedRegionId) && selectedRegionId === regionId) {
                widgetStore.clearFrameEntry(fileId);
            }
        });
    };

    private constructor() {
        this.spatialProfileWidgets = new Map<string, SpatialProfileWidgetStore>();
        this.spectralProfileWidgets = new Map<string, SpectralProfileWidgetStore>();
        this.statsWidgets = new Map<string, StatsWidgetStore>();
        this.histogramWidgets = new Map<string, HistogramWidgetStore>();
        this.renderConfigWidgets = new Map<string, RenderConfigWidgetStore>();
        this.animatorWidgets = new Map<string, EmptyWidgetStore>();
        this.layerListWidgets  = new Map<string, EmptyWidgetStore>();
        this.logWidgets = new Map<string, EmptyWidgetStore>();
        this.regionListWidgets = new Map<string, EmptyWidgetStore>();
        this.stokesAnalysisWidgets = new Map<string, StokesAnalysisWidgetStore>();
        this.catalogWidgets = new Map<string, CatalogWidgetStore>();
        this.floatingSettingsWidgets = new Map<string, string>();
        this.catalogPlotWidgets = new Map<string, CatalogPlotWidgetStore>();
        this.spectralLineQueryWidgets = new Map<string, SpectralLineQueryWidgetStore>();

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
            [SpectralLineQueryComponent.WIDGET_CONFIG.type, this.spectralLineQueryWidgets]
        ]);

        this.floatingWidgets = [];
        this.defaultFloatingWidgetOffset = 100;
    }

    private static getDefaultWidgetConfig(type: string) {
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
            default:
                return PlaceholderComponent.WIDGET_CONFIG;
        }
    }

    private static getDefaultWidgetSettingsConfig(type: string) {
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
            default:
                return PlaceholderComponent.WIDGET_CONFIG;
        }
    }

    // create drag source for ToolbarMenuComponent
    private static CreateDragSource(layout: GoldenLayout, widgetConfig: WidgetConfig, elementId: string) {
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
        this.defaultFloatingWidgetOffset = (this.defaultFloatingWidgetOffset - 100) % 300 + 100;
        return this.defaultFloatingWidgetOffset;
    };

    public removeWidget = (widgetId: string, widgetType: string) => {
        const widgets = this.widgetsMap.get(widgetType);
        if (widgets) {
            // remove associated floating settings according current widgetId
            if (this.floatingSettingsWidgets) {
                let associatedFloatingSettingsId = null;
                this.floatingSettingsWidgets.forEach((value, key) => {
                    if (value === widgetId) {
                        associatedFloatingSettingsId = key;
                    }
                });
                if (associatedFloatingSettingsId) {
                    this.removeFloatingWidget(associatedFloatingSettingsId, true);
                    this.floatingSettingsWidgets.delete(associatedFloatingSettingsId);
                }
            }
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
            case CatalogOverlayComponent.WIDGET_CONFIG.type:
                itemId = this.getNextComponentId(CatalogOverlayComponent.WIDGET_CONFIG);
                CatalogStore.Instance.catalogProfiles.set(itemId, 1);
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
            this.floatingWidgets.forEach((widgetConfig) => this.removeFloatingWidget(widgetConfig.id));
        }
    };

    public initWidgets = (componentConfigs: any[], floating: any[]) => {
        // init docked widgets
        componentConfigs.forEach((componentConfig) => {
            if (componentConfig.id && componentConfig.props) {
                const itemId =  this.addWidgetByType(componentConfig.id, "widgetSettings" in componentConfig ? componentConfig.widgetSettings : null);

                if (itemId) {
                    componentConfig.id = itemId;
                    componentConfig.props.id = itemId;
                }
            }
        });

        // init floating widgets
        floating.forEach((savedConfig) => {
            if (savedConfig.type) {
                let config = WidgetsStore.getDefaultWidgetConfig(savedConfig.type);
                config.id =  this.addWidgetByType(savedConfig.type, "widgetSettings" in savedConfig ? savedConfig.widgetSettings : null);
                if ("defaultWidth" in savedConfig && savedConfig.defaultWidth > 0) {
                    config.defaultWidth = savedConfig.defaultWidth;
                }
                if ("defaultHeight" in savedConfig && savedConfig.defaultHeight > 0) {
                    config.defaultHeight = savedConfig.defaultHeight;
                }
                if ("defaultX" in savedConfig && savedConfig.defaultX > 0 && "defaultY" in savedConfig && savedConfig.defaultY > 0) {
                    config["defaultX"] = savedConfig.defaultX;
                    config["defaultY"] = savedConfig.defaultY;
                } else {
                    config["defaultX"] = config["defaultY"] = this.getFloatingWidgetOffset();
                }
                this.floatingWidgets.push(config);
            }
        });
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
        layout.registerComponent("log", LogComponent);
        layout.registerComponent("animator", AnimatorComponent);
        layout.registerComponent("stokes", StokesAnalysisComponent);
        layout.registerComponent("catalog-overlay", CatalogOverlayComponent);
        layout.registerComponent("catalog-plot", CatalogPlotComponent);

        const showCogWidgets = ["image-view", "spatial-profiler", "spectral-profiler", "histogram", "render-config", "stokes"];
        // add drag source buttons from ToolbarMenuComponent
        ToolbarMenuComponent.DRAGSOURCE_WIDGETCONFIG_MAP.forEach((widgetConfig, id) => WidgetsStore.CreateDragSource(layout, widgetConfig, id));

        layout.on("stackCreated", (stack) => {
            let unpinButton = $(`<li class="lm-pin" title="detach"><span class="bp3-icon-standard bp3-icon-unpin"/></li>`);
            unpinButton.on("click", () => this.unpinWidget(stack.getActiveContentItem()));
            stack.header.controlsContainer.prepend(unpinButton);
            let helpButton = $(`<li class="lm-help" title="help"><span class="bp3-icon-standard bp3-icon-help"/></li>`);
            helpButton.on("click", (ev) => this.onHelpPinedClick(ev, stack.getActiveContentItem()));
            stack.header.controlsContainer.prepend(helpButton);

            stack.on("activeContentItemChanged", function(contentItem: any) {
                if (stack && stack.config && stack.header.controlsContainer && stack.config.content.length) {
                    const activeTabItem = stack.getActiveContentItem();
                    const component = activeTabItem.config.component;
                    const stackHeaderControlButtons = stack.header.controlsContainer[0];
                    if (component && showCogWidgets.includes(component) && stackHeaderControlButtons && stackHeaderControlButtons.childElementCount < 5) {
                        const cogPinedButton = $(`<li class="lm_settings" title="settings"><span class="bp3-icon-standard bp3-icon-cog"/></li>`);
                        cogPinedButton.on("click", () => WidgetsStore.Instance.onCogPinedClick(stack.getActiveContentItem()));
                        stack.header.controlsContainer.prepend(cogPinedButton);
                    } else if (!showCogWidgets.includes(component) && stackHeaderControlButtons && stackHeaderControlButtons.childElementCount === 5) {
                        stack.header.controlsContainer[0].children[0].remove();
                    }
                }
            });
        });
        layout.on("componentCreated", this.handleItemCreation);
        layout.on("itemDestroyed", this.handleItemRemoval);
        layout.on("stateChanged", this.handleStateUpdates);
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

        // apply for image viewer, stokes, spectral profiler, spatial profiler, Render Config, Histogram
        const floatingSettingsApplyedWidgets = [
            ImageViewComponent.WIDGET_CONFIG.type,
            StokesAnalysisComponent.WIDGET_CONFIG.type,
            SpectralProfilerComponent.WIDGET_CONFIG.type,
            SpatialProfilerComponent.WIDGET_CONFIG.type,
            RenderConfigComponent.WIDGET_CONFIG.type,
            HistogramComponent.WIDGET_CONFIG.type
        ];
        if (floatingSettingsApplyedWidgets.indexOf(parentType) === -1) {
            return;
        }
        // Get floating settings config
        let widgetConfig = WidgetsStore.getDefaultWidgetSettingsConfig(parentType);
        widgetConfig.id = this.addFloatingSettingsWidget(null, parentId, widgetConfig.type);
        widgetConfig.title = (parentType === "image-view") ? "Image View Settings" : parentTitle + " Settings";
        widgetConfig.parentId = parentId;
        widgetConfig.parentType = parentType;
        if (widgetConfig.id) {
            this.addFloatingWidget(widgetConfig);   
        }
    }

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
        let widgetConfig = WidgetsStore.getDefaultWidgetConfig(type);
        widgetConfig.id = id;
        widgetConfig.title = title;

        if (type === CatalogOverlayComponent.WIDGET_CONFIG.type) {
            widgetConfig.componentId = id;
        }

        // Set default size and position from the existing item
        const container = item["container"] as GoldenLayout.Container;
        if (container && container.width && container.height) {
            // Snap size to grid
            widgetConfig.defaultWidth = Math.round(container.width / 25.0) * 25;
            widgetConfig.defaultHeight = Math.round(container.height / 25.0) * 25;
            const el = container["_element"][0] as HTMLElement;
            // Snap position to grid and adjust for title and container offset
            widgetConfig.defaultX = Math.round(el.offsetLeft / 25.0) * 25 + 5;
            widgetConfig.defaultY = Math.round(el.offsetTop / 25.0) * 25 - 25;
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
        let widgetConfig = WidgetsStore.getDefaultWidgetConfig(type);
        if (widgetConfig.helpType) {
            const container = item["container"] as GoldenLayout.Container;
            let centerX = 0;
            if (container && container.width) {
                centerX = ev.target.getBoundingClientRect().right + 36 - container.width * 0.5; // 36(px) is the length between help button and right border of widget
            }
            HelpStore.Instance.showHelpDrawer(widgetConfig.helpType, centerX);
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
            // Clean up removed widget's store (ignoring items that have been floated)
            if (config.component !== "floated" && !isCatalogTable && !isCatalogPlot) {
                const id = config.id as string;
                this.removeWidget(id, config.component);
            }

            // close UI, keep catalog file alive
            if (isCatalogTable) {
                CatalogStore.Instance.catalogProfiles.delete(config.id as string);
            }

            // remove all catalog plots associated to current catalog plot widget
            if (isCatalogPlot) {
                CatalogStore.Instance.clearCatalogPlotsByWidgetId(config.id as string);
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

    @action updateImageWidgetTitle() {
        const appStore = AppStore.Instance;
        let newTitle;
        if (appStore.activeFrame) {
            newTitle = appStore.activeFrame.frameInfo.fileInfo.name;
        } else {
            newTitle = "No image loaded";
        }

        // Update GL title by searching for image-view components
        const layoutStore = appStore.layoutStore;
        if (layoutStore.dockedLayout && layoutStore.dockedLayout.root) {
            const imageViewComponents = layoutStore.dockedLayout.root.getItemsByFilter((item: any) => item.config.component === ImageViewComponent.WIDGET_CONFIG.type);
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
        let config = SpatialProfilerComponent.WIDGET_CONFIG;
        config.id = this.addSpatialProfileWidget();
        this.addFloatingWidget(config);
    };

    @action addSpatialProfileWidget(id: string = null,  widgetSettings: object = null) {
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
        let config = SpectralProfilerComponent.WIDGET_CONFIG;
        config.id = this.addSpectralProfileWidget();
        this.addFloatingWidget(config);
    };

    @action addSpectralProfileWidget(id: string = null,  widgetSettings: object = null) {
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

    public getSpectralWidgetStoreByID = (id: string): SpectralProfileWidgetStore => {
        return this.spectralProfileWidgets.get(id);
    };

    // endregion

    // region Stokes Profile Widgets
    createFloatingStokesWidget = () => {
        let config = StokesAnalysisComponent.WIDGET_CONFIG;
        config.id = this.addStokesWidget();
        this.addFloatingWidget(config);
    };

    @action addStokesWidget(id: string = null,  widgetSettings: object = null) {
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
    private getNextComponentId = (config: WidgetConfig) => {
        // Find the next appropriate ID
        let nextIndex = 0;
        let componentIds = [];
        const floatingCatalogWidgets = this.getFloatingWidgetByComponentId(config.componentId);
        const dockedCatalogWidgets = this.getDockedWidgetByType(config.type);
        
        if (config.type === CatalogPlotComponent.WIDGET_CONFIG.type) {
            CatalogStore.Instance.catalogPlots.forEach((catalogWidgetMap, componentId) => {
                componentIds.push(componentId);
            });
        } else {
            floatingCatalogWidgets.forEach(floatingConfig => {
                componentIds.push(floatingConfig.componentId);
            });
            dockedCatalogWidgets.forEach(contentItem => {
                componentIds.push(contentItem.config.id);
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

    getDockedWidgetByType(type: string): GoldenLayout.ContentItem[] {
        const layoutStore = LayoutStore.Instance;
        let matchingComponents = [];
        if (layoutStore?.dockedLayout?.root) {
            matchingComponents = layoutStore.dockedLayout.root.getItemsByFilter(
                item => {
                    const config = item.config as GoldenLayout.ReactComponentConfig;
                    return config.component === type;
                }
            );
        }
        return matchingComponents;
    }

    getFloatingWidgetByComponentId(componentId: string): WidgetConfig[] {
        let floatingCatalogWidgetComponent = [];
        this.floatingWidgets.forEach(widgetConfig => {
            if (widgetConfig.componentId && widgetConfig.componentId.includes(componentId)) {
                floatingCatalogWidgetComponent.push(widgetConfig);
            }
        });
        return floatingCatalogWidgetComponent;
    }

    catalogComponentSize = (): number => {
        const config = CatalogOverlayComponent.WIDGET_CONFIG;
        const floatingCatalogWidgets = this.getFloatingWidgetByComponentId(config.componentId).length;
        const dockedCatalogWidgets = this.getDockedWidgetByType(config.type).length;
        return (floatingCatalogWidgets + dockedCatalogWidgets);
    };

    createFloatingCatalogWidget = (catalogFileId: number): {widgetStoreId: string, widgetComponentId: string} => {
        let config = CatalogOverlayComponent.WIDGET_CONFIG;
        const widgetStoreId = this.addCatalogWidget(catalogFileId);
        const widgetComponentId = this.getNextComponentId(config);
        config.id = widgetComponentId;
        config.componentId = widgetComponentId;
        this.addFloatingWidget(config);
        return {widgetStoreId: widgetStoreId, widgetComponentId: widgetComponentId};  
    };

    reloadFloatingCatalogWidget = () => {
        const appStore = AppStore.Instance;
        const catalogFileNum = appStore.catalogNum;
        let config = CatalogOverlayComponent.WIDGET_CONFIG;
        const componentId = this.getNextComponentId(config);
        config.componentId = componentId;
        config.id = componentId; 
        if (catalogFileNum) {
            CatalogStore.Instance.catalogProfiles.set(componentId, catalogFileNum);   
        }
        this.addFloatingWidget(config);
    };

    // add catalog overlay widget store
    @action addCatalogWidget(catalogFileId: number, id: string = null) {
        // Generate new id if none passed in
        if (!id) {
            id = this.getNextId(CatalogOverlayComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.catalogWidgets.set(id, new CatalogWidgetStore(catalogFileId));
        }
        return id;
    }
    // endregion 

    // region Catalog Plot Widgets
    createFloatingCatalogPlotWidget = (props: CatalogPlotWidgetStoreProps): {widgetStoreId: string, widgetComponentId: string} => {
        let config = CatalogPlotComponent.WIDGET_CONFIG;
        const widgetStoreId = this.addCatalogPlotWidget(props);
        const widgetComponentId = this.getNextComponentId(config);
        config.id = widgetStoreId;
        config.componentId = widgetComponentId;
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
    createFloatingSpectralLineQueryWidget = (): string => {
        let config = SpectralLineQueryComponent.WIDGET_CONFIG;
        const widgetId = this.addSpectralLineQueryWidget();
        config.id = widgetId;
        config.componentId = this.getNextComponentId(config);
        this.addFloatingWidget(config);
        return widgetId;
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
        let config = WidgetsStore.getDefaultWidgetSettingsConfig(parentType);
        config.id = this.addFloatingSettingsWidget(null, parentId, config.type);
        config.title =  title + " Settings";
        config.parentId = parentId;
        config.parentType = parentType;
        if (config.id) {
            this.addFloatingWidget(config);   
        }
    }

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
        let config = StatsComponent.WIDGET_CONFIG;
        config.id = this.addStatsWidget();
        this.addFloatingWidget(config);
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
        let config = HistogramComponent.WIDGET_CONFIG;
        config.id = this.addHistogramWidget();
        this.addFloatingWidget(config);
    };

    @action addHistogramWidget(id: string = null,  widgetSettings: object = null) {
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
        let config = RenderConfigComponent.WIDGET_CONFIG;
        config.id = this.addRenderConfigWidget();
        this.addFloatingWidget(config);
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

    // region Basic widget types (log, animator, region list, layer list)

    createFloatingLogWidget = () => {
        const config = LogComponent.WIDGET_CONFIG;
        config.id = this.addLogWidget();
        this.addFloatingWidget(config);
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
        const config = AnimatorComponent.WIDGET_CONFIG;
        config.id = this.addAnimatorWidget();
        this.addFloatingWidget(config);
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
        const config = RegionListComponent.WIDGET_CONFIG;
        config.id = this.addRegionListWidget();
        this.addFloatingWidget(config);
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
        const config = LayerListComponent.WIDGET_CONFIG;
        config.id = this.addLayerListWidget();
        this.addFloatingWidget(config);
    };

    @action addLayerListWidget(id: string = null) {
        if (!id) {
            id = this.getNextId(LayerListComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.layerListWidgets.set(id, new EmptyWidgetStore());
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

    @action updateSelectFloatingWidgetzIndex = (id: string) => {
        const selectedWidgetIndex = this.floatingWidgets.findIndex(w => w.id === id);
        const selectedWidget = this.floatingWidgets[selectedWidgetIndex];
        const N = this.floatingWidgets.length;
        if (N > 1 && selectedWidgetIndex >= 0 && selectedWidget.zIndex < N) {
            for (let i = 0; i < N; i++) {
                let currentWidgetzIndex = this.floatingWidgets[i].zIndex;
                if (currentWidgetzIndex >= selectedWidget.zIndex) {
                    this.floatingWidgets[i].zIndex = currentWidgetzIndex - 1;
                }
            }
            this.floatingWidgets[selectedWidgetIndex].zIndex = this.floatingWidgets.length;
        }

    };

    // update widget zIndex when remove a widget
    private updateFloatingWidgetzIndexOnRemove(widgetzIndex: number) {
        const N = this.floatingWidgets.length;
        if (widgetzIndex < N) {
            for (let index = 0; index < N; index++) {
                const zIndex = this.floatingWidgets[index].zIndex;
                if (zIndex > widgetzIndex) {
                    this.floatingWidgets[index].zIndex = zIndex - 1;
                }
            }
        }
    }

    @action addFloatingWidget = (widget: WidgetConfig) => {
        widget["defaultX"] = widget["defaultY"] = this.getFloatingWidgetOffset();
        widget.zIndex = this.floatingWidgets.length + 1;
        this.floatingWidgets.push(widget);
    };

    // Removes a widget from the floating widget array, optionally removing the widget's associated store
    @action removeFloatingWidget = (id: string, preserveStore: boolean = false) => {
        const widget = this.floatingWidgets.find(w => w.id === id);
        if (widget) {
            this.updateFloatingWidgetzIndexOnRemove(widget.zIndex);
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
        if (widget) {
            this.updateFloatingWidgetzIndexOnRemove(widget.zIndex);
            this.floatingWidgets = this.floatingWidgets.filter(w => w.componentId !== componentId);
        }
    }
}