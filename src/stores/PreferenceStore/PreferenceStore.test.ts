import {ExportBackgroundColor, PreferenceKeys} from "enums";
import {PreferenceStore} from "stores";

jest.mock("services", () => ({ApiService: {Instance: {}}}));

describe("exportBackgroundColor preference migration", () => {
    const store = PreferenceStore.Instance;

    beforeEach(() => store.preferences.clear());

    afterAll(() => store.preferences.clear());

    test("uses the legacy transparent-background preference when the new preference is unset", () => {
        store.preferences.set(PreferenceKeys.GLOBAL_TRANSPARENT_IMAGE_BACKGROUND, true);

        expect(store.exportBackgroundColor).toBe(ExportBackgroundColor.TRANSPARENT);
    });

    test("prefers a valid new export background over the legacy preference", () => {
        store.preferences.set(PreferenceKeys.GLOBAL_TRANSPARENT_IMAGE_BACKGROUND, true);
        store.preferences.set(PreferenceKeys.RENDER_CONFIG_EXPORT_BACKGROUND_COLOR, ExportBackgroundColor.WHITE);

        expect(store.exportBackgroundColor).toBe(ExportBackgroundColor.WHITE);
    });
});
