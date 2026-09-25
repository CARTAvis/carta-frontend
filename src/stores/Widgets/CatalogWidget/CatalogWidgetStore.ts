import {action, computed, makeObservable, observable} from "mobx";

import {CatalogSettingsTabs, WorkspaceItemKind} from "enums";
import {PreferenceStore} from "stores";
import {WorkspaceIdRegistry} from "stores/Workspace/WorkspaceIdRegistry";

/** State owned by one catalog widget rather than by the catalog it displays. */
export interface CatalogWidgetLayoutSettings {
    /** The widget's own identity, stable across the sessions a workspace spans. */
    widgetId?: string;
    /** Kept for layouts written while a widget named its catalog by the file ID of the session that saved it. */
    catalogFileId?: number;
    tableSeparatorPosition?: string;
    /** Widths of the header table's columns, as the user left them. */
    headerTableColumnWidths?: number[];
    /** The settings section this widget was left on, for a workspace, per the workspace's own catalog
     * ID: the file ID a session gave a catalog names a different catalog once it is opened again. */
    settingsTabIdByWorkspaceCatalog?: Record<string, CatalogSettingsTabs>;
    /** The settings section this widget was left on, for a saved layout, which names no catalog. */
    settingsTabId?: CatalogSettingsTabs;
}

export class CatalogWidgetStore {
    /** Columns of the header table: name, unit, type, display, description. */
    private static readonly HeaderTableColumnCount = 5;

    @observable widgetId: string;
    @observable selectedCatalogId: number = 1;
    @observable tableSeparatorPosition: string = PreferenceStore.Instance.catalogTableSeparatorPosition;
    /**
     * Widths of the header table's columns. The table lists the catalog's columns but belongs to the
     * widget showing it, so two widgets on one catalog size their headers independently.
     */
    @observable headerTableColumnWidths: number[] = [150, 75, 65, 100, 230];
    /**
     * The settings section for each catalog this widget has shown. The section belongs to the widget,
     * so two widgets showing one catalog keep their own, but it is remembered per catalog so that a
     * widget returning to a catalog returns to the section that catalog was left on.
     */
    @observable private settingsTabIdByCatalog = new Map<number, CatalogSettingsTabs>();

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

    @action setTableSeparatorPosition = (position: string) => {
        this.tableSeparatorPosition = position;
    };

    /** Resize one header table column, growing the widths to cover every column if they do not yet. */
    @action setHeaderTableColumnWidth = (index: number, width: number) => {
        if (index < 0 || index >= CatalogWidgetStore.HeaderTableColumnCount) {
            return;
        }
        if (this.headerTableColumnWidths.length !== CatalogWidgetStore.HeaderTableColumnCount) {
            const resized = new Array(CatalogWidgetStore.HeaderTableColumnCount).fill(undefined);
            for (let i = 0; i < Math.min(this.headerTableColumnWidths.length, resized.length); i++) {
                resized[i] = this.headerTableColumnWidths[i];
            }
            this.headerTableColumnWidths = resized;
        }
        this.headerTableColumnWidths[index] = width;
    };

    @computed get settingsTabId(): CatalogSettingsTabs {
        return this.settingsTabIdByCatalog.get(this.selectedCatalogId) ?? CatalogSettingsTabs.SIZE;
    }

    @action setSettingsTabId = (tabId: CatalogSettingsTabs) => {
        this.settingsTabIdByCatalog.set(this.selectedCatalogId, tabId);
    };

    public toLayoutSettings = (shouldIncludeWorkspaceBindings: boolean = false): CatalogWidgetLayoutSettings => ({
        ...(this.widgetId ? {widgetId: this.widgetId} : {}),
        tableSeparatorPosition: this.tableSeparatorPosition,
        ...(this.headerTableColumnWidths.every(width => Number.isFinite(width)) ? {headerTableColumnWidths: [...this.headerTableColumnWidths]} : {}),
        ...this.settingsTabsByCatalog(shouldIncludeWorkspaceBindings)
    });

    /**
     * The settings section of each catalog the widget has shown, naming each catalog the way
     * whoever reads the settings back will know it by.
     *
     * A workspace names its catalogs by IDs of its own, since the file IDs of the session it was
     * saved in are handed out again to other catalogs when it is opened. A saved layout names no
     * catalog at all: it is kept on a server and reused against whatever a later session has open,
     * so it carries only the section the widget was left on, for whichever catalog that turns out
     * to be.
     */
    private settingsTabsByCatalog = (shouldIncludeWorkspaceBindings: boolean): Pick<CatalogWidgetLayoutSettings, "settingsTabId" | "settingsTabIdByWorkspaceCatalog"> => {
        if (!shouldIncludeWorkspaceBindings) {
            return {settingsTabId: this.settingsTabId};
        }

        const settingsTabs = Array.from(this.settingsTabIdByCatalog);
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

    /**
     * Put back what a layout held for this widget.
     *
     * Which catalog the widget is on is settled before this is called, and is not read out of the
     * settings here: a section the widget was left on is kept per catalog, and filing it under an
     * ID that is about to be replaced files it where nothing looks for it.
     */
    @action applyLayoutSettings = (settings: CatalogWidgetLayoutSettings | null | undefined) => {
        if (!settings) {
            return;
        }
        if (typeof settings.widgetId === "string" && settings.widgetId) {
            this.widgetId = settings.widgetId;
        }
        if (typeof settings.tableSeparatorPosition === "string") {
            this.tableSeparatorPosition = settings.tableSeparatorPosition;
        }
        if (settings.headerTableColumnWidths?.length === CatalogWidgetStore.HeaderTableColumnCount && settings.headerTableColumnWidths.every(width => Number.isFinite(width))) {
            this.headerTableColumnWidths = [...settings.headerTableColumnWidths];
        }
        if (typeof settings.settingsTabId === "number") {
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
