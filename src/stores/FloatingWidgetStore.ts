import {action, observable} from "mobx";

export class WidgetConfig {
    id: string;
    type: string;
    minWidth: number;
    minHeight: number;
}

export class FloatingWidgetStore {
    @observable widgets: WidgetConfig[];

    @action addWidget(widget: WidgetConfig) {
        this.widgets.push(widget);
    }

    @action removeWidget(id: string) {
        this.widgets = this.widgets.filter(w => w.id !== id);
    }

    @action selectWidget = (id: string) => {
        const selectedWidget = this.widgets.find(w => w.id === id);
        if (selectedWidget) {
            this.widgets = this.widgets.filter(w => w.id !== id);
            this.widgets.push(selectedWidget);
        }
    };

    constructor() {
        this.widgets = [];
    }
}