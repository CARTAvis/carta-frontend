import * as GoldenLayout from "golden-layout";
import {action, observable} from "mobx";
import {AppStore} from "./AppStore";
import {FloatingWidgetStore} from "./widgets/FloatingWidgetStore";
import {RenderConfigWidgetStore} from "./widgets/RenderConfigWidgetStore";
import {SpatialProfileWidgetStore} from "./widgets/SpatialProfileWidgetStore";
import {SpatialProfilerComponent} from "../components/SpatialProfiler/SpatialProfilerComponent";
import {RenderConfigComponent} from "../components/RenderConfig/RenderConfigComponent";
import {ImageViewComponent} from "../components/ImageView/ImageViewComponent";

export class WidgetsStore {
    // Golden Layout
    @observable dockedLayout: GoldenLayout;
    // Floating Widgets
    @observable floatingWidgetStore: FloatingWidgetStore;
    // Widget Stores
    @observable renderConfigWidgets: Map<string, RenderConfigWidgetStore>;
    @observable spatialProfileWidgets: Map<string, SpatialProfileWidgetStore>;

    private appStore: AppStore;

    constructor(appStore: AppStore) {
        this.appStore = appStore;
        this.floatingWidgetStore = new FloatingWidgetStore(appStore);
        this.spatialProfileWidgets = new Map<string, SpatialProfileWidgetStore>();
        this.renderConfigWidgets = new Map<string, RenderConfigWidgetStore>();
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
        const imageViewWidget = this.floatingWidgetStore.widgets.find(w => w.type === ImageViewComponent.WIDGET_CONFIG.type);
        if (imageViewWidget) {
            this.floatingWidgetStore.setWidgetTitle(imageViewWidget.id, newTitle);
        }
    }

    @action setWidgetTitle(id: string, title: string) {
        const matchingComponents = this.dockedLayout.root.getItemsByFilter(item => item.config.id === id);
        if (matchingComponents.length) {
            matchingComponents[0].setTitle(title);
        }

        this.floatingWidgetStore.setWidgetTitle(id, title);
    }

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
}