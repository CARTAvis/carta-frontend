export class LayoutSchema {
    public static readonly INITIAL_LAYOUT_SCHEMA_VERSION = 1;
    public static readonly CURRENT_LAYOUT_SCHEMA_VERSION = 1;

    public static isLayoutVersionValid = (version: number): boolean => {
        return Number.isInteger(version) && version >= LayoutSchema.INITIAL_LAYOUT_SCHEMA_VERSION && version <= LayoutSchema.CURRENT_LAYOUT_SCHEMA_VERSION;
    };

    // key: layout schema version, value: schema
    public static readonly LAYOUT_SCHEMAS = {
        "1" : {
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
                    "items": {
                        "type": "object"
                    }
                }
            }
        }
    };
}
