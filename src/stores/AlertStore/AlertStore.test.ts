import {AlertType} from "enums";

import {AlertStore} from "./AlertStore";

describe("AlertStore", () => {
    const store = AlertStore.Instance;

    afterEach(() => {
        while (store.isAlertVisible) {
            store.handleInteractiveAlertClosed(false);
        }
    });

    test("shows interactive alerts in order without orphaning their promises", async () => {
        const firstResult = store.showInteractiveAlert("First");
        const secondResult = store.showRetryAlert("Second");

        expect(store.interactiveAlertText).toBe("First");
        expect(store.alertType).toBe(AlertType.Interactive);

        store.handleInteractiveAlertClosed(true);

        await expect(firstResult).resolves.toBe(true);
        expect(store.interactiveAlertText).toBe("Second");
        expect(store.alertType).toBe(AlertType.Retry);
        expect(store.isAlertVisible).toBe(true);

        store.handleInteractiveAlertClosed(false);
        await expect(secondResult).resolves.toBe(false);
    });

    test("dismisses a queued alert without replacing the active alert", async () => {
        const activeResult = store.showInteractiveAlert("Active");
        const queuedResult = store.showInteractiveAlert("Queued");

        store.dismissInteractiveAlert(queuedResult);

        await expect(queuedResult).resolves.toBe(false);
        expect(store.interactiveAlertText).toBe("Active");
        expect(store.isAlertVisible).toBe(true);

        store.handleInteractiveAlertClosed(true);
        await expect(activeResult).resolves.toBe(true);
        expect(store.isAlertVisible).toBe(false);
    });
});
