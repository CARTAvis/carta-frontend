const InitialLayoutVersion = 1;
const CurrentLayoutVersion = 1;

// key: layout schema version, value: schema
export const LAYOUT_SCHEMAS = {
    "1" : {
        "properties": {
            "layoutVersion": {
                "type": "integer",
                "minimum": InitialLayoutVersion,
                "maximum": CurrentLayoutVersion
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