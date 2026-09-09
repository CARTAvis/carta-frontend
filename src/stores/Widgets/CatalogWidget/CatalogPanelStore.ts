import {action, computed, makeObservable, observable} from "mobx";

import {CatalogSettingsTabs} from "enums";
import {PreferenceStore} from "stores";

/** State owned by one catalog panel rather than by the catalog it displays. */
export interface CatalogPanelLayoutSettings {
    panelId?: string;
    /** Kept for layouts written before panel state was separated from display state. */
    catalogFileId?: number;
    tableSeparatorPosition?: string;
    /** The settings section this panel was left on, per catalog file ID. */
    settingsTabIdByCatalog?: Record<string, CatalogSettingsTabs>;
    /** Kept for layouts written while the settings section belonged to the panel alone. */
    settingsTabId?: CatalogSettingsTabs;
}

export class CatalogPanelStore {
    @observable panelId: string;
    @observable selectedCatalogId: number = 1;
    @observable tableSeparatorPosition: string = PreferenceStore.Instance.catalogTableSeparatorPosition;
    /**
     * The settings section for each catalog this panel has shown. The section belongs to the panel,
     * so two panels showing one catalog keep their own, but it is remembered per catalog so that a
     * panel returning to a catalog returns to the section that catalog was left on.
     */
    @observable private settingsTabIdByCatalog = new Map<number, CatalogSettingsTabs>();

    constructor(selectedCatalogId: number = 1, panelId: string = "") {
        this.selectedCatalogId = selectedCatalogId;
        this.panelId = panelId;
        makeObservable(this);
    }

    @action setPanelId = (panelId: string) => {
        this.panelId = panelId;
    };

    @action setSelectedCatalogId = (catalogFileId: number) => {
        this.selectedCatalogId = catalogFileId;
    };

    @action setTableSeparatorPosition = (position: string) => {
        this.tableSeparatorPosition = position;
    };

    @computed get settingsTabId(): CatalogSettingsTabs {
        return this.settingsTabIdByCatalog.get(this.selectedCatalogId) ?? CatalogSettingsTabs.SIZE;
    }

    @action setSettingsTabId = (tabId: CatalogSettingsTabs) => {
        this.settingsTabIdByCatalog.set(this.selectedCatalogId, tabId);
    };

    public toLayoutSettings = (): CatalogPanelLayoutSettings => ({
        ...(this.panelId ? {panelId: this.panelId} : {}),
        catalogFileId: this.selectedCatalogId,
        tableSeparatorPosition: this.tableSeparatorPosition,
        settingsTabIdByCatalog: Object.fromEntries(Array.from(this.settingsTabIdByCatalog, ([catalogFileId, tabId]) => [String(catalogFileId), tabId]))
    });

    @action applyLayoutSettings = (settings: CatalogPanelLayoutSettings | null | undefined) => {
        if (!settings) {
            return;
        }
        if (typeof settings.panelId === "string" && settings.panelId) {
            this.panelId = settings.panelId;
        }
        if (typeof settings.catalogFileId === "number") {
            this.selectedCatalogId = settings.catalogFileId;
        }
        if (typeof settings.tableSeparatorPosition === "string") {
            this.tableSeparatorPosition = settings.tableSeparatorPosition;
        }
        if (settings.settingsTabIdByCatalog) {
            for (const [catalogFileId, tabId] of Object.entries(settings.settingsTabIdByCatalog)) {
                if (Number.isFinite(Number(catalogFileId)) && typeof tabId === "number") {
                    this.settingsTabIdByCatalog.set(Number(catalogFileId), tabId);
                }
            }
        } else if (typeof settings.settingsTabId === "number") {
            this.settingsTabIdByCatalog.set(this.selectedCatalogId, settings.settingsTabId);
        }
    };
}
