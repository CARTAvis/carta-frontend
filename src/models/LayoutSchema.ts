import * as Ajv from "ajv";
import {PresetLayout} from "models";

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

    private static ConvertV1ToV2 = (layoutConfig): boolean => {
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
}
