import {action, makeObservable, observable} from "mobx";

import {CatalogDatabase, PreferenceKeys} from "enums";
import {PreferenceStore} from "stores/PreferenceStore/PreferenceStore";
import {CATALOG_MIRROR_URLS, CATALOG_MIRRORS_BY_DATABASE} from "utilities/catalog/constants";
import type {CatalogMirror} from "utilities/catalog/types";

const MIRROR_PREFERENCE_KEYS: Record<CatalogDatabase, PreferenceKeys> = {
    [CatalogDatabase.SIMBAD]: PreferenceKeys.CATALOG_QUERY_SIMBAD_ENABLED_MIRRORS,
    [CatalogDatabase.VIZIER]: PreferenceKeys.CATALOG_QUERY_VIZIER_ENABLED_MIRRORS
};

const IsSecurePage = (): boolean => typeof window !== "undefined" && window.location.protocol === "https:";

export class MirrorSiteStore {
    private static staticInstance: MirrorSiteStore;

    @observable private activeMirrors: Map<CatalogDatabase, CatalogMirror> = new Map();

    public static get Instance() {
        if (!MirrorSiteStore.staticInstance) {
            MirrorSiteStore.staticInstance = new MirrorSiteStore();
        }
        return MirrorSiteStore.staticInstance;
    }

    constructor() {
        makeObservable(this);
    }

    public getMirrorSites(database: CatalogDatabase): string[] {
        return this.getMirrorIds(database).map(mirror => CATALOG_MIRROR_URLS[mirror]);
    }

    public setEnabledMirrors(database: CatalogDatabase, mirrors: readonly string[]) {
        const enabledMirrors: CatalogMirror[] = [];
        for (const mirror of mirrors) {
            const mirrorId = this.getMirrorId(database, mirror);
            if (mirrorId && !this.isMirrorBlocked(CATALOG_MIRROR_URLS[mirrorId]) && !enabledMirrors.includes(mirrorId)) {
                enabledMirrors.push(mirrorId);
            }
        }
        PreferenceStore.Instance.setPreference(MIRROR_PREFERENCE_KEYS[database], enabledMirrors);
    }

    public getActiveMirror(database: CatalogDatabase): string | undefined {
        const activeMirror = this.activeMirrors.get(database);
        if (activeMirror) {
            const activeMirrorUrl = CATALOG_MIRROR_URLS[activeMirror];
            if (!this.isMirrorUnavailable(database, activeMirrorUrl)) {
                return activeMirrorUrl;
            }
        }
        return this.getMirrorSites(database).find(mirror => !this.isMirrorUnavailable(database, mirror));
    }

    @action public setActiveMirror(database: CatalogDatabase, mirror: string) {
        const mirrorId = this.getMirrorId(database, mirror);
        if (mirrorId && !this.isMirrorUnavailable(database, mirror)) {
            this.activeMirrors.set(database, mirrorId);
        }
    }

    public isMirrorBlocked = (mirror: string): boolean => {
        if (!IsSecurePage()) {
            return false;
        }
        try {
            return new URL(mirror).protocol === "http:";
        } catch {
            return false;
        }
    };

    public isMirrorUserDisabled = (database: CatalogDatabase, mirror: string): boolean => {
        const mirrorId = this.getMirrorId(database, mirror);
        return mirrorId !== null && !this.getEnabledMirrorIds(database).includes(mirrorId);
    };

    public isMirrorUnavailable = (database: CatalogDatabase, mirror: string): boolean => {
        return this.isMirrorBlocked(mirror) || this.isMirrorUserDisabled(database, mirror);
    };

    @action public toggleMirror = (database: CatalogDatabase, mirror: string) => {
        if (this.isMirrorBlocked(mirror)) {
            return;
        }

        const mirrorId = this.getMirrorId(database, mirror);
        if (!mirrorId) {
            return;
        }
        const enabledMirrors = this.getEnabledMirrorIds(database).filter(mirrorId => !this.isMirrorBlocked(CATALOG_MIRROR_URLS[mirrorId]));
        const index = enabledMirrors.indexOf(mirrorId);
        if (index >= 0) {
            if (enabledMirrors.length <= 1) {
                return;
            }
            enabledMirrors.splice(index, 1);
        } else {
            enabledMirrors.push(mirrorId);
        }
        PreferenceStore.Instance.setPreference(MIRROR_PREFERENCE_KEYS[database], enabledMirrors);
        if (index >= 0 && this.activeMirrors.get(database) === mirrorId) {
            this.activeMirrors.delete(database);
        }
    };

    @action public resetMirrorSettings = (database: CatalogDatabase) => {
        PreferenceStore.Instance.clearPreferences([MIRROR_PREFERENCE_KEYS[database]]);
        this.activeMirrors.delete(database);
    };

    @action public resetAllSettings = () => {
        PreferenceStore.Instance.clearPreferences(Object.values(MIRROR_PREFERENCE_KEYS));
        this.activeMirrors.clear();
    };

    private normalizeMirror = (mirror: string): string => {
        try {
            const url = new URL(mirror.trim());
            url.hash = "";
            return url.toString();
        } catch {
            return mirror.trim();
        }
    };

    private getMirrorId = (database: CatalogDatabase, mirror: string): CatalogMirror | null => {
        const mirrorIds = CATALOG_MIRRORS_BY_DATABASE[database];
        const directMirrorId = mirrorIds.find(mirrorId => mirrorId === mirror.trim());
        if (directMirrorId) {
            return directMirrorId;
        }
        const normalizedMirror = this.normalizeMirror(mirror);
        return mirrorIds.find(mirrorId => this.normalizeMirror(CATALOG_MIRROR_URLS[mirrorId]) === normalizedMirror) ?? null;
    };

    private getMirrorIds = (database: CatalogDatabase): CatalogMirror[] => {
        const defaults = [...CATALOG_MIRRORS_BY_DATABASE[database]];
        const enabledMirrors = this.getStoredMirrorIds(database);
        if (!enabledMirrors) {
            return defaults;
        }
        return [...enabledMirrors, ...defaults.filter(mirror => !enabledMirrors.includes(mirror))];
    };

    private getEnabledMirrorIds = (database: CatalogDatabase): CatalogMirror[] => {
        return this.getStoredMirrorIds(database) ?? [...CATALOG_MIRRORS_BY_DATABASE[database]];
    };

    private getStoredMirrorIds = (database: CatalogDatabase): CatalogMirror[] | undefined => {
        const storedMirrors = PreferenceStore.Instance.preferences.get(MIRROR_PREFERENCE_KEYS[database]);
        if (!Array.isArray(storedMirrors)) {
            return undefined;
        }

        const defaults = CATALOG_MIRRORS_BY_DATABASE[database];
        const mirrorIds: CatalogMirror[] = [];
        for (const mirror of storedMirrors) {
            if (typeof mirror !== "string") {
                continue;
            }
            const mirrorId = defaults.find(defaultMirror => defaultMirror === mirror);
            if (mirrorId && !mirrorIds.includes(mirrorId)) {
                mirrorIds.push(mirrorId);
            }
        }
        return mirrorIds;
    };
}
