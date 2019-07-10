import {observable, computed, action} from "mobx";
import {WidgetsStore} from "stores";

const KEY = "CARTA_saved_layouts";

export class LayoutStore {
    private readonly widgetsStore: WidgetsStore;
    @observable private layouts; // self-defined structure: {layoutName: config, layoutName: config, ...}

    constructor(widgetsStore: WidgetsStore) {
        this.widgetsStore = widgetsStore;
        this.layouts = {};

        // read layout configs from local storage
        const layoutJson = localStorage.getItem(KEY);
        if (layoutJson) {
            try {
                this.layouts = JSON.parse(layoutJson);
            } catch (e) {
                console.log("Parse layout Json error!");
                this.layouts = {};
            }
        }
    }

    @computed get userLayouts(): string[] {
        return Object.keys(this.layouts);
    }

    @action saveLayout = (layoutName: string) => {
        if (this.layouts && layoutName && Object.keys(this.layouts).includes(layoutName)) {
            console.log("Overwrite " + Object.keys(this.layouts));
        } else {
            const config = this.widgetsStore.dockedLayout.toConfig();
            this.layouts[layoutName] = "";

            // TODO: save to local storage
            //localStorage.setItem(KEY, JSON.stringify(this.layouts));
        }
    };

    @action deleteLayout = (layoutName: string) => {
        if (this.layouts && layoutName && Object.keys(this.layouts).includes(layoutName)) {
            delete this.layouts[layoutName];
        }

        // TODO: save to local storage
    };

    // TODO: when presets are designed & ready
    @action getPresetLayouts = (): string[] => {
        return null;
    };

    @action applyLayout = (layoutName: string) => {
        if (this.layouts && layoutName && Object.keys(this.layouts).includes(layoutName)) {
            // TODO: applying layout by name
        }
    };

    // helper function, will delete when finished
    @action showLayout = () => {
        Object.keys(this.layouts).forEach((value) => console.log(value + ": " + this.layouts[value]));
    };
}