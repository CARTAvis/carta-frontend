// import * as GoldenLayout from "golden-layout"; // Commented out during FlexLayout migration
import {action, computed, flow, makeObservable, observable} from "mobx";

import {AppToaster, SuccessToast} from "components/Shared";
import {LayoutDialogMode} from "enums";
import {LayoutConfig, PresetLayout} from "models";
import {ApiService} from "services";
import {AlertStore, AppStore} from "stores";

const MAX_LAYOUT = 10;

export class LayoutStore {
    private static staticInstance: LayoutStore;

    static get Instance() {
        if (!LayoutStore.staticInstance) {
            LayoutStore.staticInstance = new LayoutStore();
        }
        return LayoutStore.staticInstance;
    }

    public static readonly ToasterTimeout = 1500;
    private layoutNameToBeSaved: string;

    // self-defined structure: {layoutName: config, layoutName: config, ...}
    @observable currentLayoutName: string;
    @observable private layouts: any = {};
    @observable supportsServer: boolean = false;
    @observable layoutDialogMode: LayoutDialogMode | undefined = LayoutDialogMode.Layout;

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
            console.log(err);
        }
    }

    private initLayoutsFromPresets = () => {
        PresetLayout.PRESETS.forEach(presetName => {
            const presetConfig = LayoutConfig.GetPresetConfig(presetName);
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

    @action applyLayout = (layoutName: string): boolean => {
        // Stubbed during FlexLayout migration - functionality moved to FlexLayoutStore
        console.log(`LayoutStore.applyLayout called with ${layoutName} - redirecting to FlexLayoutStore`);
        return false;
    };

    @flow.bound *saveLayout() {
        // Stubbed during FlexLayout migration - functionality moved to FlexLayoutStore
        console.log("LayoutStore.saveLayout called - redirecting to FlexLayoutStore");
        const appStore = AppStore.Instance;
        appStore.alertStore.showAlert("Save layout functionality temporarily disabled during FlexLayout migration");
        return;
    }

    private handleSaveResult = (success: boolean) => {
        if (success) {
            AppToaster.show(SuccessToast("layout-grid", `Layout ${this.layoutNameToBeSaved} saved successfully.`, LayoutStore.ToasterTimeout));
            this.currentLayoutName = this.layoutNameToBeSaved;
        } else {
            delete this.layouts[this.layoutNameToBeSaved];
            AlertStore.Instance.showAlert("Saving user-defined layout failed! ");
        }
    };

    @flow.bound *renameLayout(oldName: string, newName: string) {
        // Stubbed during FlexLayout migration - functionality moved to FlexLayoutStore  
        console.log(`LayoutStore.renameLayout called with ${oldName} -> ${newName} - redirecting to FlexLayoutStore`);
        const appStore = AppStore.Instance;
        appStore.alertStore.showAlert("Rename layout functionality temporarily disabled during FlexLayout migration");
        return;
    }

    private handleRenameResult = (oldName: string, newName: string, success: boolean) => {
        if (success) {
            AppToaster.show(SuccessToast("layout-grid", `Layout ${oldName} renamed to ${newName} successfully.`, LayoutStore.ToasterTimeout));
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
            AppToaster.show(SuccessToast("layout-grid", `Layout ${layoutName} deleted successfully.`, LayoutStore.ToasterTimeout));
            if (layoutName === this.currentLayoutName) {
                this.currentLayoutName = "";
            }
        } else {
            AlertStore.Instance.showAlert("Deleting user-defined layout failed!");
        }
    };
}
