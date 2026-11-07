import {runInAction} from "mobx";

import {AppToaster} from "components/Shared";
import {WorkspaceIssueOutcome, WorkspaceItemKind} from "enums";
import {type Workspace, type WorkspaceIssue} from "models";
import {AppStore, WorkspaceRecoveryStore, WorkspaceRestorer} from "stores";

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return {promise, resolve, reject};
}

describe("AppStore.loadWorkspace overlapping loads", () => {
    const appStore = AppStore.Instance;
    const olderWorkspace = {workspaceVersion: 2, frontendVersion: 0, description: "older"} as Workspace;
    const newerWorkspace = {workspaceVersion: 2, frontendVersion: 0, description: "newer"} as Workspace;

    beforeEach(() => {
        jest.restoreAllMocks();
        runInAction(() => {
            appStore.activeWorkspace = undefined;
            appStore.isLoadingWorkspace = false;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        runInAction(() => {
            appStore.activeWorkspace = undefined;
            appStore.isLoadingWorkspace = false;
        });
    });

    test("an older fetch cannot restore over a newer completed workspace", async () => {
        const olderFetch = deferred<Workspace | undefined>();
        const newerFetch = deferred<Workspace | undefined>();
        const getWorkspace = jest.spyOn(appStore.apiService, "getWorkspace").mockImplementation(name => (name === "older" ? olderFetch.promise : newerFetch.promise));
        const restore = jest.spyOn(WorkspaceRestorer.prototype, "restore").mockImplementation(function* () {
            return [];
        });

        const olderLoad = appStore.loadWorkspace("older");
        const newerLoad = appStore.loadWorkspace("newer");
        newerFetch.resolve(newerWorkspace);

        await expect(newerLoad).resolves.toBe(true);
        expect(appStore.activeWorkspace).toEqual(newerWorkspace);
        expect(appStore.isLoadingWorkspace).toBe(false);

        olderFetch.resolve(olderWorkspace);
        await expect(olderLoad).resolves.toBe(false);
        expect(getWorkspace.mock.calls.map(([name]) => name)).toEqual(["older", "newer"]);
        expect(restore).toHaveBeenCalledTimes(1);
        expect(appStore.activeWorkspace).toEqual(newerWorkspace);
        expect(appStore.isLoadingWorkspace).toBe(false);
    });

    test("an older fetch failure cannot show a warning or undo a newer success", async () => {
        const olderFetch = deferred<Workspace | undefined>();
        jest.spyOn(console, "error").mockImplementation(jest.fn());
        const toaster = jest.spyOn(AppToaster, "show").mockImplementation(jest.fn());
        jest.spyOn(appStore.apiService, "getWorkspace").mockImplementation(name => (name === "older" ? olderFetch.promise : Promise.resolve(newerWorkspace)));
        jest.spyOn(WorkspaceRestorer.prototype, "restore").mockImplementation(function* () {
            return [];
        });

        const olderLoad = appStore.loadWorkspace("older");
        await expect(appStore.loadWorkspace("newer")).resolves.toBe(true);
        olderFetch.reject(new Error("stale fetch failed"));

        await expect(olderLoad).resolves.toBe(false);
        expect(toaster).not.toHaveBeenCalled();
        expect(appStore.activeWorkspace).toEqual(newerWorkspace);
        expect(appStore.isLoadingWorkspace).toBe(false);
    });

    test("a suspended older restore cannot become active after a newer load", async () => {
        const olderRestore = deferred<void>();
        const newerFetch = deferred<Workspace | undefined>();
        let notifyStarted!: () => void;
        const started = new Promise<void>(resolve => (notifyStarted = resolve));
        jest.spyOn(appStore.apiService, "getWorkspace").mockImplementation(name => (name === "older" ? Promise.resolve(olderWorkspace) : newerFetch.promise));
        let restoreCount = 0;
        const restore = jest.spyOn(WorkspaceRestorer.prototype, "restore").mockImplementation(function* () {
            if (++restoreCount === 1) {
                notifyStarted();
                yield olderRestore.promise;
            }
            return [];
        });

        const olderLoad = appStore.loadWorkspace("older");
        await started;
        expect(appStore.isLoadingWorkspace).toBe(true);
        const newerLoad = appStore.loadWorkspace("newer");
        olderRestore.resolve();
        await expect(olderLoad).resolves.toBe(false);
        expect(appStore.isLoadingWorkspace).toBe(true);
        expect(appStore.activeWorkspace).toBeUndefined();

        newerFetch.resolve(newerWorkspace);
        await expect(newerLoad).resolves.toBe(true);
        expect(restore).toHaveBeenCalledTimes(2);
        expect(appStore.activeWorkspace).toEqual(newerWorkspace);
        expect(appStore.isLoadingWorkspace).toBe(false);
    });

    test("a newer load skips the step that the older restore waits for, and does not show it", async () => {
        const newerFetch = deferred<Workspace | undefined>();
        jest.spyOn(appStore.apiService, "getWorkspace").mockImplementation(() => newerFetch.promise);
        const onSkip = jest.fn();
        appStore.setWorkspaceLoadingStep({description: "Computing the moment images of cube.fits", progress: 0.5, onSkip});

        const newerLoad = appStore.loadWorkspace("newer");

        expect(onSkip).toHaveBeenCalledTimes(1);
        expect(appStore.workspaceLoadingStep).toBeUndefined();
        newerFetch.resolve(undefined);
        jest.spyOn(AppToaster, "show").mockImplementation(jest.fn());
        await expect(newerLoad).resolves.toBe(false);
    });

    test("a failed newer fetch still prevents the older result from restoring", async () => {
        const olderFetch = deferred<Workspace | undefined>();
        const priorWorkspace = {workspaceVersion: 2, frontendVersion: 0, description: "prior"} as Workspace;
        runInAction(() => {
            appStore.activeWorkspace = priorWorkspace;
        });
        jest.spyOn(appStore.apiService, "getWorkspace").mockImplementation(name => (name === "older" ? olderFetch.promise : Promise.resolve(undefined)));
        const restore = jest.spyOn(WorkspaceRestorer.prototype, "restore");
        jest.spyOn(AppToaster, "show").mockImplementation(jest.fn());

        const olderLoad = appStore.loadWorkspace("older");
        await expect(appStore.loadWorkspace("newer")).resolves.toBe(false);
        olderFetch.resolve(olderWorkspace);

        await expect(olderLoad).resolves.toBe(false);
        expect(restore).not.toHaveBeenCalled();
        expect(appStore.activeWorkspace).toEqual(priorWorkspace);
        expect(appStore.isLoadingWorkspace).toBe(false);
    });
});

describe("AppStore.cancelLoadingWorkspace", () => {
    const appStore = AppStore.Instance;
    const workspace = {workspaceVersion: 2, frontendVersion: 0, name: "cubes", description: "cubes"} as Workspace;

    afterEach(() => {
        jest.restoreAllMocks();
        runInAction(() => {
            appStore.activeWorkspace = undefined;
            appStore.isLoadingWorkspace = false;
        });
    });

    test("stops the restore, skips the step it waits for, and leaves the session empty", async () => {
        const stage = deferred<void>();
        let notifyStarted!: () => void;
        const started = new Promise<void>(resolve => (notifyStarted = resolve));
        jest.spyOn(appStore.apiService, "getWorkspace").mockResolvedValue(workspace);
        let isRestoreFinished = false;
        jest.spyOn(WorkspaceRestorer.prototype, "restore").mockImplementation(function* () {
            notifyStarted();
            yield stage.promise;
            isRestoreFinished = true;
            return [];
        });
        const clearSession = jest.spyOn(WorkspaceRestorer, "clearSession").mockImplementation(jest.fn());
        const toaster = jest.spyOn(AppToaster, "show").mockImplementation(jest.fn());
        const onSkip = jest.fn();

        const load = appStore.loadWorkspace("cubes");
        await started;
        appStore.setWorkspaceRestoreProgress({stage: "Opening images", index: 1, count: 2, item: "cube.fits"});
        appStore.setWorkspaceLoadingStep({description: "Computing the cube histogram of cube.fits", progress: 0.5, onSkip});
        expect(appStore.loadingWorkspaceName).toBe("cubes");

        appStore.cancelLoadingWorkspace();

        expect(onSkip).toHaveBeenCalledTimes(1);
        expect(clearSession).toHaveBeenCalledTimes(1);
        expect(toaster).toHaveBeenCalledWith(expect.objectContaining({message: 'Cancelled opening workspace "cubes"'}));
        expect(appStore.isLoadingWorkspace).toBe(false);
        expect(appStore.workspaceLoadingStep).toBeUndefined();
        expect(appStore.workspaceRestoreProgress).toBeUndefined();

        stage.resolve();
        await expect(load).resolves.toBe(false);
        expect(isRestoreFinished).toBe(true);
        expect(appStore.activeWorkspace).toBeUndefined();
        expect(appStore.isLoadingWorkspace).toBe(false);
    });

    test("keeps the open images when the load is still reading the workspace", async () => {
        const fetch = deferred<Workspace | undefined>();
        jest.spyOn(appStore.apiService, "getWorkspace").mockReturnValue(fetch.promise);
        const restore = jest.spyOn(WorkspaceRestorer.prototype, "restore");
        const clearSession = jest.spyOn(WorkspaceRestorer, "clearSession").mockImplementation(jest.fn());
        jest.spyOn(AppToaster, "show").mockImplementation(jest.fn());

        const load = appStore.loadWorkspace("cubes");
        appStore.cancelLoadingWorkspace();
        fetch.resolve(workspace);

        await expect(load).resolves.toBe(false);
        expect(clearSession).not.toHaveBeenCalled();
        expect(restore).not.toHaveBeenCalled();
        expect(appStore.isLoadingWorkspace).toBe(false);
    });

    test("ends the wait for the user's choices, and removes them from the dialog", async () => {
        let notifyStarted!: () => void;
        const started = new Promise<void>(resolve => (notifyStarted = resolve));
        const recovery = new WorkspaceRecoveryStore("Opening images", [{kind: WorkspaceItemKind.Image, subject: "cube.fits", message: "Could not open the image cube.fits", repointKind: "image", canRetry: false, dependents: []}]);
        jest.spyOn(appStore.apiService, "getWorkspace").mockResolvedValue(workspace);
        jest.spyOn(WorkspaceRestorer.prototype, "restore").mockImplementation(function* () {
            appStore.setWorkspaceRecovery(recovery);
            notifyStarted();
            yield recovery.decided;
            return [];
        });
        jest.spyOn(WorkspaceRestorer, "clearSession").mockImplementation(jest.fn());
        jest.spyOn(AppToaster, "show").mockImplementation(jest.fn());

        const load = appStore.loadWorkspace("cubes");
        await started;
        expect(appStore.workspaceRecovery).toBe(recovery);
        appStore.cancelLoadingWorkspace();

        expect(appStore.workspaceRecovery).toBeUndefined();
        await expect(recovery.decided).resolves.toEqual([{action: "skip"}]);
        await expect(load).resolves.toBe(false);
    });

    test("does nothing when no workspace is loading", () => {
        const clearSession = jest.spyOn(WorkspaceRestorer, "clearSession").mockImplementation(jest.fn());

        appStore.cancelLoadingWorkspace();

        expect(clearSession).not.toHaveBeenCalled();
    });
});

describe("AppStore workspace restore report", () => {
    const appStore = AppStore.Instance;
    const workspace = {workspaceVersion: 2, frontendVersion: 0, name: "cubes", description: "cubes"} as Workspace;
    const issues: WorkspaceIssue[] = [
        {kind: WorkspaceItemKind.Image, subject: "cube.fits", message: "Could not open the image cube.fits", outcome: WorkspaceIssueOutcome.Failed},
        {kind: WorkspaceItemKind.Layout, subject: "", message: "Could not restore the layout the workspace was saved in"}
    ];

    afterEach(() => {
        jest.restoreAllMocks();
        runInAction(() => {
            appStore.activeWorkspace = undefined;
            appStore.isLoadingWorkspace = false;
            appStore.workspaceRestoreReport = undefined;
        });
    });

    test("shows the report when a restore brought something back differently, instead of a toast", async () => {
        jest.spyOn(appStore.apiService, "getWorkspace").mockResolvedValue(workspace);
        jest.spyOn(WorkspaceRestorer.prototype, "restore").mockImplementation(function* () {
            return issues;
        });
        const toaster = jest.spyOn(AppToaster, "show").mockImplementation(jest.fn());

        await expect(appStore.loadWorkspace("cubes")).resolves.toBe(true);

        expect(appStore.workspaceRestoreReport).toMatchObject({name: "cubes", issues});
        expect(toaster).not.toHaveBeenCalled();

        appStore.closeWorkspaceRestoreReport();
        expect(appStore.workspaceRestoreReport).toBeUndefined();
    });

    test("shows no report when everything was restored, and closes the report of the previous restore", async () => {
        jest.spyOn(appStore.apiService, "getWorkspace").mockResolvedValue(workspace);
        let restoreIssues = issues;
        jest.spyOn(WorkspaceRestorer.prototype, "restore").mockImplementation(function* () {
            return restoreIssues;
        });

        await appStore.loadWorkspace("cubes");
        expect(appStore.workspaceRestoreReport).toBeDefined();

        restoreIssues = [];
        await expect(appStore.loadWorkspace("cubes")).resolves.toBe(true);
        expect(appStore.workspaceRestoreReport).toBeUndefined();
    });

    describe("new file locations", () => {
        const repointed = {images: new Map([[1, {type: "file" as const, directory: "/new", filename: "cube.fits"}]]), catalogs: new Map()};
        const stored = {...workspace, files: [{id: 1, source: {type: "file" as const, directory: "/old", filename: "cube.fits"}, channel: 2}]} as Workspace;

        function restoreWithNewLocations() {
            jest.spyOn(WorkspaceRestorer.prototype, "restore").mockImplementation(function* (this: WorkspaceRestorer) {
                this.repointed.images = repointed.images;
                return [];
            });
        }

        test("shows the report when only new locations were chosen, and writes them to the workspace once", async () => {
            jest.spyOn(appStore.apiService, "getWorkspace").mockResolvedValue(stored);
            const setWorkspace = jest.spyOn(appStore.apiService, "setWorkspace").mockImplementation(async (_name, written) => written);
            jest.spyOn(AppToaster, "show").mockImplementation(jest.fn());
            restoreWithNewLocations();

            await appStore.loadWorkspace("cubes");
            expect(appStore.workspaceRestoreReport).toMatchObject({name: "cubes", issues: [], storedName: "cubes"});
            expect(appStore.workspaceWriteBack).toBe("none");

            await expect(appStore.writeBackRepointedLocations()).resolves.toBe(true);
            await expect(appStore.writeBackRepointedLocations()).resolves.toBe(false);

            expect(setWorkspace).toHaveBeenCalledTimes(1);
            expect(setWorkspace).toHaveBeenCalledWith("cubes", {...stored, files: [{id: 1, source: {type: "file", directory: "/new", filename: "cube.fits"}, channel: 2}]});
            expect(appStore.workspaceWriteBack).toBe("written");
        });

        test("does not offer to write a workspace that was opened through a shared link", async () => {
            jest.spyOn(appStore.apiService, "getWorkspace").mockResolvedValue(stored);
            const setWorkspace = jest.spyOn(appStore.apiService, "setWorkspace");
            restoreWithNewLocations();

            await appStore.loadWorkspace("shared-key", true);

            expect(appStore.workspaceRestoreReport?.storedName).toBeUndefined();
            await expect(appStore.writeBackRepointedLocations()).resolves.toBe(false);
            expect(setWorkspace).not.toHaveBeenCalled();
        });

        test("lets the user try again when the workspace could not be written", async () => {
            jest.spyOn(appStore.apiService, "getWorkspace").mockResolvedValue(stored);
            jest.spyOn(appStore.apiService, "setWorkspace").mockResolvedValue(undefined);
            const toaster = jest.spyOn(AppToaster, "show").mockImplementation(jest.fn());
            restoreWithNewLocations();

            await appStore.loadWorkspace("cubes");
            await expect(appStore.writeBackRepointedLocations()).resolves.toBe(false);

            expect(appStore.workspaceWriteBack).toBe("none");
            expect(toaster).toHaveBeenCalledWith(expect.objectContaining({message: 'Could not save the new locations in workspace "cubes"', intent: "danger"}));
        });
    });
});

describe("AppStore load error alerts", () => {
    const appStore = AppStore.Instance;

    beforeEach(() => {
        appStore.alertStore.dismissAlert();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        appStore.alertStore.dismissAlert();
        runInAction(() => {
            appStore.isLoadingWorkspace = false;
        });
    });

    test("shows no alert for a file that a cancelled restore was still opening", async () => {
        const ack = deferred<never>();
        jest.spyOn(console, "error").mockImplementation(jest.fn());
        jest.spyOn(appStore.backendService, "loadFile").mockReturnValue(ack.promise);
        runInAction(() => {
            appStore.isLoadingWorkspace = true;
        });

        const load = appStore.loadFile("/data", "missing.fits", "", false);
        runInAction(() => {
            appStore.isLoadingWorkspace = false;
        });
        ack.reject(new Error("File /data/missing.fits does not exist"));

        await expect(load).rejects.toThrow("does not exist");
        expect(appStore.alertStore.isAlertVisible ? appStore.alertStore.alertText : undefined).toBeUndefined();
    });

    test("shows the alert for a file that the user opens", async () => {
        jest.spyOn(console, "error").mockImplementation(jest.fn());
        jest.spyOn(appStore.backendService, "loadFile").mockRejectedValue(new Error("File /data/missing.fits does not exist"));

        await expect(appStore.loadFile("/data", "missing.fits", "", false)).rejects.toThrow("does not exist");
        expect(appStore.alertStore.isAlertVisible).toBe(true);
        expect(appStore.alertStore.alertText).toContain("Error loading file");
    });
});
