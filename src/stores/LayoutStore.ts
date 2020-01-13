import {observable, computed, action} from "mobx";
import {AppStore, AlertStore, WidgetConfig} from "stores";
import * as GoldenLayout from "golden-layout";
import {LayoutSchema, PresetLayout} from "models";
import {AppToaster} from "components/Shared";

const KEY = "savedLayouts";
const MAX_LAYOUT = 10;

export class LayoutStore {
    public static readonly TOASTER_TIMEOUT = 1500;

    private readonly appStore: AppStore;
    private alertStore: AlertStore;
    private layoutNameToBeSaved: string;

    // self-defined structure: {layoutName: config, layoutName: config, ...}
    @observable dockedLayout: GoldenLayout;
    @observable currentLayoutName: string;
    @observable private layouts: any;
    @observable supportsServer: boolean;

    constructor(appStore: AppStore, alertStore: AlertStore) {
        this.appStore = appStore;
        this.alertStore = alertStore;
        this.dockedLayout = null;
        this.layouts = {};
        this.supportsServer = false;
        this.initLayoutsFromPresets();
    }

    public layoutExist = (layoutName: string): boolean => {
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

    private validateUserLayouts = (userLayouts) => {
        if (!userLayouts) {
            return;
        }
        const layoutNames = Object.keys(userLayouts);
        layoutNames.forEach((layoutName) => {
            const layoutConfig = userLayouts[layoutName];
            if (layoutConfig && LayoutSchema.IsUserLayoutValid(layoutName, layoutConfig)) {
                this.layouts[layoutName] = layoutConfig;
            }
        });
    };

    private initLayoutsFromPresets = () => {
        PresetLayout.PRESETS.forEach((presetName) => {
            const presetConfig = LayoutSchema.GetPresetConfig(presetName);
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
                this.alertStore.showAlert(`Loading user-defined layout ${layoutName} failed!`);
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
                this.alertStore.showAlert("Loading user-defined layout failed!");
                userLayouts = null;
            }
        }
        this.validateUserLayouts(userLayouts);
    };

    private saveLayoutToLocalStorage = (): boolean => {
        if (this.userLayouts) {
            // save only user layouts to local storage, excluding presets
            let userLayouts = {};
            this.userLayouts.forEach((layoutName) => {
                if (!PresetLayout.isPreset(layoutName)) {
                    userLayouts[layoutName] = this.layouts[layoutName];
                }
            });

            try {
                const serializedJson = JSON.stringify(userLayouts);
                localStorage.setItem(KEY, serializedJson);
            } catch (e) {
                this.alertStore.showAlert("Saving user-defined layout failed! " + e.message);
                return false;
            }
        }

        return true;
    };

    private genSimpleConfig = (newParentContent, parentContent): void => {
        if (!newParentContent || !Array.isArray(newParentContent) || !parentContent || !Array.isArray(parentContent)) {
            return;
        }

        parentContent.forEach((child) => {
            if (child.type) {
                if (child.type === "stack" || child.type === "row" || child.type === "column") {
                    let simpleChild = {
                        type: child.type,
                        content: []
                    };
                    if (child.width) {
                        simpleChild["width"] = child.width;
                    }
                    if (child.height) {
                        simpleChild["height"] = child.height;
                    }
                    newParentContent.push(simpleChild);
                    if (child.content) {
                        this.genSimpleConfig(simpleChild.content, child.content);
                    }
                } else if (child.type === "component" && child.id) {
                    const widgetType = (child.id).replace(/\-\d+$/, "");
                    let simpleChild = {
                        type: child.type,
                        id: widgetType
                    };
                    if (child.width) {
                        simpleChild["width"] = child.width;
                    }
                    if (child.height) {
                        simpleChild["height"] = child.height;
                    }
                    // add widget settings
                    const widgetSettingsConfig = this.appStore.widgetsStore.toWidgetSettingsConfig(widgetType, child.id);
                    if (widgetSettingsConfig) {
                        simpleChild["widgetSettings"] = widgetSettingsConfig;
                    }
                    newParentContent.push(simpleChild);
                }
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
        let oderedLayouts = [...PresetLayout.PRESETS];
        return this.userLayouts && this.userLayouts.length > 0 ? oderedLayouts.concat(this.userLayouts) : oderedLayouts;
    }

    @computed get savedUserLayoutNumber(): number {
        return this.userLayouts.length;
    }

    @action applyLayout = (layoutName: string): boolean => {
        if (!layoutName || !this.layoutExist(layoutName)) {
            this.alertStore.showAlert(`Applying layout failed! Layout ${layoutName} not found.`);
            return false;
        }

        const config = this.layouts[layoutName];

        // destroy old layout & clear floating widgets
        if (this.dockedLayout) {
            this.appStore.widgetsStore.removeFloatingWidgets();
            this.dockedLayout.destroy();
        }

        // generate docked config & collect docked components
        let dockedConfig = {
            type: config.docked.type,
            content: []
        };
        let dockedComponentConfigs = [];
        LayoutSchema.fillComponents(this.appStore, dockedConfig.content, config.docked.content, dockedComponentConfigs);

        // use component configs to init widget stores, IDs in componentConfigs will be updated
        this.appStore.widgetsStore.initWidgets(dockedComponentConfigs, config.floating);

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
        }, this.appStore.getAppContainer());
        this.appStore.widgetsStore.initLayoutWithWidgets(this.dockedLayout);
        this.dockedLayout.init();
        this.currentLayoutName = layoutName;

        return true;
    };

    @action saveLayout = () => {
        if (!this.layouts || !this.layoutNameToBeSaved || !this.dockedLayout) {
            this.alertStore.showAlert("Save layout failed! Empty layouts or name.");
            return;
        }

        if (PresetLayout.isPreset(this.layoutNameToBeSaved)) {
            this.alertStore.showAlert("Layout name cannot be the same as system presets.");
            return;
        }

        if (!this.layoutExist(this.layoutNameToBeSaved) && this.savedUserLayoutNumber >= MAX_LAYOUT) {
            this.alertStore.showAlert(`Maximum user-defined layout quota exceeded! (${MAX_LAYOUT} layouts)`);
            return;
        }

        const currentConfig = this.dockedLayout.toConfig();
        if (!currentConfig || !currentConfig.content || currentConfig.content.length <= 0 || !currentConfig.content[0].type || !currentConfig.content[0].content) {
            this.alertStore.showAlert("Saving layout failed! Something is wrong with current layout.");
            return;
        }

        // 1. generate simple config from current docked widgets
        const rootConfig = currentConfig.content[0];
        let simpleConfig = {
            layoutVersion: LayoutSchema.CURRENT_LAYOUT_SCHEMA_VERSION,
            docked: {
                type: rootConfig.type,
                content: []
            },
            floating: []
        };
        this.genSimpleConfig(simpleConfig.docked.content, rootConfig.content);

        // 2. handle floating widgets
        this.appStore.widgetsStore.floatingWidgets.forEach((config: WidgetConfig) => {
            let floatingConfig = {
                type: config.type,
                defaultWidth: config.defaultWidth ? config.defaultWidth : "",
                defaultHeight: config.defaultHeight ? config.defaultHeight : "",
                defaultX: config.defaultX ? config.defaultX : "",
                defaultY: config.defaultY ? config.defaultY : ""
            };
            // add widget settings
            const widgetSettingsConfig = this.appStore.widgetsStore.toWidgetSettingsConfig(config.type, config.id);
            if (widgetSettingsConfig) {
                floatingConfig["widgetSettings"] = widgetSettingsConfig;
            }
            simpleConfig.floating.push(floatingConfig);
        });

        // save layout to layouts[] & server/local storage
        this.layouts[this.layoutNameToBeSaved] = simpleConfig;
        if (this.supportsServer) {
            this.appStore.backendService.setUserLayout(this.layoutNameToBeSaved, JSON.stringify(simpleConfig)).subscribe(() => {
                this.handleSaveResult(true);
            }, err => {
                console.log(err);
                this.handleSaveResult(false);
            });
        } else {
            this.handleSaveResult(this.saveLayoutToLocalStorage());
        }
    };

    private handleSaveResult = (success: boolean) => {
        if (success) {
            AppToaster.show({icon: "layout-grid", message: `Layout ${this.layoutNameToBeSaved} saved successfully.`, intent: "success", timeout: LayoutStore.TOASTER_TIMEOUT});
            this.currentLayoutName = this.layoutNameToBeSaved;
        } else {
            delete this.layouts[this.layoutNameToBeSaved];
            this.alertStore.showAlert("Saving user-defined layout failed! ");
        }
    };

    @action deleteLayout = (layoutName: string) => {
        if (!layoutName || !this.layoutExist(layoutName)) {
            this.alertStore.showAlert(`Cannot delete layout ${layoutName}! It does not exist.`);
            return;
        }

        delete this.layouts[layoutName];

        if (this.supportsServer) {
            this.appStore.backendService.setUserLayout(layoutName, "").subscribe(() => {
                this.handleDeleteResult(layoutName, true);
            }, err => {
                console.log(err);
                this.handleDeleteResult(layoutName, false);
            });
        } else {
            this.handleDeleteResult(layoutName, this.saveLayoutToLocalStorage());
        }

        if (layoutName === this.currentLayoutName) {
            this.currentLayoutName = "";
        }
    };

    private handleDeleteResult = (layoutName: string, success: boolean) => {
        if (success) {
            AppToaster.show({icon: "layout-grid", message: `Layout ${layoutName} deleted successfully.`, intent: "success", timeout: LayoutStore.TOASTER_TIMEOUT});
            if (layoutName === this.currentLayoutName) {
                this.currentLayoutName = "";
            }
        } else {
            this.alertStore.showAlert("Saving user-defined layout failed! ");
        }
    };
}
