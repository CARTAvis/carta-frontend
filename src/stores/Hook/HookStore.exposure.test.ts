import {AppStore} from "stores";

import {HookStore} from "./HookStore";

describe("HookStore exposure", () => {
    test("app.hooks resolves to the HookStore singleton", () => {
        expect(AppStore.Instance.hooks).toBe(HookStore.Instance);
    });
});
