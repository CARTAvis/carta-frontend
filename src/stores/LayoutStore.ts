import {observable, computed, action} from "mobx";
import {WidgetsStore, AlertStore} from "stores";

const KEY = "CARTA_saved_layouts";
const MAX_LAYOUT = 2;

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

    private saveLayoutToLocalStorage = (): boolean => {
        const getCircularReplacer = () => {
            const seen = new WeakSet();
            return (key, value) => {
                if (typeof value === "object" && value !== null) {
                    if (seen.has(value)) {
                        return;
                    }
                    seen.add(value);
                }
                return value;
            };
        };

        // serialize layout for saving
        let serializedJson;
        try {
            serializedJson = JSON.stringify(this.layouts, getCircularReplacer());
        } catch (e) {
            this.alertStore.showAlert("Serializing layout falied!");
            return false;
        }

        try {
            localStorage.setItem(KEY, serializedJson);
        } catch (e) {
            this.alertStore.showAlert("Save layout to local storage falied!");
            return false;
        }

        return true;
    };

    @action saveLayout = (layoutName: string): boolean => {
        if (!this.layouts || !layoutName) {
            return false;
        }

        if (Object.keys(this.layouts).length >= MAX_LAYOUT) {
            this.alertStore.showAlert(`Exceed maximum layout quota(${MAX_LAYOUT}).`);
            return false;
        }

        if (Object.keys(this.layouts).includes(layoutName)) {
            // TODO: guard with alert
            // `Are you sure to overwrite the existing layout ${layoutName}?`
            // if(!this.alertStore.showOverwriteLayoutWarning()) {
            //    return false;
            // }
        }

        const config = this.widgetsStore.dockedLayout.toConfig();
        this.layouts[layoutName] = config;

        if (!this.saveLayoutToLocalStorage()) {
            delete this.layouts[layoutName];
            return false;
        }

        return true;
    };

    @action deleteLayout = (layoutName: string): boolean => {
        if (this.layouts && layoutName && Object.keys(this.layouts).includes(layoutName)) {
            delete this.layouts[layoutName];
            return this.saveLayoutToLocalStorage();
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
}
