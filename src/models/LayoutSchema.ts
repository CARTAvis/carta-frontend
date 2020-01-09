import * as Ajv from "ajv";
import {PresetLayout} from "models";

export class LayoutSchema {
    public static readonly INITIAL_LAYOUT_SCHEMA_VERSION = 1;
    public static readonly CURRENT_LAYOUT_SCHEMA_VERSION = 2;

    public static isUserLayoutValid = (layoutName: string, layoutConfig: object): boolean => {
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
        if (typeof version !== "number" || !Number.isInteger(version) || version < LayoutSchema.INITIAL_LAYOUT_SCHEMA_VERSION || version > LayoutSchema.CURRENT_LAYOUT_SCHEMA_VERSION) {
            return false;
        }

        // check schema
        const jsonValidator = new Ajv({removeAdditional: true});
        if (!jsonValidator.validate(LayoutSchema.LAYOUT_SCHEMAS[version], layoutConfig)) {
            return false;
        }

        if (version === 1) {
            // TODO: transform layout ver1 to current ver
        }

        return true;
    };

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
}
