import {PreferenceKeys} from "enums";
import {ApiService} from "services";
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

    it("gives the keys of each write as a new array, also when the write keeps the value", async () => {
        const store = PreferenceStore.Instance;

        await store.setPreference(PreferenceKeys.PIXEL_GRID_VISIBLE, true);
        const firstWrite = store.lastWrittenKeys;
        await store.setPreference(PreferenceKeys.PIXEL_GRID_VISIBLE, true);
        expect(store.lastWrittenKeys).toEqual([PreferenceKeys.PIXEL_GRID_VISIBLE]);
        expect(store.lastWrittenKeys).not.toBe(firstWrite);

        await store.clearPreferences([PreferenceKeys.PIXEL_GRID_VISIBLE, PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX]);
        expect(store.lastWrittenKeys).toEqual([PreferenceKeys.PIXEL_GRID_VISIBLE, PreferenceKeys.RENDER_CONFIG_NAN_COLOR_HEX]);
        expect(ApiService.Instance.clearPreferences).toHaveBeenCalled();
    });

    it("gives no keys for a value that it refuses", async () => {
        const store = PreferenceStore.Instance;
        await store.clearPreferences([PreferenceKeys.GLOBAL_THEME]);

        await store.setPreference(PreferenceKeys.RENDER_CONFIG_SCALING, -1);

        expect(store.lastWrittenKeys).toEqual([PreferenceKeys.GLOBAL_THEME]);
    });
});
