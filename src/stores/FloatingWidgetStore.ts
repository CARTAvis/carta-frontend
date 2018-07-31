import {action, observable} from "mobx";

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
    title: string;
}

export class FloatingWidgetStore {
    @observable widgets: WidgetConfig[];
    @observable defaultOffset: number;

    @action selectWidget = (id: string) => {
        const selectedWidget = this.widgets.find(w => w.id === id);
        if (selectedWidget) {
            this.widgets = this.widgets.filter(w => w.id !== id);
            this.widgets.push(selectedWidget);
        }
    };

    @action addWidget = (widget: WidgetConfig) => {
        this.widgets.push(widget);
        this.defaultOffset += 25;
        this.defaultOffset = (this.defaultOffset - 100) % 300 + 100;
    };

    @action removeWidget = (id: string) => {
        this.widgets = this.widgets.filter(w => w.id !== id);
    };

    constructor() {
        this.widgets = [];
        this.defaultOffset = 100;
    }
}