import {action, observable} from "mobx";
import {RenderConfigComponent} from "../../components/RenderConfig/RenderConfigComponent";
import {AppStore} from "../AppStore";

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

export class FloatingWidgetStore {
    @observable widgets: WidgetConfig[];
    @observable defaultOffset: number;
    private appStore: AppStore;

    @action selectWidget = (id: string) => {
        const selectedWidgetIndex = this.widgets.findIndex(w => w.id === id);
        const N = this.widgets.length;
        // Only rearrange widgets if the id is found and the widget isn't already selected.
        if (N > 1 && selectedWidgetIndex >= 0 && selectedWidgetIndex < N - 1) {
            const selectedWidget = this.widgets[selectedWidgetIndex];
            for (let i = 0; i < N - 1; i++) {
                if (i >= selectedWidgetIndex) {
                    this.widgets[i] = this.widgets[i + 1];
                }
            }
            this.widgets[N - 1] = selectedWidget;
        }
    };

    @action changeWidgetId(id: string, newId: string) {
        const widget = this.widgets.find(w => w.id === id);
        if (widget) {
            widget.id = newId;
        }
    }

    @action addWidget = (widget: WidgetConfig) => {
        this.widgets.push(widget);
        this.defaultOffset += 25;
        this.defaultOffset = (this.defaultOffset - 100) % 300 + 100;
    };

    @action removeWidget = (id: string, preserveConfig: boolean = false) => {
        const widget = this.widgets.find(w => w.id === id);
        if (widget) {
            this.widgets = this.widgets.filter(w => w.id !== id);
            if (preserveConfig) {
                return;
            }
            if (widget.type === RenderConfigComponent.WIDGET_CONFIG.type) {
                this.appStore.removeRenderConfigWidget(widget.id);
            }
        }
    };

    @action setWidgetTitle = (id: string, title: string) => {
        const widget = this.widgets.find(w => w.id === id);
        if (widget) {
            widget.title = title;
        }
    };

    constructor(appStore: AppStore) {
        this.appStore = appStore;
        this.widgets = [];
        this.defaultOffset = 100;
    }
}