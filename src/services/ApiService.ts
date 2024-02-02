import Ajv from "ajv";
import axios, {AxiosInstance} from "axios";
import {action, computed, makeObservable, observable} from "mobx";

import {AppToaster} from "components/Shared";
import {LayoutConfig, Snippet, Workspace, WorkspaceListItem} from "models";

const preferencesSchema = require("models/preferences_schema_2.json");
const snippetSchema = require("models/snippet_schema_1.json");

export interface RuntimeConfig {
    dashboardAddress?: string;
    apiAddress?: string;
    tokenRefreshAddress?: string;
    logoutAddress?: string;
    logoutUsingGet?: boolean;
}

export class ApiService {
    private static staticInstance: ApiService;

    static get Instance() {
        if (!ApiService.staticInstance) {
            ApiService.staticInstance = new ApiService();
        }
        return ApiService.staticInstance;
    }

    public static RuntimeConfig: RuntimeConfig = {};

    public static SetRuntimeConfig(data: any) {
        console.log("Setting runtime config");
        if (typeof data === "object") {
            if (typeof data.apiAddress === "string") {
                // Grab the port from the socketUrl argument if it exists
                const url = new URL(window.location.href);
                const socketUrl = url.searchParams.get("socketUrl");
                const socketRegex = /^wss?:\/\/.*:(\d+)/;
                const socketPort = socketUrl?.match(socketRegex)?.[1] ?? "";
                data.apiAddress = data.apiAddress.replace("{port}", socketPort);
            }
            ApiService.RuntimeConfig = data as RuntimeConfig;
        } else {
            ApiService.RuntimeConfig = {};
        }
    }

    private static PreferenceValidator = new Ajv({strictTypes: false}).compile(preferencesSchema);
    private static SnippetValidator = new Ajv({strictTypes: false}).compile(snippetSchema);

    @observable private _accessToken: string;
    private _tokenLifetime: number;
    private _tokenExpiryHandler: any;
    private axiosInstance: AxiosInstance;

    @action setToken = (tokenString: string, tokenLifetime: number = Number.MAX_VALUE) => {
        if (isFinite(tokenLifetime) && tokenLifetime > 0) {
            // Store tokens from URL parameters as session cookie
            if (tokenLifetime === Number.MAX_VALUE) {
                document.cookie = `carta-auth-token=${tokenString}`;
            } else {
                console.debug(`Token updated and valid for ${tokenLifetime.toFixed()} seconds`);
            }
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
        return this._accessToken && this._tokenLifetime > 0;
    }

    constructor() {
        makeObservable(this);
        this.axiosInstance = axios.create();
        this.onTokenExpired();
    }

    private onTokenExpired = async () => {
        clearTimeout(this._tokenExpiryHandler);
        const tokenRefreshed = await this.refreshAccessToken();
        if (tokenRefreshed) {
            console.debug("Authenticated");
            const dt = this.tokenLifetime;
            // Queue up an access token refresh 10 seconds before the current one expires
            this._tokenExpiryHandler = setTimeout(this.onTokenExpired, (dt - 10) * 1000);
        } else {
            this.handleAuthLost();
        }
    };

    private handleAuthLost = () => {
        if (ApiService.RuntimeConfig.dashboardAddress) {
            this.clearToken();
            const redirectParams = btoa(window.location.search);
            window.open(`${ApiService.RuntimeConfig.dashboardAddress}?redirectParams=${redirectParams}`, "_self");
        } else {
            this.clearToken();
            AppToaster.show({icon: "warning-sign", message: "Could not authenticate with server", intent: "danger", timeout: 3000});
        }
    };

    private refreshAccessToken = async () => {
        if (ApiService.RuntimeConfig.tokenRefreshAddress) {
            try {
                const response = await this.axiosInstance.post(ApiService.RuntimeConfig.tokenRefreshAddress);
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
        // The controller will assume an existing login session exists if this exists
        localStorage.removeItem("authenticationType");
        if (ApiService.RuntimeConfig.logoutUsingGet) {
            window.open(ApiService.RuntimeConfig.logoutAddress, "_self");
            return; // avoid later potential dashboard redirect
        } else {
            await this.axiosInstance.post(ApiService.RuntimeConfig.logoutAddress);
        }
        // Redirect to dashboard URL if it exists
        if (ApiService.RuntimeConfig.dashboardAddress) {
            window.open(ApiService.RuntimeConfig.dashboardAddress, "_self");
        }
    };

    public stopServer = async () => {
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/server/stop`;
                await this.axiosInstance.post(url);
            } catch (err) {
                AppToaster.show({icon: "warning-sign", message: "Could not stop CARTA server", intent: "danger", timeout: 3000});
                console.log(err);
            }
        }
    };

    public getPreferences = async () => {
        let preferences;
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/preferences`;
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

        if (preferences) {
            this.upgradePreferences(preferences);
            const valid = ApiService.PreferenceValidator(preferences);
            if (!valid) {
                for (const error of ApiService.PreferenceValidator.errors) {
                    if (error.instancePath) {
                        console.log(`Removing invalid preference ${error.instancePath}`);
                        // Trim the leading "." from the path
                        delete preferences[error.instancePath.substring(1)];
                    }
                }
            }
        }
        return preferences;
    };

    private upgradePreferences = (preferences: any) => {
        // Upgrade to V2 if required
        if (preferences?.version && preferences.version === 1) {
            if (preferences.astColor || preferences.astColor === 0) {
                switch (preferences.astColor) {
                    case 0:
                        preferences.astColor = "auto-black";
                        break;
                    case 1:
                        preferences.astColor = "auto-white";
                        break;
                    case 2:
                        preferences.astColor = "auto-red";
                        break;
                    case 3:
                        preferences.astColor = "auto-forest";
                        break;
                    case 4:
                        preferences.astColor = "auto-blue";
                        break;
                    case 5:
                        preferences.astColor = "auto-turquoise";
                        break;
                    case 6:
                        preferences.astColor = "auto-violet";
                        break;
                    case 7:
                        preferences.astColor = "auto-gold";
                        break;
                    case 8:
                        preferences.astColor = "auto-gray";
                        break;
                    default:
                        preferences.astColor = "auto-blue";
                        break;
                }
            }
            preferences.version = 2;
            this.setPreferences(preferences);
        }
    };

    public setPreference = async (key: string, value: any) => {
        const obj = {};
        obj[key] = value;
        return this.setPreferences(obj);
    };

    public setPreferences = async (preferences: any) => {
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/preferences`;
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
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/preferences`;
                const response = await this.axiosInstance.delete(url, {data: {keys}});
                return response?.data?.success;
            } catch (err) {
                console.log(err);
                return false;
            }
        } else {
            try {
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

    public getLayouts = async () => {
        let savedLayouts: {[name: string]: any};
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/layouts`;
                const response = await this.axiosInstance.get(url);
                if (response?.data?.success) {
                    savedLayouts = response.data.layouts;
                } else {
                    return undefined;
                }
            } catch (err) {
                console.log(err);
                return undefined;
            }
        } else {
            try {
                savedLayouts = JSON.parse(localStorage.getItem("savedLayouts")) ?? {};
            } catch (err) {
                console.log(err);
                return undefined;
            }
        }
        if (savedLayouts) {
            const validLayouts = {};
            for (const layoutName of Object.keys(savedLayouts)) {
                const layout = savedLayouts[layoutName];
                LayoutConfig.UpgradeLayout(layout);
                const valid = LayoutConfig.LayoutValidator(layout);
                if (!valid) {
                    console.log(LayoutConfig.LayoutValidator.errors);
                } else {
                    validLayouts[layoutName] = layout;
                }
            }
            return validLayouts;
        } else {
            return undefined;
        }
    };

    public setLayout = async (layoutName: string, layout: any): Promise<boolean> => {
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/layout`;
                const response = await this.axiosInstance.put(url, {layoutName, layout});
                return response?.data?.success;
            } catch (err) {
                console.log(err);
                return false;
            }
        } else {
            try {
                const obj = JSON.parse(localStorage.getItem("savedLayouts")) ?? {};
                obj[layoutName] = layout;
                localStorage.setItem("savedLayouts", JSON.stringify(obj));
                return true;
            } catch (err) {
                return false;
            }
        }
    };

    public clearLayout = async (layoutName: string) => {
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/layout`;
                const response = await this.axiosInstance.delete(url, {data: {layoutName}});
                return response?.data?.success;
            } catch (err) {
                console.log(err);
                return false;
            }
        } else {
            try {
                const obj = JSON.parse(localStorage.getItem("savedLayouts")) ?? {};
                delete obj[layoutName];
                localStorage.setItem("savedLayouts", JSON.stringify(obj));
                return true;
            } catch (err) {
                return false;
            }
        }
    };

    public getSnippets = async () => {
        let savedSnippets: {[name: string]: Snippet};
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/snippets`;
                const response = await this.axiosInstance.get(url);
                if (response?.data?.success) {
                    savedSnippets = response.data.snippets;
                } else {
                    return undefined;
                }
            } catch (err) {
                console.log(err);
                return undefined;
            }
        } else {
            try {
                savedSnippets = JSON.parse(localStorage.getItem("savedSnippets")) ?? {};
            } catch (err) {
                console.log(err);
                return undefined;
            }
        }
        if (savedSnippets) {
            const validSnippets = new Map<string, Snippet>();
            for (const snippetName of Object.keys(savedSnippets)) {
                const snippet = savedSnippets[snippetName];
                const valid = ApiService.SnippetValidator(snippet);
                if (!valid) {
                    console.log(ApiService.SnippetValidator.errors);
                } else {
                    validSnippets.set(snippetName, snippet);
                }
            }
            return validSnippets;
        } else {
            return undefined;
        }
    };

    public setSnippet = async (snippetName: string, snippet: Snippet) => {
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/snippet`;
                const response = await this.axiosInstance.put(url, {snippetName, snippet});
                return response?.data?.success;
            } catch (err) {
                console.log(err);
                return false;
            }
        } else {
            try {
                const obj = JSON.parse(localStorage.getItem("savedSnippets")) ?? {};
                obj[snippetName] = snippet;
                localStorage.setItem("savedSnippets", JSON.stringify(obj));
                return true;
            } catch (err) {
                return false;
            }
        }
    };

    public clearSnippet = async (snippetName: string) => {
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/snippet`;
                const response = await this.axiosInstance.delete(url, {data: {snippetName}});
                return response?.data?.success;
            } catch (err) {
                console.log(err);
                return false;
            }
        } else {
            try {
                const obj = JSON.parse(localStorage.getItem("savedSnippets")) ?? {};
                delete obj[snippetName];
                localStorage.setItem("savedSnippets", JSON.stringify(obj));
                return true;
            } catch (err) {
                return false;
            }
        }
    };

    public getWorkspaceList = async () => {
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/list/workspaces`;
                const response = await this.axiosInstance.get<{workspaces: WorkspaceListItem[]; success: boolean}>(url);
                if (response?.data?.success) {
                    return response.data.workspaces;
                } else {
                    return undefined;
                }
            } catch (err) {
                console.log(err);
                return undefined;
            }
        } else {
            try {
                const existingWorkspaces = JSON.parse(localStorage.getItem("savedWorkspaces")) ?? {};
                if (existingWorkspaces) {
                    const validWorkspaces = new Array<WorkspaceListItem>();
                    for (const workspaceName of Object.keys(existingWorkspaces)) {
                        const workspace = existingWorkspaces[workspaceName];
                        if (!workspace) {
                            // TODO: handle validation errors
                        } else {
                            validWorkspaces.push({name: workspaceName, date: workspace?.date ?? Date.now() / 1000});
                        }
                    }
                    return validWorkspaces;
                } else {
                    return undefined;
                }
            } catch (err) {
                console.log(err);
                return undefined;
            }
        }
    };

    public getWorkspace = async (name: string, isKey = false): Promise<Workspace | undefined> => {
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/workspace/${isKey ? "key/" : ""}${name}`;
                const response = await this.axiosInstance.get<{workspace: Workspace; success: boolean}>(url);
                if (response?.data?.success) {
                    return response.data.workspace;
                }
            } catch (err) {
                console.log(err);
            }
        } else if (!isKey) {
            try {
                const existingWorkspaces = JSON.parse(localStorage.getItem("savedWorkspaces")) ?? {};
                const workspace = existingWorkspaces?.[name];
                if (workspace) {
                    const valid = true; // TODO: ApiService.WorkspaceValidator(workspace);
                    if (valid) {
                        return workspace;
                    } else {
                        //console.log(ApiService.WorkspaceValidator.errors);
                    }
                }
            } catch (err) {
                console.log(err);
            }
        }
        return undefined;
    };

    public setWorkspace = async (workspaceName: string, workspace: Workspace): Promise<Workspace | undefined> => {
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/workspace`;
                const res = await this.axiosInstance.put(url, {workspaceName, workspace});
                if (res.data?.workspace?.id) {
                    workspace.id = res.data?.workspace?.id;
                }
                return {...workspace, editable: res.data?.workspace?.editable, name: workspaceName};
            } catch (err) {
                console.log(err);
                return undefined;
            }
        } else {
            try {
                const obj = JSON.parse(localStorage.getItem("savedWorkspaces")) ?? {};
                obj[workspaceName] = workspace;
                localStorage.setItem("savedWorkspaces", JSON.stringify(obj));
                return workspace;
            } catch (err) {
                return undefined;
            }
        }
    };

    public getSharedWorkspaceKey = async (workspaceId: string): Promise<string | undefined> => {
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/share/workspace/${workspaceId}`;
                const response = await this.axiosInstance.post(url);
                return response?.data?.success ? response.data.shareKey : undefined;
            } catch (err) {
                console.log(err);
                return undefined;
            }
        } else {
            return undefined;
        }
    };

    public clearWorkspace = async (workspaceName: string) => {
        if (ApiService.RuntimeConfig.apiAddress) {
            try {
                const url = `${ApiService.RuntimeConfig.apiAddress}/database/workspace`;
                const response = await this.axiosInstance.delete(url, {data: {workspaceName}});
                return response?.data?.success;
            } catch (err) {
                console.log(err);
                return false;
            }
        } else {
            try {
                const obj = JSON.parse(localStorage.getItem("savedWorkspaces")) ?? {};
                delete obj[workspaceName];
                localStorage.setItem("savedWorkspaces", JSON.stringify(obj));
                return true;
            } catch (err) {
                return false;
            }
        }
    };
}
