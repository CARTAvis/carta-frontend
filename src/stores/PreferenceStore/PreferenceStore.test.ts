import {CatalogDatabase, PreferenceKeys, SimbadMirror} from "enums";
import {ApiService} from "services";
import {CATALOG_MIRROR_URLS} from "utilities/catalog/constants";

import {PreferenceStore} from "./PreferenceStore";

jest.mock("models", () => ({
    CARTA_INFO: {version: "test"},
    CompressionQuality: {IMAGE_DEFAULT: 1, ANIMATION_DEFAULT: 1},
    CursorPosition: {TRACKING: "tracking", FIXED: "fixed"},
    Event: {EVENT_NUMBER: 0, EVENT_TYPES: [], isTypeValid: jest.fn(() => false)},
    getEventList: jest.fn(),
    PresetLayout: {DEFAULT: {}},
    RegionCreationMode: {CENTER: "center", CORNER: "corner"},
    Theme: {AUTO: "auto"},
    TileCache: {GPU_DEFAULT: 1, SYSTEM_DEFAULT: 1},
    WCSMatching: {isTypeValid: jest.fn(() => false)},
    WCSType: {AUTOMATIC: "automatic"},
    Zoom: {FIT: "fit", FULL: "full"},
    ZoomPoint: {CURSOR: "cursor"}
}));

jest.mock("services", () => ({
    ApiService: {
        Instance: {
            clearPreferences: jest.fn().mockResolvedValue(true),
            setPreference: jest.fn().mockResolvedValue(true)
        }
    }
}));

describe("[unit] PreferenceStore mirror settings", () => {
    const store = PreferenceStore.Instance;
    const preferenceKey = PreferenceKeys.CATALOG_QUERY_SIMBAD_ENABLED_MIRRORS;
    const strasbourgUrl = CATALOG_MIRROR_URLS[SimbadMirror.STRASBOURG];
    const cfaHarvardUrl = CATALOG_MIRROR_URLS[SimbadMirror.CFA_HARVARD];

    beforeEach(() => {
        store.preferences.clear();
        jest.clearAllMocks();
    });

    test("stores only mirror enum values in the enabled preference and preserves their order", () => {
        store.setCatalogQueryEnabledMirrors(CatalogDatabase.SIMBAD, [cfaHarvardUrl, strasbourgUrl]);

        expect(store.preferences.get(preferenceKey)).toEqual([SimbadMirror.CFA_HARVARD, SimbadMirror.STRASBOURG]);
        expect(ApiService.Instance.setPreference).toHaveBeenCalledWith(preferenceKey, [SimbadMirror.CFA_HARVARD, SimbadMirror.STRASBOURG]);
    });

    test("keeps disabled mirrors out of the enabled preference and appends them after enabled mirrors", () => {
        store.setCatalogQueryEnabledMirrors(CatalogDatabase.SIMBAD, [cfaHarvardUrl]);

        expect(store.getCatalogQueryMirrors(CatalogDatabase.SIMBAD)).toEqual([cfaHarvardUrl, strasbourgUrl]);
        expect(store.isCatalogQueryMirrorUserDisabled(CatalogDatabase.SIMBAD, strasbourgUrl)).toBe(true);
    });

    test("enables a disabled mirror after the existing enabled mirrors", () => {
        store.setCatalogQueryEnabledMirrors(CatalogDatabase.SIMBAD, [cfaHarvardUrl]);

        store.toggleCatalogQueryMirrorDisabled(CatalogDatabase.SIMBAD, strasbourgUrl);

        expect(store.preferences.get(preferenceKey)).toEqual([SimbadMirror.CFA_HARVARD, SimbadMirror.STRASBOURG]);
    });

    test("does not disable the last enabled mirror", () => {
        store.setCatalogQueryEnabledMirrors(CatalogDatabase.SIMBAD, [cfaHarvardUrl]);

        store.toggleCatalogQueryMirrorDisabled(CatalogDatabase.SIMBAD, cfaHarvardUrl);

        expect(store.preferences.get(preferenceKey)).toEqual([SimbadMirror.CFA_HARVARD]);
    });
});
