import {PreferenceKeys} from "enums";
import {PreferenceStore} from "stores";

jest.mock("services", () => ({
    ApiService: {Instance: {setPreference: jest.fn().mockResolvedValue(true), clearPreferences: jest.fn().mockResolvedValue(true)}}
}));

describe("PreferenceStore", () => {
    it("turns code snippets on for this session only, and turns them off again when the preference changes", async () => {
        const store = PreferenceStore.Instance;
        await store.setPreference(PreferenceKeys.GLOBAL_CODE_SNIPPETS_ENABLED, false);

        store.setCodeSnippetsEnabledForSession(true);
        expect([store.isCodeSnippetsEnabled, store.areCodeSnippetsShown]).toEqual([false, true]);

        // Another preference keeps them on.
        await store.setPreference(PreferenceKeys.PIXEL_GRID_VISIBLE, true);
        expect(store.areCodeSnippetsShown).toBe(true);

        await store.setPreference(PreferenceKeys.GLOBAL_CODE_SNIPPETS_ENABLED, false);
        expect(store.areCodeSnippetsShown).toBe(false);

        store.setCodeSnippetsEnabledForSession(true);
        await store.clearPreferences([PreferenceKeys.GLOBAL_CODE_SNIPPETS_ENABLED]);
        expect(store.isCodeSnippetsEnabledForSession).toBe(false);
    });
});
