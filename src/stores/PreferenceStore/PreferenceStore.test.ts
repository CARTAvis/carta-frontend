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

    describe("values of a workspace for the session", () => {
        const store = PreferenceStore.Instance;

        beforeEach(async () => {
            store.clearSessionPreferences();
            await store.clearPreferences([PreferenceKeys.REGION_COLOR, PreferenceKeys.REGION_LINE_WIDTH, PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING, PreferenceKeys.RENDER_CONFIG_SCALING_ALPHA_LOG]);
        });

        it("uses the saved values in place of the stored preferences, and keeps only the ones that differ from the user's own", async () => {
            await store.setPreference(PreferenceKeys.REGION_COLOR, "#ff0000");

            const {rejectedKeys} = store.applySessionPreferences({regionColor: "#00ff00", regionLineWidth: 2});

            expect([store.regionColor, store.regionLineWidth]).toEqual(["#00ff00", 2]);
            expect(store.preferences.get(PreferenceKeys.REGION_COLOR)).toBe("#ff0000");
            expect([...store.sessionPreferences.keys()]).toEqual([PreferenceKeys.REGION_COLOR]);
            expect(rejectedKeys).toEqual([]);
        });

        it("keeps no session value for a color that differs from the user's own only in case", async () => {
            await store.setPreference(PreferenceKeys.REGION_COLOR, "#FF0000");

            store.applySessionPreferences({regionColor: "#ff0000"});

            expect(store.hasSessionPreferences).toBe(false);
        });

        it("accepts the custom colormap of one color as the default colormap", () => {
            const {rejectedKeys} = store.applySessionPreferences({colormap: "custom", colormapHex: "#00ff00"});

            expect(rejectedKeys).toEqual([]);
            expect([store.colormap, store.colormapHex]).toEqual(["custom", "#00ff00"]);
        });

        it("leaves out a key that a workspace does not save, and a value that the preference does not accept", () => {
            const {rejectedKeys} = store.applySessionPreferences({theme: "dark", regionColor: "not a color", regionLineWidth: 100, unknownKey: 1, colorbarPosition: "top"});

            expect(rejectedKeys).toEqual(["theme", "regionColor", "regionLineWidth", "unknownKey"]);
            expect([...store.sessionPreferences.keys()]).toEqual([PreferenceKeys.WCS_OVERLAY_COLORBAR_POSITION]);
        });

        it("keeps a scaling alpha within the range that the preference allows", () => {
            store.applySessionPreferences({scalingAlphaLog: 1e12});

            expect(store.scalingAlphaLog).toBeLessThan(1e12);
        });

        it("replaces the values of a previous workspace, and clears them for a workspace that saved none", () => {
            store.applySessionPreferences({regionColor: "#00ff00"});
            store.applySessionPreferences({regionLineWidth: 3});
            expect([...store.sessionPreferences.keys()]).toEqual([PreferenceKeys.REGION_LINE_WIDTH]);

            store.applySessionPreferences(undefined);
            expect(store.hasSessionPreferences).toBe(false);
        });

        it("uses the user's value again for a preference that the user sets or resets", async () => {
            store.applySessionPreferences({regionColor: "#00ff00", regionLineWidth: 3});

            await store.setPreference(PreferenceKeys.REGION_COLOR, "#0000ff");
            expect([store.regionColor, store.sessionPreferences.has(PreferenceKeys.REGION_COLOR)]).toEqual(["#0000ff", false]);

            await store.clearPreferences([PreferenceKeys.REGION_LINE_WIDTH]);
            expect([store.regionLineWidth, store.hasSessionPreferences]).toEqual([2, false]);
        });

        it("toggles a WCS matching type from the value in effect", async () => {
            store.applySessionPreferences({autoWCSMatching: 3});

            await store.setPreference(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING, 1);

            expect(store.autoWCSMatching).toBe(2);
            expect(store.sessionPreferences.has(PreferenceKeys.GLOBAL_AUTO_WCS_MATCHING)).toBe(false);
        });

        it("uses every stored preference again when the session values are cleared", () => {
            store.applySessionPreferences({regionColor: "#00ff00"});

            store.clearSessionPreferences();

            expect(store.regionColor).toBe("#2ee6d6");
        });
    });
});
