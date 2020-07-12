import axios, {AxiosInstance} from "axios";
import * as Ajv from "ajv";
import {action, computed, observable} from "mobx";
import {AppToaster} from "components/Shared";

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

    @observable private _accessToken: string;
    private _tokenLifetime: number;
    private _tokenExpiryHandler: any;
    private axiosInstance: AxiosInstance;
    private authInstance: gapi.auth2.GoogleAuth;

    @action private setToken = (tokenString: string, tokenLifetime: number) => {
        if (isFinite(tokenLifetime) && tokenLifetime > 0) {
            console.log(`Token updated and valid for ${tokenLifetime.toFixed()} seconds`);
            this._accessToken = tokenString;
            this.axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${tokenString}`;
            this._tokenLifetime = tokenLifetime;
            return true;
        }
        this.clearToken();
        return false;
    };

    get accessToken() {
        return this._accessToken;
    }

    get tokenLifetime() {
        return this._tokenLifetime;
    }

    @action private clearToken = () => {
        this._accessToken = undefined;
        this._tokenLifetime = -1;
        delete this.axiosInstance.defaults.headers.common["Authorization"];
    };

    @computed get authenticated() {
        return (this._accessToken && this._tokenLifetime > 0);
    }

    constructor() {
        this.axiosInstance = axios.create();
        if (ApiService.GoogleClientId) {
            gapi.load("auth2", () => {
                console.log("Google auth loaded");
                try {
                    gapi.auth2.init({client_id: ApiService.GoogleClientId, scope: "profile email"}).then(this.onTokenExpired, failureReason => {
                        console.log(failureReason);
                        this.handleAuthLost();
                    });
                } catch (e) {
                    console.log(e);
                    this.handleAuthLost();
                }
            });
        } else if (ApiService.TokenRefreshUrl) {
            this.onTokenExpired();
        } else {
            this._accessToken = "no_auth_configured";
            this._tokenLifetime = Number.MAX_VALUE;
        }
    }

    private onTokenExpired = async () => {
        clearTimeout(this._tokenExpiryHandler);
        const tokenRefreshed = await this.refreshAccessToken();
        if (tokenRefreshed) {
            console.log("Authenticated");
            const dt = this.tokenLifetime;
            // Queue up an access token refresh 10 seconds before the current one expires
            this._tokenExpiryHandler = setTimeout(this.onTokenExpired, (dt - 10) * 1000);
        } else {
            this.handleAuthLost();
        }
    };

    private handleAuthLost = () => {
        if (ApiService.DashboardUrl) {
            this.clearToken();
            const redirectParams = btoa(window.location.search);
            window.open(`${ApiService.DashboardUrl}?redirectParams=${redirectParams}`, "_self");
        } else {
            this.clearToken();
            AppToaster.show({icon: "warning-sign", message: "Could not authenticate with server", intent: "danger", timeout: 3000});
        }
    };

    private refreshAccessToken = async () => {
        if (ApiService.GoogleClientId) {
            try {
                this.authInstance = gapi.auth2.getAuthInstance();
                const currentUser = this.authInstance?.currentUser.get();
                if (currentUser?.isSignedIn()) {
                    const authResponse = await currentUser.reloadAuthResponse();
                    if (this.setToken(authResponse.id_token, authResponse.expires_in)) {
                        console.log("Authenticated with Google");
                        return true;
                    } else {
                        console.log("Error parsing Google access token");
                        return false;
                    }
                } else {
                    console.log("Not authenticated!");
                    this.clearToken();
                    return false;
                }
            } catch (e) {
                return false;
            }
        } else if (ApiService.TokenRefreshUrl) {
            try {
                const response = await this.axiosInstance.post(ApiService.TokenRefreshUrl);
                if (response?.data?.access_token) {
                    // If access token does not expire, set lifetime to maximum
                    this.setToken(response.data.access_token, response.data.expires_in || Number.MAX_VALUE);
                    return true;
                } else {
                    this.clearToken();
                    return false;
                }
            } catch (err) {
                this.clearToken();
                console.log(err);
                return false;
            }
        } else {
            return false;
        }
    };

    public logout = async () => {
        this.clearToken();
        if (ApiService.GoogleClientId) {
            this.authInstance?.signOut();
        } else if (ApiService.LogoutUrl) {
            try {
                await this.axiosInstance.post(ApiService.LogoutUrl);
            } catch (err) {
                console.log(err);
            }
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
