import axios from "axios";
import * as Ajv from "ajv";
const preferencesSchema = require("models/preferences_schema_1.json");

export class ApiService {
    private static readonly ApiBase = process.env.REACT_APP_API_ADDRESS;

    // Support for V4 JSON schemas
    private static PreferenceValidator = new Ajv({schemaId: "auto"}).addMetaSchema(require("ajv/lib/refs/json-schema-draft-04.json")).compile(preferencesSchema);
    public static async GetPreferences() {
        let preferences;
        if (ApiService.ApiBase) {
            try {
                const url = `${ApiService.ApiBase}/database/preferences`;
                const response = await axios.get(url);
                if (response?.data?.success) {
                    preferences = response.data.preferences;
                } else {
                    return undefined;
                }
            } catch (err) {
                console.log(err);
                return undefined;
            }
        } else {
            preferences = JSON.parse(localStorage.getItem("preferences")) ?? {};
        }
        const valid = ApiService.PreferenceValidator(preferences);
        if (!valid) {
            for (const error of ApiService.PreferenceValidator.errors) {
                if (error.dataPath) {
                    console.log(`Removing invalid preference ${error.dataPath}`);
                    // Trim the leading "." from the path
                    delete preferences[error.dataPath.substring(1)];
                }
            }
        }
        return preferences;
    }

    public static async SetPreference(key: string, value: any) {
        const obj = {};
        obj[key] = value;
        return ApiService.SetPreferences(obj);
    }

    public static async SetPreferences(preferences: any) {
        if (ApiService.ApiBase) {
            try {
                const url = `${ApiService.ApiBase}/database/preferences`;
                const response = await axios.put(url, preferences);
                return response?.data?.success;
            } catch (err) {
                console.log(err);
                return false;
            }
        } else {
            try {
                const obj = JSON.parse(localStorage.getItem("preferences")) ?? {};
                for (const key of Object.keys(preferences)) {
                    obj[key] = preferences[key];
                }

                const valid = ApiService.PreferenceValidator(obj);
                if (!valid) {
                    console.log(ApiService.PreferenceValidator.errors);
                }

                localStorage.setItem("preferences", JSON.stringify(obj));
                return true;
            } catch (err) {
                return false;
            }
        }
    }

    public static async ClearPreferences(keys: string[]) {
        if (ApiService.ApiBase) {
            try {
                const url = `${ApiService.ApiBase}/database/preferences`;
                const response = await axios.delete(url, {data: {keys}});
                return response?.data?.success;
            } catch (err) {
                console.log(err);
                return false;
            }
        } else {
            try {
                // TODO: Dexie!
                const obj = JSON.parse(localStorage.getItem("preferences")) ?? {};
                for (const key of keys) {
                    delete obj[key];
                }
                localStorage.setItem("preferences", JSON.stringify(obj));
                return true;
            } catch (err) {
                return false;
            }
        }
    }
}
