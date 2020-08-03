import {observable, computed, action} from "mobx";
import {AppStore, AlertStore} from "stores";
import * as GoldenLayout from "golden-layout";
import {LayoutConfig, PresetLayout} from "models";
import {AppToaster, SuccessToast} from "components/Shared";

const KEY = "savedLayouts";
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
        this.dockedLayout = null;
        this.layouts = {};
        this.supportsServer = false;
        this.initLayoutsFromPresets();
    }

    public layoutExists = (layoutName: string): boolean => {
        return layoutName && this.allLayouts.includes(layoutName);
    };

    public setLayoutToBeSaved = (layoutName: string) => {
        this.layoutNameToBeSaved = layoutName ? layoutName : "Empty";
    };

    public initUserDefinedLayouts = (supportsServer: boolean, layouts: { [k: string]: string; }) => {
        this.supportsServer = supportsServer;
        if (supportsServer) {
            this.initLayoutsFromServer(layouts);
        } else {
            this.initLayoutsFromLocalStorage();
        }
    };

    private initLayoutsFromPresets = () => {
        PresetLayout.PRESETS.forEach((presetName) => {
            const presetConfig = LayoutConfig.GetPresetConfig(presetName);
            if (presetConfig) {
                this.layouts[presetName] = presetConfig;
            }
        });
    };

    private initLayoutsFromServer = (userLayouts: { [k: string]: string; }) => {
        let parsedLayouts = {};
        Object.keys(userLayouts).forEach((layoutName) => {
            try {
                if (userLayouts[layoutName] !== "") {
                    parsedLayouts[layoutName] = JSON.parse(userLayouts[layoutName]);
                }
            } catch (e) {
                AlertStore.Instance.showAlert(`Loading user-defined layout ${layoutName} failed!`);
            }
        });
        this.validateUserLayouts(parsedLayouts);
    };

    private initLayoutsFromLocalStorage = () => {
        const layoutJson = localStorage.getItem(KEY);
        let userLayouts = null;
        if (layoutJson) {
            try {
                userLayouts = JSON.parse(layoutJson);
            } catch (e) {
                AlertStore.Instance.showAlert("Loading user-defined layout failed!");
                userLayouts = null;
            }
        }
        this.validateUserLayouts(userLayouts);
    };

    private validateUserLayouts = (userLayouts) => {
        if (!userLayouts) {
            return;
        }
        const layoutNames = Object.keys(userLayouts);
        layoutNames.forEach((layoutName) => {
            const layoutConfig = userLayouts[layoutName];
            try {
                if (layoutConfig && LayoutConfig.IsUserLayoutValid(layoutName, layoutConfig)) {
                    this.layouts[layoutName] = layoutConfig;
                }
            } catch (err) {
                console.log(err);
            }
        });
    };

    @computed get allLayouts(): string[] {
        return this.layouts ? Object.keys(this.layouts) : [];
    }

    @computed get userLayouts(): string[] {
        return this.layouts ? Object.keys(this.layouts).filter((layoutName) => !PresetLayout.isPreset(layoutName)) : [];
    }

    @computed get orderedLayouts(): string[] {
        let orderedLayouts = [...PresetLayout.PRESETS];
        return this.userLayouts?.length ? orderedLayouts.concat(this.userLayouts) : orderedLayouts;
    }

    @computed get savedUserLayoutNumber(): number {
        return this.userLayouts.length;
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
        this.dockedLayout = new GoldenLayout({
            settings: {
                showPopoutIcon: false,
                showCloseIcon: false
            },
            dimensions: {
                minItemWidth: 250,
                minItemHeight: 200,
                dragProxyWidth: 600,
                dragProxyHeight: 270,
            },
            content: [dockedConfig]
        }, appStore.getAppContainer());
        appStore.widgetsStore.initLayoutWithWidgets(this.dockedLayout);
        this.dockedLayout.init();
        this.currentLayoutName = layoutName;

        return true;
    };

    @action saveLayout = () => {
        const appStore = AppStore.Instance;
        if (!this.layouts || !this.layoutNameToBeSaved || !this.dockedLayout) {
            appStore.alertStore.showAlert("Save layout failed! Empty layouts or name.");
            return;
        }

        if (PresetLayout.isPreset(this.layoutNameToBeSaved)) {
            appStore.alertStore.showAlert("Layout name cannot be the same as system presets.");
            return;
        }

        if (!this.layoutExists(this.layoutNameToBeSaved) && this.savedUserLayoutNumber >= MAX_LAYOUT) {
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
            appStore.apiService.setLayout(this.layoutNameToBeSaved, configToSave).then(success => {
                this.handleSaveResult(success);
            }, err => {
                console.log(err);
                this.handleSaveResult(false);
            });
        }
    };

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

        delete this.layouts[layoutName];

        appStore.apiService.clearLayout(layoutName).then(success => {
            this.handleDeleteResult(layoutName, success);
        }, err => {
            console.log(err);
            this.handleDeleteResult(layoutName, false);
        });

        if (layoutName === this.currentLayoutName) {
            this.currentLayoutName = "";
        }
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
