import {action, makeObservable, observable} from "mobx";

import {CatalogSettingsTabs} from "enums";
import {PreferenceStore} from "stores";

/** State owned by one catalog panel rather than by the catalog it displays. */
export interface CatalogPanelLayoutSettings {
    panelId?: string;
    /** Kept for layouts written before panel state was separated from display state. */
    catalogFileId?: number;
    tableSeparatorPosition?: string;
    settingsTabId?: CatalogSettingsTabs;
}

export class CatalogPanelStore {
    @observable panelId: string;
    @observable selectedCatalogId: number = 1;
    @observable tableSeparatorPosition: string = PreferenceStore.Instance.catalogTableSeparatorPosition;
    @observable settingsTabId: CatalogSettingsTabs = CatalogSettingsTabs.SIZE;

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

    @action setSettingsTabId = (tabId: CatalogSettingsTabs) => {
        this.settingsTabId = tabId;
    };

    public toLayoutSettings = (): CatalogPanelLayoutSettings => ({
        ...(this.panelId ? {panelId: this.panelId} : {}),
        tableSeparatorPosition: this.tableSeparatorPosition,
        settingsTabId: this.settingsTabId
    });

    @action applyLayoutSettings = (settings: CatalogPanelLayoutSettings | null | undefined) => {
        if (!settings) {
            return;
        }
        if (typeof settings.panelId === "string" && settings.panelId) {
            this.panelId = settings.panelId;
        }
        if (typeof settings.tableSeparatorPosition === "string") {
            this.tableSeparatorPosition = settings.tableSeparatorPosition;
        }
        if (typeof settings.settingsTabId === "number") {
            this.settingsTabId = settings.settingsTabId;
        }
    };
}
