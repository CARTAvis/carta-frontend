import {AppStore, CustomUIStore} from "stores";

describe("app.ui facade", () => {
    beforeEach(() => CustomUIStore.Instance.clear());

    test("app.ui resolves and registerWidget reaches the store", () => {
        AppStore.Instance.ui.registerWidget("w", {schema: {type: "object"}});
        expect(CustomUIStore.Instance.definitions.has("w")).toBe(true);
    });

    test("app.ui.plot registers a widget bound to the plot field", () => {
        AppStore.Instance.ui.plot("p", {data: [{x: [1], y: [2]}]});
        const def = CustomUIStore.Instance.definitions.get("p");
        expect(def?.uiSchema).toEqual({plot: {"ui:field": "plot"}});
        expect(def?.formData).toEqual({plot: {data: [{x: [1], y: [2]}]}});
    });

    test("open returns a handle whose onClose fires when the dialog is closed", () => {
        const appStore = AppStore.Instance;
        appStore.ui.registerDialog("d", {schema: {type: "object"}});
        const handle = appStore.ui.open("d");
        expect(handle?.id).toBe("d");

        const onClose = jest.fn();
        handle?.onClose(onClose);
        expect(onClose).not.toHaveBeenCalled();

        // Closing flips DialogStore visibility; the AppStore close-detection reaction
        // then calls customUIStore.notifyClosed -> the onClose callback.
        appStore.ui.close("d");
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
