import {CustomUIStore} from "./CustomUIStore";

describe("CustomUIStore", () => {
    let store: CustomUIStore;
    const handlers = {
        floatWidget: jest.fn(),
        closeWidget: jest.fn(),
        openDialog: jest.fn(),
        closeDialog: jest.fn()
    };

    beforeEach(() => {
        store = CustomUIStore.Instance;
        store.clear();
        jest.clearAllMocks();
        store.setHostHandlers(handlers);
    });

    test("registerWidget stores a keyed widget definition", () => {
        store.registerWidget("w", {title: "W", schema: {type: "object"}});
        const def = store.definitions.get("w");
        expect(def).toMatchObject({id: "w", surface: "widget", title: "W"});
    });

    test("register replaces an existing id (idempotent) and runs prior cleanup", () => {
        const cleanup = jest.fn();
        store.registerWidget("w", {render: () => cleanup});
        store.setCleanup("w", cleanup);
        store.registerWidget("w", {title: "again", schema: {type: "object"}});
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(store.definitions.get("w")?.title).toBe("again");
        expect(store.definitions.size).toBe(1);
    });

    test("schema and render together: schema wins with a warning", () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        store.registerWidget("w", {schema: {type: "object"}, render: () => {}});
        expect(warn).toHaveBeenCalled();
        expect(store.definitions.get("w")?.render).toBeUndefined();
        expect(store.definitions.get("w")?.schema).toBeDefined();
    });

    test("update replaces formData; getData reads it", () => {
        store.registerWidget("w", {schema: {type: "object"}, formData: {a: 1}});
        store.update("w", {a: 2});
        expect(store.getData("w")).toEqual({a: 2});
    });

    test("open/close route to host handlers by surface", () => {
        store.registerWidget("w", {schema: {type: "object"}});
        store.registerDialog("d", {schema: {type: "object"}});

        store.open("w");
        expect(handlers.floatWidget).toHaveBeenCalledWith("w", expect.objectContaining({id: "w"}));
        store.close("w");
        expect(handlers.closeWidget).toHaveBeenCalledWith("w");

        store.open("d");
        expect(handlers.openDialog).toHaveBeenCalledWith("d");
        store.close("d");
        expect(handlers.closeDialog).toHaveBeenCalledWith("d");
    });

    test("unregister runs cleanup, removes the definition, and closes its host", () => {
        const cleanup = jest.fn();
        store.registerWidget("w", {render: () => {}});
        store.setCleanup("w", cleanup);
        store.unregister("w");
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(store.definitions.has("w")).toBe(false);
        expect(handlers.closeWidget).toHaveBeenCalledWith("w");
    });

    test("clear empties the registry and runs all cleanups", () => {
        const c1 = jest.fn();
        store.registerWidget("a", {render: () => {}});
        store.setCleanup("a", c1);
        store.registerDialog("b", {schema: {type: "object"}});
        store.clear();
        expect(c1).toHaveBeenCalledTimes(1);
        expect(store.definitions.size).toBe(0);
    });

    test("open returns a handle for a registered id and undefined for an unknown id", () => {
        store.registerWidget("w", {schema: {type: "object"}});
        const handle = store.open("w");
        expect(handle).toMatchObject({id: "w", surface: "widget"});
        expect(typeof handle?.close).toBe("function");
        expect(typeof handle?.onClose).toBe("function");
        expect(store.open("missing")).toBeUndefined();
    });

    test("handle.onClose fires once per open (notifyClosed is idempotent); reopen to fire again", () => {
        store.registerDialog("d", {schema: {type: "object"}});
        const onClose = jest.fn();
        store.open("d")?.onClose(onClose);

        store.notifyClosed("d");
        expect(onClose).toHaveBeenCalledTimes(1);
        // Already closed: a second notifyClosed without reopening is a no-op (no double-fire).
        store.notifyClosed("d");
        expect(onClose).toHaveBeenCalledTimes(1);

        // Reopen + re-register the callback on the fresh handle → next close fires again.
        const onClose2 = jest.fn();
        store.open("d")?.onClose(onClose2);
        store.notifyClosed("d");
        expect(onClose2).toHaveBeenCalledTimes(1);
    });

    test("open is idempotent: opening an already-open widget does not float a duplicate", () => {
        store.registerWidget("w", {schema: {type: "object"}});
        store.open("w");
        store.open("w");
        expect(handlers.floatWidget).toHaveBeenCalledTimes(1);
    });

    test("handle.close fires onClose and routes to the close host handler by surface", () => {
        store.registerWidget("w", {schema: {type: "object"}});
        const onClose = jest.fn();
        store.open("w")?.onClose(onClose);
        store.close("w");
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(handlers.closeWidget).toHaveBeenCalledWith("w");
    });

    test("unregister closes an open surface and fires its onClose", () => {
        store.registerDialog("d", {schema: {type: "object"}});
        const onClose = jest.fn();
        store.open("d")?.onClose(onClose);
        store.unregister("d");
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(handlers.closeDialog).toHaveBeenCalledWith("d");
        // The callback is gone; a later notifyClosed cannot re-fire it.
        store.notifyClosed("d");
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("re-registering an id with a different surface closes the old open surface (and fires its onClose)", () => {
        store.registerWidget("x", {schema: {type: "object"}});
        const onClose = jest.fn();
        store.open("x")?.onClose(onClose);
        // Collision: "x" becomes a dialog while the widget is open.
        store.registerDialog("x", {schema: {type: "object"}});
        expect(handlers.closeWidget).toHaveBeenCalledWith("x");
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(store.definitions.get("x")?.surface).toBe("dialog");
    });

    test("a throwing onClose callback is isolated", () => {
        jest.spyOn(console, "error").mockImplementation(() => {});
        store.registerDialog("d", {schema: {type: "object"}});
        store.open("d")?.onClose(() => {
            throw new Error("boom");
        });
        expect(() => store.notifyClosed("d")).not.toThrow();
    });
});
