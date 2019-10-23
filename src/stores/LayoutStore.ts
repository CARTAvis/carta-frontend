import {observable, computed, action} from "mobx";
import {AppStore, AlertStore, WidgetConfig} from "stores";
import * as GoldenLayout from "golden-layout";
import * as Ajv from "ajv";
import {LayoutSchema, PresetLayout} from "models";
import {AppToaster} from "components/Shared";
import {smoothStepOffset} from "utilities";

const KEY = "savedLayouts";
const MAX_LAYOUT = 10;
const COMPONENT_CONFIG = new Map<string, any>([
    ["image-view", {
        type: "react-component",
        component: "image-view",
        title: "No image loaded",
        height: smoothStepOffset(window.innerHeight, 720, 1080, 65, 75), // image view fraction: adjust layout properties based on window dimensions
        id: "image-view",
        isClosable: false
    }],
    ["render-config", {
        type: "react-component",
        component: "render-config",
        title: "Render Configuration",
        id: "render-config"
    }],
    ["region-list", {
        type: "react-component",
        component: "region-list",
        title: "Region List",
        id: "region-list"
    }],
    ["animator", {
        type: "react-component",
        component: "animator",
        title: "Animator",
        id: "animator"
    }],
    ["spatial-profiler", {
        type: "react-component",
        component: "spatial-profiler",
        id: "spatial-profiler"
    }],
    ["spectral-profiler", {
        type: "react-component",
        component: "spectral-profiler",
        id: "spectral-profiler",
        title: "Z Profile: Cursor"
    }],
    ["stokes", {
        type: "react-component",
        component: "stokes",
        id: "stokes",
        title: "Stokes Analysis"
    }],
    ["histogram", {
        type: "react-component",
        component: "histogram",
        title: "Histogram",
        id: "histogram"
    }],
    ["stats", {
        type: "react-component",
        component: "stats",
        title: "Statistics",
        id: "stats"
    }],
    ["log", {
        type: "react-component",
        component: "log",
        title: "Log",
        id: "log"
    }]
]);

const PRESET_CONFIGS = new Map<string, any>([
    [PresetLayout.DEFAULT, {
        leftBottomContent: {
            type: "stack",
            content: [{type: "component", id: "render-config"}]
        },
        rightColumnContent: [{type: "component", id: "spatial-profiler", coord: "x"}, {type: "component", id: "spatial-profiler", coord: "y"}, {
            type: "stack",
            content: [{type: "component", id: "animator"}, {type: "component", id: "region-list"}]
        }]
    }],
    [PresetLayout.CUBEVIEW, {
        leftBottomContent: {
            type: "stack",
            content: [{type: "component", id: "animator"}, {type: "component", id: "render-config"}, {type: "component", id: "region-list"}]
        },
        rightColumnContent: [{type: "component", id: "spatial-profiler", coord: "x"}, {type: "component", id: "spatial-profiler", coord: "y"}, {type: "component", id: "spectral-profiler"}]
    }],
    [PresetLayout.CUBEANALYSIS, {
        leftBottomContent: {
            type: "stack",
            content: [{type: "component", id: "animator"}, {type: "component", id: "render-config"}, {type: "component", id: "region-list"}]
        },
        rightColumnContent: [{type: "component", id: "spectral-profiler"}, {type: "component", id: "stats"}]
    }],
    [PresetLayout.CONTINUUMANALYSIS, {
        leftBottomContent: {
            type: "stack",
            content: [{type: "component", id: "render-config"}, {type: "component", id: "region-list"}, {type: "component", id: "animator"}]
        },
        rightColumnContent: [{type: "component", id: "spatial-profiler", coord: "x"}, {type: "component", id: "spatial-profiler", coord: "y"}, {type: "component", id: "stats"}]
    }]
]);

export class LayoutStore {
    public static readonly TOASTER_TIMEOUT = 1500;

    private readonly appStore: AppStore;
    private alertStore: AlertStore;
    private layoutNameToBeSaved: string;
    private serverSupport: boolean;

    // self-defined structure: {layoutName: config, layoutName: config, ...}
    @observable dockedLayout: GoldenLayout;
    @observable currentLayoutName: string;
    @observable private layouts: any;

    constructor(appStore: AppStore, alertStore: AlertStore) {
        this.appStore = appStore;
        this.alertStore = alertStore;
        this.dockedLayout = null;
        this.layouts = {};
        this.initLayoutsFromPresets();
    }

    public layoutExist = (layoutName: string): boolean => {
        return layoutName && this.allLayouts.includes(layoutName);
    };

    public setLayoutToBeSaved = (layoutName: string) => {
        this.layoutNameToBeSaved = layoutName ? layoutName : "Empty";
    };

    public initUserDefinedLayouts = (layouts: { [k: string]: string; }, serverSupport: boolean) => {
        this.serverSupport = serverSupport;
        if (serverSupport) {
            this.initLayoutsFromServer(layouts);
        } else {
            this.initLayoutsFromLocalStorage();
        }
    };

    private validateUserLayouts = (userLayouts) => {
        if (userLayouts) {
            const jsonValidator = new Ajv();
            Object.keys(userLayouts).forEach((layoutName) => {
                // skip user layouts which have the same name as presets & those dont have correct key 'layoutVersion' as integer
                if (!PresetLayout.isValid(layoutName) &&
                    "layoutVersion" in userLayouts[layoutName] &&
                    typeof userLayouts[layoutName].layoutVersion === "number" &&
                    LayoutSchema.isLayoutVersionValid(userLayouts[layoutName].layoutVersion)
                ) {
                    const version = userLayouts[layoutName].layoutVersion;
                    if (jsonValidator.validate(LayoutSchema.LAYOUT_SCHEMAS[version], userLayouts[layoutName])) {
                        this.layouts[layoutName] = userLayouts[layoutName];
                    }
                }
            });
        }
    };

    private initLayoutsFromPresets = () => {
        PresetLayout.PRESETS.forEach((presetName) => {
            const config = PRESET_CONFIGS.get(presetName);
            this.layouts[presetName] = {
                layoutVersion: LayoutSchema.CURRENT_LAYOUT_SCHEMA_VERSION,
                docked: {
                    type: "row",
                    content: [{
                        type: "column",
                        width: 60,
                        content: [{type: "component", id: "image-view"}, config.leftBottomContent]
                    }, {
                        type: "column",
                        content: config.rightColumnContent
                    }]
                },
                floating: []
            };
        });
    };

    private initLayoutsFromServer = (userLayouts: { [k: string]: string; }) => {
        this.validateUserLayouts(userLayouts);
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
                if (!PresetLayout.isValid(layoutName)) { userLayouts[layoutName] = this.layouts[layoutName]; }
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
                    const trimmed = (child.id).replace(/\-\d+$/, "");
                    let simpleChild = {
                        type: child.type,
                        id: trimmed
                    };
                    if (trimmed === "spatial-profiler") {
                        // TODO: use better way to reveal coord property in config
                        simpleChild["coord"] = child.title && child.title.indexOf("Y") >= 0 ? "y" : "x";
                    }
                    if (child.width) {
                        simpleChild["width"] = child.width;
                    }
                    if (child.height) {
                        simpleChild["height"] = child.height;
                    }
                    newParentContent.push(simpleChild);
                }
            }
        });
    };

    private fillComponents = (newParentContent, parentContent, componentConfigs: any[]) => {
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
                        this.fillComponents(simpleChild.content, child.content, componentConfigs);
                    }
                } else if (child.type === "component" && child.id) {
                    const trimmed = (child.id).replace(/\-\d+$/, "");
                    if (COMPONENT_CONFIG.has(trimmed)) {
                        let componentConfig = Object.assign({}, COMPONENT_CONFIG.get(trimmed));
                        if (trimmed === "spatial-profiler") {
                            componentConfig["coord"] = child.coord ? child.coord : "x";
                        }
                        if (child.width) {
                            componentConfig["width"] = child.width;
                        }
                        if (child.height) {
                            componentConfig["height"] = child.height;
                        }
                        componentConfig.props = {appStore: this.appStore, id: "", docked: true};
                        componentConfigs.push(componentConfig);
                        newParentContent.push(componentConfig);
                    }
                }
            }
        });
    };

    @computed get allLayouts(): string[] {
        return this.layouts ? Object.keys(this.layouts) : [];
    }

    @computed get userLayouts(): string[] {
        return this.layouts ? Object.keys(this.layouts).filter((layoutName) => !PresetLayout.isValid(layoutName)) : [];
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
        this.fillComponents(dockedConfig.content, config.docked.content, dockedComponentConfigs);

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

        if (PresetLayout.isValid(this.layoutNameToBeSaved)) {
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
            if (config.type === "spatial-profiler") {
                floatingConfig["coord"] = config.title && config.title.indexOf("Y") >= 0 ? "y" : "x";
            }
            simpleConfig.floating.push(floatingConfig);
        });

        // save layout to layouts[] & local storage
        this.layouts[this.layoutNameToBeSaved] = simpleConfig;
        if (!this.saveLayoutToLocalStorage()) {
            delete this.layouts[this.layoutNameToBeSaved];
            return;
        }

        this.currentLayoutName = this.layoutNameToBeSaved;
        AppToaster.show({icon: "layout-grid", message: `Layout ${this.layoutNameToBeSaved} saved successfully.`, intent: "success", timeout: LayoutStore.TOASTER_TIMEOUT});
    };

    @action deleteLayout = (layoutName: string) => {
        if (!layoutName || !this.layoutExist(layoutName)) {
            this.alertStore.showAlert(`Cannot delete layout ${layoutName}! It does not exist.`);
            return;
        }

        delete this.layouts[layoutName];
        if (!this.saveLayoutToLocalStorage()) {
            return;
        }

        if (layoutName === this.currentLayoutName) {
            this.currentLayoutName = "";
        }
        AppToaster.show({icon: "layout-grid", message: `Layout ${layoutName} deleted successfully.`, intent: "success", timeout: LayoutStore.TOASTER_TIMEOUT});
    };
}
