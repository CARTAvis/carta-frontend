import {runInAction} from "mobx";

import {AppToaster} from "components/Shared";
import {type Workspace} from "models";
import {AppStore, WorkspaceRestorer} from "stores";

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
