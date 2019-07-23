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
    ToolbarMenuComponent
} from "components";
import {AppStore} from "./AppStore";
import {EmptyWidgetStore, HistogramWidgetStore, RegionWidgetStore, RenderConfigWidgetStore, SpatialProfileWidgetStore, SpectralProfileWidgetStore, StatsWidgetStore} from "./widgets";

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
}

export class WidgetProps {
    appStore: AppStore;
    id: string;
    docked: boolean;
}

export class WidgetsStore {
    // Docked (Golden Layout)
    @observable dockedLayout: GoldenLayout;
    // Floating widgets
    @observable floatingWidgets: WidgetConfig[];
    @observable defaultFloatingWidgetOffset: number;
    // Widget Stores
    @observable renderConfigWidgets: Map<string, RenderConfigWidgetStore>;
    @observable spatialProfileWidgets: Map<string, SpatialProfileWidgetStore>;
    @observable spectralProfileWidgets: Map<string, SpectralProfileWidgetStore>;
    @observable statsWidgets: Map<string, StatsWidgetStore>;
    @observable histogramWidgets: Map<string, HistogramWidgetStore>;
    @observable logWidgets: Map<string, EmptyWidgetStore>;
    @observable regionListWidgets: Map<string, EmptyWidgetStore>;
    @observable animatorWidgets: Map<string, EmptyWidgetStore>;

    private appStore: AppStore;
    private widgetsMap: Map<string, Map<string, any>>;

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

    constructor(appStore: AppStore) {
        this.appStore = appStore;
        this.spatialProfileWidgets = new Map<string, SpatialProfileWidgetStore>();
        this.spectralProfileWidgets = new Map<string, SpectralProfileWidgetStore>();
        this.statsWidgets = new Map<string, StatsWidgetStore>();
        this.histogramWidgets = new Map<string, HistogramWidgetStore>();
        this.renderConfigWidgets = new Map<string, RenderConfigWidgetStore>();
        this.animatorWidgets = new Map<string, EmptyWidgetStore>();
        this.logWidgets = new Map<string, EmptyWidgetStore>();
        this.regionListWidgets = new Map<string, EmptyWidgetStore>();

        this.widgetsMap = new Map<string, Map<string, any>>([
            [SpatialProfilerComponent.WIDGET_CONFIG.type, this.spatialProfileWidgets],
            [SpectralProfilerComponent.WIDGET_CONFIG.type, this.spectralProfileWidgets],
            [StatsComponent.WIDGET_CONFIG.type, this.statsWidgets],
            [HistogramComponent.WIDGET_CONFIG.type, this.histogramWidgets],
            [RenderConfigComponent.WIDGET_CONFIG.type, this.renderConfigWidgets],
            [AnimatorComponent.WIDGET_CONFIG.type, this.animatorWidgets],
            [LogComponent.WIDGET_CONFIG.type, this.logWidgets],
            [RegionListComponent.WIDGET_CONFIG.type, this.regionListWidgets],
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
            default:
                return PlaceholderComponent.WIDGET_CONFIG;
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

    removeWidget = (widgetId: string, widgetType: string) => {
        const widgets = this.widgetsMap.get(widgetType);
        if (widgets) {
            widgets.delete(widgetId);
        }
    };

    // create drag source for ToolbarMenuComponent
    private createDragSource = (layout: GoldenLayout, widgetConfig: WidgetConfig, elementId: string) => {
        const glConfig: GoldenLayout.ReactComponentConfig = {
            type: "react-component",
            component: widgetConfig.type,
            title: widgetConfig.title,
            id: widgetConfig.id,
            isClosable: widgetConfig.isCloseable,
            props: {appStore: this.appStore, id: widgetConfig.id, docked: true}
        };

        const widgetElement = document.getElementById(elementId);
        if (widgetElement) {
            layout.createDragSource(widgetElement, glConfig);
        }
    };

    @action setDockedLayout(layout: GoldenLayout) {
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

        // add drag source buttons from ToolbarMenuComponent
        ToolbarMenuComponent.getDragsourceMap().forEach((widgetConfig, id) => this.createDragSource(layout, widgetConfig, id));

        layout.on("stackCreated", (stack) => {
            let unpinButton = $(`<li class="pin-icon"><span class="bp3-icon-standard bp3-icon-unpin"/></li>`);
            unpinButton.on("click", () => this.unpinWidget(stack.getActiveContentItem()));
            stack.header.controlsContainer.prepend(unpinButton);
        });

        layout.on("componentCreated", this.handleItemCreation);
        layout.on("itemDestroyed", this.handleItemRemoval);

        layout.on("stateChanged", this.handleStateUpdates);
        layout.init();
        this.dockedLayout = layout;
    }

    @action unpinWidget = (item: GoldenLayout.ContentItem) => {
        const itemConfig = item.config as GoldenLayout.ReactComponentConfig;
        const id = itemConfig.id as string;
        const type = itemConfig.component;
        const title = itemConfig.title;
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

        let itemId;
        // Check if it's an uninitialised widget
        switch (id) {
            case RenderConfigComponent.WIDGET_CONFIG.type:
                itemId = this.addRenderConfigWidget();
                break;
            case SpatialProfilerComponent.WIDGET_CONFIG.type:
                itemId = this.addSpatialProfileWidget();
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
            default:
                // Remove it from the floating widget array, while preserving its store
                if (this.floatingWidgets.find(w => w.id === id)) {
                    this.removeFloatingWidget(id, true);
                }
        }

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
                console.log(`itemDestroyed: ${id}`);
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
        if (this.dockedLayout && this.dockedLayout.root) {
            const imageViewComponents = this.dockedLayout.root.getItemsByFilter((item: any) => item.config.component === ImageViewComponent.WIDGET_CONFIG.type);
            if (imageViewComponents.length) {
                imageViewComponents[0].setTitle(newTitle);
            }
        }

        // Update floating window title
        const imageViewWidget = this.floatingWidgets.find(w => w.type === ImageViewComponent.WIDGET_CONFIG.type);
        if (imageViewWidget) {
            this.setWidgetTitle(imageViewWidget.id, newTitle);
        }
    }

    @action setWidgetTitle(id: string, title: string) {
        const matchingComponents = this.dockedLayout.root.getItemsByFilter(item => item.config.id === id);
        if (matchingComponents.length) {
            matchingComponents[0].setTitle(title);
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
        this.floatingWidgets.push(widget);
        this.defaultFloatingWidgetOffset += 25;
        this.defaultFloatingWidgetOffset = (this.defaultFloatingWidgetOffset - 100) % 300 + 100;
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