import {action, makeObservable, observable} from "mobx";

import {LogStore} from "stores/LogStore/LogStore";

import {HookStore} from "./HookStore";

describe("HookStore core", () => {
    let store: HookStore;

    beforeEach(() => {
        store = HookStore.Instance;
        store.clear();
        jest.restoreAllMocks();
    });

    test("set registers a hook discoverable via has/list", () => {
        const handler = jest.fn();
        store.set("a", "fileLoaded", handler);
        expect(store.has("a")).toBe(true);
        expect(store.list()).toEqual([{id: "a", event: "fileLoaded", options: undefined}]);
    });

    test("trigger dispatches only to hooks registered for that event", () => {
        const onLoad = jest.fn();
        const onClose = jest.fn();
        store.set("load", "fileLoaded", onLoad);
        store.set("close", "fileClosed", onClose);

        store.trigger("fileLoaded", {fileId: 7});

        expect(onLoad).toHaveBeenCalledTimes(1);
        expect(onLoad).toHaveBeenCalledWith({fileId: 7});
        expect(onClose).not.toHaveBeenCalled();
    });

    test("re-set with same id replaces the prior handler", () => {
        const first = jest.fn();
        const second = jest.fn();
        store.set("x", "fileLoaded", first);
        store.set("x", "fileLoaded", second);

        store.trigger("fileLoaded", {});

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
        expect(store.list()).toHaveLength(1);
    });

    test("delete and clear remove hooks", () => {
        store.set("a", "fileLoaded", jest.fn());
        store.set("b", "fileClosed", jest.fn());
        store.delete("a");
        expect(store.has("a")).toBe(false);
        expect(store.has("b")).toBe(true);
        store.clear();
        expect(store.list()).toHaveLength(0);
    });

    test("a throwing handler is isolated; other hooks still fire and nothing throws", () => {
        const errorSpy = jest.spyOn(LogStore.Instance, "addError").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
        const boom = jest.fn(() => {
            throw new Error("boom");
        });
        const ok = jest.fn();
        store.set("boom", "fileLoaded", boom);
        store.set("ok", "fileLoaded", ok);

        expect(() => store.trigger("fileLoaded", {})).not.toThrow();
        expect(ok).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalled();
    });

    test("a rejecting async handler is isolated and logged", async () => {
        const errorSpy = jest.spyOn(LogStore.Instance, "addError").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
        store.set("reject", "fileLoaded", async () => {
            throw new Error("async boom");
        });

        store.trigger("fileLoaded", {});
        await Promise.resolve();
        await Promise.resolve();

        expect(errorSpy).toHaveBeenCalled();
    });
});

describe("HookStore rate-control", () => {
    let store: HookStore;

    beforeEach(() => {
        jest.useFakeTimers();
        store = HookStore.Instance;
        store.clear();
        jest.restoreAllMocks();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    test("debounce coalesces rapid triggers into a single trailing call with the latest payload", () => {
        const handler = jest.fn();
        store.set("d", "cursorMoved", handler, {debounce: 200});

        store.trigger("cursorMoved", {n: 1});
        store.trigger("cursorMoved", {n: 2});
        store.trigger("cursorMoved", {n: 3});
        expect(handler).not.toHaveBeenCalled(); // lodash debounce default leading:false

        jest.advanceTimersByTime(200);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith({n: 3});
    });

    test("throttle fires leading immediately then trailing after the window", () => {
        const handler = jest.fn();
        store.set("t", "zoomChanged", handler, {throttle: {wait: 100}});

        store.trigger("zoomChanged", {z: 1}); // leading
        expect(handler).toHaveBeenCalledTimes(1);
        store.trigger("zoomChanged", {z: 2});
        store.trigger("zoomChanged", {z: 3});
        jest.advanceTimersByTime(100); // trailing
        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenLastCalledWith({z: 3});
    });

    test("debounce with leading:true fires immediately", () => {
        const handler = jest.fn();
        store.set("dl", "panChanged", handler, {debounce: {wait: 50, leading: true, trailing: false}});
        store.trigger("panChanged", {});
        expect(handler).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(50);
        expect(handler).toHaveBeenCalledTimes(1); // trailing disabled
    });

    test("delete cancels a pending debounced call", () => {
        const handler = jest.fn();
        store.set("d", "cursorMoved", handler, {debounce: 200});
        store.trigger("cursorMoved", {});
        store.delete("d");
        jest.advanceTimersByTime(500);
        expect(handler).not.toHaveBeenCalled();
    });

    test("re-set cancels the previous wrapper's pending timer", () => {
        const first = jest.fn();
        const second = jest.fn();
        store.set("d", "cursorMoved", first, {debounce: 200});
        store.trigger("cursorMoved", {});
        store.set("d", "cursorMoved", second, {debounce: 200});
        jest.advanceTimersByTime(500);
        expect(first).not.toHaveBeenCalled();
        expect(second).not.toHaveBeenCalled(); // second was never triggered
    });

    test("supplying both debounce and throttle warns and uses debounce", () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        const handler = jest.fn();
        store.set("both", "cursorMoved", handler, {debounce: 100, throttle: 100});
        expect(warnSpy).toHaveBeenCalled();

        store.trigger("cursorMoved", {});
        expect(handler).not.toHaveBeenCalled(); // debounce: no leading call
        jest.advanceTimersByTime(100);
        expect(handler).toHaveBeenCalledTimes(1);
    });
});

class Counter {
    @observable value = 0;
    constructor() {
        makeObservable(this);
    }
    @action.bound increment(by: number) {
        this.value += by;
    }
}

describe("HookStore generic action path", () => {
    let store: HookStore;

    beforeEach(() => {
        store = HookStore.Instance;
        store.clear();
        jest.restoreAllMocks();
    });

    afterEach(() => {
        store.clear();
    });

    test("an action:<name> hook fires when the named MobX action runs", () => {
        const handler = jest.fn();
        store.set("countHook", "action:increment", handler);

        const counter = new Counter();
        counter.increment(5);

        expect(handler).toHaveBeenCalledTimes(1);
        const payload = handler.mock.calls[0][0];
        expect(payload.name).toBe("increment");
        expect(payload.arguments).toEqual([5]);
    });

    test("the spy listener is installed only while >=1 generic hook exists", () => {
        // No spy yet: a named action does nothing observable.
        const counter = new Counter();
        const handler = jest.fn();
        store.set("h", "action:increment", handler);
        counter.increment(1);
        expect(handler).toHaveBeenCalledTimes(1);

        // Removing the last generic hook disposes the spy: further actions are not dispatched.
        store.delete("h");
        const handler2 = jest.fn();
        // Re-register a *curated* (non-generic) hook only; spy should stay disposed.
        store.set("curated", "fileLoaded", handler2);
        counter.increment(1);
        expect(handler).toHaveBeenCalledTimes(1); // unchanged
    });
});
