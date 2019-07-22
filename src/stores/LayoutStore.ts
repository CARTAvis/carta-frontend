import {observable, computed, action} from "mobx";
import {AppStore, WidgetsStore, AlertStore} from "stores";
import * as GoldenLayout from "golden-layout";
import {LayoutToaster} from "components/Shared";

const KEY = "CARTA_saved_layouts";
const MAX_LAYOUT = 3;

export class LayoutStore {
    public static TOASTER_TIMEOUT = 1500;

    private readonly appStore: AppStore;
    private readonly widgetsStore: WidgetsStore;
    private readonly alertStore: AlertStore;
    private layoutToBeSaved: string;
    @observable private layouts; // self-defined structure: {layoutName: config, layoutName: config, ...}

    constructor(appStore: AppStore, widgetsStore: WidgetsStore, alertStore: AlertStore) {
        this.appStore = appStore;
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

    public layoutExist = (layoutName: string): boolean => {
        return this.layouts && layoutName && Object.keys(this.layouts).includes(layoutName);
    };

    public setLayoutToBeSaved = (layoutName: string) => {
        this.layoutToBeSaved = layoutName;
    };

    private genSimpleConfig = (newParentContent, parentContent): void => {
        if (!newParentContent || !parentContent) {
            return;
        }

        parentContent.forEach((child) => {
            if (child.type === "stack" || child.type === "row" || child.type === "column") {
                let simpleChild = {
                    type: child.type,
                    content: []
                };
                newParentContent.push(simpleChild);
                this.genSimpleConfig(simpleChild.content, child.content);
            } else if (child.type === "component") {
                let simpleChild = {
                    type: child.type,
                    id: child.id
                };
                newParentContent.push(simpleChild);
            }
        });
    };

    private saveLayoutToLocalStorage = (): boolean => {
        try {
            const serializedJson = JSON.stringify(this.layouts);
            localStorage.setItem(KEY, serializedJson);
        } catch (e) {
            this.alertStore.showAlert("Saving user-defined layout failed! " + e.message);
            return false;
        }

        return true;
    };

    @action saveLayout = () => {
        if (!this.layouts || !this.layoutToBeSaved) {
            this.alertStore.showAlert("Save layout failed! Empty layouts or name.");
            return;
        }

        if (!this.layoutExist(this.layoutToBeSaved) && this.savedLayoutNumber >= MAX_LAYOUT) {
            this.alertStore.showAlert(`Maximum user-defined layout quota exceeded! (${MAX_LAYOUT} layouts)`);
            return;
        }

        let simpleConfig = {
            content: []
        };
        this.genSimpleConfig(simpleConfig.content, this.widgetsStore.dockedLayout.config.content);
        this.layouts[this.layoutToBeSaved] = simpleConfig;

        if (!this.saveLayoutToLocalStorage()) {
            delete this.layouts[this.layoutToBeSaved];
            return;
        }

        // TODO: is there a better way for this? putting here is not ideal for MVC
        LayoutToaster.show({icon: "layout-grid", message: `Layout ${this.layoutToBeSaved} is saved successfully.`, intent: "success", timeout: LayoutStore.TOASTER_TIMEOUT});
    };

    // TODO: show confirm dialog
    @action deleteLayout = (layoutName: string) => {
        if (!this.layoutExist(layoutName)) {
            this.alertStore.showAlert(`Cannot delete layout ${layoutName}! It does not exist.`);
            return;
        }

        delete this.layouts[layoutName];
        if (!this.saveLayoutToLocalStorage()) {
            return;
        }

        LayoutToaster.show({icon: "layout-grid", message: `Layout ${layoutName} is deleted successfully.`, intent: "success", timeout: LayoutStore.TOASTER_TIMEOUT});
    };

    // TODO: when presets are designed & ready
    @action getPresetLayouts = (): string[] => {
        return null;
    };

    // TODO: error handling
    private genNewContentItem = (newParentItem: GoldenLayout.ContentItem, newConfigContent: any, currentLayout: GoldenLayout): void => {
        if (!newParentItem || !newConfigContent || !currentLayout) {
            return;
        }

        newConfigContent.forEach((childConfig) => {
            if (childConfig.type) {
                if (childConfig.type === "stack" || childConfig.type === "row" || childConfig.type === "column") {
                    let newItem = currentLayout.createContentItem({
                        type: childConfig.type,
                        content: []
                    }) as unknown;
                    newParentItem.addChild(newItem as GoldenLayout.ContentItem);
                    this.genNewContentItem(newItem as GoldenLayout.ContentItem, childConfig.content, currentLayout);
                } else if (childConfig.type === "component") { // add component
                    const componentConfig = AppStore.getComponentConfig(childConfig.id, this.appStore);
                    if (componentConfig) {
                        newParentItem.addChild(componentConfig);
                    }
                }
            }
        });
    }

    @action applyLayout = (layoutName: string) => {
        if (!this.layoutExist(layoutName)) {
            this.alertStore.showAlert(`Applying layout failed! Layout ${layoutName} not found.`);
            return;
        }

        let currentLayout: GoldenLayout = this.widgetsStore.dockedLayout;
        const currentRoot: GoldenLayout.ContentItem = currentLayout.root.contentItems[0];

        try {
            // Create new root ContentItem for new layout
            const newConfig = this.layouts[layoutName];
            let newRoot = currentLayout.createContentItem({
                type: newConfig.content[0].type,
                content: []
            }) as unknown;

            // Recursively generate the root ContentItem according to saved config
            this.genNewContentItem(newRoot as GoldenLayout.ContentItem, newConfig.content[0].content, currentLayout);

            // Prevent it from re-initialising any child items
            (newRoot as GoldenLayout.ContentItem).isInitialised = true;

            // Replace current layout's root with newly generated root
            currentLayout.root.replaceChild(currentRoot, newRoot as GoldenLayout.ContentItem);
        } catch (e) {
            this.alertStore.showAlert(`Applying layout failed! Layout ${layoutName} may be broken. ` + e.message);
        }
    };
}
