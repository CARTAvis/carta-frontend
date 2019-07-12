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
                this.alertStore.showAlert("Loading user-defined layout failed!");
                this.layouts = {};
            }
        }
    }

    @computed get userLayouts(): string[] {
        return Object.keys(this.layouts);
    }

    @computed get savedLayoutNumber(): number {
        return Object.keys(this.layouts).length;
    }

    private layoutExist = (layoutName: string): boolean => {
        return this.layouts && layoutName && Object.keys(this.layouts).includes(layoutName);
    };

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
            this.alertStore.showAlert("Serializing user-defined layout failed! " + e.message);
            return false;
        }

        try {
            localStorage.setItem(KEY, serializedJson);
        } catch (e) {
            this.alertStore.showAlert("Saving user-defined layout failed! " + e.message);
            return false;
        }

        return true;
    };

    @action saveLayout = (layoutName: string): boolean => {
        if (!this.layouts || !layoutName) {
            return false;
        }

        if (this.savedLayoutNumber >= MAX_LAYOUT) {
            this.alertStore.showAlert(`Maximum user-defined layout quota exceeded! (${MAX_LAYOUT} layouts)`);
            return false;
        }

        if (this.layoutExist(layoutName)) {
            // TODO: guard with alert
            // `Are you sure to overwrite the existing layout ${layoutName}?`
            // if(!this.alertStore.showOverwriteLayoutWarning()) {
            //    return false;
            // }
        }

        this.layouts[layoutName] = this.widgetsStore.getDockedLayoutConfig();

        if (!this.saveLayoutToLocalStorage()) {
            delete this.layouts[layoutName];
            return false;
        }

        return true;
    };

    @action deleteLayout = (layoutName: string): boolean => {
        if (!this.layoutExist(layoutName)) {
            return false;
        }
        delete this.layouts[layoutName];
        return this.saveLayoutToLocalStorage();
    };

    // TODO: when presets are designed & ready
    @action getPresetLayouts = (): string[] => {
        return null;
    };

    @action applyLayout = (layoutName: string) => {
        if (!this.layoutExist(layoutName)) {
            this.alertStore.showAlert(`Applying layout failed! Layout ${layoutName} not found.`);
            return;
        }

        const currentLayout = this.widgetsStore.dockedLayout;
        const oldElement = currentLayout.root.contentItems[0];

        // TODO: error handling
        const newElement = currentLayout.createContentItem(this.layouts[layoutName]);

        // Prevent it from re-initialising any child items
        // newElement.isInitialised = true;
        console.log(oldElement);
        console.log(newElement);

        // replace elements
        // for ( i = 0; i < newElement.contentItems.length; i++ ) {
        //    newElement.addChild(oldElement.getItemsById(newElement.contentItems.id));
        // }

        // layout.root.replaceChild(oldElement, newElement);
    };
}
