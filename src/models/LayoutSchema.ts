import * as Ajv from "ajv";
import {AppStore} from "stores";
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
    ["log", {
        type: "react-component",
        component: "log",
        title: "Log",
        id: "log"
    }]
]);

export class LayoutSchema {
    public static readonly INITIAL_LAYOUT_SCHEMA_VERSION = 1;
    public static readonly CURRENT_LAYOUT_SCHEMA_VERSION = 2;

    // key: layout schema version, value: schema
    public static readonly LAYOUT_SCHEMAS = {
        // TODO: details of schema
        "1" : {
            "required": ["layoutVersion", "docked", "floating"],
            "properties": {
                "layoutVersion": {
                    "type": "integer",
                    "minimum": LayoutSchema.INITIAL_LAYOUT_SCHEMA_VERSION,
                    "maximum": LayoutSchema.CURRENT_LAYOUT_SCHEMA_VERSION
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
                    "items": [
                        {
                            "type": "object",
                            "required": ["type"],
                            "properties": {
                                "type": {
                                    "type": "string"
                                },
                                "defaultWidth": {
                                    "type": "integer"
                                },
                                "defaultHeight": {
                                    "type": "integer"
                                },
                                "defaultX": {
                                    "type": "integer"
                                },
                                "defaultY": {
                                    "type": "integer"
                                }
                                // TODO: extend with widget properties
                            }
                        }
                    ]
                }
            }
        },
        "2" : {
            "required": ["layoutVersion", "docked", "floating"],
            "properties": {
                "layoutVersion": {
                    "type": "integer",
                    "minimum": LayoutSchema.INITIAL_LAYOUT_SCHEMA_VERSION,
                    "maximum": LayoutSchema.CURRENT_LAYOUT_SCHEMA_VERSION
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
                    "items": [
                        {
                            "type": "object",
                            "required": ["type"],
                            "properties": {
                                "type": {
                                    "type": "string"
                                },
                                "defaultWidth": {
                                    "type": "integer"
                                },
                                "defaultHeight": {
                                    "type": "integer"
                                },
                                "defaultX": {
                                    "type": "integer"
                                },
                                "defaultY": {
                                    "type": "integer"
                                }
                                // TODO: extend with widget properties
                            }
                        }
                    ]
                }
            }
        }
    };

    public static GetPresetConfig = (presetName: string) => {
        if (!presetName) {
            return null;
        }

        const config = PresetLayout.PRESET_CONFIGS.get(presetName);
        if (!config) {
            return null;
        }

        return {
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
    };

    public static IsUserLayoutValid = (layoutName: string, layoutConfig: object): boolean => {
        if (!layoutName || !layoutConfig ) {
            return false;
        }

        // exclude conflict with presets
        if (PresetLayout.isPreset(layoutName)) {
            return false;
        }

        // check version
        if (!("layoutVersion" in layoutConfig)) {
            return false;
        }
        const version = layoutConfig["layoutVersion"];
        if (!Number.isInteger(version) || version < LayoutSchema.INITIAL_LAYOUT_SCHEMA_VERSION || version > LayoutSchema.CURRENT_LAYOUT_SCHEMA_VERSION) {
            return false;
        }

        // check schema
        const jsonValidator = new Ajv({removeAdditional: true});
        if (false === jsonValidator.validate(LayoutSchema.LAYOUT_SCHEMAS[version], layoutConfig)) {
            return false;
        }

        // transform config in different version to current version
        if (version === 1) {
            return LayoutSchema.ConvertV1ToV2(layoutConfig);
        }

        return true;
    };

    private static ConvertV1ToV2 = (layoutConfig: any): boolean => {
        // traverse docked widgets
        const docked = layoutConfig.docked.content;
        LayoutSchema.ConvertV1ToV2Docked(docked);

        // traverse floating widgets
        const floating = layoutConfig.floating;
        floating.forEach((config) => {
            if (config.type.match(/spatial\-profiler/)) {
                config["widgetSettings"] = config.coord === "y" ? {coordinate: "y"} : {coordinate: "x"};
            }
        });
        return true;
    };

    private static ConvertV1ToV2Docked = (parentContent) => {
        parentContent.forEach((child) => {
            if (child.type === "component") {
                if (child.id.match(/spatial\-profiler/)) {
                    child["widgetSettings"] = child.coord === "y" ? {coordinate: "y"} : {coordinate: "x"};
                }
            } else {
                if (child.content) {
                    LayoutSchema.ConvertV1ToV2Docked(child.content);
                }
            }
        });
    };

    public static createConfigToSave = (appStore: AppStore, newParentContent: any, parentContent: any): void => {
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
                        LayoutSchema.createConfigToSave(appStore, simpleChild.content, child.content);
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

    public static createConfigToApply = (appStore: AppStore, newParentContent: any, parentContent: any, componentConfigs: any[]) => {
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
                        LayoutSchema.createConfigToApply(appStore, simpleChild.content, child.content, componentConfigs);
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
