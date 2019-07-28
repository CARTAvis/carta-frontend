import {observable, computed, action} from "mobx";
import {AppStore} from "stores";
import * as GoldenLayout from "golden-layout";
import {Layout} from "models";
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

export class LayoutStore {
    public static TOASTER_TIMEOUT = 1500;

    private readonly appStore: AppStore;
    private layoutToBeSaved: string;

    // self-defined structure: {layoutName: config, layoutName: config, ...}
    @observable private layouts;

    constructor(appStore: AppStore) {
        this.appStore = appStore;
        this.layouts = {};

        // read layout configs from local storage
        const layoutJson = localStorage.getItem(KEY);
        if (layoutJson) {
            try {
                this.layouts = JSON.parse(layoutJson);
            } catch (e) {
                this.appStore.alertStore.showAlert("Loading user-defined layout failed!");
                this.layouts = {};
            }
        }
    }

    public layoutExist = (layoutName: string): boolean => {
        return layoutName && this.userLayouts.includes(layoutName);
    };

    public setLayoutToBeSaved = (layoutName: string) => {
        this.layoutToBeSaved = layoutName ? layoutName : "Empty";
    };

    public applyPresetLayout = (layoutName: string) => {
        if (!layoutName || !Layout.isValid(layoutName)) {
            this.appStore.alertStore.showAlert(`Applying layout failed! Preset layout ${layoutName} not found.`);
            return;
        }

        let customizedLayout;
        switch (layoutName) {
            case Layout.CUBEVIEW:
                customizedLayout = {
                    leftBottomContent: {
                        type: "stack",
                        content: [{type: "component", id: "animator-0"}, {type: "component", id: "render-config-0"}, {type: "component", id: "region-list-0"}]
                    },
                    rightColumnContent: [{type: "component", id: "spatial-profiler-0"}, {type: "component", id: "spatial-profiler-1"}, {type: "component", id: "spectral-profiler-0"}]
                };
                break;
            case Layout.CUBEANALYSIS:
                customizedLayout = {
                    leftBottomContent: {
                        type: "stack",
                        content: [{type: "component", id: "animator-0"}, {type: "component", id: "render-config-0"}, {type: "component", id: "region-list-0"}]
                    },
                    rightColumnContent: [{type: "component", id: "spectral-profiler-0"}, {type: "component", id: "stats-0"}]
                };
                break;
            case Layout.CONTINUUMANALYSIS:
                customizedLayout = {
                    leftBottomContent: {
                        type: "stack",
                        content: [{type: "component", id: "render-config-0"}, {type: "component", id: "region-list-0"}, {type: "component", id: "animator-0"}]
                    },
                    rightColumnContent: [{type: "component", id: "spatial-profiler-0"}, {type: "component", id: "spatial-profiler-1"}, {type: "component", id: "stats-0"}]
                };
                break;
            case Layout.DEFAULT: default:
                customizedLayout = {
                    leftBottomContent: {
                        type: "stack",
                        content: [{type: "component", id: "render-config-0"}]
                    },
                    rightColumnContent: [{type: "component", id: "spatial-profiler-0"}, {type: "component", id: "spatial-profiler-1"}, {
                        type: "stack",
                        content: [{type: "component", id: "animator-0"}, {type: "component", id: "region-list-0"}]
                    }]
                };
                break;
        }

        const config = {
            type: "row",
            content: [{
                type: "column",
                width: 60,
                content: [{type: "component", id: "image-view"}, customizedLayout.leftBottomContent]
            }, {
                type: "column",
                content: customizedLayout.rightColumnContent
            }]
        };

        this.applyLayout(config);
    };

    public applyUserLayout = (layoutName: string) => {
        if (!layoutName || !this.layoutExist(layoutName)) {
            this.appStore.alertStore.showAlert(`Applying layout failed! User layout ${layoutName} not found.`);
            return;
        }

        this.applyLayout(this.layouts[layoutName]);
    };

    private saveLayoutToLocalStorage = (): boolean => {
        try {
            const serializedJson = JSON.stringify(this.layouts);
            localStorage.setItem(KEY, serializedJson);
        } catch (e) {
            this.appStore.alertStore.showAlert("Saving user-defined layout failed! " + e.message);
            return false;
        }

        return true;
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

    private fillComponents = (newParentContent, parentContent) => {
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
                this.fillComponents(simpleChild.content, child.content);
            } else if (child.type === "component" && COMPONENT_CONFIG.has(child.id)) {
                let componentConfig = COMPONENT_CONFIG.get(child.id);
                componentConfig.props = {appStore: this.appStore, id: child.id, docked: true};
                newParentContent.push(componentConfig);
            }
        });
    };

    private applyLayout = (config) => {
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

        this.appStore.widgetsStore.applyNewLayout(new GoldenLayout(mainLayoutConfig, this.appStore.getImageViewContainer()));
    };

    @computed get userLayouts(): string[] {
        return this.layouts ? Object.keys(this.layouts) : [];
    }

    @computed get savedLayoutNumber(): number {
        return this.userLayouts.length;
    }

    @action saveLayout = () => {
        if (!this.layouts || !this.layoutToBeSaved) {
            this.appStore.alertStore.showAlert("Save layout failed! Empty layouts or name.");
            return;
        }

        if (!this.layoutExist(this.layoutToBeSaved) && this.savedLayoutNumber >= MAX_LAYOUT) {
            this.appStore.alertStore.showAlert(`Maximum user-defined layout quota exceeded! (${MAX_LAYOUT} layouts)`);
            return;
        }

        const currentLayout = this.appStore.widgetsStore.dockedLayout;
        if (currentLayout && currentLayout.config && currentLayout.config.content && currentLayout.config.content.length > 0) {
            // generate simple config from current layout
            const currentConfig = currentLayout.config.content[0];
            let simpleConfig = {
                type: currentConfig.type,
                content: []
            };
            this.genSimpleConfig(simpleConfig.content, currentConfig.content);
            this.layouts[this.layoutToBeSaved] = simpleConfig;

            if (!this.saveLayoutToLocalStorage()) {
                delete this.layouts[this.layoutToBeSaved];
                return;
            }
        } else {
            this.appStore.alertStore.showAlert("Save current layout failed! There is something wrong with the layout.");
            return;
        }

        LayoutToaster.show({icon: "layout-grid", message: `Layout ${this.layoutToBeSaved} is saved successfully.`, intent: "success", timeout: LayoutStore.TOASTER_TIMEOUT});
    };

    @action deleteLayout = (layoutName: string) => {
        if (!layoutName || !this.layoutExist(layoutName)) {
            this.appStore.alertStore.showAlert(`Cannot delete layout ${layoutName}! It does not exist.`);
            return;
        }

        delete this.layouts[layoutName];
        if (!this.saveLayoutToLocalStorage()) {
            return;
        }

        LayoutToaster.show({icon: "layout-grid", message: `Layout ${layoutName} is deleted successfully.`, intent: "success", timeout: LayoutStore.TOASTER_TIMEOUT});
    };
}
