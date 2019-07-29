import {observable, computed, action} from "mobx";
import {AppStore, AlertStore} from "stores";
import * as GoldenLayout from "golden-layout";
import {PresetLayout} from "models";
import {LayoutToaster} from "components/Shared";
import {smoothStepOffset} from "utilities";

const KEY = "CARTA_saved_layouts";
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
    ["render-config-0", {
        type: "react-component",
        component: "render-config",
        title: "Render Configuration",
        id: "render-config-0"
    }],
    ["region-list-0", {
        type: "react-component",
        component: "region-list",
        title: "Region List",
        id: "region-list-0"
    }],
    ["animator-0", {
        type: "react-component",
        component: "animator",
        title: "Animator",
        id: "animator-0"
    }],
    ["spatial-profiler-0", {
        type: "react-component",
        component: "spatial-profiler",
        id: "spatial-profiler-0"
    }],
    ["spatial-profiler-1", {
        type: "react-component",
        component: "spatial-profiler",
        id: "spatial-profiler-1"
    }],
    ["spectral-profiler-0", {
        type: "react-component",
        component: "spectral-profiler",
        id: "spectral-profiler-0",
        title: "Z Profile: Cursor"
    }],
    ["stats-0", {
        type: "react-component",
        component: "stats",
        title: "Statistics",
        id: "stats-0"
    }]
]);

const PRESET_CONFIGS = new Map<string, any>([
    [PresetLayout.DEFAULT, {
        leftBottomContent: {
            type: "stack",
            content: [{type: "component", id: "render-config-0"}]
        },
        rightColumnContent: [{type: "component", id: "spatial-profiler-0"}, {type: "component", id: "spatial-profiler-1"}, {
            type: "stack",
            content: [{type: "component", id: "animator-0"}, {type: "component", id: "region-list-0"}]
        }]
    }],
    [PresetLayout.CUBEVIEW, {
        leftBottomContent: {
            type: "stack",
            content: [{type: "component", id: "animator-0"}, {type: "component", id: "render-config-0"}, {type: "component", id: "region-list-0"}]
        },
        rightColumnContent: [{type: "component", id: "spatial-profiler-0"}, {type: "component", id: "spatial-profiler-1"}, {type: "component", id: "spectral-profiler-0"}]
    }],
    [PresetLayout.CUBEANALYSIS, {
        leftBottomContent: {
            type: "stack",
            content: [{type: "component", id: "animator-0"}, {type: "component", id: "render-config-0"}, {type: "component", id: "region-list-0"}]
        },
        rightColumnContent: [{type: "component", id: "spectral-profiler-0"}, {type: "component", id: "stats-0"}]
    }],
    [PresetLayout.CONTINUUMANALYSIS, {
        leftBottomContent: {
            type: "stack",
            content: [{type: "component", id: "render-config-0"}, {type: "component", id: "region-list-0"}, {type: "component", id: "animator-0"}]
        },
        rightColumnContent: [{type: "component", id: "spatial-profiler-0"}, {type: "component", id: "spatial-profiler-1"}, {type: "component", id: "stats-0"}]
    }]
]);

export class LayoutStore {
    public static TOASTER_TIMEOUT = 1500;

    private readonly appStore: AppStore;
    private alertStore: AlertStore;
    private layoutNameToBeSaved: string;

    // self-defined structure: {layoutName: config, layoutName: config, ...}
    @observable dockedLayout: GoldenLayout;
    @observable dockedLayoutName: string;
    @observable private layouts: any;

    constructor(appStore: AppStore, alertStore: AlertStore) {
        this.appStore = appStore;
        this.alertStore = alertStore;
        this.dockedLayout = null;
        this.layouts = {};
        this.initLayouts();
    }

    public layoutExist = (layoutName: string): boolean => {
        return layoutName && this.allLayouts.includes(layoutName);
    };

    public setLayoutToBeSaved = (layoutName: string) => {
        this.layoutNameToBeSaved = layoutName ? layoutName : "Empty";
    };

    private initLayouts = () => {
        // 1. fill layout with presets
        PresetLayout.PRESETS.forEach((presetName) => {
            const config = PRESET_CONFIGS.get(presetName);
            this.layouts[presetName] = {
                type: "row",
                content: [{
                    type: "column",
                    width: 60,
                    content: [{type: "component", id: "image-view"}, config.leftBottomContent]
                }, {
                    type: "column",
                    content: config.rightColumnContent
                }]
            };
        });

        // 2. add user layouts stored in local storage
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

        if (userLayouts) {
            // skip user layouts which have the same name as presets
            Object.keys(userLayouts).forEach((userLayout) => {
                if (!PresetLayout.isValid(userLayout)) { this.layouts[userLayout] = userLayouts[userLayout]; }
            });
        }
    };

    private saveLayoutToLocalStorage = (): boolean => {
        if (this.userLayouts && this.userLayouts.length > 0) {
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
        if (!newParentContent || !parentContent) {
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
                    this.genSimpleConfig(simpleChild.content, child.content);
                } else if (child.type === "component") {
                    let simpleChild = {
                        type: child.type,
                        id: child.id
                    };
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

    private fillComponents = (newParentContent, parentContent) => {
        if (!newParentContent || !parentContent) {
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
                    this.fillComponents(simpleChild.content, child.content);
                } else if (child.type === "component" && COMPONENT_CONFIG.has(child.id)) {
                    let componentConfig = COMPONENT_CONFIG.get(child.id);
                    if (child.width) {
                        componentConfig["width"] = child.width;
                    }
                    if (child.height) {
                        componentConfig["height"] = child.height;
                    }
                    componentConfig.props = {appStore: this.appStore, id: child.id, docked: true};
                    newParentContent.push(componentConfig);
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

    @computed get savedUserLayoutNumber(): number {
        return this.userLayouts.length;
    }

    @action applyLayout = (layoutName: string) => {
        if (!layoutName || !this.layoutExist(layoutName)) {
            this.alertStore.showAlert(`Applying layout failed! Layout ${layoutName} not found.`);
            return;
        }

        const config = this.layouts[layoutName];
        if (!config || !config.type || !config.content) {
            this.alertStore.showAlert(`Applying layout failed! Something is wrong with layout ${layoutName}.`);
            return;
        }

        let arrangementConfig = {
            type: config.type,
            content: []
        };
        this.fillComponents(arrangementConfig.content, config.content);

        const mainLayoutConfig = {
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
            content: [arrangementConfig]
        };

        // destroy old layout & init new layout
        if (this.dockedLayout) {
            this.dockedLayout.destroy();
        }
        this.dockedLayout = new GoldenLayout(mainLayoutConfig, this.appStore.getImageViewContainer());
        this.dockedLayoutName = layoutName;
        this.appStore.widgetsStore.initLayoutWithWidgets(this.dockedLayout);
        this.dockedLayout.init();
    };

    @action saveLayout = () => {
        if (!this.layouts || !this.layoutNameToBeSaved) {
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

        if (!this.dockedLayout || !this.dockedLayout.config || !this.dockedLayout.config.content || this.dockedLayout.config.content.length <= 0) {
            this.alertStore.showAlert("Saving layout failed! Something is wrong with current layout.");
            return;
        }

        const currentConfig = this.dockedLayout.config.content[0];
        if (!currentConfig || !currentConfig.type || !currentConfig.content) {
            this.alertStore.showAlert("Saving layout failed! Something is wrong with current layout.");
            return;
        }

        // generate simple config from current layout
        let simpleConfig = {
            type: currentConfig.type,
            content: []
        };
        this.genSimpleConfig(simpleConfig.content, currentConfig.content);
        this.layouts[this.layoutNameToBeSaved] = simpleConfig;

        if (!this.saveLayoutToLocalStorage()) {
            delete this.layouts[this.layoutNameToBeSaved];
            return;
        }

        LayoutToaster.show({icon: "layout-grid", message: `Layout ${this.layoutNameToBeSaved} is saved successfully.`, intent: "success", timeout: LayoutStore.TOASTER_TIMEOUT});
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

        LayoutToaster.show({icon: "layout-grid", message: `Layout ${layoutName} is deleted successfully.`, intent: "success", timeout: LayoutStore.TOASTER_TIMEOUT});
    };
}
