import * as GoldenLayout from "golden-layout";
import {action, observable} from "mobx";
import {AppStore} from "./AppStore";
import {RenderConfigWidgetStore} from "./widgets/RenderConfigWidgetStore";
import {SpatialProfileWidgetStore} from "./widgets/SpatialProfileWidgetStore";
import {SpatialProfilerComponent} from "../components/SpatialProfiler/SpatialProfilerComponent";
import {RenderConfigComponent} from "../components/RenderConfig/RenderConfigComponent";
import {ImageViewComponent} from "../components/ImageView/ImageViewComponent";

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

export class WidgetsStore {
    // Golden Layout
    @observable dockedLayout: GoldenLayout;
    @observable floatingWidgets: WidgetConfig[];
    // Widget Stores
    @observable renderConfigWidgets: Map<string, RenderConfigWidgetStore>;
    @observable spatialProfileWidgets: Map<string, SpatialProfileWidgetStore>;
    @observable defaultFloatingWidgetOffset: number;
    private appStore: AppStore;

    constructor(appStore: AppStore) {
        this.appStore = appStore;
        this.spatialProfileWidgets = new Map<string, SpatialProfileWidgetStore>();
        this.renderConfigWidgets = new Map<string, RenderConfigWidgetStore>();
        this.floatingWidgets = [];
        this.defaultFloatingWidgetOffset = 100;
    }

    @action setDockedLayout(layout: GoldenLayout) {
        this.dockedLayout = layout;
    }

    @action updateImageWidgetTitle() {
        let newTitle;
        if (this.appStore.activeFrame) {
            newTitle = this.appStore.activeFrame.frameInfo.fileInfo.name;
        }
        else {
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

    // region Spatial Profile Widgets
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

    // region Render Config Widgets
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
    @action removeFloatingWidget = (id: string, preserveConfig: boolean = false) => {
        const widget = this.floatingWidgets.find(w => w.id === id);
        if (widget) {
            this.floatingWidgets = this.floatingWidgets.filter(w => w.id !== id);
            if (preserveConfig) {
                return;
            }
            if (widget.type === RenderConfigComponent.WIDGET_CONFIG.type) {
                this.appStore.widgetsStore.removeRenderConfigWidget(widget.id);
            }
        }
    };
    // endregion
}