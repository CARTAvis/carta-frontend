import * as GoldenLayout from "golden-layout";
import * as $ from "jquery";
import {action, observable} from "mobx";
import {AnimatorComponent, ImageViewComponent, LogComponent, PlaceholderComponent, RenderConfigComponent, SpatialProfilerComponent, SpectralProfilerComponent} from "components";
import {AppStore} from "./AppStore";
import {RenderConfigWidgetStore, SpatialProfileWidgetStore, SpectralProfileWidgetStore} from "./widgets";

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
    // Golden Layout
    @observable dockedLayout: GoldenLayout;
    @observable floatingWidgets: WidgetConfig[];
    // Widget Stores
    @observable renderConfigWidgets: Map<string, RenderConfigWidgetStore>;
    @observable spatialProfileWidgets: Map<string, SpatialProfileWidgetStore>;
    @observable spectralProfileWidgets: Map<string, SpectralProfileWidgetStore>;
    @observable defaultFloatingWidgetOffset: number;
    private appStore: AppStore;

    constructor(appStore: AppStore) {
        this.appStore = appStore;
        this.spatialProfileWidgets = new Map<string, SpatialProfileWidgetStore>();
        this.spectralProfileWidgets = new Map<string, SpectralProfileWidgetStore>();
        this.renderConfigWidgets = new Map<string, RenderConfigWidgetStore>();
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
            default:
                return PlaceholderComponent.WIDGET_CONFIG;
        }
    }

    // region Golden Layout Widgets

    @action setDockedLayout(layout: GoldenLayout) {
        layout.registerComponent("placeholder", PlaceholderComponent);
        layout.registerComponent("image-view", ImageViewComponent);
        layout.registerComponent("spatial-profiler", SpatialProfilerComponent);
        layout.registerComponent("spectral-profiler", SpectralProfilerComponent);
        layout.registerComponent("render-config", RenderConfigComponent);
        layout.registerComponent("log", LogComponent);
        layout.registerComponent("animator", AnimatorComponent);

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

        // Check if it's an uninitialised widget
        if (id === RenderConfigComponent.WIDGET_CONFIG.id) {
            const itemId = this.addNewRenderConfigWidget();
            config.id = itemId;
            config.props.id = itemId;
        } else if (id === SpatialProfilerComponent.WIDGET_CONFIG.id) {
            const itemId = this.addNewSpatialProfileWidget();
            config.id = itemId;
            config.props.id = itemId;
        } else {
            // Remove it from the floating widget array, while preserving its store
            if (this.floatingWidgets.find(w => w.id === id)) {
                this.removeFloatingWidget(id, true);
            }
        }
    };

    @action handleItemRemoval = (item: GoldenLayout.ContentItem) => {
        if (item.config.type === "component") {
            const config = item.config as GoldenLayout.ReactComponentConfig;

            // Clean up removed widget's store (ignoring items that have been floated)
            if (config.component !== "floated") {
                const id = config.id as string;
                console.log(`itemDestroyed: ${id}`);
                if (config.component === RenderConfigComponent.WIDGET_CONFIG.type) {
                    this.removeRenderConfigWidget(id);
                }
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
        const imageViewComponents = this.dockedLayout.root.getItemsByFilter((item: any) => item.config.component === ImageViewComponent.WIDGET_CONFIG.type);
        if (imageViewComponents.length) {
            imageViewComponents[0].setTitle(newTitle);
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

    createFloatingLogWidget = () => {
        this.addFloatingWidget(LogComponent.WIDGET_CONFIG);
    };

    createFloatingAnimatorWidget = () => {
        this.addFloatingWidget(AnimatorComponent.WIDGET_CONFIG);
    };

    // region Spatial Profile Widgets
    createFloatingSpatialProfilerWidget = () => {
        let config = SpatialProfilerComponent.WIDGET_CONFIG;
        config.id = this.addNewSpatialProfileWidget();
        this.addFloatingWidget(config);
    };

    @action addNewSpatialProfileWidget() {
        const defaultId = SpatialProfilerComponent.WIDGET_CONFIG.id;
        // Find the next appropriate ID
        let nextIndex = 0;
        while (true) {
            const nextId = `${defaultId}-${nextIndex}`;
            if (!this.spatialProfileWidgets.has(nextId)) {
                this.spatialProfileWidgets.set(nextId, new SpatialProfileWidgetStore());
                return nextId;
            }
            nextIndex++;
        }
    }

    @action addSpatialProfileWidget(id: string, fileId: number, regionId: number, coordinate: string) {
        this.spatialProfileWidgets.set(id, new SpatialProfileWidgetStore(coordinate, fileId, regionId));
    }

    // endregion

    // region Spectral Profile Widgets
    createFloatingSpectralProfilerWidget = () => {
        let config = SpectralProfilerComponent.WIDGET_CONFIG;
        config.id = this.addNewSpectralProfileWidget();
        this.addFloatingWidget(config);
    };

    @action addNewSpectralProfileWidget() {
        const defaultId = SpectralProfilerComponent.WIDGET_CONFIG.id;
        // Find the next appropriate ID
        let nextIndex = 0;
        while (true) {
            const nextId = `${defaultId}-${nextIndex}`;
            if (!this.spectralProfileWidgets.has(nextId)) {
                this.spectralProfileWidgets.set(nextId, new SpectralProfileWidgetStore());
                return nextId;
            }
            nextIndex++;
        }
    }

    @action addSpectralProfileWidget(id: string, fileId: number, regionId: number, coordinate: string) {
        this.spectralProfileWidgets.set(id, new SpectralProfileWidgetStore(coordinate, fileId, regionId));
    }

    // endregion

    // region Render Config Widgets
    createFloatingRenderWidget = () => {
        let config = RenderConfigComponent.WIDGET_CONFIG;
        config.id = this.addNewRenderConfigWidget();
        this.addFloatingWidget(config);
    };

    @action addNewRenderConfigWidget() {
        const defaultId = RenderConfigComponent.WIDGET_CONFIG.id;
        // Find the next appropriate ID
        let nextIndex = 0;
        while (true) {
            const nextId = `${defaultId}-${nextIndex}`;
            if (!this.renderConfigWidgets.has(nextId)) {
                this.renderConfigWidgets.set(nextId, new RenderConfigWidgetStore());
                return nextId;
            }
            nextIndex++;
        }
    }

    @action addRenderConfigWidget(id: string) {
        this.renderConfigWidgets.set(id, new RenderConfigWidgetStore());
    }

    @action removeRenderConfigWidget(id: string) {
        this.renderConfigWidgets.delete(id);
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
            if (widget.type === RenderConfigComponent.WIDGET_CONFIG.type) {
                this.appStore.widgetsStore.removeRenderConfigWidget(widget.id);
            }
            // TODO: Remove spatial and spectral profiles widgets' stores when closing
        }
    };
    // endregion
}