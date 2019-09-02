import {LayoutStore} from "stores";

// key: version, value: schema
export const LAYOUT_SCHEMAS = {
    "1" : {
        "properties": {
            "layoutVersion": {
                "type": "integer",
                "minimum": LayoutStore.InitialLayoutVersion,
                "maximum": LayoutStore.LayoutVersion
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