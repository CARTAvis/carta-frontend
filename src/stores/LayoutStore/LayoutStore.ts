import {DockLocation, type DropInfo, type Layout, Model, type Node} from "flexlayout-react";
import {action, computed, flow, makeObservable, observable} from "mobx";

import {AppToaster, SuccessToast} from "components/Shared";
import {LayoutDialogMode} from "enums";
import {LayoutConfig, PresetLayout} from "models";
import {ApiService} from "services";
import {AlertStore, AppStore} from "stores";

const MAX_LAYOUT = 10;

export class LayoutStore {
    private static staticInstance: LayoutStore;

    public static get Instance() {
        if (!LayoutStore.staticInstance) {
            LayoutStore.staticInstance = new LayoutStore();
        }
        return LayoutStore.staticInstance;
    }

    public static readonly TOASTER_TIMEOUT = 1500;
    private layoutNameToBeSaved: string;

    @observable layoutModel: Model | null = null;
    @observable currentLayoutName: string;
    @observable private layouts: any = {};
    @observable hasServerSupport: boolean = false;
    @observable layoutDialogMode: LayoutDialogMode | undefined = LayoutDialogMode.Layout;

    // Reference to the FlexLayout Layout component (set from App.tsx)
    public layoutRef: React.RefObject<Layout> = {current: null};

    private constructor() {
        makeObservable<LayoutStore, "layouts">(this);
        this.initLayoutsFromPresets();
    }

    public layoutExists = (layoutName: string): boolean => {
        return layoutName.length > 0 && this.allLayoutNames.includes(layoutName);
    };

    public setLayoutToBeSaved = (layoutName: string) => {
        this.layoutNameToBeSaved = layoutName ? layoutName : "Empty";
    };

    @flow.bound *fetchLayouts() {
        try {
            const userLayouts = yield ApiService.Instance.getLayouts();
            for (const name of Object.keys(userLayouts)) {
                if (name) {
                    this.layouts[name] = userLayouts[name];
                }
            }
        } catch (err) {
            AlertStore.Instance.showAlert("Loading user-defined layout failed!");
            console.error(err);
        }
    }

    private initLayoutsFromPresets = () => {
        PresetLayout.PRESETS.forEach(presetName => {
            const presetConfig = LayoutConfig.getPresetConfig(presetName);
            if (presetConfig) {
                this.layouts[presetName] = presetConfig;
            }
        });
    };

    @computed get allLayoutNames(): string[] {
        return this.layouts ? Object.keys(this.layouts) : [];
    }

    @computed get userLayoutNames(): string[] {
        return this.layouts ? Object.keys(this.layouts).filter(layoutName => !PresetLayout.isPreset(layoutName)) : [];
    }

    @computed get orderedLayoutNames(): string[] {
        const orderedLayouts = [...PresetLayout.PRESETS];
        return this.userLayoutNames?.length ? orderedLayouts.concat(this.userLayoutNames) : orderedLayouts;
    }

    @computed get numSavedLayouts(): number {
        return this.userLayoutNames.length;
    }

    @computed get hasPopoutWidget(): boolean {
        if (!this.layoutModel) {
            return false;
        }
        const currentModelJson = this.layoutModel.toJson();
        return !!(currentModelJson.popouts && Object.values(currentModelJson.popouts).length > 0);
    }

    private clearCurrentLayout = () => {
        const appStore = AppStore.Instance;
        appStore.widgetsStore.removeFloatingWidgets();
        appStore.widgetsStore.clearDockedWidgets();
        this.layoutModel = null;
    };

    @action applyLayout = (layoutName: string): boolean => {
        if (!layoutName || !this.layoutExists(layoutName)) {
            AlertStore.Instance.showAlert(`Applying layout failed! Layout ${layoutName} not found.`);
            return false;
        }

        const config = this.layouts[layoutName];
        const appStore = AppStore.Instance;
        this.clearCurrentLayout();
        appStore.widgetsStore.clearPopoutPositions();

        // generate docked config & collect docked components
        const dockedConfig = {
            type: config.docked.type,
            content: []
        };
        // Build abstract config tree (don't collect component configs here — they'll be collected with unique IDs below)
        LayoutConfig.createConfigToApply(dockedConfig.content, config.docked.content, []);

        // Create FlexLayout model first — this assigns unique IDs via _assignedId on abstract config nodes
        const dockedComponentConfigs: any[] = [];
        const modelJson = LayoutConfig.createFlexLayoutModelJson(dockedConfig, dockedComponentConfigs);

        // Init widget stores using pre-assigned unique IDs so they match the FlexLayout model's tab node IDs
        appStore.widgetsStore.initWidgets(dockedComponentConfigs, config.floating);

        this.layoutModel = Model.fromJson(modelJson);
        this.layoutModel.setOnAllowDrop((_dragNode: Node, dropInfo: DropInfo) => {
            return !(dropInfo.className === "flexlayout__outline_rect_edge" && (dropInfo.location === DockLocation.TOP || dropInfo.location === DockLocation.BOTTOM));
        });

        appStore.widgetsStore.updateImageWidgetTitle();
        this.currentLayoutName = layoutName;

        return true;
    };

    @flow.bound *saveLayout() {
        const appStore = AppStore.Instance;
        if (!this.layouts || !this.layoutNameToBeSaved || !this.layoutModel) {
            appStore.alertStore.showAlert("Save layout failed! Empty layouts or name.");
            return;
        }

        if (PresetLayout.isPreset(this.layoutNameToBeSaved)) {
            appStore.alertStore.showAlert("Layout name cannot be the same as system presets.");
            return;
        }

        if (!this.layoutExists(this.layoutNameToBeSaved) && this.numSavedLayouts >= MAX_LAYOUT) {
            appStore.alertStore.showAlert(`Maximum user-defined layout quota exceeded! (${MAX_LAYOUT} layouts)`);
            return;
        }

        const currentModelJson = this.layoutModel.toJson();
        if (!currentModelJson || !currentModelJson.layout) {
            appStore.alertStore.showAlert("Saving layout failed! Something is wrong with current layout.");
            return;
        }

        if (this.hasPopoutWidget) {
            appStore.alertStore.showAlert("Cannot save layout while an image view is popped out. Please dock it first.");
            return;
        }

        const configToSave = LayoutConfig.createConfigToSave(appStore, currentModelJson);
        if (!configToSave) {
            appStore.alertStore.showAlert("Saving layout failed! Creating layout configuration for saving failed.");
            return;
        }

        // save layout to layouts[] & server/local storage
        this.layouts[this.layoutNameToBeSaved] = configToSave;
        if (!PresetLayout.isPreset(this.layoutNameToBeSaved)) {
            try {
                const success = yield appStore.apiService.setLayout(this.layoutNameToBeSaved, configToSave);
                if (success) {
                    this.handleSaveResult(success);
                }
            } catch (err) {
                console.error(err);
                this.handleSaveResult(false);
            }
        }
    }

    private handleSaveResult = (isSuccessful: boolean) => {
        if (isSuccessful) {
            AppToaster.show(SuccessToast("layout-grid", `Layout ${this.layoutNameToBeSaved} saved successfully.`, LayoutStore.TOASTER_TIMEOUT));
            this.currentLayoutName = this.layoutNameToBeSaved;
        } else {
            delete this.layouts[this.layoutNameToBeSaved];
            AlertStore.Instance.showAlert("Saving user-defined layout failed! ");
        }
    };

    @flow.bound *renameLayout(oldName: string, newName: string) {
        const appStore = AppStore.Instance;
        const dynamicLayout = appStore.dynamicLayoutStore;

        if (!this.layouts || !newName || !this.layoutModel) {
            appStore.alertStore.showAlert("Save layout failed! Empty layouts or name.");
            return;
        }

        if (PresetLayout.isPreset(newName)) {
            appStore.alertStore.showAlert("Layout name cannot be the same as system presets.");
            return;
        }

        if (this.layoutExists(newName)) {
            appStore.alertStore.showAlert("Layout name already exists.");
            return;
        }

        if (!oldName || !this.layoutExists(oldName)) {
            appStore.alertStore.showAlert(`Cannot rename layout ${oldName}! It does not exist.`);
            return;
        }

        // save layout to layouts[] & server/local storage
        const configToSave = this.layouts[oldName];
        this.layouts[newName] = configToSave;
        if (!PresetLayout.isPreset(this.layoutNameToBeSaved)) {
            try {
                const success = yield appStore.apiService.setLayout(newName, configToSave);

                if (success) {
                    const success = yield appStore.apiService.clearLayout(oldName);
                    if (success) {
                        delete this.layouts[oldName];
                    }
                    this.handleRenameResult(oldName, newName, success);
                    yield dynamicLayout.modifyLayoutMapping(oldName, newName);
                }
            } catch (err) {
                console.error(err);
                this.handleRenameResult(oldName, newName, false);
            }
        }
    }

    private handleRenameResult = (oldName: string, newName: string, isSuccessful: boolean) => {
        if (isSuccessful) {
            AppToaster.show(SuccessToast("layout-grid", `Layout ${oldName} renamed to ${newName} successfully.`, LayoutStore.TOASTER_TIMEOUT));
            if (oldName === this.currentLayoutName) {
                this.currentLayoutName = newName;
            }
        } else {
            AlertStore.Instance.showAlert("Renaming user-defined layout failed!");
        }
    };

    @flow.bound *deleteLayout(layoutName: string) {
        const appStore = AppStore.Instance;
        const dynamicLayout = appStore.dynamicLayoutStore;

        if (!layoutName || !this.layoutExists(layoutName)) {
            appStore.alertStore.showAlert(`Cannot delete layout ${layoutName}! It does not exist.`);
            return;
        }

        const confirmed = yield appStore.alertStore.showInteractiveAlert(`Do you delete layout ${layoutName}?`);
        if (confirmed) {
            try {
                const success = yield appStore.apiService.clearLayout(layoutName);
                yield dynamicLayout.deleteLayoutMappingByLayoutName(layoutName);
                if (success) {
                    delete this.layouts[layoutName];
                }
                this.handleDeleteResult(layoutName, success);
            } catch (err) {
                console.error(err);
                this.handleDeleteResult(layoutName, false);
            }
        }
    }

    private handleDeleteResult = (layoutName: string, isSuccessful: boolean) => {
        if (isSuccessful) {
            AppToaster.show(SuccessToast("layout-grid", `Layout ${layoutName} deleted successfully.`, LayoutStore.TOASTER_TIMEOUT));
            if (layoutName === this.currentLayoutName) {
                this.currentLayoutName = "";
            }
        } else {
            AlertStore.Instance.showAlert("Deleting user-defined layout failed!");
        }
    };
}
