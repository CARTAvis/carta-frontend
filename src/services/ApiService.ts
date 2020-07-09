import axios, {AxiosInstance} from "axios";
import * as Ajv from "ajv";
import {observable} from "mobx";
import {AppToaster} from "components/Shared";
import {AppStore} from "../stores";

const preferencesSchema = require("models/preferences_schema_1.json");

export class ApiService {
    private static staticInstance: ApiService;

    static get Instance() {
        if (!ApiService.staticInstance) {
            ApiService.staticInstance = new ApiService();
        }
        return ApiService.staticInstance;
    }

    private static readonly GoogleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    private static readonly ApiBase = process.env.REACT_APP_API_ADDRESS;
    private static readonly TokenRefreshUrl = process.env.REACT_APP_ACCESS_TOKEN_ADDRESS;
    public static readonly LogoutUrl = process.env.REACT_APP_ACCESS_LOGOUT_ADDRESS;
    public static readonly DashboardUrl = process.env.REACT_APP_ACCESS_DASHBOARD_ADDRESS;
    // Support for V4 JSON schemas
    private static PreferenceValidator = new Ajv({schemaId: "auto"}).addMetaSchema(require("ajv/lib/refs/json-schema-draft-04.json")).compile(preferencesSchema);

    @observable authenticated: boolean;

    private _accessToken: string;
    private axiosInstance: AxiosInstance;

    get accessToken() {
        return this._accessToken;
    }

    constructor() {
        this.axiosInstance = axios.create();
        if (ApiService.GoogleClientId) {
            gapi.load("auth2", () => {
                console.log("Google auth loaded");
                try {
                    gapi.auth2.init({client_id: ApiService.GoogleClientId, scope: "profile email"}).then(() => {
                        const authInstance = gapi.auth2.getAuthInstance();
                        const currentUser = authInstance?.currentUser.get();
                        if (currentUser?.isSignedIn()) {
                            currentUser.reloadAuthResponse().then(res => {
                                this._accessToken = res.id_token;
                                this.axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${res.id_token}`;
                                this.authenticated = true;
                            });
                        } else {
                            this.authenticated = false;
                        }
                    });
                } catch (e) {
                    console.log(e);
                }
            });
        } else if (ApiService.TokenRefreshUrl) {
            // If there's a specified URL, we need to authenticate first
            this.authenticated = false;
            this.refreshAccessToken().then((res) => {
                if (res) {
                    this.authenticated = true;
                } else if (ApiService.DashboardUrl) {
                    const redirectUrl = btoa(window.location.href);
                    window.open(`${ApiService.DashboardUrl}?redirectUrl=${redirectUrl}`, "_self");
                } else {
                    AppToaster.show({icon: "warning-sign", message: "Could not authenticate with server", intent: "danger", timeout: 3000});
                }
            });
        } else {
            this.authenticated = true;
        }
    }

    public refreshAccessToken = async () => {
        try {
            const response = await this.axiosInstance.post(ApiService.TokenRefreshUrl);
            if (response?.data?.access_token) {
                this._accessToken = response.data.access_token;
                this.axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${response.data.access_token}`;
                return true;
            } else {
                return false;
            }
        } catch (err) {
            console.log(err);
            return false;
        }
    };

    public logout = async () => {
        this.authenticated = false;
        this._accessToken = undefined;
        try {
            await this.axiosInstance.post(ApiService.LogoutUrl);
        } catch (err) {
            console.log(err);
        }
        // Redirect to dashboard URL if it exists
        if (ApiService.DashboardUrl) {
            window.open(ApiService.DashboardUrl, "_self");
        }
    };

    public stopServer = async () => {
        if (ApiService.ApiBase) {
            try {
                const url = `${ApiService.ApiBase}/server/stop`;
                await this.axiosInstance.post(url);
            } catch (err) {
                AppToaster.show({icon: "warning-sign", message: "Could not stop CARTA server", intent: "danger", timeout: 3000});
                console.log(err);
            }
        }
    };

    public getPreferences = async () => {
        let preferences;
        if (ApiService.ApiBase) {
            try {
                const url = `${ApiService.ApiBase}/database/preferences`;
                const response = await this.axiosInstance.get(url);
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
    };

    public setPreference = async (key: string, value: any) => {
        const obj = {};
        obj[key] = value;
        return this.setPreferences(obj);
    };

    public setPreferences = async (preferences: any) => {
        if (ApiService.ApiBase) {
            try {
                const url = `${ApiService.ApiBase}/database/preferences`;
                const response = await this.axiosInstance.put(url, preferences);
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
    };

    public clearPreferences = async (keys: string[]) => {
        if (ApiService.ApiBase) {
            try {
                const url = `${ApiService.ApiBase}/database/preferences`;
                const response = await this.axiosInstance.delete(url, {data: {keys}});
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
    };
}
