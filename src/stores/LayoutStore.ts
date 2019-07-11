import {observable, computed, action} from "mobx";
import {WidgetsStore, AlertStore} from "stores";

const KEY = "CARTA_saved_layouts";
const MAX_LAYOUT = 10;

export class LayoutStore {
    public static TOASTER_TIMEOUT = 1500;
    private readonly widgetsStore: WidgetsStore;
    private readonly alertStore: AlertStore;
    @observable private layouts; // self-defined structure: {layoutName: config, layoutName: config, ...}

    constructor(widgetsStore: WidgetsStore, alertStore: AlertStore) {
        this.widgetsStore = widgetsStore;
        this.alertStore = alertStore;
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

    private saveLayoutToLocalStorage = () => {
        let layouts = {};
        Object.keys(this.layouts).forEach((value) => layouts[value] = this.layouts[value]);
        localStorage.setItem(KEY, JSON.stringify(layouts));
    };

    @action saveLayout = (layoutName: string): boolean => {
        if (!this.layouts || !layoutName) {
            return false;
        }

        if (Object.keys(this.layouts).includes(layoutName)) {
            // overwrite existing layout
            // TODO: guard with alert
            this.alertStore.showAlert(`Are you sure to overwrite the existing layout ${layoutName}?`);
        } else {
            // add new layout
            const config = this.widgetsStore.dockedLayout.toConfig();
            this.layouts[layoutName] = "";
        }
        this.saveLayoutToLocalStorage();
        return true;
    };

    @action deleteLayout = (layoutName: string): boolean => {
        if (this.layouts && layoutName && Object.keys(this.layouts).includes(layoutName)) {
            delete this.layouts[layoutName];
            this.saveLayoutToLocalStorage();
            return true;
        }
        return false;
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