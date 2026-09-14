import {action, computed, makeObservable, observable} from "mobx";

import {CatalogSettingsTabs} from "enums";
import {type WorkspaceCatalogAssociation, type WorkspaceCatalogConfig} from "models/Workspace";
import {PreferenceStore} from "stores";

/** State owned by one catalog widget rather than by the catalog it displays. */
export interface CatalogWidgetLayoutSettings extends WorkspaceCatalogAssociation {
    widgetId?: string;
    tableSeparatorPosition?: string;
    /** The settings section this widget was left on. */
    settingsTabId?: CatalogSettingsTabs;
}

export class CatalogWidgetStore {
    @observable widgetId: string;
    @observable selectedCatalogId: number = 1;
    @observable tableSeparatorPosition: string = PreferenceStore.Instance.catalogTableSeparatorPosition;
    /**
     * The settings section for each catalog this widget has shown. The section belongs to the widget,
     * so two widgets showing one catalog keep their own, but it is remembered per catalog so that a
     * widget returning to a catalog returns to the section that catalog was left on.
     */
    @observable private settingsTabIdByCatalog = new Map<number, CatalogSettingsTabs>();
    /** Display settings restored before a session-local catalog has been selected. */
    private pendingDisplayConfig: WorkspaceCatalogConfig | undefined;
    /** Stable association retained while the matching catalog is not loaded. */
    private catalogAssociation: WorkspaceCatalogAssociation | undefined;

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

    /** Bind a pending restore while carrying its widget-scoped settings section to the resolved ID. */
    @action bindPendingCatalogId = (catalogFileId: number) => {
        const pendingSettingsTabId = this.settingsTabIdByCatalog.get(this.selectedCatalogId);
        this.selectedCatalogId = catalogFileId;
        if (pendingSettingsTabId !== undefined) {
            this.settingsTabIdByCatalog.set(catalogFileId, pendingSettingsTabId);
        }
    };

    @action setCatalogAssociation = (association: WorkspaceCatalogAssociation | undefined) => {
        this.catalogAssociation = association;
    };

    public getCatalogAssociation = (): WorkspaceCatalogAssociation | undefined => this.catalogAssociation;

    public setPendingDisplayConfig = (config: WorkspaceCatalogConfig) => {
        this.pendingDisplayConfig = config;
    };

    /** Return restored display settings exactly once, when this widget selects a real catalog. */
    public takePendingDisplayConfig = (): WorkspaceCatalogConfig | undefined => {
        const config = this.pendingDisplayConfig;
        this.pendingDisplayConfig = undefined;
        return config;
    };

    /** Read restored display settings without consuming them, so that they can be written back out. */
    public getPendingDisplayConfig = (): WorkspaceCatalogConfig | undefined => this.pendingDisplayConfig;

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
        ...this.catalogAssociation,
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
        if (typeof settings.settingsTabId === "number") {
            this.settingsTabIdByCatalog.set(this.selectedCatalogId, settings.settingsTabId);
        }
    };
}
