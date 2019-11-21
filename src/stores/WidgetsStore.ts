import * as GoldenLayout from "golden-layout";
import * as $ from "jquery";
import {action, observable} from "mobx";
import {
    AnimatorComponent,
    HistogramComponent,
    ImageViewComponent,
    LogComponent,
    PlaceholderComponent,
    RegionListComponent,
    RenderConfigComponent,
    SpatialProfilerComponent,
    SpectralProfilerComponent,
    StatsComponent,
    ToolbarMenuComponent,
    StokesAnalysisComponent,
    StokesAnalysisSettingsPanelComponent,
    SpectralProfilerSettingsPanelComponent,
    SpatialProfilerSettingsPanelComponent,
    RenderConfigSettingsPanelComponent
} from "components";
import {AppStore, LayoutStore} from "stores";
import {EmptyWidgetStore, HistogramWidgetStore, RegionWidgetStore, RenderConfigWidgetStore, SpatialProfileWidgetStore, SpectralProfileWidgetStore, StatsWidgetStore, StokesAnalysisWidgetStore} from "./widgets";

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
}

export class WidgetProps {
    appStore: AppStore;
    id: string;
    docked: boolean;
    floatingSettingsId?: string;
}

export class WidgetsStore {
    // Floating widgets
    @observable floatingWidgets: WidgetConfig[];
    // Widget Stores
    @observable renderConfigWidgets: Map<string, RenderConfigWidgetStore>;
    @observable spatialProfileWidgets: Map<string, SpatialProfileWidgetStore>;
    @observable spectralProfileWidgets: Map<string, SpectralProfileWidgetStore>;
    @observable statsWidgets: Map<string, StatsWidgetStore>;
    @observable histogramWidgets: Map<string, HistogramWidgetStore>;
    @observable logWidgets: Map<string, EmptyWidgetStore>;
    @observable regionListWidgets: Map<string, EmptyWidgetStore>;
    @observable animatorWidgets: Map<string, EmptyWidgetStore>;
    @observable stokesAnalysisWidgets: Map<string, StokesAnalysisWidgetStore>;
    @observable floatingSettingsWidgets: Map<string, string>;

    private appStore: AppStore;
    private layoutStore: LayoutStore;
    private widgetsMap: Map<string, Map<string, any>>;
    private defaultFloatingWidgetOffset: number;

    public static RemoveFrameFromRegionWidgets(storeMap: Map<string, RegionWidgetStore>, fileId: number = -1) {
        if (fileId === -1) {
            storeMap.forEach(widgetStore => {
                widgetStore.clearRegionMap();
            });
        } else {
            storeMap.forEach(widgetStore => {
                widgetStore.clearFrameEntry(fileId);
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

    constructor(appStore: AppStore, layoutStore: LayoutStore) {
        this.appStore = appStore;
        this.layoutStore = layoutStore;
        this.spatialProfileWidgets = new Map<string, SpatialProfileWidgetStore>();
        this.spectralProfileWidgets = new Map<string, SpectralProfileWidgetStore>();
        this.statsWidgets = new Map<string, StatsWidgetStore>();
        this.histogramWidgets = new Map<string, HistogramWidgetStore>();
        this.renderConfigWidgets = new Map<string, RenderConfigWidgetStore>();
        this.animatorWidgets = new Map<string, EmptyWidgetStore>();
        this.logWidgets = new Map<string, EmptyWidgetStore>();
        this.regionListWidgets = new Map<string, EmptyWidgetStore>();
        this.stokesAnalysisWidgets = new Map<string, StokesAnalysisWidgetStore>();
        this.floatingSettingsWidgets = new Map<string, string>();

        this.widgetsMap = new Map<string, Map<string, any>>([
            [SpatialProfilerComponent.WIDGET_CONFIG.type, this.spatialProfileWidgets],
            [SpectralProfilerComponent.WIDGET_CONFIG.type, this.spectralProfileWidgets],
            [StatsComponent.WIDGET_CONFIG.type, this.statsWidgets],
            [HistogramComponent.WIDGET_CONFIG.type, this.histogramWidgets],
            [RenderConfigComponent.WIDGET_CONFIG.type, this.renderConfigWidgets],
            [AnimatorComponent.WIDGET_CONFIG.type, this.animatorWidgets],
            [LogComponent.WIDGET_CONFIG.type, this.logWidgets],
            [RegionListComponent.WIDGET_CONFIG.type, this.regionListWidgets],
            [StokesAnalysisComponent.WIDGET_CONFIG.type, this.stokesAnalysisWidgets]
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
            default:
                return PlaceholderComponent.WIDGET_CONFIG;
        }
    }

    private static getDefaultWidgetSettingsConfig(type: string) {
        switch (type) {
            case StokesAnalysisComponent.WIDGET_CONFIG.type:
                return StokesAnalysisSettingsPanelComponent.WIDGET_CONFIG;
            case SpectralProfilerComponent.WIDGET_CONFIG.type:
                return SpectralProfilerSettingsPanelComponent.WIDGET_CONFIG;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                return SpatialProfilerSettingsPanelComponent.WIDGET_CONFIG;
            case RenderConfigComponent.WIDGET_CONFIG.type:
                return RenderConfigSettingsPanelComponent.WIDGET_CONFIG;
            default:
                return PlaceholderComponent.WIDGET_CONFIG;
        }
    }

    // create drag source for ToolbarMenuComponent
    private static CreateDragSource(appStore: AppStore, layout: GoldenLayout, widgetConfig: WidgetConfig, elementId: string) {
        const glConfig: GoldenLayout.ReactComponentConfig = {
            type: "react-component",
            component: widgetConfig.type,
            title: widgetConfig.title,
            id: widgetConfig.id,
            isClosable: widgetConfig.isCloseable,
            props: {appStore: appStore, id: widgetConfig.id, docked: true}
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

    private addWidgetByType = (widgetType: string, coord: string = null): string => {
        let itemId;
        switch (widgetType) {
            case ImageViewComponent.WIDGET_CONFIG.type:
                itemId = ImageViewComponent.WIDGET_CONFIG.id;
                break;
            case RenderConfigComponent.WIDGET_CONFIG.type:
                itemId = this.addRenderConfigWidget();
                break;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                itemId = this.addSpatialProfileWidget(null, coord && coord === "y" ? "y" : "x", -1, 0);
                break;
            case SpectralProfilerComponent.WIDGET_CONFIG.type:
                itemId = this.addSpectralProfileWidget();
                break;
            case StatsComponent.WIDGET_CONFIG.type:
                itemId = this.addStatsWidget();
                break;
            case HistogramComponent.WIDGET_CONFIG.type:
                itemId = this.addHistogramWidget();
                break;
            case AnimatorComponent.WIDGET_CONFIG.type:
                itemId = this.addAnimatorWidget();
                break;
            case LogComponent.WIDGET_CONFIG.type:
                itemId = this.addLogWidget();
                break;
            case RegionListComponent.WIDGET_CONFIG.type:
                itemId = this.addRegionListWidget();
                break;
            case StokesAnalysisComponent.WIDGET_CONFIG.type:
                itemId = this.addStokesWidget();
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
                let itemId;
                if (componentConfig.id === SpatialProfilerComponent.WIDGET_CONFIG.type && componentConfig.coord) {
                    itemId = this.addWidgetByType(componentConfig.id, componentConfig.coord);
                } else {
                    itemId = this.addWidgetByType(componentConfig.id);
                }

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
                if (savedConfig.type === SpatialProfilerComponent.WIDGET_CONFIG.type && savedConfig.coord) {
                    config.id = this.addWidgetByType(savedConfig.type, savedConfig.coord);
                } else {
                    config.id = this.addWidgetByType(savedConfig.type);
                }

                if (savedConfig.defaultWidth && savedConfig.defaultWidth > 0) {
                    config.defaultWidth = savedConfig.defaultWidth;
                }
                if (savedConfig.defaultHeight && savedConfig.defaultHeight > 0) {
                    config.defaultHeight = savedConfig.defaultHeight;
                }

                if (savedConfig.defaultX && savedConfig.defaultX > 0 && savedConfig.defaultY && savedConfig.defaultY > 0) {
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
        layout.registerComponent("stats", StatsComponent);
        layout.registerComponent("histogram", HistogramComponent);
        layout.registerComponent("render-config", RenderConfigComponent);
        layout.registerComponent("region-list", RegionListComponent);
        layout.registerComponent("log", LogComponent);
        layout.registerComponent("animator", AnimatorComponent);
        layout.registerComponent("stokes", StokesAnalysisComponent);

        const showCogWidget = ["image-view", "region-list", "animator", "log", "placeholder", "stats"];
        // add drag source buttons from ToolbarMenuComponent
        ToolbarMenuComponent.DRAGSOURCE_WIDGETCONFIG_MAP.forEach((widgetConfig, id) => WidgetsStore.CreateDragSource(this.appStore, layout, widgetConfig, id));

        layout.on("stackCreated", (stack) => {
            let unpinButton = $(`<li class="pin-icon"><span class="bp3-icon-standard bp3-icon-unpin"/></li>`);
            unpinButton.on("click", () => this.unpinWidget(stack.getActiveContentItem()));
            stack.header.controlsContainer.prepend(unpinButton);

            stack.on("activeContentItemChanged", function(contentItem: any) {
                if (stack && stack.config && stack.config.content && stack.config.content.length) {
                    let tabArray = [];
                    for (let index = 0; index < stack.config.content.length; index++) {
                        const component = stack.config.content[index];
                        let found = showCogWidget.indexOf(component.component);
                        tabArray.push(found);
                        if (component && found === -1 && stack.header.controlsContainer && stack.header.controlsContainer[0].childElementCount < 4) {
                            let cogPinedButton = $(`<li class="cog-pined-icon"><span class="bp3-icon-standard bp3-icon-cog"/></li>`);
                            cogPinedButton.on("click", () => contentItem.config.props.appStore.widgetsStore.onCogPinedClick(stack.getActiveContentItem()));
                            stack.header.controlsContainer.prepend(cogPinedButton);
                        } 
                    }
                    let showCog = false;
                    tabArray.forEach(element => {
                        if (element === -1) {
                            showCog = true;
                        }
                    });
                    // remove cog
                    if (!showCog && stack.header.controlsContainer[0].childElementCount === 4) {
                        stack.header.controlsContainer[0].children[0].remove();
                    }
                }
            });
        });
        layout.on("componentCreated", this.handleItemCreation);
        layout.on("itemDestroyed", this.handleItemRemoval);
        layout.on("stateChanged", this.handleStateUpdates);
    };

    @action onCogPinedClick = (item: GoldenLayout.ContentItem) => {
        const parentItemConfig = item.config as GoldenLayout.ReactComponentConfig;
        const parentId = parentItemConfig.id as string;
        const parentType = parentItemConfig.component;
        const parentTitle = parentItemConfig.title;

        // apply for stokes, spectral profiler, spatial profiler, Render Config
        const floatingSettingsApplyedWidgets = [
            StokesAnalysisComponent.WIDGET_CONFIG.type,
            SpectralProfilerComponent.WIDGET_CONFIG.type,
            SpatialProfilerComponent.WIDGET_CONFIG.type,
            RenderConfigComponent.WIDGET_CONFIG.type
        ];
        if (floatingSettingsApplyedWidgets.indexOf(parentType) === -1) {
            return;
        }
        // Get floating settings config
        let widgetConfig = WidgetsStore.getDefaultWidgetSettingsConfig(parentType);
        widgetConfig.id = this.addFloatingSettingsWidget(null, parentId, widgetConfig.type);
        widgetConfig.title = parentTitle + " Settings";
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

            // Clean up removed widget's store (ignoring items that have been floated)
            if (config.component !== "floated") {
                const id = config.id as string;
                this.removeWidget(id, config.component);
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
        let newTitle;
        if (this.appStore.activeFrame) {
            newTitle = this.appStore.activeFrame.frameInfo.fileInfo.name;
        } else {
            newTitle = "No image loaded";
        }

        // Update GL title by searching for image-view components
        if (this.layoutStore.dockedLayout && this.layoutStore.dockedLayout.root) {
            const imageViewComponents = this.layoutStore.dockedLayout.root.getItemsByFilter((item: any) => item.config.component === ImageViewComponent.WIDGET_CONFIG.type);
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
        if (this.layoutStore.dockedLayout && this.layoutStore.dockedLayout.root) {
            const matchingComponents = this.layoutStore.dockedLayout.root.getItemsByFilter(item => item.config.id === id);
            if (matchingComponents.length) {
                matchingComponents[0].setTitle(title);
            }
        }

        const widget = this.floatingWidgets.find(w => w.id === id);
        if (widget) {
            widget.title = title;
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

    @action addSpatialProfileWidget(id: string = null, coordinate: string = "x", fileId: number = -1, regionId: number = 0) {
        // Generate new id if none passed in
        if (!id) {
            id = this.getNextId(SpatialProfilerComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.spatialProfileWidgets.set(id, new SpatialProfileWidgetStore(coordinate, fileId, regionId));
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

    @action addSpectralProfileWidget(id: string = null, coordinate: string = "z") {
        // Generate new id if none passed in
        if (!id) {
            id = this.getNextId(SpectralProfilerComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.spectralProfileWidgets.set(id, new SpectralProfileWidgetStore(coordinate));
        }
        return id;
    }

    // endregion

    // region Stokes Profile Widgets
    createFloatingStokesWidget = () => {
        let config = StokesAnalysisComponent.WIDGET_CONFIG;
        config.id = this.addStokesWidget();
        this.addFloatingWidget(config);
    };

    @action addStokesWidget(id: string = null) {
        // Generate new id if none passed in
        if (!id) {
            id = this.getNextId(StokesAnalysisComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.stokesAnalysisWidgets.set(id, new StokesAnalysisWidgetStore());
        }
        return id;
    }

    // endregion

    // region Floating Settings
    createFloatingSettingsWidget = (title: string, parentId: string, parentType: string) => {
        let config = WidgetsStore.getDefaultWidgetSettingsConfig(parentType);
        config.id = this.addFloatingSettingsWidget(null, parentId, config.type);
        config.title = title + " Settings";
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

    @action addHistogramWidget(id: string = null) {
        // Generate new id if none passed in
        if (!id) {
            id = this.getNextId(HistogramComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.histogramWidgets.set(id, new HistogramWidgetStore());
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

    @action addRenderConfigWidget(id: string = null) {
        if (!id) {
            id = this.getNextId(RenderConfigComponent.WIDGET_CONFIG.type);
        }

        if (id) {
            this.renderConfigWidgets.set(id, new RenderConfigWidgetStore());
        }
        return id;
    }

    // endregion

    // region Basic widget types (log, animator, region list)

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
        widget["defaultX"] = widget["defaultY"] = this.getFloatingWidgetOffset();
        this.floatingWidgets.push(widget);
    };

    // Removes a widget from the floating widget array, optionally removing the widget's associated store
    @action removeFloatingWidget = (id: string, preserveStore: boolean = false) => {
        const widget = this.floatingWidgets.find(w => w.id === id);
        if (widget) {
            this.floatingWidgets = this.floatingWidgets.filter(w => w.id !== id);
            if (preserveStore) {
                return;
            }

            this.removeWidget(id, widget.type);
        }
    };
    // endregion
}