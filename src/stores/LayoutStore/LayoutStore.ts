import * as GoldenLayout from "golden-layout";
import {action, computed, flow, makeObservable, observable} from "mobx";

import {AppToaster, SuccessToast} from "components/Shared";
import {LayoutConfig, PresetLayout} from "models";
import {AlertStore, AppStore} from "stores";

import {ApiService} from "../../services";

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
    @observable dockedLayout: GoldenLayout;
    @observable currentLayoutName: string;
    @observable private layouts: any;
    @observable supportsServer: boolean;

    private constructor() {
        makeObservable<LayoutStore, "layouts">(this);
        this.dockedLayout = null;
        this.layouts = {};
        this.supportsServer = false;
        this.initLayoutsFromPresets();
    }

    public layoutExists = (layoutName: string): boolean => {
        return layoutName && this.allLayoutNames.includes(layoutName);
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
        let orderedLayouts = [...PresetLayout.PRESETS];
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
        // destroy old layout & clear floating widgets
        if (this.dockedLayout) {
            appStore.widgetsStore.removeFloatingWidgets();
            this.dockedLayout.destroy();
        }

        // generate docked config & collect docked components
        let dockedConfig = {
            type: config.docked.type,
            content: []
        };
        let dockedComponentConfigs = [];
        LayoutConfig.CreateConfigToApply(dockedConfig.content, config.docked.content, dockedComponentConfigs);
        // use component configs to init widget stores, IDs in componentConfigs will be updated
        appStore.widgetsStore.initWidgets(dockedComponentConfigs, config.floating);
        // generate new layout config & apply
        // Does this work?
        // @ts-ignore
        this.dockedLayout = new GoldenLayout(
            {
                settings: {
                    showPopoutIcon: false,
                    showCloseIcon: false
                },
                dimensions: {
                    minItemWidth: 250,
                    minItemHeight: 200,
                    dragProxyWidth: 600,
                    dragProxyHeight: 270
                },
                content: [dockedConfig]
            },
            appStore.getAppContainer()
        );
        appStore.widgetsStore.initLayoutWithWidgets(this.dockedLayout);
        this.dockedLayout.init();
        this.currentLayoutName = layoutName;

        return true;
    };

    @flow.bound *saveLayout() {
        const appStore = AppStore.Instance;
        if (!this.layouts || !this.layoutNameToBeSaved || !this.dockedLayout) {
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

        const currentConfig = this.dockedLayout.toConfig();
        if (!currentConfig || !currentConfig.content || currentConfig.content.length <= 0) {
            appStore.alertStore.showAlert("Saving layout failed! Something is wrong with current layout.");
            return;
        }

        const configToSave = LayoutConfig.CreateConfigToSave(appStore, currentConfig.content[0]);
        if (!configToSave) {
            appStore.alertStore.showAlert("Saving layout failed! Creat layout configuration for saving failed.");
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
                console.log(err);
                this.handleSaveResult(false);
            }
        }
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

    @action deleteLayout = (layoutName: string) => {
        const appStore = AppStore.Instance;
        if (!layoutName || !this.layoutExists(layoutName)) {
            appStore.alertStore.showAlert(`Cannot delete layout ${layoutName}! It does not exist.`);
            return;
        }

        appStore.apiService.clearLayout(layoutName).then(
            success => {
                if (success) {
                    delete this.layouts[layoutName];
                    if (layoutName === this.currentLayoutName) {
                        this.currentLayoutName = "";
                    }
                }
                this.handleDeleteResult(layoutName, success);
            },
            err => {
                console.log(err);
                this.handleDeleteResult(layoutName, false);
            }
        );
    };

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
