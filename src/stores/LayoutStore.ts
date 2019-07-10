import {observable, action} from "mobx";
import {WidgetsStore} from "stores";

const KEY = "CARTA_saved_layouts";

export class LayoutStore {
    private readonly widgetsStore: WidgetsStore;
    private layouts; // self-defined structure: {layoutName: config, layoutName: config, ...}

    constructor(widgetsStore: WidgetsStore) {
        this.widgetsStore = widgetsStore;

        // read layout configs from local storage
        const layoutJson = localStorage.getItem(KEY);
        try {
            this.layouts = layoutJson ? JSON.parse(layoutJson) : {};
        } catch (e) {
            console.log("Parse layout Json error!");
            this.layouts = {};
        }
    }

    saveLayout = (name: string) => {
        if (this.layouts && Object.keys(this.layouts).includes(name)) {
            console.log("Overwrite " + Object.keys(this.layouts));
        } else {
            const config = this.widgetsStore.dockedLayout.toConfig();
            this.layouts[name] = config;
            // localStorage.setItem(KEY, JSON.stringify(this.layouts));
        }
    };

    getUserLayouts = (): string[] => {
        if (!this.layouts) {
            return null;
        }
        return Object.keys(this.layouts);
    };

    // TODO: when presets are designed & ready
    getPresetLayouts = (): string[] => {
        return null;
    };

    // TODO: applying layout by name
    applyLayout = (layoutName: string) => {
        console.log("Applying layout " + layoutName);
    };
}