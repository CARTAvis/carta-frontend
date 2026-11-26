import {NewerWorkspaceError, WORKSPACE_VERSION} from "models/Workspace";
import {AppStore} from "stores";

import {ApiService} from "./ApiService";

describe("ApiService.getWorkspace from the browser storage", () => {
    const apiService = AppStore.Instance.apiService;

    function store(workspace: object) {
        localStorage.setItem("savedWorkspaces", JSON.stringify({saved: workspace}));
    }

    beforeEach(() => {
        ApiService.runtimeConfig = {};
        jest.spyOn(console, "error").mockImplementation(jest.fn());
    });

    afterEach(() => {
        localStorage.removeItem("savedWorkspaces");
        jest.restoreAllMocks();
    });

    test("returns a valid workspace that a newer version of CARTA saved", async () => {
        store({workspaceVersion: WORKSPACE_VERSION + 1, frontendVersion: "6.2.0", files: []});
        await expect(apiService.getWorkspace("saved")).resolves.toMatchObject({workspaceVersion: WORKSPACE_VERSION + 1});
    });

    test("throws for a workspace that is not valid when a newer version of CARTA saved it", async () => {
        store({workspaceVersion: WORKSPACE_VERSION + 1, frontendVersion: "6.2.0", files: "not a list"});
        await expect(apiService.getWorkspace("saved")).rejects.toEqual(new NewerWorkspaceError(WORKSPACE_VERSION + 1));
    });

    test("returns undefined for a workspace of this version that is not valid, or one that is not stored", async () => {
        store({workspaceVersion: WORKSPACE_VERSION, frontendVersion: "6.2.0", files: "not a list"});
        await expect(apiService.getWorkspace("saved")).resolves.toBeUndefined();
        await expect(apiService.getWorkspace("missing")).resolves.toBeUndefined();
    });
});
