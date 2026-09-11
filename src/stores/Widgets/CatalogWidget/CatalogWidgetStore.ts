import {action, computed, makeObservable, observable} from "mobx";

import {CatalogSettingsTabs} from "enums";
import {type WorkspaceCatalogConfig} from "models/Workspace";
import {PreferenceStore} from "stores";

/** State owned by one catalog panel rather than by the catalog it displays. */
export interface CatalogWidgetLayoutSettings {
    widgetId?: string;
    /** Legacy session-local association. Read for migration, but no longer persisted. */
    catalogFileId?: number;
    tableSeparatorPosition?: string;
    /** Legacy settings sections keyed by session-local catalog file ID. */
    settingsTabIdByCatalog?: Record<string, CatalogSettingsTabs>;
    /** The settings section this panel was left on. */
    settingsTabId?: CatalogSettingsTabs;
}

export class CatalogWidgetStore {
    @observable widgetId: string;
    @observable selectedCatalogId: number = 1;
    @observable tableSeparatorPosition: string = PreferenceStore.Instance.catalogTableSeparatorPosition;
    /**
     * The settings section for each catalog this panel has shown. The section belongs to the panel,
     * so two panels showing one catalog keep their own, but it is remembered per catalog so that a
     * panel returning to a catalog returns to the section that catalog was left on.
     */
    @observable private settingsTabIdByCatalog = new Map<number, CatalogSettingsTabs>();
    /** Display settings restored before a session-local catalog has been selected. */
    private pendingDisplayConfig: WorkspaceCatalogConfig | undefined;

    constructor(selectedCatalogId: number = 1, widgetId: string = "") {
        this.selectedCatalogId = selectedCatalogId;
        this.widgetId = widgetId;
        makeObservable(this);
    }

    @action setWidgetId = (widgetId: string) => {
        this.widgetId = widgetId;
    };

    @action setSelectedCatalogId = (catalogFileId: number) => {
        this.selectedCatalogId = catalogFileId;
    };

    public setPendingDisplayConfig = (config: WorkspaceCatalogConfig) => {
        this.pendingDisplayConfig = config;
    };

    /** Return restored display settings exactly once, when this panel selects a real catalog. */
    public takePendingDisplayConfig = (): WorkspaceCatalogConfig | undefined => {
        const config = this.pendingDisplayConfig;
        this.pendingDisplayConfig = undefined;
        return config;
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

    public toLayoutSettings = (): CatalogWidgetLayoutSettings => ({
        ...(this.widgetId ? {widgetId: this.widgetId} : {}),
        tableSeparatorPosition: this.tableSeparatorPosition,
        settingsTabId: this.settingsTabId
    });

    @action applyLayoutSettings = (settings: CatalogWidgetLayoutSettings | null | undefined) => {
        if (!settings) {
            return;
        }
        if (typeof settings.widgetId === "string" && settings.widgetId) {
            this.widgetId = settings.widgetId;
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
