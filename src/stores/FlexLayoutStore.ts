import * as FlexLayout from "flexlayout-react";
import {action, computed, flow, makeObservable, observable} from "mobx";

import {AppToaster, SuccessToast} from "components/Shared";
import {LayoutDialogMode} from "enums";
import {FlexLayoutConfig, LayoutConfig, PresetLayout} from "models";
import {ApiService} from "services";
import {AlertStore, AppStore} from "stores";

const MAX_LAYOUT = 10;

export class FlexLayoutStore {
    private static staticInstance: FlexLayoutStore;

    static get Instance() {
        if (!FlexLayoutStore.staticInstance) {
            FlexLayoutStore.staticInstance = new FlexLayoutStore();
        }
        return FlexLayoutStore.staticInstance;
    }

    public static readonly ToasterTimeout = 1500;
    private layoutNameToBeSaved: string;

    @observable model: FlexLayout.Model | null = null;
    @observable currentLayoutName: string;
    @observable private layouts: any = {};
    @observable supportsServer: boolean = false;
    @observable layoutDialogMode: LayoutDialogMode | undefined = LayoutDialogMode.Layout;

    private constructor() {
        makeObservable<FlexLayoutStore, "layouts">(this);
        this.initLayoutsFromPresets();
        this.initDefaultModel();
    }

    private initDefaultModel = () => {
        const defaultConfig = FlexLayoutConfig.getDefaultConfig();
        this.model = FlexLayout.Model.fromJson(defaultConfig);
    };

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
            console.log(err);
        }
    }

    private initLayoutsFromPresets = () => {
        PresetLayout.PRESETS.forEach(presetName => {
            const presetConfig = LayoutConfig.GetPresetConfig(presetName);
            if (presetConfig) {
                // Convert preset config to FlexLayout format
                this.layouts[presetName] = this.convertGoldenLayoutToFlexLayout(presetConfig);
            }
        });
    };

    private convertGoldenLayoutToFlexLayout = (goldenConfig: any): FlexLayout.IJsonModel => {
        // TODO: Implement conversion logic from GoldenLayout config to FlexLayout config
        // For now, return default config
        return FlexLayoutConfig.getDefaultConfig();
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

    @action applyLayout = (layoutName: string): boolean => {
        if (!layoutName || !this.layoutExists(layoutName)) {
            AlertStore.Instance.showAlert(`Applying layout failed! Layout ${layoutName} not found.`);
            return false;
        }

        const config = this.layouts[layoutName];
        const appStore = AppStore.Instance;

        try {
            // Create new FlexLayout model from config
            this.model = FlexLayout.Model.fromJson(config);
            
            // Initialize widgets for the new layout
            appStore.widgetsStore.initFlexLayoutWithWidgets(this.model);
            
            this.currentLayoutName = layoutName;
            return true;
        } catch (error) {
            console.error("Error applying layout:", error);
            AlertStore.Instance.showAlert(`Failed to apply layout: ${error.message}`);
            return false;
        }
    };

    @action addTab = (tabConfig: FlexLayout.IJsonTabNode, targetTabsetId?: string) => {
        if (!this.model) return;

        try {
            if (targetTabsetId) {
                const tabsetNode = this.model.getNodeById(targetTabsetId);
                if (tabsetNode && tabsetNode.getType() === "tabset") {
                    this.model.doAction(FlexLayout.Actions.addNode(tabConfig, targetTabsetId, FlexLayout.DockLocation.CENTER, -1));
                }
            } else {
                // Add to the first available tabset
                const rootNode = this.model.getRoot();
                const firstTabset = this.findFirstTabset(rootNode);
                if (firstTabset) {
                    this.model.doAction(FlexLayout.Actions.addNode(tabConfig, firstTabset.getId(), FlexLayout.DockLocation.CENTER, -1));
                }
            }
        } catch (error) {
            console.error("Error adding tab:", error);
        }
    };

    private findFirstTabset = (node: FlexLayout.Node): FlexLayout.TabSetNode | null => {
        if (node.getType() === "tabset") {
            return node as FlexLayout.TabSetNode;
        }

        const children = node.getChildren();
        for (const child of children) {
            const result = this.findFirstTabset(child);
            if (result) return result;
        }
        return null;
    };

    @action removeTab = (tabId: string) => {
        if (!this.model) return;

        try {
            const node = this.model.getNodeById(tabId);
            if (node && node.getType() === "tab") {
                this.model.doAction(FlexLayout.Actions.deleteTab(tabId));
            }
        } catch (error) {
            console.error("Error removing tab:", error);
        }
    };

    @flow.bound *saveLayout() {
        const appStore = AppStore.Instance;
        if (!this.layouts || !this.layoutNameToBeSaved || !this.model) {
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

        try {
            const configToSave = this.model.toJson();
            
            // Save layout to layouts[] & server/local storage
            this.layouts[this.layoutNameToBeSaved] = configToSave;
            if (!PresetLayout.isPreset(this.layoutNameToBeSaved)) {
                const success = yield appStore.apiService.setLayout(this.layoutNameToBeSaved, configToSave);
                if (success) {
                    this.handleSaveResult(success);
                }
            }
        } catch (err) {
            console.log(err);
            this.handleSaveResult(false);
        }
    }

    private handleSaveResult = (success: boolean) => {
        if (success) {
            AppToaster.show(SuccessToast("layout-grid", `Layout ${this.layoutNameToBeSaved} saved successfully.`, FlexLayoutStore.ToasterTimeout));
            this.currentLayoutName = this.layoutNameToBeSaved;
        } else {
            delete this.layouts[this.layoutNameToBeSaved];
            AlertStore.Instance.showAlert("Saving user-defined layout failed! ");
        }
    };

    @flow.bound *renameLayout(oldName: string, newName: string) {
        const appStore = AppStore.Instance;
        const dynamicLayout = appStore.dynamicLayoutStore;

        if (!this.layouts || !newName || !this.model) {
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

        const configToSave = this.layouts[oldName];
        this.layouts[newName] = configToSave;
        
        if (!PresetLayout.isPreset(this.layoutNameToBeSaved)) {
            try {
                const success = yield appStore.apiService.setLayout(newName, configToSave);
                if (success) {
                    const deleteSuccess = yield appStore.apiService.clearLayout(oldName);
                    if (deleteSuccess) {
                        delete this.layouts[oldName];
                    }
                    this.handleRenameResult(oldName, newName, deleteSuccess);
                    yield dynamicLayout.modifyLayoutMapping(oldName, newName);
                }
            } catch (err) {
                console.log(err);
                this.handleRenameResult(oldName, newName, false);
            }
        }
    }

    private handleRenameResult = (oldName: string, newName: string, success: boolean) => {
        if (success) {
            AppToaster.show(SuccessToast("layout-grid", `Layout ${oldName} renamed to ${newName} successfully.`, FlexLayoutStore.ToasterTimeout));
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
                console.log(err);
                this.handleDeleteResult(layoutName, false);
            }
        }
    }

    private handleDeleteResult = (layoutName: string, success: boolean) => {
        if (success) {
            AppToaster.show(SuccessToast("layout-grid", `Layout ${layoutName} deleted successfully.`, FlexLayoutStore.ToasterTimeout));
            if (layoutName === this.currentLayoutName) {
                this.currentLayoutName = "";
            }
        } else {
            AlertStore.Instance.showAlert("Deleting user-defined layout failed!");
        }
    };
}