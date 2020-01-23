import * as Ajv from "ajv";
import {AppStore, WidgetConfig} from "stores";
import {PresetLayout} from "models";
import {smoothStepOffset} from "utilities";

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
    ["layer-list", {
        type: "react-component",
        component: "layer-list",
        title: "Layer List",
        id: "layer-list"
    }],
    ["log", {
        type: "react-component",
        component: "log",
        title: "Log",
        id: "log"
    }]
]);

const INITIAL_LAYOUT_SCHEMA_VERSION = 1;
const CURRENT_LAYOUT_SCHEMA_VERSION = 2;

const LAYOUT_SCHEMA = {
    "required": ["layoutVersion", "docked", "floating"],
    "properties": {
        "layoutVersion": {
            "type": "integer",
            "minimum": INITIAL_LAYOUT_SCHEMA_VERSION,
            "maximum": CURRENT_LAYOUT_SCHEMA_VERSION
        },
        "docked":  {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string"
                },
                "content": {
                    "type": "array",
                    "items": {
                        "type": "object"
                    }
                }
            }
        },
        "floating": {
            "type": "array",
            "items": {
                "type": "object"
            }
        }
    }
};

const DOCKED_SCHEMA = {
    "1": {
        "required": ["type"],
        "properties": {
            "type": {
                "type": "string",
                "pattern": "row|column|stack|component"
            },
            "id": {
                "type": "string",
                "pattern": "animator|histogram|image-view|log|region\-list|render\-config|spatial\-profiler|spectral\-profiler|stats|stokes"
            },
            "coord": {
                "type": "string",
                "pattern": "x|y"
            },
            "content": {
                "type": "array",
                "items": {
                    "type": "object"
                }
            },
            "width": {
                "type": "number"
            },
            "height": {
                "type": "number"
            }
        }
    },
    "2": {
        "required": ["type"],
        "properties": {
            "type": {
                "type": "string",
                "pattern": "row|column|stack|component"
            },
            "id": {
                "type": "string",
                "pattern": "animator|histogram|image-view|log|region\-list|render\-config|spatial\-profiler|spectral\-profiler|stats|stokes"
            },
            "widgetSettings": {
                "type": "object"
            },
            "content": {
                "type": "array",
                "items": {
                    "type": "object"
                }
            },
            "width": {
                "type": "number"
            },
            "height": {
                "type": "number"
            }
        }
    }
};

const FLOATING_WIDGET_SCHEMA = {
    "1": {
        "type": "object",
        "required": ["type", "defaultWidth", "defaultHeight", "defaultX", "defaultY"],
        "properties": {
            "type": {
                "type": "string",
                "pattern": "animator|histogram|log|region\-list|render\-config|spatial\-profiler|spectral\-profiler|stats|stokes"
            },
            "coord": {
                "type": "string",
                "pattern": "x|y"
            },
            "defaultWidth": {
                "type": "integer",
                "minimum": 1
            },
            "defaultHeight": {
                "type": "integer",
                "minimum": 1
            },
            "defaultX": {
                "type": "integer",
                "minimum": 1
            },
            "defaultY": {
                "type": "integer",
                "minimum": 1
            }
        }
    },
    "2": {
        "type": "object",
        "required": ["type", "defaultWidth", "defaultHeight", "defaultX", "defaultY"],
        "properties": {
            "type": {
                "type": "string",
                "pattern": "animator|histogram|log|region\-list|render\-config|spatial\-profiler|spectral\-profiler|stats|stokes"
            },
            "widgetSettings": {
                "type": "object"
            },
            "defaultWidth": {
                "type": "integer",
                "minimum": 1
            },
            "defaultHeight": {
                "type": "integer",
                "minimum": 1
            },
            "defaultX": {
                "type": "integer",
                "minimum": 1
            },
            "defaultY": {
                "type": "integer",
                "minimum": 1
            }
        }
    }
};

export class LayoutConfig {
    private static jsonValidator = new Ajv({removeAdditional: true});

    public static GetPresetConfig = (presetName: string) => {
        if (!presetName) {
            return null;
        }

        const config = PresetLayout.PRESET_CONFIGS.get(presetName);
        if (!config) {
            return null;
        }

        return {
            layoutVersion: CURRENT_LAYOUT_SCHEMA_VERSION,
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
    };

    // Note: layoutConfig is formalized(modified) during validation if valid
    public static IsUserLayoutValid = (layoutName: string, layoutConfig: any): boolean => {
        if (!layoutName || !layoutConfig ) {
            return false;
        }
        // exclude conflict with presets
        if (PresetLayout.isPreset(layoutName)) {
            return false;
        }
        // 1. validate initial structure
        if (false === LayoutConfig.jsonValidator.validate(LAYOUT_SCHEMA, layoutConfig)) {
            return false;
        }
        // 2. validate config details according to version
        const version = layoutConfig.layoutVersion;
        if (version === 1) {
            return LayoutConfig.LayoutHandlerV1(layoutConfig);
        } else {
            return LayoutConfig.LayoutHandlerV2(layoutConfig);
        }
    };

    private static LayoutHandlerV1 = (config: any): boolean => {
        if (!config) {
            return false;
        }

        // validate docked part & convert v1 to v2
        if (false === LayoutConfig.DockedValidatorV1(config.docked)) {
            return false;
        }

        // validate floating part & convert v1 to v2
        const floatingV1 = config.floating;
        let floatingV2 = [];
        floatingV1.forEach((widgetConfig) => {
            if (true === LayoutConfig.jsonValidator.validate(FLOATING_WIDGET_SCHEMA["1"], widgetConfig)) {
                if (widgetConfig.type === "spatial-profiler") {
                    widgetConfig["widgetSettings"] = widgetConfig.coord === "y" ? {coordinate: "y"} : {coordinate: "x"};
                    if (widgetConfig.coord) {
                        delete widgetConfig.coord;
                    }
                }
                floatingV2.push(widgetConfig);
            }
        });
        config.floating = floatingV2;
        config.layoutVersion = 2;

        return true;
    };

    private static DockedValidatorV1 = (dockedNode: any): boolean => {
        // validate self node
        if (false === LayoutConfig.jsonValidator.validate(DOCKED_SCHEMA["1"], dockedNode)) {
            return false;
        }

        // validate child node if not end node(type = component)
        if ("content" in dockedNode) {
            let result: boolean = true;
            dockedNode.content.forEach((child) => {
                result = result && LayoutConfig.DockedValidatorV1(child);
            });
            return result;
        }

        // validate end node - component
        if (dockedNode.type !== "component" || !dockedNode.id) {
            return false;
        }

        // convert v1 to v2
        if (dockedNode.id === "spatial-profiler") {
            dockedNode["widgetSettings"] = dockedNode.coord === "y" ? {coordinate: "y"} : {coordinate: "x"};
            if (dockedNode.coord) {
                delete dockedNode.coord;
            }
        }
        return true;
    };

    private static LayoutHandlerV2 = (config: any): boolean => {
        if (!config) {
            return false;
        }

        // validate docked part
        if (false === LayoutConfig.DockedValidatorV2(config.docked)) {
            return false;
        }

        // validate floating part & remove invalid widget config
        const floating = config.floating;
        let floatingValid = [];
        floating.forEach((widgetConfig) => {
            if (true === LayoutConfig.jsonValidator.validate(FLOATING_WIDGET_SCHEMA["2"], widgetConfig)) {
                floatingValid.push(widgetConfig);
            }
        });
        config.floating = floatingValid;
        return true;
    };

    private static DockedValidatorV2 = (dockedNode: any): boolean => {
        // validate self node
        if (false === LayoutConfig.jsonValidator.validate(DOCKED_SCHEMA["2"], dockedNode)) {
            return false;
        }

        // validate child node if not end node(type = component)
        if ("content" in dockedNode) {
            let result: boolean = true;
            dockedNode.content.forEach((child) => {
                result = result && LayoutConfig.DockedValidatorV2(child);
            });
            return result;
        }

        // validate end node - component
        if (dockedNode.type !== "component" || !dockedNode.id) {
            return false;
        }
        return true;
    };

    public static CreateConfigToSave = (appStore: AppStore, rootConfig: any) => {
        if (!appStore || !rootConfig || !("type" in rootConfig) || !("content" in rootConfig)) {
            return null;
        }

        let configToSave = {
            layoutVersion: CURRENT_LAYOUT_SCHEMA_VERSION,
            docked: {
                type: rootConfig.type,
                content: []
            },
            floating: []
        };

        // 1. generate config from current docked widgets
        LayoutConfig.GenSimpleConfigToSave(appStore, configToSave.docked.content, rootConfig.content);

        // 2. handle floating widgets
        appStore.widgetsStore.floatingWidgets.forEach((config: WidgetConfig) => {
            let floatingConfig = {
                type: config.type,
                defaultWidth: config.defaultWidth ? config.defaultWidth : "",
                defaultHeight: config.defaultHeight ? config.defaultHeight : "",
                defaultX: config.defaultX ? config.defaultX : "",
                defaultY: config.defaultY ? config.defaultY : ""
            };
            // add widget settings
            const widgetSettingsConfig = appStore.widgetsStore.toWidgetSettingsConfig(config.type, config.id);
            if (widgetSettingsConfig) {
                floatingConfig["widgetSettings"] = widgetSettingsConfig;
            }
            configToSave.floating.push(floatingConfig);
        });

        return configToSave;
    };

    private static GenSimpleConfigToSave = (appStore: AppStore, newParentContent: any, parentContent: any): void => {
        if (!appStore || !newParentContent || !Array.isArray(newParentContent) || !parentContent || !Array.isArray(parentContent)) {
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
                        LayoutConfig.GenSimpleConfigToSave(appStore, simpleChild.content, child.content);
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
                    const widgetSettingsConfig = appStore.widgetsStore.toWidgetSettingsConfig(widgetType, child.id);
                    if (widgetSettingsConfig) {
                        simpleChild["widgetSettings"] = widgetSettingsConfig;
                    }
                    newParentContent.push(simpleChild);
                }
            }
        });
    };

    public static CreateConfigToApply = (appStore: AppStore, newParentContent: any, parentContent: any, componentConfigs: any[]) => {
        if (!appStore || !newParentContent || !Array.isArray(newParentContent) || !parentContent || !Array.isArray(parentContent)) {
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
                        LayoutConfig.CreateConfigToApply(appStore, simpleChild.content, child.content, componentConfigs);
                    }
                } else if (child.type === "component" && child.id) {
                    const widgetType = (child.id).replace(/\-\d+$/, "");
                    if (COMPONENT_CONFIG.has(widgetType)) {
                        let componentConfig = Object.assign({}, COMPONENT_CONFIG.get(widgetType));
                        if (child.width) {
                            componentConfig["width"] = child.width;
                        }
                        if (child.height) {
                            componentConfig["height"] = child.height;
                        }
                        if ("widgetSettings" in child) {
                            componentConfig["widgetSettings"] = child.widgetSettings;
                        }
                        componentConfig.props = {appStore: appStore, id: "", docked: true};
                        componentConfigs.push(componentConfig);
                        newParentContent.push(componentConfig);
                    }
                }
            }
        });
    };
}
