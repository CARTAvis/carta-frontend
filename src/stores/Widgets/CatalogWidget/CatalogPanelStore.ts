import {action, computed, makeObservable, observable} from "mobx";

import {CatalogSettingsTabs, WorkspaceItemKind} from "enums";
import {PreferenceStore} from "stores";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";

/** State owned by one catalog panel rather than by the catalog it displays. */
export interface CatalogPanelLayoutSettings {
    panelId?: string;
    /** Kept for layouts written before panel state was separated from display state. */
    catalogFileId?: number;
    tableSeparatorPosition?: string;
    /** The settings section this panel was left on, per catalog file ID. */
    settingsTabIdByCatalog?: Record<string, CatalogSettingsTabs>;
    /** The same, for a workspace, per the workspace's own catalog ID: the file ID a session gave a
     * catalog names a different catalog once the workspace is opened again. */
    settingsTabIdByWorkspaceCatalog?: Record<string, CatalogSettingsTabs>;
    /** Kept for layouts written while the settings section belonged to the panel alone. */
    settingsTabId?: CatalogSettingsTabs;
}

export class CatalogPanelStore {
    @observable panelId: string;
    @observable selectedCatalogId: number = 1;
    @observable unavailableWorkspaceCatalogId: number | undefined = undefined;
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
        this.releaseUnavailableWorkspaceCatalogId();
    };

    /**
     * Keep naming a catalog a workspace could not bring back.
     *
     * The ID stays spoken for while the panel holds it, so that a catalog opened afterwards is not
     * handed the ID this panel would then be pointing at.
     */
    @action setUnavailableWorkspaceCatalogId = (workspaceCatalogId: number) => {
        this.releaseUnavailableWorkspaceCatalogId();
        this.unavailableWorkspaceCatalogId = workspaceCatalogId;
        WorkspaceIdRegistry.Instance.reserve(WorkspaceItemKind.Catalog, workspaceCatalogId);
    };

    /** Stop holding the ID of a catalog that was unavailable, whether the panel moved on or went away. */
    @action releaseUnavailableWorkspaceCatalogId = () => {
        if (this.unavailableWorkspaceCatalogId === undefined) {
            return;
        }
        WorkspaceIdRegistry.Instance.releaseReservation(WorkspaceItemKind.Catalog, this.unavailableWorkspaceCatalogId);
        this.unavailableWorkspaceCatalogId = undefined;
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

    public toLayoutSettings = (shouldIncludeWorkspaceBindings: boolean = false): CatalogPanelLayoutSettings => ({
        ...(this.panelId ? {panelId: this.panelId} : {}),
        catalogFileId: this.selectedCatalogId,
        tableSeparatorPosition: this.tableSeparatorPosition,
        ...this.settingsTabsByCatalog(shouldIncludeWorkspaceBindings)
    });

    /**
     * The settings section of each catalog the panel has shown, naming each catalog the way
     * whoever reads the settings back will know it by.
     *
     * A workspace names its catalogs by IDs of its own, since the file IDs of the session it was
     * saved in are handed out again to other catalogs when it is opened. A saved layout is reused
     * within the session that wrote it, so it goes on naming the file IDs it was written with.
     */
    private settingsTabsByCatalog = (shouldIncludeWorkspaceBindings: boolean): Pick<CatalogPanelLayoutSettings, "settingsTabIdByCatalog" | "settingsTabIdByWorkspaceCatalog"> => {
        const settingsTabs = Array.from(this.settingsTabIdByCatalog);
        if (!shouldIncludeWorkspaceBindings) {
            return {settingsTabIdByCatalog: Object.fromEntries(settingsTabs.map(([catalogFileId, tabId]) => [String(catalogFileId), tabId]))};
        }

        const workspaceSettingsTabs: [string, CatalogSettingsTabs][] = [];
        for (const [catalogFileId, tabId] of settingsTabs) {
            const workspaceCatalogId = WorkspaceIdRegistry.Instance.workspaceIdOf(WorkspaceItemKind.Catalog, catalogFileId);
            // A catalog this session never opened is not one the workspace can name.
            if (workspaceCatalogId !== undefined) {
                workspaceSettingsTabs.push([String(workspaceCatalogId), tabId]);
            }
        }
        return {settingsTabIdByWorkspaceCatalog: Object.fromEntries(workspaceSettingsTabs)};
    };

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
        if (settings.settingsTabIdByWorkspaceCatalog) {
            for (const [workspaceCatalogId, tabId] of Object.entries(settings.settingsTabIdByWorkspaceCatalog)) {
                // The workspace's own ID for a catalog, put back as the file ID this session opened
                // it as. A catalog the workspace could not bring back has none, and is left out.
                const catalogFileId = Number.isFinite(Number(workspaceCatalogId)) ? WorkspaceIdRegistry.Instance.sessionIdOf(WorkspaceItemKind.Catalog, Number(workspaceCatalogId)) : undefined;
                if (catalogFileId !== undefined && typeof tabId === "number") {
                    this.settingsTabIdByCatalog.set(catalogFileId, tabId);
                }
            }
        }
    };
}
