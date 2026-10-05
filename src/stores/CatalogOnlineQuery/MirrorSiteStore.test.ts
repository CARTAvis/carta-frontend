import {CatalogDatabase, PreferenceKeys, SimbadMirror} from "enums";
import {ApiService} from "services";
import {PreferenceStore} from "stores/PreferenceStore/PreferenceStore";
import {CATALOG_MIRROR_URLS} from "utilities/catalog/constants";

import {MirrorSiteStore} from "./MirrorSiteStore";

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

describe("[unit] MirrorSiteStore", () => {
    const mirrorStore = MirrorSiteStore.Instance;
    const preferenceKey = PreferenceKeys.CATALOG_QUERY_SIMBAD_ENABLED_MIRRORS;
    const strasbourgUrl = CATALOG_MIRROR_URLS[SimbadMirror.STRASBOURG];
    const cfaHarvardUrl = CATALOG_MIRROR_URLS[SimbadMirror.CFA_HARVARD];

    beforeEach(() => {
        PreferenceStore.Instance.preferences.clear();
        mirrorStore.resetAllSettings();
        jest.clearAllMocks();
    });

    test("stores only mirror enum values in the enabled preference and preserves their order", () => {
        mirrorStore.setEnabledMirrors(CatalogDatabase.SIMBAD, [cfaHarvardUrl, strasbourgUrl]);

        expect(PreferenceStore.Instance.preferences.get(preferenceKey)).toEqual([SimbadMirror.CFA_HARVARD, SimbadMirror.STRASBOURG]);
        expect(ApiService.Instance.setPreference).toHaveBeenCalledWith(preferenceKey, [SimbadMirror.CFA_HARVARD, SimbadMirror.STRASBOURG]);
    });

    test("keeps disabled mirrors out of the enabled preference and appends them after enabled mirrors", () => {
        mirrorStore.setEnabledMirrors(CatalogDatabase.SIMBAD, [cfaHarvardUrl]);

        expect(mirrorStore.getMirrorSites(CatalogDatabase.SIMBAD)).toEqual([cfaHarvardUrl, strasbourgUrl]);
        expect(mirrorStore.isMirrorUserDisabled(CatalogDatabase.SIMBAD, strasbourgUrl)).toBe(true);
    });

    test("uses the first available mirror when no active mirror has been selected", () => {
        expect(mirrorStore.getActiveMirror(CatalogDatabase.SIMBAD)).toBe(strasbourgUrl);

        mirrorStore.setEnabledMirrors(CatalogDatabase.SIMBAD, [cfaHarvardUrl]);

        expect(mirrorStore.getActiveMirror(CatalogDatabase.SIMBAD)).toBe(cfaHarvardUrl);
    });

    test("prefers the selected mirror over the default order", () => {
        mirrorStore.setActiveMirror(CatalogDatabase.SIMBAD, cfaHarvardUrl);

        expect(mirrorStore.getActiveMirror(CatalogDatabase.SIMBAD)).toBe(cfaHarvardUrl);
    });

    test("enables a disabled mirror after the existing enabled mirrors", () => {
        mirrorStore.setEnabledMirrors(CatalogDatabase.SIMBAD, [cfaHarvardUrl]);

        mirrorStore.toggleMirror(CatalogDatabase.SIMBAD, strasbourgUrl);

        expect(ApiService.Instance.setPreference).toHaveBeenLastCalledWith(preferenceKey, [SimbadMirror.CFA_HARVARD, SimbadMirror.STRASBOURG]);
    });

    test("does not disable the last enabled mirror", () => {
        mirrorStore.setEnabledMirrors(CatalogDatabase.SIMBAD, [cfaHarvardUrl]);

        mirrorStore.toggleMirror(CatalogDatabase.SIMBAD, cfaHarvardUrl);

        expect(ApiService.Instance.setPreference).toHaveBeenCalledWith(preferenceKey, [SimbadMirror.CFA_HARVARD]);
    });
});
